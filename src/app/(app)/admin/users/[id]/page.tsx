import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PeopleActions } from '@/components/people-actions';
import { Card, PageHeader } from '@/components/ui';
import { UserAccessForm } from '@/components/user-access-form';
import { formatDateTime } from '@/lib/time';
import { db } from '@/server/db';
import { userFormData } from '@/server/people';
import { requireAdmin } from '@/server/rbac';
import { appTz } from '@/server/settings';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const u = await db.user.findUnique({ where: { id }, select: { name: true, email: true } });
  return { title: u ? `Edit ${u.name ?? u.email}` : 'Not found' };
}

export default async function EditUserPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ added?: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const { added } = await searchParams;
  const user = await db.user.findUnique({
    where: { id },
    include: { _count: { select: { assignedItems: true, ownedItems: true, events: true } }, accounts: { select: { provider: true } } },
  });
  if (!user) notFound();
  const data = await userFormData(id);
  const tz = appTz();

  return (
    <>
      <nav className="mb-2 text-sm text-muted">
        <Link href="/admin/users" className="link">
          People &amp; access
        </Link>{' '}
        / {user.name ?? user.email}
      </nav>
      <PageHeader
        title={user.name ?? user.email ?? 'Person'}
        subtitle={`${user.active ? 'Active' : 'Deactivated'} · last sign-in ${user.lastLoginAt ? formatDateTime(user.lastLoginAt, tz) : 'never'}${user.accounts.length ? ` · linked: ${user.accounts.map(a => a.provider).join(', ')}` : ''} · ${user._count.assignedItems} assigned, ${user._count.ownedItems} owned`}
        actions={<PeopleActions userId={user.id} active={user.active} isSelf={user.id === admin.id} afterRemove="/admin/users" />}
      />
      {added && <p className="mb-4 rounded-md bg-emerald-50 px-4 py-2 text-sm text-emerald-800">Added. They can sign in now if they have an email and a password (or use Google / an email link).</p>}
      <UserAccessForm {...data} isSelf={user.id === admin.id} key={`${user.updatedAt.getTime()}`} />
      <Card className="mt-5" title="Removing someone">
        <p className="text-sm text-muted">
          <b>Deactivate</b> blocks sign-in and keeps their name on past work and in reports. <b>Remove</b> deletes them completely, and is only possible for people with no work history.
        </p>
      </Card>
    </>
  );
}
