import { describe, expect, it } from 'vitest';
import { buildAccess, canSeeItem, capabilitiesIn, type RoleLite } from '@/lib/access-core';
import { applyStageConfig } from '@/lib/stages';
import { actorMatches, allowedTransitions, canDeleteItem, canEditField, canGiveFeedback, hasCap, type ActorContext } from '@/lib/workflow';
import { journeyApplet as base } from '@/modules/journey-applet/definition';
import { rightsDrift, rolesForModule, templateColumns } from '@/modules/roles';

/** The Journey role matrix from the SME's brief (A4) and follow-up (5 Nov 2026), checked against the module and its roles. */
const mod = applyStageConfig(base, []);
const WT = { id: 'wt', key: 'journey-applet', name: 'Journey', state: 'ACTIVE' as const };
const template = (key: string) => rolesForModule(base).find(r => r.key === key)!;
const roleLite = (key: string): RoleLite => ({ id: key, ...templateColumns(template(key)) });

/** What `roleKeys` may do on a journey of `chapter`, as its creator, its reviewer or neither. */
function ctxFor(roleKeys: string[], rel: { assignee?: boolean; owner?: boolean; creatorId?: string } = {}, chapter = 'G04C05', groupKeys?: string[], teamUserIds?: string[]): ActorContext {
  const a = buildAccess('me', false, [WT], new Map([['wt', { roles: roleKeys.map(roleLite), groupKeys, teamUserIds }]])).byKey.get('journey-applet')!;
  return { isAdmin: false, capabilities: capabilitiesIn(a, chapter, rel.creatorId), canEdit: a.canEdit, isAssignee: Boolean(rel.assignee), isOwner: Boolean(rel.owner) };
}
const moves = (ctx: ActorContext, from: string) => allowedTransitions(mod, from, ctx).map(t => t.to);
const editable = (ctx: ActorContext) => mod.fields.filter(f => !f.computed && canEditField(f, ctx)).map(f => f.key);
const LINKS = ['cmsUrl', 'aiTutorUrl'];

describe('who sees which journeys', () => {
  it('every Journey role sees every journey (brief A4: "all")', () => {
    for (const key of ['sme-creator', 'sme-reviewer', 'coordinator', 'program-manager']) {
      const access = buildAccess('me', false, [WT], new Map([['wt', { roles: [roleLite(key)] }]]));
      expect(canSeeItem(access, 'journey-applet', { assigneeId: 'someone', ownerId: 'else', createdById: null }), key).toBe(true);
    }
  });
  it('pages: everyone gets the dashboard, list and reports; coordinators and program managers also export', () => {
    expect(template('sme-creator').pages).toEqual(['dashboard', 'items', 'reports']);
    expect(template('sme-reviewer').pages).toEqual(['dashboard', 'items', 'reports']);
    expect(template('coordinator').pages).toEqual(['dashboard', 'items', 'reports', 'export']);
    expect(template('program-manager').pages).toEqual(['dashboard', 'items', 'reports', 'export']);
  });
});

describe('SME creator', () => {
  const mine = ctxFor(['sme-creator'], { assignee: true });
  const others = ctxFor(['sme-creator']);

  it('builds and submits their own journey, makes corrections and does the last look', () => {
    expect(moves(mine, 'allocated')).toEqual(['creating']);
    expect(moves(mine, 'creating')).toEqual(['ready_for_review']);
    expect(moves(mine, 'changes_asked')).toEqual(['correction_verification']);
    expect(moves(mine, 'last_look').sort()).toEqual(['design_standardization', 'video_replacement']);
    for (const s of ['ready_for_review', 'review_in_progress', 'correction_verification', 'closed', 'video_replacement', 'user_testing_qa']) expect(moves(mine, s), s).toEqual([]);
  });
  it('edits the creation stage and links of their own journey only; pick-up is the coordinator\'s, submitted is stamped (6 Nov 2026)', () => {
    expect(editable(mine).sort()).toEqual(['creationStage', ...LINKS].sort());
    const submit = mod.transitions.find(t => t.from === 'creating' && t.to === 'ready_for_review')!;
    expect(submit.stamp).toEqual(['submittedAt']);
    expect(mod.transitions.find(t => t.from === 'allocated' && t.to === 'creating')!.stamp).toEqual(['pickedUpAt']);
    expect(editable(others)).toEqual([]);
    expect(moves(others, 'creating')).toEqual([]);
  });
  it('cannot assign, add or delete', () => {
    expect(hasCap(mine, 'assign') || hasCap(mine, 'create') || canDeleteItem(mine)).toBe(false);
  });
});

describe('SME reviewer', () => {
  const mine = ctxFor(['sme-reviewer'], { owner: true });
  const others = ctxFor(['sme-reviewer']);

  it('reviews only the journeys they are the reviewer of', () => {
    expect(moves(mine, 'ready_for_review')).toEqual(['review_in_progress']);
    expect(moves(mine, 'review_in_progress').sort()).toEqual(['changes_asked', 'closed']);
    expect(moves(mine, 'correction_verification').sort()).toEqual(['changes_asked', 'closed']);
    expect(moves(mine, 'creating')).toEqual([]);
    expect(moves(others, 'ready_for_review')).toEqual([]);
  });
  it('gives feedback only on the journeys they review (brief A8)', () => {
    expect(canGiveFeedback(mod, mine)).toBe(true);
    expect(canGiveFeedback(mod, others)).toBe(false);
    expect(canGiveFeedback(mod, ctxFor(['sme-creator'], { assignee: true }))).toBe(false);
  });
  it('edits the review date and links of their journeys, not the creation stage or the creation dates', () => {
    expect(editable(mine).sort()).toEqual(['reviewDate', ...LINKS].sort());
    expect(editable(others)).toEqual([]);
  });
});

