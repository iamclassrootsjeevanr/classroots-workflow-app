/**
 * Loads the admin's stage changes (WorkflowStage rows) into the module registry. Every request refreshes them at most every
 * few seconds (from `currentUser`), and saving on the Stages screen refreshes at once. No 'server-only' import: scripts use it too.
 */
import { Prisma, type WorkflowStage } from '@prisma/client';
import { ACTORS, CATEGORIES, STAGE_STATES, isLockedStage, positionAfter, stageKeyFor, stagePositions, type StageRow } from '@/lib/stages';
import { allModules, baseModule, requireModule, setStageRows, statusDef } from '@/modules/registry';
import type { Actor, StageState, StatusCategory } from '@/modules/types';
import { db } from './db';

const TTL_MS = 10_000;
let loadedAt = 0;
let loading: Promise<void> | null = null;

export function toStageRow(r: WorkflowStage): StageRow {
  return {
    key: r.key,
    label: r.label,
    color: r.color,
    category: r.category,
    position: r.position,
    state: r.state,
    nextLabel: r.nextLabel,
    movedBy: Array.isArray(r.movedBy) ? (r.movedBy as Actor[]) : null,
    stuckHours: r.stuckHours,
    custom: r.custom,
  };
}

async function load() {
  const rows = await db.workflowStage.findMany({ include: { workType: { select: { key: true } } } });
  const byType = new Map<string, StageRow[]>();
  for (const r of rows) byType.set(r.workType.key, [...(byType.get(r.workType.key) ?? []), toStageRow(r)]);
  for (const m of allModules()) setStageRows(m.key, byType.get(m.key) ?? []);
  loadedAt = Date.now();
}

/** Bring the registry up to date with the database (skipped when fresh, unless forced). */
export async function refreshStages(force = false) {
  if (!force && Date.now() - loadedAt < TTL_MS) return;
  loading ??= load().finally(() => {
    loading = null;
  });
  await loading;
}

// ─── Admin → Work types → Stages ────────────────────────────────

export type StageView = {
  key: string;
  label: string;
  color: string;
  category: StatusCategory;
  state: StageState;
  locked: boolean;
  custom: boolean;
  side: boolean;
  /** The stage has a forward button (can be paused / skipped / have stages added after it). */
  pipeline: boolean;
  nextLabel: string | null;
  movedBy: Actor[];
  stuckHours: number | null;
  phase: string | null;
  /** Items in this stage now, and whether any item was ever in it. */
  here: number;
  used: boolean;
  moves: { label: string; to: string; toLabel: string; by: Actor[] }[];
};

/** Every stage of a work type as the admin screen shows it, with the moves out of it. */
export async function stageScreen(workTypeKey: string) {
  await refreshStages(true);
  const mod = requireModule(workTypeKey);
  const wt = await db.workType.findUniqueOrThrow({ where: { key: workTypeKey } });
  const [now, ever] = await Promise.all([
    db.workItem.groupBy({ by: ['status'], where: { workTypeId: wt.id, archivedAt: null }, _count: true }),
    db.workItemStageInterval.groupBy({ by: ['status'], where: { item: { workTypeId: wt.id } }, _count: true }),
  ]);
  const here = new Map(now.map(r => [r.status, r._count]));
  const used = new Set(ever.map(r => r.status));
  const stages: StageView[] = mod.statuses.map(s => ({
    key: s.key,
    label: s.label,
    color: s.color,
    category: s.baseCategory ?? s.category,
    state: s.state ?? 'active',
    locked: Boolean(s.locked),
    custom: Boolean(s.custom),
    side: s.line === 'side',
    pipeline: Boolean(s.next),
    nextLabel: s.next?.label ?? null,
    movedBy: s.next?.by ?? [],
    stuckHours: s.stuckHours ?? null,
    phase: s.phase ?? null,
    here: here.get(s.key) ?? 0,
    used: used.has(s.key) || here.has(s.key),
    moves: mod.transitions.filter(t => t.from === s.key).map(t => ({ label: t.label ?? statusDef(mod, t.to).label, to: t.to, toLabel: statusDef(mod, t.to).label, by: t.by })),
  }));
  return { wt, mod, stages };
}

export type StageInput = { label: string; color: string; category: string; state: string; nextLabel: string | null; movedBy: string[]; stuckHours: number | null };

