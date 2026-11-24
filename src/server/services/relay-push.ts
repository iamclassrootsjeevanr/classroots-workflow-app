import type { Prisma } from '@prisma/client';
import { mismatchSettled, toolUnavailable } from '@/lib/relay-contract';
import { dashEventFor, eventIdFor, parsePushReply, PUSHED_TYPES, type PushContext } from '@/lib/relay-push';
import { requireModule, statusDef } from '@/modules/registry';
import { db } from '../db';
import type { RelayClient } from '../relay/client';
import { refreshStages } from '../stages';

/**
 * Send what happened here to the relay's dashboard log (`dashboard_event`). The audit log (WorkItemEvent) is the source: every change to
 * a journey already writes one event there, so nothing in the write paths queues anything. `collect` gives each event not yet queued a
 * RelayOutbox row; `flush` sends the pending rows, oldest first, in batches. A resend is harmless (the relay keeps an event id once).
 *
 * A relay that does not offer the tool yet, an outage or a refused token leave the rows pending and count no attempt: nothing is flagged
 * until the relay itself refuses one event, which is then marked FAILED with the relay's reason.
 */
const JOURNEY = 'journey-applet';
const BATCH = 100;
const MAX_ATTEMPTS = 10;

export type PushReport = { queued: number; skipped: number; sent: number; duplicate: number; failed: number; pending: number; note?: string };

async function context(): Promise<PushContext> {
  await refreshStages(true);
  const mod = requireModule(JOURNEY);
  const users = await db.user.findMany({ where: { email: { not: null } }, select: { name: true, email: true } });
  const seen = new Map<string, string | null>();
  for (const u of users) {
    const n = u.name?.trim().toLowerCase();
    if (n) seen.set(n, seen.has(n) ? null : u.email!.toLowerCase());
  }
  const emailByName = new Map([...seen].filter((x): x is [string, string] => x[1] !== null));
  return {
    labels: { owner: mod.labels?.owner ?? 'Owner', developer: mod.developerHandoff?.label ?? 'Developer' },
    statusLabel: s => {
      try {
        return statusDef(mod, s).label;
      } catch {
        return null;
      }
    },
    emailByName,
  };
}

/** Give every journey event that has no outbox row one. Returns how many were queued and how many are kept but not sent. */
export async function collectRelayEvents(limit = 2000): Promise<{ queued: number; skipped: number }> {
  const wt = await db.workType.findUnique({ where: { key: JOURNEY }, select: { id: true } });
  if (!wt) return { queued: 0, skipped: 0 };
  const rows = await db.workItemEvent.findMany({
    where: { relayOutbox: null, type: { in: [...PUSHED_TYPES] }, item: { workTypeId: wt.id, parentId: null } },
    orderBy: [{ at: 'asc' }, { id: 'asc' }],
    take: limit,
    select: { id: true, itemId: true, type: true, field: true, fromValue: true, toValue: true, source: true, note: true, meta: true, at: true, actor: { select: { email: true } }, item: { select: { externalKey: true } } },
  });
  if (!rows.length) return { queued: 0, skipped: 0 };
  const ctx = await context();
  let skipped = 0;
  const data = rows.map(r => {
    const e = dashEventFor({ ...r, actorEmail: r.actor?.email ?? null, externalKey: r.item.externalKey }, ctx);
    if ('skip' in e) {
      skipped++;
      // Kept as a row so it is not looked at again; marked sent with the reason, and never sent.
      return { itemId: r.itemId, workEventId: r.id, eventId: eventIdFor(r.id), status: 'SENT' as const, lastError: `not sent: ${e.skip}` };
    }
    return { itemId: r.itemId, workEventId: r.id, eventId: e.event_id, payload: e as unknown as Prisma.InputJsonValue };
  });
  await db.relayOutbox.createMany({ data, skipDuplicates: true });
  return { queued: data.length - skipped, skipped };
}

