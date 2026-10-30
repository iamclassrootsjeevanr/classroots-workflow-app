import { workloadByUser } from '@/lib/analytics-core';
import { dayKey } from '@/lib/time';
import { db } from './db';
import { loadItems, workPeopleWhere } from './services/analytics';
import { appTz } from './settings';
import { syncAll } from './sync/google-sheet';

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

/** Everything the scheduler runs: sheet sync for each work type, then the workload snapshot. */
export async function runJobs() {
  const sync = await syncAll();
  const snapshots = await snapshotWorkload();
  return { sync, snapshots };
}
