import 'server-only';
import { workloadByUser, type ItemLite } from '@/lib/analytics-core';
import { instantToDateKey } from '@/lib/time';
import { allowedTransitions, canDeleteItem, canEditField } from '@/lib/workflow';
import { getModule, statusDef } from '@/modules/registry';
import type { EditableField, PersonOption, StatusOption } from '@/components/controls';
import { loadLabel } from '@/components/ui';
import { hydrateApkData } from '@/lib/apk-data';
import { APK_INCLUDE } from './apk/store';
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

/** Ids of the items on which the viewer may edit at least one field (these rows get an Edit button). */
export async function editableItemsFor(user: CurrentUser, items: ItemRow[]): Promise<Set<string>> {
  const access = await getAccess(user);
  const out = new Set<string>();
  for (const it of items) {
    const mod = getModule(it.workTypeKey);
    if (!mod) continue;
    const ctx = actorContextFor(access, it.workTypeKey, it);
    if (mod.fields.some(f => canEditField(f, ctx))) out.add(it.id);
  }
  return out;
}

/** The fields of one item with the viewer's edit rights; loaded when the Edit dialog opens, not for every row. */
export async function editFieldsForItem(user: CurrentUser, itemId: string, tz: string): Promise<EditableField[]> {
  const access = await getAccess(user);
  const item = await db.workItem.findUniqueOrThrow({ where: { id: itemId }, include: { workType: { select: { key: true } }, ...APK_INCLUDE } });
  const mod = getModule(item.workType.key);
  if (!mod) return [];
  const ctx = actorContextFor(access, item.workType.key, item);
  const data = hydrateApkData((item.data ?? {}) as Record<string, unknown>, item.apkTest);
  return mod.fields.map(f => ({
    key: f.key,
    label: f.label,
    type: f.type,
    linkLabel: f.linkLabel,
    value: f.key === 'dueAt' ? instantToDateKey(item.dueAt, tz) : data[f.key] == null ? '' : String(data[f.key]),
    editable: canEditField(f, ctx),
  }));
}

/** Ids of the items the viewer may delete. */
export async function deletableItemsFor(user: CurrentUser, items: ItemRow[]): Promise<Set<string>> {
  const access = await getAccess(user);
  const out = new Set<string>();
  for (const it of items) {
    if (!getModule(it.workTypeKey)) continue;
    if (canDeleteItem(actorContextFor(access, it.workTypeKey, it))) out.add(it.id);
  }
  return out;
}

/** People who can do the work in these work types, least-loaded first, with current load in the label. */
export async function assignablePeople(items: ItemLite[], workTypeKeys?: string[]): Promise<PersonOption[]> {
  const users = await db.user.findMany({ where: workPeopleWhere(workTypeKeys), select: { id: true, name: true, email: true, capacity: true } });
  const loads = workloadByUser(items, users.map(u => ({ id: u.id, name: u.name ?? u.email ?? '?', capacity: u.capacity })), new Date());
  return loads.map(w => ({ id: w.userId, name: w.name, hint: `${w.active}/${w.capacity} · ${loadLabel(w.level)}` }));
}
