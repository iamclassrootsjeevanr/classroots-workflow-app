'use client';

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NAV_COOKIE } from '@/lib/prefs';
import { writeCookie } from '@/lib/prefs-client';

const Ctx = createContext<{ collapsed: boolean; toggle: () => void }>({ collapsed: false, toggle() {} });
export const useSidebar = () => useContext(Ctx);

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

/**
 * Holds whether the desktop sidebar is open or a rail of icons, for the sidebar and for the button in the top bar. The state is
 * kept in a cookie so the server renders the right width on the next load: no jump. `[` toggles it.
 */
export function SidebarProvider({ initialCollapsed, children }: { initialCollapsed: boolean; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const toggle = useCallback(() => {
    setCollapsed(c => {
      writeCookie(NAV_COOKIE, c ? 'expanded' : 'collapsed');
      return !c;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '[' && !e.metaKey && !e.ctrlKey && !e.altKey && !isTyping(e.target)) toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  return <Ctx value={{ collapsed, toggle }}>{children}</Ctx>;
}

/** Desktop sidebar (≥1024px): the full menu, or a rail of icons whose pages open beside them on hover. */
export function Sidebar({ brand, children }: { brand: React.ReactNode; children: React.ReactNode }) {
  const { collapsed } = useSidebar();
  return (
    <aside
      data-collapsed={collapsed || undefined}
      className="group/sb sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 ease-out lg:flex data-collapsed:w-[4.25rem]"
    >
      <div className="flex h-14 shrink-0 items-center border-b border-line px-3.5 group-data-collapsed/sb:justify-center group-data-collapsed/sb:px-0">{brand}</div>
      <nav aria-label="Main" className="flex-1 space-y-0.5 overflow-x-hidden overflow-y-auto px-3 py-3 text-sm group-data-collapsed/sb:px-2.5">
        {children}
      </nav>
    </aside>
  );
}

/** The open / collapse button, in the top bar. */
export function SidebarToggle() {
  const { collapsed, toggle } = useSidebar();
  return (
    <button type="button" onClick={toggle} className="btn-icon h-9 w-9" aria-label={collapsed ? 'Open sidebar' : 'Collapse sidebar'} aria-keyshortcuts="[" aria-pressed={!collapsed} title={collapsed ? 'Open sidebar  [' : 'Collapse sidebar  ['}>
      {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
    </button>
  );
}

/** Hides children when the sidebar is collapsed. */
export function WhenExpanded({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();
  return collapsed ? null : <>{children}</>;
}

/**
 * A rail icon with a card that opens beside it on hover or keyboard focus: the name of the page, and its pages when it has some.
 * The card is drawn on the body, so the rail's own scrolling never clips it; the pointer can move from the icon into the card.
 */
export function RailFlyout({ trigger, children }: { trigger: React.ReactNode; children: React.ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    const r = wrap.current?.getBoundingClientRect();
    if (r) setPos({ left: r.right + 10, top: Math.max(8, r.top - 4) });
  };
  const hide = (now = false) => {
    if (timer.current) clearTimeout(timer.current);
    if (now) setPos(null);
    else timer.current = setTimeout(() => setPos(null), 120);
  };
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  useEffect(() => {
    if (!pos) return;
    const close = () => hide(true);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && hide(true);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [pos]);
  return (
    <div
      ref={wrap}
      onMouseEnter={show}
      onMouseLeave={() => hide()}
      onFocus={show}
      onBlur={e => !e.currentTarget.contains(e.relatedTarget) && !(e.relatedTarget instanceof HTMLElement && e.relatedTarget.closest('[data-rail-flyout]')) && hide()}
    >
      {trigger}
      {pos &&
        createPortal(
          <div
            data-rail-flyout=""
            className="fixed z-50 min-w-44 rounded-xl border border-line bg-surface p-1.5 text-sm text-ink shadow-[var(--shadow-pop)]"
            style={{ left: pos.left, top: pos.top }}
            // Keep the whole card on screen: a long list near the bottom of the rail opens upwards.
            ref={el => {
              if (!el) return;
              const over = el.getBoundingClientRect().bottom - (window.innerHeight - 8);
              if (over > 0) el.style.top = `${Math.max(8, pos.top - over)}px`;
            }}
            onMouseEnter={show}
            onMouseLeave={() => hide()}
            onClick={() => hide(true)}
          >
            {children}
          </div>,
          document.body,
        )}
    </div>
  );
}
