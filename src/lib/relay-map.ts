/**
 * The journey relay's ledger → what the dashboard keeps. Pure (no network, no DB).
 * The relay answers JSON; field names below follow the relay's records (journey-kit state.py): stage 0 | 3a | 3b | 4 | 5, `event_id`,
 * `withdrawn[]` and `reopens[]`. Parsing is tolerant: a missing field is skipped, never fatal.
 */
import { journeyKeyOf } from './journey';

/** Relay stage → the dashboard's Creation stage. Stage 0 (nothing started) and unknown stages map to nothing. */
const STAGE_NAMES: Record<string, string> = { '3a': '3a · Spine', '3b': '3b · Script', '4': '4 · Build', '5': '5 · Ship' };
export const creationStageOfRelay = (stage: unknown): string | null => STAGE_NAMES[String(stage ?? '').trim().toLowerCase()] ?? null;

export type RelayAllocation = { key: string; level: string; email: string | null; name: string | null; title: string | null };
export type RelayEventRow = {
  eventId: string;
  kind: string;
  stage: string | null;
  version: number | null;
  what: string | null;
  approval: string | null;
  approver: string | null;
  fingerprint: string | null;
  at: Date;
  withdrawn: boolean;
};

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** The allocations reply (or `whoami`'s `allocations`) → one row per allocated *journey*. Chapters and subtopics are ignored. */
export function parseAllocations(reply: unknown): RelayAllocation[] {
  const root = Array.isArray(reply) ? { allocations: reply } : rec(reply);
  const out = new Map<string, RelayAllocation>();
  for (const raw of list(root.allocations ?? root.items ?? root.rows)) {
    const a = rec(raw);
    const key = journeyKeyOf(String(a.key ?? a.journey ?? ''));
    if (!key || (a.level && a.level !== 'journey')) continue;
    // A journey the relay released has no owner any more; later rows for the same key win (the list is oldest first).
    const who = rec(a.person ?? a.holder ?? a.held_by);
    // The live relay names the holder in `owner` (an email); older shapes used person / holder.
    const email = (str(a.owner) ?? str(a.email) ?? str(a.person) ?? str(a.holder) ?? str(a.held_by) ?? str(who.email))?.toLowerCase() ?? null;
    out.set(key, { key, level: 'journey', email: email?.includes('@') ? email : null, name: str(a.name) ?? str(a.person_name) ?? str(who.name), title: str(a.title) });
  }
  return [...out.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/** Chapter-level allocations: the chapter's steward on the relay (`owner`). Later rows for the same chapter win. */
export function parseChapterStewards(reply: unknown): { code: string; email: string }[] {
  const root = Array.isArray(reply) ? { allocations: reply } : rec(reply);
  const out = new Map<string, string>();
  for (const raw of list(root.allocations ?? root.items ?? root.rows)) {
    const a = rec(raw);
    const code = str(a.key)?.toUpperCase();
    const email = str(a.owner)?.toLowerCase();
    if (a.level !== 'chapter' || !code || !/^G\d{2}(P\d)?C\d{2}$/.test(code) || !email?.includes('@')) continue;
    out.set(code, email);
  }
  return [...out.entries()].map(([code, email]) => ({ code, email })).sort((a, b) => a.code.localeCompare(b.code));
}

export type StewardMember = {
  userId: string;
  email: string | null;
  groupKeys: string[];
  coordinator: boolean;
  /** Admins see everything anyway: the relay can make them a chapter's steward (role given, chapter list set). */
  admin?: boolean;
};
export type StewardPlan = {
  /** Chapter codes to add to a coordinator's chapters. */
  add: { userId: string; code: string }[];
  /** A chapter handed to someone else on the relay: taken off the old steward (never their last chapter). */
  remove: { userId: string; code: string }[];
  /** Reported, nothing changed. */
  unknown: { code: string; email: string }[];
  notCoordinator: { code: string; email: string }[];
  /** Their chapter list is empty, which means every chapter: adding one would narrow it. */
  steersAll: { code: string; email: string }[];
  keptLast: { code: string; userId: string }[];
  /** Admins named by the relay who get the Steward role (and a Journey membership if they have none). */
  grantRole: { userId: string; code: string }[];
};

/**
 * Make the dashboard's stewards follow the relay's chapter owners. The steward is a coordinator whose chapter list holds the code.
 * Never empties a list (empty = every chapter), never touches people the relay does not name for a chapter. Grants the Steward role
 * only to admins (they see every chapter anyway, so a chapter list never narrows them); other people are reported.
 */
export function planStewards(stewards: { code: string; email: string }[], members: StewardMember[]): StewardPlan {
  const plan: StewardPlan = { add: [], remove: [], unknown: [], notCoordinator: [], steersAll: [], keptLast: [], grantRole: [] };
  const granted = new Set<string>();
  const byEmail = new Map(members.filter(m => m.email).map(m => [m.email!.toLowerCase(), m]));
  const keys = new Map(members.map(m => [m.userId, [...m.groupKeys]]));
  for (const { code, email } of stewards) {
    const m = byEmail.get(email);
    if (!m) {
      plan.unknown.push({ code, email });
      continue;
    }
    if (!m.coordinator && !m.admin) {
      plan.notCoordinator.push({ code, email });
      continue;
    }
    if (!m.coordinator && !granted.has(m.userId)) {
      granted.add(m.userId);
      plan.grantRole.push({ userId: m.userId, code });
      keys.set(m.userId, []);
    }
    const mine = keys.get(m.userId)!;
    if (!mine.length && !m.admin) plan.steersAll.push({ code, email });
    else if (!mine.includes(code)) {
      plan.add.push({ userId: m.userId, code });
      mine.push(code);
    }
    for (const other of members) {
      if (other.userId === m.userId || !other.coordinator) continue;
      const theirs = keys.get(other.userId)!;
      if (!theirs.includes(code)) continue;
      if (theirs.length === 1) {
        plan.keptLast.push({ code, userId: other.userId });
        continue;
      }
      plan.remove.push({ userId: other.userId, code });
      keys.set(other.userId, theirs.filter(k => k !== code));
    }
  }
  return plan;
}

const when = (v: unknown): Date | null => {
  const d = new Date(String(v ?? ''));
  return Number.isNaN(d.getTime()) ? null : d;
};

/** The journey_status reply → its events (steps, approvals, baselines, reopens), oldest first, with withdrawn approvals marked. */
export function parseStatus(reply: unknown): RelayEventRow[] {
  const root = rec(reply);
  const withdrawn = new Set(list(root.withdrawn).map(w => str(rec(w).event_id)).filter((x): x is string => Boolean(x)));
  const rows = new Map<string, RelayEventRow>();
  const add = (raw: unknown, kind: string) => {
    const e = rec(raw);
    const eventId = str(e.event_id);
    const at = when(e.when ?? e.at ?? e.recorded_at);
    if (!eventId || !at) return;
    const version = Number(e.version);
    rows.set(eventId, {
      eventId,
      kind: str(e.kind) ?? kind,
      stage: str(e.stage) ?? (typeof e.stage === 'number' ? String(e.stage) : null),
      version: Number.isFinite(version) ? version : null,
      what: str(e.what) ?? str(e.why),
      approval: str(e.approval) ?? (kind === 'approval' ? str(e.id) : null),
      approver: str(e.approver) ?? str(e.who) ?? str(e.decided_by),
      fingerprint: str(e.fingerprint),
      at,
      withdrawn: withdrawn.has(eventId),
    });
  };
  for (const e of list(root.events ?? root.steps ?? root.records)) add(e, 'step');
  for (const e of list(root.approvals)) add(e, 'approval');
  for (const e of list(root.baselines)) add(e, 'baseline');
  for (const e of list(root.reopens)) {
    const r = rec(e);
    // The relay may leave a reopen's event id empty: derive a stable one from the key and time.
    add({ ...r, event_id: str(r.event_id) ?? `reopen:${str(r.key) ?? ''}:${str(r.at) ?? ''}` }, 'reopen');
  }
  // Relay-side publish status changes (up_for_review, corrections_wip, ready_for_student…): shown, not applied.
  for (const e of list(root.publish_status_history)) {
    const r = rec(e);
    if (r.id != null) add({ ...r, event_id: `publish:${str(r.key) ?? ''}:${String(r.id)}`, what: str(r.status), approver: str(r.set_by), stage: null }, 'publish');
  }
  return [...rows.values()].sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** The journey_status reply's own summary: its current stage (the relay computes it), the time of its last step, its publish status. */
export function parseStatusMeta(reply: unknown): { stage: string | null; at: Date | null; publishStatus: string | null } {
  const root = rec(reply);
  const last = rec(root.last_step);
  return { stage: creationStageOfRelay(root.stage), at: when(last.at), publishStatus: str(rec(root.publish_status).status) };
}

/**
 * Where the journey stands on the relay, from its events (fallback when the reply carries no `stage`): the stage of its latest event that still counts (a withdrawn approval does not;
 * a reopen sets the stage it names). Null when the relay holds nothing yet or only stage 0.
 */
export function currentCreationStage(events: RelayEventRow[]): { stage: string | null; at: Date | null } {
  const counting = events.filter(e => !e.withdrawn && e.stage != null && e.kind !== 'baseline');
  const last = counting[counting.length - 1];
  return last ? { stage: creationStageOfRelay(last.stage), at: last.at } : { stage: null, at: null };
}

/** The approvals that count, in the order they were given: what the journey page shows as the relay timeline. */
export const APPROVAL_LABELS: Record<string, string> = {
  'human-approve-03': 'Chapter',
  'human-approve-04': 'Scope',
  'human-approve-05': 'Spine',
  'human-approve-06': 'Storyboard',
  'human-approve-08': 'Phase result',
  'human-approve-09': 'Conformance',
  'human-approve-10': 'Go (real write)',
  'human-approve-11': 'Played in code',
  'human-approve-13': 'Played in UAT',
  'human-approve-14': 'Phase prototype',
  'human-approve-15': 'Baseline accepted',
  'human-approve-16': 'Phase listing',
};
export const approvalLabel = (id: string | null) => (id ? (APPROVAL_LABELS[id.replace(/-[a-z]+$/, '')] ?? id) : '');

/** "krishna.rander@classrootsedu.com" → "krishna rander": the name an email's local part spells, for matching a person whose dashboard email differs. */
export const nameFromEmail = (email: string) => email.split('@')[0].replace(/[._+-]+/g, ' ').trim().toLowerCase();
