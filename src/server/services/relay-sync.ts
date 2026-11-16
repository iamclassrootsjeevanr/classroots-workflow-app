import type { Prisma } from '@prisma/client';
import { CREATION_STAGES, journeyKeyOf, parseJourneyKey } from '@/lib/journey';
import { currentCreationStage, nameFromEmail, parseAllocations, parseChapterStewards,
  type StewardMember, parseStatus, parseStatusMeta, planStewards, planTeams, relayHolderWins, type RelayAllocation } from '@/lib/relay-map';
import { shortKey } from '@/lib/notifications-core';
import { db } from '../db';
import { workCalendar } from '../settings';
import type { RelayClient } from '../relay/client';
import { notify } from './notifications';
import { addTeamMember, removeTeamMember } from './teams';
import { assign, createItemTx, updateFields, type ChangeActor } from './work-items';

/**
 * Pull the journey relay's ledger into the dashboard. The relay feeds creation (who holds a journey, its Creation stage, its approvals);
 * the dashboard keeps review and everything after it. Re-running is safe: journeys are matched by key, events by the relay's event id.
 * Never touched here: status after Creating, SME reviewer, peer reviewer, developer, feedback, dates, and any person other than the creator.
 */
const JOURNEY = 'journey-applet';
const ACTOR: ChangeActor = { userId: null, ctx: null, source: 'RELAY' };

export type RelayReport = {
  dryRun: boolean;
  allocated: number;
  created: string[];
  /** Existing journeys with no creator that the relay holds for a known person: assigned. */
  assigned: string[];
  stageChanges: { key: string; from: string | null; to: string }[];
  eventsAdded: number;
  /** The relay holds the journey for an email that is not a dashboard user (nobody is assigned until they are added). */
  unknownPeople: { key: string; email: string }[];
  /** The relay moved the journey to another creator after the dashboard's last reassignment: the dashboard follows. */
  reassigned: { key: string; from: string | null; to: string }[];
  /** The dashboard reassigned the journey after the relay's allocation: kept, reported. */
  creatorDiffers: { key: string; dashboard: string | null; relay: string }[];
  /** Creators put in the team the relay allocates their journeys under. */
  teamChanges: { person: string; team: string; from: string | null }[];
  teamIssues: string[];
  /** The dashboard is ahead of the relay (e.g. Published): not changed. */
  dashboardAhead: { key: string; dashboard: string; relay: string }[];
  /** Dashboard journeys the relay has no allocation for (old tracker imports). */
  notOnRelay: string[];
  /** Chapter stewards from the relay's chapter owners: added to (and handed over from) coordinators' chapter lists. */
  stewards: { code: string; steward: string; change: 'added' | 'removed' }[];
  /** Chapter owners the dashboard could not apply (reported, nothing changed). */
  stewardIssues: string[];
  skipped: string[];
  errors: { key: string; error: string }[];
};

const empty = (dryRun: boolean): RelayReport => ({ dryRun, allocated: 0, created: [], assigned: [], stageChanges: [], eventsAdded: 0, unknownPeople: [], reassigned: [], creatorDiffers: [], teamChanges: [], teamIssues: [], dashboardAhead: [], notOnRelay: [], stewards: [], stewardIssues: [], skipped: [], errors: [] });
const stageIndex = (s: unknown) => CREATION_STAGES.findIndex(x => x === s);

