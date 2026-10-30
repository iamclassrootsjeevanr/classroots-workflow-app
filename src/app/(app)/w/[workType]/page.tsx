import { notFound } from 'next/navigation';
import { NewItemForm } from '@/components/admin-controls';
import { FilterBar } from '@/components/filter-bar';
import { GroupSummaryCard } from '@/components/group-summary';
import { ItemsTable } from '@/components/items-table';
import { Card, PageHeader } from '@/components/ui';
import { kpis } from '@/lib/analytics-core';
import { getModule } from '@/modules/registry';
import { db } from '@/server/db';
import type { Capability } from '@/lib/access-core';
import { requireWorkTypePage, scopeWhere } from '@/server/access';
import { appTz } from '@/server/settings';
import { loadItems } from '@/server/services/analytics';
import { assignablePeople, statusOptionsFor } from '@/server/view';

type Search = { status?: string; dev?: string; sme?: string; grade?: string; q?: string; scope?: string };

export async function generateMetadata({ params }: { params: Promise<{ workType: string }> }) {
  const { workType } = await params;
  return { title: getModule(workType)?.name ?? 'Work' };
}

export default async function WorkTypePage({ params, searchParams }: { params: Promise<{ workType: string }>; searchParams: Promise<Search> }) {
  const { workType: key } = await params;
  const { user, access, wt: wtAccess } = await requireWorkTypePage(key, 'items');
  const sp = await searchParams;
  const mod = getModule(key);
  const wt = await db.workType.findUnique({ where: { key } });
  if (!mod || !wt) notFound();

  const can = (c: Capability) => access.isAdmin || (wtAccess.canEdit && wtAccess.capabilities.has(c));
  const tz = appTz();
  let items = await loadItems({ workTypeKeys: [key], grade: sp.grade ? Number(sp.grade) : undefined, where: scopeWhere(access, [wtAccess]) });
  const all = items;
  if (sp.status) items = items.filter(i => i.status === sp.status);
  if (sp.dev) items = items.filter(i => (sp.dev === 'none' ? !i.assigneeId : i.assigneeId === sp.dev));
  if (sp.sme) items = items.filter(i => i.ownerId === sp.sme);
  if (sp.scope === 'mine') items = items.filter(i => i.assigneeId === user.id || i.ownerId === user.id);
  if (sp.scope === 'review') items = items.filter(i => i.category === 'review');
  if (sp.q) {
    const q = sp.q.toLowerCase();
    items = items.filter(i => i.externalKey.toLowerCase().includes(q) || i.title.toLowerCase().includes(q) || (i.chapterTitle ?? '').toLowerCase().includes(q));
  }

  const editable = wt.state === 'ACTIVE';
  const [options, people, owners, grades] = await Promise.all([
    editable ? statusOptionsFor(user, items) : Promise.resolve(undefined),
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
  const k = kpis(all, new Date());

  return (
    <>
      <PageHeader
        title={mod.name}
        subtitle={`${wtAccess.dataScope === 'ALL' ? '' : 'Your items · '}${wtAccess.canEdit ? '' : 'View only · '}${k.total} ${mod.itemNoun}s · ${k.unassigned} unassigned · ${k.inProgress} in progress · ${k.inReview} in review · ${k.done} done · ${k.overdue} overdue`}
        actions={
          can('create') &&
          editable && (
            <NewItemForm
              workTypeId={wt.id}
              noun={mod.itemNoun}
              smes={smeOptions.map(u => ({ id: u.id, name: u.name! }))}
              developers={people ?? []}
            />
          )
        }
      />
      {wt.state === 'PAUSED' && (
        <p className="note-warn mb-4">This work type is paused. Items are read-only and sheet sync is stopped until an admin resumes it.</p>
      )}

      <FilterBar
        filters={[
          { name: 'q', label: 'Search', type: 'search' },
          { name: 'status', label: 'Status', options: mod.statuses.map(s => ({ value: s.key, label: s.label })) },
          { name: 'dev', label: mod.labels?.assignee ?? 'Developer', options: [{ value: 'none', label: 'Unassigned' }, ...devs.map(d => ({ value: d.id, label: d.name ?? '?' }))] },
          ...(owners.length ? [{ name: 'sme', label: mod.labels?.owner ?? 'SME', options: owners.map(o => ({ value: o.id, label: o.name ?? '?' })) }] : []),
          ...(all.some(i => i.grade) ? [{ name: 'grade', label: 'Grade', options: grades.map(g => ({ value: String(g.grade), label: `Grade ${g.grade}` })) }] : []),
          { name: 'scope', label: 'Show', options: [{ value: 'mine', label: 'Mine' }, { value: 'review', label: 'Waiting for review' }] },
        ]}
      />

      <GroupSummaryCard mod={mod} items={all} tz={tz} />

      <Card>
        <ItemsTable items={items} statusOptions={options} people={people} tz={tz} labels={mod.labels} empty="No items match these filters." />
        <p className="mt-2 text-xs text-muted">
          Showing {items.length} of {all.length}
        </p>
      </Card>
    </>
  );
}
