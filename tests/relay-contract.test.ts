import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTRACT, contractData, DASHBOARD_ROLES, DASHBOARD_STATUSES, feedTouched, isTouched, mismatchSettled, parseFeed, publishFor, RelayContractError, toolUnavailable, type FeedEvent } from '@/lib/relay-contract';
import { dashEventFor, eventIdFor, parsePushReply, PUSHED_TYPES, type EventRow, type PushContext } from '@/lib/relay-push';
import { relayMismatch } from '@/lib/relay-review';
import { applyStageConfig } from '@/lib/stages';
import { journeyApplet, journeyPart } from '@/modules/journey-applet/definition';

const mod = applyStageConfig(journeyApplet, []);

describe('the contract is the one the relay holds', () => {
  it('matches the fixture the relay tests against (relay/test/fixtures/dashboard-contract.v1.json)', () => {
    expect(JSON.parse(JSON.stringify(contractData()))).toEqual(JSON.parse(readFileSync(new URL('./fixtures/relay-contract.v1.json', import.meta.url), 'utf8')));
  });
  it('names every journey status, in order', () => {
    expect([...DASHBOARD_STATUSES]).toEqual(journeyApplet.statuses.map(s => s.key));
  });
  it('gives each status the relay publish status it lines up with, and the two never read as out of step', () => {
    expect([publishFor('creating'), publishFor('ready_for_review'), publishFor('changes_asked'), publishFor('correction_verification'), publishFor('closed'), publishFor('done'), publishFor('made_up')]).toEqual([null, 'up_for_review', 'corrections_wip', 'up_for_review', 'ready_from_content', 'ready_from_content', null]);
    for (const s of DASHBOARD_STATUSES) expect(relayMismatch(s, journeyPart(mod, s), publishFor(s)), s).toBeNull();
  });
});

const ev = (over: Partial<FeedEvent>): FeedEvent => ({ seq: 'steps:1', source: 'steps', id: 1, at: '2026-11-23T10:00:00.000Z', by: 'kapil@classrootsedu.com', entity: 'step', op: 'create', key: 'G04C05ST1J2', data: {}, ...over });

describe('the change feed', () => {
  it('reads a reply and keeps only what it knows', () => {
    const page = parseFeed({ contract: 1, cursor: { steps: 9, statuses: 2, later_source: 4, bad: 'x' }, more: true, count: 2, events: [ev({}), { nonsense: true }, ev({ seq: 'statuses:2', entity: 'publish_status', op: 'update', data: { status: 'up_for_review' } })] })!;
    expect(page.cursor).toEqual({ steps: 9, statuses: 2, later_source: 4 });
    expect([page.more, page.events.map(e => e.seq)]).toEqual([true, ['steps:1', 'statuses:2']]);
  });
  it('refuses another contract rather than guess, and reads "not installed" as no feed', () => {
    expect(() => parseFeed({ contract: 2, cursor: {}, events: [] })).toThrow(RelayContractError);
    expect(() => parseFeed({ contract: CONTRACT })).toThrow(/no cursor/);
    expect(() => parseFeed('ERROR')).toThrow(RelayContractError);
    expect(parseFeed({ contract: 1, status: 'not installed' })).toBeNull();
  });
  it('names the journeys to read: by key, or everything under a chapter or subtopic', () => {
    const t = feedTouched([ev({}), ev({ key: 'G05C02ST4', entity: 'approval' }), ev({ key: 'G06C07', entity: 'reopen' }), ev({ key: 'G07P1C03', entity: 'team_note' }), ev({ key: 'G04C05ST3J1', entity: 'cms_write' }), ev({ key: null }), ev({ key: 'a-cms-uuid' })]);
    expect([[...t.keys], [...t.prefixes]]).toEqual([['G04C05ST1J2'], ['G05C02ST4', 'G06C07']]);
    expect(['G04C05ST1J2', 'g05c02st4j1', 'G06C07ST6J4', 'G04C05ST1J3', 'G05C02ST41J1', 'G07P1C03ST1J1', 'G04C05ST3J1'].map(k => isTouched(k, t))).toEqual([true, true, true, false, false, false, false]);
  });
  it('tells a relay without the tools from a real failure', () => {
    expect(toolUnavailable('sync_feed: ERROR: unknown tool: sync_feed')).toBe(true);
    expect(toolUnavailable('dashboard_event: ERROR: dashboard_event is refused: this service token is read-only (named in the relay\'s READ_ONLY_TOKENS).')).toBe(true);
    expect(toolUnavailable('dashboard_event: ERROR: dashboard_event: only the Classroots Work dashboard writes its events')).toBe(true);
    expect(toolUnavailable('sync_feed: HTTP 502')).toBe(false);
  });
});

