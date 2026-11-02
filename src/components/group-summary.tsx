import { GroupTrendChart } from '@/components/charts';
import { Sheet } from '@/components/sheet';
import { Card, ToneChip } from '@/components/ui';
import { groupRollup, groupTrend, type GroupableItem } from '@/lib/groups';
import { formatDate, normalizeDate } from '@/lib/time';
import type { WorkTypeDefinition } from '@/modules/types';

/** "By APK version"-style summary table plus a stacked bar per group. Renders nothing for work types without a groupSummary. */
export function GroupSummaryCard({ mod, items, tz, title }: { mod: WorkTypeDefinition; items: GroupableItem[]; tz: string; title?: string }) {
  const summary = mod.groupSummary;
  if (!summary) return null;
  const rows = groupRollup(mod, items);
  if (!rows.length) return null;
  const trend = groupTrend(mod, rows);
  const cell = (key: string, v: string | number) => {
    if (typeof v === 'string' && /date/i.test(key) && normalizeDate(v)) return formatDate(new Date(normalizeDate(v)), tz);
    return v === '' ? '—' : v;
  };

  const chartTitle = trend.successLabel ? `${trend.successLabel} rate and results by ${summary.label}` : `Results by ${summary.label}`;
  return (
    <div className="mb-5 space-y-5">
      <Card title={chartTitle} description={`One column per ${summary.label}, oldest to newest. The line is the share of tests that ${trend.successLabel?.toLowerCase() ?? 'succeeded'}.`}>
        <GroupTrendChart rows={trend.points} series={trend.series} successLabel={trend.successLabel} rateLines={trend.rateLines} />
      </Card>
      <Card title={title ?? `By ${summary.label}`}>
        <Sheet maxHeight="60vh">
          <table className="sheet">
            <thead>
              <tr>
                <th className="pin">{summary.label}</th>
                {summary.columns.map(c => (
                  <th key={c.key}>{c.label}</th>
                ))}
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.group}>
                  <td className="pin font-mono text-xs font-medium">{r.group}</td>
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
        </Sheet>
      </Card>
    </div>
  );
}
