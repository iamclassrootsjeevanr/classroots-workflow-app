'use client';

import { LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { NAV_COOKIE } from '@/lib/prefs';
import { writeCookie } from '@/lib/prefs-client';

const Ctx = createContext<{ collapsed: boolean; toggle: () => void }>({ collapsed: false, toggle() {} });
export const useSidebar = () => useContext(Ctx);

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

/**
 * Desktop sidebar (≥1024px) that collapses to an icon rail. The state is kept in a cookie so the
 * server renders the right width on the next load – no jump.
 */
export function Sidebar({ initialCollapsed, brand, footer, children }: { initialCollapsed: boolean; brand: React.ReactNode; footer: React.ReactNode; children: React.ReactNode }) {
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

  return (
    <Ctx value={{ collapsed, toggle }}>
      <aside
        data-collapsed={collapsed || undefined}
        className="group/sb sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 ease-out lg:flex data-collapsed:w-[4.25rem]"
      >
        <div className="flex h-16 items-center gap-2 px-3 group-data-collapsed/sb:flex-col group-data-collapsed/sb:h-auto group-data-collapsed/sb:gap-1 group-data-collapsed/sb:py-3">
          <div className="min-w-0 flex-1 group-data-collapsed/sb:flex-none">{brand}</div>
          <button
            type="button"
            onClick={toggle}
            className="btn-icon"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-keyshortcuts="["
            data-tip={collapsed ? 'Expand  [' : 'Collapse  ['}
          >
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-x-hidden overflow-y-auto px-3 py-1 text-sm group-data-collapsed/sb:px-2.5">{children}</nav>
        <div className="border-t border-line p-3 group-data-collapsed/sb:p-2.5">{footer}</div>
      </aside>
    </Ctx>
  );
}

/** Sign-out button that shrinks to an icon when the sidebar is collapsed. */
export function SignOutButton() {
  const { collapsed } = useSidebar();
  return (
    <button
      className={`mt-1.5 flex min-h-9 w-full items-center gap-2.5 rounded-lg text-left text-xs text-muted transition-colors hover:bg-surface-2 hover:text-ink ${collapsed ? 'justify-center px-0' : 'px-2.5'}`}
      title={collapsed ? 'Sign out' : undefined}
    >
      <LogOut size={15} aria-hidden="true" />
      {!collapsed && 'Sign out'}
    </button>
  );
}

/** Hides children when the sidebar is collapsed. */
export function WhenExpanded({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();
  return collapsed ? null : <>{children}</>;
}
