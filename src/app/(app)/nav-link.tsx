'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
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

export type NavChild = { href: string; label: string; icon: NavIcon };

/** The child page that matches the current URL: the longest matching href; item pages count as the Items page. */
export function activeChild(path: string, base: string, children: NavChild[]): string | undefined {
  const hit = [...children].filter(c => path === c.href || path.startsWith(c.href + '/')).sort((a, b) => b.href.length - a.href.length)[0];
  if (hit && hit.href !== base) return hit.href;
  if (path === base) return base;
  return children.find(c => c.href.endsWith('/items'))?.href ?? hit?.href;
}

/** A work type in the sidebar: its own icon, and a dropdown of its pages. Collapsed rail shows just the icon. */
export function NavGroupLink({ href, label, icon, badge, children }: { href: string; label: string; icon: NavIcon; badge?: string; children: NavChild[] }) {
  const path = usePathname();
  const { collapsed } = useSidebar();
  const inside = path === href || path.startsWith(href + '/');
  const [open, setOpen] = useState(inside);
  useEffect(() => {
    if (inside) setOpen(true);
  }, [inside]);
  if (collapsed || !children.length) return <NavLink href={href} label={label} icon={icon} badge={badge} />;
  const current = inside ? activeChild(path, href, children) : undefined;
  return (
    <div>
      <div className={`flex min-h-9 items-center rounded-lg transition-colors ${inside ? 'text-ink' : 'text-ink/90 hover:bg-surface-2'}`}>
        <Link href={href} className="flex min-h-9 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2.5">
          <NavGlyph name={icon} className={`shrink-0 ${inside ? 'text-brand' : 'text-muted'}`} />
          <span className={`flex-1 truncate ${inside ? 'font-medium' : ''}`}>{label}</span>
          {badge && <span className="rounded-md bg-warn-soft px-1.5 py-px text-2xs font-medium text-warn">{badge}</span>}
        </Link>
        <button type="button" className="btn-icon mr-0.5 h-7 w-7" aria-label={`${open ? 'Hide' : 'Show'} ${label} pages`} aria-expanded={open} onClick={() => setOpen(o => !o)}>
          <ChevronRight size={15} className={`transition-transform duration-200 ${open ? 'rotate-90' : ''}`} aria-hidden="true" />
        </button>
      </div>
      <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`} inert={!open}>
        <div className="overflow-hidden">
          <div className="mt-0.5 ml-[1.15rem] space-y-0.5 border-l border-line pl-2">
            {children.map(c => {
              const on = c.href === current;
              return (
                <Link
                  key={c.href}
                  href={c.href}
                  aria-current={on ? 'page' : undefined}
                  className={`flex min-h-8 items-center gap-2 rounded-lg px-2 text-[0.8125rem] transition-colors ${on ? 'bg-brand-soft font-medium text-brand' : 'text-muted hover:bg-surface-2 hover:text-ink'}`}
                >
                  <NavGlyph name={c.icon} size={15} className="shrink-0" />
                  <span className="truncate">{c.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/** One box for the person: avatar, name and "My account". The email is not shown. */
export function AccountLink({ name }: { name: string }) {
  const path = usePathname();
  const { collapsed } = useSidebar();
  const active = path === '/account' || path.startsWith('/account/');
  return (
    <Link
      href="/account"
      aria-current={active ? 'page' : undefined}
      title={collapsed ? `${name} · My account` : undefined}
      className={`flex min-h-12 items-center gap-2.5 rounded-lg transition-colors ${collapsed ? 'justify-center px-0' : 'px-2'} ${active ? 'bg-brand-soft' : 'hover:bg-surface-2'}`}
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand">{(name.trim()[0] ?? '?').toUpperCase()}</span>
      {!collapsed && (
        <span className="min-w-0 leading-tight">
          <span className={`block truncate text-sm font-medium ${active ? 'text-brand' : 'text-ink'}`}>{name}</span>
          <span className="block truncate text-2xs text-muted">My account</span>
        </span>
      )}
    </Link>
  );
}
