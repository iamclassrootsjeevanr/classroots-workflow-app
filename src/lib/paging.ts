/** Paging for long item lists, so pages stay small and fast. */
export const PAGE_SIZE = 50;

export function pageOf<T>(list: T[], page: number, size = PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(list.length / size));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  const from = (current - 1) * size;
  return { rows: list.slice(from, from + size), page: current, pages, from: list.length ? from + 1 : 0, to: Math.min(list.length, from + size), total: list.length };
}

/** First `size` items of each work type (dashboards list several work types in one place). */
export function capPerType<T extends { workTypeKey: string }>(list: T[], size = PAGE_SIZE): T[] {
  const seen = new Map<string, number>();
  return list.filter(i => {
    const n = (seen.get(i.workTypeKey) ?? 0) + 1;
    seen.set(i.workTypeKey, n);
    return n <= size;
  });
}
