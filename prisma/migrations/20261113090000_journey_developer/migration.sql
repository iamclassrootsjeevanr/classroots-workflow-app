-- Journey: a developer is assigned to check design standardization once the review closes.
ALTER TABLE "WorkItem" ADD COLUMN "developerId" TEXT;
CREATE INDEX "WorkItem_developerId_idx" ON "WorkItem"("developerId");
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
