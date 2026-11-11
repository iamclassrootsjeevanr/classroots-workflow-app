import { describe, expect, it } from 'vitest';
import { capabilitiesIn, buildAccess, type RoleLite } from '@/lib/access-core';
import { itemsWhere } from '@/lib/items-where';
import { coordinatedPeople, nextDefault, reviewDefaults, teamOf, teamPeople, type TeamLite } from '@/lib/teams';
import { journeyApplet } from '@/modules/journey-applet/definition';
import { rolesForModule, templateColumns } from '@/modules/roles';

/** Team structure from the SME (6 Nov 2026): the coordinator reviews by default, buddies peer-review each other. */
const teams: TeamLite[] = [
  { id: 'a', name: 'Team A', coordinatorId: 'arjun', reviewerId: null, members: [{ userId: 'kapil', peerReviewerId: 'animesh' }, { userId: 'animesh', peerReviewerId: 'kapil' }, { userId: 'preethi', peerReviewerId: null }] },
  { id: 'd', name: 'Team D', coordinatorId: 'dev', reviewerId: 'aswin', members: [{ userId: 'vaishali', peerReviewerId: 'divyanshu' }] },
];

describe('journey-level ownership', () => {
  it('a journey belongs to the coordinator of its creator’s team, who reviews it by default; the buddy peer-reviews', () => {
    expect(reviewDefaults(teams, 'kapil')).toMatchObject({ accountableId: 'arjun', reviewerId: 'arjun', peerReviewerId: 'animesh' });
    expect(reviewDefaults(teams, 'preethi')).toMatchObject({ accountableId: 'arjun', reviewerId: 'arjun', peerReviewerId: null });
  });
  it('the team’s default reviewer can be someone else while the coordinator is away; ownership stays', () => {
    expect(reviewDefaults(teams, 'vaishali')).toMatchObject({ accountableId: 'dev', reviewerId: 'aswin', peerReviewerId: 'divyanshu' });
  });
  it('a coordinator owns their own journeys but does not review them; people outside teams have no defaults', () => {
    expect(reviewDefaults(teams, 'arjun')).toMatchObject({ accountableId: 'arjun', reviewerId: null });
    expect(reviewDefaults(teams, 'someone')).toEqual({ team: null, accountableId: null, reviewerId: null, peerReviewerId: null });
    expect(reviewDefaults(teams, null).team).toBeNull();
  });
  it('team people = members and coordinator; a coordinator’s people = their members', () => {
    expect(teamOf(teams, 'dev')?.id).toBe('d');
    expect(teamPeople(teams[1]).sort()).toEqual(['dev', 'vaishali']);
    expect(coordinatedPeople(teams, 'arjun').sort()).toEqual(['animesh', 'kapil', 'preethi']);
    expect(coordinatedPeople(teams, 'kapil')).toEqual([]);
  });
});

describe('when a default changes', () => {
  it('fills an empty slot and replaces the old default, but keeps a reviewer picked by hand', () => {
    expect(nextDefault(null, null, 'arjun')).toBe('arjun');
    expect(nextDefault('arjun', 'arjun', 'aswin')).toBe('aswin');
    expect(nextDefault('kishor', 'arjun', 'aswin')).toBeUndefined();
  });
  it('never clears a slot and does nothing when it is already right', () => {
    expect(nextDefault('arjun', 'arjun', null)).toBeUndefined();
    expect(nextDefault('aswin', 'arjun', 'aswin')).toBeUndefined();
  });
});

describe('coordinator rights follow the team', () => {
  const template = rolesForModule(journeyApplet).find(r => r.key === 'coordinator')!;
  const role: RoleLite = { id: 'c', ...templateColumns(template) };
  const WT = { id: 'wt', key: 'journey-applet', name: 'Journey', state: 'ACTIVE' as const };
  const a = buildAccess('arjun', false, [WT], new Map([['wt', { roles: [role], groupKeys: ['G04C05'], teamUserIds: ['kapil'] }]])).byKey.get('journey-applet')!;

  it('in another chapter: full rights on a team member’s journey, none on anyone else’s or an unassigned one', () => {
    expect(capabilitiesIn(a, 'G05C02', 'kapil').has('assign')).toBe(true);
    expect(capabilitiesIn(a, 'G05C02', 'vaishali').has('assign')).toBe(false);
    expect(capabilitiesIn(a, 'G05C02', null).has('assign')).toBe(false);
    expect(capabilitiesIn(a, 'G04C05', 'vaishali').has('assign')).toBe(true);
  });
});

describe('journeys list: team filters', () => {
  const now = new Date('2026-11-06T06:00:00Z');
  it('team = journeys of that team’s people; an unknown team matches nothing', () => {
    expect(itemsWhere(journeyApplet, { team: 'd' }, 'x', now, teams)).toEqual({ AND: [{ assigneeId: { in: ['dev', 'vaishali'] } }] });
    expect(itemsWhere(journeyApplet, { team: 'zz' }, 'x', now, teams)).toEqual({ AND: [{ id: '__none__' }] });
  });
  it('My team = the team I coordinate, or the one I am in', () => {
    const w = itemsWhere(journeyApplet, { scope: 'team' }, 'arjun', now, teams) as { AND: { assigneeId: { in: string[] } }[] };
    expect(w.AND[0].assigneeId.in.sort()).toEqual(['animesh', 'arjun', 'kapil', 'preethi']);
    expect(itemsWhere(journeyApplet, { scope: 'team' }, 'vaishali', now, teams)).toEqual({ AND: [{ assigneeId: { in: ['dev', 'vaishali'] } }] });
    expect(itemsWhere(journeyApplet, { scope: 'team' }, 'nobody', now, teams)).toEqual({ AND: [{ id: '__none__' }] });
  });
  it('Mine includes the journeys I peer-review', () => {
    expect(itemsWhere(journeyApplet, { scope: 'mine' }, 'u', now)).toEqual({ AND: [{ OR: [{ assigneeId: 'u' }, { ownerId: 'u' }, { peerReviewerId: 'u' }] }] });
  });
});
