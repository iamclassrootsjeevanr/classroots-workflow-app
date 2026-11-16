import 'server-only';
import { cookies } from 'next/headers';
import { auth } from './auth';
import { db } from './db';
import { viewAsEnabled } from './env';
import { VIEW_AS_COOKIE } from './rbac';

/** The real signed-in person must be an admin and view-as must be on; the person being viewed is not consulted. */
async function realAdmin() {
  if (!viewAsEnabled()) throw new Error('View as is switched off here.');
  const session = await auth();
  const me = session?.user?.id ? await db.user.findUnique({ where: { id: session.user.id }, select: { id: true, isAdmin: true, active: true } }) : null;
  if (!me?.active || !me.isAdmin) throw new Error('Only admins can view the app as someone else.');
  return me;
}

export async function startViewAs(userId: string) {
  const me = await realAdmin();
  const target = await db.user.findFirst({ where: { id: userId, active: true }, select: { id: true } });
  if (!target) throw new Error('That person is not active.');
  const jar = await cookies();
  if (target.id === me.id) jar.delete(VIEW_AS_COOKIE);
  else jar.set(VIEW_AS_COOKIE, target.id, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 8 });
}

export async function stopViewAs() {
  (await cookies()).delete(VIEW_AS_COOKIE);
}

/** People an admin can view as, with their roles. */
export async function viewAsPeople() {
  const users = await db.user.findMany({
    where: { active: true, name: { not: null } },
    select: { id: true, name: true, isAdmin: true, memberships: { select: { workType: { select: { name: true } }, roles: { select: { role: { select: { name: true } } } } } } },
    orderBy: { name: 'asc' },
  });
  return users.map(u => ({
    id: u.id,
    name: u.name!,
    roles: u.isAdmin ? 'Admin' : [...new Set(u.memberships.flatMap(m => m.roles.map(r => `${r.role.name}`)))].join(', ') || 'No role',
  }));
}
