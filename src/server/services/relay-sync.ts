import type { Prisma } from '@prisma/client';
import { CREATION_STAGES, journeyKeyOf, parseJourneyKey } from '@/lib/journey';
import { currentCreationStage, nameFromEmail, parseAllocations, parseStatus, parseStatusMeta, type RelayAllocation } from '@/lib/relay-map';
import { shortKey } from '@/lib/notifications-core';
import { db } from '../db';
import { workCalendar } from '../settings';
import type { RelayClient } from '../relay/client';
import { notify } from './notifications';
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
  /** The dashboard has a different creator than the relay (reported, not changed). */
  creatorDiffers: { key: string; dashboard: string | null; relay: string }[];
  /** The dashboard is ahead of the relay (e.g. Published): not changed. */
  dashboardAhead: { key: string; dashboard: string; relay: string }[];
  /** Dashboard journeys the relay has no allocation for (old tracker imports). */
  notOnRelay: string[];
  skipped: string[];
  errors: { key: string; error: string }[];
};

const empty = (dryRun: boolean): RelayReport => ({ dryRun, allocated: 0, created: [], assigned: [], stageChanges: [], eventsAdded: 0, unknownPeople: [], creatorDiffers: [], dashboardAhead: [], notOnRelay: [], skipped: [], errors: [] });
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
  const allocations = parseAllocations(await client.allocations()).filter(a => !only || a.key === only);
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
  const personFor = (email: string) => userByEmail.get(email) ?? (idsByName.get(nameFromEmail(email))?.length === 1 ? idsByName.get(nameFromEmail(email))![0] : null);
  const chapterByCode = new Map(chapters.map(c => [c.code, c.id]));
  const relayKeys = new Set(allocations.map(a => a.key));
  if (!only) report.notOnRelay = items.filter(i => !i.archivedAt && !relayKeys.has(i.externalKey.toUpperCase()) && parseJourneyKey(i.externalKey)).map(i => i.externalKey).sort();

  for (const a of allocations) {
    try {
      await syncOne(a);
    } catch (e) {
      report.errors.push({ key: a.key, error: e instanceof Error ? e.message : String(e) });
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
      report.creatorDiffers.push({ key: a.key, dashboard: item.assignee?.name ?? null, relay: a.email });
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
