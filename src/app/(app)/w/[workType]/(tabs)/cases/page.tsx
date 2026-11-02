import { notFound } from 'next/navigation';
import { CasesTable } from '@/components/cases-table';
import { AddTestCaseButton } from '@/components/new-apk-version';
import { Card } from '@/components/ui';
import { rollupCases, versionOptions } from '@/lib/test-cases';
import { getModule } from '@/modules/registry';
import { loadWorkTypePage } from '@/server/work-type-page';

export async function generateMetadata({ params }: { params: Promise<{ workType: string }> }) {
  const { workType } = await params;
  const mod = getModule(workType);
  return { title: mod ? `${mod.name} · ${mod.pages?.cases ?? 'Cases'}` : 'Work' };
}

/** The list of test cases (one row per case, across all versions). */
export default async function CasesPage({ params }: { params: Promise<{ workType: string }> }) {
  const { workType: key } = await params;
  const { user, access, mod, wt, items, can, editable } = await loadWorkTypePage(key);
  if (!mod.versions) notFound();
  const rows = rollupCases(items);
  const versions = versionOptions(items);
  const canTest = access.isAdmin || access.byKey.get(key)?.capabilities.has('work');
  const canEdit = editable && (can('create') || can('manageFields'));

  return (
    <>
      {can('create') && editable && (
        <div className="mb-4 flex justify-end">
          <AddTestCaseButton workTypeId={wt.id} versions={versions} assigneeId={canTest ? user.id : undefined} />
        </div>
      )}
      <Card title={`${rows.length} test cases`} description="One row per test case. The latest result is from the newest version that has the case. Edit changes the case in that version.">
        <CasesTable rows={rows} canEdit={canEdit} />
      </Card>
    </>
  );
}
