-- Coordinators limited to their own chapters (empty = every chapter), and changes made by Claude through the journey relay.
ALTER TABLE "WorkTypeMember" ADD COLUMN "groupKeys" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TYPE "EventSource" ADD VALUE 'RELAY';
