import { FilterBar } from '@/components/filter-bar';
import { GroupSummaryCard } from '@/components/group-summary';
import { getModule } from '@/modules/registry';
import { Card, PageHeader } from '@/components/ui';
import { db } from '@/server/db';
import { localDayBoundary } from '@/lib/time';
import { workTypesWith } from '@/lib/access-core';
import { requireAnyPage, scopeWhere } from '@/server/access';
import { appTz } from '@/server/settings';
import { loadItems } from '@/server/services/analytics';
import { buildReport, type SummaryRow } from '@/server/services/reports';

export const metadata = { title: 'Reports' };

type Search = { wt?: string; dev?: string; from?: string; to?: string };

function SummaryTable({ rows, highlightFirst }: { rows: SummaryRow[]; highlightFirst?: boolean }) {
  if (!rows.length) return <p className="text-sm text-muted">No data.</p>;
  const headers = Object.keys(rows[0]);
  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            {headers.map(h => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={highlightFirst && i === 0 ? 'font-semibold' : ''}>
              {headers.map(h => (
                <td key={h} className="whitespace-nowrap tabular-nums">
                  {r[h] === '' ? '—' : r[h]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { access, types: reportTypes } = await requireAnyPage('reports');
  const sp = await searchParams;
  const selected = sp.wt ? reportTypes.filter(t => t.workTypeKey === sp.wt) : reportTypes;
  const canExport = workTypesWith(access, 'export').some(t => selected.some(s => s.workTypeKey === t.workTypeKey));
  const filters = {
    workTypeKeys: selected.map(t => t.workTypeKey),
    where: scopeWhere(access, selected),
    assigneeId: sp.dev,
    from: localDayBoundary(sp.from, false, appTz()),
    to: localDayBoundary(sp.to, true, appTz()),
  };
  const [report, types, devs] = await Promise.all([
    buildReport(filters),
    db.workType.findMany({ where: { key: { in: reportTypes.map(t => t.workTypeKey) } }, orderBy: { name: 'asc' } }),
    db.user.findMany({ where: { assignedItems: { some: scopeWhere(access, selected) } }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]).toString();
  const groupMods = selected.map(t => getModule(t.workTypeKey)).filter(m => m?.groupSummary);
  const scopedItems = groupMods.length ? await loadItems({ workTypeKeys: filters.workTypeKeys, where: filters.where, assigneeId: filters.assigneeId }) : [];

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle={`All your work types combined, and each one separately${selected.some(t => t.dataScope === 'OWN') ? ' (own items only where your access is “own data”)' : ''}. Durations are business hours.`}
        actions={
          canExport && (
          <>
            <a className="btn-ghost" href={`/api/reports/export?format=csv${qs ? `&${qs}` : ''}`}>
              Export CSV
            </a>
            <a className="btn-primary" href={`/api/reports/export?format=xlsx${qs ? `&${qs}` : ''}`}>
              Export Excel
            </a>
          </>
          )
        }
      />
      <FilterBar
        filters={[
          { name: 'wt', label: 'Work type', options: types.map(t => ({ value: t.key, label: `${t.name}${t.state !== 'ACTIVE' ? ` (${t.state.toLowerCase()})` : ''}` })) },
          { name: 'dev', label: 'Developer', options: devs.map(d => ({ value: d.id, label: d.name ?? '?' })) },
          { name: 'from', label: 'From', type: 'date' },
          { name: 'to', label: 'To', type: 'date' },
        ]}
      />
      <div className="space-y-5">
        <Card title="Combined and per work type">
          <SummaryTable rows={[report.combined, ...report.workTypes]} highlightFirst />
        </Card>
        {groupMods.map(m => (
          <GroupSummaryCard key={m!.key} mod={m!} items={scopedItems.filter(i => i.workTypeKey === m!.key)} tz={appTz()} title={`${m!.name} · by ${m!.groupSummary!.label}`} />
        ))}
        <Card title="Per developer">
          <SummaryTable rows={report.developers} />
        </Card>
        <Card title={`Items (${report.items.length})`} actions={<span className="text-xs text-muted">first 50 shown{canExport ? ' · export for all' : ''}</span>}>
          <SummaryTable rows={report.items.slice(0, 50) as SummaryRow[]} />
        </Card>
      </div>
    </>
  );
}
