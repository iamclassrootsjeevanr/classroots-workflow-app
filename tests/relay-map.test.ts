import { describe, expect, it } from 'vitest';
import { approvalLabel, creationStageOfRelay, currentCreationStage, parseAllocations, parseChapterStewards, parseStatus, parseStatusMeta, nameFromEmail, planStewards, planTeams, relayHolderWins, teamForRelayName } from '@/lib/relay-map';

describe('relay allocations', () => {
  it('keeps journeys, normalises keys and emails, drops chapters and subtopics', () => {
    const rows = parseAllocations({
      allocations: [
        { key: 'G04C05ST1J1_halves', level: 'journey', email: 'Kapil@ClassrootsEdu.com' },
        { key: 'G04C05ST1', level: 'subtopic', email: 'a@classrootsedu.com' },
        { key: 'G04C05', level: 'chapter', email: 'a@classrootsedu.com' },
        { key: 'G07P1C03ST2J1', person: 'arjun@classrootsedu.com' },
        { key: 'sim:123e4567', level: 'journey' },
        { key: 'G05C02ST1J1', level: 'journey', held_by: 'Not an email' },
      ],
    });
    expect(rows.map(r => r.key)).toEqual(['G04C05ST1J1', 'G05C02ST1J1', 'G07P1C03ST2J1']);
    expect(rows[0].email).toBe('kapil@classrootsedu.com');
    expect(rows[1].email).toBeNull();
    expect(parseAllocations(null)).toEqual([]);
  });
});

describe('relay status', () => {
  const reply = {
    approvals: [
      { id: 'human-approve-05-spine', what: 'spine', version: 3, who: 'Kapil', when: '2026-10-22T10:14:00+05:30', event_id: 'a1' },
      { id: 'human-approve-06-storyboard', what: 'storyboard', version: 4, who: 'Kapil', when: '2026-10-25T10:00:00+05:30', event_id: 'a2' },
    ],
    events: [{ kind: 'step', stage: '3b', version: 4, what: 'script written', when: '2026-10-24T09:00:00+05:30', event_id: 's1' }],
    withdrawn: [{ event_id: 'a2', withdrawn_by: { at: '2026-10-26T09:00:00+05:30', key: 'G04C05ST1J1', stage: '3a' } }],
    reopens: [{ event_id: 'r1', key: 'G04C05ST1J1', stage: '3a', version: 5, why: 'spine changed', at: '2026-10-26T09:00:00+05:30', decided_by: 'Arjun' }],
  };
  it('orders events and marks withdrawn approvals', () => {
    const ev = parseStatus(reply);
    expect(ev.map(e => e.eventId)).toEqual(['a1', 's1', 'a2', 'r1']);
    expect(ev.find(e => e.eventId === 'a2')?.withdrawn).toBe(true);
    expect(ev.find(e => e.eventId === 'a1')?.approval).toBe('human-approve-05-spine');
  });
  it('the Creation stage is the latest event that still counts; a reopen sets its stage', () => {
    expect(currentCreationStage(parseStatus(reply)).stage).toBe('3a · Spine');
    expect(currentCreationStage(parseStatus({ ...reply, reopens: [] })).stage).toBe('3b · Script'); // withdrawn spine/storyboard approval ignored
    expect(currentCreationStage([])).toEqual({ stage: null, at: null });
    expect(currentCreationStage(parseStatus({ events: [{ stage: '0', when: '2026-10-01T00:00:00Z', event_id: 'z' }] })).stage).toBeNull();
  });
  it('maps relay stages and labels approvals', () => {
    expect(['3a', '3b', '4', '5', '0', 'x'].map(creationStageOfRelay)).toEqual(['3a · Spine', '3b · Script', '4 · Build', '5 · Ship', null, null]);
    expect(approvalLabel('human-approve-05-spine')).toBe('Spine');
    expect(approvalLabel('human-approve-13')).toBe('Played in UAT');
    expect(approvalLabel(null)).toBe('');
  });
});

