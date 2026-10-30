'use server';

import { revalidatePath } from 'next/cache';
import type { WorkTypeState } from '@prisma/client';
import { z } from 'zod';
import { isUserError } from '@/server/errors';
import { db } from '@/server/db';
import { getAccess, itemActorContext } from '@/server/access';
import { requireAdmin, requireUser, ForbiddenError } from '@/server/rbac';
import { addComment, addFeedback, assign, changeStatus, createItem, resolveFeedback, updateFields, type ChangeActor, type FieldValue } from '@/server/services/work-items';
import { enableModule, setWorkTypeState, updateSyncConfig } from '@/server/services/work-types';
import { syncWorkType } from '@/server/sync/google-sheet';
import { snapshotWorkload } from '@/server/jobs';
import { dueDateToInstant } from '@/lib/time';
import { hashPassword, passwordProblem, verifyPassword } from '@/lib/password';

export type ActionResult = { ok: true; message?: string; id?: string } | { ok: false; error: string };

async function run(fn: () => Promise<string | void | { message: string; id: string }>): Promise<ActionResult> {
  try {
    const r = await fn();
    revalidatePath('/', 'layout');
    return typeof r === 'object' && r ? { ok: true, ...r } : { ok: true, message: r || undefined };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? 'Check the form and try again.' };
    console.error('[action]', e);
    return { ok: false, error: isUserError(e) ? e.message : 'Something went wrong. Please try again.' };
  }
}

/** Every item action runs as the signed-in person, with their access in that item's work type. */
async function itemActor(itemId: string): Promise<ChangeActor> {
  const user = await requireUser();
  const { ctx } = await itemActorContext(user, itemId);
  return { userId: user.id, ctx, source: 'APP' };
}

// ─── Work items ─────────────────────────────────────────────────

export async function changeStatusAction(itemId: string, to: string, version?: number, note?: string) {
  return run(async () => changeStatus(await itemActor(itemId), itemId, to, { expectedVersion: version, note }));
}

export async function assignAction(itemId: string, assigneeId: string | null) {
  return run(async () => assign(await itemActor(itemId), itemId, assigneeId));
}

export async function updateFieldsAction(itemId: string, patch: Record<string, FieldValue>) {
  return run(async () => {
    await updateFields(await itemActor(itemId), itemId, patch);
    return 'Saved';
  });
}

export async function feedbackAction(itemId: string, input: { body: string; category?: string; severity?: string; requestCorrections?: boolean }) {
  return run(async () => {
    await addFeedback(await itemActor(itemId), itemId, input);
    return input.requestCorrections ? 'Feedback sent and corrections requested' : 'Feedback added';
  });
}

export async function resolveFeedbackAction(feedbackId: string) {
  return run(async () => {
    const fb = await db.feedback.findUniqueOrThrow({ where: { id: feedbackId }, select: { itemId: true } });
    await resolveFeedback(await itemActor(fb.itemId), feedbackId);
  });
}

export async function commentAction(itemId: string, body: string) {
  return run(async () => addComment(await itemActor(itemId), itemId, body));
}

export async function createItemAction(workTypeId: string, input: { externalKey: string; title: string; ownerId?: string; assigneeId?: string; dueAt?: string; groupKey?: string }) {
  return run(async () => {
    const user = await requireUser();
    const access = await getAccess(user);
    const wt = [...access.byKey.values()].find(a => a.workTypeId === workTypeId);
    if (!wt) throw new ForbiddenError('You don’t have access to this work type.');
    if (!input.externalKey.trim() || !input.title.trim()) throw new Error('Key and title are required');
    const chapter = input.groupKey ? await db.chapter.findUnique({ where: { code: input.groupKey.trim() } }) : null;
    const ctx = { isAdmin: access.isAdmin, capabilities: wt.capabilities, isAssignee: false, canEdit: wt.canEdit };
    await createItem({ userId: user.id, ctx, source: 'APP' }, workTypeId, {
      externalKey: input.externalKey.trim(),
      title: input.title.trim(),
      ownerId: input.ownerId || null,
      assigneeId: input.assigneeId || null,
      dueAt: input.dueAt ? dueDateToInstant(input.dueAt) : null,
      groupKey: input.groupKey?.trim() || null,
      chapterId: chapter?.id ?? null,
      data: chapter ? { chapterTitle: chapter.title } : {},
    });
    return 'Created';
  });
}

// ─── Admin: users ───────────────────────────────────────────────

const email = z
  .string()
  .trim()
  .toLowerCase()
  .refine(v => v === '' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), 'Enter a valid email');

