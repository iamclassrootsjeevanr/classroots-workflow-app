/**
 * Journeys the relay cut. A scope re-cut on the relay drops a journey from its allocations (journey_status still answers for it).
 * The dashboard then kept the journey open, counted in every "allocated" tile. Pure (no DB).
 */
import { parseJourneyKey } from './journey';

/** The note on the archive event the sync writes; a journey archived with it comes back if the relay allocates it again. */
export const RELAY_CUT_NOTE = 'Cut on the relay';

export type CutCandidate = {
  key: string;
  status: string;
  archived: boolean;
  /** Work was started here (firstStartedAt). */
  started: boolean;
  /** The relay sync made it (its CREATED event's source is RELAY). */
  madeByRelay: boolean;
};

/**
 * Journeys to archive: made by the relay, never started here, still at the first status, and no longer allocated on the relay,
 * in a chapter the relay still allocates in (so an empty or partial reply never archives a whole chapter). A journey made here,
 * or one anyone worked on, is only reported (`notOnRelay`), never archived.
 */
export function relayCutJourneys(items: readonly CutCandidate[], relayKeys: ReadonlySet<string>, relayChapters: ReadonlySet<string>, initialStatus: string): string[] {
  if (!relayKeys.size) return [];
  return items
    .filter(i => {
      const k = parseJourneyKey(i.key);
      return k && !i.archived && i.madeByRelay && !i.started && i.status === initialStatus && !relayKeys.has(i.key.toUpperCase()) && relayChapters.has(k.chapter);
    })
    .map(i => i.key)
    .sort();
}

/** Chapters the relay allocates in: every allocation row's key (chapter, subtopic or journey), cut to its chapter code. */
export function relayAllocationChapters(keys: Iterable<string>): Set<string> {
  const out = new Set<string>();
  for (const raw of keys) {
    const m = String(raw).toUpperCase().match(/^G\d{2}(?:P\d)?C\d{2}/);
    if (m) out.add(m[0]);
  }
  return out;
}
