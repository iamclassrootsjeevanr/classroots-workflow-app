import { StackedByPerson } from '@/components/charts';
import { Card, ToneChip } from '@/components/ui';
import { groupRollup, groupSeries, type GroupableItem } from '@/lib/groups';
import { formatDate, normalizeDate } from '@/lib/time';
import type { WorkTypeDefinition } from '@/modules/types';

/** "By APK version"-style summary table plus a stacked bar per group. Renders nothing for work types without a groupSummary. */
export function GroupSummaryCard({ mod, items, tz, title }: { mod: WorkTypeDefinition; items: GroupableItem[]; tz: string; title?: string }) {
  const summary = mod.groupSummary;
  if (!summary) return null;
  const rows = groupRollup(mod, items);
  if (!rows.length) return null;
  const chart = groupSeries(mod, rows);
  const cell = (key: string, v: string | number) => {
    if (typeof v === 'string' && /date/i.test(key) && normalizeDate(v)) return formatDate(new Date(normalizeDate(v)), tz);
    return v === '' ? '—' : v;
  };

  return (
    <div className="mb-5 grid gap-5 xl:grid-cols-5">
      <Card title={title ?? `By ${summary.label}`} className="xl:col-span-3">
        <div className="table-wrap max-h-[60vh] overflow-auto">
          <table className="table">
            <thead>
              <tr>
                <th>{summary.label}</th>
                {summary.columns.map(c => (
                  <th key={c.key}>{c.label}</th>
                ))}
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.group}>
                  <td className="font-mono text-xs font-medium whitespace-nowrap">{r.group}</td>
                  {summary.columns.map(c => (
                    <td key={c.key} className="whitespace-nowrap tabular-nums">
                      {cell(c.key, r.cells[c.key] ?? '')}
                    </td>
                  ))}
                  <td>{r.result && <ToneChip tone={r.result.tone}>{r.result.label}</ToneChip>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title={`Status by ${summary.label}`} className="xl:col-span-2">
        <StackedByPerson rows={chart.rows} series={chart.series} height={Math.max(220, rows.length * 26)} labelWidth={Math.min(170, 20 + Math.max(...rows.map(r => r.group.length)) * 7)} />
      </Card>
    </div>
  );
}
