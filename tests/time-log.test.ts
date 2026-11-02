import { describe, expect, it } from 'vitest';
import { buildTimeLog, timeLogTotals, type LogEvent, type LogInterval } from '@/lib/time-log';
import type { StatusCategory } from '@/modules/types';

const t = (h: number) => new Date(Date.UTC(2026, 10, 2, h));
const cat: Record<string, StatusCategory> = { not_tested: 'queue', in_process: 'active', fail: 'feedback', fixed: 'review', pass: 'done' };
const look = { label: (s: string) => s.toUpperCase(), category: (s: string) => cat[s], fieldLabel: (f: string) => (f === 'bug' ? 'Bug / issue' : f) };
const ev = (id: string, at: Date, type: string, o: Partial<LogEvent> = {}): LogEvent => ({ id, at, type, field: null, fromValue: null, toValue: null, note: null, who: 'Asha', ...o });

const intervals: LogInterval[] = [
  { status: 'not_tested', enteredAt: t(1), exitedAt: t(3), businessMinutes: 120 },
  { status: 'fail', enteredAt: t(3), exitedAt: t(6), businessMinutes: 180 },
  { status: 'fixed', enteredAt: t(6), exitedAt: t(8), businessMinutes: 90 },
  { status: 'pass', enteredAt: t(8), exitedAt: null, businessMinutes: 10 },
];
const events = [
  ev('4', t(6), 'STATUS_CHANGED', { fromValue: 'fail', toValue: 'fixed', who: 'Dev' }),
  ev('1', t(1), 'CREATED', { toValue: 'not_tested' }),
  ev('2', t(3), 'STATUS_CHANGED', { fromValue: 'not_tested', toValue: 'fail' }),
  ev('3', t(3), 'FIELD_CHANGED', { field: 'bug', toValue: 'Crashes on login' }),
  ev('5', t(6), 'FIELD_CHANGED', { field: 'developerRemarks', fromValue: 'a', toValue: 'b', who: 'Dev' }),
];

describe('buildTimeLog', () => {
  const log = buildTimeLog(events, intervals, look);
  it('orders oldest first and labels each change', () => {
    expect(log.map(e => e.id)).toEqual(['1', '2', '3', '4', '5']);
    expect(log[0].text).toBe('Created as NOT_TESTED');
    expect(log[1].text).toBe('NOT_TESTED → FAIL');
  });
  it('shows time spent in the status that was left', () => {
    expect(log[1].spent).toBe(120);
    expect(log[3].spent).toBe(180);
    expect(log[0].spent).toBeNull();
  });
  it('tags bug and remark edits', () => {
    expect(log[2]).toMatchObject({ kind: 'bug', text: 'Added bug / issue', detail: 'Crashes on login' });
    expect(log[4]).toMatchObject({ kind: 'remarks', text: 'Edited developerremarks' });
  });
});

describe('timeLogTotals', () => {
  it('sums waiting time and counts failures', () => {
    expect(timeLogTotals(intervals, look.category)).toEqual({ toFirstResult: 120, waitingForFix: 180, waitingForRetest: 90, failures: 1 });
  });
  it('has no first result for an untested item', () => {
    expect(timeLogTotals([intervals[0]], look.category).toFirstResult).toBeNull();
  });
});
