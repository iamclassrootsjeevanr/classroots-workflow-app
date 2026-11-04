import Link from 'next/link';
import { redirect } from 'next/navigation';
import { StackedByPerson, StatusPie, ThroughputChart } from '@/components/charts';
import { YouVsTeam } from '@/components/compare';
import { GroupSummaryCard } from '@/components/group-summary';
import { Card, Kpi, KpiGrid, ToneChip } from '@/components/ui';
import type { NavIcon } from '@/components/icons';
import { formatDuration } from '@/lib/time';
import { itemsUrl } from '@/lib/items-url';
import { groupRollup } from '@/lib/groups';
import { getModule } from '@/modules/registry';
import type { StatusCategory } from '@/modules/types';
import { scopeWhere } from '@/server/access';
import { comparison, dashboard } from '@/server/services/analytics';
import { loadWorkTypePage } from '@/server/work-type-page';

export async function generateMetadata({ params }: { params: Promise<{ workType: string }> }) {
  const { workType } = await params;
  return { title: `${getModule(workType)?.name ?? 'Work'} · Overview` };
}

const STAGES: { cat: StatusCategory; label: string; icon: NavIcon; accent: 'brand' | 'ok' | 'warn' | 'bad' | 'info' | 'muted' }[] = [
  { cat: 'queue', label: 'To start', icon: 'queue', accent: 'muted' },
  { cat: 'active', label: 'In progress', icon: 'active', accent: 'info' },
  { cat: 'feedback', label: 'In corrections', icon: 'feedback', accent: 'bad' },
  { cat: 'review', label: 'In review', icon: 'review', accent: 'warn' },
  { cat: 'approved', label: 'Approved', icon: 'approved', accent: 'brand' },
  { cat: 'done', label: 'Done', icon: 'done', accent: 'ok' },
  { cat: 'hold', label: 'On hold', icon: 'hold', accent: 'muted' },
];

/** Analytics only: metrics and graphs for this work type. Every tile and chart opens the matching rows on the Items page. */
export default async function OverviewPage({ params, searchParams }: { params: Promise<{ workType: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { workType: key } = await params;
  const sp = await searchParams;
  // Old links such as /w/apk-testing?status=fail now live on the Items page.
  const query = new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => Boolean(e[1])));
  if (query.size) redirect(`/w/${key}/items?${query}`);

  const { user, access, wtAccess, mod, tz, ownOnly } = await loadWorkTypePage(key);
  const [d, compare] = await Promise.all([
    dashboard({ workTypeKeys: [key], where: scopeWhere(access, [wtAccess]) }, { weeks: 12 }),
    ownOnly ? comparison(user.id, key) : Promise.resolve(null),
  ]);
  const itemsHref = itemsUrl(key);
  const present = new Set(mod.statuses.map(s => s.category));
  const count = (c: StatusCategory) => d.items.filter(i => i.category === c).length;
  const noun = (mod.labels?.assignee ?? 'developer').toLowerCase();

  // By status and per-person bars leave Done out; the Done count lives on its card.
  const open = d.statusSlices.filter(s => s.category !== 'done');
  const series = open.map(s => ({ label: s.label, color: s.color, count: s.count, key: s.key }));
  const doneCount = count('done');
  const people = ownOnly ? d.byDeveloper.filter(r => r.__dev === user.id) : d.byDeveloper;
  const recent = mod.groupSummary ? groupRollup(mod, d.items).slice(-4).reverse() : [];
  const seriesColors = mod.groupSummary?.seriesColors ?? {};

  return (
    <>
      <KpiGrid>
        <Kpi label="Total" value={d.kpis.total} icon="total" accent="brand" href={itemsHref} />
        {STAGES.filter(s => present.has(s.cat)).map(s => (
          <Kpi
            key={s.cat}
            label={mod.categoryLabels?.[s.cat] ?? s.label}
            value={count(s.cat)}
            icon={s.icon}
            accent={s.accent}
            tone={s.cat === 'done' ? 'ok' : s.cat === 'feedback' && count('feedback') ? 'bad' : undefined}
            href={itemsUrl(key, { cat: s.cat })}
          />
        ))}
        {!mod.table?.hide?.includes('delay') && (
          <Kpi label="Overdue" value={d.kpis.overdue} icon="overdue" accent={d.kpis.overdue ? 'bad' : 'ok'} tone={d.kpis.overdue ? 'bad' : 'ok'} hint={`${d.kpis.dueThisWeek} due this week`} href={itemsUrl(key, { scope: 'overdue' })} />
        )}
      </KpiGrid>

      {recent.length > 0 && mod.groupSummary && (
        <Card title={`Latest ${mod.groupSummary.label}s`} actions={<Link href={`/w/${key}/versions`} className="link text-xs">All {mod.pages?.groups?.toLowerCase() ?? 'groups'}</Link>} className="mb-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {recent.map(r => {
              const parts = Object.entries(r.series ?? {}).filter(([, n]) => n > 0);
              const total = parts.reduce((m, [, n]) => m + n, 0) || 1;
              return (
                <Link
                  key={r.group}
                  href={itemsUrl(key, { group: r.group })}
                  className="group/v rounded-xl border border-line bg-surface-2/40 p-3.5 transition hover:-translate-y-px hover:border-brand/40 hover:bg-surface-2/70"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 truncate font-mono text-xs text-muted" title={r.group}>
                      {r.group}
                    </div>
                    {r.result && <ToneChip tone={r.result.tone}>{r.result.label}</ToneChip>}
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-semibold tracking-tight tabular-nums text-ink">{r.cells[mod.groupSummary!.headline ?? 'passRate']}</span>
                    <span className="text-xs text-muted">
                      {r.count} {mod.itemNoun}s
                    </span>
                  </div>
                  <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={parts.map(([k, n]) => `${k} ${n}`).join(', ')}>
                    {parts.map(([k, n]) => (
                      <span key={k} className="h-full" style={{ width: `${(n / total) * 100}%`, background: seriesColors[k] ?? 'var(--color-muted)' }} />
                    ))}
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>
      )}

      <div className="mb-5 grid gap-5 lg:grid-cols-3">
        <Card title="By status" description="Click a slice to see its rows">
          <StatusPie slices={series} itemsHref={itemsHref} note={doneCount ? `Done (${doneCount}) is on its card above.` : undefined} />
        </Card>
        {ownOnly ? (
          <Card title="You vs team average" description="Your numbers next to the team's average. Nobody else's items are shown." className="lg:col-span-2">
            {compare && <YouVsTeam rows={compare} />}
          </Card>
        ) : (
          <Card title={`Work per ${noun}`} description="Click a bar to see that person's rows" className="lg:col-span-2">
            <StackedByPerson rows={people} series={series} itemsHref={itemsHref} />
          </Card>
        )}
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
        <Card title="Needs attention" description="Sitting in a status longer than expected" className="mb-5">
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

      {mod.groupSummary && d.items.length > 0 && <GroupSummaryCard mod={mod} items={d.items} tz={tz} only="chart" itemsHref={itemsHref} />}
    </>
  );
}
