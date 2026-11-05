/** A label for use mid-sentence: lower case, but acronyms stay as written ("SME creator" stays, "Tested by" → "tested by"). */
export function lowerLabel(label: string): string {
  return label
    .split(' ')
    .map(w => (/^[A-Z0-9]{2,}$/.test(w) ? w : w.toLowerCase()))
    .join(' ');
}
