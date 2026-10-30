'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavLink({ href, label, icon, exact, badge }: { href: string; label: string; icon: string; exact?: boolean; badge?: string }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(href + '/');
  return (
    <Link
      href={href}
      className={`flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 transition-colors ${active ? 'bg-brand-soft font-medium text-brand' : 'text-ink hover:bg-canvas'}`}
    >
      <span className="w-4 text-center text-xs opacity-70" aria-hidden="true">
        {icon}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {badge && <span className="rounded bg-amber-50 px-1.5 text-[10px] text-amber-700">{badge}</span>}
    </Link>
  );
}
