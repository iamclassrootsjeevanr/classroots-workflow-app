import { describe, expect, it } from 'vitest';
import { planVersionTests, type SourceTest } from '@/lib/apk-versions';
import { versionCloseBlocker, versionStatus } from '@/lib/apk-rollup';
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
  it('leaves owner, expected and delay out of the version list and of its test results', () => {
    expect(apkTesting.table?.hide).toEqual(['owner', 'expected', 'delay']);
    expect(apkTesting.runTable?.hide).toEqual(['owner', 'expected', 'delay']);
    expect(apkTesting.runTable?.extra?.map(e => e.field)).toContain('developerRemarks');
  });
  it('lists an APK version with its results rolled up', () => {
    expect(apkTesting.table?.extra?.map(e => e.field)).toEqual(expect.arrayContaining(['testsTotal', 'testsPass', 'testsFail', 'passRate']));
  });
});

describe('versionStatus', () => {
  it('is Not Tested until a result moves', () => {
    expect(versionStatus([])).toBe('not_tested');
    expect(versionStatus(['not_tested', 'not_tested'])).toBe('not_tested');
  });
  it('is In Process while some are untested or running and none failed', () => {
    expect(versionStatus(['pass', 'not_tested'])).toBe('in_process');
    expect(versionStatus(['in_process', 'not_tested'])).toBe('in_process');
  });
  it('has failures as long as one result fails, whatever else is going on', () => {
    expect(versionStatus(['pass', 'fail', 'not_tested', 'pending_retest'])).toBe('fail');
  });
  it('waits for retest once every failure is fixed', () => {
    expect(versionStatus(['pass', 'fixed', 'pass'])).toBe('pending_retest');
    expect(versionStatus(['pass', 'pending_retest'])).toBe('pending_retest');
  });
  it('passes when every result passed or was not reported', () => {
    expect(versionStatus(['pass', 'pass'])).toBe('pass');
    expect(versionStatus(['pass', 'not_reported'])).toBe('pass');
    expect(versionStatus(['not_reported'])).toBe('not_reported');
  });
  it('only uses statuses the module has', () => {
    const keys = new Set(apkTesting.statuses.map(s => s.key));
    for (const set of [[], ['pass'], ['fail'], ['fixed'], ['in_process'], ['not_reported']]) expect(keys.has(versionStatus(set))).toBe(true);
  });
});

describe('closing a version', () => {
  it('warns when tests are not updated, without blocking', () => {
    expect(versionCloseBlocker(['pass', 'fail', 'fixed'])).toBeNull();
    expect(versionCloseBlocker(['pass', 'not_tested'])).toMatch(/1 test is not updated/);
    expect(versionCloseBlocker(['in_process', 'not_tested'])).toMatch(/2 tests are not updated/);
  });
  it('has a Closed status that counts as done', () => {
    expect(apkTesting.statuses.find(s => s.key === 'closed')?.category).toBe('done');
  });
});
