import { PathTabs } from '@/components/path-tabs';
import { PageHeader } from '@/components/ui';
import { boardView } from '@/lib/access-core';
import { workTypeTabs } from '@/lib/work-type-tabs';
import { loadWorkTypePage } from '@/server/work-type-page';

/** Header and tab bar shared by the pages of one work type (the item page has its own). */
export default async function WorkTypeLayout({ children, params }: { children: React.ReactNode; params: Promise<{ workType: string }> }) {
  const { workType: key } = await params;
  const { mod, access, wtAccess, kpis: k, wt } = await loadWorkTypePage(key);
  return (
    <>
      <PageHeader
        title={mod.name}
        subtitle={`${wtAccess.dataScope === 'ALL' ? '' : 'Your items · '}${wtAccess.canEdit ? '' : 'View only · '}${k.total} ${mod.itemNoun}s · ${k.unassigned} unassigned · ${k.inProgress} in progress · ${k.inReview} in review · ${k.done} done · ${k.overdue} overdue`}
      />
      {wt.state === 'PAUSED' && <p className="note-warn mb-4">This work type is paused. Items are read-only and sheet sync is stopped until an admin resumes it.</p>}
      <PathTabs items={workTypeTabs(mod, { board: Boolean(boardView(access.isAdmin, wtAccess)), feedback: access.isAdmin || wtAccess.canEdit })} />
      {children}
    </>
  );
}
