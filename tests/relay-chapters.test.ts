import { describe, expect, it } from 'vitest';
import { chapterFeedCursor, chapterFeedRows, chapterProgress, keptChapterCursor, scopeJourneys } from '@/lib/relay-chapters';
import type { FeedEvent } from '@/lib/relay-contract';

let n = 0;
const ev = (source: string, entity: string, key: string | null, at: string, data: Record<string, unknown> = {}, by = 'arjun@classrootsedu.com'): FeedEvent => ({ seq: `${source}:${++n}`, source, id: n, at, by, entity, op: 'create', key, data });
const cut = (...keys: string[]) => JSON.stringify(keys.map(key => ({ key, name: `${key}_slug` })));

// One chapter as the relay records it: allocated to its steward, read, two subtopics scoped, one being scoped; another only allocated.
const feed: FeedEvent[] = [
  ev('allocations', 'allocation', 'G05C02', '2026-11-01T09:00:00Z', { level: 'chapter', owner: 'Arjun@classrootsedu.com' }, 'aswin@classrootsedu.com'),
  ev('steps', 'step', 'G05C02', '2026-11-02T09:00:00Z', { stage: '1', what: 'Read the chapter' }),
  ev('steps', 'approval', 'G05C02', '2026-11-03T09:00:00Z', { stage: '1', approval: 'human-approve-03-chapter', approver: 'arjun@classrootsedu.com' }, 'seat-token'),
  ev('steps', 'step', 'G05C02ST1', '2026-11-04T09:00:00Z', { stage: '2' }),
  ev('steps', 'approval', 'G05C02ST1', '2026-11-05T09:00:00Z', { stage: '2', approval: 'human-approve-04-scope', journeys: cut('G05C02ST1J1', 'G05C02ST1J2') }),
  ev('steps', 'approval', 'G05C02ST2', '2026-11-06T09:00:00Z', { stage: '2', approval: 'human-approve-04-scope', journeys: cut('G05C02ST2J1') }),
  ev('steps', 'step', 'G05C02ST10', '2026-11-07T09:00:00Z', { stage: '2' }),
  ev('allocations', 'allocation', 'G05C02ST1J1', '2026-11-08T09:00:00Z', { level: 'journey', owner: 'kapil@classrootsedu.com' }),
  ev('steps', 'step', 'G05C02ST1J1', '2026-11-09T09:00:00Z', { stage: '3a' }),
  ev('statuses', 'publish_status', 'G05C02ST1J1', '2026-11-10T09:00:00Z', { status: 'up_for_review' }),
  ev('notes', 'team_note', 'G05C02', '2026-11-10T09:00:00Z', { text: 'A note' }),
  ev('writes', 'cms_write', 'G05C02ST1', '2026-11-10T09:00:00Z', { verb: 'cms_patch' }),
  ev('steps', 'step', 'sim:7c9e6679-7425-40de-944b-e07fc1f90ae7', '2026-11-10T09:00:00Z', { stage: '5' }),
  ev('steps', 'step', null, '2026-11-10T09:00:00Z'),
  ev('allocations', 'allocation', 'G07P1C03', '2026-11-11T09:00:00Z', { level: 'chapter', owner: 'devjyoti@classrootsedu.com' }),
];

