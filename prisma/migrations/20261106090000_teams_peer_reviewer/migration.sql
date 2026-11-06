-- Teams (a coordinator and their SME creators), the default SME reviewer per team, a peer reviewer per member and per journey.
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "workTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "coordinatorId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeamMember" (
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workTypeId" TEXT NOT NULL,
    "peerReviewerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("teamId","userId")
);

ALTER TABLE "WorkItem" ADD COLUMN "peerReviewerId" TEXT;

CREATE UNIQUE INDEX "Team_workTypeId_name_key" ON "Team"("workTypeId", "name");
CREATE INDEX "Team_coordinatorId_idx" ON "Team"("coordinatorId");
CREATE UNIQUE INDEX "TeamMember_workTypeId_userId_key" ON "TeamMember"("workTypeId", "userId");
CREATE INDEX "WorkItem_peerReviewerId_idx" ON "WorkItem"("peerReviewerId");

ALTER TABLE "Team" ADD CONSTRAINT "Team_workTypeId_fkey" FOREIGN KEY ("workTypeId") REFERENCES "WorkType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Team" ADD CONSTRAINT "Team_coordinatorId_fkey" FOREIGN KEY ("coordinatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Team" ADD CONSTRAINT "Team_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_peerReviewerId_fkey" FOREIGN KEY ("peerReviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_peerReviewerId_fkey" FOREIGN KEY ("peerReviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Journey no longer has an "Applet build" link: drop the value from every journey.
UPDATE "WorkItem" SET "data" = "data" - 'buildUrl'
WHERE "data" ? 'buildUrl' AND "workTypeId" IN (SELECT "id" FROM "WorkType" WHERE "key" = 'journey-applet');
