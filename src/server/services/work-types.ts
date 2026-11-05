import type { Prisma, WorkTypeState } from '@prisma/client';
import { allModules, getModule, requireModule } from '@/modules/registry';
import { rolesForModule, templateColumns } from '@/modules/roles';
import type { WorkTypeDefinition } from '@/modules/types';
import { db } from '../db';
import { env } from '../env';
import type { WorkTypeConfig } from './work-items';

/** Create the WorkType row for a registered module (idempotent). Sheet sync starts off; an admin switches it on. */
export async function enableModule(key: string) {
  const mod = requireModule(key);
  const config: WorkTypeConfig = { sync: { enabled: false, tab: mod.sheet?.defaultTab } };
  const wt = await db.workType.upsert({
    where: { key },
    create: { key, name: mod.name, description: mod.description, config: config as Prisma.InputJsonValue },
    update: {},
  });
  await ensureModuleRoles(wt.id, mod);
  return wt;
}

export async function ensureAllModules() {
  for (const m of allModules()) await enableModule(m.key);
}

export async function setWorkTypeState(id: string, state: WorkTypeState) {
  const now = new Date();
  return db.workType.update({
    where: { id },
    data: {
      state,
      pausedAt: state === 'PAUSED' ? now : null,
      archivedAt: state === 'ARCHIVED' ? now : null,
    },
  });
}

export async function updateSyncConfig(id: string, sync: NonNullable<WorkTypeConfig['sync']>) {
  const wt = await db.workType.findUniqueOrThrow({ where: { id } });
  const config = { ...((wt.config ?? {}) as WorkTypeConfig), sync };
  return db.workType.update({ where: { id }, data: { config: config as Prisma.InputJsonValue } });
}

/** Admins from ADMIN_EMAILS exist and are active (they can sign in on first run). */
export async function ensureAdmins() {
  for (const email of env().ADMIN_EMAILS) {
    await db.user.upsert({
      where: { email },
      create: { email, name: email.split('@')[0], isAdmin: true, active: true },
      update: { isAdmin: true, active: true },
    });
  }
}

/**
 * Create the roles a work type's flow needs. Roles follow the flow: run this when a work type is enabled and whenever its
 * module gains a role. It only adds missing roles by key and never overwrites what an admin edited.
 */
export async function ensureModuleRoles(workTypeId: string, mod: WorkTypeDefinition) {
  const have = new Set((await db.accessRole.findMany({ where: { workTypeId }, select: { key: true } })).map(r => r.key));
  const missing = rolesForModule(mod).filter(r => !have.has(r.key));
  for (const r of missing) {
    await db.accessRole.create({ data: { workTypeId, key: r.key, isSystem: true, ...templateColumns(r) } });
  }
  return missing.length;
}

/** Put a built-in role back to its flow's default (name, description, rights, pages). */
export async function resetSystemRole(roleId: string) {
  const role = await db.accessRole.findUniqueOrThrow({ where: { id: roleId }, include: { workType: { select: { key: true } } } });
  const mod = getModule(role.workType.key);
  const t = mod && rolesForModule(mod).find(r => r.key === role.key);
  if (!role.isSystem || !t) throw new Error('Only built-in roles have a default to go back to.');
  return db.accessRole.update({ where: { id: roleId }, data: templateColumns(t) });
}

/** Make sure every enabled work type has the roles its flow needs. Safe to run often. */
export async function ensureSystemRoles() {
  const types = await db.workType.findMany({ select: { id: true, key: true } });
  for (const t of types) {
    const mod = getModule(t.key);
    if (mod) await ensureModuleRoles(t.id, mod);
  }
}
