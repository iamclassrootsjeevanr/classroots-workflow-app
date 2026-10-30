'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export type NavGroup = { title?: string; links: { href: string; label: string; icon: string; badge?: string; exact?: boolean }[] };

/** Top bar + slide-over menu below 1024px (phones, tablets, small windows); the sidebar takes over above that. */
export function MobileNav({ groups, name, email, subtitle, signOut }: { groups: NavGroup[]; name: string; email: string; subtitle: string; signOut: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();

  // Close when the route changes and keep the page from scrolling behind the menu.
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const isActive = (href: string, exact?: boolean) => (exact ? path === href : path === href || path.startsWith(href + '/'));
  const current = groups.flatMap(g => g.links).find(l => isActive(l.href, l.exact));

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-white/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <button
          type="button"
          className="-ml-1 flex h-10 w-10 items-center justify-center rounded-lg text-ink hover:bg-canvas"
          aria-label="Open menu"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{current?.label ?? 'Classroots Work'}</div>
          <div className="truncate text-[11px] text-muted">{subtitle}</div>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">C</div>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" className="absolute inset-0 bg-ink/40" aria-label="Close menu" onClick={() => setOpen(false)} />
          <nav className="absolute inset-y-0 left-0 flex w-[min(20rem,85vw)] flex-col bg-white shadow-[var(--shadow-pop)]">
            <div className="flex items-center gap-2.5 border-b border-line px-5 py-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">C</div>
              <div className="min-w-0 leading-tight">
                <div className="text-sm font-semibold">Classroots Work</div>
                <div className="truncate text-[11px] text-muted">{subtitle}</div>
              </div>
              <button type="button" className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-canvas" aria-label="Close menu" onClick={() => setOpen(false)}>
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2 text-sm">
              {groups.map((g, i) => (
                <div key={i}>
                  {g.title && <div className="px-2 pt-4 pb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">{g.title}</div>}
                  {g.links.map(l => (
                    <Link
                      key={l.href}
                      href={l.href}
                      className={`flex min-h-11 items-center gap-3 rounded-lg px-3 ${isActive(l.href, l.exact) ? 'bg-brand-soft font-medium text-brand' : 'text-ink active:bg-canvas'}`}
                    >
                      <span className="w-4 text-center text-xs opacity-70" aria-hidden="true">
                        {l.icon}
                      </span>
                      <span className="flex-1 truncate">{l.label}</span>
                      {l.badge && <span className="rounded bg-amber-50 px-1.5 text-[10px] text-amber-700">{l.badge}</span>}
                    </Link>
                  ))}
                </div>
              ))}
            </div>
            <div className="safe-bottom border-t border-line p-3">
              <Link href="/account" className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm">
                <span className="w-4 text-center text-xs opacity-70" aria-hidden="true">
                  ⚿
                </span>
                My account
              </Link>
              <div className="mt-1 truncate px-3 text-sm font-medium">{name}</div>
              <div className="truncate px-3 text-xs text-muted">{email}</div>
              {signOut}
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
