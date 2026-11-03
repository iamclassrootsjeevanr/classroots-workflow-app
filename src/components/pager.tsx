import Link from 'next/link';

/** Previous / next links that keep the other filters in the URL. */
export function Pager({ basePath, params, page, pages, from, to, total }: { basePath: string; params: Record<string, string | undefined>; page: number; pages: number; from: number; to: number; total: number }) {
  const href = (p: number) => {
    const q = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => Boolean(e[1]) && e[0] !== 'page'));
    if (p > 1) q.set('page', String(p));
    return q.size ? `${basePath}?${q}` : basePath;
  };
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
      <span>
        Showing {from}–{to} of {total}
      </span>
      {pages > 1 && (
        <span className="flex items-center gap-1.5">
          {page > 1 ? (
            <Link className="btn-ghost min-h-8 px-3 text-xs" href={href(page - 1)}>
              Previous
            </Link>
          ) : (
            <span className="btn-ghost min-h-8 px-3 text-xs opacity-50">Previous</span>
          )}
          <span className="px-1 tabular-nums">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link className="btn-ghost min-h-8 px-3 text-xs" href={href(page + 1)}>
              Next
            </Link>
          ) : (
            <span className="btn-ghost min-h-8 px-3 text-xs opacity-50">Next</span>
          )}
        </span>
      )}
    </div>
  );
}