describe('a difference is settled once the relay holds this side’s word', () => {
  const t = (s: string) => new Date(s);
  it('only when the stage here changed later and that change was delivered', () => {
    expect(mismatchSettled(t('2026-11-22T10:00:00Z'), t('2026-11-21T10:00:00Z'), true)).toBe(true);
    expect(mismatchSettled(t('2026-11-22T10:00:00Z'), t('2026-11-21T10:00:00Z'), false)).toBe(false);
    expect(mismatchSettled(t('2026-11-20T10:00:00Z'), t('2026-11-21T10:00:00Z'), true)).toBe(false);
    expect(mismatchSettled(null, t('2026-11-21T10:00:00Z'), true)).toBe(false);
    expect(mismatchSettled(t('2026-11-22T10:00:00Z'), null, true)).toBe(false);
  });
});

const ctx: PushContext = { labels: { owner: 'SME reviewer', developer: 'Developer' }, statusLabel: s => ({ changes_asked: 'Changes asked', allocated: 'Allocated' })[s] ?? null, emailByName: new Map([['devjyoti mondal', 'devjyoti@classrootsedu.com']]) };
const row = (over: Partial<EventRow>): EventRow => ({ id: 'ev1', type: 'STATUS_CHANGED', field: 'status', fromValue: 'review_in_progress', toValue: 'changes_asked', source: 'APP', note: 'Two asks.', meta: null, at: new Date('2026-11-23T05:30:00Z'), actorEmail: 'Arjun@classrootsedu.com', externalKey: 'G04C05ST1J2_halves', ...over });
const sent = (over: Partial<EventRow>) => {
  const e = dashEventFor(row(over), ctx);
  if ('skip' in e) throw new Error(e.skip);
  return e;
};

