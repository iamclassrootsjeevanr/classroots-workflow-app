/** Journey rules from the SME tracker: journey keys, Creation stage, Days taken and Closure due. Pure: dates are 'YYYY-MM-DD' strings. */
import { matchOption } from './text';
import type { WorkCalendar } from './time';

/** The relay (buildjourneyrelay) uses the same steps; "Published" = published in UAT. */
export const CREATION_STAGES = ['3a · Spine', '3b · Script', '4 · Build', '5 · Ship', 'Published'] as const;

const stageName = (option: string) => option.replace(/^\d+[ab]?\s*·\s*/i, '');

/** The Creation stage meant by `input`: "4 Build", "4 · Build" and "build" all mean "4 · Build". */
export function creationStageFor(input: unknown): (typeof CREATION_STAGES)[number] | undefined {
  if (typeof input !== 'string') return undefined;
  return (matchOption(CREATION_STAGES, input) ?? CREATION_STAGES.find(o => matchOption([stageName(o)], input))) as (typeof CREATION_STAGES)[number] | undefined;
}

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

/**
 * The tracker's Days taken with half days (SME, 5 Nov 2026): working days from picked up to submitted, both counted, where the
 * pick-up day counts 0.5 if picked up in its second half and the submit day 0.5 if submitted in its first half. Null like
 * `workingDaysInclusive`. A same-day journey is never less than half a day.
 */
export function daysTaken(
  pickedUp: unknown,
  submitted: unknown,
  halves: { pickedUp?: unknown; submitted?: unknown },
  cal: Pick<WorkCalendar, 'workDays' | 'holidays'>,
): number | null {
  const full = workingDaysInclusive(pickedUp, submitted, cal);
  if (full == null || full === 0) return full;
  let days = full;
  if (halves.pickedUp === 'Second half' && isWorkDay(parseDay(pickedUp)!, cal)) days -= 0.5;
  if (halves.submitted === 'First half' && isWorkDay(parseDay(submitted)!, cal)) days -= 0.5;
  return Math.max(days, 0.5);
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

export type JourneyKey = { grade: number; chapter: string; subtopic: string; journey: number; /** Grades 7 and 8 name a book part: G07P1C03ST2J1. */ part?: number };

/**
 * GxxCxxSTnJn (grades 7-8: GxxPnCxxSTnJn) → grade, chapter (GxxCxx / GxxPnCxx), subtopic (STn) and journey number.
 * The relay may append a `_slug` (G04C05ST1J1_halves); it is ignored. Anything else (uuid, `sim:` keys) is not a journey key.
 */
export function parseJourneyKey(key: string): JourneyKey | null {
  const m = key.trim().match(/^G(\d{2})(?:P(\d))?C(\d{2})ST(\d+)J(\d+)(?:_[\w-]+)?$/i);
  if (!m) return null;
  const [, grade, part, chapter, subtopic, journey] = m;
  return { grade: Number(grade), chapter: `G${grade}${part ? `P${part}` : ''}C${chapter}`, subtopic: `ST${subtopic}`, journey: Number(journey), ...(part ? { part: Number(part) } : {}) };
}

/** The key without a `_slug`, upper-cased: G04C05ST1J1_halves → G04C05ST1J1. Null when it is not a journey key. */
export function journeyKeyOf(raw: string): string | null {
  const k = parseJourneyKey(raw);
  return k ? `${k.chapter}${k.subtopic}J${k.journey}` : null;
}

/** The tracker's Journey cell "G04C05ST1J1 · halves" → key and name (the name is the key when absent). */
export function splitJourneyCell(cell: string): { key: string; name: string } {
  const [key, ...rest] = cell.split('·').map(s => s.trim());
  const name = rest.join(' · ').trim();
  return { key: key.toUpperCase(), name: name || key.toUpperCase() };
}
