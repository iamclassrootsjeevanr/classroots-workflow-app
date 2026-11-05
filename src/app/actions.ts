'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import type { WorkTypeState } from '@prisma/client';
import { z } from 'zod';
import type { EditableField } from '@/components/controls';
import { isUserError } from '@/server/errors';
import { db } from '@/server/db';
import { getAccess, itemActorContext } from '@/server/access';
import { requireAdmin, requireUser, ForbiddenError } from '@/server/rbac';
import { addComment, addFeedback, assign, changeStatus, createItem, deleteItem, noteFeedback, resolveFeedback, restoreItem, setOwner, updateFields, type ChangeActor, type FieldValue, type SyncDirection } from '@/server/services/work-items';
import { createApkVersion, deleteApkVersion, restoreApkVersion, updateApkVersion, updateTestCase, type TestCasePatch, type VersionMeta } from '@/server/services/apk-versions';
import { enableModule, resetSystemRole, setWorkTypeState, updateSyncConfig } from '@/server/services/work-types';
import { syncWorkType } from '@/server/sync/google-sheet';
import { addStage, removeStage, saveStage, type StageInput } from '@/server/stages';
import { listNotifications, removeNotifications, setRead, unreadCount } from '@/server/services/notifications';
import type { NotificationView } from '@/lib/notifications-core';
import { loadVersionCases } from '@/server/apk/queries';
import { editFieldsForItem } from '@/server/view';
import { appTz } from '@/server/settings';
import { snapshotWorkload } from '@/server/jobs';
import { dueDateToInstant } from '@/lib/time';
import { capabilitiesIn } from '@/lib/access-core';
import { getModule } from '@/modules/registry';
import { hashPassword, passwordProblem, verifyPassword } from '@/lib/password';
import { isOfficeEmail, missingPasswordProblem } from '@/lib/invite';
import { env } from '@/server/env';
import { sendAccessEmail } from '@/server/invites';
import { COOKIE_MAX_AGE, PREFS_COOKIE, PrefsSchema, serializePrefsCookie } from '@/lib/prefs';

export type ActionResult = { ok: true; message?: string; id?: string; invite?: string } | { ok: false; error: string };

