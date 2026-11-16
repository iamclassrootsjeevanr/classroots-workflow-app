import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AddChapterForm, RemoveChapterButton } from '@/components/chapters-panel';
import { GroupSummaryCard } from '@/components/group-summary';
import { NewApkVersionButton } from '@/components/new-apk-version';
import { Sheet } from '@/components/sheet';
import { Card, Empty } from '@/components/ui';
import { itemsUrl } from '@/lib/items-url';
import { coordinatedPeople } from '@/lib/teams';
import { loadVersionOptions } from '@/server/apk/queries';
import { db } from '@/server/db';
import { loadItems, type ItemRow } from '@/server/services/analytics';
import { loadStewards, loadTeams } from '@/server/teams';
import { getModule } from '@/modules/registry';
import { loadWorkTypePage } from '@/server/work-type-page';
import { assignablePeople } from '@/server/view';

export async function generateMetadata({ params }: { params: Promise<{ workType: string }> }) {
  const { workType } = await params;
  const mod = getModule(workType);
  return { title: mod ? `${mod.name} · ${mod.pages?.groups ?? 'Versions'}` : 'Work' };
}

const natural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

/**
 * Per-group results: the full-width chart, then the table. For APK Testing this is where versions are added and edited.
 * Work types with teams (Journey) list their chapters with the steward of each, all of them or only mine, and coordinators add
 * and remove chapters here.
 */
