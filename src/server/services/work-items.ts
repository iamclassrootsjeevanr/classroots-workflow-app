import { Prisma, type EventSource, type WorkItem, type WorkType } from '@prisma/client';
import { requireModule, statusDef } from '@/modules/registry';
import type { FieldDef, WorkTypeDefinition } from '@/modules/types';
import { itemSheetValues } from '@/lib/sheet-core';
import { businessMinutesBetween, dayKey, DEFAULT_CALENDAR, dueDateToInstant, halfOfDay, minutesBetween, normalizeDate, withWorkDays, type WorkCalendar } from '@/lib/time';
import { landingStage, nextActiveAfter } from '@/lib/stages';
import { lowerLabel, matchOption } from '@/lib/text';
import { allowedTransitions, canDeleteItem, canGiveFeedback, canUndoDelete, UNDO_DELETE_MINUTES, canEditField, canTransition, hasCap, stagePatch, transitionFor, type ActorContext } from '@/lib/workflow';
import { db } from '../db';
import { ConflictError, ForbiddenError, PausedError } from '../errors';
import { workCalendar } from '../settings';
import { currentApkFields, prepareApkCreate, writeApkFields } from '../apk/store';
import { notify, stewardIds } from './notifications';
import { shortKey, undoDeadline } from '@/lib/notifications-core';
import { nextDefault, reviewDefaults, teamPeople, type TeamLite } from '@/lib/teams';
import { loadTeams } from '../teams';
import { versionCloseBlocker, versionStatus } from '@/lib/apk-rollup';

type Tx = Prisma.TransactionClient;

/** Who is making a change. ctx = null means a trusted system/sheet change (no permission checks). */
export type ChangeActor = { userId: string | null; ctx: ActorContext | null; source: EventSource };

type ItemWithType = WorkItem & { workType: WorkType };

/** `app-to-sheet` (default): the sheet mirrors the app and sheet edits are overwritten. `two-way`: sheet edits are pulled in. */
export type SyncDirection = 'app-to-sheet' | 'two-way';
export type WorkTypeConfig = { sync?: { enabled?: boolean; tab?: string; spreadsheetId?: string; direction?: SyncDirection } };
export const workTypeConfig = (wt: WorkType) => (wt.config ?? {}) as WorkTypeConfig;
export const syncDirection = (wt: WorkType): SyncDirection => workTypeConfig(wt).sync?.direction ?? 'app-to-sheet';

async function loadItem(tx: Tx, itemId: string): Promise<ItemWithType> {
  return tx.workItem.findUniqueOrThrow({ where: { id: itemId }, include: { workType: true } });
}

