import { businessMinutesBetween, formatDateTime, type WorkCalendar } from '@/lib/time';
import { flowTimes, kpis, qualityRates, reviewAndCorrection } from '@/lib/analytics-core';
import { workCalendar } from '../settings';
import { loadIntervals, loadItems, type Filters, type ItemRow } from './analytics';

const hours = (m: number | null | undefined) => (m == null ? '' : (m / 60).toFixed(1));
const pct = (x: number | null) => (x == null ? '' : `${Math.round(x * 100)}%`);

function span(a: Date | null, b: Date | null, cal: WorkCalendar) {
  return a && b ? hours(businessMinutesBetween(a, b, cal)) : '';
}

/** One row per item with every stage timestamp and business-hour duration. */
export function itemReportRows(items: ItemRow[], cal: WorkCalendar) {
  const tz = cal.tz;
  return items.map(i => ({
    'Work type': i.workTypeName,
    Key: i.externalKey,
    Title: i.title,
    Group: i.groupKey ?? '',
    Chapter: i.chapterTitle ?? '',
    SME: i.ownerName ?? '',
    Developer: i.assigneeName ?? '',
    Status: i.statusLabel,
    'Due date': formatDateTime(i.dueAt, tz),
    'Received at': formatDateTime(i.receivedAt, tz),
    'Assigned at': formatDateTime(i.assignedAt, tz),
    'Started at': formatDateTime(i.firstStartedAt, tz),
    'Last submitted at': formatDateTime(i.lastSubmittedAt, tz),
    'First review at': formatDateTime(i.firstReviewAt, tz),
    'Last feedback at': formatDateTime(i.lastFeedbackAt, tz),
    'Approved at': formatDateTime(i.approvedAt, tz),
    'Completed at': formatDateTime(i.completedAt, tz),
    'Wait before start (h)': span(i.assignedAt, i.firstStartedAt, cal),
    'Cycle time (h)': span(i.firstStartedAt, i.completedAt, cal),
    'Lead time (h)': span(i.receivedAt, i.completedAt, cal),
    'Review rounds': i.reviewRounds,
    'Feedback count': i.feedbackCount,
    Reopened: i.reopenCount,
    'Delay (days)': i.delay ?? '',
  }));
}

export type SummaryRow = Record<string, string | number>;

function summaryRow(label: string, items: ItemRow[], intervals: Awaited<ReturnType<typeof loadIntervals>>, cal: WorkCalendar, now: Date): SummaryRow {
  const k = kpis(items, now);
  const f = flowTimes(items, cal);
  const ids = new Set(items.map(i => i.id));
  const r = reviewAndCorrection(intervals.filter(iv => ids.has(iv.itemId)), cal);
  const q = qualityRates(items);
  return {
    Scope: label,
    Total: k.total,
    Unassigned: k.unassigned,
    'In progress': k.inProgress,
    'In review': k.inReview,
    Corrections: k.corrections,
    Done: k.done,
    Overdue: k.overdue,
    'Avg cycle (h)': hours(f.cycleTime.avg),
    'Avg lead (h)': hours(f.leadTime.avg),
    'Avg wait before start (h)': hours(f.waitBeforeStart.avg),
    'Avg review turnaround (h)': hours(r.reviewTurnaround.avg),
    'Avg correction time (h)': hours(r.correctionTime.avg),
    'First-pass approval': pct(q.firstPassRate),
    'On time': pct(q.onTimeRate),
  };
}

/** Summary per work type, combined, and per developer. */
export async function buildReport(filters: Filters) {
  const now = new Date();
  const cal = await workCalendar();
  let items = await loadItems(filters);
  if (filters.from || filters.to) {
    const from = filters.from ?? new Date(0);
    const to = filters.to ?? now;
    // Items touched in the period: received, completed, or still open during it.
    items = items.filter(i => i.receivedAt <= to && (!i.completedAt || i.completedAt >= from));
  }
  const intervals = await loadIntervals(items.map(i => i.id), new Map(items.map(i => [i.id, i.workTypeKey])));

  const byType = new Map<string, ItemRow[]>();
  for (const i of items) byType.set(i.workTypeName, [...(byType.get(i.workTypeName) ?? []), i]);
  const byDev = new Map<string, ItemRow[]>();
  for (const i of items) {
    const name = i.assigneeName ?? 'Unassigned';
    byDev.set(name, [...(byDev.get(name) ?? []), i]);
  }

  return {
    generatedAt: now,
    tz: cal.tz,
    workTypes: [...byType].map(([name, list]) => summaryRow(name, list, intervals, cal, now)),
    combined: summaryRow('All work types', items, intervals, cal, now),
    developers: [...byDev].sort((a, b) => a[0].localeCompare(b[0])).map(([name, list]) => summaryRow(name, list, intervals, cal, now)),
    items: itemReportRows(items, cal),
  };
}

export type Report = Awaited<ReturnType<typeof buildReport>>;

function csvCell(v: unknown) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  return [headers.map(csvCell).join(','), ...rows.map(r => headers.map(h => csvCell(r[h])).join(','))].join('\n');
}

export async function toXlsx(report: Report): Promise<Buffer> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Classroots Work';
  wb.created = report.generatedAt;
  const add = (name: string, rows: Record<string, unknown>[]) => {
    const ws = wb.addWorksheet(name);
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    ws.columns = headers.map(h => ({ header: h, key: h, width: Math.min(40, Math.max(12, h.length + 2)) }));
    ws.addRows(rows);
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
  };
  add('Summary', [report.combined, ...report.workTypes]);
  add('Developers', report.developers);
  add('Items', report.items);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
