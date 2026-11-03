/** Time log of one item: every change in order, with who, when and how long it sat in the previous status. Pure. */
import type { StatusCategory } from '@/modules/types';

export type LogEvent = {
  id: string;
  at: Date;
  type: string;
  field: string | null;
  fromValue: string | null;
  toValue: string | null;
  note: string | null;
  who: string;
};

export type LogInterval = { status: string; enteredAt: Date; exitedAt: Date | null; businessMinutes: number };

export type LogKind = 'created' | 'status' | 'assign' | 'bug' | 'remarks' | 'comment' | 'field';

export type LogEntry = { id: string; at: Date; who: string; kind: LogKind; text: string; detail?: string; spent: number | null };

export type LogLookup = { label: (status: string) => string; category: (status: string) => StatusCategory; fieldLabel: (field: string) => string };

const BUG_FIELD = 'bug';
const REMARK_FIELD = 'developerRemarks';
const NOTE_FIELDS = new Set(['comments']);

/** Entries oldest first. */
export function buildTimeLog(events: LogEvent[], intervals: LogInterval[], look: LogLookup): LogEntry[] {
  const sorted = [...events].sort((a, b) => a.at.getTime() - b.at.getTime());
  return sorted.map(e => {
    const base = { id: e.id, at: e.at, who: e.who, spent: null as number | null };
    switch (e.type) {
      case 'CREATED':
      case 'IMPORTED':
        return { ...base, kind: 'created', text: `Created as ${e.toValue ? look.label(e.toValue) : 'new'}` };
      case 'STATUS_CHANGED': {
        // The stay that ended at this moment.
        const left = intervals.find(iv => iv.exitedAt && iv.status === e.fromValue && Math.abs(iv.exitedAt.getTime() - e.at.getTime()) < 2000);
        return {
          ...base,
          kind: 'status',
          text: `${e.fromValue ? look.label(e.fromValue) : '—'} → ${e.toValue ? look.label(e.toValue) : '—'}`,
          detail: e.note ?? undefined,
          spent: left ? left.businessMinutes : null,
        };
      }
      case 'ASSIGNED':
      case 'UNASSIGNED':
        return { ...base, kind: 'assign', text: e.toValue ? `Assigned to ${e.toValue}` : 'Unassigned' };
      case 'COMMENTED':
        return { ...base, kind: 'comment', text: 'Commented', detail: e.note ?? undefined };
      case 'FEEDBACK':
        return { ...base, kind: 'comment', text: 'Gave feedback', detail: e.note ?? undefined };
      case 'FIELD_CHANGED': {
        const field = e.field ?? '';
        if (field === 'archivedAt') return { ...base, kind: 'field', text: 'Deleted' };
        const kind: LogKind = field === BUG_FIELD ? 'bug' : field === REMARK_FIELD ? 'remarks' : NOTE_FIELDS.has(field) ? 'comment' : 'field';
        const verb = e.toValue == null ? 'Cleared' : e.fromValue == null ? 'Added' : 'Edited';
        return { ...base, kind, text: `${verb} ${look.fieldLabel(field).toLowerCase()}`, detail: e.toValue ?? undefined };
      }
      default:
        return { ...base, kind: 'field', text: e.type.toLowerCase().replace(/_/g, ' '), detail: e.note ?? undefined };
    }
  });
}

export type LogTotals = {
  /** Business minutes from the first stay until the first stay that is a result (failed, in review or done). */
  toFirstResult: number | null;
  /** Business minutes spent in failed (waiting for a fix) statuses. */
  waitingForFix: number;
  /** Business minutes spent waiting for a retest or review. */
  waitingForRetest: number;
  /** How many times the item went into a failed status. */
  failures: number;
};

export function timeLogTotals(intervals: LogInterval[], category: (status: string) => StatusCategory): LogTotals {
  const ordered = [...intervals].sort((a, b) => a.enteredAt.getTime() - b.enteredAt.getTime());
  const sum = (cat: StatusCategory) => ordered.filter(iv => category(iv.status) === cat).reduce((m, iv) => m + iv.businessMinutes, 0);
  const firstResult = ordered.findIndex(iv => ['feedback', 'review', 'approved', 'done'].includes(category(iv.status)));
  return {
    toFirstResult: firstResult < 0 ? null : ordered.slice(0, firstResult).reduce((m, iv) => m + iv.businessMinutes, 0),
    waitingForFix: sum('feedback'),
    waitingForRetest: sum('review'),
    failures: ordered.filter(iv => category(iv.status) === 'feedback').length,
  };
}