function guardActive(item: ItemWithType, actor: ChangeActor) {
  if ((actor.source === 'APP' || actor.source === 'RELAY') && item.workType.state !== 'ACTIVE') throw new PausedError(item.workType.name);
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

/** True for an APK Testing version item (the work); its test results are its children. */
const isApkVersion = (item: { parentId: string | null; workType: { key: string } }) => item.workType.key === 'apk-testing' && !item.parentId;

/**
 * APK Testing: bring a version's status in line with its test results. The version is never moved by hand: this writes the stage,
 * its timestamps, the event and the stage interval directly, so version analytics (cycle time, stuck, done) follow the testing.
 */
async function rollupVersionTx(tx: Tx, parentId: string, actor: ChangeActor, now: Date, calendar: WorkCalendar) {
  const parent = await loadItem(tx, parentId);
  // A closed version stays closed until a person reopens it.
  if (parent.archivedAt || parent.status === 'closed') return;
  const mod = requireModule(parent.workType.key);
  const results = await tx.workItem.findMany({ where: { parentId, archivedAt: null }, select: { status: true } });
  const to = versionStatus(results.map(r => r.status));
  if (to === parent.status) return;
  await saveItem(tx, parent, stagePatch(mod, parent, to, now));
  await tx.workItemEvent.create({
    data: { itemId: parent.id, actorId: actor.userId, type: 'STATUS_CHANGED', field: 'status', fromValue: parent.status, toValue: to, source: actor.source, note: 'Follows its test results', at: now },
  });
  await rollInterval(tx, parent.id, to, parent.assigneeId, now, withWorkDays(calendar, mod.workDays));
}

/**
 * APK Testing: a person closes a version (finished, not tested, or replaced by a newer build), or reopens it.
 * Reopening puts it back to the status its results give.
 */
export async function setVersionClosedTx(tx: Tx, itemId: string, actor: ChangeActor, closed: boolean, now: Date, calendar: WorkCalendar) {
  const item = await loadItem(tx, itemId);
  if (!isApkVersion(item)) throw new Error('Only an APK version can be closed.');
  if (actor.ctx && !(actor.ctx.isAdmin || hasCap(actor.ctx, 'work') || hasCap(actor.ctx, 'assign') || hasCap(actor.ctx, 'manageFields'))) throw new ForbiddenError('You can’t close or reopen APK versions.');
  const mod = requireModule(item.workType.key);
  const results = (await tx.workItem.findMany({ where: { parentId: itemId, archivedAt: null }, select: { status: true } })).map(r => r.status);
  let to: string;
  if (closed) {
    if (item.status === 'closed') return;
    // Closing never waits for the tests: an APK that was not tested, or a build a newer one replaced, can be closed as it is.
    to = 'closed';
  } else {
    if (item.status !== 'closed') return;
    to = versionStatus(results);
  }
  await saveItem(tx, item, stagePatch(mod, item, to, now));
  await tx.workItemEvent.create({
    data: { itemId, actorId: actor.userId, type: 'STATUS_CHANGED', field: 'status', fromValue: item.status, toValue: to, source: actor.source, note: closed ? 'Closed' : 'Reopened', at: now },
  });
  await rollInterval(tx, itemId, to, item.assigneeId, now, withWorkDays(calendar, mod.workDays));
}

export async function setVersionClosed(actor: ChangeActor, itemId: string, closed: boolean) {
  const cal = await workCalendar();
  return db.$transaction(async tx => {
    guardActive(await loadItem(tx, itemId), actor);
    await setVersionClosedTx(tx, itemId, actor, closed, new Date(), cal);
  });
}

/** Queue sheet writes for changed columns (latest value wins). Skipped for changes that came from the sheet. */
async function enqueue(tx: Tx, itemId: string, wt: WorkType, mod: WorkTypeDefinition, actor: ChangeActor, columns: string[]) {
  if (actor.source === 'SHEET' || !mod.sheet || !workTypeConfig(wt).sync?.enabled || !columns.length) return;
  const item = await tx.workItem.findUniqueOrThrow({
    where: { id: itemId },
    include: { assignee: { select: { name: true } }, owner: { select: { name: true } } },
  });
  // APK Testing: the sheet lists test results; the version item (the work) is app-only.
  if (mod.storage === 'apk' && !item.parentId) return;
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

/** The module's calculated fields (e.g. Days taken) and due date for this data. dueAt undefined = the module doesn't set it. */
function computed(mod: WorkTypeDefinition, externalKey: string, data: Record<string, unknown>, cal: WorkCalendar): { data: Record<string, unknown>; dueAt?: Date | null } {
  if (!mod.compute) return { data };
  const r = mod.compute({ externalKey, data }, withWorkDays(cal, mod.workDays));
  return { data: r.data, dueAt: r.dueAt === undefined ? undefined : r.dueAt ? dueDateToInstant(r.dueAt, cal.tz) : null };
}

// ─── Status ─────────────────────────────────────────────────────

type StatusOpts = { note?: string; expectedVersion?: number; /** Feedback is being given with this move (the Feedback card). */ withFeedback?: boolean };

async function changeStatusTx(tx: Tx, item: ItemWithType, actor: ChangeActor, to: string, now: Date, calendar: WorkCalendar, opts: StatusOpts = {}) {
  const mod = requireModule(item.workType.key);
  const cal = withWorkDays(calendar, mod.workDays);
  if (item.status === to) return;
  if (actor.ctx && isApkVersion(item)) throw new ForbiddenError('An APK version follows its test results. Change the status of a test instead.');
  if (actor.ctx && !canTransition(mod, item.status, to, actor.ctx)) {
    throw new ForbiddenError(`You can't move this ${mod.itemNoun} from ${statusDef(mod, item.status).label} to ${statusDef(mod, to).label}.`);
  }
  const move = actor.ctx ? transitionFor(mod, item.status, to, actor.ctx) : mod.transitions.find(t => t.from === item.status && t.to === to);
  if (actor.ctx && move?.requires === 'feedback' && !opts.withFeedback) {
    throw new Error(`Write the feedback first: “${move.label ?? statusDef(mod, to).label}” is in the Feedback card.`);
  }
  const data = { ...((item.data ?? {}) as Record<string, unknown>) };
  const today = dayKey(now, cal.tz);
  for (const f of move?.stamp ?? []) {
    if (data[f]) continue;
    data[f] = today;
    for (const half of mod.fields.filter(x => x.halfOf === f)) if (!data[half.key]) data[half.key] = halfOfDay(now, cal);
  }
  for (const [f, v] of Object.entries(move?.set ?? {})) if (!data[f]) data[f] = v;
  const landing = landingStage(mod.statuses, to, data);
  const note = landing === to ? opts.note : [opts.note, `${statusDef(mod, to).label} not needed`].filter(Boolean).join(' · ');
  const update: Prisma.WorkItemUncheckedUpdateInput = { ...stagePatch(mod, item, landing, now) };
  if (move?.stamp?.length || move?.set || mod.compute) {
    const c = computed(mod, item.externalKey, data, cal);
    update.data = mod.dataSchema.parse(c.data) as Prisma.InputJsonValue;
    if (c.dueAt !== undefined) update.dueAt = c.dueAt;
  }
  await saveItem(tx, item, update, opts.expectedVersion);
  await tx.workItemEvent.create({
    data: { itemId: item.id, actorId: actor.userId, type: 'STATUS_CHANGED', field: 'status', fromValue: item.status, toValue: landing, source: actor.source, note, at: now },
  });
  await rollInterval(tx, item.id, landing, item.assigneeId, now, cal);
  const col = columnFor(mod, 'status');
  if (col) await enqueue(tx, item.id, item.workType, mod, actor, [col]);
  await notifyStage(tx, item, mod, actor, landing);
  if (item.parentId) await rollupVersionTx(tx, item.parentId, actor, now, cal);
}

/**
 * Inbox messages a work type asks for: submitted → the owner (reviewer), or the group's coordinators when nobody owns it yet
 * (they pick the reviewer); approved → the assignee.
 */
async function notifyStage(tx: Tx, item: ItemWithType, mod: WorkTypeDefinition, actor: ChangeActor, to: string) {
  if (actor.source !== 'APP' || !mod.notifyOn) return;
  const marks = statusDef(mod, to).marks ?? [];
  const href = `/w/${item.workType.key}/${item.id}`;
  const label = statusDef(mod, to).label;
  if (mod.notifyOn.submitted && marks.includes('submitted') && item.ownerId && item.ownerId !== actor.userId) {
    await notify(tx, item.ownerId, { kind: 'item.submitted', title: `${label}: ${shortKey(item.externalKey)}`, body: item.title, href });
  }
  if (mod.notifyOn.submitted && marks.includes('submitted') && !item.ownerId) {
    const ownerLabel = lowerLabel(mod.labels?.owner ?? 'reviewer');
    for (const userId of await stewardIds(tx, item.workTypeId, item.groupKey)) {
      if (userId === actor.userId) continue;
      await notify(tx, userId, { kind: 'item.needs-owner', title: `${label}, no ${ownerLabel}: ${shortKey(item.externalKey)}`, body: `${item.title} · pick the ${ownerLabel}`, href });
    }
  }
  if (mod.notifyOn.approved && marks.includes('approved') && item.assigneeId && item.assigneeId !== actor.userId) {
    await notify(tx, item.assigneeId, { kind: 'item.approved', title: `${label}: ${shortKey(item.externalKey)}`, body: item.title, href });
  }
}

export async function changeStatus(actor: ChangeActor, itemId: string, to: string, opts: { note?: string; expectedVersion?: number; at?: Date } = {}) {
  const cal = await workCalendar();
  return db.$transaction(async tx => {
    const item = await loadItem(tx, itemId);
    guardActive(item, actor);
    await changeStatusTx(tx, item, actor, to, opts.at ?? new Date(), cal, { note: opts.note, expectedVersion: opts.expectedVersion });
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
  if (assigneeId && assigneeId !== actor.userId && actor.source === 'APP' && !item.parentId) {
    await notify(tx, assigneeId, { kind: 'item.assigned', title: `Assigned to you: ${shortKey(item.externalKey)}`, body: item.title, href: `/w/${item.workType.key}/${item.id}` });
  }

  let fresh = await loadItem(tx, item.id);
  // Teams: the new creator's coordinator reviews it by default and their buddy peer-reviews it.
  if (mod.teams && assigneeId) {
    const teams = await loadTeams(tx, [item.workTypeId]);
    if (await applyReviewDefaultsTx(tx, fresh, actor, teams, reviewDefaults(teams, item.assigneeId), now)) fresh = await loadItem(tx, item.id);
  }
  // First assignment moves a queued item to the module's "assigned" status.
  if (assigneeId && fresh.status === mod.initialStatus && mod.assignedStatus !== mod.initialStatus) {
    await changeStatusTx(tx, fresh, { ...actor, ctx: null }, mod.assignedStatus, now, cal);
  } else {
    // Same stage, new owner: split the interval so workload is attributed correctly.
    await rollInterval(tx, item.id, fresh.status, assigneeId, now, withWorkDays(cal, mod.workDays), true);
  }
  // APK Testing: the tester of a version also tests its results, except those somebody else already took.
  if (isApkVersion(item)) {
    const runs = await tx.workItem.findMany({ where: { parentId: item.id, archivedAt: null, OR: [{ assigneeId: null }, { assigneeId: item.assigneeId }] }, select: { id: true } });
    for (const r of runs) await assignTx(tx, await loadItem(tx, r.id), { ...actor, ctx: null }, assigneeId, now, cal);
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

type PersonSlot = 'owner' | 'peer';

const slotLabel = (mod: WorkTypeDefinition, slot: PersonSlot) => (slot === 'owner' ? (mod.labels?.owner ?? 'Owner') : (mod.labels?.peer ?? 'Peer reviewer'));

/** Put a person in the item's owner (Journey: SME reviewer) or peer reviewer slot. `quiet` = no inbox message (bulk changes send one). */
async function setPersonTx(tx: Tx, item: ItemWithType, actor: ChangeActor, slot: PersonSlot, userId: string | null, now: Date, quiet = false) {
  const mod = requireModule(item.workType.key);
  if (actor.ctx && !hasCap(actor.ctx, 'assign')) throw new ForbiddenError('You don’t have permission to assign work here.');
  const current = slot === 'owner' ? item.ownerId : item.peerReviewerId;
  if (current === userId) return false;
  const [from, to] = await Promise.all([
    current ? tx.user.findUnique({ where: { id: current }, select: { name: true } }) : null,
    userId ? tx.user.findUnique({ where: { id: userId }, select: { name: true } }) : null,
  ]);
  await saveItem(tx, item, slot === 'owner' ? { ownerId: userId } : { peerReviewerId: userId });
  const label = slotLabel(mod, slot);
  await tx.workItemEvent.create({
    data: { itemId: item.id, actorId: actor.userId, type: 'FIELD_CHANGED', field: label, fromValue: from?.name ?? null, toValue: to?.name ?? null, source: actor.source, at: now },
  });
  if (slot === 'owner') {
    const col = columnFor(mod, 'owner');
    if (col) await enqueue(tx, item.id, item.workType, mod, actor, [col]);
  }
  if (!quiet && userId && userId !== actor.userId && actor.source === 'APP') {
    await notify(tx, userId, { kind: 'item.owner', title: `${label} of ${shortKey(item.externalKey)}: you`, body: item.title, href: `/w/${item.workType.key}/${item.id}` });
  }
  return true;
}

/** Set the item's owner (Journey: its SME reviewer). Same permission as assigning. */
export async function setOwner(actor: ChangeActor, itemId: string, ownerId: string | null) {
  return db.$transaction(async tx => {
    const item = await loadItem(tx, itemId);
    guardActive(item, actor);
    await setPersonTx(tx, item, actor, 'owner', ownerId, new Date());
  });
}

/** Set the item's peer reviewer (Journey: the creator's buddy by default). Same permission as assigning. */
export async function setPeerReviewer(actor: ChangeActor, itemId: string, userId: string | null) {
  return db.$transaction(async tx => {
    const item = await loadItem(tx, itemId);
    guardActive(item, actor);
    if (userId && userId === item.assigneeId) throw new Error('The peer reviewer is someone other than the creator.');
    await setPersonTx(tx, item, actor, 'peer', userId, new Date());
  });
}

/**
 * Give an item its creator's team defaults: the SME reviewer and the peer reviewer, where the slot is empty or still holds
 * the default it had before (`was`). A reviewer picked by hand stays. Returns true when something changed.
 */
async function applyReviewDefaultsTx(tx: Tx, item: ItemWithType, actor: ChangeActor, teams: TeamLite[], was: { reviewerId: string | null; peerReviewerId: string | null }, now: Date, quiet = false) {
  const next = reviewDefaults(teams, item.assigneeId);
  const system = { ...actor, ctx: null };
  let changed = false;
  const owner = nextDefault(item.ownerId, was.reviewerId, next.reviewerId);
  if (owner !== undefined && (await setPersonTx(tx, item, system, 'owner', owner, now, quiet))) changed = true;
  const fresh = changed ? await loadItem(tx, item.id) : item;
  const peer = nextDefault(fresh.peerReviewerId, was.peerReviewerId, next.peerReviewerId);
  if (peer !== undefined && (await setPersonTx(tx, fresh, system, 'peer', peer, now, quiet))) changed = true;
  return changed;
}

/**
 * A team setting changed (or "fill missing" was pressed): bring the team's journeys whose review is still open in line.
 * `was` = each creator's defaults before the change; omit to fill only the empty slots. Each newly named reviewer gets one
 * inbox message for all of them. Returns how many items changed.
 */
export async function refillReviewDefaults(actor: ChangeActor, workTypeId: string, opts: { creatorIds?: string[]; was?: Map<string, { reviewerId: string | null; peerReviewerId: string | null }> } = {}) {
  return db.$transaction(
    async tx => {
      const wt = await tx.workType.findUniqueOrThrow({ where: { id: workTypeId } });
      const mod = requireModule(wt.key);
      if (!mod.teams) return 0;
      const teams = await loadTeams(tx, [workTypeId]);
      const creators = opts.creatorIds ?? [...new Set(teams.flatMap(teamPeople))];
      const doneKeys = mod.statuses.filter(s => s.category === 'done').map(s => s.key);
      const items = await tx.workItem.findMany({
        where: { workTypeId, archivedAt: null, approvedAt: null, assigneeId: { in: creators }, status: { notIn: doneKeys } },
        include: { workType: true },
      });
      const now = new Date();
      const gained = new Map<string, number>();
      let count = 0;
      for (const item of items) {
        const was = opts.was?.get(item.assigneeId!) ?? { reviewerId: null, peerReviewerId: null };
        if (!(await applyReviewDefaultsTx(tx, item, actor, teams, was, now, true))) continue;
        count++;
        const after = await loadItem(tx, item.id);
        for (const id of new Set([after.ownerId !== item.ownerId ? after.ownerId : null, after.peerReviewerId !== item.peerReviewerId ? after.peerReviewerId : null])) {
          if (id && id !== actor.userId) gained.set(id, (gained.get(id) ?? 0) + 1);
        }
      }
      for (const [userId, n] of gained) {
        await notify(tx, userId, { kind: 'item.owner', title: `You now review ${n} more ${mod.itemNoun}${n === 1 ? '' : 's'}`, body: 'Team review defaults changed.', href: `/w/${wt.key}/items?scope=mine` });
      }
      return count;
    },
    { timeout: 30_000 },
  );
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
  if (field.type === 'select') {
    const option = matchOption(field.options ?? [], String(value));
    if (!option) throw new Error(`${field.label} must be one of: ${(field.options ?? []).join(', ')}`);
    return option;
  }
  return String(value).trim();
}

async function updateFieldsTx(tx: Tx, item: ItemWithType, actor: ChangeActor, patch: Record<string, FieldValue>, now: Date, cal: WorkCalendar) {
  const mod = requireModule(item.workType.key);
  const data = { ...((item.data ?? {}) as Record<string, unknown>) };
  const update: Prisma.WorkItemUncheckedUpdateInput = {};
  const events: Prisma.WorkItemEventCreateManyInput[] = [];
  const columns: string[] = [];
  // Fields stored in the shared version / test case tables (APK Testing) are written there, not into this run's data.
  const shared: Record<string, string | null> = {};
  let sharedBefore: Record<string, string> | null = null;

  for (const [key, raw] of Object.entries(patch)) {
    const field = mod.fields.find(f => f.key === key);
    if (!field) throw new Error(`Unknown field: ${key}`);
    if (field.computed && actor.source === 'APP') throw new Error(`${field.label} is calculated; change the dates it comes from.`);
    if (actor.ctx && !canEditField(field, actor.ctx)) throw new ForbiddenError(`You can't edit ${field.label}.`);
    const value = coerce(field, raw);
    let before: string | null;
    if (field.source === 'version' || field.source === 'case') {
      sharedBefore ??= await currentApkFields(tx, item.id);
      before = sharedBefore[key] ? sharedBefore[key] : null;
      shared[key] = value === null ? null : String(value);
    } else if (field.source === 'core' && key === 'dueAt') {
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
  if (Object.keys(shared).length) await writeApkFields(tx, item.id, shared);
  const calc = computed(mod, item.externalKey, data, cal);
  if (calc.dueAt !== undefined) update.dueAt = calc.dueAt;
  mod.dataSchema.parse(calc.data);
  await saveItem(tx, item, { ...update, data: calc.data as Prisma.InputJsonValue });
  await tx.workItemEvent.createMany({ data: events });
  await enqueue(tx, item.id, item.workType, mod, actor, columns);

  for (const m of mod.fieldMoves ?? []) {
    if (item.status !== m.from || patch[m.field] == null || patch[m.field] === '') continue;
    const to = mod.statuses.find(s => s.key === m.to)?.state === 'skipped' ? nextActiveAfter(mod.statuses, m.to) : m.to;
    if (to) await changeStatusTx(tx, await loadItem(tx, item.id), { ...actor, ctx: null }, to, now, cal);
    break;
  }
}

export async function updateFields(actor: ChangeActor, itemId: string, patch: Record<string, FieldValue>, opts: { at?: Date } = {}) {
  const cal = await workCalendar();
  return db.$transaction(async tx => {
    const item = await loadItem(tx, itemId);
    guardActive(item, actor);
    await updateFieldsTx(tx, item, actor, patch, opts.at ?? new Date(), cal);
  });
}

/**
 * Delete a row. The item is archived, not erased: it disappears from every list, report and dashboard, its history
 * stays in the database, and the Google Sheet row (if any) is left alone and will not bring it back.
 */
export async function deleteItem(actor: ChangeActor, itemId: string) {
  return db.$transaction(async tx => {
    const item = await loadItem(tx, itemId);
    guardActive(item, actor);
    if (!canDeleteItem(actor.ctx)) throw new ForbiddenError('You can’t delete items in this work type.');
    if (item.archivedAt) return;
    const now = new Date();
    await saveItem(tx, item, { archivedAt: now });
    await tx.syncOutbox.deleteMany({ where: { itemId, status: 'PENDING' } });
    await tx.workItemEvent.create({
      data: { itemId, actorId: actor.userId, type: 'FIELD_CHANGED', field: 'archivedAt', fromValue: null, toValue: now.toISOString(), source: actor.source, note: 'Deleted', at: now },
    });
    // APK Testing: deleting a version takes its test results with it (and brings them back on undo).
    if (isApkVersion(item)) {
      const runs = await tx.workItem.findMany({ where: { parentId: itemId, archivedAt: null }, select: { id: true } });
      const ids = runs.map(r => r.id);
      await tx.workItem.updateMany({ where: { id: { in: ids } }, data: { archivedAt: now, version: { increment: 1 } } });
      await tx.apkVersion.updateMany({ where: { workTypeId: item.workTypeId, key: item.externalKey }, data: { archivedAt: now } });
      await tx.syncOutbox.deleteMany({ where: { itemId: { in: ids }, status: 'PENDING' } });
      await tx.workItemEvent.createMany({
        data: ids.map(id => ({ itemId: id, actorId: actor.userId, type: 'FIELD_CHANGED' as const, field: 'archivedAt', fromValue: null, toValue: now.toISOString(), source: actor.source, note: `Deleted with APK version ${item.externalKey}`, at: now })),
      });
    }
    // The person who deleted it gets an inbox message with Undo for the next 30 minutes.
    if (actor.userId && actor.source === 'APP') {
      await notify(tx, actor.userId, {
        kind: 'item.deleted',
        title: `Deleted ${shortKey(item.externalKey)}`,
        body: item.title,
        href: `/w/${item.workType.key}/items`,
        data: { itemId, itemKey: item.externalKey, workTypeKey: item.workType.key, undoUntil: undoDeadline(now).toISOString() },
      });
    }
    if (item.parentId) await rollupVersionTx(tx, item.parentId, actor, now, await workCalendar());
  });
}

/** Bring back a deleted row, within the undo window (30 minutes). */
export async function restoreItem(actor: ChangeActor, itemId: string) {
  return db.$transaction(async tx => {
    const item = await loadItem(tx, itemId);
    guardActive(item, actor);
    if (!canDeleteItem(actor.ctx)) throw new ForbiddenError('You can’t restore items in this work type.');
    if (!item.archivedAt) return;
    if (!canUndoDelete(item.archivedAt)) throw new Error(`Undo is only possible for ${UNDO_DELETE_MINUTES} minutes after deleting.`);
    const now = new Date();
    await saveItem(tx, item, { archivedAt: null });
    await tx.workItemEvent.create({
      data: { itemId, actorId: actor.userId, type: 'FIELD_CHANGED', field: 'archivedAt', fromValue: item.archivedAt.toISOString(), toValue: null, source: actor.source, note: 'Restored', at: now },
    });
    if (isApkVersion(item)) {
      const runs = await tx.workItem.findMany({ where: { parentId: itemId, archivedAt: item.archivedAt }, select: { id: true } });
      const ids = runs.map(r => r.id);
      await tx.workItem.updateMany({ where: { id: { in: ids } }, data: { archivedAt: null, version: { increment: 1 } } });
      await tx.apkVersion.updateMany({ where: { workTypeId: item.workTypeId, key: item.externalKey }, data: { archivedAt: null } });
      await tx.workItemEvent.createMany({
        data: ids.map(id => ({ itemId: id, actorId: actor.userId, type: 'FIELD_CHANGED' as const, field: 'archivedAt', fromValue: item.archivedAt!.toISOString(), toValue: null, source: actor.source, note: `Restored with APK version ${item.externalKey}`, at: now })),
      });
    }
    // The delete notice becomes a "Restored" notice (no more Undo button).
    await tx.notification.updateMany({
      where: { kind: 'item.deleted', data: { path: ['itemId'], equals: itemId } },
      data: { kind: 'item.restored', title: `Restored ${shortKey(item.externalKey)}`, readAt: now },
    });
    if (item.parentId) await rollupVersionTx(tx, item.parentId, actor, now, await workCalendar());
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
    const mod = requireModule(item.workType.key);
    const sendsBack = input.requestCorrections && Boolean(correctionsMove(mod, item.status, actor.ctx));
    if (actor.ctx && !canGiveFeedback(mod, actor.ctx) && !sendsBack) throw new ForbiddenError(`Only the ${lowerLabel(mod.labels?.owner ?? 'reviewer')} of this ${mod.itemNoun} can give feedback. Use a comment instead.`);
    const now = new Date();
    const round = Math.max(1, item.reviewRounds);
    await tx.feedback.create({ data: { itemId, round, authorId: actor.userId, body, category: input.category || null, severity: input.severity || null, createdAt: now } });
    await saveItem(tx, item, { feedbackCount: { increment: 1 }, lastFeedbackAt: now });
    await tx.workItemEvent.create({ data: { itemId, actorId: actor.userId, type: 'FEEDBACK', note: body, source: actor.source, meta: { round, category: input.category, severity: input.severity }, at: now } });
    if (item.assigneeId && item.assigneeId !== actor.userId && actor.source === 'APP') {
      await notify(tx, item.assigneeId, { kind: 'item.feedback', title: `New feedback on ${shortKey(item.externalKey)}`, body, href: `/w/${item.workType.key}/${item.id}` });
    }
    if (input.requestCorrections) {
      const fresh = await loadItem(tx, itemId);
      const target = correctionsMove(mod, fresh.status, actor.ctx)?.to;
      if (!target) throw new ForbiddenError(`You can't send this ${mod.itemNoun} back from ${statusDef(mod, fresh.status).label}.`);
      await changeStatusTx(tx, fresh, actor, target, now, cal, { withFeedback: true });
    }
  });
}

/** The send-back move from this stage (to a "sent back" stage) this person may make, if any. */
export function correctionsMove(mod: WorkTypeDefinition, from: string, ctx: ActorContext | null) {
  const moves = ctx ? allowedTransitions(mod, from, ctx) : mod.transitions.filter(t => t.from === from);
  const move = moves.find(t => t.requires === 'feedback') ?? moves.find(t => statusDef(mod, t.to).category === 'feedback');
  // An admin's "Set <status>" shortcut reads as a send-back here.
  return move && !mod.transitions.includes(move) ? { ...move, label: `Send back (${statusDef(mod, move.to).label})` } : move;
}

export async function resolveFeedback(actor: ChangeActor, feedbackId: string) {
  const fb = await db.feedback.findUniqueOrThrow({ where: { id: feedbackId }, include: { item: { include: { workType: { select: { key: true } } } } } });
  const mod = requireModule(fb.item.workType.key);
  if (actor.ctx && !(actor.ctx.isAssignee && hasCap(actor.ctx, 'work')) && !canGiveFeedback(mod, actor.ctx)) throw new ForbiddenError();
  await db.feedback.update({ where: { id: feedbackId }, data: { resolvedAt: fb.resolvedAt ? null : new Date() } });
}

/** The creator's reply to one feedback point (empty clears it). Only the item's assignee (or an admin). */
export async function noteFeedback(actor: ChangeActor, feedbackId: string, note: string) {
  const fb = await db.feedback.findUniqueOrThrow({ where: { id: feedbackId } });
  if (actor.ctx && !actor.ctx.isAdmin && !(actor.ctx.isAssignee && hasCap(actor.ctx, 'work'))) throw new ForbiddenError('Only the person working on it can reply to feedback.');
  const text = note.trim();
  await db.feedback.update({ where: { id: feedbackId }, data: { note: text || null, noteById: text ? actor.userId : null, noteAt: text ? new Date() : null } });
  if (text) await db.workItemEvent.create({ data: { itemId: fb.itemId, actorId: actor.userId, type: 'COMMENTED', note: `Reply to feedback: ${text}`, source: actor.source } });
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
export async function createItemTx(tx: Tx, workType: WorkType, actor: ChangeActor, input: NewItem, now = new Date(), cal: WorkCalendar = DEFAULT_CALENDAR): Promise<WorkItem> {
  const mod = requireModule(workType.key);
  const status = input.status ?? (input.assigneeId ? mod.assignedStatus : mod.initialStatus);
  const def = statusDef(mod, status);
  const marks = new Set(def.marks ?? []);
  // APK Testing: version and test case facts go to their own tables; the run keeps only its own data.
  const apk = mod.storage === 'apk' ? await prepareApkCreate(tx, workType, input) : null;
  // ...and a test result belongs to its APK version item (created here when it is the first result of that version).
  const versionKey = (input.groupKey ?? '').trim();
  const parentId = apk && String(input.data?.testCaseId ?? '').trim() && versionKey ? await ensureVersionItemTx(tx, workType, actor, versionKey, now, cal) : null;
  const calc = computed(mod, input.externalKey, (apk?.data ?? input.data ?? {}) as Record<string, unknown>, cal);
  const data = mod.dataSchema.parse(calc.data) as Prisma.InputJsonValue;
  const dueAt = input.dueAt ?? calc.dueAt ?? null;
  const reached = (m: Parameters<typeof marks.has>[0]) => marks.has(m);
  const pastQueue = def.category !== 'queue';
  const at = actor.source === 'IMPORT' ? null : now;
  // Teams: a new item starts with its creator's default SME reviewer and peer reviewer unless one was picked.
  const defaults = mod.teams && input.assigneeId ? reviewDefaults(await loadTeams(tx, [workType.id]), input.assigneeId) : null;
  const item = await tx.workItem.create({
    data: {
      workTypeId: workType.id,
      externalKey: input.externalKey,
      title: input.title,
      status,
      assigneeId: input.assigneeId ?? null,
      ownerId: input.ownerId ?? defaults?.reviewerId ?? null,
      peerReviewerId: defaults?.peerReviewerId ?? null,
      parentId,
      createdById: actor.source === 'APP' ? actor.userId : null,
      chapterId: input.chapterId ?? null,
      groupKey: input.groupKey ?? null,
      sortOrder: input.sortOrder ?? 0,
      dueAt,
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
  await apk?.link(item.id);
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
  if (parentId) await rollupVersionTx(tx, parentId, actor, now, cal);
  return item;
}

/** The work item of an APK version (key = the version name). Created, or brought back, when its first result arrives. */
async function ensureVersionItemTx(tx: Tx, workType: WorkType, actor: ChangeActor, versionKey: string, now: Date, cal: WorkCalendar): Promise<string> {
  const found = await tx.workItem.findUnique({ where: { workTypeId_externalKey: { workTypeId: workType.id, externalKey: versionKey } } });
  if (found) {
    if (found.archivedAt) await tx.workItem.update({ where: { id: found.id }, data: { archivedAt: null, version: { increment: 1 } } });
    return found.id;
  }
  const created = await createItemTx(tx, workType, { ...actor, ctx: null }, { externalKey: versionKey, title: versionKey, groupKey: versionKey }, now, cal);
  return created.id;
}

export async function createItem(actor: ChangeActor, workTypeId: string, input: NewItem) {
  if (actor.ctx && !hasCap(actor.ctx, 'create')) throw new ForbiddenError('You don’t have permission to add items here.');
  if (actor.ctx && input.assigneeId && !hasCap(actor.ctx, 'assign')) throw new ForbiddenError('You don’t have permission to assign work here.');
  const cal = await workCalendar();
  return db.$transaction(async tx => {
    const wt = await tx.workType.findUniqueOrThrow({ where: { id: workTypeId } });
    if (actor.source === 'APP' && wt.state !== 'ACTIVE') throw new PausedError(wt.name);
    const exists = await tx.workItem.findUnique({ where: { workTypeId_externalKey: { workTypeId, externalKey: input.externalKey } } });
    if (exists) throw new Error(`${input.externalKey} already exists`);
    const item = await createItemTx(tx, wt, actor, input, new Date(), cal);
    const mod = requireModule(wt.key);
    await enqueue(tx, item.id, wt, mod, actor, (mod.sheet?.columns ?? []).filter(c => c.kind !== 'key').map(c => c.column));
    return item;
  });
}

// Internal building blocks for the sync engine (same rules, inside its own transaction).
export const internals = { setVersionClosedTx, ensureVersionItemTx, rollupVersionTx, loadItem, changeStatusTx, assignTx, updateFieldsTx, saveItem, enqueue, setPersonTx };
