-- The peer reviewer is removed from the Journey work type (decided 24 Nov 2026). Its two columns go with their values;
-- Postgres drops each column's index and foreign key with it. History events that name a peer reviewer are kept.
ALTER TABLE "WorkItem" DROP COLUMN "peerReviewerId";
ALTER TABLE "TeamMember" DROP COLUMN "peerReviewerId";
