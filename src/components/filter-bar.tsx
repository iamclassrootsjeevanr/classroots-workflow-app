'use client';

import { Search, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export type FilterDef = { name: string; label: string; options: { value: string; label: string }[] } | { name: string; label: string; type: 'date' | 'search' };

/** Filters stored in the URL (?name=value) so views are shareable and server-rendered. */
export function FilterBar({ filters }: { filters: FilterDef[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const set = (name: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(name, value);
    else next.delete(name);
    router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false });
  };
  const active = filters.some(f => params.get(f.name));

  return (
    <div className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border border-line bg-surface p-3 shadow-[var(--shadow-card)]">
      {filters.map(f => (
        <label key={f.name} className="min-w-36 flex-1 sm:flex-none">
          <span className="label">{f.label}</span>
          {'options' in f ? (
            <select className="input" value={params.get(f.name) ?? ''} onChange={e => set(f.name, e.target.value)}>
              <option value="">All</option>
              {f.options.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : f.type === 'date' ? (
            <input className="input" type="date" value={params.get(f.name) ?? ''} onChange={e => set(f.name, e.target.value)} />
          ) : (
            <span className="relative block">
              <Search size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input
                className="input pl-8"
                type="search"
                placeholder="Key, title…"
                defaultValue={params.get(f.name) ?? ''}
                onKeyDown={e => e.key === 'Enter' && set(f.name, (e.target as HTMLInputElement).value.trim())}
                onBlur={e => set(f.name, e.target.value.trim())}
              />
            </span>
          )}
        </label>
      ))}
      {active && (
        <button className="btn-ghost" onClick={() => router.replace(pathname, { scroll: false })}>
          <X size={14} aria-hidden="true" />
          Clear
        </button>
      )}
    </div>
  );
}
