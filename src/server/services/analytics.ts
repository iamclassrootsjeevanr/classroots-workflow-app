import type { Prisma } from '@prisma/client';
import { getModule, statusDef } from '@/modules/registry';
import type { StatusCategory } from '@/modules/types';
import {
  delayDays,
  flowTimes,
  kpis,
  qualityRates,
  reviewAndCorrection,
  reviewRoundDistribution,
  stageFunnel,
  stuckItems,
  throughputByWeek,
  timeInStatus,
  workloadByUser,
  workloadHeatmap,
  type IntervalLite,
  type ItemLite,
  type Summary,
} from '@/lib/analytics-core';
import { addDays } from '@/lib/time';
import { db } from '../db';
import { workCalendar } from '../settings';

export type Filters = {
  workTypeKeys?: string[];
  assigneeId?: string;
  ownerId?: string;
  grade?: number;
  from?: Date;
  to?: Date;
  /** Access scope (OWN / ALL per work type) from server/access.ts – always set for non-admin views. */
  where?: Prisma.WorkItemWhereInput;
};

/** People who can be given work (a role with the "work" capability) in these work types, or who already hold items. */
export function workPeopleWhere(workTypeKeys?: string[]): Prisma.UserWhereInput {
  const wt = workTypeKeys?.length ? { workType: { key: { in: workTypeKeys } } } : {};
  return {
    active: true,
    OR: [
      { memberships: { some: { ...wt, roles: { some: { role: { capWork: true, canEdit: true } } } } } },
      { assignedItems: { some: { archivedAt: null, ...wt } } },
    ],
  };
}

export type ItemRow = ItemLite & {
  workTypeName: string;
  statusLabel: string;
  statusColor: string;
  assigneeName: string | null;
  ownerName: string | null;
  groupKey: string | null;
  chapterTitle: string | null;
  grade: number | null;
  delay: number | null;
  data: Record<string, unknown>;
  feedbackCount: number;
  lastFeedbackAt: Date | null;
  updatedAt: Date;
  version: number;
  sheetMissing: boolean;
};

const categoryOf = (wtKey: string, status: string): StatusCategory => {
  const mod = getModule(wtKey);
  return mod ? statusDef(mod, status).category : 'queue';
};

export async function loadItems(filters: Filters = {}, opts: { includePausedTypes?: boolean } = {}): Promise<ItemRow[]> {
  const where: Prisma.WorkItemWhereInput = {
    archivedAt: null,
    workType: {
      state: opts.includePausedTypes === false ? 'ACTIVE' : { in: ['ACTIVE', 'PAUSED'] },
      ...(filters.workTypeKeys?.length ? { key: { in: filters.workTypeKeys } } : {}),
    },
    ...(filters.assigneeId ? { assigneeId: filters.assigneeId } : {}),
    ...(filters.ownerId ? { ownerId: filters.ownerId } : {}),
    ...(filters.grade ? { chapter: { grade: filters.grade } } : {}),
    ...(filters.where ? { AND: [filters.where] } : {}),
  };
  const rows = await db.workItem.findMany({
    where,
    include: {
      workType: { select: { key: true, name: true } },
      assignee: { select: { name: true } },
      owner: { select: { name: true } },
      chapter: { select: { title: true, grade: true } },
    },
    orderBy: [{ groupKey: 'asc' }, { sortOrder: 'asc' }, { externalKey: 'asc' }],
  });
  const now = new Date();
  return rows.map(r => {
    const mod = getModule(r.workType.key);
    const def = mod ? statusDef(mod, r.status) : { label: r.status, color: '#9e9e9e', category: 'queue' as StatusCategory };
    const base: ItemLite = {
      id: r.id,
      workTypeKey: r.workType.key,
      externalKey: r.externalKey,
      title: r.title,
      status: r.status,
      category: def.category,
      assigneeId: r.assigneeId,
      ownerId: r.ownerId,
      dueAt: r.dueAt,
      receivedAt: r.receivedAt,
      assignedAt: r.assignedAt,
      firstStartedAt: r.firstStartedAt,
      lastSubmittedAt: r.lastSubmittedAt,
      firstReviewAt: r.firstReviewAt,
      approvedAt: r.approvedAt,
      completedAt: r.completedAt,
      reviewRounds: r.reviewRounds,
      reopenCount: r.reopenCount,
      weight: mod?.workloadWeight ?? 1,
    };
    return {
      ...base,
      workTypeName: r.workType.name,
      statusLabel: def.label,
      statusColor: def.color,
      assigneeName: r.assignee?.name ?? null,
      ownerName: r.owner?.name ?? null,
      groupKey: r.groupKey,
      chapterTitle: r.chapter?.title ?? ((r.data as Record<string, unknown>)?.chapterTitle as string | undefined) ?? null,
      grade: r.chapter?.grade ?? null,
      delay: delayDays(base, now),
      data: (r.data ?? {}) as Record<string, unknown>,
      feedbackCount: r.feedbackCount,
      lastFeedbackAt: r.lastFeedbackAt,
      updatedAt: r.updatedAt,
      version: r.version,
      sheetMissing: r.sheetMissing,
    };
  });
}

export async function loadIntervals(itemIds: string[], workTypeByItem: Map<string, string>, since?: Date): Promise<IntervalLite[]> {
  if (!itemIds.length) return [];
  const rows = await db.workItemStageInterval.findMany({
    where: { itemId: { in: itemIds }, ...(since ? { OR: [{ exitedAt: null }, { exitedAt: { gte: since } }] } : {}) },
    orderBy: { enteredAt: 'asc' },
  });
  return rows.map(r => ({
    itemId: r.itemId,
    status: r.status,
    category: categoryOf(workTypeByItem.get(r.itemId) ?? '', r.status),
    assigneeId: r.assigneeId,
    enteredAt: r.enteredAt,
    exitedAt: r.exitedAt,
    round: r.round,
  }));
}

