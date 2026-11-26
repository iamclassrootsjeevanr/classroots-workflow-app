import { ChangePasswordForm } from '@/components/account-forms';
import { PrefsForm } from '@/components/prefs-form';
import { Card, PageHeader } from '@/components/ui';
import { normalizePrefs } from '@/lib/prefs';
import { formatDateTime } from '@/lib/time';
import { db } from '@/server/db';
import { env, googleEnabled } from '@/server/env';
import { canChangePassword } from '@/lib/invite';
import Link from 'next/link';
import { PAGE_LABELS } from '@/lib/access-core';
import { getAccess } from '@/server/access';
import { requireUser } from '@/server/rbac';
import { appTz } from '@/server/settings';

export const metadata = { title: 'My account' };


const TABS = [
  { key: 'profile', label: 'Profile' },
  { key: 'settings', label: 'Settings' },
  { key: 'password', label: 'Password' },
] as const;
type Tab = (typeof TABS)[number]['key'];

/** My account in three parts: who I am here, how the app looks for me, and (for a person who signs in with one) my password. */
export default async function AccountPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const me = await requireUser();
  const sp = await searchParams;
  const tz = appTz();
  const user = await db.user.findUniqueOrThrow({
    where: { id: me.id },
    select: { name: true, email: true, isAdmin: true, capacity: true, passwordHash: true, passwordUpdatedAt: true, lastLoginAt: true, prefs: true, accounts: { select: { provider: true } } },
  });
  const hasPassword = Boolean(user.passwordHash);
  const access = await getAccess(me);
  const google = user.accounts.some(a => a.provider === 'google');
  // An office account signs in with Google: it has no password to change here.
  const password = canChangePassword({ email: user.email, googleEnabled: googleEnabled(), officeDomains: env().OFFICE_DOMAINS });
  const tabs = TABS.filter(t => t.key !== 'password' || password);
  const tab: Tab = tabs.find(t => t.key === sp.tab)?.key ?? 'profile';
  const name = user.name ?? user.email ?? 'Account';

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="My account" />
      <div className="card mb-5 flex flex-wrap items-center gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-full bg-brand text-xl font-semibold text-white">{(name.trim()[0] ?? '?').toUpperCase()}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-semibold text-ink">{name}</div>
          <div className="truncate text-sm text-muted">{user.email}</div>
        </div>
        <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand">{user.isAdmin ? 'Admin' : [...new Set([...access.byKey.values()].flatMap(a => a.roles.map(r => r.name)))].join(' · ') || 'No access yet'}</span>
      </div>

      <nav className="mb-5 inline-flex max-w-full overflow-x-auto rounded-lg border border-line bg-surface-2 p-0.5" aria-label="My account">
        {tabs.map(t => (
          <Link
            key={t.key}
            href={t.key === 'profile' ? '/account' : `/account?tab=${t.key}`}
            aria-current={tab === t.key ? 'page' : undefined}
            className={`rounded-md px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${tab === t.key ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === 'profile' && (
        <Card title="Profile">
          <dl className="grid grid-cols-[120px_1fr] gap-y-2.5 text-sm sm:grid-cols-[160px_1fr]">
            <dt className="text-muted">Name</dt>
            <dd>{user.name ?? '—'}</dd>
            <dt className="text-muted">Email</dt>
            <dd className="break-all">{user.email}</dd>
            <dt className="text-muted">Access</dt>
            <dd>
              {user.isAdmin ? (
                'Admin – everything'
              ) : access.byKey.size ? (
                <ul className="space-y-1.5">
                  {[...access.byKey.values()].map(a => (
                    <li key={a.workTypeKey}>
                      <b>{a.workTypeName}</b>: {a.roles.map(r => r.name).join(' + ')} · {a.dataScope === 'ALL' ? 'all data' : 'own data'} · {a.canEdit ? 'can edit' : 'view only'}
                      <div className="text-xs text-muted">{[...a.pages].map(p => PAGE_LABELS[p]).join(', ')}</div>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-muted">No access yet</span>
              )}
            </dd>
            <dt className="text-muted">Capacity</dt>
            <dd>{user.capacity} items at a time</dd>
            <dt className="text-muted">Sign-in</dt>
            <dd>{password ? 'Email and password' : google ? 'Google (linked)' : 'Google: use “Sign in with Google” with this email'}</dd>
            <dt className="text-muted">Last sign-in</dt>
            <dd>{user.lastLoginAt ? formatDateTime(user.lastLoginAt, tz) : '—'}</dd>
          </dl>
          <p className="mt-4 text-xs text-muted">Ask an admin to change your name, access or capacity.</p>
        </Card>
      )}

      {tab === 'settings' && (
        <Card title="Appearance" description="Saved to your account, so it applies on every device you sign in on.">
          <PrefsForm initial={normalizePrefs(user.prefs)} />
        </Card>
      )}

      {tab === 'password' && password && (
        <Card title={hasPassword ? 'Change password' : 'Set a password'} description={hasPassword && user.passwordUpdatedAt ? `Last changed ${formatDateTime(user.passwordUpdatedAt, tz)}.` : undefined}>
          <ChangePasswordForm hasPassword={hasPassword} />
        </Card>
      )}
    </div>
  );
}
