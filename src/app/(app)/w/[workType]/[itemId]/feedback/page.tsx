import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FeedbackTickets, type TicketView } from '@/components/feedback-tickets';
import { PageHeader } from '@/components/ui';
import { canSeeItem } from '@/lib/access-core';
import { canChat, canCloseTicket, ticketCode, counterpart, ticketChoices } from '@/lib/feedback';
import { formatDateTime } from '@/lib/time';
import { getModule } from '@/modules/registry';
import { actorContextFor, requireWorkTypePage } from '@/server/access';
import { db } from '@/server/db';
import { correctionsMoves } from '@/server/services/work-items';
import { appTz } from '@/server/settings';

export const metadata = { title: 'Feedback' };

/** The item's feedback tickets, one per issue, each with its own chat. Opened from the item page and from inbox messages. */
export default async function FeedbackPage({ params }: { params: Promise<{ workType: string; itemId: string }> }) {
  const { workType: key, itemId } = await params;
  const { user, access } = await requireWorkTypePage(key, 'items');
  const mod = getModule(key);
  const found = (await db.workItem.findUnique({ where: { id: itemId }, select: { id: true } }))?.id
    ?? (await db.workItem.findFirst({ where: { workType: { key }, externalKey: decodeURIComponent(itemId).toUpperCase(), archivedAt: null }, select: { id: true } }))?.id;
  if (!mod || !found) notFound();
  const item = await db.workItem.findUnique({
    where: { id: found },
    include: {
      workType: { select: { key: true, state: true } },
      feedback: { orderBy: { createdAt: 'desc' }, include: { author: { select: { name: true } }, messages: { orderBy: { createdAt: 'asc' } } } },
    },
  });
  if (!item || item.archivedAt || item.workType.key !== key || !canSeeItem(access, key, item)) notFound();

  const ctx = actorContextFor(access, key, item);
  const editable = item.workType.state === 'ACTIVE';
  const ids = [...new Set(item.feedback.flatMap(f => [f.toId, ...f.messages.map(m => m.authorId)]).filter((x): x is string => Boolean(x)))];
  const names = new Map((await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } })).map(u => [u.id, u.name ?? u.email ?? 'Someone']));
  const tz = appTz();

  const tickets: TicketView[] = item.feedback.map(f => ({
    id: f.id,
    code: ticketCode(f.ticketNo),
    title: f.title || f.body.split('\n')[0] || 'Feedback',
    body: f.body,
    severity: f.severity,
    category: f.category,
    open: !f.resolvedAt,
    createdAt: formatDateTime(f.createdAt, tz),
    closedAt: f.resolvedAt ? formatDateTime(f.resolvedAt, tz) : null,
    authorName: f.author?.name ?? 'Someone',
    toName: f.toId ? (names.get(f.toId) ?? null) : null,
    mine: f.authorId === user.id,
    canClose: editable && canCloseTicket(ctx, f, user.id),
    canReply: editable && canChat(ctx, f, user.id),
    messages: f.messages.map(m => ({ id: m.id, authorId: m.authorId, authorName: m.authorId ? (names.get(m.authorId) ?? 'Someone') : 'Someone', body: m.body, at: formatDateTime(m.createdAt, tz) })),
  }));
  const sendBacks = editable ? correctionsMoves(mod, item.status, ctx).map(t => ({ to: t.to, label: t.label ?? `Send back (${mod.statuses.find(s => s.key === t.to)?.label ?? t.to})` })) : [];
  // Who a new ticket can go to: the people on the journey, the usual other side first.
  const usual = counterpart(user.id, item);
  const partLabel = { creator: mod.labels?.assignee ?? 'Assignee', reviewer: mod.labels?.owner ?? 'Reviewer', developer: mod.developerHandoff?.label ?? 'Developer' };
  const choices = ticketChoices(user.id, item);
  const readerNames = new Map((await db.user.findMany({ where: { id: { in: choices.map(c => c.id) } }, select: { id: true, name: true, email: true } })).map(u => [u.id, u.name ?? u.email ?? 'Someone']));
  const readers = choices.map(c => ({ id: c.id, label: `${readerNames.get(c.id) ?? 'Someone'} · ${partLabel[c.role]}` })).sort((a, b) => Number(b.id === usual) - Number(a.id === usual));

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Feedback"
        subtitle={`${item.externalKey} · ${item.title}`}
        actions={
          <Link href={`/w/${key}/${item.id}`} className="btn-ghost gap-1">
            <ArrowLeft size={15} aria-hidden="true" /> Back
          </Link>
        }
      />
      <FeedbackTickets itemId={item.id} tickets={tickets} currentUserId={user.id} canRaise={editable && canChat(ctx)} readers={readers} sendBacks={sendBacks} />
    </div>
  );
}
