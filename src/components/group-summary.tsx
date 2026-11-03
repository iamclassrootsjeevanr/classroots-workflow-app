import Link from 'next/link';
import { GroupTrendChart } from '@/components/charts';
import { LinkButton } from '@/components/controls';
import { DeleteApkVersionButton, EditApkVersionButton } from '@/components/new-apk-version';
import { Sheet } from '@/components/sheet';
import { Card, ToneChip } from '@/components/ui';
import { groupRollup, groupTrend, type GroupableItem } from '@/lib/groups';
import { formatDate, normalizeDate } from '@/lib/time';
import type { WorkTypeDefinition } from '@/modules/types';

/** "By APK version"-style summary table plus a stacked bar per group. Renders nothing for work types without a groupSummary. */
export function GroupSummaryCard({ mod, items, tz, title, versionEdit, groupHref, only, itemsHref }: { mod: WorkTypeDefinition; items: GroupableItem[]; tz: string; title?: string; versionEdit?: { workTypeId: string; canDelete?: boolean }; /** Makes each group name a link (e.g. to the item list filtered to it). */ groupHref?: (group: string) => string; /** Render just the chart (or just the table). */ only?: 'chart' | 'table'; /** Chart columns open the item list filtered to a group. */ itemsHref?: string }) {
  const summary = mod.groupSummary;
  if (!summary) return null;
  const rows = groupRollup(mod, items);
  if (!rows.length) return null;
  const trend = groupTrend(mod, rows);
  const hasLinks = rows.some(r => r.links?.length);
  const metaOf = (group: string) => {
    const list = items.filter(i => (i.groupKey ?? '(no group)') === group);
    const pick = (k: string) => String(list.find(i => i.data[k])?.data[k] ?? '');
    return { apkUrl: pick('apkUrl'), releaseDate: normalizeDate(pick('releaseDate')), releaseNotes: pick('releaseNotes') };
  };
  const cell = (key: string, v: string | number) => {
    if (typeof v === 'string' && /date/i.test(key) && normalizeDate(v)) return formatDate(new Date(normalizeDate(v)), tz);
    return v === '' ? '—' : v;
  };

  const chartTitle = trend.successLabel ? `${trend.successLabel} rate and results by ${summary.label}` : `Results by ${summary.label}`;
  return (
    <div className="mb-5 space-y-5">
      {only !== 'table' && <Card title={chartTitle} description={`One column per ${summary.label}, oldest to newest. The line is the share of tests that ${trend.successLabel?.toLowerCase() ?? 'succeeded'}.`}>
        <GroupTrendChart rows={trend.points} series={trend.series} successLabel={trend.successLabel} rateLines={trend.rateLines} itemsHref={itemsHref} />
      </Card>}
      {only !== 'chart' && <Card title={title ?? `By ${summary.label}`}>
        <Sheet maxHeight="60vh">
          <table className="sheet">
            <thead>
              <tr>
                <th className="pin">{summary.label}</th>
                {summary.columns.map(c => (
                  <th key={c.key}>{c.label}</th>
                ))}
                <th>Result</th>
                {hasLinks && <th>Link</th>}
                {versionEdit && <th className="pin-end">Edit</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.group}>
                  <td className="pin font-mono text-xs font-medium">{groupHref ? <Link className="link" href={groupHref(r.group)}>{r.group}</Link> : r.group}</td>
                  {summary.columns.map(c => (
                    <td key={c.key} className="whitespace-nowrap tabular-nums">
                      {cell(c.key, r.cells[c.key] ?? '')}
                    </td>
                  ))}
                  <td>{r.result && <ToneChip tone={r.result.tone}>{r.result.label}</ToneChip>}</td>
                  {hasLinks && (
                    <td>
                      {r.links?.map(l => (
                        <LinkButton key={l.url} href={l.url} label={l.label} size="xs" />
                      ))}
                    </td>
                  )}
                  {versionEdit && (
                    <td className="pin-end">
                      <span className="inline-flex items-center gap-1">
                        <EditApkVersionButton key={r.group} workTypeId={versionEdit.workTypeId} version={r.group} {...metaOf(r.group)} />
                        {versionEdit.canDelete && <DeleteApkVersionButton workTypeId={versionEdit.workTypeId} version={r.group} count={r.count} />}
                      </span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </Sheet>
      </Card>}
    </div>
  );
}
