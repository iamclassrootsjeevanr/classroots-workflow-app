'use client';

import { Search, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { UrlFilter } from './column-filter';

export type FilterDef =
  | { name: string; label: string; options: { value: string; label: string }[]; /** Several values at once (?name=a,b). */ multi?: boolean; /** Shown below `md` only: on wider screens the column title carries this filter. */ phoneOnly?: boolean }
  | { name: string; label: string; type: 'date' | 'search' };

/**
 * One slim row above a list: search, then a pill per filter. Filters live in the URL (?name=value) so views are
 * shareable and server-rendered. `also` names filters set elsewhere (column titles) that Clear removes too.
 */
export function FilterBar({ filters, also = [] }: { filters: FilterDef[]; also?: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const set = (name: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(name, value);
    else next.delete(name);
    next.delete('page');
    router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false });
  };
  const names = [...filters.map(f => f.name), ...also];
  const active = names.some(n => params.get(n));
  const clear = () => {
    const next = new URLSearchParams(params.toString());
    for (const n of [...names, 'page']) next.delete(n);
    router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false });
  };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-2 shadow-[var(--shadow-card)]">
      {filters.map(f =>
        'options' in f ? (
          <UrlFilter key={f.name} name={f.name} label={f.label} options={f.options} variant="chip" single={!f.multi} className={f.phoneOnly ? 'md:hidden' : ''} />
        ) : f.type === 'date' ? (
          <label key={f.name} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm text-muted">
            {f.label}
            <input className="bg-transparent text-ink outline-none" type="date" aria-label={f.label} value={params.get(f.name) ?? ''} onChange={e => set(f.name, e.target.value)} />
          </label>
        ) : (
          <span key={f.name} className="relative block min-w-48 flex-1">
            <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              key={params.get(f.name) ?? ''}
              className="input pl-9"
              type="search"
              aria-label={f.label}
              placeholder="Search"
              defaultValue={params.get(f.name) ?? ''}
              onKeyDown={e => e.key === 'Enter' && set(f.name, (e.target as HTMLInputElement).value.trim())}
              onBlur={e => e.target.value.trim() !== (params.get(f.name) ?? '') && set(f.name, e.target.value.trim())}
            />
          </span>
        ),
      )}
      {active && (
        <button className="btn-ghost" onClick={clear}>
          <X size={14} aria-hidden="true" />
          Clear
        </button>
      )}
    </div>
  );
}
