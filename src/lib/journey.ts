/** Journey rules from the SME tracker: journey keys, Days taken and Closure due. Pure: dates are 'YYYY-MM-DD' strings. */
import type { WorkCalendar } from './time';

const DAY_MS = 86_400_000;
const MAX_DAYS = 3660;

const parseDay = (v: unknown): Date | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00Z`) : null);
const dayString = (d: Date) => d.toISOString().slice(0, 10);
const isWorkDay = (d: Date, cal: Pick<WorkCalendar, 'workDays' | 'holidays'>) => cal.workDays.includes(d.getUTCDay()) && !cal.holidays.has(dayString(d));

/** Working days from `from` to `to`, both days counted (the tracker's "Days taken"). Null when a date is missing or reversed. */
export function workingDaysInclusive(from: unknown, to: unknown, cal: Pick<WorkCalendar, 'workDays' | 'holidays'>): number | null {
  const a = parseDay(from);
  const b = parseDay(to);
  if (!a || !b || b < a) return null;
  let n = 0;
  for (let d = a, i = 0; d <= b && i < MAX_DAYS; d = new Date(d.getTime() + DAY_MS), i++) if (isWorkDay(d, cal)) n++;
  return n;
}

/** The date `days` working days after `from` (the tracker's "Closure due" = Review date + 1). */
export function addWorkingDays(from: unknown, days: number, cal: Pick<WorkCalendar, 'workDays' | 'holidays'>): string | null {
  let d = parseDay(from);
  if (!d) return null;
  for (let left = days, i = 0; left > 0 && i < MAX_DAYS; i++) {
    d = new Date(d.getTime() + DAY_MS);
    if (isWorkDay(d, cal)) left--;
  }
  return dayString(d);
}

export type JourneyKey = { grade: number; chapter: string; subtopic: string; journey: number };

/** GxxCxxSTnJn → grade, chapter (GxxCxx), subtopic (STn) and journey number. */
export function parseJourneyKey(key: string): JourneyKey | null {
  const m = key.trim().match(/^G(\d{2})C(\d{2})ST(\d+)J(\d+)$/i);
  return m ? { grade: Number(m[1]), chapter: `G${m[1]}C${m[2]}`, subtopic: `ST${m[3]}`, journey: Number(m[4]) } : null;
}

/** The tracker's Journey cell "G04C05ST1J1 · halves" → key and name (the name is the key when absent). */
export function splitJourneyCell(cell: string): { key: string; name: string } {
  const [key, ...rest] = cell.split('·').map(s => s.trim());
  const name = rest.join(' · ').trim();
  return { key: key.toUpperCase(), name: name || key.toUpperCase() };
}