async function run(fn: () => Promise<string | void | { message: string; id: string; invite?: string }>): Promise<ActionResult> {
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

export async function setOwnerAction(itemId: string, ownerId: string | null) {
  return run(async () => setOwner(await itemActor(itemId), itemId, ownerId));
}

export async function updateFieldsAction(itemId: string, patch: Record<string, FieldValue>) {
  return run(async () => {
    await updateFields(await itemActor(itemId), itemId, patch);
    return 'Saved';
  });
}

export async function deleteItemAction(itemId: string) {
  return run(async () => {
    await deleteItem(await itemActor(itemId), itemId);
    return 'Deleted';
  });
}

/** Fields of one item for the list Edit dialog (loaded on open so list pages stay small). */
export async function loadEditFieldsAction(itemId: string): Promise<{ ok: true; fields: EditableField[] } | { ok: false; error: string }> {
  try {
    const user = await requireUser();
    await itemActorContext(user, itemId);
    return { ok: true, fields: await editFieldsForItem(user, itemId, appTz()) };
  } catch (e) {
    return { ok: false, error: isUserError(e) ? e.message : 'Could not load the details.' };
  }
}

// ─── Inbox ──────────────────────────────────────────────────────

/** Latest messages for the Inbox popover. */
export async function loadInboxAction(): Promise<{ ok: true; items: NotificationView[]; unread: number } | { ok: false; error: string }> {
  try {
    const user = await requireUser();
    const [items, unread] = await Promise.all([listNotifications(user.id, { tab: 'unread', take: 8 }), unreadCount(user.id)]);
    return { ok: true, items, unread };
  } catch {
    return { ok: false, error: 'Could not load your inbox.' };
  }
}

/** Mark messages read or unread; no ids = all of them. */
export async function markNotificationsAction(read: boolean, ids?: string[]) {
  return run(async () => {
    const user = await requireUser();
    await setRead(user.id, read, ids);
  });
}

export async function deleteNotificationsAction(ids: string[]) {
  return run(async () => {
    const user = await requireUser();
    await removeNotifications(user.id, ids);
  });
}

/** Undo a delete (allowed for 30 minutes). */
export async function restoreItemAction(itemId: string) {
  return run(async () => {
    await restoreItem(await itemActor(itemId), itemId);
    return 'Restored';
  });
}

export async function feedbackAction(itemId: string, input: { body: string; category?: string; severity?: string; requestCorrections?: boolean }) {
  return run(async () => {
    await addFeedback(await itemActor(itemId), itemId, input);
    return input.requestCorrections ? 'Feedback sent and changes asked' : 'Feedback added';
  });
}

export async function resolveFeedbackAction(feedbackId: string) {
  return run(async () => {
    const fb = await db.feedback.findUniqueOrThrow({ where: { id: feedbackId }, select: { itemId: true } });
    await resolveFeedback(await itemActor(fb.itemId), feedbackId);
  });
}

export async function noteFeedbackAction(feedbackId: string, note: string) {
  return run(async () => {
    const fb = await db.feedback.findUniqueOrThrow({ where: { id: feedbackId }, select: { itemId: true } });
    await noteFeedback(await itemActor(fb.itemId), feedbackId, note);
    return note.trim() ? 'Reply saved' : 'Reply removed';
  });
}

export async function commentAction(itemId: string, body: string) {
  return run(async () => addComment(await itemActor(itemId), itemId, body));
}

export async function createItemAction(workTypeId: string, input: { externalKey: string; title: string; ownerId?: string; assigneeId?: string; dueAt?: string; groupKey?: string; data?: Record<string, string> }) {
  return run(async () => {
    const user = await requireUser();
    const access = await getAccess(user);
    const wt = [...access.byKey.values()].find(a => a.workTypeId === workTypeId);
    if (!wt) throw new ForbiddenError('You don’t have access to this work type.');
    if (!input.externalKey.trim() || !input.title.trim()) throw new Error('Key and title are required');
    const mod = getModule(wt.workTypeKey);
    const externalKey = mod?.groupFromKey ? input.externalKey.trim().toUpperCase() : input.externalKey.trim();
    let groupKey = input.groupKey?.trim() || null;
    if (mod?.groupFromKey) {
      const fromKey = mod.groupFromKey(externalKey);
      if (!fromKey) throw new Error(`A ${mod.itemNoun} key looks like ${mod.keyExample ?? 'the others'}.`);
      if (groupKey && groupKey !== fromKey) throw new Error(`${externalKey} belongs to ${fromKey}, not ${groupKey}.`);
      groupKey = fromKey;
    }
    const chapter = groupKey ? await db.chapter.findUnique({ where: { code: groupKey } }) : null;
    if (!access.isAdmin && wt.groupKeys && !wt.groupKeys.has(groupKey ?? '')) {
      throw new ForbiddenError(`You can add items only in ${[...wt.groupKeys].join(', ')}.`);
    }
    const ctx = { isAdmin: access.isAdmin, capabilities: capabilitiesIn(wt, groupKey), isAssignee: false, canEdit: wt.canEdit };
    await createItem({ userId: user.id, ctx, source: 'APP' }, workTypeId, {
      externalKey,
      title: input.title.trim(),
      ownerId: input.ownerId || null,
      assigneeId: input.assigneeId || null,
      dueAt: input.dueAt ? dueDateToInstant(input.dueAt) : null,
      groupKey,
      chapterId: chapter?.id ?? null,
      data: { ...(chapter ? { chapterTitle: chapter.title } : {}), ...Object.fromEntries(Object.entries(input.data ?? {}).filter(([, v]) => typeof v === 'string' && v.trim())) },
    });
    return 'Created';
  });
}

export type NewApkVersionInput = {
  version: string;
  apkUrl?: string;
  releaseDate?: string;
  releaseNotes?: string;
  copyFrom?: string;
  includeCaseIds: string[];
  extraCases: { testCaseId: string; title: string; scenario?: string; expected?: string; steps?: string; priority?: string }[];
  assigneeId?: string;
};

async function workTypeActor(workTypeId: string) {
  const user = await requireUser();
  const access = await getAccess(user);
  const wt = [...access.byKey.values()].find(a => a.workTypeId === workTypeId);
  if (!wt) throw new ForbiddenError('You don’t have access to this work type.');
  const ctx = { isAdmin: access.isAdmin, capabilities: wt.capabilities, isAssignee: false, canEdit: wt.canEdit };
  return { user, ctx, actor: { userId: user.id, ctx, source: 'APP' } as ChangeActor };
}

/** Add an APK version with tests copied from an earlier version. New tests go to the creator when they can test. */
export async function createApkVersionAction(workTypeId: string, input: NewApkVersionInput) {
  return run(async () => {
    const { user, ctx, actor } = await workTypeActor(workTypeId);
    const canTest = ctx.isAdmin || ctx.capabilities.has('work');
    const r = await createApkVersion(actor, workTypeId, { ...input, assigneeId: input.assigneeId || (canTest ? user.id : null) });
    return `Created ${r.version} with ${r.count} tests`;
  });
}

/** Delete (deactivate) a whole APK version and its tests. Undo for 30 minutes from the Inbox. */
export async function deleteApkVersionAction(workTypeId: string, version: string) {
  return run(async () => {
    const { actor } = await workTypeActor(workTypeId);
    const r = await deleteApkVersion(actor, workTypeId, version);
    return { message: `Deleted ${version} (${r.count} tests)`, id: r.deletedAt };
  });
}

export async function restoreApkVersionAction(workTypeId: string, version: string, deletedAt: string) {
  return run(async () => {
    const { actor } = await workTypeActor(workTypeId);
    const r = await restoreApkVersion(actor, workTypeId, version, deletedAt);
    return `Restored ${version} (${r.count} tests)`;
  });
}

/** Test cases of one version, loaded when the New APK version dialog picks a version to copy from. */
export async function loadVersionCasesAction(workTypeId: string, versionKey: string): Promise<{ id: string; title: string }[]> {
  await workTypeActor(workTypeId);
  return loadVersionCases(workTypeId, versionKey);
}

/** Edit a test case's scenario, expected result, steps or default priority (applies to every version that runs it). */
export async function updateTestCaseAction(workTypeId: string, caseId: string, patch: TestCasePatch) {
  return run(async () => {
    const { actor } = await workTypeActor(workTypeId);
    await updateTestCase(actor, workTypeId, caseId, patch);
    return 'Saved';
  });
}

export async function updateApkVersionAction(workTypeId: string, version: string, meta: VersionMeta) {
  return run(async () => {
    const { actor } = await workTypeActor(workTypeId);
    const r = await updateApkVersion(actor, workTypeId, version, meta);
    return `Updated ${version} (${r.count} tests)`;
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
  /** Groups (Journey: chapters) where their assign / add / edit-details rights apply; empty = every group. */
  groupKeys: z.array(z.string().trim().min(1)).optional(),
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
  /** Email them their access (and the new password, if one is set now) after saving. */
  notify: z.boolean().optional(),
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
      const current = targetId ? await db.user.findUnique({ where: { id: targetId }, select: { passwordHash: true } }) : null;
      const noPassword = missingPasswordProblem({
        email: input.email,
        active: input.active,
        officeDomains: env().OFFICE_DOMAINS,
        hasPassword: Boolean(current?.passwordHash),
        newPassword: input.password,
      });
      if (noPassword) throw new Error(noPassword);
    }
    for (const a of input.access) {
      if (a.enabled && !a.roleIds.length) throw new Error('Pick at least one role for each work type you give access to.');
      // Roles belong to one work type: every picked role must be a role of that work type.
      if (a.enabled) {
        const ok = await db.accessRole.count({ where: { id: { in: a.roleIds }, workTypeId: a.workTypeId } });
        if (ok !== new Set(a.roleIds).size) throw new Error('A picked role does not belong to that work type.');
      }
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
        const groupKeys = [...new Set(a.groupKeys ?? [])];
        await tx.workTypeMember.upsert({ where: key, create: { workTypeId: a.workTypeId, userId: user.id, groupKeys }, update: { groupKeys } });
        await tx.workTypeMemberRole.deleteMany({ where: { workTypeId: a.workTypeId, userId: user.id } });
        await tx.workTypeMemberRole.createMany({ data: [...new Set(a.roleIds)].map(roleId => ({ workTypeId: a.workTypeId, userId: user.id, roleId })) });
      }
      return user.id;
    });
    if (!input.active) await db.session.deleteMany({ where: { userId: id } });
    let message = input.id ? 'Saved' : `Added ${input.name}`;
    let invite: string | undefined;
    if (input.notify && input.email && input.active) {
      try {
        invite = await sendAccessEmail(id, admin.name ?? admin.email ?? 'An admin', input.password || undefined);
        message += invite === 'sent' ? ` · invite emailed to ${input.email}` : ' · email is not set up, so the invite was printed in the server log';
      } catch (e) {
        console.error('[invite]', e);
        invite = 'failed';
        message += ' · the invite email could not be sent (check EMAIL_SERVER)';
      }
    }
    return { message, id, invite };
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
  /** The work type this role belongs to (fixed once created). */
  workTypeId: z.string().min(1),
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
    const { id, workTypeId, ...parsed } = roleInput.parse(raw);
    const data = { ...parsed, pageExport: parsed.pageReports && parsed.pageExport };
    await db.workType.findUniqueOrThrow({ where: { id: workTypeId } });
    if (!data.pageDashboard && !data.pageItems && !data.pageReports) throw new Error('Tick at least one page this role can see.');
    const key = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const clash = await db.accessRole.findFirst({ where: { workTypeId, OR: [{ key }, { name: { equals: data.name, mode: 'insensitive' } }], ...(id ? { NOT: { id } } : {}) } });
    if (clash) throw new Error(`A role called “${clash.name}” already exists in this work type.`);
    if (id) {
      const own = await db.accessRole.count({ where: { id, workTypeId } });
      if (!own) throw new Error('That role belongs to another work type.');
      await db.accessRole.update({ where: { id }, data });
    } else await db.accessRole.create({ data: { ...data, key, workTypeId } });
    return id ? 'Role saved' : `Role “${data.name}” added`;
  });
}

