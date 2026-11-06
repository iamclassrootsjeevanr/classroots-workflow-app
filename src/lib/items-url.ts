/**
 * Every metric, chart and tile in the app opens the item list of its work type with the matching filter.
 * Build those links here so new work types and new charts stay consistent.
 *
 * Filters understood by /w/[workType]/items: status (key or comma list), cat (category or comma list), dev (user id or "none"),
 * group, scope (mine | team | review | overdue), q, grade, sme (owner id), team (team id).
 */
export type ItemsFilter = Partial<Record<'status' | 'cat' | 'dev' | 'sme' | 'group' | 'scope' | 'q' | 'team', string | string[]>>;

export function itemsUrl(workTypeKey: string, filter: ItemsFilter = {}): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(filter)) {
    const value = Array.isArray(v) ? v.join(',') : v;
    if (value) q.set(k, value);
  }
  return `/w/${workTypeKey}/items${q.size ? `?${q}` : ''}`;
}

/** Match a filter value that may be a comma list. */
export const inList = (value: string, filter: string | undefined) => !filter || filter.split(',').includes(value);
