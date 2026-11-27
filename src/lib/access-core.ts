/**
 * Pure access rules: what a person may see and do in each work type.
 * Built from their WorkTypeMember rows (roles, data scope, edit tick, page ticks); admins get everything.
 */

export const CAPABILITIES = ['work', 'review', 'assign', 'create', 'manageFields', 'qa'] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const CAPABILITY_LABELS: Record<Capability, { label: string; help: string }> = {
  work: { label: 'Work on items', help: 'Pick up items assigned to them, start them and send them for review.' },
  review: { label: 'Review items', help: 'Approve, send back for corrections and give feedback.' },
  assign: { label: 'Assign people', help: 'Choose who works on each item.' },
  create: { label: 'Add new items', help: 'Create new items in the list.' },
  manageFields: { label: 'Edit item details', help: 'Change due dates, owner details and other item fields.' },
  qa: { label: 'Test finished items', help: 'Check an item at its QA stage: mark it done, or send it back with a ticket.' },
};

export const PAGES = ['dashboard', 'items', 'reports', 'export', 'board'] as const;
export type PageKey = (typeof PAGES)[number];

export const PAGE_LABELS: Record<PageKey, string> = {
  dashboard: 'Dashboard',
  items: 'Items list & pages',
  reports: 'Reports',
  export: 'Export (CSV / Excel)',
  board: 'Relay board',
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
  /** Optional so role rows read before the column existed still fit. */
  capQa?: boolean;
  dataScope: DataScope;
  canEdit: boolean;
  pageDashboard: boolean;
  pageItems: boolean;
  pageReports: boolean;
  pageExport: boolean;
  /** The Relay board tab. Optional so role rows read before the column existed still fit. */
  pageBoard?: boolean;
};

/** A person's membership of one work type: the roles they hold there, and the groups their steward rights are limited to. */
export type MembershipLite = { roles: RoleLite[]; groupKeys?: string[]; /** People whose items they own as team coordinator. */ teamUserIds?: string[] };

/**
 * Rights that a membership's groups limit (Journey: a coordinator steers their own chapters, and the journeys of their team's
 * creators in any chapter). Work and review follow the item.
 */
export const GROUP_CAPABILITIES: readonly Capability[] = ['assign', 'create', 'manageFields'];

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
  /** Groups where GROUP_CAPABILITIES apply; null = every group. */
  groupKeys: ReadonlySet<string> | null;
  /** Team coordinator: GROUP_CAPABILITIES also apply to items assigned to these people (and to themselves), in any group. */
  teamUserIds?: ReadonlySet<string>;
};

export type Access = {
  userId: string;
  isAdmin: boolean;
  /** Keyed by work type key. Only work types the person can open at all. */
  byKey: Map<string, WorkTypeAccess>;
};

export function roleCapabilities(r: Pick<RoleLite, 'capWork' | 'capReview' | 'capAssign' | 'capCreate' | 'capManageFields' | 'capQa'>): Capability[] {
  const out: Capability[] = [];
  if (r.capWork) out.push('work');
  if (r.capReview) out.push('review');
  if (r.capAssign) out.push('assign');
  if (r.capCreate) out.push('create');
  if (r.capManageFields) out.push('manageFields');
  if (r.capQa) out.push('qa');
  return out;
}

export function rolePages(r: Pick<RoleLite, 'pageDashboard' | 'pageItems' | 'pageReports' | 'pageExport' | 'pageBoard'>): PageKey[] {
  const out: PageKey[] = [];
  if (r.pageDashboard) out.push('dashboard');
  if (r.pageItems) out.push('items');
  if (r.pageReports) out.push('reports');
  if (r.pageExport && r.pageReports) out.push('export');
  if (r.pageBoard) out.push('board');
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
        groupKeys: null,
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
      groupKeys: m.groupKeys?.length ? new Set(m.groupKeys) : null,
      // Their own journeys count like their team's: a steward who also creates keeps steward rights on them in any chapter.
      teamUserIds: new Set([...(m.teamUserIds ?? []), userId]),
    });
  }
  return { userId, isAdmin, byKey };
}

/**
 * The person's capabilities on an item of this group assigned to this person: outside their groups and their team they keep
 * work and review only.
 */
export function capabilitiesIn(a: Pick<WorkTypeAccess, 'capabilities' | 'groupKeys' | 'teamUserIds'>, groupKey: string | null | undefined, assigneeId?: string | null): ReadonlySet<Capability> {
  if (!a.groupKeys || (groupKey && a.groupKeys.has(groupKey))) return a.capabilities;
  if (assigneeId && a.teamUserIds?.has(assigneeId)) return a.capabilities;
  return new Set([...a.capabilities].filter(c => !GROUP_CAPABILITIES.includes(c)));
}

export function workTypesWith(access: Access, page: PageKey): WorkTypeAccess[] {
  return [...access.byKey.values()].filter(a => a.pages.has(page));
}

export function hasCapabilityAnywhere(access: Access, cap: Capability, page: PageKey = 'dashboard'): boolean {
  return workTypesWith(access, page).some(a => a.capabilities.has(cap));
}

export type ItemOwnership = { assigneeId: string | null; ownerId: string | null; createdById: string | null; developerId?: string | null };

/** OWN = assigned to me, owned (reviewed) by me, created by me, or mine to design as developer. */
export function isOwnItem(item: ItemOwnership, userId: string): boolean {
  return item.assigneeId === userId || item.ownerId === userId || item.createdById === userId || item.developerId === userId;
}

/** Whether the item is within the person's data scope. Page ticks decide where it is shown, not whether it is theirs. */
export function canSeeItem(access: Access, workTypeKey: string, item: ItemOwnership): boolean {
  const a = access.byKey.get(workTypeKey);
  if (!a) return false;
  return a.dataScope === 'ALL' || isOwnItem(item, access.userId);
}

/**
 * The Relay board. It shows only to an admin and to a person with a role that has the "Relay board" page ticked (Admin → Roles).
 * Of those, an admin, a steward, a reviewer and QA (the assign, review and qa capabilities) see every journey on it, whatever the
 * role's own data scope; anyone else sees it through their own scope. Null = no board.
 */
export function boardView(isAdmin: boolean, a: Pick<WorkTypeAccess, 'capabilities' | 'pages'> | undefined): 'all' | 'scoped' | null {
  if (isAdmin) return 'all';
  if (!a || !a.pages.has('board')) return null;
  return a.capabilities.has('assign') || a.capabilities.has('review') || a.capabilities.has('qa') ? 'all' : 'scoped';
}
