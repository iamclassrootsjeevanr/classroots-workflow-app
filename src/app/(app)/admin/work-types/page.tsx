import Link from 'next/link';
import { EnableModuleButton, WorkTypeStateButtons } from '@/components/admin-controls';
import { Card, PageHeader, StatusBadge } from '@/components/ui';
import { formatDateTime } from '@/lib/time';
import { allModules } from '@/modules/registry';
import { db } from '@/server/db';
import { requireAdmin } from '@/server/rbac';
import { appTz } from '@/server/settings';

export const metadata = { title: 'Work types' };

const STATE_STYLE = { ACTIVE: { label: 'Active', color: '#2e7d32' }, PAUSED: { label: 'Paused', color: '#ef6c00' }, ARCHIVED: { label: 'Archived', color: '#78909c' } };

export default async function WorkTypesPage() {
  await requireAdmin();
  const tz = appTz();
  const rows = await db.workType.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { items: true } } } });
  const byKey = new Map(rows.map(r => [r.key, r]));
  const notEnabled = allModules().filter(m => !byKey.has(m.key));

  return (
    <>
      <PageHeader title="Work types" subtitle="Each kind of work is a module with its own statuses, fields and sheet mapping. Pause to freeze it, archive to hide it – data stays in reports." />
      <div className="space-y-4">
        {rows.map(wt => {
          const mod = allModules().find(m => m.key === wt.key);
          return (
            <Card key={wt.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link href={`/w/${wt.key}`} className="text-lg font-semibold hover:text-brand">
                      {wt.name}
                    </Link>
                    <StatusBadge {...STATE_STYLE[wt.state]} />
                  </div>
                  <p className="mt-1 text-sm text-muted">{wt.description}</p>
                  <p className="mt-1 text-xs text-muted">
                    {wt._count.items} items · module <code>{wt.key}</code>
                    {wt.pausedAt && ` · paused ${formatDateTime(wt.pausedAt, tz)}`}
                    {wt.archivedAt && ` · archived ${formatDateTime(wt.archivedAt, tz)}`}
                    {!mod && <span className="text-bad"> · module code missing</span>}
                  </p>
                  {mod && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {mod.statuses.map(s => (
                        <StatusBadge key={s.key} label={s.label} color={s.color} />
                      ))}
                    </div>
                  )}
                </div>
                <WorkTypeStateButtons id={wt.id} state={wt.state} />
              </div>
            </Card>
          );
        })}

        {notEnabled.map(m => (
          <Card key={m.key}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-lg font-semibold">{m.name}</div>
                <p className="text-sm text-muted">{m.description}</p>
              </div>
              <EnableModuleButton moduleKey={m.key} />
            </div>
          </Card>
        ))}

        <Card title="Adding a new kind of work">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
            <li>
              Create <code>src/modules/&lt;key&gt;/definition.ts</code> exporting a <code>WorkTypeDefinition</code> (statuses, transitions, fields, sheet mapping).
            </li>
            <li>
              Add it to the list in <code>src/modules/registry.ts</code> and deploy.
            </li>
            <li>It then appears here with an Enable button. Lists, item pages, dashboards, reports and sync work without extra code.</li>
          </ol>
        </Card>
      </div>
    </>
  );
}
