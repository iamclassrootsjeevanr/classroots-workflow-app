import { NewItemForm } from '@/components/admin-controls';
import { FilterBar } from '@/components/filter-bar';
import { ItemsTable } from '@/components/items-table';
import { NewApkVersionButton } from '@/components/new-apk-version';
import { Pager } from '@/components/pager';
import Link from 'next/link';
import { Card } from '@/components/ui';
import { developerStage, nextActiveAfter } from '@/lib/stages';
import { getModule } from '@/modules/registry';
import { db } from '@/server/db';
import { teamOf } from '@/lib/teams';
import { loadTeams } from '@/server/teams';
import { loadVersionOptions } from '@/server/apk/queries';
import { queryItemsPage, type ItemsFilters } from '@/server/services/items-query';
import { loadWorkTypePage } from '@/server/work-type-page';
import { assignableItemsFor, assignablePeople, deletableItemsFor, developerEditsFor, developerPeople, editableItemsFor, statusOptionsFor } from '@/server/view';

type Search = ItemsFilters & { page?: string };

export async function generateMetadata({ params }: { params: Promise<{ workType: string }> }) {
  const { workType } = await params;
  const mod = getModule(workType);
  return { title: mod ? `${mod.name} · ${mod.pages?.items ?? 'Items'}` : 'Work' };
}

const natural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

