import Link from 'next/link';
import { FilterBar } from '@/components/filter-bar';
import { PeopleActions } from '@/components/people-actions';
import { Card, PageHeader } from '@/components/ui';
import { combineRoles, type RoleLite } from '@/lib/access-core';
import { formatDateTime } from '@/lib/time';
import { db } from '@/server/db';
import { env, googleEnabled } from '@/server/env';
import { requireAdmin } from '@/server/rbac';
import { appTz } from '@/server/settings';

export const metadata = { title: 'People & access' };

type Search = { q?: string; wt?: string; role?: string; status?: string };

function AccessChips({ isAdmin, memberships }: { isAdmin: boolean; memberships: { workTypeId: string; workType: { name: string }; roles: { role: RoleLite }[] }[] }) {
  if (isAdmin) return <span className="chip bg-red-50 text-red-700">Admin · everything</span>;
  if (!memberships.length) return <span className="text-xs text-warn">No access yet</span>;
  return (
    <div className="flex flex-col gap-1">
      {memberships.map(m => {
        const c = combineRoles(m.roles.map(r => r.role));
        return (
          <div key={m.workTypeId} className="flex flex-wrap items-center gap-1 text-xs">
            <span className="font-medium">{m.workType.name}:</span>
            {m.roles.map(r => (
              <span key={r.role.id} className="chip" style={{ background: `${r.role.color}1a`, color: r.role.color }}>
                {r.role.name}
              </span>
            ))}
            <span className="text-muted">
              · {c.dataScope === 'ALL' ? 'all data' : 'own data'} · {c.canEdit ? 'edit' : 'view only'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default async function UsersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const tz = appTz();
  const [users, workTypes, roles] = await Promise.all([
    db.user.findMany({
      orderBy: [{ active: 'desc' }, { isAdmin: 'desc' }, { name: 'asc' }],
      include: {
        memberships: { include: { workType: { select: { id: true, key: true, name: true } }, roles: { include: { role: true } } } },
        _count: { select: { assignedItems: true, ownedItems: true } },
      },
    }),
    db.workType.findMany({ where: { state: { not: 'ARCHIVED' } }, orderBy: { name: 'asc' } }),
    db.accessRole.findMany({ orderBy: { name: 'asc' } }),
  ]);

  const q = sp.q?.toLowerCase();
  const shown = users.filter(u => {
    if (q && !`${u.name ?? ''} ${u.email ?? ''}`.toLowerCase().includes(q)) return false;
    if (sp.wt && !u.isAdmin && !u.memberships.some(m => m.workType.key === sp.wt)) return false;
    if (sp.role && !u.memberships.some(m => m.roles.some(r => r.role.id === sp.role))) return false;
    if (sp.status === 'active' && !u.active) return false;
    if (sp.status === 'inactive' && u.active) return false;
    if (sp.status === 'no-email' && u.email) return false;
    if (sp.status === 'admin' && !u.isAdmin) return false;
    return true;
  });
  const domains = env().ALLOWED_DOMAINS;

  return (
    <>
      <PageHeader
        title="People & access"
        subtitle={`${users.filter(u => u.active).length} active people · sign-in: email + password${googleEnabled() ? ', Google' : ''}, email link · invited only${domains.length ? ` (plus anyone @${domains.join(', @')})` : ''}`}
        actions={
          <>
            <Link href="/admin/roles" className="btn-ghost">
              Manage roles
            </Link>
            <Link href="/admin/users/new" className="btn-primary">
              + Add user
            </Link>
          </>
        }
      />
      <FilterBar
        filters={[
          { name: 'q', label: 'Search', type: 'search' },
          { name: 'wt', label: 'Work type', options: workTypes.map(w => ({ value: w.key, label: w.name })) },
          { name: 'role', label: 'Role', options: roles.map(r => ({ value: r.id, label: r.name })) },
          {
            name: 'status',
            label: 'Show',
            options: [
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Deactivated' },
              { value: 'admin', label: 'Admins' },
              { value: 'no-email', label: 'No email (can’t sign in)' },
            ],
          },
        ]}
      />

      {/* Phones: cards */}
      <ul className="space-y-2 md:hidden">
        {shown.map(u => (
          <li key={u.id} className={`card ${u.active ? '' : 'opacity-60'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/admin/users/${u.id}`} className="block truncate text-[15px] font-semibold hover:text-brand">
                  {u.name ?? '—'}
                  {u.id === me.id && <span className="ml-1 text-xs font-normal text-muted">(you)</span>}
                </Link>
                <div className="truncate text-xs text-muted">{u.email ?? 'no email'}</div>
              </div>
              {!u.active && <span className="chip bg-red-50 text-red-700">deactivated</span>}
            </div>
            <div className="mt-3">
              <AccessChips isAdmin={u.isAdmin} memberships={u.memberships} />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-xs text-muted">
              <span>
                {u._count.assignedItems} assigned · {u._count.ownedItems} owned · {u.lastLoginAt ? formatDateTime(u.lastLoginAt, tz) : 'never signed in'}
              </span>
              <span className="flex items-center gap-3">
                <Link href={`/admin/users/${u.id}`} className="link">
                  Edit access
                </Link>
                <PeopleActions userId={u.id} active={u.active} isSelf={u.id === me.id} />
              </span>
            </div>
          </li>
        ))}
      </ul>

      {/* Wider screens: table */}
      <Card className="hidden md:block">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Access (work type · roles · data · edit)</th>
                <th>Work</th>
                <th>Last sign-in</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map(u => (
                <tr key={u.id} className={u.active ? '' : 'opacity-60'}>
                  <td className="font-medium whitespace-nowrap">
                    <Link href={`/admin/users/${u.id}`} className="hover:text-brand">
                      {u.name ?? '—'}
                    </Link>
                    {u.id === me.id && <span className="ml-1 text-xs text-muted">(you)</span>}
                    {!u.active && <span className="ml-1 text-xs text-bad">deactivated</span>}
                  </td>
                  <td className="text-xs whitespace-nowrap">{u.email ?? <span className="text-muted">no email</span>}</td>
                  <td>
                    <AccessChips isAdmin={u.isAdmin} memberships={u.memberships} />
                  </td>
                  <td className="text-xs whitespace-nowrap text-muted">
                    {u._count.assignedItems} assigned · {u._count.ownedItems} owned
                  </td>
                  <td className="text-xs whitespace-nowrap text-muted">{u.lastLoginAt ? formatDateTime(u.lastLoginAt, tz) : 'never'}</td>
                  <td className="whitespace-nowrap">
                    <Link href={`/admin/users/${u.id}`} className="link mr-3 text-xs">
                      Edit access
                    </Link>
                    <PeopleActions userId={u.id} active={u.active} isSelf={u.id === me.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!shown.length && <p className="py-6 text-center text-sm text-muted">No one matches these filters.</p>}
        </div>
      </Card>
      {!shown.length && <p className="py-6 text-center text-sm text-muted md:hidden">No one matches these filters.</p>}
    </>
  );
}