describe('the live relay shapes', () => {
  it('reads the holder from `owner`', () => {
    expect(parseAllocations({ allocations: [{ key: 'G04C05ST1J1', level: 'journey', owner: 'Kapil@classrootsedu.com', team: 'Team Arjun' }] })[0].email).toBe('kapil@classrootsedu.com');
  });
  it('takes the stage the relay computes, its approvals (at/approver), null-id reopens and publish history', () => {
    const reply = {
      stage: '5',
      last_step: { at: '2026-11-12T10:00:00+05:30', who: 'x', kind: 'step' },
      approvals: [{ event_id: 'a1', id: 'human-approve-05-spine', what: 'spine', version: 3, approver: 'Kapil', at: '2026-10-22T10:14:00+05:30' }],
      reopens: [{ key: 'G04C05ST1J1', stage: '3a', version: 4, why: 'spine changed', decided_by: 'Arjun', at: '2026-10-26T09:00:00+05:30', event_id: null }],
      publish_status: { id: 2, status: 'up_for_review' },
      publish_status_history: [{ id: 1, at: '2026-11-01T10:00:00+05:30', set_by: 'Arjun', key: 'G04C05ST1J1', status: 'corrections_wip' }],
    };
    expect(parseStatusMeta(reply)).toMatchObject({ stage: '5 · Ship', publishStatus: 'up_for_review' });
    const ev = parseStatus(reply);
    expect(ev.map(e => e.kind)).toEqual(['approval', 'reopen', 'publish']);
    expect(ev[2]).toMatchObject({ what: 'corrections_wip', stage: null });
    expect(parseStatusMeta({ stage: null }).stage).toBeNull();
  });
});

it('spells a name from an email', () => {
  expect(nameFromEmail('krishna.rander@classrootsedu.com')).toBe('krishna rander');
  expect(nameFromEmail('Kapil@x.com')).toBe('kapil');
});

describe('relay chapter stewards', () => {
  const reply = {
    allocations: [
      { key: 'G06C07', level: 'chapter', owner: 'old@x.com' },
      { key: 'G06C07', level: 'chapter', owner: 'Vinay@x.com' },
      { key: 'G07P1C03', level: 'chapter', owner: 'dj@x.com' },
      { key: 'G05C02ST1', level: 'subtopic', owner: 'aswin@x.com' },
      { key: 'G04C05ST1J1', level: 'journey', owner: 'kapil@x.com' },
    ],
  };
  it('reads chapter owners, latest row wins', () => {
    expect(parseChapterStewards(reply)).toEqual([
      { code: 'G06C07', email: 'vinay@x.com' },
      { code: 'G07P1C03', email: 'dj@x.com' },
    ]);
  });
  it('adds, hands over, and never narrows or grants', () => {
    const members = [
      { userId: 'vinay', email: 'vinay@x.com', groupKeys: ['G06C01'], coordinator: true },
      { userId: 'dj', email: 'dj@x.com', groupKeys: [], coordinator: true },
      { userId: 'old', email: 'old@x.com', groupKeys: ['G06C07', 'G05C02'], coordinator: true },
      { userId: 'last', email: 'last@x.com', groupKeys: ['G07P1C03'], coordinator: true },
      { userId: 'kapil', email: 'kapil@x.com', groupKeys: [], coordinator: false },
    ];
    const plan = planStewards(
      [
        { code: 'G06C07', email: 'vinay@x.com' },
        { code: 'G07P1C03', email: 'dj@x.com' },
        { code: 'G04C05', email: 'kapil@x.com' },
        { code: 'G08P2C01', email: 'nobody@x.com' },
      ],
      members,
    );
    expect(plan.add).toEqual([{ userId: 'vinay', code: 'G06C07' }]);
    expect(plan.remove).toEqual([{ userId: 'old', code: 'G06C07' }]);
    expect(plan.steersAll).toEqual([{ code: 'G07P1C03', email: 'dj@x.com' }]);
    expect(plan.keptLast).toEqual([{ code: 'G07P1C03', userId: 'last' }]);
    expect(plan.notCoordinator).toEqual([{ code: 'G04C05', email: 'kapil@x.com' }]);
    expect(plan.unknown).toEqual([{ code: 'G08P2C01', email: 'nobody@x.com' }]);
    expect(plan.grantRole).toEqual([]);
  });
  it('makes admins named by the relay steward of their chapters', () => {
    const plan = planStewards(
      [
        { code: 'G06C07', email: 'vinay@x.com' },
        { code: 'G08P2C01', email: 'aswin@x.com' },
        { code: 'G08P2C02', email: 'aswin@x.com' },
        { code: 'G05C02', email: 'boss@x.com' },
      ],
      [
        { userId: 'vinay', email: 'vinay@x.com', groupKeys: [], coordinator: false, admin: true },
        { userId: 'aswin', email: 'aswin@x.com', groupKeys: [], coordinator: false, admin: true },
        { userId: 'boss', email: 'boss@x.com', groupKeys: [], coordinator: true, admin: true },
      ],
    );
    expect(plan.grantRole).toEqual([
      { userId: 'vinay', code: 'G06C07' },
      { userId: 'aswin', code: 'G08P2C01' },
    ]);
    expect(plan.add).toEqual([
      { userId: 'vinay', code: 'G06C07' },
      { userId: 'aswin', code: 'G08P2C01' },
      { userId: 'aswin', code: 'G08P2C02' },
      { userId: 'boss', code: 'G05C02' },
    ]);
    expect(plan.steersAll).toEqual([]);
    expect(plan.notCoordinator).toEqual([]);
  });
  it('an admin never displaces a chapter’s current steward; the relay’s steward takes over from an admin', () => {
    const plan = planStewards(
      [
        { code: 'G04C05', email: 'aswin@x.com' },
        { code: 'G08P2C01', email: 'arjun@x.com' },
      ],
      [
        { userId: 'arjun', email: 'arjun@x.com', groupKeys: ['G04C05'], coordinator: true },
        { userId: 'aswin', email: 'aswin@x.com', groupKeys: ['G08P2C01'], coordinator: true, admin: true },
      ],
    );
    expect(plan.keptCurrent).toEqual([{ code: 'G04C05', userId: 'arjun', adminId: 'aswin' }]);
    expect(plan.add).toEqual([{ userId: 'arjun', code: 'G08P2C01' }]);
    expect(plan.remove).toEqual([{ userId: 'aswin', code: 'G08P2C01' }]);
    expect(plan.keptLast).toEqual([]);
  });
});

