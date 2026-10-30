'use client';

import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { NavGlyph, type NavIcon } from './icons';

export type NavGroup = { title?: string; links: { href: string; label: string; icon: NavIcon; badge?: string; exact?: boolean }[] };

/** Top bar + slide-over menu below 1024px (phones, tablets, small windows); the sidebar takes over above that. */
export function MobileNav({ groups, name, email, subtitle, signOut }: { groups: NavGroup[]; name: string; email: string; subtitle: string; signOut: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const openBtn = useRef<HTMLButtonElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);

  // Close when the route changes and keep the page from scrolling behind the menu.
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) {
      closeBtn.current?.focus();
      const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
      window.addEventListener('keydown', onKey);
      return () => {
        window.removeEventListener('keydown', onKey);
        document.body.style.overflow = '';
      };
    }
    openBtn.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const isActive = (href: string, exact?: boolean) => (exact ? path === href : path === href || path.startsWith(href + '/'));
  const current = groups.flatMap(g => g.links).find(l => isActive(l.href, l.exact));

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-surface/90 px-4 py-2.5 backdrop-blur lg:hidden">
        <button ref={openBtn} type="button" className="btn-icon -ml-1.5 h-10 w-10 text-ink" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}>
          <Menu size={22} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{current?.label ?? 'Classroots Work'}</div>
          <div className="truncate text-2xs text-muted">{subtitle}</div>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">C</div>
      </header>

      <div
        className={`fixed inset-0 z-40 lg:hidden ${open ? 'visible' : 'invisible delay-200'} transition-[visibility]`}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        aria-hidden={!open}
        inert={!open}
      >
        <button type="button" className={`absolute inset-0 bg-ink/40 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`} aria-label="Close menu" onClick={() => setOpen(false)} tabIndex={-1} />
        <nav className={`absolute inset-y-0 left-0 flex w-[min(20rem,85vw)] flex-col bg-surface shadow-[var(--shadow-pop)] transition-transform duration-200 ease-out ${open ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex items-center gap-2.5 border-b border-line px-4 py-3.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">C</div>
            <div className="min-w-0 leading-tight">
              <div className="text-sm font-semibold">Classroots Work</div>
              <div className="truncate text-2xs text-muted">{subtitle}</div>
            </div>
            <button ref={closeBtn} type="button" className="btn-icon ml-auto h-9 w-9" aria-label="Close menu" onClick={() => setOpen(false)}>
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2 text-sm">
            {groups.map((g, i) => (
              <div key={i}>
                {g.title && <div className="px-2 pt-4 pb-1 text-2xs font-semibold tracking-wide text-muted uppercase">{g.title}</div>}
                {g.links.map(l => {
                  const active = isActive(l.href, l.exact);
                  return (
                    <Link
                      key={l.href}
                      href={l.href}
                      aria-current={active ? 'page' : undefined}
                      className={`flex min-h-11 items-center gap-3 rounded-lg px-3 ${active ? 'bg-brand-soft font-medium text-brand' : 'text-ink active:bg-surface-2'}`}
                    >
                      <NavGlyph name={l.icon} className={active ? 'text-brand' : 'text-muted'} />
                      <span className="flex-1 truncate">{l.label}</span>
                      {l.badge && <span className="rounded-md bg-warn-soft px-1.5 py-px text-2xs font-medium text-warn">{l.badge}</span>}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="safe-bottom border-t border-line p-3">
            <Link href="/account" className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm">
              <NavGlyph name="account" className="text-muted" />
              My account
            </Link>
            <div className="mt-1 truncate px-3 text-sm font-medium">{name}</div>
            <div className="truncate px-3 text-xs text-muted">{email}</div>
            {signOut}
          </div>
        </nav>
      </div>
    </>
  );
}
