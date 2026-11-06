/**
 * Journey teams from the SME (6 Nov 2026): two coordinators, their SME creators and the peer review buddies.
 *
 *   npm run journey:teams            # dry run: prints the teams and what would change
 *   npm run journey:teams -- --apply # creates / updates the teams, then gives open journeys with no SME reviewer or peer reviewer their team default
 *
 * Safe to run again. A reviewer already set on a journey is never replaced: those that differ from the team default are listed.
 * Teams are edited afterwards in the app (Journey → Teams).
 */
import { reviewDefaults } from '../src/lib/teams';
import { db } from '../src/server/db';
import { refreshStages } from '../src/server/stages';
import { loadTeams } from '../src/server/teams';
import { refillReviewDefaults } from '../src/server/services/work-items';

const KEY = 'journey-applet';
const at = (name: string) => `${name}@classrootsedu.com`;

/** Coordinator = default SME reviewer. Buddies peer-review each other. */
const TEAMS: { name: string; coordinator: string; buddies: [string, string][] }[] = [
  { name: 'Team Arjun', coordinator: at('arjun'), buddies: [[at('kapil'), at('animesh')], [at('preethi'), at('supriya')]] },
  { name: 'Team Devjyoti', coordinator: at('devjyoti'), buddies: [[at('vaishali'), at('divyanshu')], [at('krishna'), at('manasa')]] },
];

async function main() {
  const apply = process.argv.includes('--apply');
  await refreshStages(true);
  const wt = await db.workType.findUniqueOrThrow({ where: { key: KEY } });
  const emails = TEAMS.flatMap(t => [t.coordinator, ...t.buddies.flat()]);
  const users = new Map((await db.user.findMany({ where: { email: { in: emails } }, select: { id: true, email: true, name: true } })).map(u => [u.email!, u]));
  const missing = emails.filter(e => !users.has(e));
  if (missing.length) throw new Error(`No account for: ${missing.join(', ')}`);
  const id = (email: string) => users.get(email)!.id;

  for (const t of TEAMS) {
    console.log(`${t.name}: coordinator ${users.get(t.coordinator)!.name}; ${t.buddies.map(([a, b]) => `${users.get(a)!.name} ↔ ${users.get(b)!.name}`).join(', ')}`);
    if (!apply) continue;
    const team = await db.team.upsert({ where: { workTypeId_name: { workTypeId: wt.id, name: t.name } }, create: { workTypeId: wt.id, name: t.name, coordinatorId: id(t.coordinator) }, update: { coordinatorId: id(t.coordinator) } });
    for (const [a, b] of t.buddies) {
      for (const [member, peer] of [[a, b], [b, a]]) {
        await db.teamMember.deleteMany({ where: { workTypeId: wt.id, userId: id(member), NOT: { teamId: team.id } } });
        await db.teamMember.upsert({ where: { teamId_userId: { teamId: team.id, userId: id(member) } }, create: { teamId: team.id, userId: id(member), workTypeId: wt.id, peerReviewerId: id(peer) }, update: { peerReviewerId: id(peer) } });
      }
    }
  }

  if (apply) console.log(`Journeys updated: ${await refillReviewDefaults({ userId: null, ctx: null, source: 'IMPORT' }, wt.id)}`);

  const teams = await loadTeams(db, [wt.id]);
  const items = await db.workItem.findMany({ where: { workTypeId: wt.id, archivedAt: null }, select: { externalKey: true, status: true, assigneeId: true, ownerId: true, peerReviewerId: true, assignee: { select: { name: true } }, owner: { select: { name: true } } }, orderBy: { externalKey: 'asc' } });
  const nameOf = new Map((await db.user.findMany({ select: { id: true, name: true } })).map(u => [u.id, u.name]));
  let noTeam = 0;
  for (const i of items) {
    const d = reviewDefaults(teams, i.assigneeId);
    if (!d.team) noTeam++;
    else if (d.reviewerId && i.ownerId && i.ownerId !== d.reviewerId) console.log(`  kept: ${i.externalKey} (${i.status}) by ${i.assignee?.name} is reviewed by ${i.owner?.name}; team default is ${nameOf.get(d.reviewerId)}`);
  }
  console.log(`${items.length} journeys · ${items.filter(i => i.ownerId).length} with an SME reviewer · ${items.filter(i => i.peerReviewerId).length} with a peer reviewer · ${noTeam} by people outside the teams`);
  if (!apply) console.log('Dry run. Add --apply to save.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