describe('a change here as the event the relay keeps', () => {
  it('a stage move', () => {
    expect(sent({})).toEqual({ event_id: eventIdFor('ev1'), at: '2026-11-23T05:30:00.000Z', by: 'arjun@classrootsedu.com', key: 'G04C05ST1J2', entity: 'status', action: 'update', from: 'review_in_progress', to: 'changes_asked', data: { source: 'APP', note: 'Two asks.', label: 'Changes asked' } });
    expect(eventIdFor('ev1')).toMatch(/^[0-9a-f]{64}$/);
    expect(eventIdFor('ev1')).toBe(eventIdFor('ev1'));
    expect(eventIdFor('ev1')).not.toBe(eventIdFor('ev2'));
  });
  it('the removed peer reviewer is not sent: its old history stays here', () => {
    expect(dashEventFor(row({ type: 'FIELD_CHANGED', field: 'Peer reviewer', fromValue: null, toValue: 'Animesh Mittal' }), ctx)).toEqual({ skip: 'the peer reviewer is not sent' });
    // The relay's role list keeps the value: one that is not sent does not move the contract.
    expect(DASHBOARD_ROLES).toContain('peer_reviewer');
  });
  it('a move the relay caused is sent too, by system, so the relay’s copy is whole', () => {
    const e = sent({ source: 'RELAY', actorEmail: null, note: 'Up for review on the relay' });
    expect([e.by, e.data.source]).toEqual(['system', 'RELAY']);
  });
  it('a stage an admin added is kept as a field, not refused', () => {
    const e = sent({ toValue: 'extra_check' });
    expect([e.entity, e.to, e.data.field]).toEqual(['field', 'extra_check', 'status']);
  });
  it('people on a journey, by role, with the email where the name is known', () => {
    expect(sent({ type: 'ASSIGNED', field: 'assignee', fromValue: null, toValue: 'Devjyoti Mondal', note: null })).toMatchObject({ entity: 'assignment', action: 'update', to: 'devjyoti@classrootsedu.com', data: { role: 'creator', name: 'Devjyoti Mondal' } });
    expect(sent({ type: 'UNASSIGNED', field: 'assignee', fromValue: 'Devjyoti Mondal', toValue: null, note: null })).toMatchObject({ entity: 'assignment', action: 'delete', from: 'devjyoti@classrootsedu.com', data: { role: 'creator' } });
    expect(sent({ type: 'FIELD_CHANGED', field: 'SME reviewer', fromValue: null, toValue: 'Somebody Else' })).toMatchObject({ to: 'Somebody Else', data: { role: 'reviewer' } });
    expect(sent({ type: 'FIELD_CHANGED', field: 'Developer', toValue: 'X' }).data.role).toBe('developer');
  });
  it('fields, feedback, created, deleted and restored', () => {
    expect(sent({ type: 'FIELD_CHANGED', field: 'creationStage', fromValue: '4 · Build', toValue: '5 · Ship', note: null })).toMatchObject({ entity: 'field', action: 'update', from: '4 · Build', to: '5 · Ship', data: { field: 'creationStage' } });
    expect(sent({ type: 'FIELD_CHANGED', field: 'cmsUrl', toValue: null }).action).toBe('delete');
    expect(sent({ type: 'FIELD_CHANGED', field: 'cmsUrl', toValue: 'x'.repeat(900) }).to).toHaveLength(500);
    expect(sent({ type: 'FEEDBACK', field: null, fromValue: null, toValue: null, note: 'Max says it twice.', meta: { round: 1, category: 'content', severity: 'major' } })).toMatchObject({ entity: 'feedback', action: 'create', data: { note: 'Max says it twice.', round: 1, severity: 'major' } });
    expect(sent({ type: 'IMPORTED', fromValue: null, toValue: 'allocated', source: 'IMPORT', note: null })).toMatchObject({ entity: 'item', action: 'create', to: 'allocated', data: { status: 'allocated', label: 'Allocated', source: 'IMPORT' } });
    expect(sent({ type: 'FIELD_CHANGED', field: 'archivedAt', fromValue: null, toValue: '2026-11-23T05:30:00.000Z', note: 'Deleted' })).toMatchObject({ entity: 'item', action: 'delete' });
    expect(sent({ type: 'FIELD_CHANGED', field: 'archivedAt', fromValue: '2026-11-23T05:30:00.000Z', toValue: null, note: 'Restored' })).toMatchObject({ entity: 'item', action: 'update', data: { restored: true } });
  });
  it('what is not sent says why', () => {
    expect(dashEventFor(row({ externalKey: 'APK-1.2.3' }), ctx)).toEqual({ skip: 'not a journey key' });
    expect(dashEventFor(row({ type: 'COMMENTED' }), ctx)).toEqual({ skip: 'COMMENTED is not sent' });
    expect(PUSHED_TYPES).not.toContain('COMMENTED');
  });
  it('reads the relay’s answer', () => {
    expect(parsePushReply({ ok: false, recorded: ['a'], duplicate: ['b', 3], rejected: [{ event_id: 'c', error: 'key is not a journey key' }, 'junk'] })).toEqual({ recorded: ['a'], duplicate: ['b'], rejected: [{ event_id: 'c', error: 'key is not a journey key' }] });
    expect(parsePushReply('ERROR')).toEqual({ recorded: [], duplicate: [], rejected: [] });
  });
});

describe('the relay renamed its final publish status (2026-11-23)', () => {
  it('reads the old name, from an older reply or an event kept from before, as the new one', async () => {
    const { publishName } = await import('@/lib/relay-contract');
    const { parseStatus, parseStatusMeta } = await import('@/lib/relay-map');
    expect([publishName('ready_for_student'), publishName('ready_from_content'), publishName('up_for_review')]).toEqual(['ready_from_content', 'ready_from_content', 'up_for_review']);
    const reply = { stage: '5', publish_status: { id: 2, at: '2026-11-16T09:20:31.782Z', status: 'ready_for_student' }, publish_status_history: [{ id: 2, key: 'G04C05ST1J2', at: '2026-11-16T09:20:31.782Z', status: 'ready_for_student', set_by: 'a@b.c' }] };
    expect(parseStatusMeta(reply).publishStatus).toBe('ready_from_content');
    expect(parseStatus(reply).map(e => e.what)).toEqual(['ready_from_content']);
  });
});
