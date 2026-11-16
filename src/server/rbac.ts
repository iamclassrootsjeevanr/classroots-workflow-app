import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import type { User } from '@prisma/client';
import { auth } from './auth';
import { db } from './db';
import { refreshStages } from './stages';
import { viewAsEnabled } from './env';
import { cookies } from 'next/headers';

/** Admin testing: the person an admin is looking at the app as (set by startViewAs, never trusted without the real session being an admin). */
export const VIEW_AS_COOKIE = 'cr_viewas';

export { ForbiddenError } from './errors';

export type CurrentUser = Pick<User, 'id' | 'name' | 'email' | 'image' | 'isAdmin' | 'capacity' | 'active' | 'prefs'> & {
  /** Set while an admin views the app as this person: the admin's name. */
  viewAsBy?: string | null;
  /** The signed-in person is an admin who may view as others (even while viewing as someone else). */
  canViewAs?: boolean;
};

/** Signed-in user, re-read from the DB once per request (access changes apply immediately). */
export const currentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;
  await refreshStages();
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, image: true, isAdmin: true, capacity: true, active: true, prefs: true },
  });
  if (!user?.active) return null;
  if (!user.isAdmin || !viewAsEnabled()) return user;
  // Admin testing: view as another active person (their access, their dashboards). Exit from the banner.
  const target = (await cookies()).get(VIEW_AS_COOKIE)?.value;
  if (target && target !== user.id) {
    const as = await db.user.findUnique({
      where: { id: target },
      select: { id: true, name: true, email: true, image: true, isAdmin: true, capacity: true, active: true, prefs: true },
    });
    if (as?.active) return { ...as, viewAsBy: user.name ?? user.email ?? 'Admin', canViewAs: true };
  }
  return { ...user, canViewAs: true };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await currentUser();
  if (!user) redirect('/signin');
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.isAdmin) redirect('/');
  return user;
}

export const homeFor = (user: Pick<CurrentUser, 'isAdmin'>) => (user.isAdmin ? '/admin' : '/my');
