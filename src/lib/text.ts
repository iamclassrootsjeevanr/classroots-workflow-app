/** A label for use mid-sentence: lower case, but acronyms stay as written ("SME creator" stays, "Tested by" → "tested by"). */
export function lowerLabel(label: string): string {
  return label
    .split(' ')
    .map(w => (/^[A-Z0-9]{2,}$/.test(w) ? w : w.toLowerCase()))
    .join(' ');
}

const looseKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** The option meant by `value`, ignoring case, spaces and punctuation ("4 Build", "4 · build" → "4 · Build"). */
export function matchOption(options: readonly string[], value: string): string | undefined {
  const k = looseKey(value);
  return k ? options.find(o => looseKey(o) === k) : undefined;
}

/** Who made a change, for history lists: the person, else where it came from. */
export function eventWho(e: { actor?: { name: string | null; email: string | null } | null; source: string }): string {
  return e.actor?.name ?? e.actor?.email ?? (e.source === 'SHEET' ? 'Google Sheet' : e.source === 'IMPORT' ? 'Import' : e.source === 'RELAY' ? 'Claude' : 'System');
}
