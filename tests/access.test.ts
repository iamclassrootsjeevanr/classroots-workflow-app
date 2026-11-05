import { describe, expect, it } from 'vitest';
import { buildAccess, canSeeItem, capabilitiesIn, hasCapabilityAnywhere, workTypesWith, type MembershipLite, type RoleLite, type WorkTypeLite } from '@/lib/access-core';

const role = (name: string, over: Partial<RoleLite> = {}): RoleLite => ({
  id: name,
  name,
  color: '#000',
  capWork: false,
  capReview: false,
  capAssign: false,
  capCreate: false,
  capManageFields: false,
  dataScope: 'OWN',
  canEdit: true,
  pageDashboard: true,
  pageItems: true,
  pageReports: false,
  pageExport: false,
  ...over,
});
const developer = role('Developer', { capWork: true });
const reviewer = role('Reviewer', { capReview: true, capManageFields: true, dataScope: 'ALL', pageReports: true });
const viewer = role('Viewer', { dataScope: 'ALL', canEdit: false, pageReports: true });
const exporter = role('Exporter', { canEdit: false, pageDashboard: false, pageItems: false, pageReports: true, pageExport: true });

const journeys: WorkTypeLite = { id: 'wt1', key: 'journey-applet', name: 'Journey', state: 'ACTIVE' };
const content: WorkTypeLite = { id: 'wt2', key: 'content', name: 'Content', state: 'ACTIVE' };
const paused: WorkTypeLite = { id: 'wt3', key: 'paused', name: 'Paused', state: 'PAUSED' };
const archived: WorkTypeLite = { id: 'wt4', key: 'old', name: 'Old', state: 'ARCHIVED' };
const all = [journeys, content, paused, archived];

const member = (...roles: RoleLite[]): MembershipLite => ({ roles: roles.length ? roles : [developer] });

describe('access map', () => {
  it('gives admins every non-archived work type with everything', () => {
    const a = buildAccess('u', true, all, new Map());
    expect([...a.byKey.keys()]).toEqual(['journey-applet', 'content', 'paused']);
    const j = a.byKey.get('journey-applet')!;
    expect(j.dataScope).toBe('ALL');
    expect(j.canEdit).toBe(true);
    expect([...j.pages]).toEqual(['dashboard', 'items', 'reports', 'export']);
  });

  it('only includes ticked, active work types for members', () => {
    const a = buildAccess('u', false, all, new Map([['wt1', member()], ['wt3', member()]]));
    expect([...a.byKey.keys()]).toEqual(['journey-applet']);
  });

  it('adds up several roles: capabilities, widest data scope, edit if any, union of pages', () => {
    const a = buildAccess('u', false, all, new Map([['wt1', member(developer, reviewer)]]));
    const j = a.byKey.get('journey-applet')!;
    expect([...j.capabilities].sort()).toEqual(['manageFields', 'review', 'work']);
    expect(j.dataScope).toBe('ALL');
    expect(j.canEdit).toBe(true);
    expect([...j.pages].sort()).toEqual(['dashboard', 'items', 'reports']);
    expect(hasCapabilityAnywhere(a, 'review')).toBe(true);
    const v = buildAccess('u', false, all, new Map([['wt1', member(viewer, exporter)]])).byKey.get('journey-applet')!;
    expect(v.canEdit).toBe(false);
    expect([...v.pages].sort()).toEqual(['dashboard', 'export', 'items', 'reports']);
  });

  it('different access per work type', () => {
    const a = buildAccess(
      'u',
      false,
      all,
      new Map([
        ['wt1', member(developer)],
        ['wt2', member(viewer, exporter)],
      ]),
    );
    expect(a.byKey.get('journey-applet')!.dataScope).toBe('OWN');
    expect(a.byKey.get('content')!.canEdit).toBe(false);
    expect(workTypesWith(a, 'reports').map(t => t.workTypeKey)).toEqual(['content']);
    expect(workTypesWith(a, 'export').map(t => t.workTypeKey)).toEqual(['content']);
  });

  it('export needs reports too; no pages means no access', () => {
    const a = buildAccess(
      'u',
      false,
      all,
      new Map([
        ['wt1', member(role('Odd', { pageExport: true, pageReports: false }))],
        ['wt2', member(role('Blank', { pageDashboard: false, pageItems: false }))],
      ]),
    );
    expect(workTypesWith(a, 'export')).toEqual([]);
    expect(a.byKey.has('content')).toBe(false);
  });
});

describe('own vs all data', () => {
  const access = buildAccess('me', false, all, new Map([['wt1', member(developer)], ['wt2', member(reviewer)]]));
  const others = { assigneeId: 'x', ownerId: 'y', createdById: 'z' };

  it('own scope sees assigned, owned or created items only', () => {
    expect(canSeeItem(access, 'journey-applet', { ...others, assigneeId: 'me' })).toBe(true);
    expect(canSeeItem(access, 'journey-applet', { ...others, ownerId: 'me' })).toBe(true);
    expect(canSeeItem(access, 'journey-applet', { ...others, createdById: 'me' })).toBe(true);
    expect(canSeeItem(access, 'journey-applet', others)).toBe(false);
  });

  it('data scope is independent of which pages are ticked', () => {
    const dashOnly = buildAccess('me', false, all, new Map([['wt1', member(role('DashOnly', { pageItems: false }))]]));
    expect(canSeeItem(dashOnly, 'journey-applet', { ...others, assigneeId: 'me' })).toBe(true);
    expect(workTypesWith(dashOnly, 'items')).toEqual([]);
  });

  it('all scope sees everything; no access sees nothing', () => {
    expect(canSeeItem(access, 'content', others)).toBe(true);
    expect(canSeeItem(access, 'paused', { ...others, assigneeId: 'me' })).toBe(false);
  });
});

describe('coordinators limited to their own chapters', () => {
  const coordinator = role('Coordinator', { capAssign: true, capCreate: true, capManageFields: true, capReview: true, capWork: true, dataScope: 'ALL' });

  it('keeps assign, add and edit rights inside their chapters only; work and review follow the item', () => {
    const a = buildAccess('u', false, all, new Map([['wt1', { roles: [coordinator], groupKeys: ['G04C05'] }]])).byKey.get('journey-applet')!;
    expect([...capabilitiesIn(a, 'G04C05')].sort()).toEqual(['assign', 'create', 'manageFields', 'review', 'work']);
    expect([...capabilitiesIn(a, 'G05C02')].sort()).toEqual(['review', 'work']);
    expect([...capabilitiesIn(a, null)].sort()).toEqual(['review', 'work']);
  });

  it('no chapters ticked, or an admin, means every chapter', () => {
    const open = buildAccess('u', false, all, new Map([['wt1', { roles: [coordinator], groupKeys: [] }]])).byKey.get('journey-applet')!;
    expect(open.groupKeys).toBeNull();
    expect(capabilitiesIn(open, 'G05C02').has('assign')).toBe(true);
    const admin = buildAccess('u', true, all, new Map()).byKey.get('journey-applet')!;
    expect(capabilitiesIn(admin, 'G05C02').has('assign')).toBe(true);
  });
});
