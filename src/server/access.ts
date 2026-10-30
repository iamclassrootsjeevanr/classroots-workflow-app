import 'server-only';
import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import type { Prisma } from '@prisma/client';
import { buildAccess, canSeeItem, workTypesWith, type Access, type ItemOwnership, type MembershipLite, type PageKey, type WorkTypeAccess } from '@/lib/access-core';
import type { ActorContext } from '@/lib/workflow';
import { db } from './db';
import { ForbiddenError } from './errors';
import { requireUser, type CurrentUser } from './rbac';

/** The signed-in person's access, loaded once per request. */
export const getAccess = cache(async (user: CurrentUser): Promise<Access> => {
  const [workTypes, memberships] = await Promise.all([
    db.workType.findMany({ select: { id: true, key: true, name: true, state: true }, orderBy: { name: 'asc' } }),
    db.workTypeMember.findMany({ where: { userId: user.id }, include: { roles: { include: { role: true } } } }),
  ]);
  const byType = new Map<string, MembershipLite>(memberships.map(m => [m.workTypeId, { roles: m.roles.map(r => r.role) }]));
  return buildAccess(user.id, user.isAdmin, workTypes, byType);
});

export async function requireAccess(): Promise<{ user: CurrentUser; access: Access }> {
  const user = await requireUser();
  return { user, access: await getAccess(user) };
}

/** Page guard: 404 when the person can't open this page of this work type. */
export async function requireWorkTypePage(workTypeKey: string, page: PageKey) {
  const { user, access } = await requireAccess();
  const a = access.byKey.get(workTypeKey);
  if (!a || !a.pages.has(page)) notFound();
  return { user, access, wt: a };
}

/** Page guard for cross-work-type pages (dashboard, reports). */
export async function requireAnyPage(page: PageKey) {
  const { user, access } = await requireAccess();
  const types = workTypesWith(access, page);
  if (!types.length) redirect('/');
  return { user, access, types };
}

/** Prisma filter: items of the given work types the person may see (OWN vs ALL per work type). */
export function scopeWhere(access: Access, types: WorkTypeAccess[]): Prisma.WorkItemWhereInput {
  if (!types.length) return { id: '__none__' };
  const me = access.userId;
  return {
    OR: types.map(t =>
      t.dataScope === 'ALL'
        ? { workTypeId: t.workTypeId }
        : { workTypeId: t.workTypeId, OR: [{ assigneeId: me }, { ownerId: me }, { createdById: me }] },
    ),
  };
}

export function actorContextFor(access: Access, workTypeKey: string, item: { assigneeId: string | null }): ActorContext {
  const a = access.byKey.get(workTypeKey);
  return {
    isAdmin: access.isAdmin,
    capabilities: a?.capabilities ?? new Set(),
    isAssignee: item.assigneeId === access.userId,
    canEdit: Boolean(a?.canEdit),
  };
}

/** For server actions: the item must be visible to the person, else Forbidden. */
export async function itemActorContext(user: CurrentUser, itemId: string) {
  const access = await getAccess(user);
  const item = await db.workItem.findUniqueOrThrow({
    where: { id: itemId },
    select: { workTypeId: true, assigneeId: true, ownerId: true, createdById: true, workType: { select: { key: true } } },
  });
  if (!canSeeItem(access, item.workType.key, item as ItemOwnership)) throw new ForbiddenError('You don’t have access to this item.');
  return { access, item, ctx: actorContextFor(access, item.workType.key, item) };
}
