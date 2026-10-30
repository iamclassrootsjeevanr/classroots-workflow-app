/** Date/time helpers. Everything is stored in UTC and shown in the team's time zone. */

export const DEFAULT_TZ = 'Asia/Kolkata';

export type WorkCalendar = {
  tz: string;
  /** 0 = Sunday … 6 = Saturday */
  workDays: number[];
  startHour: number;
  endHour: number;
  /** 'YYYY-MM-DD' local dates */
  holidays: Set<string>;
};

export const DEFAULT_CALENDAR: WorkCalendar = {
  tz: DEFAULT_TZ,
  workDays: [1, 2, 3, 4, 5, 6],
  startHour: 10,
  endHour: 19,
  holidays: new Set(),
};

const partsCache = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(tz: string) {
  let f = partsCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    });
    partsCache.set(tz, f);
  }
  return f;
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function zonedParts(date: Date, tz = DEFAULT_TZ) {
  const out: Record<string, string> = {};
  for (const p of partsFormatter(tz).formatToParts(date)) out[p.type] = p.value;
  return {
    year: +out.year,
    month: +out.month,
    day: +out.day,
    hour: +out.hour,
    minute: +out.minute,
    second: +out.second,
    weekday: WEEKDAYS[out.weekday] ?? 0,
  };
}

/** Offset of `tz` from UTC at `date`, in minutes (IST = +330). */
export function tzOffsetMinutes(date: Date, tz = DEFAULT_TZ): number {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/** The UTC instant of local wall-clock time y-m-d h:min in `tz`. */
export function zonedToUtc(y: number, m: number, d: number, h = 0, min = 0, tz = DEFAULT_TZ): Date {
  const guess = new Date(Date.UTC(y, m - 1, d, h, min));
  const off = tzOffsetMinutes(guess, tz);
  const result = new Date(guess.getTime() - off * 60000);
  const off2 = tzOffsetMinutes(result, tz);
  return off2 === off ? result : new Date(guess.getTime() - off2 * 60000);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar day 'YYYY-MM-DD' of an instant. */
export function dayKey(date: Date, tz = DEFAULT_TZ): string {
  const p = zonedParts(date, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Start of the local day (as UTC instant). */
export function startOfLocalDay(date: Date, tz = DEFAULT_TZ): Date {
  const p = zonedParts(date, tz);
  return zonedToUtc(p.year, p.month, p.day, 0, 0, tz);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000);
}

export function minutesBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
}

/** Minutes between two instants that fall inside working hours of the calendar. */
export function businessMinutesBetween(start: Date, end: Date, cal: WorkCalendar = DEFAULT_CALENDAR): number {
  if (end <= start) return 0;
  let total = 0;
  const first = zonedParts(start, cal.tz);
  let y = first.year;
  let m = first.month;
  let d = first.day;
  // Walk local days; bounded to avoid runaway loops on bad data (~5 years).
  for (let i = 0; i < 2000; i++) {
    const dayStart = zonedToUtc(y, m, d, 0, 0, cal.tz);
    if (dayStart >= end) break;
    const key = `${y}-${pad(m)}-${pad(d)}`;
    const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    if (cal.workDays.includes(weekday) && !cal.holidays.has(key)) {
      const ws = zonedToUtc(y, m, d, cal.startHour, 0, cal.tz);
      const we = zonedToUtc(y, m, d, cal.endHour, 0, cal.tz);
      const s = Math.max(ws.getTime(), start.getTime());
      const e = Math.min(we.getTime(), end.getTime());
      if (e > s) total += (e - s) / 60000;
    }
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    y = next.getUTCFullYear();
    m = next.getUTCMonth() + 1;
    d = next.getUTCDate();
  }
  return Math.round(total);
}

const dtFormatters = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string, kind: 'dt' | 'd' | 't') {
  const k = tz + kind;
  let f = dtFormatters.get(k);
  if (!f) {
    const opts: Intl.DateTimeFormatOptions =
      kind === 'd'
        ? { day: '2-digit', month: 'short', year: 'numeric' }
        : kind === 't'
          ? { hour: '2-digit', minute: '2-digit', hour12: true }
          : { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true };
    f = new Intl.DateTimeFormat('en-IN', { ...opts, timeZone: tz });
    dtFormatters.set(k, f);
  }
  return f;
}

export function formatDateTime(d: Date | string | null | undefined, tz = DEFAULT_TZ): string {
  if (!d) return '';
  return fmt(tz, 'dt').format(new Date(d));
}

export function formatDate(d: Date | string | null | undefined, tz = DEFAULT_TZ): string {
  if (!d) return '';
  return fmt(tz, 'd').format(new Date(d));
}

export function formatTime(d: Date | string | null | undefined, tz = DEFAULT_TZ): string {
  if (!d) return '';
  return fmt(tz, 't').format(new Date(d));
}

/** 2d 3h · 4h 20m · 35m */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes)) return '—';
  const m = Math.round(minutes);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d}d ${h % 24}h` : `${d}d`;
}

/** Parse loose sheet dates: ISO, 9-Sep-2026, 09/09/2026 (day first), Excel serials. Returns 'YYYY-MM-DD' or ''. */
export function normalizeDate(value: unknown): string {
  if (value == null || value === '') return '';
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  if (!s) return '';
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
  const months: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  m = s.match(/^(\d{1,2})[\s-]([A-Za-z]{3})[A-Za-z]*[\s-,]+(\d{4})$/);
  if (m && months[m[2].toLowerCase()]) return `${m[3]}-${pad(months[m[2].toLowerCase()])}-${pad(+m[1])}`;
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const serial = Math.floor(+s);
    return new Date(Date.UTC(1899, 11, 30) + serial * 86400000).toISOString().slice(0, 10);
  }
  return '';
}

/** 'YYYY-MM-DD' → end of that local day (used for due dates). */
export function dueDateToInstant(ymd: string, tz = DEFAULT_TZ): Date | null {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return zonedToUtc(+m[1], +m[2], +m[3], 23, 59, tz);
}

/** 'YYYY-MM-DD' → start (or end) of that local day, for date-range filters. */
export function localDayBoundary(ymd: string | null | undefined, end = false, tz = DEFAULT_TZ): Date | undefined {
  const m = ymd?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return undefined;
  const start = zonedToUtc(+m[1], +m[2], +m[3], 0, 0, tz);
  return end ? new Date(start.getTime() + 86400000 - 1) : start;
}

/** Date-only value stored as instant → 'YYYY-MM-DD' in local tz. */
export function instantToDateKey(d: Date | null | undefined, tz = DEFAULT_TZ): string {
  return d ? dayKey(d, tz) : '';
}
