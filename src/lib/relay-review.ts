/**
 * The relay's publish status (human-record-16: up_for_review, corrections_wip, ready_for_student) against the dashboard's stage. Pure (no DB).
 * The relay says who has the next move on the published journey; the dashboard runs the review. "Up for review" on the relay submits the
 * journey here, and wherever the two still disagree the journey carries a note that says what to do.
 * "Ready for students" on the relay is not Done: it means the review is over and the journey is final in UAT. It lines up with Review
 * closed here; design standardization, the prod steps and Done come after it and live only in the dashboard.
 */
export type RelayPublish = { status: string; at: Date | null };

/** Where a journey sits here (journeyPart in the Journey definition). */
export type ReviewPart = 'not_started' | 'creating' | 'review' | 'changes' | 'closed' | 'after' | 'done';

export const PUBLISH_LABEL: Record<string, string> = { up_for_review: 'Up for review', corrections_wip: 'Corrections in progress', ready_for_student: 'Ready for students (review over, final in UAT)' };

/**
 * The stages the dashboard moves through because the relay says "up for review": a journey not yet submitted is submitted, and one in
 * Changes asked goes to Correction verification (the corrections are published). Only when the relay's status is later than the last
 * stage change made here: a later change in the dashboard stands.
 */
export function reviewMoves(status: string, publish: RelayPublish | null, lastHereAt: Date | null): string[] {
  if (!publish || publish.status !== 'up_for_review' || !publish.at) return [];
  if (lastHereAt && publish.at.getTime() <= lastHereAt.getTime()) return [];
  if (status === 'allocated') return ['creating', 'ready_for_review'];
  if (status === 'creating') return ['ready_for_review'];
  if (status === 'changes_asked') return ['correction_verification'];
  return [];
}

/** What to do where the relay and the dashboard disagree, or null when they agree. `status` is the stage key, `part` its place in the line. */
export function relayMismatch(status: string, part: ReviewPart, publish: string | null): string | null {
  if (!publish) return null;
  const early = part === 'not_started' || part === 'creating';
  if (publish === 'up_for_review') {
    if (early) return 'Up for review on the relay. Submit for review here.';
    if (status === 'changes_asked') return 'Up for review on the relay. Press Corrections done here.';
    if (part === 'closed' || part === 'after' || part === 'done') return 'Review closed here. Set the relay status: ready for students.';
    return null;
  }
  if (publish === 'corrections_wip') {
    if (early) return 'In corrections on the relay. Submit for review here.';
    if (part === 'review') return 'In corrections on the relay. Ask for changes here, or set the relay status: up for review.';
    if (part === 'closed' || part === 'after' || part === 'done') return 'Review closed here, still in corrections on the relay. Set the relay status: ready for students.';
    return null;
  }
  if (publish === 'ready_for_student') {
    if (early) return 'Ready for students on the relay. Not submitted for review here.';
    if (part === 'review' || part === 'changes') return 'Ready for students on the relay. Review not closed here.';
    return null;
  }
  return null;
}

/** "12 of 27" for the applet fixes a fix seat reports, or an error message. Whole numbers, fixed ≤ total, total ≥ 1. */
export function appletFixesText(fixed: unknown, total: unknown): { text: string } | { error: string } {
  const f = Number(fixed);
  const t = Number(total);
  if (!Number.isInteger(f) || !Number.isInteger(t) || f < 0 || t < 1 || f > t || t > 500) return { error: 'fixed and total must be whole numbers, 0 ≤ fixed ≤ total, total ≥ 1' };
  return { text: `${f} of ${t}` };
}
