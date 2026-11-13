import { reviewDefaults, type TeamLite } from '@/lib/teams';
import { db } from '../db';
import { ForbiddenError } from '../errors';
import { loadTeams } from '../teams';
import { refillReviewDefaults, type ChangeActor } from './work-items';

/**
 * Teams: who is in them and their review defaults. Callers (server actions) check that the person may manage the team;
 * journeys follow a changed default through services/work-items.ts (the only write path for items).
 */

type Defaults = Map<string, { reviewerId: string | null; peerReviewerId: string | null }>;

const snapshot = (teams: TeamLite[], userIds: string[]): Defaults => new Map(userIds.map(id => [id, reviewDefaults(teams, id)]));

/** Trusted: the action already checked the team's coordinator or an admin is acting. */
const system = (userId: string): ChangeActor => ({ userId, ctx: null, source: 'APP' });

async function teamOrThrow(teamId: string) {
  return db.team.findUniqueOrThrow({ where: { id: teamId }, include: { members: { select: { userId: true } } } });
}

/** Active people holding a role with this right in the work type (admins count for review). */
async function hasRight(workTypeId: string, userId: string, right: 'capWork' | 'capReview' | 'capAssign') {
  const u = await db.user.findFirst({
    where: { id: userId, active: true, OR: [...(right === 'capWork' ? [] : [{ isAdmin: true }]), { memberships: { some: { workTypeId, roles: { some: { role: { [right]: true, canEdit: true } } } } } }] },
    select: { id: true, name: true },
  });
  return u;
}

export async function saveTeam(workTypeId: string, input: { id?: string; name: string; coordinatorId: string }) {
  const name = input.name.trim();
  if (!name) throw new Error('Name the team.');
  if (!(await hasRight(workTypeId, input.coordinatorId, 'capAssign'))) throw new Error('The steward needs a role that assigns work here (Steward).');
  const clash = await db.team.findFirst({ where: { workTypeId, name: { equals: name, mode: 'insensitive' }, ...(input.id ? { NOT: { id: input.id } } : {}) } });
  if (clash) throw new Error(`A team called “${clash.name}” already exists.`);
  if (input.id) {
    const team = await teamOrThrow(input.id);
    if (team.members.some(m => m.userId === input.coordinatorId)) throw new Error('Remove them from the members first: a coordinator is not a member of their own team.');
    await db.team.update({ where: { id: input.id }, data: { name, coordinatorId: input.coordinatorId } });
    return input.id;
  }
  return (await db.team.create({ data: { workTypeId, name, coordinatorId: input.coordinatorId } })).id;
}

export async function deleteTeam(teamId: string) {
  await db.team.delete({ where: { id: teamId } });
}

/** Default SME reviewer of the team's journeys (null = the coordinator). Open journeys still on the old default follow. */
export async function setTeamReviewer(actorId: string, teamId: string, reviewerId: string | null) {
  const team = await teamOrThrow(teamId);
  if (reviewerId && !(await hasRight(team.workTypeId, reviewerId, 'capReview'))) throw new Error('Pick someone with a role that reviews here (SME reviewer).');
  const next = reviewerId === team.coordinatorId ? null : reviewerId;
  if (next === team.reviewerId) return 0;
  const people = team.members.map(m => m.userId);
  const was = snapshot(await loadTeams(db, [team.workTypeId]), people);
  await db.team.update({ where: { id: teamId }, data: { reviewerId: next } });
  return refillReviewDefaults(system(actorId), team.workTypeId, { creatorIds: people, was });
}

export async function addTeamMember(actorId: string, teamId: string, userId: string) {
  const team = await teamOrThrow(teamId);
  if (userId === team.coordinatorId) throw new Error('The coordinator already leads this team.');
  const person = await hasRight(team.workTypeId, userId, 'capWork');
  if (!person) throw new Error('Pick an active person who works on items here (SME creator).');
  const other = await db.teamMember.findUnique({ where: { workTypeId_userId: { workTypeId: team.workTypeId, userId } }, include: { team: { select: { name: true } } } });
  if (other) throw new ForbiddenError(other.teamId === teamId ? `${person.name} is already in this team.` : `${person.name} is in ${other.team.name}. Remove them there first.`);
  await db.teamMember.create({ data: { teamId, userId, workTypeId: team.workTypeId } });
  // Their open journeys get the team's reviewer where none is set.
  return refillReviewDefaults(system(actorId), team.workTypeId, { creatorIds: [userId] });
}

