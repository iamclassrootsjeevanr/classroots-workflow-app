import { describe, expect, it } from 'vitest';
import { rollupCases, versionOptions, type CaseItem } from '@/lib/test-cases';

const item = (id: string, group: string, caseId: string, status: string, data: Record<string, unknown> = {}): CaseItem => ({
  id,
  groupKey: group,
  title: `Feature ${caseId}`,
  status,
  statusLabel: status.toUpperCase(),
  statusColor: '#000',
  data: { testCaseId: caseId, ...data },
});

const items = [
  item('a1', 'v1', 'TC_10', 'pass', { scenario: 'old scenario', apkUrl: 'https://x/v1', releaseDate: '2026-10-01' }),
  item('a2', 'v1', 'TC_2', 'fail', { scenario: 'two' }),
  item('b1', 'v2', 'TC_10', 'not_tested', { apkUrl: 'https://x/v2' }),
];

describe('rollupCases', () => {
  const rows = rollupCases(items);
  it('has one row per case id in natural order', () => {
    expect(rows.map(r => r.id)).toEqual(['TC_2', 'TC_10']);
  });
  it('lists versions oldest first and takes the result from the newest', () => {
    const r = rows.find(x => x.id === 'TC_10')!;
    expect(r.versions).toEqual(['v1', 'v2']);
    expect(r.latestVersion).toBe('v2');
    expect(r.latestStatus).toBe('NOT_TESTED');
    expect(r.latestItemId).toBe('b1');
  });
  it('keeps a definition filled in only in an older version', () => {
    expect(rows.find(x => x.id === 'TC_10')!.scenario).toBe('old scenario');
  });
});

describe('versionOptions', () => {
  it('returns versions oldest first with link, date and cases', () => {
    const v = versionOptions(items);
    expect(v.map(x => x.name)).toEqual(['v1', 'v2']);
    expect(v[0]).toMatchObject({ apkUrl: 'https://x/v1', releaseDate: '2026-10-01' });
    expect(v[0].cases.map(c => c.id)).toEqual(['TC_10', 'TC_2']);
  });
});
