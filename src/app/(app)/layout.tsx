import { workTypesWith } from '@/lib/access-core';
import { MobileNav, type NavGroup } from '@/components/mobile-nav';
import { getAccess } from '@/server/access';
import { signOut } from '@/server/auth';
import { requireUser } from '@/server/rbac';
import { NavLink } from './nav-link';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const access = await getAccess(user);
  const itemTypes = workTypesWith(access, 'items');
  const hasDashboard = workTypesWith(access, 'dashboard').length > 0;
  const hasReports = workTypesWith(access, 'reports').length > 0;
  const roleNames = [...new Set([...access.byKey.values()].flatMap(a => a.roles.map(r => r.name)))];
  const subtitle = user.isAdmin ? 'Admin' : roleNames.join(' · ') || 'No access yet';

  // One source for both the desktop sidebar and the phone menu.
  const groups: NavGroup[] = [
    {
      links: [
        ...(user.isAdmin ? [{ href: '/admin', label: 'Overview', icon: '◧', exact: true }] : []),
        ...(hasDashboard ? [{ href: '/my', label: 'My dashboard', icon: '◉' }] : []),
      ],
    },
    {
      title: itemTypes.length ? 'Work types' : undefined,
      links: itemTypes.map(t => ({ href: `/w/${t.workTypeKey}`, label: t.workTypeName, icon: '▤', badge: t.state === 'PAUSED' ? 'paused' : !t.canEdit ? 'view' : undefined })),
    },
    { title: hasReports ? 'Insights' : undefined, links: hasReports ? [{ href: '/reports', label: 'Reports', icon: '⊞' }] : [] },
    {
      title: user.isAdmin ? 'Admin' : undefined,
      links: user.isAdmin
        ? [
            { href: '/admin/users', label: 'People & access', icon: '☺' },
            { href: '/admin/roles', label: 'Roles', icon: '◈' },
            { href: '/admin/work-types', label: 'Work types', icon: '⚙' },
            { href: '/admin/sync', label: 'Sheet sync', icon: '⇅' },
          ]
        : [],
    },
  ].filter(g => g.links.length);

  const signOutForm = (
    <form
      action={async () => {
        'use server';
        await signOut({ redirectTo: '/signin' });
      }}
    >
      <button className="mt-2 flex min-h-10 w-full items-center rounded-lg px-3 text-left text-xs text-muted hover:bg-canvas hover:text-ink lg:min-h-8 lg:px-2">Sign out</button>
    </form>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-white lg:flex xl:w-64">
        <div className="flex items-center gap-2.5 px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">C</div>
          <div className="min-w-0 leading-tight">
            <div className="text-sm font-semibold">Classroots Work</div>
            <div className="truncate text-[11px] text-muted" title={subtitle}>
              {subtitle}
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2 text-sm">
          {groups.map((g, i) => (
            <div key={i}>
              {g.title && <div className="px-2 pt-4 pb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">{g.title}</div>}
              {g.links.map(l => (
                <NavLink key={l.href} href={l.href} label={l.label} icon={l.icon} badge={l.badge} exact={l.exact} />
              ))}
            </div>
          ))}
          {!groups.length && <p className="px-2 pt-2 text-xs text-muted">You don’t have access to any work yet. Ask an admin.</p>}
        </nav>
        <div className="border-t border-line p-3">
          <NavLink href="/account" label="My account" icon="⚿" />
          <div className="mt-2 truncate px-2 text-sm font-medium">{user.name ?? user.email}</div>
          <div className="truncate px-2 text-xs text-muted">{user.email}</div>
          {signOutForm}
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <MobileNav groups={groups} name={user.name ?? user.email ?? ''} email={user.email ?? ''} subtitle={subtitle} signOut={signOutForm} />
        <main className="safe-bottom mx-auto w-full max-w-[1800px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8 2xl:px-12 2xl:py-8">{children}</main>
      </div>
    </div>
  );
}
