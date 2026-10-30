import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import type { User } from '@prisma/client';
import { auth } from './auth';
import { db } from './db';

export { ForbiddenError } from './errors';

export type CurrentUser = Pick<User, 'id' | 'name' | 'email' | 'image' | 'isAdmin' | 'capacity' | 'active'>;

/** Signed-in user, re-read from the DB once per request (access changes apply immediately). */
export const currentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, image: true, isAdmin: true, capacity: true, active: true },
  });
  return user?.active ? user : null;
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
