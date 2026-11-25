/**
 * How every search box matches: part or all of a word, any case. With several words, each one must be found somewhere
 * (in any field and any order), so "more people" finds `more-people-smaller-shares` and "arjun halves" finds Arjun's journey.
 */
export const searchWords = (q: string | undefined) => (q ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean);

/** The same rule for lists filtered in memory. */
export function matchesSearch(q: string | undefined, texts: (string | null | undefined)[]): boolean {
  const hay = texts.filter(Boolean).map(t => t!.toLowerCase());
  return searchWords(q).every(w => hay.some(t => t.includes(w)));
}
