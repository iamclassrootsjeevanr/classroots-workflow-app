import { describe, expect, it } from 'vitest';
import { apkTesting, apkVersionResult } from '@/modules/apk-testing/definition';
import { journeyApplet } from '@/modules/journey-applet/definition';
import { groupRollup, groupSeries, type GroupableItem } from '@/lib/groups';
import { rowKey } from '@/lib/sheet-core';

const item = (groupKey: string, status: string, data: Record<string, unknown> = {}): GroupableItem => ({
  groupKey,
  status,
  category: apkTesting.statuses.find(s => s.key === status)!.category,
  data,
  assigneeId: 'u1',
});

describe('APK version result rules', () => {
  it('follows the tracker thresholds', () => {
    expect(apkVersionResult({ total: 0, pass: 0, fail: 0, notTested: 0, inProgress: 0 }).label).toBe('No tests');
    expect(apkVersionResult({ total: 20, pass: 0, fail: 0, notTested: 20, inProgress: 0 }).label).toBe('Not started');
    expect(apkVersionResult({ total: 20, pass: 20, fail: 0, notTested: 0, inProgress: 0 }).label).toBe('All passed');
    expect(apkVersionResult({ total: 20, pass: 19, fail: 1, notTested: 0, inProgress: 0 }).label).toBe('Stable');
    expect(apkVersionResult({ total: 20, pass: 17, fail: 2, notTested: 0, inProgress: 0 }).label).toBe('Good');
    expect(apkVersionResult({ total: 16, pass: 2, fail: 7, notTested: 7, inProgress: 0 }).label).toBe('Has failures');
    expect(apkVersionResult({ total: 20, pass: 10, fail: 0, notTested: 5, inProgress: 5 }).label).toBe('In progress');
  });
});

describe('group rollup', () => {
  const items = [
    item('2.0.1.14_2026-10-26', 'pass', { releaseDate: '2026-10-26' }),
    item('2.0.1.14_2026-10-26', 'pass'),
    item('2.0.1.14_2026-10-26', 'not_tested'),
    item('2.0.1.14_2026-09-04', 'fail'),
    item('2.0.1.14_2026-09-04', 'pending_retest'),
    item('2.0.1.14_2026-09-04', 'fixed'),
    item('2.0.1.14_2026-09-04', 'not_reported'),
  ];

  it('computes one row per APK version in version order', () => {
    const rows = groupRollup(apkTesting, items);
    expect(rows.map(r => r.group)).toEqual(['2.0.1.14_2026-09-04', '2.0.1.14_2026-10-26']);
    expect(rows[1].cells).toMatchObject({ total: 3, pass: 2, notTested: 1, passRate: '66.7%', releaseDate: '2026-10-26' });
    expect(rows[1].result?.label).toBe('In progress');
    expect(rows[0].cells).toMatchObject({ fail: 1, pendingRetest: 2, other: 1, passRate: '0%' });
    expect(rows[0].result?.label).toBe('Has failures');
  });

  it('builds stacked-bar series with module colours', () => {
    const rows = groupRollup(apkTesting, items);
    const chart = groupSeries(apkTesting, rows);
    expect(chart.rows[1]).toMatchObject({ name: '2.0.1.14_2026-10-26', Pass: 2, 'Not tested': 1 });
    expect(chart.series.find(s => s.label === 'Pass')?.color).toBe('#43a047');
  });

  it('is empty for work types without a group summary', () => {
    expect(groupRollup(journeyApplet, items)).toEqual([]);
  });
});

describe('composite sheet keys', () => {
  it('joins the key columns and rejects incomplete rows', () => {
    expect(rowKey(apkTesting, { 'APK Version': ' 2.0.1.14_2026-10-27 ', 'Test Case ID': 'TC_019' })).toBe('2.0.1.14_2026-10-27 | TC_019');
    expect(rowKey(apkTesting, { 'APK Version': '2.0.1.14_2026-10-27', 'Test Case ID': '' })).toBe('');
    expect(rowKey(journeyApplet, { GxxCxxJxx: 'G07C04J01' })).toBe('G07C04J01');
  });
});
