import Link from 'next/link';
import { RoleForm } from '@/components/role-editor';
import { PageHeader } from '@/components/ui';
import { flowLite } from '@/lib/role-preview';
import { allModules, getModule } from '@/modules/registry';
import { db } from '@/server/db';
import { requireAdmin } from '@/server/rbac';

export const metadata = { title: 'Roles' };

export default async function RolesPage() {
  await requireAdmin();
  const roles = await db.accessRole.findMany({ orderBy: [{ isSystem: 'desc' }, { name: 'asc' }], include: { _count: { select: { members: true } } } });
  const active = await db.workType.findMany({ where: { state: 'ACTIVE' }, select: { key: true }, orderBy: { name: 'asc' } });
  const mods = active.map(w => getModule(w.key)).filter((m): m is NonNullable<typeof m> => Boolean(m));
  const flows = (mods.length ? mods : allModules()).map(flowLite);

  return (
    <>
      <PageHeader
        title="Roles"
        subtitle="A role is a set of simple choices: what people can do, which items they see and which pages they open. The panel beside each role shows exactly what that unlocks in every work type's flow. Give people one or more roles per work type."
        actions={
          <Link href="/admin/users" className="btn-ghost">
            People &amp; access
          </Link>
        }
      />
      <div className="mb-5">
        <RoleForm flows={flows} />
      </div>
      <div className="space-y-5">
        {roles.map(r => (
          <RoleForm
            key={`${r.id}-${r.updatedAt.getTime()}`}
            flows={flows}
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
