import { describe, expect, it } from 'vitest';
import { APK_DONE_METRICS } from '@/modules/apk-testing/definition';
import { doneTable, metricsFor } from '@/lib/work-done';

const person = (id: string, results: string[], work: string[] = [], fixes = 0) => ({
  id,
  name: id,
  input: { work: work.map(status => ({ status, category: status === 'closed' ? ('done' as const) : ('active' as const) })), results: results.map(status => ({ status })), fixes },
});

describe('work done', () => {
  const t = doneTable(APK_DONE_METRICS, [person('a', ['pass', 'pass', 'fail', 'not_tested'], ['closed']), person('b', ['pass', 'in_process'], ['closed', 'closed']), person('dev', [], [], 4)]);
  it('counts what each person did', () => {
    expect(t.people[0].values).toMatchObject({ versionsDone: 1, testsUpdated: 3, testsPassed: 2, bugsFound: 1, fixes: 0 });
    expect(t.people[1].values).toMatchObject({ testsUpdated: 1, testsPassed: 1 });
  });
  it('averages over the people who did some of it', () => {
    expect(t.team.testsUpdated).toBe(2);
    expect(t.team.fixes).toBe(4);
    expect(t.team.testsPassed).toBe(1.5);
  });
  it('shows each role its own columns, everything to leads and admins', () => {
    const keys = (caps: string[], admin = false) => metricsFor(APK_DONE_METRICS, new Set(caps), admin).map(m => m.key);
    expect(keys(['work'])).not.toContain('fixes');
    expect(keys(['review'])).toEqual(['fixes']);
    expect(keys(['assign'])).toHaveLength(APK_DONE_METRICS.length);
    expect(keys([], true)).toHaveLength(APK_DONE_METRICS.length);
  });
});
