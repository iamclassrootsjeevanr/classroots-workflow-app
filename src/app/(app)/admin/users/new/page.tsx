import Link from 'next/link';
import { PageHeader } from '@/components/ui';
import { UserAccessForm } from '@/components/user-access-form';
import { userFormData } from '@/server/people';
import { requireAdmin } from '@/server/rbac';

export const metadata = { title: 'Add user' };

export default async function NewUserPage() {
  const admin = await requireAdmin();
  const data = await userFormData();
  return (
    <>
      <nav className="mb-2 text-sm text-muted">
        <Link href="/admin/users" className="link">
          People &amp; access
        </Link>{' '}
        / Add user
      </nav>
      <PageHeader title="Add user" subtitle="Four steps: who they are, how they sign in, what they can access, then check and save." />
      <UserAccessForm {...data} isSelf={false} key={admin.id} />
    </>
  );
}
