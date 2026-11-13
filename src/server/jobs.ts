import { workloadByUser } from '@/lib/analytics-core';
import { dayKey } from '@/lib/time';
import { db } from './db';
import { loadItems, workPeopleWhere } from './services/analytics';
import { appTz } from './settings';
import { syncAll } from './sync/google-sheet';
import { refreshStages } from './stages';
import { notifyOverdue } from './services/overdue';
import { httpRelayClient, relayConfigured } from './relay/client';
import { syncRelay } from './services/relay-sync';

/** Store today's load per person (one row per user per day; re-running updates it). */
export async function snapshotWorkload(now = new Date()) {
  const items = await loadItems({});
  const users = await db.user.findMany({
    where: workPeopleWhere(),
    select: { id: true, name: true, email: true, capacity: true },
  });
  const loads = workloadByUser(items, users.map(u => ({ id: u.id, name: u.name ?? u.email ?? '', capacity: u.capacity })), now);
  const date = new Date(dayKey(now, appTz()) + 'T00:00:00Z');
  for (const w of loads) {
    const data = { open: w.open, inProgress: w.inProgress, inReview: w.inReview, overdue: w.overdue, dueNext7d: w.dueNext7d, capacity: w.capacity };
    await db.workloadSnapshot.upsert({
      where: { date_userId: { date, userId: w.userId } },
      create: { date, userId: w.userId, ...data },
      update: data,
    });
  }
  return loads.length;
}

/** Pull the journey relay (when it is configured). A relay outage must not stop the other jobs. */
async function relayJob() {
  if (!relayConfigured()) return null;
  try {
    const r = await syncRelay(httpRelayClient());
    return { created: r.created.length, stageChanges: r.stageChanges.length, eventsAdded: r.eventsAdded, errors: r.errors.length };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/** Everything the scheduler runs: sheet sync for each work type, the journey relay, the workload snapshot, overdue messages. */
export async function runJobs() {
  await refreshStages(true);
  const sync = await syncAll();
  const relay = await relayJob();
  const snapshots = await snapshotWorkload();
  const overdue = await notifyOverdue();
  return { sync, relay, snapshots, overdue };
}
