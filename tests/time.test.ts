import { describe, expect, it } from 'vitest';
import { businessMinutesBetween, dayKey, DEFAULT_CALENDAR, dueDateToInstant, formatDuration, normalizeDate, zonedToUtc } from '@/lib/time';

// 2026-11-02 is a Monday. IST = UTC+5:30, working hours 10:00–19:00, Mon–Sat.
const ist = (d: number, h: number, m = 0) => zonedToUtc(2026, 11, d, h, m, 'Asia/Kolkata');

describe('business minutes', () => {
  it('counts a full working day', () => {
    expect(businessMinutesBetween(ist(2, 10), ist(2, 19))).toBe(540);
  });

  it('ignores time outside working hours', () => {
    expect(businessMinutesBetween(ist(2, 8), ist(2, 11))).toBe(60);
    expect(businessMinutesBetween(ist(2, 18), ist(3, 11))).toBe(120);
  });

  it('skips Sunday but counts Saturday', () => {
    // Sat 7th 18:00 → Mon 9th 11:00 = 1h Sat + 0 Sun + 1h Mon
    expect(businessMinutesBetween(ist(7, 18), ist(9, 11))).toBe(120);
  });

  it('skips holidays', () => {
    const cal = { ...DEFAULT_CALENDAR, holidays: new Set(['2026-11-03']) };
    expect(businessMinutesBetween(ist(2, 10), ist(4, 19), cal)).toBe(1080);
  });

  it('returns 0 for reversed ranges', () => {
    expect(businessMinutesBetween(ist(3, 10), ist(2, 10))).toBe(0);
  });
});

describe('dates', () => {
  it('normalizes sheet date formats', () => {
    expect(normalizeDate('2026-09-09')).toBe('2026-09-09');
    expect(normalizeDate('9/9/2026')).toBe('2026-09-09');
    expect(normalizeDate('25/12/2026')).toBe('2026-12-25');
    expect(normalizeDate('09-Sep-2026')).toBe('2026-09-09');
    expect(normalizeDate('46274')).toBe('2026-09-09');
    expect(normalizeDate('')).toBe('');
    expect(normalizeDate('soon')).toBe('');
  });

  it('keeps due dates on the same local day', () => {
    const due = dueDateToInstant('2026-09-09')!;
    expect(dayKey(due)).toBe('2026-09-09');
  });

  it('formats durations', () => {
    expect(formatDuration(35)).toBe('35m');
    expect(formatDuration(260)).toBe('4h 20m');
    expect(formatDuration(60 * 27)).toBe('1d 3h');
    expect(formatDuration(null)).toBe('—');
  });
});
