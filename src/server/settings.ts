import { DEFAULT_CALENDAR, type WorkCalendar } from '@/lib/time';
import { db } from './db';
import { env } from './env';

type CalendarSetting = { workDays?: number[]; startHour?: number; endHour?: number };

/** Working calendar used for business-hour durations: AppSetting "calendar" + Holiday table. */
export async function workCalendar(): Promise<WorkCalendar> {
  const [setting, holidays] = await Promise.all([
    db.appSetting.findUnique({ where: { key: 'calendar' } }),
    db.holiday.findMany({ select: { date: true } }),
  ]);
  const v = (setting?.value ?? {}) as CalendarSetting;
  return {
    tz: env().APP_TIMEZONE,
    workDays: v.workDays ?? DEFAULT_CALENDAR.workDays,
    startHour: v.startHour ?? DEFAULT_CALENDAR.startHour,
    endHour: v.endHour ?? DEFAULT_CALENDAR.endHour,
    holidays: new Set(holidays.map(h => h.date.toISOString().slice(0, 10))),
  };
}

export const appTz = () => env().APP_TIMEZONE;
