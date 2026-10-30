import Link from 'next/link';
import { FunnelBars, SimpleBars, StackedByPerson, StageTimeChart, StatusPie, ThroughputChart } from '@/components/charts';
import { FilterBar } from '@/components/filter-bar';
import { GroupSummaryCard } from '@/components/group-summary';
import { WorkloadHeatmap } from '@/components/heatmap';
import { AssignSelect } from '@/components/controls';
import { Card, Delay, Kpi, KpiGrid, LoadBadge, PageHeader, pct, StatusBadge } from '@/components/ui';
import { addDays, formatDateTime, formatDuration } from '@/lib/time';
import { allModules, getModule } from '@/modules/registry';
import { db } from '@/server/db';
import { requireAdmin } from '@/server/rbac';
import { appTz } from '@/server/settings';
import { dashboard } from '@/server/services/analytics';
import { assignablePeople } from '@/server/view';

export const metadata = { title: 'Admin overview' };

type Search = { wt?: string; dev?: string; sme?: string; weeks?: string };

export default async function AdminOverview({ searchParams }: { searchParams: Promise<Search> }) {
  await requireAdmin();
  const sp = await searchParams;
  const tz = appTz();
  const weeks = Number(sp.weeks) || 12;
  const d = await dashboard(
    { workTypeKeys: sp.wt ? [sp.wt] : undefined, assigneeId: sp.dev, ownerId: sp.sme, from: addDays(new Date(), -7 * weeks) },
    { weeks, heatmapDays: 21 },
  );

  const [types, smes, syncStates, people] = await Promise.all([
    db.workType.findMany({ where: { state: { not: 'ARCHIVED' } }, orderBy: { name: 'asc' } }),
    db.user.findMany({ where: { ownedItems: { some: {} } }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    db.syncState.findMany({ include: { workType: { select: { name: true, config: true } } } }),
    assignablePeople(d.items),
  ]);
  const pendingOutbox = await db.syncOutbox.count({ where: { status: 'PENDING' } });
  // Stage names follow the work type when the overview is filtered to one.
  const single = sp.wt ? getModule(sp.wt) : undefined;
  const cat = (c: 'queue' | 'active' | 'feedback' | 'review' | 'done', dflt: string) => single?.categoryLabels?.[c] ?? dflt;

  const unassigned = d.items.filter(i => !i.assigneeId && i.category !== 'done').slice(0, 12);
  const overdue = d.items.filter(i => i.category !== 'done' && i.dueAt && i.dueAt < d.now).sort((a, b) => (b.delay ?? 0) - (a.delay ?? 0)).slice(0, 10);
  const statusSeries = d.statusSlices.map(s => ({ label: s.label, color: s.color, count: s.count }));
  const loadById = new Map(d.workload.map(w => [w.userId, w]));
  const heatRows = d.heatmap.rows.map(r => ({ name: loadById.get(r.userId)?.name ?? '?', capacity: loadById.get(r.userId)?.capacity ?? 3, counts: r.counts }));
  const flowHint = 'business hours';

  return (
    <>
      <PageHeader title="Overview" subtitle={`All work in progress · last ${weeks} weeks · times in business hours (${tz})`} />

      <FilterBar
        filters={[
          { name: 'wt', label: 'Work type', options: types.map(t => ({ value: t.key, label: t.name })) },
          { name: 'dev', label: 'Developer', options: d.users.map(u => ({ value: u.id, label: u.name })) },
          { name: 'sme', label: 'SME', options: smes.map(s => ({ value: s.id, label: s.name ?? '?' })) },
          { name: 'weeks', label: 'Period', options: [4, 8, 12, 26, 52].map(w => ({ value: String(w), label: `Last ${w} weeks` })) },
        ]}
      />

      <KpiGrid>
        <Kpi label="Total items" value={d.kpis.total} />
        <Kpi label="Unassigned" value={d.kpis.unassigned} tone={d.kpis.unassigned ? 'warn' : undefined} />
        <Kpi label={cat('active', 'In progress')} value={d.kpis.inProgress + d.kpis.corrections} hint={`${d.kpis.corrections} ${cat('feedback', 'in corrections').toLowerCase()}`} />
        <Kpi label={cat('review', 'In review')} value={d.kpis.inReview} />
        <Kpi label={cat('done', 'Done')} value={d.kpis.done} tone="ok" />
        <Kpi label="Overdue" value={d.kpis.overdue} tone={d.kpis.overdue ? 'bad' : 'ok'} hint={`${d.kpis.dueThisWeek} due this week`} />
        <Kpi label="On time" value={pct(d.quality.onTimeRate)} hint={`first-pass ${pct(d.quality.firstPassRate)}`} />
      </KpiGrid>

      {[...new Set(d.items.map(i => i.workTypeKey))].map(key => {
        const mod = getModule(key);
        return mod?.groupSummary ? <GroupSummaryCard key={key} mod={mod} items={d.items.filter(i => i.workTypeKey === key)} tz={tz} title={`${mod.name} · by ${mod.groupSummary.label}`} /> : null;
      })}

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Avg lead time" value={formatDuration(d.flow.leadTime.avg)} hint="received → done" />
        <Kpi label="Avg cycle time" value={formatDuration(d.flow.cycleTime.avg)} hint="started → done" />
        <Kpi label="Wait before start" value={formatDuration(d.flow.waitBeforeStart.avg)} hint="assigned → started" />
        <Kpi label="Time to first submit" value={formatDuration(d.flow.timeToFirstSubmit.avg)} hint="started → review" />
        <Kpi label="Review turnaround" value={formatDuration(d.review.reviewTurnaround.avg)} hint={`p90 ${formatDuration(d.review.reviewTurnaround.p90)}`} />
        <Kpi label="Correction time" value={formatDuration(d.review.correctionTime.avg)} hint={`p90 ${formatDuration(d.review.correctionTime.p90)}`} />
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-3">
        <Card title="By status">
          <StatusPie slices={statusSeries} />
        </Card>
        <Card title="Work per developer" className="lg:col-span-2">
          <StackedByPerson rows={d.byDeveloper} series={statusSeries} />
        </Card>
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Card title="Workload now" actions={<span className="text-xs text-muted">active items ÷ capacity</span>}>
          <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Developer</th>
                <th>Load</th>
                <th>To start</th>
                <th>Working</th>
                <th>In review</th>
                <th>On hold</th>
                <th>Overdue</th>
                <th>Due 7d</th>
                <th>Done 30d</th>
              </tr>
            </thead>
            <tbody>
              {d.workload.map(w => (
                <tr key={w.userId}>
                  <td className="font-medium whitespace-nowrap">
                    <Link className="hover:text-brand" href={`/admin?dev=${w.userId}`}>
                      {w.name}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap">
                    <LoadBadge level={w.level} /> <span className="text-xs text-muted tabular-nums">{w.active}/{w.capacity}</span>
                  </td>
                  <td className="tabular-nums">{w.queued}</td>
                  <td className="tabular-nums">{w.inProgress}</td>
                  <td className="tabular-nums">{w.inReview}</td>
                  <td className="tabular-nums">{w.onHold}</td>
                  <td className={`tabular-nums ${w.overdue ? 'font-semibold text-bad' : ''}`}>{w.overdue}</td>
                  <td className="tabular-nums">{w.dueNext7d}</td>
                  <td className="tabular-nums">{w.doneLast30d}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Card>
        <Card title="Workload over the last 3 weeks">
          <WorkloadHeatmap days={d.heatmap.days} rows={heatRows} />
        </Card>
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-3">
        <Card title="Weekly flow" className="lg:col-span-2">
          <ThroughputChart rows={d.throughput} />
        </Card>
        <Card title="Lifecycle funnel">
          <FunnelBars rows={d.funnel} />
        </Card>
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-3">
        <Card title={`Time in each stage (${flowHint})`} className="lg:col-span-2">
          <StageTimeChart rows={d.stageTimes} />
        </Card>
        <Card title="Review rounds until approval">
          <SimpleBars rows={d.rounds.map(r => ({ rounds: `${r.rounds} round${r.rounds > 1 ? 's' : ''}`, items: r.count }))} x="rounds" y="items" color="#7e57c2" />
        </Card>
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Card title={`Unassigned (${d.kpis.unassigned})`} actions={<span className="text-xs text-muted">people sorted by available capacity</span>}>
          {unassigned.length ? (
            <ul className="divide-y divide-line">
              {unassigned.map(i => (
                <li key={i.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <Link className="min-w-0 truncate hover:text-brand" href={`/w/${i.workTypeKey}/${i.id}`}>
                    <span className="font-mono text-xs text-muted">{i.externalKey}</span> {i.title}
                  </Link>
                  <AssignSelect compact itemId={i.id} assigneeId={null} people={people} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-sm text-muted">Everything is assigned.</p>
          )}
        </Card>

        <Card title="Needs attention">
          <h3 className="mb-1 text-xs font-semibold text-muted uppercase">Stuck in a stage</h3>
          {d.stuck.length ? (
            <ul className="mb-4 divide-y divide-line text-sm">
              {d.stuck.slice(0, 8).map(s => (
                <li key={s.itemId} className="flex items-center justify-between gap-3 py-1.5">
                  <Link className="min-w-0 truncate hover:text-brand" href={`/w/${s.item.workTypeKey}/${s.itemId}`}>
                    <span className="font-mono text-xs text-muted">{s.item.externalKey}</span> {s.item.title}
                  </Link>
                  <span className="shrink-0 text-xs">
                    <StatusBadge label={s.item.statusLabel} color={s.item.statusColor} /> {formatDuration(s.businessHours * 60)} <span className="text-muted">(limit {s.limitHours}h)</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-4 text-sm text-muted">Nothing is stuck.</p>
          )}
          <h3 className="mb-1 text-xs font-semibold text-muted uppercase">Overdue</h3>
          {overdue.length ? (
            <ul className="divide-y divide-line text-sm">
              {overdue.map(i => (
                <li key={i.id} className="flex items-center justify-between gap-3 py-1.5">
                  <Link className="min-w-0 truncate hover:text-brand" href={`/w/${i.workTypeKey}/${i.id}`}>
                    <span className="font-mono text-xs text-muted">{i.externalKey}</span> {i.title}
                  </Link>
                  <span className="shrink-0 text-xs">
                    {i.assigneeName ?? 'Unassigned'} · <Delay days={i.delay} />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nothing overdue.</p>
          )}
        </Card>
      </div>

      <Card title="Sheet sync" actions={<Link className="link text-sm" href="/admin/sync">Manage</Link>}>
        {syncStates.length ? (
          <ul className="text-sm">
            {syncStates.map(s => (
              <li key={s.workTypeId}>
                <b>{s.workType.name}</b>: last run {s.lastRunAt ? formatDateTime(s.lastRunAt, tz) : 'never'}
                {s.lastError ? <span className="text-bad"> · {s.lastError}</span> : <span className="text-ok"> · ok</span>} · {s.conflicts} conflicts · {s.missing} missing rows
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Sync hasn’t run yet. {allModules().some(m => m.sheet) && 'Turn it on under Sheet sync.'}</p>
        )}
        <p className="mt-1 text-xs text-muted">{pendingOutbox} change(s) waiting to be written to the sheet.</p>
      </Card>
    </>
  );
}
