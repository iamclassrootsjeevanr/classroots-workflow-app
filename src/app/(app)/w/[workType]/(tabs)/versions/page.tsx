import { notFound } from 'next/navigation';
import { GroupSummaryCard } from '@/components/group-summary';
import { NewApkVersionButton } from '@/components/new-apk-version';
import { Empty } from '@/components/ui';
import { versionOptions } from '@/lib/test-cases';
import { getModule } from '@/modules/registry';
import { loadWorkTypePage } from '@/server/work-type-page';
import { assignablePeople } from '@/server/view';

export async function generateMetadata({ params }: { params: Promise<{ workType: string }> }) {
  const { workType } = await params;
  const mod = getModule(workType);
  return { title: mod ? `${mod.name} · ${mod.pages?.groups ?? 'Versions'}` : 'Work' };
}

/** Per-group results: the full-width chart, then the table. For APK Testing this is where versions are added and edited. */
export default async function VersionsPage({ params }: { params: Promise<{ workType: string }> }) {
  const { workType: key } = await params;
  const { mod, wt, items, can, tz, editable } = await loadWorkTypePage(key);
  if (!mod.groupSummary) notFound();
  const people = can('assign') && editable ? await assignablePeople(items, [key]) : undefined;

  return (
    <>
      {mod.versions && can('create') && editable && (
        <div className="mb-4 flex justify-end">
          <NewApkVersionButton workTypeId={wt.id} versions={versionOptions(items)} people={people} />
        </div>
      )}
      {items.length ? (
        <GroupSummaryCard
          mod={mod}
          items={items}
          tz={tz}
          versionEdit={mod.versions && editable && (can('create') || can('manageFields')) ? { workTypeId: wt.id } : undefined}
          groupHref={g => `/w/${key}/items?group=${encodeURIComponent(g)}`}
        />
      ) : (
        <Empty>No {mod.groupSummary.label.toLowerCase()}s yet.</Empty>
      )}
    </>
  );
}
