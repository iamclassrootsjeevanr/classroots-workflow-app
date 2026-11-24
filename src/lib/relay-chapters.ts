import type { FeedCursor, FeedEvent } from './relay-contract';

/**
 * A chapter's progress on the relay before its journeys exist here: the chapter read (stage 1) and the scopes (stage 2), which the relay
 * records under the chapter key and the subtopic keys. Pure (no DB). Only what the feed gives is used; no journey is made from it.
 */
export type ChapterFeedRow = { seq: string; chapter: string; key: string; entity: string; at: Date; by: string | null; data: Record<string, unknown> };

export type ChapterProgress = {
  code: string;
  /** The relay's holder of the chapter key (an email), or null when it is released or was never allocated. */
  steward: string | null;
  /** The chapter read (human-approve-03): approved, and not taken back by a later reopen of the chapter. */
  read: { approved: boolean; at: Date | null; by: string | null };
  /** Subtopic keys the feed has shown, in order. */
  subtopics: string[];
  /** Those with a scope approval (human-approve-04) that still counts. */
  scopesApproved: string[];
  /** Who scopes: the steward, or the seats when the steward handed the scopes over (scope_mode). */
  scopeMode: 'steward' | 'seats';
  /** Journey keys the scope approvals that count cut the subtopics into. */
  journeysCut: string[];
};

const CHAPTER = /^(G\d{2}(?:P\d)?C\d{2})(ST\d+)?$/;
/** Feed entities kept for a chapter: what gives the steward, the chapter read, the scopes and the scope mode. */
const KEPT = new Set(['allocation', 'scope_mode', 'step', 'approval', 'baseline', 'reopen']);
/** The feed sources those entities come from. */
export const CHAPTER_FEED_SOURCES = ['allocations', 'scope_modes', 'steps'] as const;

/** The cursor that reads only those sources: every other source starts past its last row. */
export function chapterFeedCursor(saved: FeedCursor | null | undefined): FeedCursor {
  const sources = CHAPTER_FEED_SOURCES as readonly string[];
  const cursor: FeedCursor = { statuses: Number.MAX_SAFE_INTEGER, notes: Number.MAX_SAFE_INTEGER, writes: Number.MAX_SAFE_INTEGER };
  for (const s of sources) cursor[s] = saved?.[s] ?? 0;
  return cursor;
}

/** What to keep of a reply's cursor: the sources read. */
export const keptChapterCursor = (cursor: FeedCursor): FeedCursor => Object.fromEntries((CHAPTER_FEED_SOURCES as readonly string[]).filter(s => Number.isInteger(cursor[s])).map(s => [s, cursor[s]]));

/** The feed events recorded at a chapter key or a subtopic key, as rows to keep. Journey keys, applet keys and other entities are left out. */
export function chapterFeedRows(events: readonly FeedEvent[]): ChapterFeedRow[] {
  const rows: ChapterFeedRow[] = [];
  for (const e of events) {
    const key = e.key?.toUpperCase() ?? '';
    const m = CHAPTER.exec(key);
    const at = new Date(e.at);
    if (!m || !KEPT.has(e.entity) || Number.isNaN(at.getTime())) continue;
    rows.push({ seq: e.seq, chapter: m[1], key, entity: e.entity, at, by: e.by, data: e.data });
  }
  return rows;
}

/** The journey keys of a scope approval. The relay sends the list as JSON text (`[{key, name}]`); a real list is read too. */
export function scopeJourneys(journeys: unknown): string[] {
  let list: unknown = journeys;
  if (typeof list === 'string') {
    try {
      list = JSON.parse(list);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];
  const keys = list.map(j => (typeof j === 'string' ? j : j && typeof j === 'object' ? String((j as Record<string, unknown>).key ?? '') : '')).map(k => k.toUpperCase().replace(/_.*$/, ''));
  return [...new Set(keys.filter(k => /^G\d{2}(?:P\d)?C\d{2}ST\d+J\d+$/.test(k)))];
}

const natural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });
const approvalIs = (r: ChapterFeedRow, id: string) => r.entity === 'approval' && String(r.data.approval ?? '').startsWith(id);

/**
 * Each chapter's progress from the rows kept. A reopen takes back what was approved before it (human-record-15): a reopen at the
 * chapter key takes back the chapter read and every scope under it, one at a subtopic key that subtopic's scope.
 */
export function chapterProgress(rows: readonly ChapterFeedRow[]): Map<string, ChapterProgress> {
  const out = new Map<string, ChapterProgress>();
  const byChapter = new Map<string, ChapterFeedRow[]>();
  for (const r of rows) byChapter.set(r.chapter, [...(byChapter.get(r.chapter) ?? []), r]);
  for (const [code, list] of byChapter) {
    const sorted = [...list].sort((a, b) => a.at.getTime() - b.at.getTime() || a.seq.localeCompare(b.seq, undefined, { numeric: true }));
    const last = <T,>(xs: T[]) => (xs.length ? xs[xs.length - 1] : null);
    const reopenedAfter = (key: string, at: Date) => sorted.some(r => r.entity === 'reopen' && (r.key === code || r.key === key) && r.at.getTime() > at.getTime());
    const allocation = last(sorted.filter(r => r.key === code && r.entity === 'allocation' && (r.data.level ?? 'chapter') === 'chapter'));
    const owner = typeof allocation?.data.owner === 'string' && allocation.data.owner.includes('@') ? allocation.data.owner.toLowerCase() : null;
    const readRow = last(sorted.filter(r => r.key === code && approvalIs(r, 'human-approve-03')));
    const readCounts = Boolean(readRow && !reopenedAfter(code, readRow.at));
    const subtopics = [...new Set(sorted.filter(r => r.key !== code).map(r => r.key))].sort(natural);
    const scopesApproved: string[] = [];
    const cut: string[] = [];
    for (const st of subtopics) {
      const scope = last(sorted.filter(r => r.key === st && approvalIs(r, 'human-approve-04')));
      if (!scope || reopenedAfter(st, scope.at)) continue;
      scopesApproved.push(st);
      cut.push(...scopeJourneys(scope.data.journeys));
    }
    const mode = last(sorted.filter(r => r.key === code && r.entity === 'scope_mode'));
    out.set(code, {
      code,
      steward: owner,
      read: { approved: readCounts, at: readCounts ? readRow!.at : null, by: readCounts ? (typeof readRow!.data.approver === 'string' ? readRow!.data.approver : readRow!.by) : null },
      subtopics,
      scopesApproved,
      scopeMode: mode?.data.mode === 'seats' ? 'seats' : 'steward',
      journeysCut: [...new Set(cut)].sort(natural),
    });
  }
  return out;
}
