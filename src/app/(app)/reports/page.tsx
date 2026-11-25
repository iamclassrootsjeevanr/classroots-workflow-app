import { FilterBar } from '@/components/filter-bar';
import { GroupSummaryCard } from '@/components/group-summary';
import { getModule } from '@/modules/registry';
import { Sheet } from '@/components/sheet';
import { Card, PageHeader } from '@/components/ui';
import { db } from '@/server/db';
import { localDayBoundary } from '@/lib/time';
import { workTypesWith } from '@/lib/access-core';
import { requireAnyPage, scopeWhere } from '@/server/access';
import { appTz } from '@/server/settings';
import { itemPeople, loadItems } from '@/server/services/analytics';
import { buildReport, type SummaryRow } from '@/server/services/reports';

export const metadata = { title: 'Reports' };

type Search = { wt?: string; user?: string; q?: string; from?: string; to?: string };

function SummaryTable({ rows, filters }: { rows: SummaryRow[]; /** Column title filters; off for a one-row summary. */ filters?: boolean }) {
  if (!rows.length) return <p className="text-sm text-muted">No data.</p>;
  const headers = Object.keys(rows[0]);
  return (
    <Sheet maxHeight="60vh" filters={filters}>
      <table className="sheet">
        <thead>
          <tr>
            {headers.map((h, j) => (
              <th key={h} className={j === 0 ? 'pin' : ''}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {headers.map((h, j) => (
                <td key={h} className={`tabular-nums ${j === 0 ? 'pin' : ''}`}>
                  {r[h] === '' ? '—' : r[h]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Sheet>
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
    userId: sp.user,
    q: sp.q,
    from: localDayBoundary(sp.from, false, appTz()),
    to: localDayBoundary(sp.to, true, appTz()),
  };
  const [report, types, users] = await Promise.all([
    buildReport(filters),
    db.workType.findMany({ where: { key: { in: reportTypes.map(t => t.workTypeKey) } }, orderBy: { name: 'asc' } }),
    itemPeople({ archivedAt: null, AND: [scopeWhere(access, selected)] }),
  ]);
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]).toString();
  const groupMods = selected.map(t => getModule(t.workTypeKey)).filter(m => m?.groupSummary);
  const scopedItems = groupMods.length ? await loadItems({ workTypeKeys: filters.workTypeKeys, where: filters.where, userId: filters.userId, q: filters.q, level: 'groups' }) : [];

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle={`Each work type separately${selected.some(t => t.dataScope === 'OWN') ? ' (own items only where your access is “own data”)' : ''}. Durations are business hours.`}
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
          { name: 'q', label: 'Search', type: 'search' },
          { name: 'wt', label: 'Work type', options: types.map(t => ({ value: t.key, label: `${t.name}${t.state !== 'ACTIVE' ? ` (${t.state.toLowerCase()})` : ''}` })) },
          { name: 'user', label: 'User', options: users },
          { name: 'from', label: 'From', type: 'date' },
          { name: 'to', label: 'To', type: 'date' },
        ]}
      />
      <div className="space-y-5">
        {report.workTypes.map(({ Scope: name, ...row }) => (
          <Card key={name} title={`${name} · summary`}>
            <SummaryTable rows={[row]} filters={false} />
          </Card>
        ))}
        {!report.workTypes.length && (
          <Card>
            <p className="text-sm text-muted">No items match these filters.</p>
          </Card>
        )}
        {groupMods.map(m => (
          <GroupSummaryCard key={m!.key} itemsHref={`/w/${m!.key}/items`} mod={m!} items={scopedItems.filter(i => i.workTypeKey === m!.key)} tz={appTz()} title={`${m!.name} · by ${m!.groupSummary!.label}`} />
        ))}
        {report.people.map(p => (
          <Card key={p.workType} title={`${p.workType} · per ${p.role}`}>
            <SummaryTable rows={p.rows} />
          </Card>
        ))}
        <Card title={`Items (${report.items.length})`} actions={<span className="text-xs text-muted">first 50 shown{canExport ? ' · export for all' : ''}</span>}>
          <SummaryTable rows={report.items.slice(0, 50) as SummaryRow[]} />
        </Card>
      </div>
    </>
  );
}
