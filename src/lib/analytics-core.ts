/**
 * Pure analytics over work items and their stage intervals.
 * No DB access here – the service layer loads rows and calls these.
 */
import type { StatusCategory } from '@/modules/types';
import { addDays, businessMinutesBetween, dayKey, DEFAULT_CALENDAR, minutesBetween, startOfLocalDay, type WorkCalendar } from './time';

export type ItemLite = {
  id: string;
  workTypeKey: string;
  externalKey: string;
  title: string;
  status: string;
  category: StatusCategory;
  assigneeId: string | null;
  ownerId: string | null;
  dueAt: Date | null;
  receivedAt: Date;
  assignedAt: Date | null;
  firstStartedAt: Date | null;
  lastSubmittedAt: Date | null;
  firstReviewAt: Date | null;
  approvedAt: Date | null;
  completedAt: Date | null;
  reviewRounds: number;
  reopenCount: number;
  /** Workload weight of this item (default 1). */
  weight?: number;
};

export type IntervalLite = {
  itemId: string;
  status: string;
  category: StatusCategory;
  assigneeId: string | null;
  enteredAt: Date;
  exitedAt: Date | null;
  round: number;
};

export type Summary = { count: number; avg: number | null; median: number | null; p90: number | null };

export function summarize(values: number[]): Summary {
  const v = values.filter(x => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return { count: 0, avg: null, median: null, p90: null };
  const q = (p: number) => {
    const idx = (v.length - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    return v[lo] + (v[hi] - v[lo]) * (idx - lo);
  };
  return {
    count: v.length,
    avg: v.reduce((s, x) => s + x, 0) / v.length,
    median: q(0.5),
    p90: q(0.9),
  };
}

const isClosed = (c: StatusCategory) => c === 'done';
const isOpen = (c: StatusCategory) => c !== 'done';

export type Kpis = {
  total: number;
  unassigned: number;
  inQueue: number;
  inProgress: number;
  inReview: number;
  corrections: number;
  approved: number;
  done: number;
  onHold: number;
  overdue: number;
  dueThisWeek: number;
};

export function kpis(items: ItemLite[], now: Date): Kpis {
  const weekEnd = addDays(now, 7);
  const k: Kpis = { total: items.length, unassigned: 0, inQueue: 0, inProgress: 0, inReview: 0, corrections: 0, approved: 0, done: 0, onHold: 0, overdue: 0, dueThisWeek: 0 };
  for (const it of items) {
    if (!it.assigneeId && isOpen(it.category)) k.unassigned++;
    if (it.category === 'queue') k.inQueue++;
    if (it.category === 'active') k.inProgress++;
    if (it.category === 'review') k.inReview++;
    if (it.category === 'feedback') k.corrections++;
    if (it.category === 'approved') k.approved++;
    if (it.category === 'done') k.done++;
    if (it.category === 'hold') k.onHold++;
    if (isOpen(it.category) && it.dueAt) {
      if (it.dueAt < now) k.overdue++;
      else if (it.dueAt <= weekEnd) k.dueThisWeek++;
    }
  }
  return k;
}

/** Delay in whole days vs due date (positive = late). Open items are measured against now. */
export function delayDays(it: Pick<ItemLite, 'dueAt' | 'completedAt' | 'category'>, now: Date): number | null {
  if (!it.dueAt) return null;
  const end = it.completedAt ?? (isClosed(it.category) ? null : now);
  if (!end) return null;
  return Math.floor((end.getTime() - it.dueAt.getTime()) / 86400000);
}

export type FlowTimes = {
  leadTime: Summary; // received → completed
  cycleTime: Summary; // first started → completed
  waitBeforeStart: Summary; // assigned → first started
  timeToFirstSubmit: Summary; // first started → first review/submission
};

/** Business-minute durations of the item lifecycle, for completed (or started) items. */
export function flowTimes(items: ItemLite[], cal: WorkCalendar = DEFAULT_CALENDAR): FlowTimes {
  const lead: number[] = [];
  const cycle: number[] = [];
  const wait: number[] = [];
  const submit: number[] = [];
  for (const it of items) {
    if (it.completedAt) {
      lead.push(businessMinutesBetween(it.receivedAt, it.completedAt, cal));
      if (it.firstStartedAt) cycle.push(businessMinutesBetween(it.firstStartedAt, it.completedAt, cal));
    }
    if (it.assignedAt && it.firstStartedAt) wait.push(businessMinutesBetween(it.assignedAt, it.firstStartedAt, cal));
    if (it.firstStartedAt && it.lastSubmittedAt && it.reviewRounds === 1) {
      submit.push(businessMinutesBetween(it.firstStartedAt, it.lastSubmittedAt, cal));
    }
  }
  return { leadTime: summarize(lead), cycleTime: summarize(cycle), waitBeforeStart: summarize(wait), timeToFirstSubmit: summarize(submit) };
}

export function intervalMinutes(iv: IntervalLite, now: Date, cal: WorkCalendar = DEFAULT_CALENDAR, business = true): number {
  const end = iv.exitedAt ?? now;
  return business ? businessMinutesBetween(iv.enteredAt, end, cal) : minutesBetween(iv.enteredAt, end);
}

/** Time spent per status (business minutes), including the current open stay. */
export function timeInStatus(intervals: IntervalLite[], now: Date, cal: WorkCalendar = DEFAULT_CALENDAR): Map<string, Summary> {
  const by = new Map<string, number[]>();
  for (const iv of intervals) {
    if (iv.category === 'done') continue;
    const arr = by.get(iv.status) ?? [];
    arr.push(intervalMinutes(iv, now, cal));
    by.set(iv.status, arr);
  }
  return new Map([...by].map(([k, v]) => [k, summarize(v)]));
}

/** Review turnaround = closed stays in review statuses; correction time = closed stays in feedback statuses. */
export function reviewAndCorrection(intervals: IntervalLite[], cal: WorkCalendar = DEFAULT_CALENDAR) {
  const review: number[] = [];
  const correction: number[] = [];
  // A submission may pass through several review statuses (ready → in review); merge per item+round.
  const reviewSpans = new Map<string, { start: Date; end: Date }>();
  for (const iv of intervals) {
    if (!iv.exitedAt) continue;
    if (iv.category === 'review') {
      const key = `${iv.itemId}:${iv.round}`;
      const span = reviewSpans.get(key);
      if (span) {
        if (iv.enteredAt < span.start) span.start = iv.enteredAt;
        if (iv.exitedAt > span.end) span.end = iv.exitedAt;
      } else reviewSpans.set(key, { start: iv.enteredAt, end: iv.exitedAt });
    }
    if (iv.category === 'feedback') correction.push(businessMinutesBetween(iv.enteredAt, iv.exitedAt, cal));
  }
  for (const s of reviewSpans.values()) review.push(businessMinutesBetween(s.start, s.end, cal));
  return { reviewTurnaround: summarize(review), correctionTime: summarize(correction) };
}

export function reviewRoundDistribution(items: ItemLite[]): { rounds: number; count: number }[] {
  const m = new Map<number, number>();
  for (const it of items) {
    if (!it.approvedAt && !it.completedAt) continue;
    const r = Math.max(1, it.reviewRounds);
    m.set(r, (m.get(r) ?? 0) + 1);
  }
  return [...m].sort((a, b) => a[0] - b[0]).map(([rounds, count]) => ({ rounds, count }));
}

export function qualityRates(items: ItemLite[]) {
  const approved = items.filter(i => i.approvedAt || i.completedAt);
  const firstPass = approved.filter(i => i.reviewRounds <= 1 && i.reopenCount === 0).length;
  const withDue = items.filter(i => i.completedAt && i.dueAt);
  const onTime = withDue.filter(i => i.completedAt! <= i.dueAt!).length;
  return {
    firstPassRate: approved.length ? firstPass / approved.length : null,
    onTimeRate: withDue.length ? onTime / withDue.length : null,
    approvedCount: approved.length,
    completedWithDue: withDue.length,
  };
}

/** Monday-based week start (local) as 'YYYY-MM-DD'. */
export function weekKey(d: Date, tz = DEFAULT_CALENDAR.tz): string {
  const local = startOfLocalDay(d, tz);
  const key = dayKey(local, tz);
  const dow = new Date(key + 'T00:00:00Z').getUTCDay();
  const back = (dow + 6) % 7;
  return dayKey(addDays(new Date(key + 'T12:00:00Z'), -back), 'UTC');
}

export function throughputByWeek(items: ItemLite[], from: Date, to: Date, tz = DEFAULT_CALENDAR.tz) {
  const weeks: string[] = [];
  for (let d = new Date(from); d <= to; d = addDays(d, 7)) {
    const k = weekKey(d, tz);
    if (!weeks.includes(k)) weeks.push(k);
  }
  const lastKey = weekKey(to, tz);
  if (!weeks.includes(lastKey)) weeks.push(lastKey);
  const rows = new Map(weeks.map(w => [w, { week: w, started: 0, submitted: 0, completed: 0, onTime: 0, late: 0 }]));
  for (const it of items) {
    if (it.firstStartedAt && it.firstStartedAt >= from && it.firstStartedAt <= to) rows.get(weekKey(it.firstStartedAt, tz))!.started++;
    if (it.lastSubmittedAt && it.lastSubmittedAt >= from && it.lastSubmittedAt <= to) rows.get(weekKey(it.lastSubmittedAt, tz))!.submitted++;
    if (it.completedAt && it.completedAt >= from && it.completedAt <= to) {
      const r = rows.get(weekKey(it.completedAt, tz))!;
      r.completed++;
      if (it.dueAt) (it.completedAt <= it.dueAt ? r.onTime++ : r.late++);
    }
  }
  return [...rows.values()];
}

export type LoadLevel = 'idle' | 'low' | 'normal' | 'high' | 'overloaded';

export function loadLevel(open: number, capacity: number): LoadLevel {
  if (open === 0) return 'idle';
  const r = open / Math.max(1, capacity);
  if (r < 0.5) return 'low';
  if (r <= 1) return 'normal';
  if (r <= 1.5) return 'high';
  return 'overloaded';
}

export type UserLite = { id: string; name: string; capacity: number };

export type Workload = {
  userId: string;
  name: string;
  capacity: number;
  open: number;
  queued: number;
  inProgress: number;
  inReview: number;
  onHold: number;
  overdue: number;
  dueNext7d: number;
  doneLast30d: number;
  /** open items that occupy the developer (not waiting on review) */
  active: number;
  level: LoadLevel;
  utilization: number;
};

/** Current load per user from the items assigned to them. Items waiting in review don't count towards active load. */
export function workloadByUser(items: ItemLite[], users: UserLite[], now: Date): Workload[] {
  const in7 = addDays(now, 7);
  const ago30 = addDays(now, -30);
  return users
    .map(u => {
      const mine = items.filter(i => i.assigneeId === u.id);
      const w: Workload = { userId: u.id, name: u.name, capacity: u.capacity, open: 0, queued: 0, inProgress: 0, inReview: 0, onHold: 0, overdue: 0, dueNext7d: 0, doneLast30d: 0, active: 0, level: 'idle', utilization: 0 };
      let weighted = 0;
      for (const i of mine) {
        if (i.completedAt && i.completedAt >= ago30) w.doneLast30d++;
        if (i.category === 'done' || i.category === 'approved') continue;
        w.open++;
        if (i.category === 'queue') w.queued++;
        if (i.category === 'active' || i.category === 'feedback') w.inProgress++;
        if (i.category === 'review') w.inReview++;
        if (i.category === 'hold') w.onHold++;
        if (['queue', 'active', 'feedback', 'hold'].includes(i.category)) weighted += i.weight ?? 1;
        if (i.dueAt && i.dueAt < now) w.overdue++;
        else if (i.dueAt && i.dueAt <= in7) w.dueNext7d++;
      }
      // Load is weighted per work type (many small tests ≈ one journey), rounded for display.
      w.active = Math.round(weighted * 10) / 10;
      w.level = loadLevel(w.active, u.capacity);
      w.utilization = w.active / Math.max(1, u.capacity);
      return w;
    })
    .sort((a, b) => a.utilization - b.utilization || a.name.localeCompare(b.name));
}

/**
 * Per-user, per-day count of distinct items on their plate (queue/active/feedback/hold),
 * rebuilt from stage intervals – so it shows history, not just today.
 */
export function workloadHeatmap(intervals: IntervalLite[], userIds: string[], days: number, now: Date, tz = DEFAULT_CALENDAR.tz) {
  const today = startOfLocalDay(now, tz);
  const dayStarts = Array.from({ length: days }, (_, i) => addDays(today, i - days + 1));
  const keys = dayStarts.map(d => dayKey(d, tz));
  const grid = new Map(userIds.map(u => [u, keys.map(() => new Set<string>())]));
  for (const iv of intervals) {
    if (!iv.assigneeId || !grid.has(iv.assigneeId)) continue;
    if (iv.category === 'done' || iv.category === 'approved' || iv.category === 'review') continue;
    const end = iv.exitedAt ?? now;
    const row = grid.get(iv.assigneeId)!;
    dayStarts.forEach((ds, idx) => {
      const de = addDays(ds, 1);
      if (iv.enteredAt < de && end > ds) row[idx].add(iv.itemId);
    });
  }
  return {
    days: keys,
    rows: userIds.map(u => ({ userId: u, counts: grid.get(u)!.map(s => s.size) })),
  };
}

export type StuckItem = { itemId: string; status: string; category: StatusCategory; since: Date; businessHours: number; limitHours: number };

export function stuckItems(
  openIntervals: IntervalLite[],
  limits: Partial<Record<StatusCategory, number>>,
  now: Date,
  cal: WorkCalendar = DEFAULT_CALENDAR,
): StuckItem[] {
  const out: StuckItem[] = [];
  for (const iv of openIntervals) {
    if (iv.exitedAt) continue;
    const limit = limits[iv.category];
    if (!limit) continue;
    const hours = businessMinutesBetween(iv.enteredAt, now, cal) / 60;
    if (hours > limit) out.push({ itemId: iv.itemId, status: iv.status, category: iv.category, since: iv.enteredAt, businessHours: hours, limitHours: limit });
  }
  return out.sort((a, b) => b.businessHours / b.limitHours - a.businessHours / a.limitHours);
}

/** How many items reached each lifecycle stage. */
export function stageFunnel(items: ItemLite[]) {
  const c = (f: (i: ItemLite) => unknown) => items.filter(f).length;
  return [
    { stage: 'Received', count: items.length },
    { stage: 'Assigned', count: c(i => i.assignedAt || i.assigneeId) },
    { stage: 'Started', count: c(i => i.firstStartedAt) },
    { stage: 'Submitted', count: c(i => i.lastSubmittedAt) },
    { stage: 'Reviewed', count: c(i => i.firstReviewAt) },
    { stage: 'Approved', count: c(i => i.approvedAt) },
    { stage: 'Completed', count: c(i => i.completedAt) },
  ];
}
