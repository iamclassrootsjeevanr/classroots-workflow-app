'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const INTERACTIVE = 'a,button,select,input,textarea,label,[role="button"]';

/**
 * Spreadsheet-style scroll frame for a `<table className="sheet">`.
 * Always-visible scrollbars, a fade when more columns sit off to the right, a shadow under pinned columns once
 * scrolled, and cell navigation: click a cell, then use the arrow keys, Home/End or Ctrl/Cmd+C to copy it.
 */
export function Sheet({ children, className = '', maxHeight = '70vh' }: { children: React.ReactNode; className?: string; maxHeight?: string }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [state, setState] = useState({ scrolled: false, more: false });

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const next = { scrolled: el.scrollLeft > 2, more: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 };
    setState(prev => (prev.scrolled === next.scrolled && prev.more === next.more ? prev : next));
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [measure]);

  const focusCell = (td: HTMLElement | undefined) => {
    if (!td) return;
    td.tabIndex = -1;
    td.focus({ preventScroll: true });
    td.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };

  const cellAt = (td: HTMLTableCellElement, dRow: number, dCol: number): HTMLElement | undefined => {
    const rows = [...(td.closest('table')?.querySelectorAll('tbody tr') ?? [])].filter(r => r.children.length > 1) as HTMLTableRowElement[];
    const r = rows.indexOf(td.parentElement as HTMLTableRowElement);
    if (r < 0) return undefined;
    const row = rows[Math.min(rows.length - 1, Math.max(0, r + dRow))];
    const c = Math.min(row.cells.length - 1, Math.max(0, td.cellIndex + dCol));
    return row.cells[c];
  };

  return (
    <div className={`sheet-wrap ${className}`} data-scrolled={state.scrolled ? '' : undefined} data-more={state.more ? '' : undefined}>
      <div
        ref={scroller}
        className="sheet-scroll"
        style={{ ['--sheet-h' as string]: maxHeight }}
        onScroll={measure}
        onClick={e => {
          const t = e.target as HTMLElement;
          if (t.closest(INTERACTIVE)) return;
          const td = t.closest('td');
          if (td && !td.classList.contains('group')) focusCell(td);
        }}
        onKeyDown={e => {
          const td = (e.target as HTMLElement).closest('td');
          if (!td || e.target !== td) return;
          const move: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
          if (move[e.key]) {
            e.preventDefault();
            focusCell(cellAt(td, ...move[e.key]));
          } else if (e.key === 'Home' || e.key === 'End') {
            e.preventDefault();
            focusCell(cellAt(td, 0, e.key === 'Home' ? -999 : 999));
          } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c' && !window.getSelection()?.toString()) {
            navigator.clipboard?.writeText(td.innerText.trim()).catch(() => {});
          }
        }}
      >
        {children}
      </div>
      <div className="sheet-fade" aria-hidden="true" />
    </div>
  );
}
