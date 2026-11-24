import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { dataSelectFields, itemsWhere } from '@/lib/items-where';
import { planRelayPeople } from '@/lib/relay-map';
import { defaultDeveloper, type TeamLite } from '@/lib/teams';
import { journeyApplet } from '@/modules/journey-applet/definition';

const now = new Date('2026-11-24T06:00:00Z');
const where = (f: Parameters<typeof itemsWhere>[1]) => (itemsWhere(journeyApplet, f, 'me', now) as { AND: unknown[] }).AND;

describe('column filters: several values at once', () => {
  it('people: any of the picked ids, and none for nobody', () => {
    expect(where({ dev: 'a' })).toEqual([{ assigneeId: { in: ['a'] } }]);
    expect(where({ dev: 'a,b' })).toEqual([{ assigneeId: { in: ['a', 'b'] } }]);
    expect(where({ dev: 'none' })).toEqual([{ assigneeId: null }]);
    expect(where({ sme: 'a,none' })).toEqual([{ OR: [{ ownerId: { in: ['a'] } }, { ownerId: null }] }]);
    expect(where({ developer: 'd', peer: 'p' })).toEqual([{ developerId: { in: ['d'] } }, { peerReviewerId: { in: ['p'] } }]);
  });
  it('chapters and grades take lists', () => {
    expect(where({ group: 'G04C05,G06C07', grade: '4,6' })).toEqual([{ groupKey: { in: ['G04C05', 'G06C07'] } }, { chapter: { grade: { in: [4, 6] } } }]);
  });
  it('a select field kept in the data filters by its options; none = not set', () => {
    const stage = dataSelectFields(journeyApplet).find(f => f.key === 'creationStage')!;
    const [a, b] = stage.options!;
    expect(where({ f_creationStage: `${a},${b}` })).toEqual([{ OR: [{ data: { path: ['creationStage'], equals: a } }, { data: { path: ['creationStage'], equals: b } }] }]);
    expect(where({ f_creationStage: 'none' })).toEqual([{ OR: [{ data: { path: ['creationStage'], equals: Prisma.AnyNull } }, { data: { path: ['creationStage'], equals: '' } }] }]);
    expect(where({ f_creationStage: 'not an option' })).toEqual([{ id: '__none__' }]);
  });
});

describe('people the relay names and the dashboard lacks', () => {
  const office = ['classrootsedu.com'];
  it('an office email is added, as creator and as steward of the chapters it owns', () => {
    const plan = planRelayPeople(['New.Person@classrootsedu.com', 'known@classrootsedu.com'], [{ code: 'G06C07', email: 'new.person@classrootsedu.com' }, { code: 'G04C05', email: 'lead@classrootsedu.com' }], e => e === 'known@classrootsedu.com', office);
    expect(plan.add).toEqual([
      { email: 'new.person@classrootsedu.com', name: 'New Person', creator: true, chapters: ['G06C07'] },
      { email: 'lead@classrootsedu.com', name: 'Lead', creator: false, chapters: ['G04C05'] },
    ]);
    expect(plan.issues).toEqual([]);
  });
  it('an outside email or a deactivated person is reported, not added', () => {
    const plan = planRelayPeople(['x@gmail.com', 'gone@classrootsedu.com', 'x@gmail.com'], [], () => false, office, new Set(['gone@classrootsedu.com']));
    expect(plan.add).toEqual([]);
    expect(plan.issues).toEqual(['x@gmail.com is not an office email: add them in People with a password', 'gone@classrootsedu.com is deactivated here']);
  });
});

describe('a team’s default developer', () => {
  const teams: TeamLite[] = [
    { id: 'd', name: 'Team Devjyoti', coordinatorId: 'dev', reviewerId: null, developerId: 'jeevan', members: [{ userId: 'vaishali', peerReviewerId: null }] },
    { id: 'a', name: 'Team Arjun', coordinatorId: 'arjun', reviewerId: null, members: [{ userId: 'kapil', peerReviewerId: null }] },
  ];
  it('is the developer of the creator’s team, for members and the steward', () => {
    expect(defaultDeveloper(teams, 'vaishali')).toBe('jeevan');
    expect(defaultDeveloper(teams, 'dev')).toBe('jeevan');
  });
  it('is nobody when the team has none or the creator has no team (least busy is picked)', () => {
    expect(defaultDeveloper(teams, 'kapil')).toBeNull();
    expect(defaultDeveloper(teams, 'stranger')).toBeNull();
    expect(defaultDeveloper(teams, null)).toBeNull();
  });
});
