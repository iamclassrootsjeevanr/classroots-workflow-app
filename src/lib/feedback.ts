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

/** The people a ticket can be addressed to: the item's creator, reviewer and developer, without its writer. */
export function ticketChoices(authorId: string | null, p: Party): { id: string; role: 'creator' | 'reviewer' | 'developer' }[] {
  const all = [
    { id: p.assigneeId, role: 'creator' as const },
    { id: p.ownerId, role: 'reviewer' as const },
    { id: p.developerId, role: 'developer' as const },
  ];
  return all.filter((c, i): c is { id: string; role: 'creator' | 'reviewer' | 'developer' } => Boolean(c.id) && c.id !== authorId && all.findIndex(x => x.id === c.id) === i);
}

/**
 * Who a new ticket goes to. A ticket that sends the item back is for the person who gets the item (`sentBackTo`). Otherwise the person
 * its writer picked, when that is someone on the item; else the usual other side (`counterpart`). Never the writer.
 */
export function ticketReader(authorId: string | null, p: Party, opts: { picked?: string | null; sentBackTo?: 'assignee' | 'developer' | null } = {}): string | null {
  const handed = opts.sentBackTo === 'assignee' ? p.assigneeId : opts.sentBackTo === 'developer' ? p.developerId : null;
  if (handed && handed !== authorId) return handed;
  if (!opts.sentBackTo && opts.picked && ticketChoices(authorId, p).some(c => c.id === opts.picked)) return opts.picked;
  return counterpart(authorId, p);
}

/** Whom a new message or a close reaches: the two sides of the ticket, minus the person who just acted. */
export const ticketAudience = (t: { authorId: string | null; toId: string | null }, actorId: string | null): string[] =>
  [...new Set([t.authorId, t.toId].filter((id): id is string => Boolean(id) && id !== actorId))];

/** People tied to the work (or steering it) can raise tickets and chat; the two sides of a ticket always can. */
export function canChat(ctx: ActorContext, ticket?: { authorId: string | null; toId: string | null }, userId?: string | null): boolean {
  const side = Boolean(ticket && userId && (ticket.authorId === userId || ticket.toId === userId));
  return side || ctx.isAdmin || ctx.isAssignee || Boolean(ctx.isOwner) || Boolean(ctx.isDeveloper) || hasCap(ctx, 'assign') || hasCap(ctx, 'review') || hasCap(ctx, 'qa');
}

/** Only the person who raised a ticket closes (or reopens) it; an admin can too. */
export const canCloseTicket = (ctx: ActorContext, ticket: { authorId: string | null }, userId: string | null): boolean =>
  ctx.isAdmin || (Boolean(userId) && ticket.authorId === userId);

/** The part the writer of a ticket plays on the item: what the relay and the Inbox say beside their name. */
export type WriterRole = 'reviewer' | 'creator' | 'developer' | 'steward' | 'qa' | 'admin' | 'member' | 'system';

/**
 * The reviewer of the item, its creator, its developer, a steward who can act on it (the "assign" capability, which stops at their
 * chapters and teams), an admin, or someone else with access. `null` = a change the system made.
 */
export function writerRole(ctx: ActorContext | null): WriterRole {
  if (!ctx) return 'system';
  if (ctx.isOwner) return 'reviewer';
  if (ctx.isAssignee) return 'creator';
  if (ctx.isDeveloper) return 'developer';
  if (ctx.isAdmin) return 'admin';
  return hasCap(ctx, 'assign') ? 'steward' : hasCap(ctx, 'qa') ? 'qa' : 'member';
}

/** That part in the work type's own words ("SME reviewer", "Steward"). */
export function writerRoleLabel(role: WriterRole, mod: { labels?: { assignee?: string; owner?: string }; developerHandoff?: { label: string } }): string {
  if (role === 'reviewer') return mod.labels?.owner ?? 'Reviewer';
  if (role === 'creator') return mod.labels?.assignee ?? 'Assignee';
  if (role === 'developer') return mod.developerHandoff?.label ?? 'Developer';
  return role === 'steward' ? 'Steward' : role === 'qa' ? 'QA' : role === 'admin' ? 'Admin' : role === 'system' ? 'System' : 'Member';
}
