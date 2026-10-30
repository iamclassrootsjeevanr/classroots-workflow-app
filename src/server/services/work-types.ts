import type { Prisma, WorkTypeState } from '@prisma/client';
import { allModules, requireModule } from '@/modules/registry';
import { db } from '../db';
import { env } from '../env';
import type { WorkTypeConfig } from './work-items';

/** Create the WorkType row for a registered module (idempotent). Sheet sync starts off; an admin switches it on. */
export async function enableModule(key: string) {
  const mod = requireModule(key);
  const config: WorkTypeConfig = { sync: { enabled: false, tab: mod.sheet?.defaultTab } };
  return db.workType.upsert({
    where: { key },
    create: { key, name: mod.name, description: mod.description, config: config as Prisma.InputJsonValue },
    update: {},
  });
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

export async function updateSyncConfig(id: string, sync: { enabled: boolean; tab: string; spreadsheetId?: string }) {
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

/** The built-in roles (also created by the access_roles migration). Safe to re-run; never overwrites admin edits. */
export const SYSTEM_ROLES = [
  { id: 'role_developer', key: 'developer', name: 'Developer', description: 'Builds the work: gets assigned, starts, submits for review.', color: '#1976d2', capWork: true, dataScope: 'OWN' as const, canEdit: true, pageDashboard: true, pageItems: true, pageReports: false, pageExport: false },
  { id: 'role_reviewer', key: 'reviewer', name: 'SME / Reviewer', description: 'Reviews submissions: approves, requests corrections, gives feedback.', color: '#7e57c2', capReview: true, capManageFields: true, dataScope: 'ALL' as const, canEdit: true, pageDashboard: true, pageItems: true, pageReports: true, pageExport: false },
  { id: 'role_coordinator', key: 'coordinator', name: 'Coordinator', description: 'Plans the work: creates items and assigns people.', color: '#ef6c00', capAssign: true, capCreate: true, dataScope: 'ALL' as const, canEdit: true, pageDashboard: true, pageItems: true, pageReports: true, pageExport: true },
  { id: 'role_tester', key: 'tester', name: 'Tester', description: 'Runs test cases on APK builds: tests, logs failures, retests.', color: '#00897b', capWork: true, dataScope: 'OWN' as const, canEdit: true, pageDashboard: true, pageItems: true, pageReports: true, pageExport: false },
  { id: 'role_app_developer', key: 'app-developer', name: 'App Developer', description: 'Responds to test failures: marks them fixed and adds developer remarks.', color: '#6d4c41', capReview: true, dataScope: 'ALL' as const, canEdit: true, pageDashboard: true, pageItems: true, pageReports: true, pageExport: false },
  { id: 'role_viewer', key: 'viewer', name: 'Viewer', description: 'Can look but not act.', color: '#78909c', dataScope: 'ALL' as const, canEdit: false, pageDashboard: true, pageItems: true, pageReports: true, pageExport: false },
] as const;

export async function ensureSystemRoles() {
  for (const r of SYSTEM_ROLES) {
    await db.accessRole.upsert({ where: { key: r.key }, create: { ...r, isSystem: true }, update: {} });
  }
}
