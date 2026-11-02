import Link from 'next/link';
import { redirect } from 'next/navigation';
import { StackedByPerson, StatusPie, ThroughputChart } from '@/components/charts';
import { Card, Kpi, KpiGrid, pct, ToneChip } from '@/components/ui';
import { formatDuration } from '@/lib/time';
import { groupRollup } from '@/lib/groups';
import { getModule } from '@/modules/registry';
import { scopeWhere } from '@/server/access';
import { dashboard } from '@/server/services/analytics';
import { loadWorkTypePage } from '@/server/work-type-page';

export async function generateMetadata({ params }: { params: Promise<{ workType: string }> }) {
  const { workType } = await params;
  return { title: `${getModule(workType)?.name ?? 'Work'} · Overview` };
}

/** Analytics only: metrics and graphs for this work type. The item table lives on the Items page. */
export default async function OverviewPage({ params, searchParams }: { params: Promise<{ workType: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { workType: key } = await params;
  const sp = await searchParams;
  // Old links such as /w/apk-testing?status=fail now live on the Items page.
  const query = new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => Boolean(e[1])));
  if (query.size) redirect(`/w/${key}/items?${query}`);

  const { access, wtAccess, mod, tz } = await loadWorkTypePage(key);
  const d = await dashboard({ workTypeKeys: [key], where: scopeWhere(access, [wtAccess]) }, { weeks: 12 });
  const cat = (c: 'queue' | 'active' | 'feedback' | 'review' | 'done', dflt: string) => mod.categoryLabels?.[c] ?? dflt;
  const series = d.statusSlices.map(s => ({ label: s.label, color: s.color, count: s.count }));
  const recent = mod.groupSummary ? groupRollup(mod, d.items).slice(-4).reverse() : [];

  return (
    <>
      <KpiGrid>
        <Kpi label="Total" value={d.kpis.total} />
        <Kpi label="Unassigned" value={d.kpis.unassigned} tone={d.kpis.unassigned ? 'warn' : undefined} />
        <Kpi label={cat('active', 'In progress')} value={d.kpis.inProgress + d.kpis.corrections} hint={`${d.kpis.corrections} ${cat('feedback', 'in corrections').toLowerCase()}`} />
        <Kpi label={cat('review', 'In review')} value={d.kpis.inReview} />
        <Kpi label={cat('done', 'Done')} value={d.kpis.done} tone="ok" />
        {!mod.table?.hide?.includes('delay') && <Kpi label="Overdue" value={d.kpis.overdue} tone={d.kpis.overdue ? 'bad' : 'ok'} hint={`${d.kpis.dueThisWeek} due this week`} />}
        {!mod.versions && <Kpi label="First-pass rate" value={pct(d.quality.firstPassRate)} hint={`${d.kpis.corrections} in corrections now`} />}
      </KpiGrid>

      {recent.length > 0 && mod.groupSummary && (
        <Card title={`Latest ${mod.groupSummary.label}s`} actions={<Link href={`/w/${key}/versions`} className="link text-xs">All {mod.pages?.groups?.toLowerCase() ?? 'groups'}</Link>} className="mb-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {recent.map(r => (
              <Link key={r.group} href={`/w/${key}/items?group=${encodeURIComponent(r.group)}`} className="rounded-xl border border-line bg-surface-2/40 p-3 hover:border-brand/50">
                <div className="truncate font-mono text-xs font-medium text-ink" title={r.group}>{r.group}</div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-lg font-semibold tabular-nums">{r.cells.passRate}</span>
                  {r.result && <ToneChip tone={r.result.tone}>{r.result.label}</ToneChip>}
                </div>
                <div className="mt-1 text-xs text-muted">{r.count} tests</div>
              </Link>
            ))}
          </div>
        </Card>
      )}

      <div className="mb-5 grid gap-5 lg:grid-cols-3">
        <Card title="By status">
          <StatusPie slices={series} />
        </Card>
        <Card title={`Work per ${(mod.labels?.assignee ?? 'developer').toLowerCase()}`} className="lg:col-span-2">
          <StackedByPerson rows={d.byDeveloper} series={series} />
        </Card>
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Card title="Weekly flow" description={`Last 12 weeks · times in business hours (${tz})`}>
          <ThroughputChart rows={d.throughput} />
        </Card>
        <Card title="Speed">
          <div className="grid grid-cols-2 gap-3">
            <Kpi label="Avg lead time" value={formatDuration(d.flow.leadTime.avg)} hint="received → done" />
            <Kpi label="Avg cycle time" value={formatDuration(d.flow.cycleTime.avg)} hint="started → done" />
            <Kpi label="Wait before start" value={formatDuration(d.flow.waitBeforeStart.avg)} hint="assigned → started" />
            <Kpi label="Review turnaround" value={formatDuration(d.review.reviewTurnaround.avg)} hint={`p90 ${formatDuration(d.review.reviewTurnaround.p90)}`} />
          </div>
        </Card>
      </div>

      {d.stuck.length > 0 && (
        <Card title="Needs attention" description="Sitting in a status longer than expected">
          <ul className="divide-y divide-line text-sm">
            {d.stuck.slice(0, 8).map(s => (
              <li key={s.itemId} className="flex items-center justify-between gap-3 py-2">
                <Link href={`/w/${key}/${s.itemId}`} className="min-w-0 truncate hover:text-brand">
                  <span className="font-mono text-xs text-muted">{s.item.externalKey.split(' | ').pop()}</span> {s.item.title}
                </Link>
                <span className="shrink-0 text-xs text-muted">
                  {s.item.statusLabel} · {formatDuration(s.businessHours * 60)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