/** Their journeys keep the reviewers they have; other members who had them as buddy lose that default. */
export async function removeTeamMember(teamId: string, userId: string) {
  await db.$transaction([
    db.teamMember.updateMany({ where: { teamId, peerReviewerId: userId }, data: { peerReviewerId: null } }),
    db.teamMember.delete({ where: { teamId_userId: { teamId, userId } } }),
  ]);
}

/** A member's default peer reviewer (their buddy). Their open journeys still on the old buddy follow. */
export async function setMemberPeer(actorId: string, teamId: string, userId: string, peerReviewerId: string | null) {
  const team = await teamOrThrow(teamId);
  if (!team.members.some(m => m.userId === userId)) throw new Error('That person is not in this team.');
  if (peerReviewerId === userId) throw new Error('A peer reviewer is someone else.');
  if (peerReviewerId && !(await hasRight(team.workTypeId, peerReviewerId, 'capWork'))) throw new Error('Pick an active person who works on items here (SME creator).');
  const was = snapshot(await loadTeams(db, [team.workTypeId]), [userId]);
  await db.teamMember.update({ where: { teamId_userId: { teamId, userId } }, data: { peerReviewerId } });
  return refillReviewDefaults(system(actorId), team.workTypeId, { creatorIds: [userId], was });
}

/** Fill the SME reviewer and peer reviewer of open journeys that have none, from the team settings. */
export async function fillMissingReviewers(actorId: string, workTypeId: string, teamId?: string) {
  const creatorIds = teamId ? (await teamOrThrow(teamId)).members.map(m => m.userId) : undefined;
  return refillReviewDefaults(system(actorId), workTypeId, { creatorIds });
}

// ─── Chapters (groups) and their stewards ───────────────────────

/** Add a chapter to the list with its steward. `stewardId` must hold a limited coordinator membership (chapters named). */
export async function addChapter(workTypeId: string, input: { code: string; title: string; stewardId: string }) {
  const code = input.code.trim().toUpperCase();
  const known = await db.chapter.findUnique({ where: { code } });
  const title = input.title.trim() || known?.title || '';
  if (!title) throw new Error('Give the chapter a name.');
  const member = await db.workTypeMember.findUnique({ where: { workTypeId_userId: { workTypeId, userId: input.stewardId } } });
  if (!member || !(await hasRight(workTypeId, input.stewardId, 'capAssign'))) throw new Error('The steward needs the Steward role here.');
  const taken = await db.workTypeMember.findFirst({ where: { workTypeId, groupKeys: { has: code }, NOT: { userId: input.stewardId } }, include: { user: { select: { name: true } } } });
  if (taken) throw new ForbiddenError(`${code} is already ${taken.user.name ?? 'someone'}’s chapter. An admin can move it (People → their access).`);
  const grade = Number(/^G(\d+)C/.exec(code)?.[1]) || null;
  const chapterNo = Number(/C(\d+)$/.exec(code)?.[1]) || null;
  await db.$transaction(async tx => {
    if (known) await tx.chapter.update({ where: { code }, data: { title } });
    else await tx.chapter.create({ data: { code, title, grade, chapterNo } });
    // No chapters named = they steer every chapter already; naming one would cut the others off.
    if (member.groupKeys.length && !member.groupKeys.includes(code)) {
      await tx.workTypeMember.update({ where: { workTypeId_userId: { workTypeId, userId: input.stewardId } }, data: { groupKeys: [...member.groupKeys, code] } });
    }
  });
  return { code, title, everyChapter: !member.groupKeys.length };
}

/** Take a chapter off the list. Only an empty one: its journeys must be deleted or moved first. */
export async function removeChapter(workTypeId: string, code: string) {
  const items = await db.workItem.count({ where: { workTypeId, groupKey: code, archivedAt: null } });
  if (items) throw new Error(`${code} has ${items} journey${items === 1 ? '' : 's'}. Delete or move them first.`);
  const members = await db.workTypeMember.findMany({ where: { workTypeId, groupKeys: { has: code } } });
  for (const m of members) {
    if (m.groupKeys.length === 1) throw new Error(`${code} is the only chapter of its steward. Add their next chapter first, or ask an admin.`);
  }
  await db.$transaction(members.map(m => db.workTypeMember.update({ where: { workTypeId_userId: { workTypeId, userId: m.userId } }, data: { groupKeys: m.groupKeys.filter(k => k !== code) } })));
}
