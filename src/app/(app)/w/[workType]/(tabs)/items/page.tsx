import { NewItemForm } from '@/components/admin-controls';
import { FilterBar } from '@/components/filter-bar';
import { ItemsTable } from '@/components/items-table';
import { AddTestCaseButton, type VersionOption } from '@/components/new-apk-version';
import { Card } from '@/components/ui';
import { inList } from '@/lib/items-url';
import { versionOptions } from '@/lib/test-cases';
import { getModule } from '@/modules/registry';
import { db } from '@/server/db';
import { loadWorkTypePage } from '@/server/work-type-page';
import { assignablePeople, deletableItemsFor, editableFieldsFor, statusOptionsFor } from '@/server/view';

type Search = { status?: string; dev?: string; sme?: string; grade?: string; q?: string; scope?: string; group?: string; cat?: string };

export async function generateMetadata({ params }: { params: Promise<{ workType: string }> }) {
  const { workType } = await params;
  const mod = getModule(workType);
  return { title: mod ? `${mod.name} · ${mod.pages?.items ?? 'Items'}` : 'Work' };
}

/** The item table: filters, inline status and assignee changes, edit and delete per row. */
export default async function ItemsPage({ params, searchParams }: { params: Promise<{ workType: string }>; searchParams: Promise<Search> }) {
  const { workType: key } = await params;
  const sp = await searchParams;
  const { user, access, mod, wt, items: all, can, tz, editable } = await loadWorkTypePage(key);

  let items = all;
  if (sp.group) items = items.filter(i => i.groupKey === sp.group);
  if (sp.grade) items = items.filter(i => String(i.grade) === sp.grade);
  if (sp.cat) items = items.filter(i => inList(i.category, sp.cat));
  if (sp.status) items = items.filter(i => inList(i.status, sp.status));
  if (sp.dev) items = items.filter(i => (sp.dev === 'none' ? !i.assigneeId : i.assigneeId === sp.dev));
  if (sp.sme) items = items.filter(i => i.ownerId === sp.sme);
  if (sp.scope === 'mine') items = items.filter(i => i.assigneeId === user.id || i.ownerId === user.id);
  if (sp.scope === 'overdue') items = items.filter(i => i.category !== 'done' && i.dueAt && i.dueAt < new Date());
  if (sp.scope === 'review') items = items.filter(i => i.category === 'review');
  if (sp.q) {
    const q = sp.q.toLowerCase();
    items = items.filter(i => i.externalKey.toLowerCase().includes(q) || i.title.toLowerCase().includes(q) || (i.chapterTitle ?? '').toLowerCase().includes(q));
  }

  const [options, edits, deletable, people, owners, grades] = await Promise.all([
    editable ? statusOptionsFor(user, items) : Promise.resolve(undefined),
    editable ? editableFieldsFor(user, items, tz) : Promise.resolve(undefined),
    editable ? deletableItemsFor(user, items) : Promise.resolve(undefined),
    can('assign') && editable ? assignablePeople(all, [key]) : Promise.resolve(undefined),
    db.user.findMany({ where: { ownedItems: { some: { workTypeId: wt.id } } }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    db.chapter.findMany({ where: { grade: { not: null } }, distinct: ['grade'], select: { grade: true }, orderBy: { grade: 'asc' } }),
  ]);
  const devs = await db.user.findMany({ where: { assignedItems: { some: { workTypeId: wt.id } } }, select: { id: true, name: true }, orderBy: { name: 'asc' } });
  const smeOptions = await db.user.findMany({
    where: { active: true, name: { not: null }, OR: [{ isAdmin: true }, { memberships: { some: { workTypeId: wt.id, roles: { some: { role: { capReview: true } } } } } }] },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  const versions: VersionOption[] = mod.versions ? versionOptions(all) : [];
  const groups = [...new Set(all.map(i => i.groupKey).filter((g): g is string => Boolean(g)))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const STAGE_NAMES: Record<string, string> = { queue: 'To start', active: 'In progress', feedback: 'In corrections', review: 'In review', approved: 'Approved', done: 'Done', hold: 'On hold' };
  const stages = [...new Set(mod.statuses.map(s => s.category))].map(c => ({ value: c, label: mod.categoryLabels?.[c] ?? STAGE_NAMES[c] ?? c }));
  const canTest = access.isAdmin || access.byKey.get(key)?.capabilities.has('work');

  return (
    <>
      {can('create') && editable && (
        <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
          {mod.versions ? (
            <AddTestCaseButton workTypeId={wt.id} versions={versions} assigneeId={canTest ? user.id : undefined} />
          ) : (
            <NewItemForm workTypeId={wt.id} noun={mod.itemNoun} smes={smeOptions.map(u => ({ id: u.id, name: u.name! }))} developers={people ?? []} />
          )}
        </div>
      )}

      <FilterBar
        filters={[
          { name: 'q', label: 'Search', type: 'search' },
          ...(groups.length ? [{ name: 'group', label: mod.labels?.group ?? 'Group', options: groups.map(g => ({ value: g, label: g })) }] : []),
          { name: 'cat', label: 'Stage', options: stages },
          { name: 'status', label: 'Status', options: mod.statuses.map(s => ({ value: s.key, label: s.label })) },
          { name: 'dev', label: mod.labels?.assignee ?? 'Developer', options: [{ value: 'none', label: 'Unassigned' }, ...devs.map(d => ({ value: d.id, label: d.name ?? '?' }))] },
          ...(owners.length && !mod.table?.hide?.includes('owner') ? [{ name: 'sme', label: mod.labels?.owner ?? 'SME', options: owners.map(o => ({ value: o.id, label: o.name ?? '?' })) }] : []),
          ...(all.some(i => i.grade) ? [{ name: 'grade', label: 'Grade', options: grades.map(g => ({ value: String(g.grade), label: `Grade ${g.grade}` })) }] : []),
          { name: 'scope', label: 'Show', options: [{ value: 'mine', label: 'Mine' }, { value: 'review', label: 'Waiting for review' }, { value: 'overdue', label: 'Overdue' }] },
        ]}
      />

      <Card>
        <ItemsTable items={items} statusOptions={options} fieldEdits={edits} deletable={deletable} people={people} tz={tz} labels={mod.labels} table={mod.table} empty="No items match these filters." />
        <p className="mt-2 text-xs text-muted">
          Showing {items.length} of {all.length}
        </p>
      </Card>
    </>
  );
}
