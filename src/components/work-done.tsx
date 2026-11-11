import { Sheet } from '@/components/sheet';
import { Card } from '@/components/ui';
import type { DoneMetric } from '@/modules/types';
import type { DoneTable } from '@/lib/work-done';

const show = (m: DoneMetric, v: number | null | undefined) => (v == null ? '—' : m.kind === 'percent' ? `${v}%` : String(v));

/**
 * Work done by person next to the team average. `metrics` are the columns for the viewer's role; `onlyMe` (own-data roles) shows
 * just the viewer and the average, never colleagues. A bar per cell is scaled to the biggest value of its column.
 */
export function WorkDoneCard({ table, metrics, meId, onlyMe, title = 'Work done' }: { table: DoneTable; metrics: DoneMetric[]; meId: string; onlyMe?: boolean; title?: string }) {
  const me = table.people.find(p => p.id === meId) ?? { id: meId, name: 'You', values: {} };
  const rows = onlyMe ? [me] : table.people.some(p => p.id === meId) ? table.people : [...table.people, me];
  const max = (m: DoneMetric) => Math.max(1, m.kind === 'percent' ? 100 : 0, ...table.people.map(p => p.values[m.key] ?? 0), me.values[m.key] ?? 0);
  const cell = (m: DoneMetric, v: number | null | undefined, tone: string) => (
    <td key={m.key} className="min-w-28 tabular-nums">
      <div className="flex items-center gap-2">
        <span className="w-10 shrink-0 text-right text-sm font-medium text-ink">{show(m, v)}</span>
        <span className="h-1.5 min-w-10 flex-1 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
          <span className={`block h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, ((v ?? 0) / max(m)) * 100)}%` }} />
        </span>
      </div>
    </td>
  );
  return (
    <Card title={title} description={onlyMe ? 'Your numbers next to the team average. Nobody else’s are shown.' : 'Per person, with the team average. The average counts people who did some of it.'} className="mb-5">
      <Sheet maxHeight="60vh">
        <table className="sheet">
          <thead>
            <tr>
              <th className="pin">Person</th>
              {metrics.map(m => (
                <th key={m.key} title={m.hint}>
                  {m.label}
                  {m.hint && <span className="block text-2xs font-normal text-muted">{m.hint}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(p => (
              <tr key={p.id} className={p.id === meId ? 'bg-brand-soft/40' : undefined}>
                <td className="pin whitespace-nowrap font-medium">
                  {onlyMe ? 'You' : p.name}
                  {!onlyMe && p.id === meId && <span className="ml-1.5 text-2xs text-muted">(you)</span>}
                </td>
                {metrics.map(m => cell(m, p.values[m.key], p.id === meId ? 'bg-brand' : 'bg-muted/60'))}
              </tr>
            ))}
            <tr className="border-t border-line">
              <td className="pin whitespace-nowrap font-semibold">Team average</td>
              {metrics.map(m => cell(m, table.team[m.key], 'bg-ok'))}
            </tr>
          </tbody>
        </table>
      </Sheet>
    </Card>
  );
}