export default async function VersionsPage({ params, searchParams }: { params: Promise<{ workType: string }>; searchParams: Promise<{ view?: string }> }) {
  const { workType: key } = await params;
  const { view } = await searchParams;
  const { user, access, wtAccess, mod, wt, items: lite, scope, can, tz, editable } = await loadWorkTypePage(key);
  if (!mod.groupSummary) notFound();
  const [all, versions] = await Promise.all([loadItems({ workTypeKeys: [key], where: scope, level: 'groups' }), mod.versions ? loadVersionOptions(wt.id) : Promise.resolve([])]);
  const people = can('assign') && editable ? await assignablePeople(lite, [key]) : undefined;

  const chapters = mod.teams ? await chapterList(wt.id, all, user.id, wtAccess.groupKeys) : null;
  const mine = Boolean(chapters) && view === 'mine';
  const items = mine ? all.filter(i => i.groupKey && chapters!.mine.has(i.groupKey)) : all;
  const rows = chapters ? chapters.rows.filter(r => !mine || chapters.mine.has(r.code)) : [];
  const groupLabel = mod.groupSummary.label;
  // APK Testing: a version is a work item, so its name opens the version page.
  const versionId = new Map(mod.storage === 'apk' ? lite.map(i => [i.externalKey, i.id]) : []);
  const canAdd = editable && (access.isAdmin || (can('assign') && can('create')));
  const tab = (href: string, label: string, on: boolean) => (
    <Link href={href} aria-current={on ? 'page' : undefined} className={`rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${on ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}>
      {label}
    </Link>
  );

  return (
    <>
      {mod.versions && can('create') && editable && (
        <div className="mb-4 flex justify-end">
          <NewApkVersionButton workTypeId={wt.id} versions={versions} people={people} />
        </div>
      )}
      {chapters && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <nav className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5" aria-label={`${groupLabel}s shown`}>
              {tab(`/w/${key}/versions`, `All ${groupLabel.toLowerCase()}s`, !mine)}
              {tab(`/w/${key}/versions?view=mine`, `My ${groupLabel.toLowerCase()}s`, mine)}
            </nav>
            {canAdd && <AddChapterForm workTypeId={wt.id} known={chapters.known} stewards={access.isAdmin ? chapters.coordinators : undefined} example={mod.keyExample?.slice(0, 6)} />}
          </div>
          <Card title={mine ? `My ${groupLabel.toLowerCase()}s` : `${groupLabel}s and their stewards`} description={`The steward owns the ${groupLabel.toLowerCase()}: every ${mod.itemNoun} in it is theirs to see through. A ${mod.itemNoun} given to another team’s creator is owned by that team’s steward.`} className="mb-5">
            {rows.length ? (
              <Sheet maxHeight="50vh">
                <table className="sheet">
                  <thead>
                    <tr>
                      <th className="pin">{groupLabel}</th>
                      <th>Name</th>
                      <th>Steward</th>
                      <th>{mod.pages?.items ?? 'Items'}</th>
                      <th>Open</th>
                      {rows.some(r => r.canRemove) && editable && <th className="pin-end">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.code}>
                        <td className="pin font-mono text-xs font-medium">
                          <Link className="link" href={itemsUrl(key, { group: r.code })}>
                            {r.code}
                          </Link>
                        </td>
                        <td>{r.title || '—'}</td>
                        <td className="whitespace-nowrap">{r.stewards || <span className="text-muted">No steward</span>}</td>
                        <td className="tabular-nums">
                          <Link className="link" href={itemsUrl(key, { group: r.code })}>
                            {r.total}
                          </Link>
                        </td>
                        <td className="tabular-nums">
                          <Link className="link" href={itemsUrl(key, { group: r.code, cat: ['queue', 'active', 'review', 'feedback', 'approved', 'hold'] })}>
                            {r.open}
                          </Link>
                        </td>
                        {rows.some(x => x.canRemove) && editable && <td className="pin-end">{r.canRemove && <RemoveChapterButton workTypeId={wt.id} code={r.code} />}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Sheet>
            ) : (
              <Empty>{mine ? `You have no ${groupLabel.toLowerCase()}s yet.` : `No ${groupLabel.toLowerCase()}s yet.`}</Empty>
            )}
          </Card>
        </>
      )}
      {items.length ? (
        <GroupSummaryCard
          mod={mod}
          items={items}
          tz={tz}
          versionEdit={mod.versions && editable && (can('create') || can('manageFields')) ? { workTypeId: wt.id, canDelete: can('manageFields') } : undefined}
          groupHref={g => (versionId.get(g) ? `/w/${key}/${versionId.get(g)}` : itemsUrl(key, { group: g }))}
          itemsHref={itemsUrl(key)}
        />
      ) : (
        !chapters && <Empty>No {mod.groupSummary.label.toLowerCase()}s yet.</Empty>
      )}
    </>
  );

  /** Chapters with journeys or a steward; "mine" = the ones I steer, plus those holding journeys of mine or of my team. */
  async function chapterList(workTypeId: string, list: ItemRow[], me: string, myGroups: ReadonlySet<string> | null) {
    const [stewards, teams, reference, coordinators] = await Promise.all([
      loadStewards(db, [workTypeId]),
      loadTeams(db, [workTypeId]),
      db.chapter.findMany({ select: { code: true, title: true }, orderBy: { code: 'asc' } }),
      db.user.findMany({
        where: { active: true, memberships: { some: { workTypeId, roles: { some: { role: { capAssign: true, canEdit: true } } } } } },
        select: { id: true, name: true, email: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    const titleOf = new Map(reference.map(c => [c.code, c.title]));
    const steered = [...stewards.keys()].map(k => k.slice(workTypeId.length + 1));
    const codes = [...new Set([...list.map(i => i.groupKey).filter((g): g is string => Boolean(g)), ...steered])].sort(natural);
    const myPeople = new Set([me, ...coordinatedPeople(teams, me)]);
    const mineSet = new Set<string>([
      ...codes.filter(c => stewards.get(`${workTypeId}:${c}`)?.some(s => s.userId === me)),
      ...list.filter(i => i.groupKey && ((i.assigneeId && myPeople.has(i.assigneeId)) || i.ownerId === me || i.peerReviewerId === me)).map(i => i.groupKey!),
    ]);
    const isAdmin = access.isAdmin;
    return {
      mine: mineSet,
      known: reference.filter(c => !steered.includes(c.code)),
      coordinators: coordinators.map(u => ({ id: u.id, name: u.name ?? u.email ?? '?' })),
      rows: codes.map(code => {
        const inIt = list.filter(i => i.groupKey === code);
        return {
          code,
          title: titleOf.get(code) ?? inIt[0]?.chapterTitle ?? '',
          stewards: stewards.get(`${workTypeId}:${code}`)?.map(s => s.name).join(', ') ?? '',
          total: inIt.length,
          open: inIt.filter(i => i.category !== 'done').length,
          canRemove: steered.includes(code) && (isAdmin || (can('assign') && Boolean(myGroups?.has(code)))),
        };
      }),
    };
  }
}
