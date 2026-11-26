'use client';

import { ChevronDown, KeyRound, LogOut, Settings, UserRound } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/**
 * The person in the top bar: their initial, name and role. It opens a menu: Profile, Settings, Change password (only for a person
 * who signs in with a password, so not an office account that uses Google) and Sign out.
 */
export function UserMenu({ name, subtitle, canChangePassword, signOut }: { name: string; subtitle: string; canChangePassword: boolean; signOut: () => Promise<void> }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent | TouchEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      btn.current?.focus();
    };
    document.addEventListener('mousedown', away);
    document.addEventListener('touchstart', away);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('touchstart', away);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const item = 'flex min-h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm text-ink/90 transition-colors hover:bg-surface-2 hover:text-ink focus-visible:bg-surface-2 focus-visible:outline-none';
  const initial = (name.trim()[0] ?? '?').toUpperCase();
  return (
    <div ref={wrap} className="relative">
      <button
        ref={btn}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${name}: account menu`}
        onClick={() => setOpen(o => !o)}
        className={`flex h-10 items-center gap-2.5 rounded-xl py-1 pr-1.5 pl-1 transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:outline-none sm:pr-2 ${open ? 'bg-surface-2' : ''}`}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-sm font-semibold text-white">{initial}</span>
        <span className="hidden min-w-0 text-left leading-tight sm:block">
          <span className="block max-w-40 truncate text-sm font-medium text-ink">{name}</span>
          <span className="block max-w-40 truncate text-2xs text-muted">{subtitle}</span>
        </span>
        <ChevronDown size={15} className={`hidden shrink-0 text-muted transition-transform sm:block ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" aria-label="Account" className="absolute top-full right-0 z-50 mt-2 w-60 rounded-xl border border-line bg-surface p-1.5 shadow-[var(--shadow-pop)]">
          <div className="flex items-center gap-2.5 px-2.5 pt-1.5 pb-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand">{initial}</span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-semibold text-ink">{name}</span>
              <span className="block truncate text-2xs text-muted" title={subtitle}>
                {subtitle}
              </span>
            </span>
          </div>
          <div className="mb-1 border-t border-line" />
          <Link role="menuitem" href="/account" className={item}>
            <UserRound size={16} className="shrink-0 text-muted" aria-hidden="true" /> Profile
          </Link>
          <Link role="menuitem" href="/account?tab=settings" className={item}>
            <Settings size={16} className="shrink-0 text-muted" aria-hidden="true" /> Settings
          </Link>
          {canChangePassword && (
            <Link role="menuitem" href="/account?tab=password" className={item}>
              <KeyRound size={16} className="shrink-0 text-muted" aria-hidden="true" /> Change password
            </Link>
          )}
          <div className="my-1 border-t border-line" />
          <form action={signOut}>
            <button role="menuitem" className={`${item} text-bad hover:bg-bad-soft hover:text-bad focus-visible:bg-bad-soft`}>
              <LogOut size={16} className="shrink-0" aria-hidden="true" /> Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
