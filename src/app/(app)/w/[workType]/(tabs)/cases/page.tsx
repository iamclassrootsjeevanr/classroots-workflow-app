import { notFound } from 'next/navigation';
import { CasesTable } from '@/components/cases-table';
import { FilterBar } from '@/components/filter-bar';
import { AddTestCaseButton } from '@/components/new-apk-version';
import { Pager } from '@/components/pager';
import { Card } from '@/components/ui';
import { PAGE_SIZE } from '@/lib/paging';
import type { CaseRow } from '@/lib/test-cases';
import { getModule, statusDef } from '@/modules/registry';
import { loadVersionOptions } from '@/server/apk/queries';
import { db } from '@/server/db';
import { loadWorkTypePage } from '@/server/work-type-page';

export async function generateMetadata({ params }: { params: Promise<{ workType: string }> }) {
  const { workType } = await params;
  const mod = getModule(workType);
  return { title: mod ? `${mod.name} · ${mod.pages?.cases ?? 'Cases'}` : 'Work' };
}

/** The list of test cases, read straight from the test case table (50 per page), each with its latest run. */
export default async function CasesPage({ params, searchParams }: { params: Promise<{ workType: string }>; searchParams: Promise<{ q?: string; page?: string }> }) {
  const { workType: key } = await params;
  const sp = await searchParams;
  const { user, access, mod, wt, can, editable } = await loadWorkTypePage(key);
  if (!mod.versions) notFound();

  const q = sp.q?.trim();
  const where = { workTypeId: wt.id, archivedAt: null, ...(q ? { OR: [{ code: { contains: q, mode: 'insensitive' as const } }, { title: { contains: q, mode: 'insensitive' as const } }] } : {}) };
  const total = await db.apkTestCase.count({ where });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(Number(sp.page)) || 1), pages);
  const live = { item: { archivedAt: null } };
  const found = await db.apkTestCase.findMany({
    where,
    orderBy: { code: 'asc' },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: {
      _count: { select: { tests: { where: live } } },
      tests: { where: live, orderBy: { version: { key: 'desc' } }, take: 1, select: { version: { select: { key: true } }, item: { select: { status: true } } } },
    },
  });
  const rows: CaseRow[] = found.map(c => {
    const last = c.tests[0];
    const def = last ? statusDef(mod, last.item.status) : null;
    return {
      id: c.code,
      title: c.title,
      scenario: c.scenario ?? '',
      expected: c.expected ?? '',
      steps: c.steps ?? '',
      priority: c.defaultPriority ?? '',
      caseId: c.id,
      versionCount: c._count.tests,
      latestVersion: last?.version.key ?? '',
      latestStatus: def?.label ?? 'No runs',
      latestColor: def?.color ?? '#90a4ae',
    };
  });
  const versions = await loadVersionOptions(wt.id);
  const canTest = access.isAdmin || access.byKey.get(key)?.capabilities.has('work');
  const canEdit = editable && (can('create') || can('manageFields'));

  return (
    <>
      {can('create') && editable && (
        <div className="mb-4 flex justify-end">
          <AddTestCaseButton workTypeId={wt.id} versions={versions} assigneeId={canTest ? user.id : undefined} />
        </div>
      )}
      <FilterBar filters={[{ name: 'q', label: 'Search', type: 'search' }]} />
      <Card title={`${total} test cases`} description="One row per test case. The latest result is from the newest version that ran it. Edit changes the test case itself, so every version that runs it shows the new text.">
        <CasesTable rows={rows} canEdit={canEdit} workTypeId={wt.id} />
        <Pager basePath={`/w/${key}/cases`} params={sp} page={page} pages={pages} from={total ? (page - 1) * PAGE_SIZE + 1 : 0} to={Math.min(total, page * PAGE_SIZE)} total={total} />
      </Card>
    </>
  );
}
