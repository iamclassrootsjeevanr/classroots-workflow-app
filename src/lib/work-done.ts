/** "Work done by person": per-person numbers next to the team average. Pure: no DB. */
import type { DoneInput, DoneMetric, WorkTypeDefinition } from '@/modules/types';

/** Shown when a work type has no metrics of its own. */
export const DEFAULT_DONE_METRICS: DoneMetric[] = [
  { key: 'done', label: 'Done', kind: 'count', value: p => p.work.filter(w => w.category === 'done').length },
  { key: 'open', label: 'Still open', kind: 'count', value: p => p.work.filter(w => w.category !== 'done').length },
];

export const doneMetricsOf = (mod: Pick<WorkTypeDefinition, 'doneMetrics'>) => mod.doneMetrics ?? DEFAULT_DONE_METRICS;

export type DoneRow = { id: string; name: string; values: Record<string, number | null> };
export type DoneTable = { metrics: DoneMetric[]; people: DoneRow[]; team: Record<string, number | null> };

/** The columns a person sees: the ones for what they can do; everything for admins and anyone who assigns (leads). */
export function metricsFor(metrics: DoneMetric[], caps: ReadonlySet<string>, isAdmin: boolean): DoneMetric[] {
  if (isAdmin || caps.has('assign') || caps.has('manageFields')) return metrics;
  const mine = metrics.filter(m => !m.cap || caps.has(m.cap));
  return mine.length ? mine : metrics;
}

const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 10) / 10 : null;
};

/**
 * One row per person plus the team average. The average is over people who did something in that column (a count of 0 for
 * someone who only reviews would drag it down), so it reads "what a typical person doing this does".
 */
export function doneTable(metrics: DoneMetric[], people: { id: string; name: string; input: DoneInput }[]): DoneTable {
  const rows: DoneRow[] = people.map(p => ({ id: p.id, name: p.name, values: Object.fromEntries(metrics.map(m => [m.key, m.value(p.input)])) }));
  const team = Object.fromEntries(
    metrics.map(m => {
      const v = rows.map(r => r.values[m.key]);
      return [m.key, avg(m.kind === 'count' ? v.filter(x => x) : v)];
    }),
  );
  return { metrics, people: rows, team };
}
