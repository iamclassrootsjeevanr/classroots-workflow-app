import { createHash } from 'node:crypto';
import { TICKET_FIELD } from './feedback';
import { journeyKeyOf } from './journey';
import { DASHBOARD_STATUSES } from './relay-contract';

/**
 * A change recorded here (a WorkItemEvent of a journey) as the event the relay keeps (`dashboard_event`, contract in relay-contract.ts).
 * Pure (no DB). Every source is sent, the relay's own moves included, so the relay's copy of a journey's stage here is whole; `data.source`
 * says where the change came from. The relay stores it and acts on none of it, so nothing comes back.
 */
export type DashEvent = {
  event_id: string;
  at: string;
  by: string;
  key: string;
  entity: 'item' | 'status' | 'assignment' | 'field' | 'feedback';
  action: 'create' | 'update' | 'delete';
  from?: string;
  to?: string;
  data: Record<string, unknown>;
};

export type EventRow = {
  id: string;
  type: string;
  field: string | null;
  fromValue: string | null;
  toValue: string | null;
  source: string;
  note: string | null;
  meta: unknown;
  at: Date;
  actorEmail: string | null;
  externalKey: string;
};

export type PushContext = {
  /** Field labels the person slots are logged under (Journey: SME reviewer, Developer). */
  labels: { owner: string; developer: string };
  statusLabel: (status: string) => string | null;
  /** A person's email by the name events record, where the name is unique. */
  emailByName: Map<string, string>;
};

/** The event types that are sent. Comments and sheet conflicts are not data about the journey. */
export const PUSHED_TYPES = ['CREATED', 'IMPORTED', 'STATUS_CHANGED', 'ASSIGNED', 'UNASSIGNED', 'FIELD_CHANGED', 'FEEDBACK'] as const;

/** The label old history events of the removed peer reviewer slot carry. */
export const PEER_FIELD = 'Peer reviewer';

const MAX_VALUE = 500;
const MAX_NOTE = 2000;
const cut = (s: string | null | undefined, n = MAX_VALUE) => (s == null || s === '' ? undefined : s.length > n ? s.slice(0, n - 1) + '…' : s);
const isStatus = (s: string | null): s is string => !!s && (DASHBOARD_STATUSES as readonly string[]).includes(s);

/** The id the relay keeps the event under: the same event always gives the same id, so a resend is kept once. */
export const eventIdFor = (workEventId: string) => createHash('sha256').update(`classroots-work:${workEventId}`).digest('hex');

/** The relay event for one change here, or the reason it is not sent. */
export function dashEventFor(row: EventRow, ctx: PushContext): DashEvent | { skip: string } {
  const key = journeyKeyOf(row.externalKey);
  if (!key) return { skip: 'not a journey key' };
  const base = { event_id: eventIdFor(row.id), at: row.at.toISOString(), by: row.actorEmail?.toLowerCase() ?? 'system', key };
  const data: Record<string, unknown> = { source: row.source };
  if (row.note) data.note = cut(row.note, MAX_NOTE);
  const person = (name: string | null) => (name ? (ctx.emailByName.get(name.trim().toLowerCase()) ?? name) : null);
  const people = (role: string): DashEvent => {
    if (row.fromValue) data.from_name = row.fromValue;
    if (row.toValue) data.name = row.toValue;
    return { ...base, entity: 'assignment', action: row.toValue ? 'update' : 'delete', from: cut(person(row.fromValue)), to: cut(person(row.toValue)), data: { ...data, role } };
  };
  switch (row.type) {
    case 'CREATED':
    case 'IMPORTED':
      return { ...base, entity: 'item', action: 'create', to: cut(row.toValue), data: { ...data, ...(row.toValue ? { status: row.toValue, label: ctx.statusLabel(row.toValue) } : {}) } };
    case 'STATUS_CHANGED':
      // A stage an admin added here is not in the contract: it goes as a field, so it is kept and not refused.
      if (!isStatus(row.toValue)) return { ...base, entity: 'field', action: 'update', from: cut(row.fromValue), to: cut(row.toValue), data: { ...data, field: 'status', label: row.toValue ? ctx.statusLabel(row.toValue) : null } };
      return { ...base, entity: 'status', action: 'update', from: cut(row.fromValue), to: row.toValue, data: { ...data, label: ctx.statusLabel(row.toValue) } };
    case 'ASSIGNED':
    case 'UNASSIGNED':
      return people('creator');
    case 'FEEDBACK': {
      const meta = row.meta && typeof row.meta === 'object' && !Array.isArray(row.meta) ? (row.meta as Record<string, unknown>) : {};
      // A ticket closed or reopened: an update of that ticket (`data.ticket`), so the relay can tell which asks are still open.
      if (row.field === TICKET_FIELD && (row.toValue === 'closed' || row.toValue === 'open')) return { ...base, entity: 'feedback', action: 'update', from: cut(row.fromValue), to: row.toValue, data: { ...data, ...meta } };
      return { ...base, entity: 'feedback', action: 'create', data: { ...data, ...meta } };
    }
    case 'FIELD_CHANGED': {
      if (row.field === ctx.labels.owner) return people('reviewer');
      // The peer reviewer was removed (24 Nov 2026). Its old history stays here and is not sent.
      if (row.field === PEER_FIELD) return { skip: 'the peer reviewer is not sent' };
      if (row.field === ctx.labels.developer) return people('developer');
      if (row.field === 'archivedAt') return { ...base, entity: 'item', action: row.toValue ? 'delete' : 'update', data: { ...data, ...(row.toValue ? {} : { restored: true }) } };
      if (!row.field) return { skip: 'a field change with no field' };
      return { ...base, entity: 'field', action: row.toValue == null ? 'delete' : 'update', from: cut(row.fromValue), to: cut(row.toValue), data: { ...data, field: row.field } };
    }
    default:
      return { skip: `${row.type} is not sent` };
  }
}

export type PushReply = { recorded: string[]; duplicate: string[]; rejected: { event_id: string | null; error: string }[] };

/** A `dashboard_event` reply, read: which ids the relay kept, already had, or refused. */
export function parsePushReply(reply: unknown): PushReply {
  const root = reply && typeof reply === 'object' && !Array.isArray(reply) ? (reply as Record<string, unknown>) : {};
  const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  const rejected = (Array.isArray(root.rejected) ? root.rejected : []).flatMap(x => {
    const r = x && typeof x === 'object' ? (x as Record<string, unknown>) : null;
    return r ? [{ event_id: typeof r.event_id === 'string' ? r.event_id : null, error: String(r.error ?? 'refused') }] : [];
  });
  return { recorded: ids(root.recorded), duplicate: ids(root.duplicate), rejected };
}
