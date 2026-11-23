import { describe, expect, it } from 'vitest';
import { appletFixesText, relayMismatch, reviewMoves } from '@/lib/relay-review';
import { parseStatusMeta } from '@/lib/relay-map';
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
  it('ready for students on the relay closes the review here, through submit and review', () => {
    const ready = { status: 'ready_for_student', at: at('2026-11-20T10:00:00Z') };
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
    expect(reviewMoves('creating', { status: 'ready_for_student', at: null }, null)).toEqual([]);
  });
  it('every move is one the Journey flow allows, so dates are stamped', () => {
    const mod = applyStageConfig(journeyApplet, []);
    const ready = { status: 'ready_for_student', at: at('2026-11-20T10:00:00Z') };
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
    for (const s of ['allocated', 'creating', 'changes_asked']) for (const p of [up, { ...up, status: 'ready_for_student' }]) for (const to of reviewMoves(s, p, null)) expect(keys.has(to), to).toBe(true);
  });
});

describe('relay status against the stage here', () => {
  const note = (status: string, publish: string | null) => relayMismatch(status, journeyPart(journeyApplet, status), publish);
  it('agrees when both say the same thing', () => {
    expect(note('ready_for_review', 'up_for_review')).toBeNull();
    expect(note('review_in_progress', 'up_for_review')).toBeNull();
    expect(note('correction_verification', 'up_for_review')).toBeNull();
    expect(note('changes_asked', 'corrections_wip')).toBeNull();
    expect(note('closed', 'ready_for_student')).toBeNull();
    expect(note('design_check', 'ready_for_student')).toBeNull();
    expect(note('done', 'ready_for_student')).toBeNull();
    expect(note('creating', null)).toBeNull();
  });
  it('ready for students lines up with Review closed, not with Done', () => {
    for (const s of ['closed', 'design_standardization', 'last_look', 'design_check', 'video_replacement', 'uat_to_prod', 'published_prod', 'user_testing_qa', 'done']) expect(note(s, 'ready_for_student'), s).toBeNull();
    expect(note('done', 'up_for_review')).toBe(note('closed', 'up_for_review'));
    expect(note('closed', 'up_for_review')).toMatch(/^Review closed here/);
  });
  it('says what to do when they differ', () => {
    expect(note('creating', 'up_for_review')).toMatch(/Submit for review/);
    expect(note('changes_asked', 'up_for_review')).toMatch(/Corrections done/);
    expect(note('review_in_progress', 'corrections_wip')).toMatch(/Ask for changes/);
    expect(note('creating', 'ready_for_student')).toMatch(/Not submitted/);
    expect(note('changes_asked', 'ready_for_student')).toMatch(/Review not closed/);
    for (const s of ['closed', 'design_standardization', 'done']) {
      expect(note(s, 'up_for_review'), s).toMatch(/ready for students/);
      expect(note(s, 'corrections_wip'), s).toMatch(/ready for students/);
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
    const meta = parseStatusMeta({ stage: '5', publish_status: { id: 34, at: '2026-11-16T09:20:31.782Z', status: 'ready_for_student', published_on: 'uat' } });
    expect(meta.publishStatus).toBe('ready_for_student');
    expect(meta.publishAt?.toISOString()).toBe('2026-11-16T09:20:31.782Z');
    expect(parseStatusMeta({ stage: '4' })).toMatchObject({ publishStatus: null, publishAt: null });
  });
});
