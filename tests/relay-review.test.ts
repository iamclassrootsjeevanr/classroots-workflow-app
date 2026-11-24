import { describe, expect, it } from 'vitest';
import { appletFixesText, relayMismatch, relayStageLabel, reopenFollow, reopenLine, reopenStanding, reviewMoves } from '@/lib/relay-review';
import { parseStatus, parseStatusMeta } from '@/lib/relay-map';
import { applyStageConfig } from '@/lib/stages';
import { journeyApplet, journeyPart } from '@/modules/journey-applet/definition';

const at = (s: string) => new Date(s);
const up = { status: 'up_for_review', at: at('2026-11-20T10:00:00Z') };

describe('up for review on the relay moves the journey here', () => {
  it('submits a journey that is not submitted yet', () => {
    expect(reviewMoves('creating', up, at('2026-11-18T09:00:00Z'))).toEqual(['ready_for_review']);
    expect(reviewMoves('allocated', up, null)).toEqual(['creating', 'ready_for_review']);
  });
  it('sends published corrections for verification', () => {
    expect(reviewMoves('changes_asked', up, at('2026-11-19T09:00:00Z'))).toEqual(['correction_verification']);
  });
  it('a later stage change made here stands', () => {
    // The reviewer asked for changes after the relay said up for review: the old status must not undo it.
    expect(reviewMoves('changes_asked', up, at('2026-11-21T09:00:00Z'))).toEqual([]);
    expect(reviewMoves('creating', up, at('2026-11-20T10:00:00Z'))).toEqual([]);
  });
  it('moves nothing for other stages, other statuses or a status with no time', () => {
    for (const s of ['ready_for_review', 'review_in_progress', 'correction_verification', 'closed', 'design_standardization', 'done']) expect(reviewMoves(s, up, null), s).toEqual([]);
    expect(reviewMoves('creating', { status: 'something_new', at: up.at }, null)).toEqual([]);
    expect(reviewMoves('creating', { status: 'up_for_review', at: null }, null)).toEqual([]);
    expect(reviewMoves('creating', null, null)).toEqual([]);
  });
  it('corrections in progress on the relay asks for changes here, through submit and review', () => {
    const fix = { status: 'corrections_wip', at: at('2026-11-20T10:00:00Z') };
    expect(reviewMoves('allocated', fix, null)).toEqual(['creating', 'ready_for_review', 'review_in_progress', 'changes_asked']);
    expect(reviewMoves('creating', fix, null)).toEqual(['ready_for_review', 'review_in_progress', 'changes_asked']);
    expect(reviewMoves('review_in_progress', fix, null)).toEqual(['changes_asked']);
    expect(reviewMoves('correction_verification', fix, null)).toEqual(['changes_asked']);
    expect(reviewMoves('changes_asked', fix, null)).toEqual([]);
    expect(reviewMoves('closed', fix, null)).toEqual([]);
    // A stage change made here after the relay's status stands.
    expect(reviewMoves('creating', fix, at('2026-11-21T09:00:00Z'))).toEqual([]);
  });
  it('ready from content on the relay closes the review here, through submit and review', () => {
    const ready = { status: 'ready_from_content', at: at('2026-11-20T10:00:00Z') };
    expect(reviewMoves('allocated', ready, null)).toEqual(['creating', 'ready_for_review', 'review_in_progress', 'closed']);
    expect(reviewMoves('creating', ready, null)).toEqual(['ready_for_review', 'review_in_progress', 'closed']);
    expect(reviewMoves('ready_for_review', ready, null)).toEqual(['review_in_progress', 'closed']);
    expect(reviewMoves('review_in_progress', ready, null)).toEqual(['closed']);
    expect(reviewMoves('changes_asked', ready, null)).toEqual(['correction_verification', 'closed']);
    expect(reviewMoves('correction_verification', ready, null)).toEqual(['closed']);
    // Already closed or past it: nothing to do. Design, prod steps and Done have no relay status.
    for (const s of ['closed', 'design_standardization', 'last_look', 'design_check', 'video_replacement', 'uat_to_prod', 'published_prod', 'user_testing_qa', 'done']) expect(reviewMoves(s, ready, null), s).toEqual([]);
    // QA sent it back, or the reviewer asked for changes, after the relay said ready: that stands.
    expect(reviewMoves('changes_asked', ready, at('2026-11-21T09:00:00Z'))).toEqual([]);
    expect(reviewMoves('review_in_progress', ready, at('2026-11-21T09:00:00Z'))).toEqual([]);
    expect(reviewMoves('creating', { status: 'ready_from_content', at: null }, null)).toEqual([]);
  });
  it('every move is one the Journey flow allows, so dates are stamped', () => {
    const mod = applyStageConfig(journeyApplet, []);
    const ready = { status: 'ready_from_content', at: at('2026-11-20T10:00:00Z') };
    for (const start of ['allocated', 'creating', 'ready_for_review', 'review_in_progress', 'changes_asked', 'correction_verification']) {
      let from = start;
      for (const to of reviewMoves(start, ready, null)) {
        expect(mod.transitions.some(t => t.from === from && t.to === to), `${from}→${to}`).toBe(true);
        from = to;
      }
      expect(from).toBe('closed');
    }
    expect(mod.transitions.find(t => t.from === 'creating' && t.to === 'ready_for_review')?.stamp).toContain('submittedAt');
    expect(mod.transitions.find(t => t.from === 'review_in_progress' && t.to === 'closed')?.stamp).toContain('reviewDate');
  });
  it('only names stages the Journey flow has', () => {
    const keys = new Set(journeyApplet.statuses.map(s => s.key));
    for (const s of ['allocated', 'creating', 'changes_asked']) for (const p of [up, { ...up, status: 'ready_from_content' }]) for (const to of reviewMoves(s, p, null)) expect(keys.has(to), to).toBe(true);
  });
});

