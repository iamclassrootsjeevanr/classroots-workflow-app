'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NavGlyph, type NavIcon } from '@/components/icons';
import { useSidebar } from '@/components/sidebar';

export function NavLink({ href, label, icon, exact, badge }: { href: string; label: string; icon: NavIcon; exact?: boolean; badge?: string }) {
  const path = usePathname();
  const { collapsed } = useSidebar();
  const active = exact ? path === href : path === href || path.startsWith(href + '/');
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      title={collapsed ? label : undefined}
      className={`flex min-h-9 items-center gap-2.5 rounded-lg transition-colors ${collapsed ? 'justify-center px-0' : 'px-2.5'} ${
        active ? 'bg-brand-soft font-medium text-brand' : 'text-ink/90 hover:bg-surface-2 hover:text-ink'
      }`}
    >
      <NavGlyph name={icon} className={`shrink-0 ${active ? 'text-brand' : 'text-muted'}`} />
      {!collapsed && <span className="flex-1 truncate">{label}</span>}
      {!collapsed && badge && <span className="rounded-md bg-warn-soft px-1.5 py-px text-2xs font-medium text-warn">{badge}</span>}
    </Link>
  );
}
