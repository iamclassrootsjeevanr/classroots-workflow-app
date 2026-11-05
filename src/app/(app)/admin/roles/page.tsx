import Link from 'next/link';
import { RoleForm } from '@/components/role-editor';
import { PageHeader, Tabs } from '@/components/ui';
import { flowLite } from '@/lib/role-preview';
import { getModule } from '@/modules/registry';
import { rightsDrift, rolesForModule } from '@/modules/roles';
import { db } from '@/server/db';
import { requireAdmin } from '@/server/rbac';
import { ensureSystemRoles } from '@/server/services/work-types';

export const metadata = { title: 'Roles' };

/** Roles are listed per work type: they follow that work type's flow, and a role belongs to exactly one work type. */
export default async function RolesPage({ searchParams }: { searchParams: Promise<{ wt?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  // Roles follow the flow: a work type whose module gained a role gets it here automatically.
  await ensureSystemRoles();
  const types = await db.workType.findMany({
    where: { state: { not: 'ARCHIVED' } },
    orderBy: { name: 'asc' },
    include: { roles: { orderBy: [{ isSystem: 'desc' }, { name: 'asc' }], include: { _count: { select: { members: true } } } } },
  });
  const current = types.find(t => t.id === sp.wt || t.key === sp.wt) ?? types[0];
  const mod = current ? getModule(current.key) : undefined;
  const href = (id: string) => `/admin/roles?wt=${id}`;

  return (
    <>
      <PageHeader
        title="Roles"
        subtitle="Each work type has its own roles, built from its flow. A work type can have many roles; a role belongs to one work type. The panel beside a role shows what it unlocks in that flow. Give people one or more roles per work type."
        actions={
          <Link href="/admin/users" className="btn-ghost">
            People &amp; access
          </Link>
        }
      />
      {types.length > 0 && current && (
        <>
          <Tabs active={href(current.id)} items={types.map(t => ({ href: href(t.id), label: `${t.name} (${t.roles.length})` }))} />
          {!mod ? (
            <p className="note-warn">This work type has no module definition, so its flow cannot be shown.</p>
          ) : (
            <>
              <p className="mb-4 max-w-3xl text-sm text-muted">
                Roles of <b className="text-ink">{current.name}</b>. Built-in roles come from the flow and can be edited but not removed. New flow roles appear here on their own; add a custom role for anything the flow does not cover.
              </p>
              <div className="mb-5">
                <RoleForm workTypeId={current.id} flows={[flowLite(mod)]} />
              </div>
              <div className="space-y-5">
                {current.roles.map(r => (
                  <RoleForm
                    key={`${r.id}-${r.updatedAt.getTime()}`}
                    workTypeId={current.id}
                    flows={[flowLite(mod)]}
                    isSystem={r.isSystem}
                    drift={(() => {
                      const t = r.isSystem ? rolesForModule(mod).find(x => x.key === r.key) : undefined;
                      return t ? rightsDrift(r, t) : undefined;
                    })()}
                    members={r._count.members}
                    initial={{
                      id: r.id,
                      workTypeId: current.id,
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
          )}
        </>
      )}
    </>
  );
}
