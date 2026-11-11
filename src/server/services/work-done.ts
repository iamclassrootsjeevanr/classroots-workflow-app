import 'server-only';
import { doneMetricsOf, doneTable, type DoneTable } from '@/lib/work-done';
import { getModule, statusDef } from '@/modules/registry';
import type { DoneInput } from '@/modules/types';
import { db } from '../db';

/** Work done by every person of a work type, for the Overview. Callers decide how much of it a viewer may see. */
export async function loadWorkDone(workTypeKey: string): Promise<DoneTable> {
  const mod = getModule(workTypeKey);
  const wt = await db.workType.findUnique({ where: { key: workTypeKey }, select: { id: true } });
  if (!mod || !wt) return { metrics: [], people: [], team: {} };
  const apk = mod.storage === 'apk';
  const [work, results, fixes, users] = await Promise.all([
    db.workItem.findMany({ where: { workTypeId: wt.id, archivedAt: null, parentId: null, assigneeId: { not: null } }, select: { assigneeId: true, status: true } }),
    apk ? db.workItem.findMany({ where: { workTypeId: wt.id, archivedAt: null, parentId: { not: null }, assigneeId: { not: null } }, select: { assigneeId: true, status: true } }) : Promise.resolve([]),
    apk ? db.workItemEvent.groupBy({ by: ['actorId'], where: { type: 'STATUS_CHANGED', toValue: 'fixed', actorId: { not: null }, item: { workTypeId: wt.id } }, _count: true }) : Promise.resolve([]),
    db.user.findMany({
      where: { active: true, OR: [{ memberships: { some: { workTypeId: wt.id, roles: { some: { role: { OR: [{ capWork: true }, { capReview: true }] } } } } } }, { assignedItems: { some: { workTypeId: wt.id, archivedAt: null } } }] },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    }),
  ]);
  const people = users.map(u => ({
    id: u.id,
    name: u.name ?? u.email ?? '?',
    input: {
      work: work.filter(w => w.assigneeId === u.id).map(w => ({ status: w.status, category: statusDef(mod, w.status).category })),
      results: results.filter(r => r.assigneeId === u.id).map(r => ({ status: r.status })),
      fixes: fixes.find(f => f.actorId === u.id)?._count ?? 0,
    } satisfies DoneInput,
  }));
  // Someone with nothing in any column is not part of the average (a viewer, an admin who never tests).
  const metrics = doneMetricsOf(mod);
  return doneTable(metrics, people.filter(p => metrics.some(m => m.value(p.input))));
}
