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
    series: labels.map((label, i) => ({ label, color: colors[label] ?? fallback[i % fallback.length], count: rows.reduce((s, r) => s + (r.series?.[label] ?? 0), 0) })),
    rows: rows.map(r => ({ name: r.group, ...(r.series ?? {}) })),
  };
}