describe('Coordinator', () => {
  const inChapter = ctxFor(['coordinator'], {}, 'G04C05', ['G04C05']);
  const otherChapter = ctxFor(['coordinator'], {}, 'G05C02', ['G04C05']);

  it('in their chapter: assigns, adds, edits every detail, deletes', () => {
    expect([hasCap(inChapter, 'assign'), hasCap(inChapter, 'create'), canDeleteItem(inChapter)]).toEqual([true, true, true]);
    expect(editable(inChapter).sort()).toEqual(['creationStage', 'needsVideoReplacement', 'pickedUpAt', 'pickedUpHalf', 'reviewDate', ...LINKS].sort());
  });
  it('nobody but an admin types the submitted date, and the Applet build link is gone', () => {
    const admin: ActorContext = { isAdmin: true, capabilities: new Set(), canEdit: true, isAssignee: false };
    expect(editable(admin)).toContain('submittedAt');
    expect(mod.fields.some(f => f.key === 'buildUrl')).toBe(false);
  });
  it('owns the journeys of their team in any chapter: assigns, edits, moves the after-steps', () => {
    const teamJourney = ctxFor(['coordinator'], { creatorId: 'kapil' }, 'G05C02', ['G04C05'], ['kapil']);
    expect([hasCap(teamJourney, 'assign'), canDeleteItem(teamJourney)]).toEqual([true, true]);
    expect(editable(teamJourney)).toContain('pickedUpAt');
    expect(moves(teamJourney, 'closed')).toEqual(['design_standardization']);
    const notTheirs = ctxFor(['coordinator'], { creatorId: 'vaishali' }, 'G05C02', ['G04C05'], ['kapil']);
    expect(hasCap(notTheirs, 'assign')).toBe(false);
  });
  it('moves the after-steps (not the last look) and sends a journey back from QA with feedback', () => {
    expect(moves(inChapter, 'closed')).toEqual(['design_standardization']);
    expect(moves(inChapter, 'design_standardization')).toEqual(['last_look']); // a coordinator may also press Design done (the developer does by default)
    expect(moves(inChapter, 'last_look')).toEqual([]);
    expect(moves(inChapter, 'video_replacement')).toEqual(['uat_to_prod']);
    expect(moves(inChapter, 'uat_to_prod')).toEqual(['published_prod']);
    expect(moves(inChapter, 'published_prod')).toEqual(['user_testing_qa']);
    expect(moves(inChapter, 'user_testing_qa').sort()).toEqual(['changes_asked', 'done']);
    expect(moves(inChapter, 'ready_for_review')).toEqual([]);
  });
  it('outside their chapter: looks only', () => {
    expect([hasCap(otherChapter, 'assign'), hasCap(otherChapter, 'create'), canDeleteItem(otherChapter)]).toEqual([false, false, false]);
    expect(editable(otherChapter)).toEqual([]);
    expect(moves(otherChapter, 'closed')).toEqual([]);
  });
  it('a coordinator who also reviews keeps reviewing in other chapters', () => {
    const arjun = ctxFor(['coordinator', 'sme-reviewer', 'sme-creator'], { owner: true }, 'G05C02', ['G04C05']);
    expect(moves(arjun, 'ready_for_review')).toEqual(['review_in_progress']);
    expect(hasCap(arjun, 'assign')).toBe(false);
  });
});

describe('Program manager', () => {
  const pm = ctxFor(['program-manager']);
  it('watches only: no moves, no edits, no comments', () => {
    expect(pm.canEdit).toBe(false);
    for (const s of mod.statuses) expect(moves(pm, s.key), s.key).toEqual([]);
    expect(editable(pm)).toEqual([]);
    expect(canDeleteItem(pm)).toBe(false);
  });
});

describe('built-in roles vs the flow', () => {
  it('reports what an old saved role is missing', () => {
    const saved = { ...templateColumns(template('coordinator')), capManageFields: false };
    expect(rightsDrift(saved, template('coordinator'))).toEqual(['edit details']);
    expect(rightsDrift({ ...templateColumns(template('sme-creator')), dataScope: 'OWN' }, template('sme-creator'))).toEqual(['which items they see']);
    expect(rightsDrift(templateColumns(template('sme-reviewer')), template('sme-reviewer'))).toEqual([]);
  });
});

describe('developer', () => {
  it('has a Developer role that can make changes and is the design-check actor', () => {
    const dev = base.roles?.find(r => r.key === 'developer');
    expect(dev?.canEdit).toBe(true);
    expect(base.developerHandoff).toEqual({ after: 'closed', role: 'developer', label: 'Developer' });
    const design = base.statuses.find(s => s.key === 'design_standardization');
    expect(design?.state).not.toBe('paused');
    expect(design?.next?.by).toContain('DEVELOPER');
  });
  it('lets the item’s developer, and only them among editors, press Design done', () => {
    const base = { isAdmin: false, capabilities: new Set<never>(), isAssignee: false, canEdit: true };
    expect(actorMatches(['DEVELOPER', 'assign'], { ...base, isDeveloper: true })).toBe(true);
    expect(actorMatches(['DEVELOPER', 'assign'], { ...base, isDeveloper: false })).toBe(false);
    expect(actorMatches(['DEVELOPER'], { ...base, isDeveloper: true, canEdit: false })).toBe(false);
  });
});
