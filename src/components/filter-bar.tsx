'use client';

import { Search, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
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
    // Read the address now: a search applies a moment after typing, and other filters may have changed meanwhile.
    const next = new URLSearchParams(window.location.search);
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
          <SearchBox key={f.name} label={f.label} value={params.get(f.name) ?? ''} onSearch={v => set(f.name, v)} />
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

/** Filters as you type (after a short pause), at once on Enter or on leaving the box. */
function SearchBox({ label, value, onSearch }: { label: string; value: string; onSearch: (value: string) => void }) {
  const [text, setText] = useState(value);
  const input = useRef<HTMLInputElement>(null);
  const sent = useRef(value);

  // The address changed from outside (Clear, a link, Back): show it. Never overwrite what is being typed.
  useEffect(() => {
    sent.current = value;
    if (document.activeElement !== input.current) setText(value);
  }, [value]);

  const send = () => {
    const next = text.trim();
    if (next === sent.current) return;
    sent.current = next;
    onSearch(next);
  };
  useEffect(() => {
    const timer = setTimeout(send, 400);
    return () => clearTimeout(timer);
    // Only typing starts the pause.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <span className="relative block min-w-48 flex-1">
      <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" aria-hidden="true" />
      <input ref={input} className="input pl-9" type="search" aria-label={label} placeholder="Search key or name" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} onBlur={send} />
    </span>
  );
}
