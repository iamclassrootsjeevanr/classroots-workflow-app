import { describe, expect, it } from 'vitest';
import { boardView, buildAccess, canSeeItem, capabilitiesIn, type RoleLite } from '@/lib/access-core';
import { canChangePassword } from '@/lib/invite';
import { workTypeTabs } from '@/lib/work-type-tabs';
import { applyStageConfig, landingStage, stageAfterOwnCheck } from '@/lib/stages';
import { canChat, writerRole, writerRoleLabel } from '@/lib/feedback';
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
    expect(template('sme-reviewer').pages).toEqual(['dashboard', 'items', 'reports', 'board']);
    expect(template('coordinator').pages).toEqual(['dashboard', 'items', 'reports', 'export', 'board']);
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
    expect(moves(mine, 'last_look').sort()).toEqual(['design_check', 'design_standardization']);
    expect(moves(mine, 'design_check')).toEqual([]);
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
  it('does the last look of the journeys they review, or sends it back to design (24 Nov 2026)', () => {
    expect(moves(mine, 'last_look').sort()).toEqual(['design_check', 'design_standardization']);
    expect(allowedTransitions(mod, 'last_look', mine).find(t => t.to === 'design_standardization')?.requires).toBe('feedback');
    expect(moves(others, 'last_look')).toEqual([]);
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
    expect(editable(inChapter).sort()).toEqual(['appletFixes', 'creationStage', 'fixReviewUrl', 'needsVideoReplacement', 'pickedUpAt', 'pickedUpHalf', 'reviewDate', ...LINKS].sort());
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
  it('moves the after-steps, the last look too, and sends a journey back from QA with feedback', () => {
    expect(moves(inChapter, 'closed')).toEqual(['design_standardization']);
    expect(moves(inChapter, 'design_standardization')).toEqual(['last_look']); // a coordinator may also press Design done (the developer does by default)
    expect(moves(inChapter, 'last_look').sort()).toEqual(['design_check', 'design_standardization']); // 24 Nov 2026: a steward can do the last look
    expect(moves(otherChapter, 'last_look')).toEqual([]); // not outside their chapters and teams
    expect(moves(inChapter, 'design_check').sort()).toEqual(['design_standardization', 'video_replacement']); // the steward checks the design with the reviewer
    expect(moves(inChapter, 'video_replacement')).toEqual(['uat_to_prod']);
    expect(moves(inChapter, 'uat_to_prod')).toEqual(['published_prod']);
    expect(moves(inChapter, 'published_prod')).toEqual(['user_testing_qa']);
    expect(moves(inChapter, 'user_testing_qa').sort()).toEqual(['changes_asked', 'design_standardization', 'done']); // 26 Nov 2026: QA sends to the creator or the developer
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
  it('sees only the journeys assigned to them as developer', () => {
    const dev = base.roles!.find(r => r.key === 'developer')!;
    expect(dev.dataScope).toBe('OWN');
    const access = buildAccess('me', false, [WT], new Map([['wt', { roles: [roleLite('developer')] }]]));
    const item = { assigneeId: 'kapil', ownerId: 'arjun', createdById: null };
    expect(canSeeItem(access, 'journey-applet', { ...item, developerId: 'me' })).toBe(true);
    expect(canSeeItem(access, 'journey-applet', { ...item, developerId: 'someone' })).toBe(false);
    expect(canSeeItem(access, 'journey-applet', item)).toBe(false);
  });
  it('lets the item’s developer, and only them among editors, press Design done', () => {
    const base = { isAdmin: false, capabilities: new Set<never>(), isAssignee: false, canEdit: true };
    expect(actorMatches(['DEVELOPER', 'assign'], { ...base, isDeveloper: true })).toBe(true);
    expect(actorMatches(['DEVELOPER', 'assign'], { ...base, isDeveloper: false })).toBe(false);
    expect(actorMatches(['DEVELOPER'], { ...base, isDeveloper: true, canEdit: false })).toBe(false);
  });
});

describe('developer stage window', () => {
  const hand = { after: 'closed' };
  it('is open only in design standardization, and not when that stage is paused', async () => {
    const { developerStage } = await import('@/lib/stages');
    expect(developerStage(base.statuses, hand, 'design_standardization')).toMatchObject({ stage: 'design_standardization', open: true });
    expect(developerStage(base.statuses, hand, 'closed').open).toBe(false);
    expect(developerStage(base.statuses, hand, 'last_look').open).toBe(false);
    const paused = base.statuses.map(s => (s.key === 'design_standardization' ? { ...s, state: 'paused' as const } : s));
    expect(developerStage(paused, hand, 'design_standardization')).toMatchObject({ paused: true, open: false });
  });
});

describe('design loop', () => {
  const creator = ctxFor(['sme-creator'], { assignee: true });
  const developer = { ...ctxFor(['developer']), isDeveloper: true };
  it('the creator sends a journey back from the last look with feedback; the developer cannot', () => {
    const back = allowedTransitions(mod, 'last_look', creator).find(t => t.to === 'design_standardization');
    expect(back?.requires).toBe('feedback');
    expect(moves(developer, 'last_look')).toEqual([]);
  });
  it('the developer presses Design done to send it to the creator again', () => {
    expect(moves(developer, 'design_standardization')).toEqual(['last_look']);
  });
});

describe('the last look by three roles (24 Nov 2026)', () => {
  const creator = ctxFor(['sme-creator'], { assignee: true });
  const reviewer = ctxFor(['sme-reviewer'], { owner: true });
  const steward = ctxFor(['coordinator'], {}, 'G04C05', ['G04C05']);
  const teamSteward = ctxFor(['coordinator'], { creatorId: 'kapil' }, 'G05C02', ['G04C05'], ['kapil']);
  const stewardElsewhere = ctxFor(['coordinator'], {}, 'G05C02', ['G04C05']);
  const admin: ActorContext = { isAdmin: true, capabilities: new Set(), canEdit: true, isAssignee: false };
  const after = (ctx: ActorContext | null, from = 'last_look', to = 'design_check') => stageAfterOwnCheck(mod.statuses, from, to, to, ctx ? by => actorMatches(by, ctx) : null);

  it('the creator, the SME reviewer and a steward who can act on the journey can press Last look done', () => {
    for (const ctx of [creator, reviewer, steward, teamSteward]) expect(moves(ctx, 'last_look')).toContain('design_check');
    expect(moves(stewardElsewhere, 'last_look')).toEqual([]);
    expect(moves(ctxFor(['developer']), 'last_look')).toEqual([]);
  });
  it('Design check still runs after the creator, and is done with the last look of the SME reviewer or a steward', () => {
    expect(after(creator)).toBeUndefined();
    expect(after(reviewer)).toBe('video_replacement');
    expect(after(steward)).toBe('video_replacement');
    expect(after(teamSteward)).toBe('video_replacement');
    expect(after(admin)).toBe('video_replacement');
    expect(after(null)).toBeUndefined(); // a change the system made (the relay, an import)
  });
  it('only for the move out of the last look, and only into a stage marked so', () => {
    expect(after(admin, 'design_standardization', 'design_check')).toBeUndefined(); // an admin setting Design check from elsewhere
    expect(stageAfterOwnCheck(mod.statuses, 'design_check', 'video_replacement', 'video_replacement', () => true)).toBeUndefined();
    expect(mod.statuses.filter(s => s.passedByMover).map(s => s.key)).toEqual(['design_check']);
  });
  it('the SME reviewer and a steward who can act on the journey give feedback to the creator', () => {
    expect(canGiveFeedback(mod, reviewer)).toBe(true);
    expect(canGiveFeedback(mod, steward)).toBe(true);
    expect(canGiveFeedback(mod, teamSteward)).toBe(true);
    expect(canGiveFeedback(mod, stewardElsewhere)).toBe(false);
    expect(canGiveFeedback(mod, creator)).toBe(false);
    expect(canGiveFeedback(mod, ctxFor(['sme-reviewer']))).toBe(false);
  });
  it('a steward does not press the review buttons', () => {
    for (const from of ['ready_for_review', 'review_in_progress', 'correction_verification']) expect(moves(steward, from), from).toEqual([]);
  });
  it('a ticket says who wrote it', () => {
    expect([writerRole(reviewer), writerRole(creator), writerRole(steward), writerRole(admin), writerRole(null), writerRole(stewardElsewhere)]).toEqual(['reviewer', 'creator', 'steward', 'admin', 'system', 'member']);
    expect(writerRole({ ...steward, isOwner: true })).toBe('reviewer'); // a steward who is the journey's reviewer writes as its reviewer
    expect([writerRoleLabel('reviewer', base), writerRoleLabel('steward', base), writerRoleLabel('creator', base), writerRoleLabel('developer', base)]).toEqual(['SME reviewer', 'Steward', 'SME creator', 'Developer']);
  });
});

describe('QA (26 Nov 2026)', () => {
  const qa = ctxFor(['qa']);
  const at = (from: string) => allowedTransitions(mod, from, qa);

  it('acts at User testing and QA only: marks done, or sends back with a ticket to the creator or the developer', () => {
    expect(hasCap(qa, 'qa')).toBe(true);
    expect(moves(qa, 'user_testing_qa').sort()).toEqual(['changes_asked', 'design_standardization', 'done']);
    expect(at('user_testing_qa').filter(t => t.requires === 'feedback').map(t => [t.label, t.to])).toEqual([
      ['Send to creator', 'changes_asked'],
      ['Send to developer', 'design_standardization'],
    ]);
    for (const s of mod.statuses.map(x => x.key).filter(k => k !== 'user_testing_qa')) expect(moves(qa, s), s).toEqual([]);
    expect(editable(qa)).toEqual([]);
  });
  it('writes a ticket as QA and can chat', () => {
    expect(writerRole(qa)).toBe('qa');
    expect(writerRoleLabel('qa', base)).toBe('QA');
    expect(canChat(qa)).toBe(true);
    expect(canChat(ctxFor(['program-manager']))).toBe(false);
  });
  it('a creator fix after QA goes to prod again: the review handoff and the design steps are not repeated', () => {
    const toCreator = at('user_testing_qa').find(t => t.to === 'changes_asked')!;
    expect(toCreator.set).toEqual({ qaFix: 'Yes' });
    // Close review from correction verification aims at Closed; with the mark it lands at the migration.
    expect(landingStage(mod.statuses, 'closed', { qaFix: 'Yes', needsVideoReplacement: 'Yes' })).toBe('uat_to_prod');
    expect(landingStage(mod.statuses, 'closed', {})).toBe('closed');
    expect(mod.statuses.find(s => s.key === 'uat_to_prod')!.clears).toEqual(['qaFix']);
  });
  it('a developer fix after QA walks the design steps, then prod', () => {
    const toDeveloper = at('user_testing_qa').find(t => t.to === 'design_standardization')!;
    expect(toDeveloper.set).toBeUndefined();
    expect(landingStage(mod.statuses, 'design_standardization', {})).toBe('design_standardization');
    expect(landingStage(mod.statuses, 'video_replacement', { needsVideoReplacement: 'No' })).toBe('uat_to_prod');
  });
  it('the moves that settle a stage are marked: open tickets are closed with them', () => {
    const settling = mod.transitions.filter(t => t.settles).map(t => `${t.from} → ${t.to}`).sort();
    expect(settling).toEqual(['correction_verification → closed', 'design_check → video_replacement', 'last_look → design_check', 'review_in_progress → closed', 'user_testing_qa → done']);
    // The fixer's hand-backs are not: the ticket's writer still has to look.
    for (const [from, to] of [['changes_asked', 'correction_verification'], ['design_standardization', 'last_look']]) expect(mod.transitions.find(t => t.from === from && t.to === to)!.settles, from).toBeUndefined();
  });
});

describe('the Relay board (27 Nov 2026: a page a role opts into)', () => {
  const accessOf = (keys: string[]) => buildAccess('me', false, [WT], new Map([['wt', { roles: keys.map(roleLite) }]])).byKey.get('journey-applet');

  it('shows only to an admin and to a role with the Relay board page ticked', () => {
    expect(rolesForModule(base).filter(r => r.pages.includes('board')).map(r => r.key).sort()).toEqual(['coordinator', 'qa', 'sme-reviewer']);
    for (const key of ['developer', 'sme-creator', 'program-manager']) expect(boardView(false, accessOf([key])), key).toBeNull();
    expect(boardView(false, undefined)).toBeNull();
    expect(boardView(true, undefined)).toBe('all');
  });
  it('a steward, a reviewer and QA see every journey on it', () => {
    for (const key of ['coordinator', 'sme-reviewer', 'qa']) expect(boardView(false, accessOf([key])), key).toBe('all');
    // A second role does not take it away: a developer who is also a reviewer keeps the board.
    expect(boardView(false, accessOf(['developer', 'sme-reviewer']))).toBe('all');
  });
  it('a role an admin ticks it for sees it through its own data scope', () => {
    const ticked: RoleLite = { ...roleLite('developer'), pageBoard: true };
    const a = buildAccess('me', false, [WT], new Map([['wt', { roles: [ticked] }]])).byKey.get('journey-applet');
    expect(boardView(false, a)).toBe('scoped');
  });
  it('is the last tab, after Feedback', () => {
    const tabs = workTypeTabs(base, { board: true, feedback: true }).map(t => t.label);
    expect(tabs.slice(-2)).toEqual(['Feedback', 'Relay board']);
    expect(workTypeTabs(base, { board: false, feedback: true }).map(t => t.label).at(-1)).toBe('Feedback');
  });
  it('the tick is one of the rights a saved role is compared on', () => {
    const saved = { ...templateColumns(template('coordinator')), pageBoard: false };
    expect(rightsDrift(saved, template('coordinator'))).toEqual(['Relay board page']);
  });
});

describe('changing a password in the app', () => {
  const office = ['classrootsedu.com'];
  it('is for a person who signs in with one: an email outside the office domains', () => {
    expect(canChangePassword({ email: 'someone@gmail.com', googleEnabled: true, officeDomains: office })).toBe(true);
    expect(canChangePassword({ email: 'arjun@classrootsedu.com', googleEnabled: true, officeDomains: office })).toBe(false);
  });
  it('is for everyone while Google sign-in is not set up', () => {
    expect(canChangePassword({ email: 'arjun@classrootsedu.com', googleEnabled: false, officeDomains: office })).toBe(true);
    expect(canChangePassword({ email: null, googleEnabled: true, officeDomains: office })).toBe(true);
  });
});

