/** Feedback tickets: numbering, who is on the other side, who may chat and who may close. Pure. */
import { hasCap, type ActorContext } from './workflow';

export const ticketCode = (n: number) => `TICK-${String(n).padStart(5, '0')}`;

/** Severity as raised today (Low / Medium / High); older tickets may carry Minor / Major / Blocker. */
export const SEVERITIES = ['Low', 'Medium', 'High'] as const;
export const severityTone = (s: string | null | undefined): 'bad' | 'warn' | 'neutral' => {
  const v = (s ?? '').toLowerCase();
  return v === 'high' || v === 'blocker' ? 'bad' : v === 'medium' || v === 'major' ? 'warn' : 'neutral';
};

/** The ticket's title: what was typed, else the first line of the description, shortened. */
export function ticketTitle(title: string | null | undefined, body: string): string {
  const t = (title ?? '').trim();
  if (t) return t.slice(0, 120);
  const first = body.trim().split('\n')[0] ?? '';
  return first.length > 70 ? `${first.slice(0, 67).trimEnd()}…` : first;
}

export type Party = { assigneeId: string | null; ownerId: string | null; developerId: string | null };

/**
 * Who a ticket is addressed to. The creator asks the developer (design fixes) or else the reviewer; the developer asks the
 * creator; anyone else (reviewer, steward, admin) asks the creator. Never the author.
 */
export function counterpart(authorId: string | null, p: Party): string | null {
  const pick =
    authorId && authorId === p.developerId ? p.assigneeId
    : authorId && authorId === p.assigneeId ? (p.developerId ?? p.ownerId)
    : (p.assigneeId ?? p.developerId);
  return pick && pick !== authorId ? pick : null;
}

/** Whom a new message or a close reaches: the two sides of the ticket, minus the person who just acted. */
export const ticketAudience = (t: { authorId: string | null; toId: string | null }, actorId: string | null): string[] =>
  [...new Set([t.authorId, t.toId].filter((id): id is string => Boolean(id) && id !== actorId))];

/** People tied to the work (or steering it) can raise tickets and chat; the two sides of a ticket always can. */
export function canChat(ctx: ActorContext, ticket?: { authorId: string | null; toId: string | null }, userId?: string | null): boolean {
  const side = Boolean(ticket && userId && (ticket.authorId === userId || ticket.toId === userId));
  return side || ctx.isAdmin || ctx.isAssignee || Boolean(ctx.isOwner) || Boolean(ctx.isDeveloper) || hasCap(ctx, 'assign') || hasCap(ctx, 'review');
}

/** Only the person who raised a ticket closes (or reopens) it; an admin can too. */
export const canCloseTicket = (ctx: ActorContext, ticket: { authorId: string | null }, userId: string | null): boolean =>
  ctx.isAdmin || (Boolean(userId) && ticket.authorId === userId);
