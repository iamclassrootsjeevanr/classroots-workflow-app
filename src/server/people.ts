import 'server-only';
import type { UserInput } from '@/app/actions';
import { roleCapabilities, rolePages } from '@/lib/access-core';
import { getModule } from '@/modules/registry';
import type { PersonChoice, RoleOption, WorkTypeOption } from '@/components/user-access-form';
import { db } from './db';
import { env, googleEnabled } from './env';
import { ensureSystemRoles } from './services/work-types';

type MemberRow = { workTypeId: string; roles: { roleId: string }[]; groupKeys: string[] };

export function toAccessInput(m: MemberRow): UserInput['access'][number] {
  return { workTypeId: m.workTypeId, enabled: true, roleIds: m.roles.map(r => r.roleId), groupKeys: m.groupKeys };
}

/** Groups a membership can be limited to: the chapters of work types that group by chapter (not APK versions). */
async function groupChoices(workTypes: { id: string; key: string }[]) {
  const out = new Map<string, { groups: { key: string; label: string }[]; groupLabel: string }>();
  for (const wt of workTypes) {
    const mod = getModule(wt.key);
    if (!mod || mod.versions) continue;
    const rows = await db.workItem.findMany({ where: { workTypeId: wt.id, archivedAt: null, groupKey: { not: null } }, distinct: ['groupKey'], select: { groupKey: true, chapter: { select: { title: true } } } });
    if (!rows.length) continue;
    const groups = rows
      .map(r => ({ key: r.groupKey!, label: r.chapter?.title && r.chapter.title !== r.groupKey ? `${r.groupKey} · ${r.chapter.title}` : r.groupKey! }))
      .sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
    out.set(wt.id, { groups, groupLabel: mod.labels?.group ?? 'Group' });
  }
  return out;
}

/** Everything the Add / Edit user page needs. */
export async function userFormData(userId?: string) {
  // Roles follow each work type's flow: add any role a module has gained.
  await ensureSystemRoles();
  const [workTypes, roles, people] = await Promise.all([
    db.workType.findMany({ where: { state: { not: 'ARCHIVED' } }, orderBy: { name: 'asc' }, select: { id: true, key: true, name: true, state: true } }),
    db.accessRole.findMany({ where: { workType: { state: { not: 'ARCHIVED' } } }, orderBy: [{ isSystem: 'desc' }, { name: 'asc' }] }),
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
  const roleOptions: RoleOption[] = roles.map(r => ({ id: r.id, workTypeId: r.workTypeId, name: r.name, description: r.description, color: r.color, capabilities: roleCapabilities(r), dataScope: r.dataScope, canEdit: r.canEdit, pages: rolePages(r) }));
  const choices = await groupChoices(workTypes);
  const wtOptions: WorkTypeOption[] = workTypes.map(w => ({ id: w.id, name: w.name, state: w.state, ...choices.get(w.id) }));
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
  return { initial, workTypes: wtOptions, roles: roleOptions, placeholders, copySources, hasPassword, officeDomains: env().OFFICE_DOMAINS, googleOn: googleEnabled() };
}
