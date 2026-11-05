/** Per-group rollups (e.g. per APK version, per chapter) defined by a work type's groupSummary. Pure. */
import type { GroupSummaryItem, GroupSummaryRow, WorkTypeDefinition } from '@/modules/types';

export type GroupRollupRow = GroupSummaryRow & { group: string; count: number };

export type GroupableItem = GroupSummaryItem & { groupKey: string | null };

/** One row per group, in group order (newest / highest last), with the module's computed cells and result. */
export function groupRollup(mod: WorkTypeDefinition, items: GroupableItem[]): GroupRollupRow[] {
  const summary = mod.groupSummary;
  if (!summary) return [];
  const byGroup = new Map<string, GroupableItem[]>();
  for (const it of items) {
    const g = it.groupKey ?? '';
    byGroup.set(g, [...(byGroup.get(g) ?? []), it]);
  }
  return [...byGroup.entries()]
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([group, list]) => ({ group: group || '(no group)', count: list.length, ...summary.compute(list) }));
}

/** Chart input: one bar per group, stacked by the module's series. */
export function groupSeries(mod: WorkTypeDefinition, rows: GroupRollupRow[]) {
  const colors = mod.groupSummary?.seriesColors ?? {};
  const labels = [...new Set(rows.flatMap(r => Object.keys(r.series ?? {})))];
  const fallback = ['#1e88e5', '#43a047', '#fb8c00', '#e53935', '#8e24aa', '#00897b', '#6d4c41'];
  return {
    series: labels.map((label, i) => ({ label, color: colors[label] ?? fallback[i % fallback.length], count: rows.reduce((s, r) => s + (r.series?.[label] ?? 0), 0), key: mod.groupSummary?.seriesStatuses?.[label]?.join(',') })),
    rows: rows.map(r => ({ name: r.group, ...(r.series ?? {}) })),
  };
}

/** Shorten group names for chart axes by dropping the prefix they all share, cut at a "_", "-", "." or space boundary. */
export function shortLabels(names: string[]): string[] {
  if (names.length < 2) return names;
  let prefix = names[0];
  for (const n of names) {
    while (prefix && !n.startsWith(prefix)) prefix = prefix.slice(0, -1);
  }
  const cut = Math.max(prefix.lastIndexOf('_'), prefix.lastIndexOf(' '), prefix.lastIndexOf('-'), prefix.lastIndexOf('.')) + 1;
  const trimmed = names.map(n => n.slice(cut));
  return trimmed.every(Boolean) && new Set(trimmed).size === names.length ? trimmed : names;
}

export type TrendPoint = Record<string, string | number | null> & { name: string; short: string; total: number; rate: number | null };

/** Chart input for "results per group over time": stacked counts plus the success rate (percent) per group. */
export function groupTrend(mod: WorkTypeDefinition, rows: GroupRollupRow[]) {
  const base = groupSeries(mod, rows);
  const raw = mod.groupSummary?.successSeries;
  const success = raw == null ? [] : Array.isArray(raw) ? raw : [raw];
  const shorts = shortLabels(rows.map(r => r.group));
  const points: TrendPoint[] = base.rows.map((r, i) => {
    const total = rows[i].count;
    const good = success.reduce((s, label) => s + Number(rows[i].series?.[label] ?? 0), 0);
    return { ...r, short: shorts[i], total, rate: success.length && total ? Math.round((good / total) * 1000) / 10 : null };
  });
  const successLabel = success.length ? (mod.groupSummary?.successLabel ?? success.join(' + ')) : null;
  return { points, series: base.series, successLabel, rateLines: mod.groupSummary?.rateLines ?? [] };
}