describe('chapter and scope progress from the relay feed', () => {
  it('keeps only the rows recorded at a chapter key or a subtopic key', () => {
    const rows = chapterFeedRows(feed);
    expect(rows.map(r => [r.chapter, r.key, r.entity])).toEqual([
      ['G05C02', 'G05C02', 'allocation'],
      ['G05C02', 'G05C02', 'step'],
      ['G05C02', 'G05C02', 'approval'],
      ['G05C02', 'G05C02ST1', 'step'],
      ['G05C02', 'G05C02ST1', 'approval'],
      ['G05C02', 'G05C02ST2', 'approval'],
      ['G05C02', 'G05C02ST10', 'step'],
      ['G07P1C03', 'G07P1C03', 'allocation'],
    ]);
  });
  it('reads the steward, the chapter read, the scopes, the scope mode and the journeys cut', () => {
    const p = chapterProgress(chapterFeedRows(feed));
    expect(p.get('G05C02')).toEqual({
      code: 'G05C02',
      steward: 'arjun@classrootsedu.com',
      read: { approved: true, at: new Date('2026-11-03T09:00:00Z'), by: 'arjun@classrootsedu.com' },
      subtopics: ['G05C02ST1', 'G05C02ST2', 'G05C02ST10'],
      scopesApproved: ['G05C02ST1', 'G05C02ST2'],
      scopeMode: 'steward',
      journeysCut: ['G05C02ST1J1', 'G05C02ST1J2', 'G05C02ST2J1'],
    });
    // A chapter that is only allocated: before any journey exists.
    expect(p.get('G07P1C03')).toEqual({ code: 'G07P1C03', steward: 'devjyoti@classrootsedu.com', read: { approved: false, at: null, by: null }, subtopics: [], scopesApproved: [], scopeMode: 'steward', journeysCut: [] });
  });
  it('a recut is the later scope approval, and the seats scope when the steward hands the scopes over', () => {
    const more = [
      ...feed,
      ev('steps', 'approval', 'G05C02ST1', '2026-11-12T09:00:00Z', { stage: '2', approval: 'human-approve-04-scope', journeys: cut('G05C02ST1J1', 'G05C02ST1J2', 'G05C02ST1J3') }),
      ev('scope_modes', 'scope_mode', 'G05C02', '2026-11-12T10:00:00Z', { mode: 'seats', why: 'Each seat scopes its own' }),
    ];
    const p = chapterProgress(chapterFeedRows(more)).get('G05C02')!;
    expect(p.journeysCut).toEqual(['G05C02ST1J1', 'G05C02ST1J2', 'G05C02ST1J3', 'G05C02ST2J1']);
    expect(p.scopeMode).toBe('seats');
    const back = chapterProgress(chapterFeedRows([...more, ev('scope_modes', 'scope_mode', 'G05C02', '2026-11-13T10:00:00Z', { mode: 'steward', why: 'Back' })])).get('G05C02')!;
    expect(back.scopeMode).toBe('steward');
  });
  it('a reopen takes back what was approved before it', () => {
    // The subtopic reopened: its scope stops counting, the other scope and the chapter read stand.
    const sub = chapterProgress(chapterFeedRows([...feed, ev('steps', 'reopen', 'G05C02ST1', '2026-11-12T09:00:00Z', { stage: '2' })])).get('G05C02')!;
    expect([sub.read.approved, sub.scopesApproved, sub.journeysCut]).toEqual([true, ['G05C02ST2'], ['G05C02ST2J1']]);
    // Scoped again after the reopen: it counts again.
    const again = chapterProgress(chapterFeedRows([...feed, ev('steps', 'reopen', 'G05C02ST1', '2026-11-12T09:00:00Z', { stage: '2' }), ev('steps', 'approval', 'G05C02ST1', '2026-11-13T09:00:00Z', { approval: 'human-approve-04-scope', journeys: cut('G05C02ST1J1') })])).get('G05C02')!;
    expect(again.scopesApproved).toEqual(['G05C02ST1', 'G05C02ST2']);
    // The chapter reopened: the chapter read and every scope under it stop counting.
    const ch = chapterProgress(chapterFeedRows([...feed, ev('steps', 'reopen', 'G05C02', '2026-11-12T09:00:00Z', { stage: '1' })])).get('G05C02')!;
    expect([ch.read, ch.scopesApproved, ch.journeysCut, ch.subtopics.length]).toEqual([{ approved: false, at: null, by: null }, [], [], 3]);
  });
  it('a released chapter has no steward', () => {
    const p = chapterProgress(chapterFeedRows([...feed, ev('allocations', 'allocation', 'G05C02', '2026-11-12T09:00:00Z', { level: 'chapter', owner: null })])).get('G05C02')!;
    expect(p.steward).toBeNull();
  });
  it('reads the journeys list as the relay sends it (JSON text) or as a list', () => {
    expect(scopeJourneys('[{"key":"G06C07ST7J1","name":"G06C07ST7J1_making-one"}]')).toEqual(['G06C07ST7J1']);
    expect(scopeJourneys([{ key: 'g06c07st7j2' }, 'G06C07ST7J3_slug', { key: 'G06C07ST7J2' }, { key: 'G06C07ST7' }, 7])).toEqual(['G06C07ST7J2', 'G06C07ST7J3']);
    expect(scopeJourneys('not json')).toEqual([]);
    expect(scopeJourneys(null)).toEqual([]);
  });
  it('reads only its own feed sources, from its own cursor', () => {
    expect(chapterFeedCursor(null)).toEqual({ allocations: 0, scope_modes: 0, steps: 0, statuses: Number.MAX_SAFE_INTEGER, notes: Number.MAX_SAFE_INTEGER, writes: Number.MAX_SAFE_INTEGER });
    expect(chapterFeedCursor({ allocations: 195, steps: 1076 })).toMatchObject({ allocations: 195, scope_modes: 0, steps: 1076 });
    expect(keptChapterCursor({ allocations: 200, scope_modes: 4, steps: 1100, statuses: Number.MAX_SAFE_INTEGER, notes: 9, writes: 9 })).toEqual({ allocations: 200, scope_modes: 4, steps: 1100 });
  });
});
