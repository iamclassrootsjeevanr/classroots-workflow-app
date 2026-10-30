import Link from 'next/link';
import { MeVsTeamChart, StackedByPerson, StatusPie, ThroughputChart } from '@/components/charts';
import { FilterBar } from '@/components/filter-bar';
import { GroupSummaryCard } from '@/components/group-summary';
import { getModule } from '@/modules/registry';
import { WorkloadHeatmap } from '@/components/heatmap';
import { ItemsTable } from '@/components/items-table';
import { Card, Delay, Kpi, KpiGrid, LoadBadge, PageHeader, pct } from '@/components/ui';
import type { WorkTypeAccess } from '@/lib/access-core';
import { flowTimes, workloadByUser } from '@/lib/analytics-core';
import { addDays, businessMinutesBetween, formatDateTime, formatDuration } from '@/lib/time';
import { requireAnyPage, scopeWhere } from '@/server/access';
import { db } from '@/server/db';
import type { CurrentUser } from '@/server/rbac';
import { appTz, workCalendar } from '@/server/settings';
import { dashboard, loadItems, stageTimesFor, statusSlices, type ItemRow } from '@/server/services/analytics';
import { statusOptionsFor } from '@/server/view';
import type { Access } from '@/lib/access-core';

export const metadata = { title: 'My dashboard' };

const keys = (types: WorkTypeAccess[]) => types.map(t => t.workTypeKey);
/** Work types whose item pages this person may open (the "Items list & pages" tick). */
const openable = (types: WorkTypeAccess[]) => new Set(types.filter(t => t.pages.has('items')).map(t => t.workTypeKey));

