import 'server-only';
import type { Prisma } from '@prisma/client';
import { ticketCode, ticketTitle } from '@/lib/feedback';
import { db } from './db';

/** One ticket in the Feedback tab's tables. */
export type TicketRow = {
  id: string;
  code: string;
  title: string;
  severity: string | null;
  category: string | null;
  open: boolean;
  createdAt: Date;
  closedAt: Date | null;
  from: string;
  to: string | null;
  replies: number;
  itemId: string;
  itemKey: string;
  itemTitle: string;
  itemStatus: string;
};

export const TICKET_LIST_MAX = 200;
export type TicketShow = 'open' | 'closed' | 'all';

/**
 * Tickets of one work type's items, newest first: the ones for a person (`toId`), the ones a person raised (`authorId`), or all of
 * them. `scope` is the person's own view of the work type's items. `total` is the count before the cap of `TICKET_LIST_MAX` rows.
 */
export async function ticketList(workTypeId: string, scope: Prisma.WorkItemWhereInput, who: { toId?: string; authorId?: string }, show: TicketShow): Promise<{ rows: TicketRow[]; total: number; open: number }> {
  const base: Prisma.FeedbackWhereInput = { item: { workTypeId, archivedAt: null, AND: [scope] }, ...(who.toId ? { toId: who.toId } : {}), ...(who.authorId ? { authorId: who.authorId } : {}) };
  const where: Prisma.FeedbackWhereInput = { ...base, ...(show === 'open' ? { resolvedAt: null } : show === 'closed' ? { resolvedAt: { not: null } } : {}) };
  const [found, total, open] = await Promise.all([
    db.feedback.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: TICKET_LIST_MAX,
      include: { author: { select: { name: true, email: true } }, item: { select: { id: true, externalKey: true, title: true, status: true } }, _count: { select: { messages: true } } },
    }),
    db.feedback.count({ where }),
    db.feedback.count({ where: { ...base, resolvedAt: null } }),
  ]);
  const toIds = [...new Set(found.map(f => f.toId).filter((x): x is string => Boolean(x)))];
  const names = new Map((await db.user.findMany({ where: { id: { in: toIds } }, select: { id: true, name: true, email: true } })).map(u => [u.id, u.name ?? u.email ?? 'Someone']));
  return {
    total,
    open,
    rows: found.map(f => ({
      id: f.id,
      code: ticketCode(f.ticketNo),
      title: ticketTitle(f.title, f.body),
      severity: f.severity,
      category: f.category,
      open: !f.resolvedAt,
      createdAt: f.createdAt,
      closedAt: f.resolvedAt,
      from: f.author?.name ?? f.author?.email ?? 'Someone',
      to: f.toId ? (names.get(f.toId) ?? null) : null,
      replies: f._count.messages,
      itemId: f.item.id,
      itemKey: f.item.externalKey,
      itemTitle: f.item.title,
      itemStatus: f.item.status,
    })),
  };
}
