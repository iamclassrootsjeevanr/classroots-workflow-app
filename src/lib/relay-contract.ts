/**
 * The data contract between the journey relay and this dashboard, in one place. Pure (no DB).
 * The relay keeps the same values in relay/src/lib/dashboard-contract.mjs; tests/fixtures/relay-contract.v1.json is the copy both sides'
 * tests hold themselves to (docs: journey_studio_mcpiser/docs/DASHBOARD-SYNC.md).
 *
 * Two lanes. Relay → dashboard: `sync_feed`, every row the relay appended since a cursor, in one shape. Dashboard → relay:
 * `dashboard_event`, every change made here, which the relay keeps in its own table and does not act on.
 * CONTRACT moves only when a field is renamed, removed or changes meaning: a reply with another number is refused, not guessed at.
 */
export const CONTRACT = 1;

export const FEED_SOURCES = ['allocations', 'scope_modes', 'steps', 'statuses', 'notes', 'writes'] as const;
export const FEED_ENTITIES = ['allocation', 'scope_mode', 'step', 'approval', 'baseline', 'reopen', 'publish_status', 'team_note', 'cms_write'] as const;
export const OPS = ['create', 'update', 'delete'] as const;

/** The journey statuses, in order (the Journey definition's keys; a test holds the two equal). */
export const DASHBOARD_STATUSES = [
  'allocated', 'creating', 'ready_for_review', 'review_in_progress', 'changes_asked', 'correction_verification', 'closed',
  'design_standardization', 'last_look', 'design_check', 'video_replacement', 'uat_to_prod', 'published_prod', 'user_testing_qa', 'done',
] as const;

/** The relay publish status each status here corresponds to (null: none yet). */
export const PUBLISH_FOR: Record<(typeof DASHBOARD_STATUSES)[number], string | null> = {
  allocated: null,
  creating: null,
  ready_for_review: 'up_for_review',
  review_in_progress: 'up_for_review',
  changes_asked: 'corrections_wip',
  correction_verification: 'up_for_review',
  closed: 'ready_from_content',
  design_standardization: 'ready_from_content',
  last_look: 'ready_from_content',
  design_check: 'ready_from_content',
  video_replacement: 'ready_from_content',
  uat_to_prod: 'ready_from_content',
  published_prod: 'ready_from_content',
  user_testing_qa: 'ready_from_content',
  done: 'ready_from_content',
};

export const DASHBOARD_ENTITIES = ['item', 'status', 'assignment', 'field', 'feedback'] as const;
export const DASHBOARD_ROLES = ['creator', 'reviewer', 'peer_reviewer', 'developer', 'steward'] as const;

/** The whole contract as plain data, as the fixture holds it. */
export const contractData = () => ({
  contract: CONTRACT,
  feed_sources: FEED_SOURCES,
  feed_entities: FEED_ENTITIES,
  ops: OPS,
  dashboard_statuses: DASHBOARD_STATUSES,
  publish_for: PUBLISH_FOR,
  dashboard_entities: DASHBOARD_ENTITIES,
  dashboard_roles: DASHBOARD_ROLES,
});

/**
 * The relay's publish status by its current name. The final state was `ready_for_student` until 2026-11-23, when the relay renamed it
 * `ready_from_content` (and its stored rows): anything kept here from before reads as the new name.
 */
export const publishName = (status: string): string => (status === 'ready_for_student' ? 'ready_from_content' : status);

export const publishFor = (status: string): string | null => (PUBLISH_FOR as Record<string, string | null>)[status] ?? null;

export class RelayContractError extends Error {}

export type FeedCursor = Record<string, number>;
export type FeedEvent = { seq: string; source: string; id: number; at: string; by: string | null; entity: string; op: string; key: string | null; data: Record<string, unknown> };
export type FeedPage = { cursor: FeedCursor; more: boolean; events: FeedEvent[] };

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

/** A `sync_feed` reply, checked. Null when the relay has no ledger to feed from; throws when the contract is not the one held here. */
export function parseFeed(reply: unknown): FeedPage | null {
  const root = obj(reply);
  if (!root) throw new RelayContractError('sync_feed: the reply is not an object');
  if (root.status === 'not installed') return null;
  if (root.contract !== CONTRACT) throw new RelayContractError(`sync_feed speaks contract ${JSON.stringify(root.contract)}; this dashboard holds ${CONTRACT}. Update src/lib/relay-contract.ts to the relay's dashboard-contract.mjs.`);
  const raw = obj(root.cursor);
  if (!raw || !Array.isArray(root.events)) throw new RelayContractError('sync_feed: the reply has no cursor or no events');
  const cursor: FeedCursor = {};
  for (const [k, v] of Object.entries(raw)) if (Number.isInteger(v) && (v as number) >= 0) cursor[k] = v as number;
  const events: FeedEvent[] = [];
  for (const x of root.events) {
    const e = obj(x);
    if (!e || typeof e.seq !== 'string' || typeof e.entity !== 'string') continue;
    events.push({ seq: e.seq, source: String(e.source ?? ''), id: Number(e.id) || 0, at: String(e.at ?? ''), by: typeof e.by === 'string' ? e.by : null, entity: e.entity, op: String(e.op ?? ''), key: typeof e.key === 'string' ? e.key : null, data: obj(e.data) ?? {} });
  }
  return { cursor, more: root.more === true, events };
}

const JOURNEY_KEY = /^G\d{2}(?:P\d)?C\d{2}ST\d+J\d+$/;
const ABOVE_KEY = /^G\d{2}(?:P\d)?C\d{2}(?:ST\d+)?$/;
/** Feed entities that change what a journey's status reply says (a team note and a ledgered CMS write do not). */
const MOVES = new Set(['allocation', 'scope_mode', 'step', 'approval', 'baseline', 'reopen', 'publish_status']);

export type Touched = { keys: Set<string>; prefixes: Set<string> };

/** The journeys a batch of feed events is about: named by key, or everything under a chapter or subtopic key (a scope approval, a reopen above). */
export function feedTouched(events: FeedEvent[]): Touched {
  const keys = new Set<string>();
  const prefixes = new Set<string>();
  for (const e of events) {
    if (!e.key || !MOVES.has(e.entity)) continue;
    const k = e.key.toUpperCase();
    if (JOURNEY_KEY.test(k)) keys.add(k);
    else if (ABOVE_KEY.test(k)) prefixes.add(k);
  }
  return { keys, prefixes };
}

export function isTouched(key: string, t: Touched): boolean {
  const k = key.toUpperCase();
  if (t.keys.has(k)) return true;
  for (const p of t.prefixes) if (k.startsWith(p) && /^(ST|J)/.test(k.slice(p.length))) return true;
  return false;
}

/** True when the relay does not offer a tool yet (an older relay) or does not let this token call it: quiet, not an error. */
export const toolUnavailable = (message: string) => /unknown tool|is refused: this service token is read-only|only the Classroots Work dashboard writes/i.test(message);

/**
 * A disagreement between the relay's publish status and the stage here is settled, not a flag, when the stage here changed after the
 * relay's status was set and that change has reached the relay (it is in the relay's dashboard log): each side then holds the other's word.
 */
export function mismatchSettled(lastHereAt: Date | null, publishAt: Date | null, delivered: boolean): boolean {
  return Boolean(delivered && lastHereAt && publishAt && lastHereAt.getTime() > publishAt.getTime());
}
