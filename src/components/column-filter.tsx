'use client';

import { Check, ChevronDown, ListFilter, Search } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';

export type FilterOption = { value: string; label: string; count?: number };

type MenuProps = {
  label: string;
  options: FilterOption[];
  /** Picked values. Empty = no filter (every row shows). */
  selected: string[];
  onChange: (next: string[]) => void;
  /** `head` = the small funnel in a column title; `chip` = a pill in the search bar. */
  variant?: 'head' | 'chip';
  /** One value at a time (picking it again clears it). */
  single?: boolean;
  busy?: boolean;
  className?: string;
};

const MENU_W = 264;

/** A column filter like a spreadsheet's: search the values, tick as many as you want, the table follows at once. */
export function FilterMenu({ label, options, selected, onChange, variant = 'head', single, busy, className = '' }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [pos, setPos] = useState<{ left: number; top: number; maxH: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const active = selected.length > 0;

  const place = useCallback(() => {
    const r = trigger.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - MENU_W - 8));
    const below = window.innerHeight - r.bottom - 12;
    const top = below < 220 && r.top > below ? Math.max(8, r.top - Math.min(380, r.top - 12) - 4) : r.bottom + 4;
    setPos({ left, top, maxH: Math.max(180, Math.min(380, below < 220 && r.top > below ? r.top - 12 : below)) });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !trigger.current?.contains(t)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    const move = (e: Event) => {
      if (!panel.current?.contains(e.target as Node)) place();
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    document.addEventListener('keydown', key);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', move, true);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
      document.removeEventListener('keydown', key);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', move, true);
    };
  }, [open, place]);

  const toggle = (value: string) => {
    if (single) {
      onChange(selected.includes(value) ? [] : [value]);
      setOpen(false);
    } else onChange(selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value]);
  };
  const needle = q.trim().toLowerCase();
  const shown = needle ? options.filter(o => o.label.toLowerCase().includes(needle)) : options;
  const picked = options.filter(o => selected.includes(o.value));
  const summary = picked.length === 1 ? picked[0].label : `${selected.length}`;

  return (
    <>
      {variant === 'head' ? (
        <button
          ref={trigger}
          type="button"
          data-colfilter=""
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={`Filter ${label}${active ? ` (${selected.length} picked)` : ''}`}
          title={`Filter ${label}`}
          onClick={() => setOpen(o => !o)}
          className={`relative ml-1 inline-flex h-5 w-5 items-center justify-center rounded align-middle transition-colors focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none ${active ? 'bg-brand text-white' : 'text-muted/70 hover:bg-brand-soft hover:text-brand'} ${busy ? 'opacity-60' : ''} ${className}`}
        >
          <ListFilter size={12} strokeWidth={2.2} aria-hidden="true" />
        </button>
      ) : (
        <button
          ref={trigger}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(o => !o)}
          className={`inline-flex min-h-9 max-w-56 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:outline-none ${active ? 'border-brand/50 bg-brand-soft text-ink' : 'border-line bg-surface text-muted hover:border-brand/40 hover:text-ink'} ${busy ? 'opacity-60' : ''} ${className}`}
        >
          <span className={active ? 'text-muted' : ''}>{label}</span>
          {active && <span className="truncate font-medium text-brand">{summary}</span>}
          <ChevronDown size={14} className="shrink-0 text-muted" aria-hidden="true" />
        </button>
      )}
      {open &&
        pos &&
        createPortal(
          <div
            ref={panel}
            role="dialog"
            aria-label={`Filter ${label}`}
            className="fixed z-50 flex flex-col overflow-hidden rounded-xl border border-line bg-surface text-sm text-ink normal-case shadow-[var(--shadow-pop)]"
            style={{ left: pos.left, top: pos.top, width: MENU_W, maxHeight: pos.maxH, letterSpacing: 'normal' }}
          >
            {options.length > 7 && (
              <div className="relative border-b border-line p-2">
                <Search size={14} className="pointer-events-none absolute top-1/2 left-4.5 -translate-y-1/2 text-muted" aria-hidden="true" />
                <input autoFocus className="input pl-8" type="search" placeholder={`Search ${label.toLowerCase()}…`} value={q} onChange={e => setQ(e.target.value)} />
              </div>
            )}
            {!single && (
              <div className="flex items-center justify-between border-b border-line px-3 py-1.5 text-xs">
                <span className="text-muted">{active ? `${selected.length} picked` : 'Showing all'}</span>
                <span className="flex gap-3">
                  {shown.length > 1 && (
                    <button type="button" className="link" onClick={() => onChange([...new Set([...selected, ...shown.map(o => o.value)])])}>
                      Pick {needle ? 'found' : 'all'}
                    </button>
                  )}
                  <button type="button" className="link disabled:opacity-40" disabled={!active} onClick={() => onChange([])}>
                    Clear
                  </button>
                </span>
              </div>
            )}
            <ul className="min-h-0 flex-1 overflow-y-auto p-1" role="listbox" aria-multiselectable={!single}>
              {shown.map(o => {
                const on = selected.includes(o.value);
                return (
                  <li key={o.value}>
                    <button type="button" role="option" aria-selected={on} onClick={() => toggle(o.value)} className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-2 ${on ? 'font-medium' : ''}`}>
                      <span className={`flex h-4 w-4 shrink-0 items-center justify-center border ${single ? 'rounded-full' : 'rounded'} ${on ? 'border-brand bg-brand text-white' : 'border-line bg-surface'}`}>{on && <Check size={11} strokeWidth={3} aria-hidden="true" />}</span>
                      <span className="min-w-0 flex-1 truncate" title={o.label}>
                        {o.label}
                      </span>
                      {o.count != null && <span className="shrink-0 text-xs text-muted tabular-nums">{o.count}</span>}
                    </button>
                  </li>
                );
              })}
              {!shown.length && <li className="px-2 py-3 text-center text-xs text-muted">Nothing matches.</li>}
            </ul>
          </div>,
          document.body,
        )}
    </>
  );
}

/** A filter kept in the URL (?name=a,b), so the server filters every page of the list and the view can be shared. */
export function UrlFilter({ name, label, options, variant, single, className }: { name: string; label: string; options: FilterOption[]; variant?: 'head' | 'chip'; single?: boolean; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [busy, start] = useTransition();
  const inUrl = params.get(name) ?? '';
  // Ticks show at once and quick ticks add up: the URL (and the list) follows a moment later.
  const [draft, setDraft] = useState<string[] | null>(null);
  useEffect(() => setDraft(null), [inUrl]);
  const selected = draft ?? inUrl.split(',').filter(Boolean);
  const set = (next: string[]) => {
    setDraft(next);
    const q = new URLSearchParams(window.location.search);
    if (next.length) q.set(name, next.join(','));
    else q.delete(name);
    q.delete('page');
    start(() => router.replace(`${pathname}${q.size ? `?${q}` : ''}`, { scroll: false }));
  };
  return <FilterMenu label={label} options={options} selected={selected} onChange={set} variant={variant} single={single} busy={busy} className={className} />;
}