/** The item table. Filters, counting and paging run in the database, so only the 50 rows on screen are loaded. */
export default async function ItemsPage({ params, searchParams }: { params: Promise<{ workType: string }>; searchParams: Promise<Search> }) {
  const { workType: key } = await params;
  const sp = await searchParams;
  const { user, access, wtAccess, mod, wt, items: lite, scope, can, tz, editable } = await loadWorkTypePage(key);

  // APK Testing lists the APK versions (the work); ?view=tests lists the test results instead.
  const testsView = mod.storage === 'apk' && sp.view === 'tests';
  const shown = await queryItemsPage(mod, scope, sp, user.id, Number(sp.page));
  const [options, edits, deletable, assignable, people, owners, devs, groups, gradeRows] = await Promise.all([
    editable ? statusOptionsFor(user, shown.rows) : Promise.resolve(undefined),
    editable ? editableItemsFor(user, shown.rows) : Promise.resolve(undefined),
    editable ? deletableItemsFor(user, shown.rows) : Promise.resolve(undefined),
    editable ? assignableItemsFor(user, shown.rows) : Promise.resolve(undefined),
    can('assign') && editable ? assignablePeople(lite, [key]) : Promise.resolve(undefined),
    db.user.findMany({ where: { ownedItems: { some: { workTypeId: wt.id } } }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    db.user.findMany({ where: { assignedItems: { some: { workTypeId: wt.id } } }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    db.workItem.findMany({ where: { workTypeId: wt.id, archivedAt: null, groupKey: { not: null } }, distinct: ['groupKey'], select: { groupKey: true } }),
    db.workItem.findMany({ where: { workTypeId: wt.id, archivedAt: null, chapter: { grade: { not: null } } }, distinct: ['chapterId'], select: { chapter: { select: { grade: true } } } }),
  ]);
  const hand = mod.developerHandoff;
  const developerEdits = hand && editable && !testsView ? await developerEditsFor(user, shown.rows) : undefined;
  const developerOptions = hand && developerEdits?.size ? await developerPeople(key, hand.role, nextActiveAfter(mod.statuses, hand.after)) : undefined;
  const smeOptions = can('create') && editable && !mod.versions
    ? await db.user.findMany({
        where: { active: true, name: { not: null }, OR: [{ isAdmin: true }, { memberships: { some: { workTypeId: wt.id, roles: { some: { role: { capReview: true } } } } } }] },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      })
    : [];
  const versions = mod.versions ? await loadVersionOptions(wt.id) : [];
  const teams = mod.teams ? await loadTeams(db, [wt.id]) : [];
  const hasTeam = Boolean(teamOf(teams, user.id));
  const groupNames = groups.map(g => g.groupKey as string).sort(natural);
  const grades = [...new Set(gradeRows.map(r => r.chapter?.grade).filter((g): g is number => g != null))].sort((a, b) => a - b);

  const STAGE_NAMES: Record<string, string> = { queue: 'To start', active: 'In progress', feedback: 'In corrections', review: 'In review', approved: 'Approved', done: 'Done', hold: 'On hold' };
  const stages = [...new Set(mod.statuses.map(s => s.category))].map(c => ({ value: c, label: mod.categoryLabels?.[c] ?? STAGE_NAMES[c] ?? c }));

  return (
    <>
      {mod.storage === 'apk' && (
        <nav className="mb-4 inline-flex rounded-lg border border-line bg-surface-2 p-0.5" aria-label="List shows">
          {[
            ['APK versions', `/w/${key}/items`, !testsView],
            ['All tests', `/w/${key}/items?view=tests`, testsView],
          ].map(([label, href, on]) => (
            <Link key={String(label)} href={String(href)} aria-current={on ? 'page' : undefined} className={`rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${on ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}>
              {label}
            </Link>
          ))}
        </nav>
      )}
      {can('create') && editable && (
        <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
          {mod.versions ? (
            <NewApkVersionButton workTypeId={wt.id} versions={versions} people={people} />
          ) : (
            <NewItemForm
              workTypeId={wt.id}
              noun={mod.itemNoun}
              smes={smeOptions.map(u => ({ id: u.id, name: u.name! }))}
              developers={people ?? []}
              labels={mod.labels}
              ownerDefault={mod.teams ? 'Team default' : undefined}
              groups={mod.groupFromKey ? (wtAccess.groupKeys && !access.isAdmin ? [...wtAccess.groupKeys].sort() : groupNames) : undefined}
              keyExample={mod.keyExample}
              showDue={!mod.fields.some(f => f.key === 'dueAt' && f.computed)}
            />
          )}
        </div>
      )}

      <FilterBar
        filters={[
          { name: 'q', label: 'Search', type: 'search' },
          ...(groupNames.length ? [{ name: 'group', label: mod.labels?.group ?? 'Group', options: groupNames.map(g => ({ value: g, label: g })) }] : []),
          { name: 'cat', label: 'Stage', options: stages },
          { name: 'status', label: 'Status', options: mod.statuses.map(s => ({ value: s.key, label: s.label })) },
          { name: 'dev', label: mod.labels?.assignee ?? 'Developer', options: [{ value: 'none', label: 'Unassigned' }, ...devs.map(d => ({ value: d.id, label: d.name ?? '?' }))] },
          ...(owners.length && !mod.table?.hide?.includes('owner') ? [{ name: 'sme', label: mod.labels?.owner ?? 'SME', options: owners.map(o => ({ value: o.id, label: o.name ?? '?' })) }] : []),
          ...(teams.length ? [{ name: 'team', label: 'Team', options: teams.map(t => ({ value: t.id, label: t.name })) }] : []),
          ...(grades.length ? [{ name: 'grade', label: 'Grade', options: grades.map(g => ({ value: String(g), label: `Grade ${g}` })) }] : []),
          { name: 'scope', label: 'Show', options: [{ value: 'mine', label: 'Mine' }, ...(hasTeam ? [{ value: 'team', label: 'My team' }] : []), { value: 'review', label: 'Waiting for review' }, { value: 'overdue', label: 'Overdue' }] },
        ]}
      />

      <Card>
        <ItemsTable items={shown.rows} statusOptions={options} fieldEdits={edits} deletable={deletable} people={people} assignable={assignable} developerEdits={developerEdits} developerOptions={developerOptions} developerColor={developerStage(mod.statuses, hand, undefined).color} tz={tz} labels={mod.labels} table={testsView ? mod.runTable : mod.table} groupByChapter={testsView || !mod.versions} empty={`No ${testsView ? 'tests' : `${mod.itemNoun}s`} match these filters.`} />
        <Pager basePath={`/w/${key}/items`} params={sp as Record<string, string | undefined>} page={shown.page} pages={shown.pages} from={shown.from} to={shown.to} total={shown.total} />
      </Card>
    </>
  );
}