describe('relay reassignments and teams', () => {
  const d = (s: string) => new Date(s);
  it('reads when and under which team a journey was allocated', () => {
    const [row] = parseAllocations({ allocations: [{ key: 'G06C07ST1J1', level: 'journey', owner: 'vaishali@x.com', team: 'Team Devjyoti', at: '2026-11-11T08:09:36Z' }] });
    expect(row.team).toBe('Team Devjyoti');
    expect(row.at?.toISOString()).toBe('2026-11-11T08:09:36.000Z');
  });
  it('the later change wins: relay after a change here moves it, a change here after the relay stands', () => {
    expect(relayHolderWins(d('2026-11-11'), null)).toBe(true);
    expect(relayHolderWins(d('2026-11-11'), d('2026-11-10'))).toBe(true);
    expect(relayHolderWins(d('2026-11-11'), d('2026-11-12'))).toBe(false);
    expect(relayHolderWins(null, null)).toBe(true);
    expect(relayHolderWins(null, d('2026-11-12'))).toBe(false);
  });
  const teams = [
    { id: 'ta', name: 'Team Arjun', coordinatorId: 'arjun', coordinatorName: 'Arjun Singh' },
    { id: 'td', name: 'Devjyoti’s team', coordinatorId: 'dj', coordinatorName: 'Devjyoti Mondal' },
  ];
  it('matches a relay team by name, else by the coordinator’s first name', () => {
    expect(teamForRelayName('team arjun', teams)?.id).toBe('ta');
    expect(teamForRelayName('Team Devjyoti', teams)?.id).toBe('td');
    expect(teamForRelayName('Team Vinay', teams)).toBeNull();
  });
  it('moves creators whose relay journeys share one team; leaves split ones, coordinators and solo seats', () => {
    const plan = planTeams(
      [
        { userId: 'kapil', team: 'Team Arjun' },
        { userId: 'kapil', team: 'Team Arjun' },
        { userId: 'manasa', team: 'Team Devjyoti' },
        { userId: 'vaishali', team: 'Team Arjun' },
        { userId: 'vaishali', team: 'Team Devjyoti' },
        { userId: 'arjun', team: 'Team Arjun' },
        { userId: 'aswin', team: 'Aswin' },
        { userId: 'x', team: 'Team Vinay' },
        { userId: 'preethi', team: 'Team Arjun' },
      ],
      teams,
      new Map([
        ['manasa', 'ta'],
        ['preethi', 'ta'],
      ]),
    );
    expect(plan.moves).toEqual([
      { userId: 'kapil', teamId: 'ta', fromTeamId: null },
      { userId: 'manasa', teamId: 'td', fromTeamId: 'ta' },
    ]);
    expect(plan.mixed).toEqual([{ userId: 'vaishali', teams: ['Team Arjun', 'Team Devjyoti'] }]);
    expect(plan.unknownTeams).toEqual(['Team Vinay']);
  });
});
