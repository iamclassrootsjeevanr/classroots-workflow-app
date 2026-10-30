import { Prisma, type EventSource, type WorkItem, type WorkType } from '@prisma/client';
import { requireModule, statusDef } from '@/modules/registry';
import type { FieldDef, WorkTypeDefinition } from '@/modules/types';
import { itemSheetValues } from '@/lib/sheet-core';
import { businessMinutesBetween, dueDateToInstant, minutesBetween, normalizeDate, type WorkCalendar } from '@/lib/time';
import { canEditField, canTransition, hasCap, stagePatch, type ActorContext } from '@/lib/workflow';
import { db } from '../db';
import { ConflictError, ForbiddenError, PausedError } from '../errors';
import { workCalendar } from '../settings';

type Tx = Prisma.TransactionClient;

/** Who is making a change. ctx = null means a trusted system/sheet change (no permission checks). */
export type ChangeActor = { userId: string | null; ctx: ActorContext | null; source: EventSource };

type ItemWithType = WorkItem & { workType: WorkType };

export type WorkTypeConfig = { sync?: { enabled?: boolean; tab?: string; spreadsheetId?: string } };
export const workTypeConfig = (wt: WorkType) => (wt.config ?? {}) as WorkTypeConfig;

async function loadItem(tx: Tx, itemId: string): Promise<ItemWithType> {
  return tx.workItem.findUniqueOrThrow({ where: { id: itemId }, include: { workType: true } });
}

function guardActive(item: ItemWithType, actor: ChangeActor) {
  if (actor.source === 'APP' && item.workType.state !== 'ACTIVE') throw new PausedError(item.workType.name);
}

async function saveItem(tx: Tx, item: WorkItem, data: Prisma.WorkItemUncheckedUpdateInput, expectedVersion?: number) {
  const version = expectedVersion ?? item.version;
  const res = await tx.workItem.updateMany({ where: { id: item.id, version }, data: { ...data, version: { increment: 1 } } });
  if (res.count !== 1) throw new ConflictError();
}

/** Close the open stage interval and open a new one (new status, or same status after reassignment). */
async function rollInterval(tx: Tx, itemId: string, status: string, assigneeId: string | null, now: Date, cal: WorkCalendar, sameRound = false) {
  const open = await tx.workItemStageInterval.findMany({ where: { itemId, exitedAt: null } });
  for (const iv of open) {
    await tx.workItemStageInterval.update({
      where: { id: iv.id },
      data: { exitedAt: now, durationMinutes: minutesBetween(iv.enteredAt, now), businessMinutes: businessMinutesBetween(iv.enteredAt, now, cal) },
    });
  }
  const prior = await tx.workItemStageInterval.findMany({ where: { itemId, status }, select: { round: true } });
  const maxRound = prior.reduce((m, p) => Math.max(m, p.round), 0);
  const round = sameRound ? Math.max(1, maxRound) : maxRound + 1;
  await tx.workItemStageInterval.create({ data: { itemId, status, assigneeId, enteredAt: now, round } });
}

/** Queue sheet writes for changed columns (latest value wins). Skipped for changes that came from the sheet. */
async function enqueue(tx: Tx, itemId: string, wt: WorkType, mod: WorkTypeDefinition, actor: ChangeActor, columns: string[]) {
  if (actor.source === 'SHEET' || !mod.sheet || !workTypeConfig(wt).sync?.enabled || !columns.length) return;
  const item = await tx.workItem.findUniqueOrThrow({
    where: { id: itemId },
    include: { assignee: { select: { name: true } }, owner: { select: { name: true } } },
  });
  const values = itemSheetValues(mod, {
    title: item.title,
    status: item.status,
    groupKey: item.groupKey,
    dueAt: item.dueAt,
    data: (item.data ?? {}) as Record<string, unknown>,
    assigneeName: item.assignee?.name ?? null,
    ownerName: item.owner?.name ?? null,
  });
  for (const column of columns) {
    const value = values[column];
    if (value === null || value === undefined) continue;
    await tx.syncOutbox.deleteMany({ where: { itemId, column, status: 'PENDING' } });
    await tx.syncOutbox.create({ data: { itemId, column, value } });
  }
}

const columnFor = (mod: WorkTypeDefinition, kind: string, field?: string) =>
  mod.sheet?.columns.find(c => c.kind === kind && (field === undefined || (c.kind === 'data' && c.field === field)))?.column;

// ─── Status ─────────────────────────────────────────────────────

