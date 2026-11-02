import 'server-only';
import type { Prisma } from '@prisma/client';
import type { NotificationView } from '@/lib/notifications-core';
import { UNDO_DELETE_MINUTES } from '@/lib/workflow';
import { db } from '../db';

type Client = Prisma.TransactionClient | typeof db;

export type NewNotification = { kind: string; title: string; body?: string | null; href?: string | null; data?: Prisma.InputJsonValue };

/** Put a message in someone's inbox. Works inside a transaction. */
export async function notify(client: Client, userId: string, n: NewNotification) {
  return client.notification.create({ data: { userId, kind: n.kind, title: n.title, body: n.body ?? null, href: n.href ?? null, data: n.data ?? {} } });
}

const view = (n: { id: string; kind: string; title: string; body: string | null; href: string | null; data: unknown; readAt: Date | null; createdAt: Date }): NotificationView => ({
  id: n.id,
  kind: n.kind,
  title: n.title,
  body: n.body,
  href: n.href,
  data: (n.data ?? {}) as Record<string, unknown>,
  read: Boolean(n.readAt),
  createdAt: n.createdAt.toISOString(),
});

/** A delete notice whose 30 minutes of Undo are over has nothing left to do: move it to Read. */
export async function expireUndoNotices(userId: string, now: Date = new Date()) {
  await db.notification.updateMany({
    where: { userId, kind: 'item.deleted', readAt: null, createdAt: { lt: new Date(now.getTime() - UNDO_DELETE_MINUTES * 60_000) } },
    data: { readAt: now },
  });
}

export async function unreadCount(userId: string) {
  await expireUndoNotices(userId);
  return db.notification.count({ where: { userId, readAt: null } });
}

export type InboxQuery = { tab?: 'all' | 'unread' | 'read'; q?: string; take?: number };

export async function listNotifications(userId: string, { tab = 'all', q, take = 100 }: InboxQuery = {}): Promise<NotificationView[]> {
  await expireUndoNotices(userId);
  const rows = await db.notification.findMany({
    where: {
      userId,
      ...(tab === 'unread' ? { readAt: null } : tab === 'read' ? { readAt: { not: null } } : {}),
      ...(q?.trim() ? { OR: [{ title: { contains: q.trim(), mode: 'insensitive' } }, { body: { contains: q.trim(), mode: 'insensitive' } }] } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take,
  });
  return rows.map(view);
}

/** Mark messages read or unread (only the person's own). `ids` omitted = all of them. */
export async function setRead(userId: string, read: boolean, ids?: string[]) {
  await db.notification.updateMany({ where: { userId, ...(ids ? { id: { in: ids } } : {}) }, data: { readAt: read ? new Date() : null } });
}

export async function removeNotifications(userId: string, ids: string[]) {
  await db.notification.deleteMany({ where: { userId, id: { in: ids } } });
}