/** Section: work assigned to me (people with the "work" capability). */
async function MyWorkSection({ user, types, tz }: { user: CurrentUser; types: WorkTypeAccess[]; tz: string }) {
  const now = new Date();
  const cal = await workCalendar();
  const mine = await loadItems({ workTypeKeys: keys(types), assigneeId: user.id }, { includePausedTypes: false });
  const open = mine.filter(i => i.category !== 'done');
  const [options, meVsTeam, recent] = await Promise.all([
    statusOptionsFor(user, mine),
    stageTimesFor(user.id, { workTypeKeys: keys(types) }),
    db.workItemEvent.findMany({
      where: { item: { assigneeId: user.id, workType: { key: { in: keys(types) } } }, type: { in: ['STATUS_CHANGED', 'FEEDBACK', 'ASSIGNED', 'COMMENTED'] } },
      include: { item: { select: { id: true, externalKey: true, workType: { select: { key: true } } } }, actor: { select: { name: true } } },
      orderBy: { at: 'desc' },
      take: 8,
    }),
  ]);
  const [load] = workloadByUser(mine, [{ id: user.id, name: user.name ?? '', capacity: user.capacity }], now);
  const monthAgo = addDays(now, -30);
  const doneThisMonth = mine.filter(i => i.completedAt && i.completedAt >= monthAgo);
  const flow = flowTimes(doneThisMonth.length ? doneThisMonth : mine.filter(i => i.completedAt), cal);
  const dueSoon = open.filter(i => i.dueAt && i.dueAt <= addDays(now, 7)).sort((a, b) => a.dueAt!.getTime() - b.dueAt!.getTime());
  // Stage names follow the work type when only one is in view (e.g. "Failed" instead of "Corrections" for APK tests).
  const single = types.length === 1 ? getModule(types[0].workTypeKey) : undefined;
  const lbl = (cat: 'queue' | 'active' | 'feedback' | 'review' | 'done', dflt: string) => single?.categoryLabels?.[cat] ?? dflt;

  return (
    <section className="mb-8">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
        My work <LoadBadge level={load.level} /> <span className="text-xs font-normal text-muted">{load.active}/{user.capacity} active</span>
      </h2>
      <KpiGrid>
        <Kpi label={lbl('queue', 'To start')} value={load.queued} tone={load.queued ? 'brand' : undefined} />
        <Kpi label={lbl('active', 'In progress')} value={mine.filter(i => i.category === 'active').length} />
        <Kpi label={lbl('feedback', 'Corrections')} value={mine.filter(i => i.category === 'feedback').length} tone={mine.some(i => i.category === 'feedback') ? 'bad' : undefined} />
        <Kpi label={lbl('review', 'Waiting on review')} value={load.inReview} />
        <Kpi label="Overdue" value={load.overdue} tone={load.overdue ? 'bad' : 'ok'} />
        <Kpi label={`${lbl('done', 'Done')} (30 days)`} value={doneThisMonth.length} tone="ok" />
        <Kpi label="Avg cycle time" value={formatDuration(flow.cycleTime.avg)} hint="start → done, business hours" />
      </KpiGrid>
      {types.map(t => {
        const mod = getModule(t.workTypeKey);
        return mod?.groupSummary ? <GroupSummaryCard key={t.workTypeKey} mod={mod} items={mine.filter(i => i.workTypeKey === t.workTypeKey)} tz={tz} title={`My ${mod.itemNoun}s by ${mod.groupSummary.label}`} /> : null;
      })}
      <div className="mb-5 grid gap-5 lg:grid-cols-3">
        <Card title="My work by status">
          <StatusPie slices={statusSlices(mine)} />
        </Card>
        <Card title="My time per stage vs team" className="lg:col-span-2">
          <MeVsTeamChart rows={meVsTeam} />
        </Card>
      </div>
      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Card title="Due in the next 7 days">
          {dueSoon.length ? (
            <ul className="divide-y divide-line text-sm">
              {dueSoon.map(i => (
                <li key={i.id} className="flex items-center justify-between gap-3 py-2">
                  <Link href={`/w/${i.workTypeKey}/${i.id}`} className="min-w-0 truncate hover:text-brand">
                    <span className="font-mono text-xs text-muted">{i.externalKey}</span> {i.title}
                  </Link>
                  <span className="shrink-0 text-xs">
                    <Delay days={i.delay} />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-sm text-muted">Nothing due this week.</p>
          )}
        </Card>
        <Card title="Recent activity on my work">
          {recent.length ? (
            <ul className="divide-y divide-line text-sm">
              {recent.map(e => (
                <li key={e.id} className="py-2">
                  <Link href={`/w/${e.item.workType.key}/${e.item.id}`} className="font-mono text-xs text-brand">
                    {e.item.externalKey}
                  </Link>{' '}
                  <span className="text-muted">
                    {e.type === 'STATUS_CHANGED' ? 'status changed' : e.type === 'FEEDBACK' ? 'feedback' : e.type === 'ASSIGNED' ? 'assigned' : 'comment'}
                    {e.actor?.name ? ` by ${e.actor.name}` : e.source === 'SHEET' ? ' from sheet' : ''} · {formatDateTime(e.at, tz)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-sm text-muted">No activity yet.</p>
          )}
        </Card>
      </div>
      <Card title="My items" actions={<span className="text-xs text-muted">change status inline · open an item for links, feedback and its timeline</span>}>
        <ItemsTable items={mine} statusOptions={options} showAssignee={false} showWorkType={types.length > 1} tz={tz} linkable={openable(types)} empty="Nothing is assigned to you yet." />
      </Card>
    </section>
  );
}

/** Section: submissions waiting for my review (people with the "review" capability; OWN = items I own as SME). */
async function ReviewSection({ user, access, types, tz }: { user: CurrentUser; access: Access; types: WorkTypeAccess[]; tz: string }) {
  const cal = await workCalendar();
  const now = new Date();
  const scoped = await loadItems({ workTypeKeys: keys(types), where: scopeWhere(access, types) }, { includePausedTypes: false });
  const toReview = scoped.filter(i => i.category === 'review');
  const options = await statusOptionsFor(user, toReview);
  const intervals = await db.workItemStageInterval.findMany({
    where: { itemId: { in: scoped.map(i => i.id) }, exitedAt: { not: null, gte: addDays(now, -90) } },
    select: { status: true, enteredAt: true, exitedAt: true, item: { select: { workType: { select: { key: true } } } } },
  });
  const reviewSpans = intervals.filter(iv => ['ready_for_review', 'in_review'].includes(iv.status)).map(iv => businessMinutesBetween(iv.enteredAt, iv.exitedAt!, cal));
  const avgReview = reviewSpans.length ? reviewSpans.reduce((a, b) => a + b, 0) / reviewSpans.length : null;
  const oldest = toReview.reduce<Date | null>((m, i) => (i.lastSubmittedAt && (!m || i.lastSubmittedAt < m) ? i.lastSubmittedAt : m), null);
  const monthAgo = addDays(now, -30);

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold">Waiting for my review</h2>
      <KpiGrid>
        <Kpi label="To review" value={toReview.length} tone={toReview.length ? 'brand' : 'ok'} hint={oldest ? `oldest since ${formatDateTime(oldest, tz)}` : undefined} />
        <Kpi label="In corrections" value={scoped.filter(i => i.category === 'feedback').length} />
        <Kpi label="Approved / done (30 days)" value={scoped.filter(i => (i.approvedAt && i.approvedAt >= monthAgo) || (i.completedAt && i.completedAt >= monthAgo)).length} tone="ok" />
        <Kpi label="Avg review time" value={formatDuration(avgReview)} hint="submitted → reviewed" />
      </KpiGrid>
      <Card actions={<span className="text-xs text-muted">open one to approve or send feedback</span>}>
        <ItemsTable items={toReview} statusOptions={options} showWorkType={types.length > 1} tz={tz} linkable={openable(types)} empty="Nothing is waiting for your review." />
      </Card>
    </section>
  );
}

/** Section: team overview for work types where the person sees all data. */
async function TeamSection({ access, types, tz }: { access: Access; types: WorkTypeAccess[]; tz: string }) {
  const d = await dashboard({ workTypeKeys: keys(types), where: scopeWhere(access, types), from: addDays(new Date(), -7 * 12) }, { weeks: 12, heatmapDays: 14 });
  const series = d.statusSlices.map(s => ({ label: s.label, color: s.color, count: s.count }));
  const loadById = new Map(d.workload.map(w => [w.userId, w]));
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold">Team overview</h2>
      <KpiGrid>
        <Kpi label="Total items" value={d.kpis.total} />
        <Kpi label="Unassigned" value={d.kpis.unassigned} tone={d.kpis.unassigned ? 'warn' : undefined} />
        <Kpi label="In progress" value={d.kpis.inProgress + d.kpis.corrections} />
        <Kpi label="In review" value={d.kpis.inReview} />
        <Kpi label="Done" value={d.kpis.done} tone="ok" />
        <Kpi label="Overdue" value={d.kpis.overdue} tone={d.kpis.overdue ? 'bad' : 'ok'} />
        <Kpi label="On time" value={pct(d.quality.onTimeRate)} hint={`avg cycle ${formatDuration(d.flow.cycleTime.avg)}`} />
      </KpiGrid>
      {types.map(t => {
        const mod = getModule(t.workTypeKey);
        return mod?.groupSummary ? <GroupSummaryCard key={t.workTypeKey} mod={mod} items={d.items.filter(i => i.workTypeKey === t.workTypeKey)} tz={tz} title={`${mod.name} · by ${mod.groupSummary.label}`} /> : null;
      })}
      <div className="mb-5 grid gap-5 lg:grid-cols-3">
        <Card title="By status">
          <StatusPie slices={series} />
        </Card>
        <Card title="Work per person" className="lg:col-span-2">
          <StackedByPerson rows={d.byDeveloper} series={series} />
        </Card>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Weekly flow">
          <ThroughputChart rows={d.throughput} />
        </Card>
        <Card title="Workload, last 2 weeks">
          <WorkloadHeatmap days={d.heatmap.days} rows={d.heatmap.rows.map(r => ({ name: loadById.get(r.userId)?.name ?? '?', capacity: loadById.get(r.userId)?.capacity ?? 3, counts: r.counts }))} />
        </Card>
      </div>
      <p className="mt-2 text-xs text-muted">Times in business hours ({tz}).</p>
    </section>
  );
}

/** Fallback: no work/review capability and only own data – list what they can see. */
async function VisibleItemsSection({ user, access, types, tz }: { user: CurrentUser; access: Access; types: WorkTypeAccess[]; tz: string }) {
  const items: ItemRow[] = await loadItems({ workTypeKeys: keys(types), where: scopeWhere(access, types) }, { includePausedTypes: false });
  const options = await statusOptionsFor(user, items);
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold">My items</h2>
      <div className="mb-5 grid gap-5 lg:grid-cols-3">
        <Card title="By status">
          <StatusPie slices={statusSlices(items)} />
        </Card>
        <Card title="Items" className="lg:col-span-2">
          <ItemsTable items={items} statusOptions={options} showWorkType={types.length > 1} tz={tz} linkable={openable(types)} empty="No items yet." />
        </Card>
      </div>
    </section>
  );
}

export default async function MyDashboard({ searchParams }: { searchParams: Promise<{ wt?: string }> }) {
  const { user, access, types: allTypes } = await requireAnyPage('dashboard');
  const tz = appTz();
  const { wt } = await searchParams;
  const types = wt ? allTypes.filter(t => t.workTypeKey === wt) : allTypes;

  const workTypes = types.filter(t => t.capabilities.has('work'));
  const reviewTypes = types.filter(t => t.capabilities.has('review') && t.canEdit);
  const teamTypes = types.filter(t => t.dataScope === 'ALL');
  const nothingElse = !workTypes.length && !reviewTypes.length && !teamTypes.length;

  return (
    <>
      <PageHeader
        title={`Hi ${user.name?.split(' ')[0] ?? 'there'}`}
        subtitle={types.map(t => `${t.workTypeName}: ${t.roles.map(r => r.name).join(' + ')} · ${t.dataScope === 'ALL' ? 'all data' : 'own data'}${t.canEdit ? '' : ' · view only'}`).join('   |   ')}
      />
      {allTypes.length > 1 && <FilterBar filters={[{ name: 'wt', label: 'Work type', options: allTypes.map(t => ({ value: t.workTypeKey, label: t.workTypeName })) }]} />}
      {workTypes.length > 0 && <MyWorkSection user={user} types={workTypes} tz={tz} />}
      {reviewTypes.length > 0 && <ReviewSection user={user} access={access} types={reviewTypes} tz={tz} />}
      {teamTypes.length > 0 && <TeamSection access={access} types={teamTypes} tz={tz} />}
      {nothingElse && <VisibleItemsSection user={user} access={access} types={types} tz={tz} />}
    </>
  );
}