async function changeStatusTx(tx: Tx, item: ItemWithType, actor: ChangeActor, to: string, now: Date, cal: WorkCalendar, note?: string, expectedVersion?: number) {
  const mod = requireModule(item.workType.key);
  if (item.status === to) return;
  if (actor.ctx && !canTransition(mod, item.status, to, actor.ctx)) {
    throw new ForbiddenError(`You can't move this ${mod.itemNoun} from ${statusDef(mod, item.status).label} to ${statusDef(mod, to).label}.`);
  }
  const patch = stagePatch(mod, item, to, now);
  await saveItem(tx, item, patch, expectedVersion);
  await tx.workItemEvent.create({
    data: { itemId: item.id, actorId: actor.userId, type: 'STATUS_CHANGED', field: 'status', fromValue: item.status, toValue: to, source: actor.source, note, at: now },
  });
  await rollInterval(tx, item.id, to, item.assigneeId, now, cal);
  const col = columnFor(mod, 'status');
  if (col) await enqueue(tx, item.id, item.workType, mod, actor, [col]);
}

export async function changeStatus(actor: ChangeActor, itemId: string, to: string, opts: { note?: string; expectedVersion?: number; at?: Date } = {}) {
  const cal = await workCalendar();
  return db.$transaction(async tx => {
    const item = await loadItem(tx, itemId);
    guardActive(item, actor);
    await changeStatusTx(tx, item, actor, to, opts.at ?? new Date(), cal, opts.note, opts.expectedVersion);
  });
}

// ─── Assignment ─────────────────────────────────────────────────

async function assignTx(tx: Tx, item: ItemWithType, actor: ChangeActor, assigneeId: string | null, now: Date, cal: WorkCalendar) {
  const mod = requireModule(item.workType.key);
  if (actor.ctx && !hasCap(actor.ctx, 'assign')) throw new ForbiddenError('You don’t have permission to assign work here.');
  if (item.assigneeId === assigneeId) return item;
  const [from, to] = await Promise.all([
    item.assigneeId ? tx.user.findUnique({ where: { id: item.assigneeId }, select: { name: true } }) : null,
    assigneeId ? tx.user.findUnique({ where: { id: assigneeId }, select: { name: true } }) : null,
  ]);
  await saveItem(tx, item, { assigneeId, assignedAt: assigneeId ? item.assignedAt ?? now : item.assignedAt });
  await tx.workItemEvent.create({
    data: {
      itemId: item.id,
      actorId: actor.userId,
      type: assigneeId ? 'ASSIGNED' : 'UNASSIGNED',
      field: 'assignee',
      fromValue: from?.name ?? null,
      toValue: to?.name ?? null,
      source: actor.source,
      at: now,
    },
  });
  const col = columnFor(mod, 'assignee');
  if (col) await enqueue(tx, item.id, item.workType, mod, actor, [col]);

  const fresh = await loadItem(tx, item.id);
  // First assignment moves a queued item to the module's "assigned" status.
  if (assigneeId && fresh.status === mod.initialStatus && mod.assignedStatus !== mod.initialStatus) {
    await changeStatusTx(tx, fresh, { ...actor, ctx: null }, mod.assignedStatus, now, cal);
  } else {
    // Same stage, new owner: split the interval so workload is attributed correctly.
    await rollInterval(tx, item.id, fresh.status, assigneeId, now, cal, true);
  }
  return fresh;
}

export async function assign(actor: ChangeActor, itemId: string, assigneeId: string | null) {
  const cal = await workCalendar();
  return db.$transaction(async tx => {
    const item = await loadItem(tx, itemId);
    guardActive(item, actor);
    await assignTx(tx, item, actor, assigneeId, new Date(), cal);
  });
}

// ─── Fields ─────────────────────────────────────────────────────

export type FieldValue = string | number | null;

