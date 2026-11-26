'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { NavGlyph, type NavIcon } from '@/components/icons';
import { RailFlyout, useSidebar } from '@/components/sidebar';

const BADGE = 'rounded-md bg-warn-soft px-1.5 py-px text-2xs font-medium text-warn';

export function NavLink({ href, label, icon, exact, badge }: { href: string; label: string; icon: NavIcon; exact?: boolean; badge?: string }) {
  const path = usePathname();
  const { collapsed } = useSidebar();
  const active = exact ? path === href : path === href || path.startsWith(href + '/');
  const link = (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? label : undefined}
      className={`relative flex min-h-9 items-center gap-2.5 rounded-lg transition-colors ${collapsed ? 'h-10 justify-center px-0' : 'px-2.5'} ${
        active ? 'bg-brand-soft font-medium text-brand' : 'text-ink/90 hover:bg-surface-2 hover:text-ink'
      }`}
    >
      {active && !collapsed && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-brand" aria-hidden="true" />}
      <NavGlyph name={icon} className={`shrink-0 ${active ? 'text-brand' : 'text-muted'}`} />
      {!collapsed && <span className="flex-1 truncate">{label}</span>}
      {!collapsed && badge && <span className={BADGE}>{badge}</span>}
    </Link>
  );
  if (!collapsed) return link;
  // The rail shows the icon; the name opens beside it.
  return (
    <RailFlyout trigger={link}>
      <div className="flex items-center gap-2 px-2 py-1 font-medium whitespace-nowrap">
        {label}
        {badge && <span className={BADGE}>{badge}</span>}
      </div>
    </RailFlyout>
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
  const current = inside ? activeChild(path, href, children) : undefined;
  if (!children.length) return <NavLink href={href} label={label} icon={icon} badge={badge} />;
  // The rail: the work type's icon, with its pages in a card beside it.
  if (collapsed) {
    return (
      <RailFlyout
        trigger={
          <Link
            href={href}
            aria-label={label}
            aria-current={inside ? 'page' : undefined}
            className={`flex h-10 items-center justify-center rounded-lg transition-colors ${inside ? 'bg-brand-soft text-brand' : 'text-ink/90 hover:bg-surface-2 hover:text-ink'}`}
          >
            <NavGlyph name={icon} className={`shrink-0 ${inside ? 'text-brand' : 'text-muted'}`} />
          </Link>
        }
      >
        <div className="flex items-center gap-2 px-2 pt-1 pb-1.5 text-2xs font-semibold tracking-wide whitespace-nowrap text-muted uppercase">
          {label}
          {badge && <span className={`${BADGE} normal-case`}>{badge}</span>}
        </div>
        {children.map(c => {
          const on = c.href === current;
          return (
            <Link
              key={c.href}
              href={c.href}
              aria-current={on ? 'page' : undefined}
              className={`flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 whitespace-nowrap transition-colors ${on ? 'bg-brand-soft font-medium text-brand' : 'text-ink/90 hover:bg-surface-2 hover:text-ink'}`}
            >
              <NavGlyph name={c.icon} size={16} className={`shrink-0 ${on ? 'text-brand' : 'text-muted'}`} />
              {c.label}
            </Link>
          );
        })}
      </RailFlyout>
    );
  }
  return (
    <div>
      <div className={`flex min-h-9 items-center rounded-lg transition-colors ${inside ? 'text-ink' : 'text-ink/90 hover:bg-surface-2'}`}>
        <Link href={href} className="flex min-h-9 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2.5">
          <NavGlyph name={icon} className={`shrink-0 ${inside ? 'text-brand' : 'text-muted'}`} />
          <span className={`flex-1 truncate ${inside ? 'font-medium' : ''}`}>{label}</span>
          {badge && <span className={BADGE}>{badge}</span>}
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
