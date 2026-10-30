import { redirect } from 'next/navigation';
import { workTypesWith } from '@/lib/access-core';
import { requireAccess } from '@/server/access';

/** Send each person to the first page their access allows. */
export default async function Home() {
  const { user, access } = await requireAccess();
  if (user.isAdmin) redirect('/admin');
  if (workTypesWith(access, 'dashboard').length) redirect('/my');
  const items = workTypesWith(access, 'items')[0];
  if (items) redirect(`/w/${items.workTypeKey}`);
  if (workTypesWith(access, 'reports').length) redirect('/reports');
  return (
    <div className="card mx-auto mt-16 max-w-md text-center">
      <h1 className="text-lg font-semibold">No access yet</h1>
      <p className="mt-2 text-sm text-muted">Your account is set up, but you haven’t been given access to any work type. Ask an admin to add you under People &amp; access.</p>
    </div>
  );
}