const accessInput = z.object({
  workTypeId: z.string(),
  enabled: z.boolean(),
  /** Roles held in this work type; data scope, edit right and pages come from the roles. */
  roleIds: z.array(z.string()),
});

const userInput = z.object({
  id: z.string().optional(),
  /** Imported person (from the sheet) to turn into this account instead of creating a duplicate. */
  linkUserId: z.string().optional(),
  name: z.string().trim().min(1, 'Name is required').max(120),
  email,
  capacity: z.number().int().min(1).max(20),
  active: z.boolean(),
  isAdmin: z.boolean(),
  password: z.string().optional(),
  access: z.array(accessInput),
});

export type UserInput = z.infer<typeof userInput>;

/** Create or update a person and their access to every work type (Add / Edit user page). */
export async function saveUserAction(raw: UserInput) {
  return run(async () => {
    const admin = await requireAdmin();
    const input = userInput.parse(raw);
    const targetId = input.id ?? input.linkUserId;
    if (targetId === admin.id && (!input.isAdmin || !input.active)) throw new ForbiddenError('You can’t remove your own admin access or deactivate yourself.');

    if (input.email) {
      const clash = await db.user.findUnique({ where: { email: input.email } });
      if (clash && clash.id !== targetId) throw new Error(`${input.email} is already used by ${clash.name ?? 'another person'}.`);
    }
    for (const a of input.access) {
      if (a.enabled && !a.roleIds.length) throw new Error('Pick at least one role for each work type you give access to.');
    }
    let pw = {};
    if (input.password) {
      const problem = passwordProblem(input.password, input.email);
      if (problem) throw new Error(problem);
      pw = { passwordHash: await hashPassword(input.password), passwordUpdatedAt: new Date() };
    }

    const base = { name: input.name, email: input.email || null, capacity: input.capacity, active: input.active, isAdmin: input.isAdmin, ...pw };
    const id = await db.$transaction(async tx => {
      const user = targetId ? await tx.user.update({ where: { id: targetId }, data: base }) : await tx.user.create({ data: base });
      for (const a of input.access) {
        const key = { workTypeId_userId: { workTypeId: a.workTypeId, userId: user.id } };
        if (!a.enabled) {
          await tx.workTypeMember.deleteMany({ where: { workTypeId: a.workTypeId, userId: user.id } });
          continue;
        }
        await tx.workTypeMember.upsert({ where: key, create: { workTypeId: a.workTypeId, userId: user.id }, update: {} });
        await tx.workTypeMemberRole.deleteMany({ where: { workTypeId: a.workTypeId, userId: user.id } });
        await tx.workTypeMemberRole.createMany({ data: [...new Set(a.roleIds)].map(roleId => ({ workTypeId: a.workTypeId, userId: user.id, roleId })) });
      }
      return user.id;
    });
    if (!input.active) await db.session.deleteMany({ where: { userId: id } });
    return { message: input.id ? 'Saved' : `Added ${input.name}`, id };
  });
}

export async function setUserActiveAction(userId: string, active: boolean) {
  return run(async () => {
    const admin = await requireAdmin();
    if (userId === admin.id && !active) throw new ForbiddenError('You can’t deactivate yourself.');
    await db.user.update({ where: { id: userId }, data: { active } });
    if (!active) await db.session.deleteMany({ where: { userId } });
    return active ? 'Activated' : 'Deactivated';
  });
}

// ─── Admin: roles ───────────────────────────────────────────────

const roleInput = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, 'Name is required').max(60),
  description: z.string().trim().max(240).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Pick a colour'),
  capWork: z.boolean(),
  capReview: z.boolean(),
  capAssign: z.boolean(),
  capCreate: z.boolean(),
  capManageFields: z.boolean(),
  dataScope: z.enum(['OWN', 'ALL']),
  canEdit: z.boolean(),
  pageDashboard: z.boolean(),
  pageItems: z.boolean(),
  pageReports: z.boolean(),
  pageExport: z.boolean(),
});

export type RoleInput = z.infer<typeof roleInput>;

export async function saveRoleAction(raw: RoleInput) {
  return run(async () => {
    await requireAdmin();
    const { id, ...parsed } = roleInput.parse(raw);
    const data = { ...parsed, pageExport: parsed.pageReports && parsed.pageExport };
    if (!data.pageDashboard && !data.pageItems && !data.pageReports) throw new Error('Tick at least one page this role can see.');
    const key = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const clash = await db.accessRole.findFirst({ where: { OR: [{ key }, { name: { equals: data.name, mode: 'insensitive' } }], ...(id ? { NOT: { id } } : {}) } });
    if (clash) throw new Error(`A role called “${clash.name}” already exists.`);
    if (id) await db.accessRole.update({ where: { id }, data });
    else await db.accessRole.create({ data: { ...data, key } });
    return id ? 'Role saved' : `Role “${data.name}” added`;
  });
}

