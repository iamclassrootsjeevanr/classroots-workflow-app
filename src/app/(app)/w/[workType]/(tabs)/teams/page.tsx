import { notFound } from 'next/navigation';
import { TeamCard, TeamForm, type TeamView } from '@/components/teams-panel';
import { Card, Empty } from '@/components/ui';
import { itemsUrl } from '@/lib/items-url';
import { teamPeople } from '@/lib/teams';
import { getModule } from '@/modules/registry';
import { db } from '@/server/db';
import { loadTeams } from '@/server/teams';
import { reviewPeople } from '@/server/view';
import { loadWorkTypePage } from '@/server/work-type-page';

export async function generateMetadata({ params }: { params: Promise<{ workType: string }> }) {
  const { workType } = await params;
  const mod = getModule(workType);
  return { title: mod ? `${mod.name} · ${mod.pages?.teams ?? 'Teams'}` : 'Work' };
}

/** Teams of a work type: who is in them, the default reviewer of each team and each member's peer reviewer. */
export default async function TeamsPage({ params }: { params: Promise<{ workType: string }> }) {
  const { workType: key } = await params;
  const { user, access, mod, wt, items, can, editable } = await loadWorkTypePage(key);
  if (!mod.teams) notFound();

  const withRight = (right: 'capWork' | 'capAssign') =>
    db.user.findMany({
      where: { active: true, memberships: { some: { workTypeId: wt.id, roles: { some: { role: { [right]: true, canEdit: true } } } } } },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });
  const [teams, creators, coordinators, reviewers] = await Promise.all([loadTeams(db, [wt.id]), withRight('capWork'), withRight('capAssign'), reviewPeople(key)]);
  const person = (u: { id: string; name: string | null; email: string | null }) => ({ id: u.id, name: u.name ?? u.email ?? '?' });
  const teamNameOf = new Map(teams.flatMap(t => t.members.map(m => [m.userId, t.name] as const)));
  const openOf = (ids: string[]) => items.filter(i => i.assigneeId && ids.includes(i.assigneeId) && i.category !== 'done').length;
  const labels = { creator: mod.labels?.assignee ?? 'Person', reviewer: mod.labels?.owner ?? 'Reviewer', peer: mod.labels?.peer ?? 'Peer reviewer', noun: mod.itemNoun };

  const views: TeamView[] = teams.map(t => ({
    id: t.id,
    name: t.name,
    coordinatorId: t.coordinatorId,
    coordinatorName: t.coordinatorName,
    reviewerId: t.reviewerId,
    members: t.members.map(m => ({ ...m, open: openOf([m.userId]), href: itemsUrl(key, { dev: m.userId }) })),
    canManage: editable && (access.isAdmin || (can('assign') && t.coordinatorId === user.id)),
    itemsHref: itemsUrl(key, { team: t.id }),
    open: openOf(teamPeople(t)),
  }));
  // Your own team first.
  views.sort((a, b) => Number(b.coordinatorId === user.id || b.members.some(m => m.userId === user.id)) - Number(a.coordinatorId === user.id || a.members.some(m => m.userId === user.id)));

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        A {labels.noun} belongs to the coordinator of its {labels.creator.toLowerCase()}&rsquo;s team, whoever allocated it and in whichever chapter. That coordinator is its default {labels.reviewer.toLowerCase()}; the
        creator&rsquo;s buddy is its {labels.peer.toLowerCase()}. Both can be changed here for the team, or on one {labels.noun}.
      </p>
      {access.isAdmin && editable && (
        <Card title="Add a team">
          <TeamForm workTypeId={wt.id} coordinators={coordinators.map(person)} />
        </Card>
      )}
      {views.length ? (
        views.map(t => (
          <TeamCard
            key={t.id}
            workTypeId={wt.id}
            team={t}
            creators={creators.map(c => ({ ...person(c), teamName: teamNameOf.get(c.id) }))}
            reviewers={reviewers}
            coordinators={coordinators.map(person)}
            isAdmin={access.isAdmin && editable}
            labels={labels}
          />
        ))
      ) : (
        <Empty>No teams yet.</Empty>
      )}
    </div>
  );
}
