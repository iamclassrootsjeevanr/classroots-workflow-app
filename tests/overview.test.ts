import { describe, expect, it } from 'vitest';
import { compareWithTeam, type ItemLite } from '@/lib/analytics-core';
import { workTypeTabs } from '@/lib/work-type-tabs';
import { apkTesting } from '@/modules/apk-testing/definition';
import { journeyApplet } from '@/modules/journey-applet/definition';

const now = new Date('2026-11-02T10:00:00Z');
const day = (n: number) => new Date(now.getTime() - n * 86400000);
const item = (id: string, who: string, doneDaysAgo: number | null): ItemLite => ({
  id,
  workTypeKey: 'x',
  externalKey: id,
  title: id,
  status: 'pass',
  category: doneDaysAgo == null ? 'active' : 'done',
  assigneeId: who,
  ownerId: null,
  dueAt: null,
  receivedAt: day(20),
  assignedAt: day(19),
  firstStartedAt: day(18),
  lastSubmittedAt: null,
  firstReviewAt: null,
  approvedAt: null,
  completedAt: doneDaysAgo == null ? null : day(doneDaysAgo),
  reviewRounds: 0,
  reopenCount: 0,
});

describe('compareWithTeam', () => {
  const all = [item('a', 'me', 2), item('b', 'me', 3), item('c', 'bo', 4), item('d', 'cy', 40), item('e', 'bo', null)];
  const rows = compareWithTeam(all.filter(i => i.assigneeId === 'me'), all, now);
  it('counts my finished items against the per-person team average', () => {
    const done = rows.find(r => r.label === 'Done in 30 days')!;
    expect(done.me).toBe(2);
    // 3 finished in 30 days by 2 people who finished something = 1.5 each
    expect(done.team).toBe(1.5);
  });
  it('returns only numbers, no item or person data', () => {
    expect(JSON.stringify(rows)).not.toMatch(/bo|cy|externalKey/);
    expect(rows.every(r => r.me === null || typeof r.me === 'number')).toBe(true);
  });
});

describe('workTypeTabs', () => {
  it('gives APK Testing its four pages with their own icons', () => {
    const tabs = workTypeTabs(apkTesting);
    expect(tabs.map(t => t.label)).toEqual(['Overview', 'APK versions', 'Test execution', 'Test cases']);
    expect(new Set(tabs.map(t => t.icon)).size).toBe(4);
  });
  it('gives Journey Overview and Journey chapters only', () => {
    expect(workTypeTabs(journeyApplet).map(t => t.label)).toEqual(['Overview', 'Journey chapters']);
  });
  it('uses different sidebar icons per work type', () => {
    expect(apkTesting.icon).toBeDefined();
    expect(apkTesting.icon).not.toBe(journeyApplet.icon);
  });
});

describe('clickable analytics', () => {
  it('builds item-list links with comma lists', async () => {
    const { itemsUrl, inList } = await import('@/lib/items-url');
    expect(itemsUrl('apk-testing')).toBe('/w/apk-testing/items');
    expect(itemsUrl('apk-testing', { group: 'v1', status: ['pass', 'fixed'] })).toBe('/w/apk-testing/items?group=v1&status=pass%2Cfixed');
    expect(inList('fixed', 'pass,fixed')).toBe(true);
    expect(inList('fail', 'pass,fixed')).toBe(false);
    expect(inList('fail', undefined)).toBe(true);
  });
  it('every module chart series maps to real statuses, so segments can open the list', async () => {
    const { allModules } = await import('@/modules/registry');
    for (const mod of allModules()) {
      const gs = mod.groupSummary;
      if (!gs) continue;
      for (const label of Object.keys(gs.seriesColors ?? {})) {
        const statuses = gs.seriesStatuses?.[label];
        expect(statuses?.length, `${mod.key}: series "${label}" needs seriesStatuses`).toBeGreaterThan(0);
        for (const st of statuses!) expect(mod.statuses.some(s => s.key === st), `${mod.key}: unknown status ${st}`).toBe(true);
      }
    }
  });
});