/** Send pending rows. Stops at the first batch the relay cannot take (it will be tried again on the next run). */
export async function flushRelayOutbox(client: RelayClient, maxBatches = 20): Promise<Pick<PushReport, 'sent' | 'duplicate' | 'failed' | 'note'>> {
  const out = { sent: 0, duplicate: 0, failed: 0 } as Pick<PushReport, 'sent' | 'duplicate' | 'failed' | 'note'>;
  if (!client.dashboardEvents) return { ...out, note: 'This relay client cannot send (a fixture).' };
  for (let n = 0; n < maxBatches; n++) {
    const pending = await db.relayOutbox.findMany({ where: { status: 'PENDING', attempts: { lt: MAX_ATTEMPTS } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: BATCH, select: { id: true, eventId: true, payload: true, attempts: true } });
    if (!pending.length) break;
    let reply;
    try {
      reply = parsePushReply(await client.dashboardEvents(pending.map(p => p.payload)));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      // Not there yet, or down: the rows wait. Only a relay that answers and still fails counts against them.
      out.note = toolUnavailable(message) ? 'The relay does not take dashboard events yet (dashboard_event is not deployed, or this token is not named in DASHBOARD_TOKENS). Queued.' : `The relay could not be reached: ${message}`;
      break;
    }
    const byEvent = new Map(pending.map(p => [p.eventId, p]));
    const ok = [...reply.recorded, ...reply.duplicate].flatMap(id => (byEvent.has(id) ? [byEvent.get(id)!.id] : []));
    if (ok.length) await db.relayOutbox.updateMany({ where: { id: { in: ok } }, data: { status: 'SENT', sentAt: new Date(), attempts: { increment: 1 }, lastError: null } });
    out.sent += reply.recorded.length;
    out.duplicate += reply.duplicate.length;
    // The relay read the event and refused it: sending it again changes nothing.
    for (const r of reply.rejected) {
      const row = r.event_id ? byEvent.get(r.event_id) : null;
      if (!row) continue;
      await db.relayOutbox.update({ where: { id: row.id }, data: { status: 'FAILED', attempts: { increment: 1 }, lastError: r.error.slice(0, 500) } });
      out.failed++;
    }
    // Rows the reply did not name at all: try again, a bounded number of times.
    const named = new Set([...reply.recorded, ...reply.duplicate, ...reply.rejected.map(r => r.event_id)]);
    const unnamed = pending.filter(p => !named.has(p.eventId));
    for (const p of unnamed) await db.relayOutbox.update({ where: { id: p.id }, data: { attempts: { increment: 1 }, lastError: 'the relay did not answer for this event', status: p.attempts + 1 >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING' } });
    if (unnamed.length === pending.length) break;
  }
  return out;
}

/** Queue what is new, then send. */
export async function pushRelay(client: RelayClient, opts: { dryRun?: boolean } = {}): Promise<PushReport> {
  if (opts.dryRun) {
    const wt = await db.workType.findUnique({ where: { key: JOURNEY }, select: { id: true } });
    const queued = wt ? await db.workItemEvent.count({ where: { relayOutbox: null, type: { in: [...PUSHED_TYPES] }, item: { workTypeId: wt.id, parentId: null } } }) : 0;
    return { queued, skipped: 0, sent: 0, duplicate: 0, failed: 0, pending: await db.relayOutbox.count({ where: { status: 'PENDING' } }), note: 'Dry run: nothing queued or sent.' };
  }
  const { queued, skipped } = await collectRelayEvents();
  const flushed = await flushRelayOutbox(client);
  return { queued, skipped, ...flushed, pending: await db.relayOutbox.count({ where: { status: 'PENDING' } }) };
}

/**
 * True when the last stage change of a journey here is later than the relay's publish status and is in the relay's dashboard log:
 * the relay holds this side's word, so the two statuses differing is not a flag (mismatchSettled).
 */
export async function relaySettled(itemId: string, publishAt: Date | null): Promise<boolean> {
  if (!publishAt) return false;
  const last = await db.workItemEvent.findFirst({ where: { itemId, type: 'STATUS_CHANGED' }, orderBy: [{ at: 'desc' }, { id: 'desc' }], select: { at: true, relayOutbox: { select: { status: true, payload: true } } } });
  return mismatchSettled(last?.at ?? null, publishAt, last?.relayOutbox?.status === 'SENT' && last.relayOutbox.payload != null);
}
