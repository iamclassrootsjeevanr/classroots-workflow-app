import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AddChapterForm, ChangeStewardButton, RemoveChapterButton } from '@/components/chapters-panel';
import { GroupSummaryCard } from '@/components/group-summary';
import { NewApkVersionButton } from '@/components/new-apk-version';
import { Sheet } from '@/components/sheet';
import { Card, Empty } from '@/components/ui';
import { itemsUrl } from '@/lib/items-url';
import { chapterProgress, type ChapterFeedRow } from '@/lib/relay-chapters';
import { displayNameFromEmail } from '@/lib/relay-map';
import { formatDate } from '@/lib/time';
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
  // Journey: what the relay recorded for each chapter before its journeys exist here (the chapter read, the scopes).
  const relay = mod.relayBoard && chapters ? (await relayProgress(wt.id)).filter(r => !mine || chapters.mine.has(r.code)) : [];
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
                      {rows.some(r => r.canRemove || r.canMove) && editable && <th className="pin-end">Actions</th>}
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
                        {rows.some(x => x.canRemove || x.canMove) && editable && (
                          <td className="pin-end">
                            <span className="inline-flex flex-wrap items-start justify-end gap-1">
                              {r.canMove && <ChangeStewardButton workTypeId={wt.id} code={r.code} current={r.stewards} stewards={chapters.coordinators} />}
                              {r.canRemove && <RemoveChapterButton workTypeId={wt.id} code={r.code} />}
                            </span>
                          </td>
                        )}
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
      {relay.length > 0 && (
        <Card title="Relay progress" description={`What the relay recorded for each ${groupLabel.toLowerCase()} before its ${mod.itemNoun}s are allocated: the chapter read (stage 1) and the scopes (stage 2).`} className="mb-5">
          <Sheet maxHeight="50vh">
            <table className="sheet">
              <thead>
                <tr>
                  <th className="pin">{groupLabel}</th>
                  <th>Steward on the relay</th>
                  <th>Chapter read</th>
                  <th>Scopes approved</th>
                  <th>Scoped by</th>
                  <th>{mod.pages?.items ?? 'Items'} cut</th>
                  <th>Allocated</th>
                </tr>
              </thead>
              <tbody>
                {relay.map(r => (
                  <tr key={r.code}>
                    <td className="pin font-mono text-xs font-medium">
                      {r.allocated ? (
                        <Link className="link" href={itemsUrl(key, { group: r.code })}>
                          {r.code}
                        </Link>
                      ) : (
                        r.code
                      )}
                    </td>
                    <td className="whitespace-nowrap">{r.steward ?? <span className="text-muted">Not allocated</span>}</td>
                    <td className="whitespace-nowrap" data-fv={r.read.approved ? 'Approved' : 'Not yet'}>
                      {r.read.approved ? (
                        <>
                          Approved <span className="text-xs text-muted">{r.read.at ? formatDate(r.read.at, tz) : ''}</span>
                        </>
                      ) : (
                        <span className="text-muted">Not yet</span>
                      )}
                    </td>
                    <td className="tabular-nums" title={r.scopesApproved.join(', ')}>
                      {r.subtopics.length ? `${r.scopesApproved.length} of ${r.subtopics.length}` : <span className="text-muted">—</span>}
                    </td>
                    <td>{r.scopeMode === 'seats' ? 'Seats' : 'Steward'}</td>
                    <td className="tabular-nums" title={r.journeysCut.join(', ')}>
                      {r.journeysCut.length}
                    </td>
                    <td className="tabular-nums">
                      {r.allocated ? (
                        <Link className="link" href={itemsUrl(key, { group: r.code })}>
                          {r.allocated}
                        </Link>
                      ) : (
                        0
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Sheet>
        </Card>
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

  /** Each chapter's relay progress, from the feed rows kept (`ChapterRelayEvent`), with the journeys allocated here beside the journeys cut. */
  async function relayProgress(workTypeId: string) {
    const [events, counts, people] = await Promise.all([
      db.chapterRelayEvent.findMany({ select: { seq: true, chapter: true, key: true, entity: true, at: true, by: true, data: true } }),
      db.workItem.groupBy({ by: ['groupKey'], where: { workTypeId, archivedAt: null, parentId: null }, _count: { _all: true } }),
      db.user.findMany({ where: { email: { not: null } }, select: { email: true, name: true } }),
    ]);
    const allocated = new Map(counts.map(c => [c.groupKey, c._count._all]));
    const nameOf = new Map(people.map(u => [u.email!.toLowerCase(), u.name]));
    const rows = events.map(e => ({ ...e, data: (e.data ?? {}) as Record<string, unknown> })) satisfies ChapterFeedRow[];
    return [...chapterProgress(rows).values()]
      .map(p => ({ ...p, steward: p.steward ? (nameOf.get(p.steward) ?? displayNameFromEmail(p.steward)) : null, allocated: allocated.get(p.code) ?? 0 }))
      .sort((a, b) => natural(a.code, b.code));
  }

  /** Chapters with journeys or a steward; "mine" = the ones I steer, plus those holding journeys of mine or of my team. */
  async function chapterList(workTypeId: string, list: ItemRow[], me: string, myGroups: ReadonlySet<string> | null) {
    const [stewards, teams, reference, coordinators] = await Promise.all([
      loadStewards(db, [workTypeId]),
      loadTeams(db, [workTypeId]),
      db.chapter.findMany({ select: { code: true, title: true }, orderBy: { code: 'asc' } }),
      db.user.findMany({
        where: { active: true, OR: [{ isAdmin: true }, { memberships: { some: { workTypeId, roles: { some: { role: { capAssign: true, canEdit: true } } } } } }] },
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
          canMove: isAdmin || (can('assign') && Boolean(myGroups?.has(code))),
        };
      }),
    };
  }
}