export async function syncRelay(client: RelayClient, opts: { dryRun?: boolean; key?: string } = {}): Promise<RelayReport> {
  const dryRun = Boolean(opts.dryRun);
  const report = empty(dryRun);
  const wt = await db.workType.findUnique({ where: { key: JOURNEY } });
  if (!wt) throw new Error('The Journey work type is not set up.');
  if (wt.state !== 'ACTIVE') {
    report.skipped.push('Journey is paused: nothing synced.');
    return report;
  }
  const only = opts.key ? journeyKeyOf(opts.key) : null;
  const allocReply = await client.allocations();
  const allocations = parseAllocations(allocReply).filter(a => !only || a.key === only);
  report.allocated = allocations.length;

  const [items, users, chapters, cal] = await Promise.all([
    db.workItem.findMany({ where: { workTypeId: wt.id }, select: { id: true, externalKey: true, archivedAt: true, assigneeId: true, data: true, assignee: { select: { name: true } } } }),
    db.user.findMany({ where: { active: true }, select: { id: true, email: true, name: true } }),
    db.chapter.findMany({ select: { id: true, code: true } }),
    workCalendar(),
  ]);
  const byKey = new Map(items.map(i => [i.externalKey.toUpperCase(), i]));
  const userByEmail = new Map(users.filter(u => u.email).map(u => [u.email!.toLowerCase(), u.id]));
  // The relay's email may differ from the dashboard's (krishna.rander@ vs krishna@): fall back to the name the email spells, when it is unique.
  const idsByName = new Map<string, string[]>();
  for (const u of users) if (u.name) idsByName.set(u.name.trim().toLowerCase().replace(/\s+/g, ' '), [...(idsByName.get(u.name.trim().toLowerCase().replace(/\s+/g, ' ')) ?? []), u.id]);
  const nameById = new Map(users.map(u => [u.id, u.name ?? u.email ?? u.id]));
  const personFor = (email: string) => userByEmail.get(email) ?? (idsByName.get(nameFromEmail(email))?.length === 1 ? idsByName.get(nameFromEmail(email))![0] : null);
  const chapterByCode = new Map(chapters.map(c => [c.code, c.id]));
  const relayKeys = new Set(allocations.map(a => a.key));
  if (!only) report.notOnRelay = items.filter(i => !i.archivedAt && !relayKeys.has(i.externalKey.toUpperCase()) && parseJourneyKey(i.externalKey)).map(i => i.externalKey).sort();

  if (!only) await syncStewards(wt.id, parseChapterStewards(allocReply), report, dryRun);

  for (const a of allocations) {
    try {
      await syncOne(a);
    } catch (e) {
      report.errors.push({ key: a.key, error: e instanceof Error ? e.message : String(e) });
    }
  }

  if (!only) {
    try {
      await syncTeams(
        wt.id,
        allocations.flatMap(a => {
          const userId = a.email ? personFor(a.email) : null;
          return userId ? [{ userId, team: a.team }] : [];
        }),
        nameById,
        report,
        dryRun,
      );
    } catch (e) {
      report.errors.push({ key: 'teams', error: e instanceof Error ? e.message : String(e) });
    }
  }

  async function syncOne(a: RelayAllocation) {
    let item = byKey.get(a.key);
    if (item?.archivedAt) {
      report.skipped.push(`${a.key} is deleted in the dashboard`);
      return;
    }
    const assigneeId = a.email ? personFor(a.email) : null;
    if (a.email && !assigneeId) report.unknownPeople.push({ key: a.key, email: a.email });
    if (!item) {
      report.created.push(a.key);
      if (!dryRun) {
        const parsed = parseJourneyKey(a.key)!;
        const created = await db.$transaction(async tx => {
          let chapterId = chapterByCode.get(parsed.chapter);
          if (!chapterId) {
            chapterId = (await tx.chapter.create({ data: { code: parsed.chapter, grade: parsed.grade, part: parsed.part ? String(parsed.part) : null, chapterNo: Number(parsed.chapter.slice(-2)), title: parsed.chapter } })).id;
            chapterByCode.set(parsed.chapter, chapterId);
          }
          const row = await createItemTx(tx, wt!, ACTOR, { externalKey: a.key, title: a.title ?? a.key, assigneeId, chapterId, groupKey: parsed.chapter, sortOrder: Number(parsed.subtopic.slice(2)) * 100 + parsed.journey, data: {} }, new Date(), cal);
          if (assigneeId) await notify(tx, assigneeId, { kind: 'item.assigned', title: `Journey allocated to you: ${shortKey(a.key)}`, body: row.title, href: `/w/${JOURNEY}/${row.id}` });
          return row;
        });
        item = { id: created.id, externalKey: a.key, archivedAt: null, assigneeId, data: created.data, assignee: null };
        byKey.set(a.key, item);
      }
    } else if (assigneeId && !item.assigneeId) {
      // Held on the relay, nobody on it here (e.g. the person was added to People after the journey): give it to them.
      report.assigned.push(a.key);
      if (!dryRun) {
        await assign(ACTOR, item.id, assigneeId);
        item = { ...item, assigneeId };
        byKey.set(a.key, item);
      }
    } else if (a.email && item.assigneeId !== assigneeId && assigneeId) {
      // Reassigned on the relay after anyone here last reassigned it: follow the relay. A later change made here stands.
      const lastHere = await db.workItemEvent.findFirst({ where: { itemId: item.id, type: { in: ['ASSIGNED', 'UNASSIGNED'] }, source: 'APP' }, orderBy: { at: 'desc' }, select: { at: true } });
      if (relayHolderWins(a.at, lastHere?.at ?? null)) {
        report.reassigned.push({ key: a.key, from: item.assignee?.name ?? null, to: nameById.get(assigneeId) ?? a.email });
        if (!dryRun) {
          await assign(ACTOR, item.id, assigneeId);
          const id = item.id;
          await db.$transaction(tx => notify(tx, assigneeId, { kind: 'item.assigned', title: `Journey allocated to you: ${shortKey(a.key)}`, body: a.title ?? a.key, href: `/w/${JOURNEY}/${id}` }));
          item = { ...item, assigneeId, assignee: { name: nameById.get(assigneeId) ?? null } };
          byKey.set(a.key, item);
        }
      } else {
        report.creatorDiffers.push({ key: a.key, dashboard: item.assignee?.name ?? null, relay: a.email });
      }
    }

    const reply = await client.journeyStatus(a.key);
    const events = parseStatus(reply);
    const meta = parseStatusMeta(reply);
    const fallback = currentCreationStage(events);
    const stage = meta.stage ?? fallback.stage;
    const at = meta.stage ? (meta.at ?? fallback.at) : fallback.at;
    const before = item ? ((item.data ?? {}) as Record<string, unknown>).creationStage : null;
    if (item && !dryRun && events.length) {
      const known = new Set((await db.relayEvent.findMany({ where: { itemId: item.id }, select: { eventId: true } })).map(e => e.eventId));
      const fresh = events.filter(e => !known.has(e.eventId));
      if (fresh.length) {
        await db.relayEvent.createMany({ data: fresh.map(e => ({ itemId: item!.id, ...e })) as Prisma.RelayEventCreateManyInput[], skipDuplicates: true });
        report.eventsAdded += fresh.length;
      }
      // An approval withdrawn later on the relay stops counting.
      const gone = events.filter(e => e.withdrawn).map(e => e.eventId);
      if (gone.length) await db.relayEvent.updateMany({ where: { itemId: item.id, eventId: { in: gone } }, data: { withdrawn: true } });
    } else if (item == null) {
      report.eventsAdded += events.length;
    }
    if (!stage || before === stage) return;
    if (stageIndex(before) > stageIndex(stage)) {
      report.dashboardAhead.push({ key: a.key, dashboard: String(before), relay: stage });
      return;
    }
    report.stageChanges.push({ key: a.key, from: typeof before === 'string' ? before : null, to: stage });
    if (dryRun || !item) return;
    // History stays in order: never dated before the journey's last recorded change, nor in the future.
    const last = await db.workItemEvent.findFirst({ where: { itemId: item.id }, orderBy: { at: 'desc' }, select: { at: true } });
    const when = at && at.getTime() <= Date.now() ? (last && at < last.at ? last.at : at) : undefined;
    await updateFields(ACTOR, item.id, { creationStage: stage }, { at: when });
  }

  if (!dryRun) {
    const ok = report.errors.length === 0;
    await db.relaySyncState.upsert({ where: { workTypeId: wt.id }, create: { workTypeId: wt.id, lastRunAt: new Date(), ok, report: report as unknown as Prisma.InputJsonValue }, update: { lastRunAt: new Date(), ok, report: report as unknown as Prisma.InputJsonValue } });
  }
  return report;
}

