/**
 * Configurable stages. The module code defines the default stages; an admin can rename, recolour, re-time, pause or skip them
 * and add stages of their own (Admin → Work types → Stages). `applyStageConfig` merges those rows over the code and builds the
 * "next stage" moves, so the rest of the app only ever sees one plain WorkTypeDefinition. Pure: no DB.
 */
import type { Actor, StageState, StatusCategory, StatusDef, Transition, WorkTypeDefinition } from '@/modules/types';
import type { IntervalLite, StuckRule } from './analytics-core';

/** One admin-edited stage. Null = keep the module's default. Custom stages have every field set. */
export type StageRow = {
  key: string;
  label: string | null;
  color: string | null;
  category: string | null;
  position: number | null;
  state: string | null;
  nextLabel: string | null;
  movedBy: Actor[] | null;
  stuckHours: number | null;
  custom: boolean;
};

export const NEXT_TO = '@next:';
/** Who can be allowed to press a stage's button. */
export const ACTORS: Actor[] = ['ASSIGNEE', 'OWNER', 'work', 'review', 'assign', 'manageFields', 'create'];
export const STAGE_STATES: StageState[] = ['active', 'paused', 'skipped'];
export const CATEGORIES: StatusCategory[] = ['queue', 'active', 'review', 'feedback', 'approved', 'done', 'hold'];

const isState = (s: unknown): s is StageState => STAGE_STATES.includes(s as StageState);
const isCategory = (s: unknown): s is StatusCategory => CATEGORIES.includes(s as StatusCategory);

/** Position of a built-in stage in code order (gaps of 10 leave room for stages added in between). */
export const basePosition = (index: number) => (index + 1) * 10;

/** Locked stages can be renamed but not paused, skipped or removed: first and last of the main line, side stages, and `locked`. */
export function isLockedStage(base: WorkTypeDefinition, key: string): boolean {
  const s = base.statuses.find(x => x.key === key);
  if (!s) return false;
  const main = base.statuses.filter(x => (x.line ?? 'main') === 'main');
  return Boolean(s.locked) || s.line === 'side' || main[0]?.key === key || main[main.length - 1]?.key === key || !s.next;
}

/** The next main-line stage after `key` that is not skipped (paused stages count: items wait there). */
export function nextActiveAfter(statuses: StatusDef[], key: string): string | undefined {
  const main = statuses.filter(s => (s.line ?? 'main') === 'main');
  const i = main.findIndex(s => s.key === key);
  if (i < 0) return undefined;
  return main.slice(i + 1).find(s => s.state !== 'skipped')?.key;
}

function resolveTarget(statuses: StatusDef[], to: string): string | undefined {
  if (to.startsWith(NEXT_TO)) return nextActiveAfter(statuses, to.slice(NEXT_TO.length));
  const s = statuses.find(x => x.key === to);
  if (!s) return undefined;
  return s.state === 'skipped' ? nextActiveAfter(statuses, to) : to;
}