function coerce(field: FieldDef, value: FieldValue): string | number | null {
  if (value === null || value === '') return null;
  if (field.type === 'number') {
    const n = Number(value);
    if (!Number.isFinite(n)) throw new Error(`${field.label} must be a number`);
    return n;
  }
  if (field.type === 'date') {
    const d = normalizeDate(value);
    if (!d) throw new Error(`${field.label} must be a date`);
    return d;
  }
  if (field.type === 'url') {
    const s = String(value).trim();
    if (!/^https?:\/\//i.test(s)) throw new Error(`${field.label} must start with http:// or https://`);
    return s;
  }
  return String(value).trim();
}

async function updateFieldsTx(tx: Tx, item: ItemWithType, actor: ChangeActor, patch: Record<string, FieldValue>, now: Date) {
  const mod = requireModule(item.workType.key);
  const data = { ...((item.data ?? {}) as Record<string, unknown>) };
  const update: Prisma.WorkItemUncheckedUpdateInput = {};
  const events: Prisma.WorkItemEventCreateManyInput[] = [];
  const columns: string[] = [];

  for (const [key, raw] of Object.entries(patch)) {
    const field = mod.fields.find(f => f.key === key);
    if (!field) throw new Error(`Unknown field: ${key}`);
    if (actor.ctx && !canEditField(field, actor.ctx)) throw new ForbiddenError(`You can't edit ${field.label}.`);
    const value = coerce(field, raw);
    let before: string | null;
    if (field.source === 'core' && key === 'dueAt') {
      before = item.dueAt ? normalizeDate(item.dueAt) : null;
      update.dueAt = value ? dueDateToInstant(String(value)) : null;
    } else {
      before = data[key] == null ? null : String(data[key]);
      if (value === null) delete data[key];
      else data[key] = value;
    }
    const after = value === null ? null : String(value);
    if (before === after) continue;
    events.push({ itemId: item.id, actorId: actor.userId, type: 'FIELD_CHANGED', field: key, fromValue: before, toValue: after, source: actor.source, at: now });
    const col = key === 'dueAt' ? columnFor(mod, 'dueAt') : columnFor(mod, 'data', key);
    if (col) columns.push(col);
  }
  if (!events.length) return;
  mod.dataSchema.parse(data);
  await saveItem(tx, item, { ...update, data: data as Prisma.InputJsonValue });
  await tx.workItemEvent.createMany({ data: events });
  await enqueue(tx, item.id, item.workType, mod, actor, columns);
}

export async function updateFields(actor: ChangeActor, itemId: string, patch: Record<string, FieldValue>) {
  return db.$transaction(async tx => {
    const item = await loadItem(tx, itemId);
    guardActive(item, actor);
    await updateFieldsTx(tx, item, actor, patch, new Date());
  });
}

// ─── Feedback & comments ────────────────────────────────────────

export async function addFeedback(
  actor: ChangeActor,
  itemId: string,
  input: { body: string; category?: string; severity?: string; requestCorrections?: boolean },
) {
  const body = input.body.trim();
  if (!body) throw new Error('Feedback cannot be empty');
  const cal = await workCalendar();
  return db.$transaction(async tx => {
    const item = await loadItem(tx, itemId);
    guardActive(item, actor);
    if (actor.ctx && !hasCap(actor.ctx, 'review')) throw new ForbiddenError('Only reviewers can give feedback. Use a comment instead.');
    const mod = requireModule(item.workType.key);
    const now = new Date();
    const round = Math.max(1, item.reviewRounds);
    await tx.feedback.create({ data: { itemId, round, authorId: actor.userId, body, category: input.category || null, severity: input.severity || null, createdAt: now } });
    await saveItem(tx, item, { feedbackCount: { increment: 1 }, lastFeedbackAt: now });
    await tx.workItemEvent.create({ data: { itemId, actorId: actor.userId, type: 'FEEDBACK', note: body, source: actor.source, meta: { round, category: input.category, severity: input.severity }, at: now } });
    if (input.requestCorrections) {
      const target = mod.statuses.find(s => s.category === 'feedback');
      const fresh = await loadItem(tx, itemId);
      if (target && fresh.status !== target.key) await changeStatusTx(tx, fresh, actor, target.key, now, cal);
    }
  });
}

export async function resolveFeedback(actor: ChangeActor, feedbackId: string) {
  const fb = await db.feedback.findUniqueOrThrow({ where: { id: feedbackId }, include: { item: true } });
  if (actor.ctx && !(actor.ctx.isAssignee && hasCap(actor.ctx, 'work')) && !hasCap(actor.ctx, 'review')) throw new ForbiddenError();
  await db.feedback.update({ where: { id: feedbackId }, data: { resolvedAt: fb.resolvedAt ? null : new Date() } });
}

export async function addComment(actor: ChangeActor, itemId: string, body: string) {
  const text = body.trim();
  if (!text) throw new Error('Comment cannot be empty');
  if (actor.ctx && !actor.ctx.isAdmin && !actor.ctx.canEdit) throw new ForbiddenError('You have view-only access here.');
  await db.workItemEvent.create({ data: { itemId, actorId: actor.userId, type: 'COMMENTED', note: text, source: actor.source } });
}

// ─── Creation ───────────────────────────────────────────────────

export type NewItem = {
  externalKey: string;
  title: string;
  status?: string;
  assigneeId?: string | null;
  ownerId?: string | null;
  chapterId?: string | null;
  groupKey?: string | null;
  sortOrder?: number;
  dueAt?: Date | null;
  completedAt?: Date | null;
  data?: Record<string, unknown>;
  sheetSnapshot?: Record<string, string> | null;
};

/** Create an item with its first event and stage interval. Used by the admin UI, importer and sheet sync. */
export async function createItemTx(tx: Tx, workType: WorkType, actor: ChangeActor, input: NewItem, now = new Date()) {
  const mod = requireModule(workType.key);
  const status = input.status ?? (input.assigneeId ? mod.assignedStatus : mod.initialStatus);
  const def = statusDef(mod, status);
  const marks = new Set(def.marks ?? []);
  const data = mod.dataSchema.parse(input.data ?? {}) as Prisma.InputJsonValue;
  const reached = (m: Parameters<typeof marks.has>[0]) => marks.has(m);
  const pastQueue = def.category !== 'queue';
  const at = actor.source === 'IMPORT' ? null : now;
  const item = await tx.workItem.create({
    data: {
      workTypeId: workType.id,
      externalKey: input.externalKey,
      title: input.title,
      status,
      assigneeId: input.assigneeId ?? null,
      ownerId: input.ownerId ?? null,
      createdById: actor.source === 'APP' ? actor.userId : null,
      chapterId: input.chapterId ?? null,
      groupKey: input.groupKey ?? null,
      sortOrder: input.sortOrder ?? 0,
      dueAt: input.dueAt ?? null,
      receivedAt: now,
      // Items that arrive mid-flow get the stages they have evidently passed stamped at arrival time.
      // Imported history is unknown, so those stamps stay empty rather than faking durations.
      assignedAt: input.assigneeId ? at : null,
      firstStartedAt: pastQueue && def.category !== 'hold' ? at : null,
      lastSubmittedAt: ['review', 'feedback', 'approved', 'done'].includes(def.category) ? at : null,
      reviewRounds: ['review', 'feedback', 'approved', 'done'].includes(def.category) ? 1 : 0,
      firstReviewAt: reached('review') || ['approved', 'done'].includes(def.category) ? at : null,
      lastFeedbackAt: reached('feedback') ? at : null,
      approvedAt: ['approved', 'done'].includes(def.category) ? at : null,
      completedAt: def.category === 'done' ? input.completedAt ?? at : null,
      data,
      sheetSnapshot: (input.sheetSnapshot ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
  await tx.workItemEvent.create({
    data: {
      itemId: item.id,
      actorId: actor.userId,
      type: actor.source === 'IMPORT' ? 'IMPORTED' : 'CREATED',
      field: 'status',
      toValue: status,
      source: actor.source,
      at: now,
    },
  });
  await tx.workItemStageInterval.create({ data: { itemId: item.id, status, assigneeId: item.assigneeId, enteredAt: now, round: 1 } });
  return item;
}

export async function createItem(actor: ChangeActor, workTypeId: string, input: NewItem) {
  if (actor.ctx && !hasCap(actor.ctx, 'create')) throw new ForbiddenError('You don’t have permission to add items here.');
  if (actor.ctx && input.assigneeId && !hasCap(actor.ctx, 'assign')) throw new ForbiddenError('You don’t have permission to assign work here.');
  return db.$transaction(async tx => {
    const wt = await tx.workType.findUniqueOrThrow({ where: { id: workTypeId } });
    if (actor.source === 'APP' && wt.state !== 'ACTIVE') throw new PausedError(wt.name);
    const exists = await tx.workItem.findUnique({ where: { workTypeId_externalKey: { workTypeId, externalKey: input.externalKey } } });
    if (exists) throw new Error(`${input.externalKey} already exists`);
    const item = await createItemTx(tx, wt, actor, input);
    const mod = requireModule(wt.key);
    await enqueue(tx, item.id, wt, mod, actor, (mod.sheet?.columns ?? []).filter(c => c.kind !== 'key').map(c => c.column));
    return item;
  });
}

// Internal building blocks for the sync engine (same rules, inside its own transaction).
export const internals = { loadItem, changeStatusTx, assignTx, updateFieldsTx, saveItem };