/** The relay's chapter owner is the chapter's steward: a coordinator whose chapter list holds the code (see `planStewards`). */
async function syncStewards(workTypeId: string, stewards: { code: string; email: string }[], report: RelayReport, dryRun: boolean) {
  if (!stewards.length) return;
  const rows = await db.workTypeMember.findMany({
    where: { workTypeId, user: { active: true } },
    select: { userId: true, groupKeys: true, user: { select: { email: true, name: true, isAdmin: true } }, roles: { select: { role: { select: { capAssign: true, canEdit: true } } } } },
  });
  // Admins named by the relay but not in this work type yet: they can be made steward too.
  const named = [...new Set(stewards.map(s => s.email))];
  const outsiders = await db.user.findMany({
    where: { isAdmin: true, active: true, email: { in: named, mode: 'insensitive' }, NOT: { id: { in: rows.map(r => r.userId) } } },
    select: { id: true, email: true, name: true },
  });
  const members: StewardMember[] = [
    ...rows.map(r => ({ userId: r.userId, email: r.user.email, groupKeys: r.groupKeys, coordinator: r.roles.some(x => x.role.capAssign && x.role.canEdit), admin: r.user.isAdmin })),
    ...outsiders.map(u => ({ userId: u.id, email: u.email, groupKeys: [], coordinator: false, admin: true })),
  ];
  const isMember = new Set(rows.map(r => r.userId));
  const nameOf = new Map([...rows.map(r => [r.userId, r.user.name ?? r.user.email ?? r.userId] as const), ...outsiders.map(u => [u.id, u.name ?? u.email ?? u.id] as const)]);
  const plan = planStewards(stewards, members);
  for (const u of plan.unknown) report.stewardIssues.push(`${u.code}: ${u.email} has no Journey access (give them the Steward role in People)`);
  for (const u of plan.notCoordinator) report.stewardIssues.push(`${u.code}: ${u.email} is in Journey without the Steward role`);
  for (const u of plan.steersAll) report.stewardIssues.push(`${u.code}: ${u.email} already steers every chapter (no chapter list), left as is`);
  for (const k of plan.keptLast) report.stewardIssues.push(`${k.code}: still on ${nameOf.get(k.userId)}, their only chapter`);
  for (const g of plan.grantRole) report.stewardIssues.push(`${g.code}: ${nameOf.get(g.userId)} is an admin, given the Steward role in Journey`);
  for (const a of plan.add) report.stewards.push({ code: a.code, steward: nameOf.get(a.userId) ?? a.userId, change: 'added' });
  for (const r of plan.remove) report.stewards.push({ code: r.code, steward: nameOf.get(r.userId) ?? r.userId, change: 'removed' });
  if (dryRun) return;
  const granted = new Set(plan.grantRole.map(g => g.userId));
  const next = new Map(members.map(m => [m.userId, granted.has(m.userId) ? [] : [...m.groupKeys]]));
  for (const a of plan.add) next.get(a.userId)!.push(a.code);
  for (const r of plan.remove) next.set(r.userId, next.get(r.userId)!.filter(k => k !== r.code));
  if (granted.size) {
    const role =
      (await db.accessRole.findFirst({ where: { workTypeId, key: 'coordinator' }, select: { id: true } })) ??
      (await db.accessRole.findFirst({ where: { workTypeId, capAssign: true, canEdit: true }, orderBy: { isSystem: 'desc' }, select: { id: true } }));
    if (!role) {
      report.stewardIssues.push('No Steward role in this work type: admins not made steward');
      for (const id of granted) next.delete(id);
    } else {
      for (const userId of granted) {
        const groupKeys = [...new Set(next.get(userId))].sort();
        if (!isMember.has(userId)) await db.workTypeMember.create({ data: { workTypeId, userId, groupKeys, roles: { create: { roleId: role.id } } } });
        else await db.workTypeMember.update({ where: { workTypeId_userId: { workTypeId, userId } }, data: { groupKeys, roles: { create: { roleId: role.id } } } });
      }
    }
  }
  const changed = new Set([...plan.add, ...plan.remove].map(x => x.userId).filter(id => !granted.has(id)));
  for (const userId of changed) {
    await db.workTypeMember.update({ where: { workTypeId_userId: { workTypeId, userId } }, data: { groupKeys: [...new Set(next.get(userId))].sort() } });
  }
}

