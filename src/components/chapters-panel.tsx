'use client';

import { ArrowLeftRight, Check, ChevronDown, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { addChapterAction, moveChapterAction, removeChapterAction, type ActionResult } from '@/app/actions';
import { chapterMatches, chaptersByGrade, type ChapterOption } from '@/lib/chapter-codes';
import { useConfirm } from './confirm';
import { ActionMessage, type PersonOption } from './controls';

function useAction() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const exec = (fn: () => Promise<ActionResult>, onOk?: () => void) =>
    start(async () => {
      const r = await fn();
      setResult(r);
      if (r.ok) onOk?.();
    });
  return { pending, result, exec };
}

/**
 * The chapter code field: type a code or part of a name, or open the list and pick. The list shows the syllabus chapters that are not
 * on the page yet, under their grade. A code that is not in the list can still be typed (a new chapter).
 */
function ChapterPicker({ options, value, onChange, placeholder }: { options: ChapterOption[]; value: string; onChange: (code: string) => void; placeholder?: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ left: number; top: number; width: number; maxH: number } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  // A code picked from the list shows the whole list again; anything else typed narrows it.
  const picked = options.some(o => o.code === value);
  const shown = useMemo(() => (picked ? options : options.filter(o => chapterMatches(value, o))), [options, picked, value]);
  const groups = useMemo(() => chaptersByGrade(shown), [shown]);
  const flat = useMemo(() => groups.flatMap(g => g.options), [groups]);

  const place = useCallback(() => {
    const r = input.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.min(Math.max(r.width, 340), window.innerWidth - 16);
    const below = window.innerHeight - r.bottom - 12;
    const up = below < 220 && r.top > below;
    const maxH = Math.max(160, Math.min(340, up ? r.top - 12 : below));
    setPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)), top: up ? Math.max(8, r.top - maxH - 4) : r.bottom + 4, width, maxH });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !input.current?.parentElement?.contains(t)) setOpen(false);
    };
    const move = (e: Event) => {
      if (!panel.current?.contains(e.target as Node)) place();
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', move, true);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', move, true);
    };
  }, [open, place]);

  // The list opens on the chapter in the field; typing starts again from the top.
  useEffect(() => {
    if (open) setActive(Math.max(0, flat.findIndex(o => o.code === value)));
  }, [open, flat, value]);
  useEffect(() => {
    if (open) panel.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [open, active, pos]);

  const pick = (o: ChapterOption) => {
    onChange(o.code);
    setOpen(false);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) return setOpen(true);
      if (flat.length) setActive(a => (a + (e.key === 'ArrowDown' ? 1 : flat.length - 1)) % flat.length);
    } else if (e.key === 'Enter' && open) {
      // Enter picks from the open list; it never sends the form from here.
      e.preventDefault();
      if (flat[active]) pick(flat[active]);
      else setOpen(false);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'Tab') setOpen(false);
  };

  return (
    <span className="relative block">
      <input
        ref={input}
        className="input pr-9 font-mono"
        required
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={open && flat[active] ? `${id}-${flat[active].code}` : undefined}
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        value={value}
        onChange={e => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={onKey}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={open ? 'Close the chapter list' : 'Open the chapter list'}
        className="absolute top-1/2 right-1.5 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-ink"
        onMouseDown={e => e.preventDefault()}
        onClick={() => {
          setOpen(o => !o);
          input.current?.focus();
        }}
      >
        <ChevronDown size={15} className={`transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={panel}
            className="fixed z-50 flex flex-col overflow-hidden rounded-xl border border-line bg-surface text-sm text-ink shadow-[var(--shadow-pop)]"
            style={{ left: pos.left, top: pos.top, width: pos.width, maxHeight: pos.maxH }}
            onMouseDown={e => e.preventDefault()}
          >
            <div id={`${id}-list`} role="listbox" aria-label="Chapters" className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-1">
              {groups.map(g => (
                <div key={g.label} role="group" aria-label={g.label}>
                  <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface-2 px-3 py-1 text-2xs font-semibold tracking-wide text-muted uppercase">
                    <span>{g.label}</span>
                    <span className="tabular-nums">{g.options.length}</span>
                  </div>
                  {g.options.map(o => {
                    const on = flat[active]?.code === o.code;
                    return (
                      <div
                        key={o.code}
                        id={`${id}-${o.code}`}
                        role="option"
                        aria-selected={o.code === value}
                        data-active={on}
                        onMouseMove={() => !on && setActive(flat.findIndex(x => x.code === o.code))}
                        onClick={() => pick(o)}
                        className={`mx-1 mt-0.5 flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 ${on ? 'bg-brand-soft' : ''}`}
                      >
                        <span className="w-[4.75rem] shrink-0 font-mono text-xs font-medium text-brand">{o.code}</span>
                        <span className="min-w-0 flex-1 truncate" title={o.title}>
                          {o.title}
                        </span>
                        {o.code === value && <Check size={14} className="shrink-0 text-brand" aria-hidden="true" />}
                      </div>
                    );
                  })}
                </div>
              ))}
              {!flat.length && (
                <p className="px-3 py-3 text-xs text-muted">{options.length ? 'Not in the list. Type the full code and its name to add it.' : 'Every chapter of the list is on the page. Type a code and its name to add another.'}</p>
              )}
            </div>
            {flat.length > 0 && (
              <p className="border-t border-line px-3 py-1.5 text-2xs text-muted">
                {shown.length} of {options.length} · type a code or a name
              </p>
            )}
          </div>,
          document.body,
        )}
    </span>
  );
}

/** Add a chapter to the list. A coordinator becomes its steward; an admin picks the steward. */
export function AddChapterForm({ workTypeId, known, stewards, example = 'G04C05' }: { workTypeId: string; /** Chapters of the syllabus, to fill the name from the code. */ known: { code: string; title: string }[]; /** Admin only: who can steer a chapter. */ stewards?: PersonOption[]; example?: string }) {
  const { pending, result, exec } = useAction();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ code: '', title: '', stewardId: '' });
  if (!open) {
    return (
      <button className="btn-primary" onClick={() => setOpen(true)}>
        + New chapter
      </button>
    );
  }
  const setCode = (raw: string) => {
    const code = raw.toUpperCase();
    const hit = known.find(k => k.code === code.trim());
    // The name follows the code picked; a name the list gave goes when the code changes, a name typed stays.
    setV(s => ({ ...s, code: hit ? hit.code : code, title: hit ? hit.title : known.some(k => k.code === s.code && k.title === s.title) ? '' : s.title }));
  };
  return (
    <form
      className="card mb-5 w-full"
      onSubmit={e => {
        e.preventDefault();
        exec(() => addChapterAction(workTypeId, v), () => setV({ code: '', title: '', stewardId: '' }));
      }}
    >
      <div className="grid gap-3 sm:grid-cols-4">
        <label>
          <span className="label">Chapter code</span>
          <ChapterPicker options={known} value={v.code} onChange={setCode} placeholder={example} />
        </label>
        <label className="sm:col-span-2">
          <span className="label">Name</span>
          <input className="input" required value={v.title} onChange={e => setV(s => ({ ...s, title: e.target.value }))} />
        </label>
        {stewards && (
          <label>
            <span className="label">Steward</span>
            <select className="input" required value={v.stewardId} onChange={e => setV(s => ({ ...s, stewardId: e.target.value }))}>
              <option value="">Choose a steward</option>
              {stewards.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button className="btn-primary" disabled={pending}>
          {pending ? 'Adding…' : 'Add chapter'}
        </button>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
          Close
        </button>
        <ActionMessage result={result} />
      </div>
    </form>
  );
}

/** Take an empty chapter off the list (one with journeys says how many must go first). */
export function RemoveChapterButton({ workTypeId, code }: { workTypeId: string; code: string }) {
  const { pending, result, exec } = useAction();
  const { confirm, dialog } = useConfirm();
  return (
    <span className="inline-flex flex-col items-end">
      <button
        className="btn-ghost text-bad"
        disabled={pending}
        title={`Remove ${code}`}
        onClick={async () => {
          if (await confirm({ title: `Remove ${code}?`, description: 'Only a chapter without journeys can be removed.', confirmLabel: 'Remove' })) exec(() => removeChapterAction(workTypeId, code));
        }}
      >
        <Trash2 size={14} aria-hidden="true" />
        Remove
      </button>
      {dialog}
      {result && !result.ok && <ActionMessage result={result} />}
    </span>
  );
}

/** Hand the chapter to another steward: pick them, confirm. */
export function ChangeStewardButton({ workTypeId, code, current, stewards }: { workTypeId: string; code: string; /** Current steward names. */ current: string; stewards: PersonOption[] }) {
  const { pending, result, exec } = useAction();
  const { confirm, dialog } = useConfirm();
  const [open, setOpen] = useState(false);
  const pick = async (id: string) => {
    const to = stewards.find(p => p.id === id);
    if (!to) return;
    const ok = await confirm({
      title: `Give ${code} to ${to.name}?`,
      description: current ? `${current} stops being its steward. The next relay sync sets it back if the relay still names someone else.` : 'They become its steward.',
      confirmLabel: 'Change steward',
      tone: 'warn',
    });
    if (ok) exec(() => moveChapterAction(workTypeId, code, id), () => setOpen(false));
  };
  return (
    <span className="inline-flex flex-col items-end gap-1">
      {open ? (
        <select className="input w-auto py-1 text-sm" autoFocus disabled={pending} aria-label={`New steward of ${code}`} defaultValue="" onChange={e => pick(e.target.value)} onBlur={() => !pending && setOpen(false)}>
          <option value="" disabled>
            Choose a steward
          </option>
          {stewards.map(p => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      ) : (
        <button className="btn-ghost" disabled={pending} title={`Change the steward of ${code}`} onClick={() => setOpen(true)}>
          <ArrowLeftRight size={14} aria-hidden="true" />
          {pending ? 'Changing…' : 'Change steward'}
        </button>
      )}
      {dialog}
      {result && !result.ok && <ActionMessage result={result} />}
    </span>
  );
}
