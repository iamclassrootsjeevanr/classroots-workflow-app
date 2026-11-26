/** Links typed in a ticket or a chat message. Pure. */

export type TextPart = { type: 'text'; text: string } | { type: 'link'; url: string; label: string };

const LINK = /https?:\/\/[^\s<>"']+/g;
/** Punctuation that ends a sentence, not a link: "see https://x.org/a." keeps the full stop as text. */
const TRAIL = /[.,;:!?)\]}'"]+$/;

/** What a link chip says: the host and a shortened path ("uat.example.org/journey-composer/…/edit"). */
export function linkLabel(url: string, max = 48): string {
  try {
    const u = new URL(url);
    const host = u.host.replace(/^www\./, '');
    const path = `${u.pathname === '/' ? '' : u.pathname}${u.search}${u.hash}`;
    const full = `${host}${path}`;
    if (full.length <= max) return full;
    const last = u.pathname.split('/').filter(Boolean).pop() ?? '';
    const short = `${host}/…/${last}`;
    return short.length <= max && last ? short : `${full.slice(0, max - 1)}…`;
  } catch {
    return url.length > max ? `${url.slice(0, max - 1)}…` : url;
  }
}

/** The text split into plain parts and http(s) links, in order. Nothing else becomes a link. */
export function linkParts(text: string): TextPart[] {
  const out: TextPart[] = [];
  let at = 0;
  for (const m of text.matchAll(LINK)) {
    let url = m[0];
    const trail = url.match(TRAIL)?.[0] ?? '';
    // A closing bracket belongs to the link when the link opened it: https://x.org/a_(b)
    const keep = trail.startsWith(')') && (url.match(/\(/g)?.length ?? 0) >= (url.match(/\)/g)?.length ?? 0) ? 1 : 0;
    url = url.slice(0, url.length - trail.length + keep);
    try {
      if (!new URL(url).host) continue;
    } catch {
      continue;
    }
    const start = m.index ?? 0;
    if (start > at) out.push({ type: 'text', text: text.slice(at, start) });
    out.push({ type: 'link', url, label: linkLabel(url) });
    at = start + url.length;
  }
  if (at < text.length) out.push({ type: 'text', text: text.slice(at) });
  return out;
}
