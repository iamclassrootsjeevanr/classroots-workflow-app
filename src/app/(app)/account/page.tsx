import { ChangePasswordForm } from '@/components/account-forms';
import { PrefsForm } from '@/components/prefs-form';
import { Card, PageHeader } from '@/components/ui';
import { normalizePrefs } from '@/lib/prefs';
import { formatDateTime } from '@/lib/time';
import { db } from '@/server/db';
import { googleEnabled } from '@/server/env';
import { PAGE_LABELS } from '@/lib/access-core';
import { getAccess } from '@/server/access';
import { requireUser } from '@/server/rbac';
import { appTz } from '@/server/settings';

export const metadata = { title: 'My account' };


export default async function AccountPage() {
  const me = await requireUser();
  const tz = appTz();
  const user = await db.user.findUniqueOrThrow({
    where: { id: me.id },
    select: { name: true, email: true, isAdmin: true, capacity: true, passwordHash: true, passwordUpdatedAt: true, lastLoginAt: true, prefs: true, accounts: { select: { provider: true } } },
  });
  const hasPassword = Boolean(user.passwordHash);
  const access = await getAccess(me);
  const google = user.accounts.some(a => a.provider === 'google');

  return (
    <>
      <PageHeader title="My account" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Profile">
          <dl className="grid grid-cols-[140px_1fr] gap-y-2 text-sm">
            <dt className="text-muted">Name</dt>
            <dd>{user.name ?? '—'}</dd>
            <dt className="text-muted">Email</dt>
            <dd>{user.email}</dd>
            <dt className="text-muted">Access</dt>
            <dd>
              {user.isAdmin ? (
                'Admin – everything'
              ) : access.byKey.size ? (
                <ul className="space-y-1">
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
            <dt className="text-muted">Last sign-in</dt>
            <dd>{user.lastLoginAt ? formatDateTime(user.lastLoginAt, tz) : '—'}</dd>
          </dl>
          <p className="mt-3 text-xs text-muted">Ask an admin to change your name, access or capacity.</p>
        </Card>

        <Card title="Appearance" description="Saved to your account, so it applies on every device you sign in on.">
          <PrefsForm initial={normalizePrefs(user.prefs)} />
        </Card>

        <Card title="Ways to sign in">
          <ul className="mb-4 space-y-1.5 text-sm">
            <li>
              <b>Email + password:</b>{' '}
              {hasPassword ? <span className="text-ok">set{user.passwordUpdatedAt ? ` (updated ${formatDateTime(user.passwordUpdatedAt, tz)})` : ''}</span> : <span className="text-muted">not set yet</span>}
            </li>
            <li>
              <b>Email link:</b> <span className="text-ok">always available</span>
            </li>
            {googleEnabled() && (
              <li>
                <b>Google:</b> {google ? <span className="text-ok">linked</span> : <span className="text-muted">use “Continue with Google” with this email to link it</span>}
              </li>
            )}
          </ul>
          <ChangePasswordForm hasPassword={hasPassword} />
        </Card>
      </div>
    </>
  );
}
