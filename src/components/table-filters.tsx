'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { FilterMenu, type FilterOption } from './column-filter';

const BLANK = '(Blank)';

/** What a cell counts as in its column's filter: `data-fv` (several values split by "|"), else the picked option of a dropdown, else its text. */
function cellValues(td: HTMLTableCellElement | undefined): string[] {
  if (!td) return [BLANK];
  const given = td.dataset.fv;
  if (given != null) {
    const list = given.split('|').map(s => s.trim()).filter(Boolean);
    return list.length ? list : [BLANK];
  }
  const select = td.querySelector('select');
  const raw = select ? (select.selectedOptions[0]?.textContent ?? '') : (td.textContent ?? '');
  const text = raw.replace(/\s+/g, ' ').trim();
  return [!text || text === '—' ? BLANK : text];
}

type Col = { index: number; label: string; host: HTMLElement; options: FilterOption[] };

const dataRows = (table: HTMLTableElement) => [...table.querySelectorAll<HTMLTableRowElement>(':scope > tbody > tr')];

/**
 * Column filters for a table already on the page: every column title gets a funnel listing that column's values.
 * Rows are hidden in the browser, so this fits tables whose rows are all loaded. A title with `data-nofilter`
 * is left alone, and so is one that already carries a server-side filter (`data-colfilter`).
 */
export function AutoFilters({ root }: { root: RefObject<HTMLElement | null> }) {
  const [cols, setCols] = useState<Col[]>([]);
  const [picked, setPicked] = useState<Record<number, string[]>>({});
  const pickedRef = useRef(picked);
  pickedRef.current = picked;

  const apply = useCallback((table: HTMLTableElement, sel: Record<number, string[]>) => {
    const active = Object.entries(sel).filter(([, v]) => v.length);
    let group: HTMLTableRowElement | null = null;
    let groupHas = false;
    const closeGroup = () => {
      if (group) group.hidden = !groupHas;
    };
    for (const row of dataRows(table)) {
      if (row.cells.length <= 1) {
        closeGroup();
        group = row.querySelector('td.group') ? row : null;
        groupHas = false;
        continue;
      }
      const show = active.every(([i, want]) => cellValues(row.cells[Number(i)]).some(v => want.includes(v)));
      row.hidden = !show;
      if (show) groupHas = true;
    }
    closeGroup();
  }, []);

  const scan = useCallback(() => {
    const table = root.current?.querySelector('table');
    if (!table) return;
    const head = table.querySelector(':scope > thead > tr:last-child');
    if (!head) return;
    const rows = dataRows(table).filter(r => r.cells.length > 1);
    const next: Col[] = [];
    for (const th of [...head.children] as HTMLTableCellElement[]) {
      const own = th.querySelector<HTMLElement>(':scope > .th-filter');
      const label = [...th.childNodes].filter(n => n !== own).map(n => n.textContent ?? '').join('').replace(/\s+/g, ' ').trim();
      if (!label || th.colSpan > 1 || th.dataset.nofilter != null || th.querySelector('[data-colfilter]:not(.th-filter [data-colfilter])')) continue;
      const counts = new Map<string, number>();
      for (const r of rows) for (const v of cellValues(r.cells[th.cellIndex])) counts.set(v, (counts.get(v) ?? 0) + 1);
      if (counts.size < 2 && !pickedRef.current[th.cellIndex]?.length) {
        own?.remove();
        continue;
      }
      let host = own;
      if (!host) {
        host = document.createElement('span');
        host.className = 'th-filter';
        th.appendChild(host);
      }
      const options = [...counts].map(([value, count]) => ({ value, label: value, count })).sort((a, b) => (a.value === BLANK ? 1 : b.value === BLANK ? -1 : a.label.localeCompare(b.label, undefined, { numeric: true })));
      next.push({ index: th.cellIndex, label, host, options });
    }
    setCols(prev => (prev.length === next.length && prev.every((c, i) => c.host === next[i].host && c.label === next[i].label && JSON.stringify(c.options) === JSON.stringify(next[i].options)) ? prev : next));
    apply(table, pickedRef.current);
  }, [root, apply]);

  useEffect(() => {
    const table = root.current?.querySelector('table');
    if (!table) return;
    scan();
    let frame = 0;
    const mo = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(scan);
    });
    for (const body of table.tBodies) mo.observe(body, { childList: true, subtree: true, characterData: true });
    return () => {
      mo.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [root, scan]);

  const set = (index: number, values: string[]) => {
    const next = { ...picked, [index]: values };
    setPicked(next);
    const table = root.current?.querySelector('table');
    if (table) apply(table, next);
  };

  return <>{cols.map(c => createPortal(<FilterMenu label={c.label} options={c.options} selected={picked[c.index] ?? []} onChange={v => set(c.index, v)} />, c.host, `${c.index}`))}</>;
}

/** Wrap a plain `<table>` to give its column titles filters. Tables inside `<Sheet>` get them already. */
export function FilterableTable({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} className={className}>
      {children}
      <AutoFilters root={ref} />
    </div>
  );
}
