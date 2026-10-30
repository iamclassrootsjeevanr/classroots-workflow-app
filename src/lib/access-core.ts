/**
 * Pure access rules: what a person may see and do in each work type.
 * Built from their WorkTypeMember rows (roles, data scope, edit tick, page ticks); admins get everything.
 */

export const CAPABILITIES = ['work', 'review', 'assign', 'create', 'manageFields'] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const CAPABILITY_LABELS: Record<Capability, { label: string; help: string }> = {
  work: { label: 'Do the work', help: 'Can be assigned items, start them, submit and re-submit for review.' },
  review: { label: 'Review', help: 'Can approve, request corrections and give feedback.' },
  assign: { label: 'Assign people', help: 'Can assign or reassign who works on an item.' },
  create: { label: 'Create items', help: 'Can add new items.' },
  manageFields: { label: 'Edit owner fields', help: 'Can edit due dates and SME / owner details.' },
};

export const PAGES = ['dashboard', 'items', 'reports', 'export'] as const;
export type PageKey = (typeof PAGES)[number];

export const PAGE_LABELS: Record<PageKey, string> = {
  dashboard: 'Dashboard',
  items: 'Items list & pages',
  reports: 'Reports',
  export: 'Export (CSV / Excel)',
};

export type DataScope = 'OWN' | 'ALL';

export type RoleLite = {
  id: string;
  name: string;
  color: string;
  capWork: boolean;
  capReview: boolean;
  capAssign: boolean;
  capCreate: boolean;
  capManageFields: boolean;
  dataScope: DataScope;
  canEdit: boolean;
  pageDashboard: boolean;
  pageItems: boolean;
  pageReports: boolean;
  pageExport: boolean;
};

/** A person's membership of one work type is just the roles they hold there. */
export type MembershipLite = { roles: RoleLite[] };

export type WorkTypeLite = { id: string; key: string; name: string; state: 'ACTIVE' | 'PAUSED' | 'ARCHIVED' };

export type WorkTypeAccess = {
  workTypeId: string;
  workTypeKey: string;
  workTypeName: string;
  state: WorkTypeLite['state'];
  roles: { id: string; name: string; color: string }[];
  capabilities: ReadonlySet<Capability>;
  dataScope: DataScope;
  canEdit: boolean;
  pages: ReadonlySet<PageKey>;
};

export type Access = {
  userId: string;
  isAdmin: boolean;
  /** Keyed by work type key. Only work types the person can open at all. */
  byKey: Map<string, WorkTypeAccess>;
};

export function roleCapabilities(r: Pick<RoleLite, 'capWork' | 'capReview' | 'capAssign' | 'capCreate' | 'capManageFields'>): Capability[] {
  const out: Capability[] = [];
  if (r.capWork) out.push('work');
  if (r.capReview) out.push('review');
  if (r.capAssign) out.push('assign');
  if (r.capCreate) out.push('create');
  if (r.capManageFields) out.push('manageFields');
  return out;
}

export function rolePages(r: Pick<RoleLite, 'pageDashboard' | 'pageItems' | 'pageReports' | 'pageExport'>): PageKey[] {
  const out: PageKey[] = [];
  if (r.pageDashboard) out.push('dashboard');
  if (r.pageItems) out.push('items');
  if (r.pageReports) out.push('reports');
  if (r.pageExport && r.pageReports) out.push('export');
  return out;
}

export type CombinedRoles = {
  capabilities: Set<Capability>;
  dataScope: DataScope;
  canEdit: boolean;
  pages: Set<PageKey>;
};

/**
 * Several roles add up: every capability and page any of them grants, "all data" if any role has it,
 * and edit rights if any role can edit.
 */
export function combineRoles(roles: RoleLite[]): CombinedRoles {
  return {
    capabilities: new Set(roles.flatMap(roleCapabilities)),
    dataScope: roles.some(r => r.dataScope === 'ALL') ? 'ALL' : 'OWN',
    canEdit: roles.some(r => r.canEdit),
    pages: new Set(roles.flatMap(rolePages)),
  };
}

/** Combine a person's admin flag and memberships into their access map. Paused work types are admin-only; archived are hidden. */
export function buildAccess(
  userId: string,
  isAdmin: boolean,
  workTypes: WorkTypeLite[],
  memberships: Map<string, MembershipLite>,
): Access {
  const byKey = new Map<string, WorkTypeAccess>();
  for (const wt of workTypes) {
    if (wt.state === 'ARCHIVED') continue;
    if (isAdmin) {
      byKey.set(wt.key, {
        workTypeId: wt.id,
        workTypeKey: wt.key,
        workTypeName: wt.name,
        state: wt.state,
        roles: [{ id: 'admin', name: 'Admin', color: '#c62828' }],
        capabilities: new Set(CAPABILITIES),
        dataScope: 'ALL',
        canEdit: true,
        pages: new Set(PAGES),
      });
      continue;
    }
    const m = memberships.get(wt.id);
    if (!m || wt.state !== 'ACTIVE' || !m.roles.length) continue;
    const c = combineRoles(m.roles);
    if (!c.pages.size) continue;
    byKey.set(wt.key, {
      workTypeId: wt.id,
      workTypeKey: wt.key,
      workTypeName: wt.name,
      state: wt.state,
      roles: m.roles.map(r => ({ id: r.id, name: r.name, color: r.color })),
      capabilities: c.capabilities,
      dataScope: c.dataScope,
      canEdit: c.canEdit,
      pages: c.pages,
    });
  }
  return { userId, isAdmin, byKey };
}

export function workTypesWith(access: Access, page: PageKey): WorkTypeAccess[] {
  return [...access.byKey.values()].filter(a => a.pages.has(page));
}

export function hasCapabilityAnywhere(access: Access, cap: Capability, page: PageKey = 'dashboard'): boolean {
  return workTypesWith(access, page).some(a => a.capabilities.has(cap));
}

export type ItemOwnership = { assigneeId: string | null; ownerId: string | null; createdById: string | null };

/** OWN = assigned to me, owned by me, or created by me. */
export function isOwnItem(item: ItemOwnership, userId: string): boolean {
  return item.assigneeId === userId || item.ownerId === userId || item.createdById === userId;
}

/** Whether the item is within the person's data scope. Page ticks decide where it is shown, not whether it is theirs. */
export function canSeeItem(access: Access, workTypeKey: string, item: ItemOwnership): boolean {
  const a = access.byKey.get(workTypeKey);
  if (!a) return false;
  return a.dataScope === 'ALL' || isOwnItem(item, access.userId);
}
