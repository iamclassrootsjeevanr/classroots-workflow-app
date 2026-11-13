import 'server-only';
import { workloadByUser, type ItemLite } from '@/lib/analytics-core';
import { developerStage } from '@/lib/stages';
import { instantToDateKey } from '@/lib/time';
import { allowedTransitions, canDeleteItem, canEditField, hasCap, type ActorContext } from '@/lib/workflow';
import { getModule, statusDef } from '@/modules/registry';
import type { WorkTypeDefinition } from '@/modules/types';
import type { EditableField, PersonOption, StatusOption } from '@/components/controls';
import { loadLabel } from '@/components/ui';
import { hydrateApkData, hydrateVersion } from '@/lib/apk-data';
import { APK_INCLUDE } from './apk/store';
import { actorContextFor, getAccess } from './access';
import { db } from './db';
import type { CurrentUser } from './rbac';
import { workPeopleWhere, type ItemRow } from './services/analytics';

/** APK Testing: the work is the APK version; its test results are its children. */
export const isApkVersion = (mod: WorkTypeDefinition, item: { parentId: string | null }) => mod.storage === 'apk' && !item.parentId;

/** The fields an item has: an APK version only has its version facts (release date, APK file, notes), a test result has the rest. */
export const fieldsOf = (mod: WorkTypeDefinition, item: { parentId: string | null }) => (isApkVersion(mod, item) ? mod.fields.filter(f => f.source === 'version') : mod.fields.filter(f => f.source !== 'version'));

/** Status moves the viewer may make, per item (capabilities + edit tick of each work type). */
export async function statusOptionsFor(user: CurrentUser, items: ItemRow[]): Promise<Map<string, StatusOption[]>> {
  const access = await getAccess(user);
  const out = new Map<string, StatusOption[]>();
  for (const it of items) {
    const mod = getModule(it.workTypeKey);
    if (!mod) continue;
    const ctx = actorContextFor(access, it.workTypeKey, it);
    // An APK version follows its test results; it is never moved by hand.
    out.set(it.id, isApkVersion(mod, it) ? [] : statusOptions(mod, it.status, ctx));
  }
  return out;
}

/** Moves for the status select. Moves that need feedback are left out: they are made from the item's Feedback card. */
export function statusOptions(mod: WorkTypeDefinition, status: string, ctx: ActorContext): StatusOption[] {
  return allowedTransitions(mod, status, ctx)
    .filter(t => t.requires !== 'feedback')
    .map(t => ({ to: t.to, label: t.label ?? statusDef(mod, t.to).label, statusLabel: statusDef(mod, t.to).label }));
}

/** People who hold the work type's developer role (Journey: they check design standardization). */
export async function developerPeople(workTypeKey: string, role: string, stage?: string, keepId?: string | null): Promise<PersonOption[]> {
  const users = await db.user.findMany({
    where: { active: true, OR: [{ memberships: { some: { workType: { key: workTypeKey }, roles: { some: { role: { key: role, canEdit: true } } } } } }, ...(keepId ? [{ id: keepId }] : [])] },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  });
  // How many journeys each is checking now, so the least busy is easy to pick.
  const waiting = stage ? await db.workItem.groupBy({ by: ['developerId'], where: { workType: { key: workTypeKey }, status: stage, archivedAt: null, developerId: { in: users.map(u => u.id) } }, _count: true }) : [];
  return users.map(u => {
    const n = waiting.find(w => w.developerId === u.id)?._count ?? 0;
    return { id: u.id, name: u.name ?? u.email ?? '?', hint: stage ? `${n} checking` : undefined };
  });
}

/** People who may own (review) items in this work type: active, with an editing role that reviews. */
export async function reviewPeople(workTypeKey: string): Promise<PersonOption[]> {
  const users = await db.user.findMany({
    where: { active: true, memberships: { some: { workType: { key: workTypeKey }, roles: { some: { role: { capReview: true, canEdit: true } } } } } },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  });
  return users.map(u => ({ id: u.id, name: u.name ?? u.email ?? '?' }));
}

/** Ids of the items on which the viewer may edit at least one field (these rows get an Edit button). */
export async function editableItemsFor(user: CurrentUser, items: ItemRow[]): Promise<Set<string>> {
  const access = await getAccess(user);
  const out = new Set<string>();
  for (const it of items) {
    const mod = getModule(it.workTypeKey);
    if (!mod) continue;
    const ctx = actorContextFor(access, it.workTypeKey, it);
    if (fieldsOf(mod, it).some(f => !f.computed && canEditField(f, ctx))) out.add(it.id);
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
  if (isApkVersion(mod, item)) {
    const facts = await db.apkVersion.findUnique({ where: { workTypeId_key: { workTypeId: item.workTypeId, key: item.externalKey } } });
    if (facts) Object.assign(data, hydrateVersion(facts));
  }
  return fieldsOf(mod, item).map(f => ({
    key: f.key,
    label: f.label,
    type: f.type,
    linkLabel: f.linkLabel,
    options: f.options,
    value: f.key === 'dueAt' ? instantToDateKey(item.dueAt, tz) : data[f.key] == null ? '' : String(data[f.key]),
    editable: !f.computed && canEditField(f, ctx),
  }));
}

/** Ids of the items the viewer may assign (a coordinator only in their own chapters). */
export async function assignableItemsFor(user: CurrentUser, items: ItemRow[]): Promise<Set<string>> {
  const access = await getAccess(user);
  return new Set(items.filter(it => hasCap(actorContextFor(access, it.workTypeKey, it), 'assign')).map(it => it.id));
}

/** Ids of the items whose developer the viewer may change: the coordinator, or the journey's own SME creator (Journey developer handoff). */
export async function developerEditsFor(user: CurrentUser, items: ItemRow[]): Promise<Set<string>> {
  const access = await getAccess(user);
  const out = new Set<string>();
  for (const it of items) {
    const mod = getModule(it.workTypeKey);
    if (!mod?.developerHandoff || !developerStage(mod.statuses, mod.developerHandoff, it.status).open) continue;
    const ctx = actorContextFor(access, it.workTypeKey, it);
    if (hasCap(ctx, 'assign') || (ctx.isAssignee && hasCap(ctx, 'work'))) out.add(it.id);
  }
  return out;
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
