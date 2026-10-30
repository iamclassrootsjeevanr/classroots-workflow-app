import 'server-only';
import { workloadByUser } from '@/lib/analytics-core';
import { allowedTransitions } from '@/lib/workflow';
import { getModule, statusDef } from '@/modules/registry';
import type { PersonOption, StatusOption } from '@/components/controls';
import { loadLabel } from '@/components/ui';
import { actorContextFor, getAccess } from './access';
import { db } from './db';
import type { CurrentUser } from './rbac';
import { workPeopleWhere, type ItemRow } from './services/analytics';

/** Status moves the viewer may make, per item (capabilities + edit tick of each work type). */
export async function statusOptionsFor(user: CurrentUser, items: ItemRow[]): Promise<Map<string, StatusOption[]>> {
  const access = await getAccess(user);
  const out = new Map<string, StatusOption[]>();
  for (const it of items) {
    const mod = getModule(it.workTypeKey);
    if (!mod) continue;
    const ctx = actorContextFor(access, it.workTypeKey, it);
    out.set(
      it.id,
      allowedTransitions(mod, it.status, ctx).map(t => ({
        to: t.to,
        label: t.label ?? statusDef(mod, t.to).label,
        statusLabel: statusDef(mod, t.to).label,
      })),
    );
  }
  return out;
}

/** People who can do the work in these work types, least-loaded first, with current load in the label. */
export async function assignablePeople(items: ItemRow[], workTypeKeys?: string[]): Promise<PersonOption[]> {
  const users = await db.user.findMany({ where: workPeopleWhere(workTypeKeys), select: { id: true, name: true, email: true, capacity: true } });
  const loads = workloadByUser(items, users.map(u => ({ id: u.id, name: u.name ?? u.email ?? '?', capacity: u.capacity })), new Date());
  return loads.map(w => ({ id: w.userId, name: w.name, hint: `${w.active}/${w.capacity} · ${loadLabel(w.level)}` }));
}
