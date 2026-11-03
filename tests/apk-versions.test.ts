import { describe, expect, it } from 'vitest';
import { planVersionTests, type SourceTest } from '@/lib/apk-versions';
import { apkTesting } from '@/modules/apk-testing/definition';

const source: SourceTest[] = [
  { testCaseId: 'TC-01', title: 'Login', data: { testCaseId: 'TC-01', scenario: 'Sign in', expected: 'Home', steps: '1. Open', priority: 'High', bug: 'crash', comments: 'x', developerRemarks: 'fixed', logDate: '2026-10-01', apkUrl: 'https://old' } },
  { testCaseId: 'TC-02', title: 'Home', data: { testCaseId: 'TC-02', scenario: 'Open home' } },
];
const base = { version: 'v2.0', apkUrl: 'https://x.test/a.apk', releaseDate: '2026-11-02', releaseNotes: 'New', includeCaseIds: ['TC-01', 'TC-02'], extraCases: [], assigneeId: 'u1' };

describe('planVersionTests', () => {
  it('copies case definitions, clears results and stamps version info', () => {
    const [a] = planVersionTests(source, base);
    expect(a.externalKey).toBe('v2.0 | TC-01');
    expect(a.groupKey).toBe('v2.0');
    expect(a.assigneeId).toBe('u1');
    expect(a.data).toEqual({ testCaseId: 'TC-01', scenario: 'Sign in', expected: 'Home', steps: '1. Open', priority: 'High', releaseDate: '2026-11-02', apkUrl: 'https://x.test/a.apk', releaseNotes: 'New' });
  });
  it('copies only the ticked cases and appends extra cases', () => {
    const out = planVersionTests(source, { ...base, includeCaseIds: ['TC-02'], extraCases: [{ testCaseId: 'TC-09', title: 'Share', scenario: 'Tap share' }] });
    expect(out.map(o => o.externalKey)).toEqual(['v2.0 | TC-02', 'v2.0 | TC-09']);
    expect(out[1].data.scenario).toBe('Tap share');
  });
  it('rejects bad input', () => {
    expect(() => planVersionTests(source, { ...base, version: ' ' })).toThrow(/version is required/);
    expect(() => planVersionTests(source, { ...base, version: 'a|b' })).toThrow(/\|/);
    expect(() => planVersionTests(source, { ...base, apkUrl: 'ftp://x' })).toThrow(/http/);
    expect(() => planVersionTests(source, { ...base, releaseDate: 'soon' })).toThrow(/date/);
    expect(() => planVersionTests(source, { ...base, includeCaseIds: ['TC-77'] })).toThrow(/not in the version/);
    expect(() => planVersionTests(source, { ...base, extraCases: [{ testCaseId: 'TC-01', title: 'dup' }] })).toThrow(/twice/);
    expect(() => planVersionTests(source, { ...base, includeCaseIds: [] })).toThrow(/at least one/);
  });
  it('produces data the APK module accepts, in test-case order', () => {
    const out = planVersionTests(source, base);
    for (const o of out) apkTesting.dataSchema.parse(o.data);
    expect(apkTesting.sortOrder?.(out[1].data)).toBe(2);
  });
  it('leaves owner, expected and delay out of the APK list', () => {
    expect(apkTesting.table?.hide).toEqual(['owner', 'expected', 'delay']);
    expect(apkTesting.table?.extra?.map(e => e.field)).toContain('developerRemarks');
  });
});
