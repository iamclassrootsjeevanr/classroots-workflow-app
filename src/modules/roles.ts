/**
 * Roles come from the work type's flow, not the other way round: each module declares the roles its workflow needs
 * (or they are derived from who may move statuses and edit fields). A work type has many roles; a role belongs to one work type.
 */
import type { Capability } from '@/lib/access-core';
import type { Actor, RoleTemplate, WorkTypeDefinition } from './types';

export const COORDINATOR: RoleTemplate = {
  key: 'coordinator',
  name: 'Coordinator',
  description: 'Plans the work: creates items and assigns people.',
  color: '#ef6c00',
  capabilities: ['assign', 'create'],
  dataScope: 'ALL',
  canEdit: true,
  pages: ['dashboard', 'items', 'reports', 'export'],
};

export const VIEWER: RoleTemplate = {
  key: 'viewer',
  name: 'Viewer',
  description: 'Can look but not act.',
  color: '#78909c',
  capabilities: [],
  dataScope: 'ALL',
  canEdit: false,
  pages: ['dashboard', 'items', 'reports'],
};

/** Capabilities the flow actually asks for (moves, stage buttons and field edits). 'OWNER' needs the review capability. */
export function flowCapabilities(mod: Pick<WorkTypeDefinition, 'transitions' | 'fields'> & Partial<Pick<WorkTypeDefinition, 'statuses'>>): Set<Capability | 'ASSIGNEE'> {
  const used = new Set<Capability | 'ASSIGNEE'>();
  const add = (by: Actor[]) => by.forEach(a => used.add(a === 'OWNER' ? 'review' : a));
  mod.transitions.forEach(t => add(t.by));
  mod.statuses?.forEach(s => s.next && add(s.next.by));
  mod.fields.forEach(f => add(f.editableBy));
  return used;
}

/** A role template as AccessRole columns (what a built-in role is reset to). */
export function templateColumns(t: RoleTemplate) {
  return {
    name: t.name,
    description: t.description,
    color: t.color,
    capWork: t.capabilities.includes('work'),
    capReview: t.capabilities.includes('review'),
    capAssign: t.capabilities.includes('assign'),
    capCreate: t.capabilities.includes('create'),
    capManageFields: t.capabilities.includes('manageFields'),
    dataScope: t.dataScope,
    canEdit: t.canEdit,
    pageDashboard: t.pages.includes('dashboard'),
    pageItems: t.pages.includes('items'),
    pageReports: t.pages.includes('reports'),
    pageExport: t.pages.includes('export'),
  };
}

type RightKey = 'capWork' | 'capReview' | 'capAssign' | 'capCreate' | 'capManageFields' | 'dataScope' | 'canEdit' | 'pageDashboard' | 'pageItems' | 'pageReports' | 'pageExport';
const RIGHTS: { key: RightKey; label: string }[] = [
  { key: 'capWork', label: 'work' },
  { key: 'capReview', label: 'review' },
  { key: 'capAssign', label: 'assign' },
  { key: 'capCreate', label: 'add items' },
  { key: 'capManageFields', label: 'edit details' },
  { key: 'dataScope', label: 'which items they see' },
  { key: 'canEdit', label: 'can make changes' },
  { key: 'pageDashboard', label: 'Dashboard page' },
  { key: 'pageItems', label: 'Items page' },
  { key: 'pageReports', label: 'Reports page' },
  { key: 'pageExport', label: 'Export' },
];

/** Where a saved role's rights differ from the flow's default (names and colours don't count). */
export function rightsDrift(saved: Pick<ReturnType<typeof templateColumns>, RightKey>, t: RoleTemplate): string[] {
  const want = templateColumns(t);
  return RIGHTS.filter(r => saved[r.key] !== want[r.key]).map(r => r.label);
}

/** The roles of a work type: its own list, or derived from the flow when it declares none. Always ends with a Viewer. */
export function rolesForModule(mod: WorkTypeDefinition): RoleTemplate[] {
  if (mod.roles?.length) return mod.roles;
  const used = flowCapabilities(mod);
  const out: RoleTemplate[] = [];
  if (used.has('ASSIGNEE') || used.has('work')) {
    out.push({ key: 'worker', name: mod.labels?.assignee ?? 'Worker', description: 'Gets assigned items, works on them and moves them along.', color: '#1976d2', capabilities: ['work'], dataScope: 'OWN', canEdit: true, pages: ['dashboard', 'items'] });
  }
  if (used.has('review') || used.has('manageFields')) {
    const caps: Capability[] = [...(used.has('review') ? (['review'] as const) : []), ...(used.has('manageFields') ? (['manageFields'] as const) : [])];
    out.push({ key: 'reviewer', name: mod.labels?.owner ?? 'Reviewer', description: 'Reviews work, gives feedback and edits item details.', color: '#7e57c2', capabilities: caps, dataScope: 'ALL', canEdit: true, pages: ['dashboard', 'items', 'reports'] });
  }
  out.push(COORDINATOR, VIEWER);
  return out;
}
