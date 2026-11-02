'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Tab bar for pages of one section; the tab whose path matches the current URL is active. */
export function PathTabs({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  // The longest matching href wins so "/w/x" (Overview) is not active on "/w/x/items".
  const active = [...items].filter(t => path === t.href || path.startsWith(`${t.href}/`)).sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav className="-mx-4 mb-5 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-line px-4 sm:mx-0 sm:px-0" aria-label="Pages">
      {items.map(t => {
        const on = t.href === active;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? 'page' : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${on ? 'border-brand text-ink' : 'border-transparent text-muted hover:bg-surface-2/60 hover:text-ink'}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