export type StatusSlice = { key: string; label: string; color: string; count: number };

/** Counts per status label (merged across work types), in workflow order. */
export function statusSlices(items: ItemRow[]): StatusSlice[] {
  const m = new Map<string, StatusSlice & { order: number }>();
  for (const it of items) {
    const mod = getModule(it.workTypeKey);
    const order = mod ? mod.statuses.findIndex(s => s.key === it.status) : 99;
    const s = m.get(it.statusLabel) ?? { key: it.status, label: it.statusLabel, color: it.statusColor, count: 0, order };
    s.count++;
    m.set(it.statusLabel, s);
  }
  return [...m.values()].sort((a, b) => a.order - b.order).map(({ order: _o, ...s }) => s);
}

export type StageTime = { status: string; label: string; color: string } & Summary;

function stageTimes(intervals: IntervalLite[], items: ItemRow[], now: Date, cal: Awaited<ReturnType<typeof workCalendar>>): StageTime[] {
  const wtByItem = new Map(items.map(i => [i.id, i.workTypeKey]));
  const map = timeInStatus(intervals, now, cal);
  const out: StageTime[] = [];
  const seen = new Set<string>();
  for (const iv of intervals) {
    if (seen.has(iv.status) || !map.has(iv.status)) continue;
    seen.add(iv.status);
    const mod = getModule(wtByItem.get(iv.itemId) ?? '');
    const def = mod ? statusDef(mod, iv.status) : { label: iv.status, color: '#9e9e9e' };
    out.push({ status: iv.status, label: def.label, color: def.color, ...map.get(iv.status)! });
  }
  const order = (s: string) => {
    const mod = getModule(items[0]?.workTypeKey ?? '');
    const i = mod ? mod.statuses.findIndex(x => x.key === s) : -1;
    return i < 0 ? 99 : i;
  };
  return out.sort((a, b) => order(a.status) - order(b.status));
}

export async function dashboard(filters: Filters, opts: { heatmapDays?: number; weeks?: number } = {}) {
  const now = new Date();
  const to = filters.to ?? now;
  const from = filters.from ?? addDays(to, -7 * (opts.weeks ?? 12));
  const cal = await workCalendar();

  const items = await loadItems(filters);
  const wtByItem = new Map(items.map(i => [i.id, i.workTypeKey]));
  const intervals = await loadIntervals(items.map(i => i.id), wtByItem);
  const inRange = intervals.filter(iv => (iv.exitedAt ?? now) >= from && iv.enteredAt <= to);
  const completedInRange = items.filter(i => !i.completedAt || (i.completedAt >= from && i.completedAt <= to));

  const people = await db.user.findMany({
    where: { ...workPeopleWhere(filters.workTypeKeys), ...(filters.assigneeId ? { id: filters.assigneeId } : {}) },
    select: { id: true, name: true, email: true, capacity: true },
    orderBy: { name: 'asc' },
  });
  const users = people.map(p => ({ id: p.id, name: p.name ?? p.email ?? 'Unknown', capacity: p.capacity }));

  const limits = items.length ? getModule(items[0].workTypeKey)?.stuckAfterHours ?? {} : {};
  const openIntervals = intervals.filter(iv => !iv.exitedAt);
  const itemById = new Map(items.map(i => [i.id, i]));

  return {
    now,
    range: { from, to },
    calendar: { startHour: cal.startHour, endHour: cal.endHour, workDays: cal.workDays, tz: cal.tz },
    items,
    kpis: kpis(items, now),
    statusSlices: statusSlices(items),
    flow: flowTimes(completedInRange, cal),
    review: reviewAndCorrection(inRange, cal),
    quality: qualityRates(completedInRange),
    rounds: reviewRoundDistribution(items),
    funnel: stageFunnel(items),
    stageTimes: stageTimes(inRange, items, now, cal),
    throughput: throughputByWeek(items, from, to, cal.tz),
    workload: workloadByUser(items, users, now),
    heatmap: workloadHeatmap(intervals, users.map(u => u.id), opts.heatmapDays ?? 21, now, cal.tz),
    users,
    stuck: stuckItems(openIntervals, limits, now, cal)
      .map(s => ({ ...s, item: itemById.get(s.itemId)! }))
      .filter(s => s.item),
    byDeveloper: users.map(u => {
      const mine = items.filter(i => i.assigneeId === u.id);
      const counts: Record<string, number> = {};
      for (const i of mine) counts[i.statusLabel] = (counts[i.statusLabel] ?? 0) + 1;
      return { name: u.name, ...counts };
    }),
  };
}

export type DashboardData = Awaited<ReturnType<typeof dashboard>>;

/** Per-person stage times, for "my time per stage vs team". */
export async function stageTimesFor(userId: string, filters: Filters = {}) {
  const now = new Date();
  const cal = await workCalendar();
  const items = await loadItems(filters);
  const wtByItem = new Map(items.map(i => [i.id, i.workTypeKey]));
  const intervals = await loadIntervals(items.map(i => i.id), wtByItem, addDays(now, -120));
  const mine = intervals.filter(iv => iv.assigneeId === userId);
  const team = stageTimes(intervals, items, now, cal);
  const me = new Map(stageTimes(mine, items, now, cal).map(s => [s.status, s]));
  return team
    .filter(t => !['queue', 'done', 'approved'].includes(categoryOf(items[0]?.workTypeKey ?? '', t.status)) || me.has(t.status))
    .map(t => ({ label: t.label, team: t.avg != null ? t.avg / 60 : null, me: me.get(t.status)?.avg != null ? me.get(t.status)!.avg! / 60 : null }));
}
