/**
 * Chapter codes and the chapter picker's list. Pure (no DB).
 * A chapter code is GxxCyy; a book in parts carries the part: GxxPnCyy (grades 7 and 8 on the relay: G07P1C03).
 */

export type ChapterCode = { grade: number; /** Part of the book, when the code names one. */ part: number | null; /** Chapter number in the book, or in its part. */ chapterNo: number };

export function parseChapterCode(code: string): ChapterCode | null {
  const m = code.trim().match(/^G(\d{2})(?:P(\d))?C(\d{2})$/i);
  return m ? { grade: Number(m[1]), part: m[2] ? Number(m[2]) : null, chapterNo: Number(m[3]) } : null;
}

const ROMAN = ['I', 'II', 'III', 'IV'];
/** The part as the chapter list writes it: 2 → "Part II". */
export const partLabel = (part: number | null | undefined) => (part ? `Part ${ROMAN[part - 1] ?? part}` : null);

/** False for a chapter without a real name: none, or its own code (what the relay sync writes for a chapter it has not seen). */
export const hasChapterName = (code: string, title: string | null | undefined) => Boolean(title?.trim()) && title!.trim().toUpperCase() !== code.trim().toUpperCase();

export type ChapterOption = { code: string; title: string };

/** Every word typed is somewhere in the code or the name; spaces and case do not matter. Nothing typed matches all. */
export function chapterMatches(typed: string, o: ChapterOption) {
  const hay = `${o.code} ${o.title}`.toLowerCase();
  return typed.toLowerCase().split(/\s+/).filter(Boolean).every(w => hay.includes(w));
}

/** The options under their grade, grades and codes in order. Codes that are not chapter codes go last, under "Other". */
export function chaptersByGrade<T extends ChapterOption>(list: readonly T[]): { label: string; options: T[] }[] {
  const groups = new Map<number, T[]>();
  for (const o of list) {
    const grade = parseChapterCode(o.code)?.grade ?? Infinity;
    groups.set(grade, [...(groups.get(grade) ?? []), o]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([grade, options]) => ({ label: Number.isFinite(grade) ? `Grade ${grade}` : 'Other', options: [...options].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })) }));
}

/**
 * Why a new code must not be added, or null. A grade whose chapters carry the part (G07P1C03) takes no code without one (G07C03):
 * it would be a second row for a chapter that is already there.
 */
export function chapterCodeConflict(code: string, existing: readonly string[]): string | null {
  const c = parseChapterCode(code);
  if (!c || c.part) return null;
  const withPart = existing.find(e => {
    const p = parseChapterCode(e);
    return p?.grade === c.grade && p.part;
  });
  return withPart ? `Grade ${c.grade} codes carry the part of the book, like ${withPart}.` : null;
}

/** A chapter as the relay's chapter list names it (KG, `kg_nm_list_chapters`): its code there (CBG07P1C03) and its title. */
export type RelayChapter = { code: string; title: string };

/**
 * The relay's chapter list, as far as a name needs it: CBSE chapters with a code and a title. Anything else in the reply is ignored
 * (other curricula number the same grades again, so they must not name a chapter here).
 */
export function parseRelayChapters(reply: unknown): RelayChapter[] {
  const list = reply && typeof reply === 'object' ? (reply as { chapters?: unknown }).chapters : null;
  if (!Array.isArray(list)) return [];
  return list.flatMap(c => {
    const r = (c ?? {}) as Record<string, unknown>;
    const code = typeof r.code === 'string' ? r.code.trim().toUpperCase() : '';
    const title = typeof r.title === 'string' ? r.title.trim() : '';
    return r.curriculum === 'cbse' && code.startsWith('CB') && parseChapterCode(code.slice(2)) && title ? [{ code, title }] : [];
  });
}

/**
 * The relay's name for a chapter code used here, or null. The relay's code is ours with `CB` in front and always a part (CBG04P1C05).
 * A code here with the part (G07P1C03) must match exactly. A code without it (G04C05) takes the one chapter of that grade with that
 * number; where two parts both have it (grade 7: P1C03 and P2C03) there is no answer, and nothing is guessed.
 */
export function relayChapterName(code: string, relay: readonly RelayChapter[]): string | null {
  const c = parseChapterCode(code);
  if (!c) return null;
  const hits = relay.filter(r => {
    const p = parseChapterCode(r.code.slice(2));
    return p && p.grade === c.grade && p.chapterNo === c.chapterNo && (c.part === null || p.part === c.part);
  });
  return hits.length === 1 ? hits[0].title : null;
}