export async function resetRoleAction(id: string) {
  return run(async () => {
    await requireAdmin();
    const r = await resetSystemRole(id);
    return `“${r.name}” is back to the flow’s default`;
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

export async function saveStageAction(workTypeId: string, key: string, input: StageInput) {
  return run(async () => {
    await requireAdmin();
    await saveStage(workTypeId, key, input);
    return 'Stage saved';
  });
}

export async function addStageAction(workTypeId: string, afterKey: string, input: StageInput) {
  return run(async () => {
    await requireAdmin();
    const key = await addStage(workTypeId, afterKey, input);
    return { message: `Stage “${input.label.trim()}” added`, id: key };
  });
}

export async function removeStageAction(workTypeId: string, key: string) {
  return run(async () => {
    await requireAdmin();
    return (await removeStage(workTypeId, key)) === 'deleted' ? 'Stage removed' : 'Stage has history, so it is skipped instead of removed';
  });
}

export async function setWorkTypeStateAction(id: string, state: WorkTypeState) {
  return run(async () => {
    await requireAdmin();
    await setWorkTypeState(id, state);
    return state === 'ACTIVE' ? 'Resumed' : state === 'PAUSED' ? 'Paused' : 'Archived';
  });
}

export async function updateSyncAction(id: string, sync: { enabled: boolean; tab: string; spreadsheetId?: string; direction: SyncDirection }) {
  return run(async () => {
    await requireAdmin();
    const direction: SyncDirection = sync.direction === 'two-way' ? 'two-way' : 'app-to-sheet';
    await updateSyncConfig(id, { enabled: sync.enabled, tab: sync.tab.trim(), spreadsheetId: (sync.spreadsheetId ?? '').trim(), direction });
    return sync.enabled ? `Sync on (${direction === 'two-way' ? 'two-way' : 'app → sheet'})` : 'Sync off';
  });
}

export async function syncNowAction(workTypeId: string) {
  return run(async () => {
    await requireAdmin();
    const r = await syncWorkType(workTypeId, { force: true });
    await snapshotWorkload();
    if (r.skipped) return `Skipped: ${r.skipped}`;
    if (r.direction === 'app-to-sheet') {
      return `Wrote ${r.pushed} cells, read ${r.pulled} rows${r.created ? `, ${r.created} rows to add` : ''}${r.missing ? `, ${r.missing} rows only in the sheet (left alone)` : ''}`;
    }
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
      return isOfficeEmail(user.email, env().OFFICE_DOMAINS) ? 'Password removed – they sign in with Google' : 'Password removed – they can’t sign in until you set a new one';
    }
    const problem = passwordProblem(password, user.email);
    if (problem) throw new Error(problem);
    await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(password), passwordUpdatedAt: new Date() } });
    return `Password set for ${user.name ?? user.email}`;
  });
}

/** (Re)send someone their access email: Google steps for office emails, else a link to choose a password (the old one keeps working). */
export async function sendInviteAction(userId: string) {
  return run(async () => {
    const admin = await requireAdmin();
    const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
    const r = await sendAccessEmail(userId, admin.name ?? admin.email ?? 'An admin');
    return r === 'sent' ? `Invite sent to ${user.email}` : 'Email isn’t set up on this server, so the invite was printed in the server log';
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

/** Theme, text size and density – saved on the user so they follow them to every device, and mirrored in a cookie for the sign-in page. */
export async function savePrefsAction(raw: unknown) {
  return run(async () => {
    const me = await requireUser();
    const prefs = PrefsSchema.parse(raw);
    await db.user.update({ where: { id: me.id }, data: { prefs } });
    (await cookies()).set(PREFS_COOKIE, serializePrefsCookie(prefs), { path: '/', maxAge: COOKIE_MAX_AGE, sameSite: 'lax' });
    return 'Saved';
  });
}
