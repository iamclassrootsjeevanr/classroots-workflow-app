import { shortKey } from '@/lib/notifications-core';
import { allModules, statusDef } from '@/modules/registry';
import { db } from '../db';
import { notify } from './notifications';

/**
 * Inbox message when an item passes its due date while still with its people (Journey: review not closed by Closure due).
 * Goes to the item's owner (reviewer) and everyone who assigns work in that work type, once per item and due date.
 * Only for work types that ask for it (`dueEndsAt: 'approved'`, i.e. the due date belongs to the review).
 */
export async function notifyOverdue(now = new Date()) {
  let sent = 0;
  for (const mod of allModules().filter(m => m.dueEndsAt === 'approved')) {
    const wt = await db.workType.findUnique({ where: { key: mod.key }, select: { id: true, state: true } });
    if (!wt || wt.state !== 'ACTIVE') continue;
    const items = await db.workItem.findMany({
      where: { workTypeId: wt.id, archivedAt: null, approvedAt: null, completedAt: null, dueAt: { lt: now } },
      select: { id: true, externalKey: true, title: true, status: true, dueAt: true, ownerId: true },
    });
    if (!items.length) continue;
    const coordinators = await db.user.findMany({
      where: { active: true, memberships: { some: { workTypeId: wt.id, roles: { some: { role: { capAssign: true, canEdit: true } } } } } },
      select: { id: true },
    });
    for (const it of items) {
      if (statusDef(mod, it.status).category === 'done') continue;
      const due = it.dueAt!.toISOString().slice(0, 10);
      const already = await db.notification.count({ where: { kind: 'item.overdue', data: { path: ['itemId'], equals: it.id }, AND: { data: { path: ['due'], equals: due } } } });
      if (already) continue;
      const to = new Set([it.ownerId, ...coordinators.map(c => c.id)].filter((x): x is string => Boolean(x)));
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