function clean(input: StageInput) {
  const label = input.label.trim();
  if (!label) throw new Error('Give the stage a name.');
  if (!/^#[0-9a-f]{6}$/i.test(input.color)) throw new Error('Pick a colour.');
  if (!CATEGORIES.includes(input.category as StatusCategory)) throw new Error('Pick what kind of stage this is.');
  if (!STAGE_STATES.includes(input.state as StageState)) throw new Error('Pick active, paused or skipped.');
  if (input.stuckHours != null && !(input.stuckHours > 0 && input.stuckHours < 1000)) throw new Error('The time limit must be between 0 and 1000 working hours (empty = none).');
  const movedBy = input.movedBy.filter((a): a is Actor => ACTORS.includes(a as Actor));
  return { label, color: input.color.toLowerCase(), category: input.category as StatusCategory, state: input.state as StageState, nextLabel: input.nextLabel?.trim() || null, movedBy, stuckHours: input.stuckHours };
}

const same = (a: Actor[], b: Actor[]) => [...a].sort().join() === [...b].sort().join();

/** Save an admin's edit of one stage. Values equal to the code default are stored as null, so later code changes still apply. */
export async function saveStage(workTypeId: string, key: string, input: StageInput) {
  const wt = await db.workType.findUniqueOrThrow({ where: { id: workTypeId } });
  const base = baseModule(wt.key);
  if (!base) throw new Error('This work type has no module code.');
  const v = clean(input);
  const code = base.statuses.find(s => s.key === key);
  const existing = await db.workflowStage.findUnique({ where: { workTypeId_key: { workTypeId, key } } });
  if (!code && !existing?.custom) throw new Error('Unknown stage.');
  if (code && isLockedStage(base, key)) {
    if (v.state !== 'active') throw new Error(`${v.label} is a fixed part of the flow: it can't be paused or skipped.`);
    if (v.category !== code.category) throw new Error(`${v.label} is a fixed part of the flow: its kind can't change.`);
  }
  const data = code
    ? {
        label: v.label === code.label ? null : v.label,
        color: v.color === code.color.toLowerCase() ? null : v.color,
        category: v.category === code.category ? null : v.category,
        state: v.state === (code.state ?? 'active') ? null : v.state,
        nextLabel: code.next && v.nextLabel && v.nextLabel !== code.next.label ? v.nextLabel : null,
        movedBy: code.next && !same(v.movedBy, code.next.by) ? (v.movedBy as Prisma.InputJsonValue) : Prisma.DbNull,
        stuckHours: v.stuckHours === (code.stuckHours ?? null) ? null : v.stuckHours,
      }
    : { label: v.label, color: v.color, category: v.category, state: v.state, nextLabel: v.nextLabel ?? 'Mark done', movedBy: v.movedBy as Prisma.InputJsonValue, stuckHours: v.stuckHours };
  await db.workflowStage.upsert({ where: { workTypeId_key: { workTypeId, key } }, create: { workTypeId, key, ...data }, update: data });
  await refreshStages(true);
}

/** Add a stage to the main line right after `afterKey`. Its button moves items on to whatever came next. */
export async function addStage(workTypeId: string, afterKey: string, input: StageInput) {
  const wt = await db.workType.findUniqueOrThrow({ where: { id: workTypeId } });
  const base = baseModule(wt.key);
  if (!base) throw new Error('This work type has no module code.');
  await refreshStages(true);
  const mod = requireModule(wt.key);
  const after = mod.statuses.find(s => s.key === afterKey);
  if (!after?.next || after.line === 'side') throw new Error('New stages go after a stage that has a “next stage” button.');
  const v = clean(input);
  const rows = (await db.workflowStage.findMany({ where: { workTypeId } })).map(toStageRow);
  let positions = stagePositions(base, rows);
  let position = positionAfter(mod, positions, afterKey);
  if (position == null) {
    // No room between the two stages: spread every stage out again (only their positions are stored).
    await db.$transaction(mod.statuses.map((s, i) => db.workflowStage.upsert({ where: { workTypeId_key: { workTypeId, key: s.key } }, create: { workTypeId, key: s.key, position: (i + 1) * 100 }, update: { position: (i + 1) * 100 } })));
    positions = new Map(mod.statuses.map((s, i) => [s.key, (i + 1) * 100]));
    position = positionAfter(mod, positions, afterKey)!;
  }
  const key = stageKeyFor(v.label, [...mod.statuses.map(s => s.key), ...rows.map(r => r.key)]);
  await db.workflowStage.create({
    data: { workTypeId, key, custom: true, position, label: v.label, color: v.color, category: v.category, state: v.state, nextLabel: v.nextLabel ?? 'Mark done', movedBy: v.movedBy as Prisma.InputJsonValue, stuckHours: v.stuckHours },
  });
  await refreshStages(true);
  return key;
}

/** Remove a stage: a custom stage nobody ever used is deleted; anything with history is skipped instead, so reports stay right. */
export async function removeStage(workTypeId: string, key: string): Promise<'deleted' | 'skipped'> {
  const wt = await db.workType.findUniqueOrThrow({ where: { id: workTypeId } });
  const base = baseModule(wt.key);
  if (!base) throw new Error('This work type has no module code.');
  const row = await db.workflowStage.findUnique({ where: { workTypeId_key: { workTypeId, key } } });
  const code = base.statuses.find(s => s.key === key);
  if (code && isLockedStage(base, key)) throw new Error(`${code.label} is a fixed part of the flow and can't be removed.`);
  if (!code && !row?.custom) throw new Error('Unknown stage.');
  const used = (await db.workItem.count({ where: { workTypeId, status: key } })) + (await db.workItemStageInterval.count({ where: { status: key, item: { workTypeId } } }));
  if (!code && !used) {
    await db.workflowStage.delete({ where: { workTypeId_key: { workTypeId, key } } });
    await refreshStages(true);
    return 'deleted';
  }
  await db.workflowStage.upsert({ where: { workTypeId_key: { workTypeId, key } }, create: { workTypeId, key, state: 'skipped' }, update: { state: 'skipped' } });
  await refreshStages(true);
  return 'skipped';
}
