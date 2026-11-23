import { describe, expect, it } from 'vitest';
import { appletFixesText, relayMismatch, reviewMoves } from '@/lib/relay-review';
import { parseStatusMeta } from '@/lib/relay-map';
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
    expect(reviewMoves('creating', { status: 'corrections_wip', at: up.at }, null)).toEqual([]);
    expect(reviewMoves('creating', { status: 'ready_for_student', at: up.at }, null)).toEqual([]);
    expect(reviewMoves('creating', { status: 'up_for_review', at: null }, null)).toEqual([]);
    expect(reviewMoves('creating', null, null)).toEqual([]);
  });
  it('only names stages the Journey flow has', () => {
    const keys = new Set(journeyApplet.statuses.map(s => s.key));
    for (const s of ['allocated', 'creating', 'changes_asked']) for (const to of reviewMoves(s, up, null)) expect(keys.has(to), to).toBe(true);
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
