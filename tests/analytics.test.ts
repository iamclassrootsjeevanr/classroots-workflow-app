import { describe, expect, it } from 'vitest';
import {
  delayDays,
  flowTimes,
  kpis,
  loadLevel,
  qualityRates,
  reviewAndCorrection,
  reviewRoundDistribution,
  summarize,
  workloadByUser,
  workloadHeatmap,
  type IntervalLite,
  type ItemLite,
} from '@/lib/analytics-core';
import { zonedToUtc } from '@/lib/time';

const ist = (d: number, h: number) => zonedToUtc(2026, 11, d, h, 0, 'Asia/Kolkata');

function item(over: Partial<ItemLite>): ItemLite {
  return {
    id: 'x',
    workTypeKey: 'journey-applet',
    externalKey: 'K',
    title: 'T',
    status: 'in_progress',
    category: 'active',
    assigneeId: 'u1',
    ownerId: null,
    dueAt: null,
    receivedAt: ist(2, 10),
    assignedAt: ist(2, 10),
    firstStartedAt: null,
    lastSubmittedAt: null,
    firstReviewAt: null,
    approvedAt: null,
    completedAt: null,
    reviewRounds: 0,
    reopenCount: 0,
    ...over,
  };
}

describe('summaries', () => {
  it('computes avg, median and p90', () => {
    const s = summarize([10, 20, 30, 40, 100]);
    expect(s.avg).toBe(40);
    expect(s.median).toBe(30);
    expect(s.p90).toBeCloseTo(76);
    expect(summarize([]).avg).toBeNull();
  });
});

describe('flow times (business hours)', () => {
  it('measures wait, cycle and lead time', () => {
    const it1 = item({ firstStartedAt: ist(2, 12), lastSubmittedAt: ist(3, 12), reviewRounds: 1, completedAt: ist(4, 12), category: 'done', status: 'done' });
    const f = flowTimes([it1]);
    expect(f.waitBeforeStart.avg).toBe(120);
    expect(f.cycleTime.avg).toBe(540 * 2);
    expect(f.leadTime.avg).toBe(540 * 2 + 120);
    expect(f.timeToFirstSubmit.avg).toBe(540);
  });
});

describe('review and corrections', () => {
  it('merges ready→in review into one turnaround and measures corrections', () => {
    const ivs: IntervalLite[] = [
      { itemId: 'a', status: 'ready_for_review', category: 'review', assigneeId: 'u1', enteredAt: ist(2, 10), exitedAt: ist(2, 12), round: 1 },
      { itemId: 'a', status: 'in_review', category: 'review', assigneeId: 'u1', enteredAt: ist(2, 12), exitedAt: ist(2, 13), round: 1 },
      { itemId: 'a', status: 'corrections', category: 'feedback', assigneeId: 'u1', enteredAt: ist(2, 13), exitedAt: ist(2, 17), round: 1 },
    ];
    const r = reviewAndCorrection(ivs);
    expect(r.reviewTurnaround.avg).toBe(180);
    expect(r.correctionTime.avg).toBe(240);
  });
});

describe('quality and delay', () => {
  it('computes first-pass and on-time rates', () => {
    const a = item({ approvedAt: ist(3, 10), completedAt: ist(3, 11), reviewRounds: 1, dueAt: ist(4, 10), category: 'done' });
    const b = item({ approvedAt: ist(5, 10), completedAt: ist(6, 11), reviewRounds: 2, dueAt: ist(4, 10), category: 'done' });
    const q = qualityRates([a, b]);
    expect(q.firstPassRate).toBe(0.5);
    expect(q.onTimeRate).toBe(0.5);
    expect(reviewRoundDistribution([a, b])).toEqual([{ rounds: 1, count: 1 }, { rounds: 2, count: 1 }]);
    expect(delayDays(b, new Date())).toBe(2);
  });

  it('counts KPIs', () => {
    const now = ist(10, 12);
    const k = kpis(
      [
        item({ assigneeId: null, category: 'queue', status: 'received' }),
        item({ dueAt: ist(9, 10) }),
        item({ category: 'review', status: 'ready_for_review', dueAt: ist(12, 10) }),
        item({ category: 'done', status: 'done', dueAt: ist(1, 10) }),
      ],
      now,
    );
    expect(k).toMatchObject({ total: 4, unassigned: 1, inProgress: 1, inReview: 1, done: 1, overdue: 1, dueThisWeek: 1 });
  });
});

describe('workload', () => {
  it('classifies load levels against capacity', () => {
    expect(loadLevel(0, 3)).toBe('idle');
    expect(loadLevel(1, 3)).toBe('low');
    expect(loadLevel(3, 3)).toBe('normal');
    expect(loadLevel(4, 3)).toBe('high');
    expect(loadLevel(5, 3)).toBe('overloaded');
  });

  it('sorts people with the most room first and ignores items waiting in review', () => {
    const items = [
      item({ assigneeId: 'u1' }),
      item({ assigneeId: 'u1' }),
      item({ assigneeId: 'u1', category: 'review' }),
      item({ assigneeId: 'u2', category: 'queue' }),
    ];
    const w = workloadByUser(items, [{ id: 'u1', name: 'A', capacity: 2 }, { id: 'u2', name: 'B', capacity: 3 }], ist(5, 10));
    expect(w.map(x => x.userId)).toEqual(['u2', 'u1']);
    expect(w[1]).toMatchObject({ open: 3, active: 2, inReview: 1, level: 'normal' });
  });

  it('rebuilds daily load from intervals', () => {
    const ivs: IntervalLite[] = [
      { itemId: 'a', status: 'in_progress', category: 'active', assigneeId: 'u1', enteredAt: ist(2, 10), exitedAt: ist(4, 10), round: 1 },
      { itemId: 'b', status: 'in_progress', category: 'active', assigneeId: 'u1', enteredAt: ist(3, 10), exitedAt: null, round: 1 },
      { itemId: 'c', status: 'ready_for_review', category: 'review', assigneeId: 'u1', enteredAt: ist(3, 10), exitedAt: null, round: 1 },
    ];
    const h = workloadHeatmap(ivs, ['u1'], 4, ist(5, 12));
    expect(h.days).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05']);
    expect(h.rows[0].counts).toEqual([1, 2, 2, 1]);
  });
});