/** The work type as the app uses it: code defaults + the admin's stage rows, with generated "next stage" moves. */
export function applyStageConfig(base: WorkTypeDefinition, rows: StageRow[]): WorkTypeDefinition {
  const byKey = new Map(rows.map(r => [r.key, r]));
  const positioned: { def: StatusDef; pos: number }[] = base.statuses.map((s, i) => {
    const r = byKey.get(s.key);
    const locked = isLockedStage(base, s.key);
    const state: StageState = locked ? 'active' : isState(r?.state) ? r.state : (s.state ?? 'active');
    const category = isCategory(r?.category) ? r.category : s.category;
    const next = s.next ? { ...s.next, label: r?.nextLabel ?? s.next.label, by: r?.movedBy ?? s.next.by } : undefined;
    return {
      def: { ...s, label: r?.label ?? s.label, color: r?.color ?? s.color, category, state, locked, next, stuckHours: r?.stuckHours ?? s.stuckHours },
      pos: r?.position ?? basePosition(i),
    };
  });
  for (const r of rows) {
    if (!r.custom || base.statuses.some(s => s.key === r.key)) continue;
    positioned.push({
      def: {
        key: r.key,
        label: r.label ?? r.key,
        color: r.color ?? '#78909c',
        category: isCategory(r.category) ? r.category : 'active',
        line: 'main',
        state: isState(r.state) ? r.state : 'active',
        next: { label: r.nextLabel ?? 'Mark done', by: r.movedBy ?? [] },
        stuckHours: r.stuckHours ?? undefined,
        custom: true,
      },
      pos: r.position ?? 0,
    });
  }
  const statuses = positioned
    .map((p, i) => ({ ...p, i }))
    .sort((a, b) => a.pos - b.pos || a.i - b.i)
    .map(({ def }) => (def.state === 'paused' ? { ...def, baseCategory: def.category, category: 'hold' as StatusCategory } : def));

  const explicit: Transition[] = [];
  for (const t of base.transitions) {
    const to = resolveTarget(statuses, t.to);
    if (to && to !== t.from && statuses.some(s => s.key === t.from)) explicit.push({ ...t, to });
  }
  const generated: Transition[] = [];
  for (const s of statuses) {
    if (!s.next || (s.line ?? 'main') !== 'main') continue;
    const to = nextActiveAfter(statuses, s.key);
    if (!to || explicit.some(t => t.from === s.key && t.to === to)) continue;
    generated.push({ from: s.key, to, by: [...s.next.by], label: s.next.label, ...(s.next.stamp ? { stamp: s.next.stamp } : {}) });
  }
  const paused = new Set(statuses.filter(s => s.state === 'paused').map(s => s.key));
  const transitions = [...explicit, ...generated].filter(t => !paused.has(t.from));

  const entry = (key: string) => (statuses.find(s => s.key === key)?.state === 'skipped' ? nextActiveAfter(statuses, key) ?? key : key);
  const mod: WorkTypeDefinition = {
    ...base,
    statuses,
    transitions,
    initialStatus: entry(base.initialStatus),
    assignedStatus: entry(base.assignedStatus),
  };
  return base.groupSummaryFor ? { ...mod, groupSummary: base.groupSummaryFor(mod) } : mod;
}

/**
 * Stuck limit for each open stay: a phase limit (time since the item entered the phase), else the stage's own limit, else its
 * kind's. Paused stages are never stuck: the wait is intended.
 */
export function stuckRules(mod: WorkTypeDefinition, intervals: IntervalLite[]): (iv: IntervalLite) => StuckRule | undefined {
  const byItem = new Map<string, IntervalLite[]>();
  for (const iv of intervals) byItem.set(iv.itemId, [...(byItem.get(iv.itemId) ?? []), iv]);
  for (const list of byItem.values()) list.sort((a, b) => a.enteredAt.getTime() - b.enteredAt.getTime());
  const stage = (key: string) => mod.statuses.find(s => s.key === key);
  return iv => {
    const s = stage(iv.status);
    if (s?.state === 'paused') return undefined;
    const phase = s?.phase ? mod.phaseLimits?.[s.phase] : undefined;
    if (s?.phase && phase) {
      const list = byItem.get(iv.itemId) ?? [iv];
      let i = list.indexOf(iv);
      let since = iv.enteredAt;
      while (i > 0 && stage(list[i - 1].status)?.phase === s.phase) since = list[--i].enteredAt;
      return { hours: phase.hours, since };
    }
    const hours = s?.stuckHours ?? mod.stuckAfterHours?.[iv.category];
    return hours ? { hours } : undefined;
  };
}

/** Where a stage added "after `afterKey`" goes: halfway to the next stage, or null when there is no room (renumber first). */
export function positionAfter(mod: WorkTypeDefinition, positions: Map<string, number>, afterKey: string): number | null {
  const order = mod.statuses.map(s => s.key);
  const i = order.indexOf(afterKey);
  if (i < 0) return null;
  const here = positions.get(afterKey) ?? 0;
  const following = order.slice(i + 1).map(k => positions.get(k)).find((p): p is number => p != null);
  if (following == null) return here + 10;
  const mid = Math.floor((here + following) / 2);
  return mid > here && mid < following ? mid : null;
}

/** Effective position of every stage (row position or code order), for the admin screen and inserts. */
export function stagePositions(base: WorkTypeDefinition, rows: StageRow[]): Map<string, number> {
  const out = new Map<string, number>();
  base.statuses.forEach((s, i) => out.set(s.key, basePosition(i)));
  for (const r of rows) if (r.position != null) out.set(r.key, r.position);
  return out;
}

/** A status key for a new stage from its label, unique in the work type. */
export function stageKeyFor(label: string, taken: Iterable<string>): string {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'stage';
  const used = new Set(taken);
  let key = base;
  for (let n = 2; used.has(key); n++) key = `${base}_${n}`;
  return key;
}
