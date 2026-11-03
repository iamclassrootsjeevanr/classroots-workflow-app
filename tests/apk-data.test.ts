import { describe, expect, it } from 'vitest';
import { hydrateApkData, splitApkData, type ApkLink } from '@/lib/apk-data';

const link: ApkLink = {
  version: { id: 'v1', releaseDate: new Date('2026-10-27T00:00:00Z'), link: 'https://x/a.apk', notes: 'n' },
  testCase: { id: 'c1', scenario: 'S', expected: 'E', steps: null, defaultPriority: 'High' },
};

describe('apk data split / merge', () => {
  it('merges version and test case facts into the run data', () => {
    const d = hydrateApkData({ comments: 'ok', priority: 'Low' }, link);
    expect(d).toMatchObject({ comments: 'ok', priority: 'Low', releaseDate: '2026-10-27', apkUrl: 'https://x/a.apk', releaseNotes: 'n', scenario: 'S', expected: 'E', defaultPriority: 'High', _versionId: 'v1', _caseId: 'c1' });
    expect(d.steps).toBeUndefined();
  });
  it('leaves data alone when the run is not linked', () => {
    expect(hydrateApkData({ a: 1 }, null)).toEqual({ a: 1 });
  });
  it('splits a flat object: shared facts leave the run', () => {
    const s = splitApkData({ testCaseId: 'TC_1', comments: 'c', priority: 'High', scenario: 'S', steps: ' 1. open ', releaseDate: '2026-11-02', apkUrl: 'https://x', releaseNotes: 'new', _caseId: 'zz' });
    expect(s.execution).toEqual({ testCaseId: 'TC_1', comments: 'c', priority: 'High' });
    expect(s.version).toEqual({ releaseDate: '2026-11-02', link: 'https://x', notes: 'new' });
    expect(s.testCase).toEqual({ scenario: 'S', steps: '1. open', defaultPriority: 'High' });
  });
  it('round-trips', () => {
    const flat = { testCaseId: 'TC_1', comments: 'c', scenario: 'S', apkUrl: 'https://x' };
    const s = splitApkData(flat);
    expect(s.execution).toEqual({ testCaseId: 'TC_1', comments: 'c' });
  });
});