/** Creators join the team their relay journeys are allocated under (only when all of them agree). */
async function syncTeams(workTypeId: string, holders: { userId: string; team: string | null }[], nameById: Map<string, string>, report: RelayReport, dryRun: boolean) {
  const teams = await db.team.findMany({ where: { workTypeId }, select: { id: true, name: true, coordinatorId: true, coordinator: { select: { name: true } }, members: { select: { userId: true } } } });
  if (!teams.length) return;
  const memberOf = new Map(teams.flatMap(t => t.members.map(m => [m.userId, t.id] as const)));
  const plan = planTeams(holders, teams.map(t => ({ id: t.id, name: t.name, coordinatorId: t.coordinatorId, coordinatorName: t.coordinator.name })), memberOf);
  const teamName = new Map(teams.map(t => [t.id, t.name]));
  for (const m of plan.mixed) {
    const here = memberOf.get(m.userId);
    report.teamIssues.push(`${nameById.get(m.userId)} has journeys in ${m.teams.join(' and ')} on the relay: team left as is${here ? ` (${teamName.get(here)})` : ''}`);
  }
  for (const t of plan.unknownTeams) report.teamIssues.push(`${t} is on the relay but not in Teams: add it in the Teams tab`);
  for (const mv of plan.moves) {
    report.teamChanges.push({ person: nameById.get(mv.userId) ?? mv.userId, team: teamName.get(mv.teamId)!, from: mv.fromTeamId ? teamName.get(mv.fromTeamId)! : null });
    if (dryRun) continue;
    try {
      if (mv.fromTeamId) await removeTeamMember(mv.fromTeamId, mv.userId);
      await addTeamMember(null, mv.teamId, mv.userId);
    } catch (e) {
      report.teamIssues.push(`${nameById.get(mv.userId)}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
