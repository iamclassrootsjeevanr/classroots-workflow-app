/** Inbox helpers shared by server and client. Pure. */
import { UNDO_DELETE_MINUTES } from './workflow';

export type NotificationView = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  data: Record<string, unknown>;
  read: boolean;
  createdAt: string;
};

/** "G07C04 | TC_001" -> "TC_001": the part of a key that is not the group heading. */
export const shortKey = (externalKey: string) => externalKey.split(' | ').pop() ?? externalKey;

export const undoDeadline = (deletedAt: Date) => new Date(deletedAt.getTime() + UNDO_DELETE_MINUTES * 60_000);

/** Whether a message still offers Undo: a delete notice, before its deadline. */
export function undoOpen(n: Pick<NotificationView, 'kind' | 'data'>, now: Date = new Date()): boolean {
  if (n.kind !== 'item.deleted' && n.kind !== 'version.deleted') return false;
  const until = typeof n.data.undoUntil === 'string' ? Date.parse(n.data.undoUntil) : NaN;
  return Number.isFinite(until) && until > now.getTime();
}

export function timeAgo(iso: string, now: Date = new Date()): string {
  const s = Math.max(0, Math.round((now.getTime() - Date.parse(iso)) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} day${d === 1 ? '' : 's'} ago`;
  const mo = Math.round(d / 30);
  return `${mo} month${mo === 1 ? '' : 's'} ago`;
}

/** Minutes of Undo left, rounded up (0 when over). */
export function undoMinutesLeft(n: Pick<NotificationView, 'data'>, now: Date = new Date()): number {
  const until = typeof n.data.undoUntil === 'string' ? Date.parse(n.data.undoUntil) : NaN;
  return Number.isFinite(until) ? Math.max(0, Math.ceil((until - now.getTime()) / 60_000)) : 0;
}
