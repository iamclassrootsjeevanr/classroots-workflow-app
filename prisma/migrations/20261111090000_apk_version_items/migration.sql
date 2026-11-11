-- APK Testing: one APK version is one work item. Its test results are child items (parentId) that roll up into the version.
ALTER TABLE "WorkItem" ADD COLUMN "parentId" TEXT;
CREATE INDEX "WorkItem_parentId_idx" ON "WorkItem"("parentId");
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
