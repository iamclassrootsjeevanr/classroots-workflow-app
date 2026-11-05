import { shortKey } from '@/lib/notifications-core';
import { allModules, statusDef } from '@/modules/registry';
import { db } from '../db';
import { notify, stewardIds } from './notifications';

/**
 * Inbox message when an item passes its due date while still with its people (Journey: review not closed by Closure due).
 * Goes to the item's owner (reviewer) and the coordinators of its group, once per item and due date.
 * Only for work types that ask for it (`dueEndsAt: 'approved'`, i.e. the due date belongs to the review).
 */
export async function notifyOverdue(now = new Date()) {
  let sent = 0;
  for (const mod of allModules().filter(m => m.dueEndsAt === 'approved')) {
    const wt = await db.workType.findUnique({ where: { key: mod.key }, select: { id: true, state: true } });
    if (!wt || wt.state !== 'ACTIVE') continue;
    const items = await db.workItem.findMany({
      where: { workTypeId: wt.id, archivedAt: null, approvedAt: null, completedAt: null, dueAt: { lt: now } },
      select: { id: true, externalKey: true, title: true, status: true, dueAt: true, ownerId: true, groupKey: true },
    });
    if (!items.length) continue;
    const byGroup = new Map<string | null, string[]>();
    for (const it of items) {
      const coordinators = byGroup.get(it.groupKey) ?? (await stewardIds(db, wt.id, it.groupKey));
      byGroup.set(it.groupKey, coordinators);
      if (statusDef(mod, it.status).category === 'done') continue;
      const due = it.dueAt!.toISOString().slice(0, 10);
      const already = await db.notification.count({ where: { kind: 'item.overdue', data: { path: ['itemId'], equals: it.id }, AND: { data: { path: ['due'], equals: due } } } });
      if (already) continue;
      const to = new Set([it.ownerId, ...coordinators].filter((x): x is string => Boolean(x)));
      for (const userId of to) {
        await notify(db, userId, {
          kind: 'item.overdue',
          title: `Overdue: ${shortKey(it.externalKey)} (${mod.labels?.due ?? 'due'} ${due})`,
          body: `${it.title} · ${statusDef(mod, it.status).label}`,
          href: `/w/${mod.key}/${it.id}`,
          data: { itemId: it.id, due },
        });
        sent++;
      }
    }
  }
  return sent;
}
