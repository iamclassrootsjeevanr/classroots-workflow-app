import { describe, expect, it } from 'vitest';
import { approvalLabel, creationStageOfRelay, currentCreationStage, parseAllocations, parseStatus, parseStatusMeta, nameFromEmail } from '@/lib/relay-map';

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