describe('relay status against the stage here', () => {
  const note = (status: string, publish: string | null) => relayMismatch(status, journeyPart(journeyApplet, status), publish);
  it('agrees when both say the same thing', () => {
    expect(note('ready_for_review', 'up_for_review')).toBeNull();
    expect(note('review_in_progress', 'up_for_review')).toBeNull();
    expect(note('correction_verification', 'up_for_review')).toBeNull();
    expect(note('changes_asked', 'corrections_wip')).toBeNull();
    expect(note('closed', 'ready_from_content')).toBeNull();
    expect(note('design_check', 'ready_from_content')).toBeNull();
    expect(note('done', 'ready_from_content')).toBeNull();
    expect(note('creating', null)).toBeNull();
  });
  it('ready from content lines up with Review closed, not with Done', () => {
    for (const s of ['closed', 'design_standardization', 'last_look', 'design_check', 'video_replacement', 'uat_to_prod', 'published_prod', 'user_testing_qa', 'done']) expect(note(s, 'ready_from_content'), s).toBeNull();
    expect(note('done', 'up_for_review')).toBe(note('closed', 'up_for_review'));
    expect(note('closed', 'up_for_review')).toMatch(/^Review closed here/);
  });
  it('says what to do when they differ', () => {
    expect(note('creating', 'up_for_review')).toMatch(/Submit for review/);
    expect(note('changes_asked', 'up_for_review')).toMatch(/Corrections done/);
    expect(note('review_in_progress', 'corrections_wip')).toMatch(/Ask for changes/);
    expect(note('creating', 'ready_from_content')).toMatch(/Not submitted/);
    expect(note('changes_asked', 'ready_from_content')).toMatch(/Review not closed/);
    for (const s of ['closed', 'design_standardization', 'done']) {
      expect(note(s, 'up_for_review'), s).toMatch(/ready from content/);
      expect(note(s, 'corrections_wip'), s).toMatch(/ready from content/);
    }
  });
});

describe('applet fixes from the fix seat', () => {
  it('reads n of m', () => {
    expect(appletFixesText(12, 27)).toEqual({ text: '12 of 27' });
    expect(appletFixesText('0', '3')).toEqual({ text: '0 of 3' });
  });
  it('refuses anything else', () => {
    for (const [f, t] of [[5, 3], [-1, 3], [1.5, 3], [1, 0], ['x', 3], [1, null], [1, 501]] as [unknown, unknown][]) expect('error' in appletFixesText(f, t), `${f}/${t}`).toBe(true);
  });
});

describe('journey_status publish status', () => {
  it('carries the time it was set', () => {
    const meta = parseStatusMeta({ stage: '5', publish_status: { id: 34, at: '2026-11-16T09:20:31.782Z', status: 'ready_from_content', published_on: 'uat' } });
    expect(meta.publishStatus).toBe('ready_from_content');
    expect(meta.publishAt?.toISOString()).toBe('2026-11-16T09:20:31.782Z');
    expect(parseStatusMeta({ stage: '4' })).toMatchObject({ publishStatus: null, publishAt: null });
  });
});

