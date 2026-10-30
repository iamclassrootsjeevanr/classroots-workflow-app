import { cookies } from 'next/headers';
import { workTypesWith } from '@/lib/access-core';
import { NAV_COOKIE, normalizePrefs, PREFS_COOKIE } from '@/lib/prefs';
import { MobileNav, type NavGroup } from '@/components/mobile-nav';
import { PrefsSync } from '@/components/prefs-sync';
import { Sidebar, SignOutButton, WhenExpanded } from '@/components/sidebar';
import { getAccess } from '@/server/access';
import { signOut } from '@/server/auth';
import { requireUser } from '@/server/rbac';
import { NavLink } from './nav-link';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const access = await getAccess(user);
  const jar = await cookies();
  const collapsed = jar.get(NAV_COOKIE)?.value === 'collapsed';
  const itemTypes = workTypesWith(access, 'items');
  const hasDashboard = workTypesWith(access, 'dashboard').length > 0;
  const hasReports = workTypesWith(access, 'reports').length > 0;
  const roleNames = [...new Set([...access.byKey.values()].flatMap(a => a.roles.map(r => r.name)))];
  const subtitle = user.isAdmin ? 'Admin' : roleNames.join(' · ') || 'No access yet';

  // One source for both the desktop sidebar and the phone menu.
  const groups: NavGroup[] = [
    {
      links: [
        ...(user.isAdmin ? [{ href: '/admin', label: 'Overview', icon: 'overview' as const, exact: true }] : []),
        ...(hasDashboard ? [{ href: '/my', label: 'My dashboard', icon: 'dashboard' as const }] : []),
      ],
    },
    {
      title: itemTypes.length ? 'Work types' : undefined,
      links: itemTypes.map(t => ({ href: `/w/${t.workTypeKey}`, label: t.workTypeName, icon: 'items' as const, badge: t.state === 'PAUSED' ? 'paused' : !t.canEdit ? 'view' : undefined })),
    },
    { title: hasReports ? 'Insights' : undefined, links: hasReports ? [{ href: '/reports', label: 'Reports', icon: 'reports' as const }] : [] },
    {
      title: user.isAdmin ? 'Admin' : undefined,
      links: user.isAdmin
        ? [
            { href: '/admin/users', label: 'People & access', icon: 'people' as const },
            { href: '/admin/roles', label: 'Roles', icon: 'roles' as const },
            { href: '/admin/work-types', label: 'Work types', icon: 'workTypes' as const },
            { href: '/admin/sync', label: 'Sheet sync', icon: 'sync' as const },
          ]
        : [],
    },
  ].filter(g => g.links.length);

  const signOutAction = async () => {
    'use server';
    await signOut({ redirectTo: '/signin' });
  };

  const brand = (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white shadow-sm">C</div>
      <WhenExpanded>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-sm font-semibold">Classroots Work</div>
          <div className="truncate text-2xs text-muted" title={subtitle}>
            {subtitle}
          </div>
        </div>
      </WhenExpanded>
    </div>
  );

  const footer = (
    <>
      <NavLink href="/account" label="My account" icon="account" />
      <WhenExpanded>
        <div className="mt-2 truncate px-2.5 text-sm font-medium">{user.name ?? user.email}</div>
        <div className="truncate px-2.5 text-xs text-muted">{user.email}</div>
      </WhenExpanded>
      <form action={signOutAction}>
        <SignOutButton />
      </form>
    </>
  );

  return (
    <div className="flex min-h-screen">
      <PrefsSync prefs={normalizePrefs(user.prefs)} cookie={jar.get(PREFS_COOKIE)?.value} />
      <Sidebar initialCollapsed={collapsed} brand={brand} footer={footer}>
        {groups.map((g, i) => (
          <div key={i}>
            {g.title && (
              <WhenExpanded>
                <div className="px-2.5 pt-4 pb-1 text-2xs font-semibold tracking-wide text-muted uppercase">{g.title}</div>
              </WhenExpanded>
            )}
            {!g.title && i > 0 && <div className="my-2 border-t border-line" />}
            {g.links.map(l => (
              <NavLink key={l.href} href={l.href} label={l.label} icon={l.icon} badge={l.badge} exact={l.exact} />
            ))}
          </div>
        ))}
        {!groups.length && (
          <WhenExpanded>
            <p className="px-2 pt-2 text-xs text-muted">You don’t have access to any work yet. Ask an admin.</p>
          </WhenExpanded>
        )}
      </Sidebar>

      <div className="min-w-0 flex-1">
        <MobileNav
          groups={groups}
          name={user.name ?? user.email ?? ''}
          email={user.email ?? ''}
          subtitle={subtitle}
          signOut={
            <form action={signOutAction}>
              <button className="mt-2 flex min-h-10 w-full items-center rounded-lg px-3 text-left text-xs text-muted hover:bg-surface-2 hover:text-ink">Sign out</button>
            </form>
          }
        />
        <main className="safe-bottom mx-auto w-full max-w-[1800px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7 2xl:px-12 2xl:py-8">{children}</main>
      </div>
    </div>
  );
}
