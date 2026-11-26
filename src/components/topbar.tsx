'use client';

import { usePathname } from 'next/navigation';
import type { NavGroup } from './mobile-nav';
import { SidebarToggle } from './sidebar';

/** The name of the section the page is in, from the menu ("Journey", "People & access"). */
export function sectionTitle(path: string, groups: NavGroup[]): string | null {
  const links = groups.flatMap(g => g.links);
  const hit = links.filter(l => (l.exact ? path === l.href : path === l.href || path.startsWith(l.href + '/'))).sort((a, b) => b.href.length - a.href.length)[0];
  if (hit) return hit.label;
  return path.startsWith('/account') ? 'My account' : path.startsWith('/inbox') ? 'Inbox' : null;
}

/**
 * Desktop top bar (≥1024px): the open / collapse button and the section name on the left, then `left` (admin testing), and on the
 * right the bell and the person. Phones and small windows use MobileNav's bar, which carries the same right side.
 */
export function TopBar({ groups, left, children }: { groups: NavGroup[]; left?: React.ReactNode; children: React.ReactNode }) {
  const path = usePathname();
  const title = sectionTitle(path, groups);
  return (
    <header className="sticky top-0 z-30 hidden h-14 items-center gap-3 border-b border-line bg-surface/85 px-4 backdrop-blur lg:flex">
      <SidebarToggle />
      {title && <div className="truncate text-sm font-semibold text-ink">{title}</div>}
      {left && <div className="ml-2 flex min-w-0 items-center border-l border-line pl-4">{left}</div>}
      <div className="ml-auto flex items-center gap-1.5">{children}</div>
    </header>
  );
}