export async function deleteRoleAction(id: string) {
  return run(async () => {
    await requireAdmin();
    const role = await db.accessRole.findUniqueOrThrow({ where: { id }, include: { _count: { select: { members: true } } } });
    if (role.isSystem) throw new Error('Built-in roles can be edited but not removed.');
    if (role._count.members) throw new Error(`${role._count.members} person/people still have “${role.name}”. Remove it from them first.`);
    await db.accessRole.delete({ where: { id } });
    return `Role “${role.name}” removed`;
  });
}

/** Permanently delete a person – only when they have no work history (otherwise deactivate keeps reports intact). */
export async function removeUserAction(userId: string) {
  return run(async () => {
    const admin = await requireAdmin();
    if (userId === admin.id) throw new ForbiddenError('You can’t remove yourself.');
    const user = await db.user.findUniqueOrThrow({
      where: { id: userId },
      include: { _count: { select: { assignedItems: true, ownedItems: true, events: true, feedback: true, intervals: true } } },
    });
    const c = user._count;
    if (c.assignedItems || c.ownedItems || c.events || c.feedback || c.intervals) {
      const parts = [c.assignedItems && `${c.assignedItems} assigned`, c.ownedItems && `${c.ownedItems} owned`, (c.events || c.intervals || c.feedback) && 'past activity on items'].filter(Boolean);
      throw new Error(`${user.name ?? user.email} has work history (${parts.join(', ')}). Deactivate them instead so reports keep their name.`);
    }
    await db.user.delete({ where: { id: userId } });
    return `Removed ${user.name ?? user.email}`;
  });
}

// ─── Admin: work types & sync ───────────────────────────────────

export async function enableModuleAction(key: string) {
  return run(async () => {
    await requireAdmin();
    await enableModule(key);
    return 'Work type enabled';
  });
}

export async function setWorkTypeStateAction(id: string, state: WorkTypeState) {
  return run(async () => {
    await requireAdmin();
    await setWorkTypeState(id, state);
    return state === 'ACTIVE' ? 'Resumed' : state === 'PAUSED' ? 'Paused' : 'Archived';
  });
}

export async function updateSyncAction(id: string, sync: { enabled: boolean; tab: string; spreadsheetId?: string }) {
  return run(async () => {
    await requireAdmin();
    await updateSyncConfig(id, { enabled: sync.enabled, tab: sync.tab.trim(), spreadsheetId: (sync.spreadsheetId ?? '').trim() });
    return sync.enabled ? 'Sync on' : 'Sync off';
  });
}

export async function syncNowAction(workTypeId: string) {
  return run(async () => {
    await requireAdmin();
    const r = await syncWorkType(workTypeId, { force: true });
    await snapshotWorkload();
    if (r.skipped) return `Skipped: ${r.skipped}`;
    return `Pushed ${r.pushed}, read ${r.pulled} rows, created ${r.created}, conflicts ${r.conflicts}${r.missing ? `, ${r.missing} missing from sheet` : ''}`;
  });
}

// ─── Passwords ──────────────────────────────────────────────────

/** Admin sets (or clears) someone's password, e.g. a temporary one to share with them. */
export async function setUserPasswordAction(userId: string, password: string | null) {
  return run(async () => {
    await requireAdmin();
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.email) throw new Error('Add an email for this person first.');
    if (password === null) {
      await db.user.update({ where: { id: userId }, data: { passwordHash: null, passwordUpdatedAt: new Date() } });
      return 'Password removed – they can still use the email link or Google';
    }
    const problem = passwordProblem(password, user.email);
    if (problem) throw new Error(problem);
    await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(password), passwordUpdatedAt: new Date() } });
    return `Password set for ${user.name ?? user.email}`;
  });
}

/** Signed-in user changes their own password (current password needed if one is set). */
export async function changeMyPasswordAction(input: { current: string; next: string; confirm: string }) {
  return run(async () => {
    const me = await requireUser();
    const user = await db.user.findUniqueOrThrow({ where: { id: me.id } });
    if (user.passwordHash && !(await verifyPassword(input.current, user.passwordHash))) throw new Error('Current password is incorrect.');
    if (input.next !== input.confirm) throw new Error('The new passwords don’t match.');
    const problem = passwordProblem(input.next, user.email);
    if (problem) throw new Error(problem);
    await db.user.update({ where: { id: me.id }, data: { passwordHash: await hashPassword(input.next), passwordUpdatedAt: new Date() } });
    return user.passwordHash ? 'Password changed' : 'Password set – you can now sign in with it';
  });
}
