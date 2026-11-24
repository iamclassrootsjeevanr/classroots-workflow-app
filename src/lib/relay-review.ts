/**
 * The relay's publish status (human-record-16: up_for_review, corrections_wip, ready_from_content) against the dashboard's stage. Pure (no DB).
 * The relay says who has the next move on the published journey. "Up for review" on the relay submits the journey here and "ready for
 * students" closes its review here; wherever the two still disagree the journey carries a note that says what to do.
 * "Ready from content" on the relay is not Done: it means the review is over and the journey is final in UAT. It lines up with Review
 * closed here; design standardization, the prod steps and Done come after it and live only in the dashboard.
 */
export type RelayPublish = { status: string; at: Date | null };

/** Where a journey sits here (journeyPart in the Journey definition). */
export type ReviewPart = 'not_started' | 'creating' | 'review' | 'changes' | 'closed' | 'after' | 'done';

export const PUBLISH_LABEL: Record<string, string> = { up_for_review: 'Up for review', corrections_wip: 'Corrections in progress', ready_from_content: 'Ready from content (review over, final in UAT)' };

/**
 * The stages the dashboard moves through because of the relay's publish status, in order:
 * - "up for review": a journey not yet submitted is submitted, and one in Changes asked goes to Correction verification (the corrections
 *   are published);
 * - "ready from content": the review is over on the relay, so it is closed here too (submitted and reviewed on the way, so the dates are
 *   stamped). Closing hands the journey to a developer for design standardization, as any closed review does.
 * - "corrections in progress": the relay's review asked for changes, so the journey goes to Changes asked here (submitted and review
 *   started on the way); one in Correction verification goes back to Changes asked (asked again).
 * Only when the relay's status is later than the last stage change made here: a later change in the dashboard stands (a reviewer who asks
 * for changes, or QA sending a journey back, is not undone by an older relay status).
 */
export function reviewMoves(status: string, publish: RelayPublish | null, lastHereAt: Date | null): string[] {
  if (!publish || !publish.at) return [];
  if (lastHereAt && publish.at.getTime() <= lastHereAt.getTime()) return [];
  if (publish.status === 'up_for_review') {
    if (status === 'allocated') return ['creating', 'ready_for_review'];
    if (status === 'creating') return ['ready_for_review'];
    if (status === 'changes_asked') return ['correction_verification'];
    return [];
  }
  if (publish.status === 'corrections_wip') {
    const toChanges = ['creating', 'ready_for_review', 'review_in_progress', 'changes_asked'];
    const at = ['allocated', ...toChanges].indexOf(status);
    if (at >= 0 && status !== 'changes_asked') return toChanges.slice(at);
    if (status === 'correction_verification') return ['changes_asked'];
    return [];
  }
  if (publish.status === 'ready_from_content') {
    const toClosed = ['creating', 'ready_for_review', 'review_in_progress', 'closed'];
    const at = ['allocated', ...toClosed].indexOf(status);
    if (at >= 0 && status !== 'closed') return toClosed.slice(at);
    if (status === 'changes_asked') return ['correction_verification', 'closed'];
    if (status === 'correction_verification') return ['closed'];
  }
  return [];
}

/** Moves that happened when the creator first called the journey up for review (not when the review ended): they take that time. */
export const SUBMIT_MOVES = new Set(['creating', 'ready_for_review']);

/** What to do where the relay and the dashboard disagree, or null when they agree. `status` is the stage key, `part` its place in the line. */
export function relayMismatch(status: string, part: ReviewPart, publish: string | null): string | null {
  if (!publish) return null;
  const early = part === 'not_started' || part === 'creating';
  if (publish === 'up_for_review') {
    if (early) return 'Up for review on the relay. Submit for review here.';
    if (status === 'changes_asked') return 'Up for review on the relay. Press Corrections done here.';
    if (part === 'closed' || part === 'after' || part === 'done') return 'Review closed here. Set the relay status: ready from content.';
    return null;
  }
  if (publish === 'corrections_wip') {
    if (early) return 'In corrections on the relay. Submit for review here.';
    if (part === 'review') return 'In corrections on the relay. Ask for changes here, or set the relay status: up for review.';
    if (part === 'closed' || part === 'after' || part === 'done') return 'Review closed here, still in corrections on the relay. Set the relay status: ready from content.';
    return null;
  }
  if (publish === 'ready_from_content') {
    if (early) return 'Ready from content on the relay. Not submitted for review here.';
    if (part === 'review' || part === 'changes') return 'Ready from content on the relay. Review not closed here.';
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
