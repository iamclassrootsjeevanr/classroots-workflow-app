import Link from 'next/link';
import { RoleForm } from '@/components/role-editor';
import { PageHeader } from '@/components/ui';
import { db } from '@/server/db';
import { requireAdmin } from '@/server/rbac';

export const metadata = { title: 'Roles' };

export default async function RolesPage() {
  await requireAdmin();
  const roles = await db.accessRole.findMany({ orderBy: [{ isSystem: 'desc' }, { name: 'asc' }], include: { _count: { select: { members: true } } } });

  return (
    <>
      <PageHeader
        title="Roles"
        subtitle="A role bundles what someone can do, which data they see, whether they can edit, and which pages they open. Give people one or more roles per work type; several roles add up."
        actions={
          <Link href="/admin/users" className="btn-ghost">
            People &amp; access
          </Link>
        }
      />
      <div className="mb-5">
        <RoleForm />
      </div>
      <div className="space-y-5">
        {roles.map(r => (
          <RoleForm
            key={`${r.id}-${r.updatedAt.getTime()}`}
            isSystem={r.isSystem}
            members={r._count.members}
            initial={{
              id: r.id,
              name: r.name,
              description: r.description ?? '',
              color: r.color,
              capWork: r.capWork,
              capReview: r.capReview,
              capAssign: r.capAssign,
              capCreate: r.capCreate,
              capManageFields: r.capManageFields,
              dataScope: r.dataScope,
              canEdit: r.canEdit,
              pageDashboard: r.pageDashboard,
              pageItems: r.pageItems,
              pageReports: r.pageReports,
              pageExport: r.pageExport,
            }}
          />
        ))}
      </div>
    </>
  );
}