describe('a reopen on the relay', () => {
  const reopen = (stage: string, when: string) => ({ kind: 'reopen', stage, at: at(when) });
  const approval = (stage: string, when: string, withdrawn = false) => ({ kind: 'approval', stage, at: at(when), withdrawn });
  const rows = [approval('3b', '2026-11-10T09:00:00Z', true), approval('4', '2026-11-12T09:00:00Z', true), reopen('3b', '2026-11-20T09:00:00Z')];

  it('moves the Creation stage back to the stage the relay shows now', () => {
    expect(reopenFollow({ here: '5 · Ship', relayStage: '3b · Script', reopenedAbove: false, rows, lastHereAt: null })).toEqual({ to: '3b · Script', at: at('2026-11-20T09:00:00Z'), note: 'Reopened on the relay at 3b · Script' });
    expect(reopenFollow({ here: 'Published', relayStage: '4 · Build', reopenedAbove: false, rows: [reopen('4', '2026-11-20T09:00:00Z')], lastHereAt: at('2026-11-19T09:00:00Z') })?.to).toBe('4 · Build');
  });
  it('a reopen of the chapter or the subtopic leaves the journey with no stage', () => {
    // The relay still shows the journey's own last stage; reopened_above says none of it counts.
    expect(reopenFollow({ here: '5 · Ship', relayStage: '5 · Ship', reopenedAbove: true, rows: [reopen('2', '2026-11-20T09:00:00Z')], lastHereAt: null })).toEqual({ to: null, at: at('2026-11-20T09:00:00Z'), note: 'Reopened on the relay at 2 · Scope' });
    expect(reopenFollow({ here: '3a · Spine', relayStage: '3a · Spine', reopenedAbove: true, rows: [reopen('1', '2026-11-20T09:00:00Z')], lastHereAt: null })?.note).toBe('Reopened on the relay at 1 · Chapter');
  });
  it('follows nothing without a reopen, when the stage here is not ahead, or when it has no stage', () => {
    expect(reopenFollow({ here: '5 · Ship', relayStage: '4 · Build', reopenedAbove: false, rows: [approval('4', '2026-11-12T09:00:00Z')], lastHereAt: null })).toBeNull();
    expect(reopenFollow({ here: '3b · Script', relayStage: '3b · Script', reopenedAbove: false, rows, lastHereAt: null })).toBeNull();
    expect(reopenFollow({ here: '3b · Script', relayStage: '4 · Build', reopenedAbove: false, rows, lastHereAt: null })).toBeNull();
    expect(reopenFollow({ here: null, relayStage: '3b · Script', reopenedAbove: true, rows, lastHereAt: null })).toBeNull();
    expect(reopenFollow({ here: '5 · Ship', relayStage: null, reopenedAbove: false, rows, lastHereAt: null })).toBeNull();
  });
  it('a later change of the Creation stage made here stands', () => {
    expect(reopenFollow({ here: 'Published', relayStage: '3b · Script', reopenedAbove: false, rows, lastHereAt: at('2026-11-21T09:00:00Z') })).toBeNull();
    expect(reopenFollow({ here: 'Published', relayStage: '3b · Script', reopenedAbove: false, rows, lastHereAt: at('2026-11-20T09:00:00Z') })).toBeNull();
  });
  it('stands until the journey is back at Ship with something approved after it', () => {
    expect(reopenStanding(rows, '3b · Script')?.stage).toBe('3b');
    expect(reopenStanding(rows, null)?.stage).toBe('3b');
    expect(reopenStanding(rows, '4 · Build')?.stage).toBe('3b');
    expect(reopenStanding(rows, '5 · Ship')?.stage).toBe('3b'); // back at Ship, nothing approved since
    expect(reopenStanding([...rows, approval('5', '2026-11-22T09:00:00Z')], '5 · Ship')).toBeNull();
    expect(reopenStanding([...rows, approval('5', '2026-11-22T09:00:00Z', true)], 'Published')?.stage).toBe('3b'); // that approval was withdrawn
    expect(reopenStanding([approval('5', '2026-11-12T09:00:00Z')], '5 · Ship')).toBeNull();
    // The latest of several reopens is the one that stands.
    expect(reopenStanding([reopen('4', '2026-11-21T09:00:00Z'), ...rows], '4 · Build')?.stage).toBe('4');
  });
  it('does not move the review stage: a journey in review or later carries a note', () => {
    const standing = reopenStanding(rows, '3b · Script');
    for (const part of ['review', 'changes', 'closed', 'after', 'done'] as const) expect(reopenLine(part, standing), part).toBe('Reopened on the relay at 3b · Script. The stage here did not move.');
    for (const part of ['not_started', 'creating'] as const) expect(reopenLine(part, standing), part).toBeNull();
    expect(reopenLine('review', null)).toBeNull();
    // With the relay status: both lines. Without one: the reopen alone.
    expect(relayMismatch('closed', 'closed', 'up_for_review', standing)).toBe('Reopened on the relay at 3b · Script. The stage here did not move. Review closed here. Set the relay status: ready from content.');
    expect(relayMismatch('design_standardization', 'after', null, standing)).toBe('Reopened on the relay at 3b · Script. The stage here did not move.');
    expect(relayMismatch('review_in_progress', 'review', 'up_for_review', standing)).toBe('Reopened on the relay at 3b · Script. The stage here did not move.');
    expect(relayMismatch('review_in_progress', 'review', 'up_for_review')).toBeNull();
    expect(relayStageLabel('3A')).toBe('3a · Spine');
    expect(relayStageLabel('9')).toBe('stage 9');
  });
  it('reads a recorded journey_status reply with a reopen (sync)', () => {
    // As the relay answers after the steward reopened the journey to stage 3b: the reopen row is its last step.
    const reply = {
      journey: 'G04C05ST1J2', stage: '3b', version: 6, level: 'journey',
      last_step: { at: '2026-11-20T09:00:00.000Z', who: 'arjun@classrootsedu.com', kind: 'reopen', what: 'The script misses the unit idea', approval: null },
      approvals: [{ event_id: 'a1', id: 'human-approve-05-spine', version: 2, approver: 'arjun@classrootsedu.com', at: '2026-11-08T09:00:00.000Z' }],
      withdrawn: [
        { event_id: 'a2', id: 'human-approve-06-storyboard', version: 3, approver: 'arjun@classrootsedu.com', at: '2026-11-10T09:00:00.000Z' },
        { event_id: 'a3', id: 'human-approve-13-human-plays-in-uat', version: 5, approver: 'arjun@classrootsedu.com', at: '2026-11-15T09:00:00.000Z' },
      ],
      reopens: [{ key: 'G04C05ST1J2', stage: '3b', version: 6, why: 'The script misses the unit idea', decided_by: 'arjun@classrootsedu.com', recorded_by: 'arjun@classrootsedu.com', at: '2026-11-20T09:00:00.000Z', event_id: 'r1' }],
      publish_status: { id: 4, key: 'G04C05ST1J2', status: 'up_for_review', at: '2026-11-16T09:00:00.000Z', set_by: 'kapil@classrootsedu.com' },
      publish_status_history: [{ id: 4, key: 'G04C05ST1J2', status: 'up_for_review', at: '2026-11-16T09:00:00.000Z', set_by: 'kapil@classrootsedu.com' }],
    };
    const events = parseStatus(reply);
    const meta = parseStatusMeta(reply);
    expect(events.filter(e => e.kind === 'reopen').map(e => [e.eventId, e.stage, e.what])).toEqual([['r1', '3b', 'The script misses the unit idea']]);
    expect([meta.stage, meta.reopenedAbove]).toEqual(['3b · Script', false]);
    // The dashboard held 5 · Ship and the journey is in review: the Creation stage goes back, the review stage carries a note.
    const follow = reopenFollow({ here: '5 · Ship', relayStage: meta.stage, reopenedAbove: meta.reopenedAbove, rows: events, lastHereAt: null });
    expect(follow).toEqual({ to: '3b · Script', at: at('2026-11-20T09:00:00.000Z'), note: 'Reopened on the relay at 3b · Script' });
    expect(reopenLine(journeyPart(journeyApplet, 'review_in_progress'), reopenStanding(events, follow!.to))).toBe('Reopened on the relay at 3b · Script. The stage here did not move.');
    // An older relay row does not undo a later change made here: the up-for-review status of the 16th moves nothing after a change on the 18th.
    expect(reviewMoves('changes_asked', { status: meta.publishStatus!, at: meta.publishAt }, at('2026-11-18T09:00:00Z'))).toEqual([]);
    // A reopen of the subtopic above: the reply says so, and the journey is left with no stage.
    const above = parseStatusMeta({ ...reply, stage: '5', reopened_above: 'G04C05ST1 was reopened to stage 2 after this key\'s last step' });
    expect(above.reopenedAbove).toBe(true);
    expect(reopenFollow({ here: '5 · Ship', relayStage: above.stage, reopenedAbove: true, rows: parseStatus({ ...reply, reopens: [{ key: 'G04C05ST1', stage: '2', why: 'Recut', at: '2026-11-21T09:00:00.000Z', event_id: 'r2' }] }), lastHereAt: null })?.to).toBeNull();
  });
});
