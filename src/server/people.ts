import 'server-only';
import type { UserInput } from '@/app/actions';
import { roleCapabilities, rolePages } from '@/lib/access-core';
import type { PersonChoice, RoleOption, WorkTypeOption } from '@/components/user-access-form';
import { db } from './db';

type MemberRow = { workTypeId: string; roles: { roleId: string }[] };

export function toAccessInput(m: MemberRow): UserInput['access'][number] {
  return { workTypeId: m.workTypeId, enabled: true, roleIds: m.roles.map(r => r.roleId) };
}

/** Everything the Add / Edit user page needs. */
export async function userFormData(userId?: string) {
  const [workTypes, roles, people] = await Promise.all([
    db.workType.findMany({ where: { state: { not: 'ARCHIVED' } }, orderBy: { name: 'asc' }, select: { id: true, name: true, state: true } }),
    db.accessRole.findMany({ orderBy: [{ isSystem: 'desc' }, { name: 'asc' }] }),
    db.user.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        isAdmin: true,
        memberships: { include: { roles: { select: { roleId: true, role: { select: { name: true } } } } } },
      },
    }),
  ]);
  const roleOptions: RoleOption[] = roles.map(r => ({ id: r.id, name: r.name, description: r.description, color: r.color, capabilities: roleCapabilities(r), dataScope: r.dataScope, canEdit: r.canEdit, pages: rolePages(r) }));
  const wtOptions: WorkTypeOption[] = workTypes;
  const describe = (p: (typeof people)[number]) =>
    p.memberships.map(m => `${workTypes.find(w => w.id === m.workTypeId)?.name ?? ''}: ${m.roles.map(r => r.role.name).join('+')}`).join('; ');

  const placeholders: PersonChoice[] = people
    .filter(p => !p.email && p.id !== userId)
    .map(p => ({ id: p.id, name: p.name ?? '?', note: describe(p) || 'imported', access: p.memberships.map(toAccessInput) }));
  const copySources: PersonChoice[] = people
    .filter(p => p.id !== userId && p.memberships.length)
    .map(p => ({ id: p.id, name: p.name ?? p.email ?? '?', note: describe(p), access: p.memberships.map(toAccessInput) }));

  let initial: UserInput = { name: '', email: '', capacity: 3, active: true, isAdmin: false, password: '', access: [] };
  let hasPassword = false;
  if (userId) {
    const u = await db.user.findUniqueOrThrow({
      where: { id: userId },
      include: { memberships: { include: { roles: { select: { roleId: true } } } } },
    });
    initial = {
      id: u.id,
      name: u.name ?? '',
      email: u.email ?? '',
      capacity: u.capacity,
      active: u.active,
      isAdmin: u.isAdmin,
      password: '',
      access: u.memberships.map(toAccessInput),
    };
    hasPassword = Boolean(u.passwordHash);
  }
  return { initial, workTypes: wtOptions, roles: roleOptions, placeholders, copySources, hasPassword };
}
