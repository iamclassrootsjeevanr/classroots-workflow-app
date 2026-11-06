/**
 * Teams (Journey): a coordinator and their SME creators. Pure rules, no DB.
 *
 * Ownership has two levels. A chapter belongs to its steward (the coordinator who steers it). A journey belongs to the
 * coordinator of its creator's team, wherever it was allocated; that coordinator reviews it by default, and the creator's
 * buddy is its peer reviewer. Both defaults are settings of the team and can be changed per journey.
 */

export type TeamLite = {
  id: string;
  name: string;
  coordinatorId: string;
  /** Default SME reviewer of the members' items; null = the coordinator. */
  reviewerId: string | null;
  members: { userId: string; peerReviewerId: string | null }[];
};

/** The team a person belongs to: as a member, or as its coordinator. */
export function teamOf(teams: readonly TeamLite[], userId: string | null | undefined): TeamLite | undefined {
  if (!userId) return undefined;
  return teams.find(t => t.members.some(m => m.userId === userId)) ?? teams.find(t => t.coordinatorId === userId);
}

/** Everyone whose items a team owns: its members and its coordinator. */
export const teamPeople = (team: TeamLite): string[] => [...new Set([team.coordinatorId, ...team.members.map(m => m.userId)])];

/** Ids of the people whose items this coordinator owns (members of the teams they coordinate). */
export function coordinatedPeople(teams: readonly TeamLite[], coordinatorId: string): string[] {
  return [...new Set(teams.filter(t => t.coordinatorId === coordinatorId).flatMap(t => t.members.map(m => m.userId)))];
}

export type ReviewDefaults = {
  team: TeamLite | null;
  /** The coordinator who owns the item's completion. */
  accountableId: string | null;
  /** Default SME reviewer. Nobody reviews their own item. */
  reviewerId: string | null;
  peerReviewerId: string | null;
};

/** Who owns and reviews the items created by `creatorId`, from their team's settings. */
export function reviewDefaults(teams: readonly TeamLite[], creatorId: string | null | undefined): ReviewDefaults {
  const team = teamOf(teams, creatorId) ?? null;
  if (!team || !creatorId) return { team: null, accountableId: null, reviewerId: null, peerReviewerId: null };
  const reviewer = team.reviewerId ?? team.coordinatorId;
  const peer = team.members.find(m => m.userId === creatorId)?.peerReviewerId ?? null;
  return { team, accountableId: team.coordinatorId, reviewerId: reviewer === creatorId ? null : reviewer, peerReviewerId: peer === creatorId ? null : peer };
}

/**
 * The person to put in a reviewer slot when a default changes (new creator, or a new team setting): the new default, when the
 * slot is empty or still holds the old default. A reviewer someone picked by hand is kept. undefined = leave it alone.
 */
export function nextDefault(current: string | null, oldDefault: string | null, newDefault: string | null): string | null | undefined {
  if (!newDefault || current === newDefault) return undefined;
  return current === null || current === oldDefault ? newDefault : undefined;
}
