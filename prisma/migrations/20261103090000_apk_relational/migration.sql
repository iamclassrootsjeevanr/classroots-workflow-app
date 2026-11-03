-- APK Testing moves to real tables: versions and test case definitions live once instead of in every row's JSON.

CREATE TABLE "ApkVersion" (
    "id" TEXT NOT NULL,
    "workTypeId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "releaseDate" DATE,
    "link" TEXT,
    "notes" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ApkVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApkTestCase" (
    "id" TEXT NOT NULL,
    "workTypeId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scenario" TEXT,
    "expected" TEXT,
    "steps" TEXT,
    "defaultPriority" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ApkTestCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApkTest" (
    "itemId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    CONSTRAINT "ApkTest_pkey" PRIMARY KEY ("itemId")
);

CREATE UNIQUE INDEX "ApkVersion_workTypeId_key_key" ON "ApkVersion"("workTypeId", "key");
CREATE INDEX "ApkVersion_workTypeId_releaseDate_idx" ON "ApkVersion"("workTypeId", "releaseDate");
CREATE UNIQUE INDEX "ApkTestCase_workTypeId_code_key" ON "ApkTestCase"("workTypeId", "code");
CREATE UNIQUE INDEX "ApkTest_versionId_testCaseId_key" ON "ApkTest"("versionId", "testCaseId");
CREATE INDEX "ApkTest_testCaseId_idx" ON "ApkTest"("testCaseId");

-- Faster lists and grouping for every work type.
CREATE INDEX "WorkItem_workTypeId_archivedAt_groupKey_sortOrder_idx" ON "WorkItem"("workTypeId", "archivedAt", "groupKey", "sortOrder");
CREATE INDEX "WorkItem_workTypeId_groupKey_idx" ON "WorkItem"("workTypeId", "groupKey");

ALTER TABLE "ApkVersion" ADD CONSTRAINT "ApkVersion_workTypeId_fkey" FOREIGN KEY ("workTypeId") REFERENCES "WorkType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApkTestCase" ADD CONSTRAINT "ApkTestCase_workTypeId_fkey" FOREIGN KEY ("workTypeId") REFERENCES "WorkType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApkTest" ADD CONSTRAINT "ApkTest_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApkTest" ADD CONSTRAINT "ApkTest_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ApkVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApkTest" ADD CONSTRAINT "ApkTest_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "ApkTestCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Move the existing APK data ─────────────────────────────────────────────
-- Versions: one per version name, link/date/notes from the first row that has them.
INSERT INTO "ApkVersion" ("id", "workTypeId", "key", "releaseDate", "link", "notes", "archivedAt", "updatedAt")
SELECT gen_random_uuid()::text, w."id", i."groupKey",
  (array_agg(i."data"->>'releaseDate' ORDER BY i."externalKey") FILTER (WHERE i."data"->>'releaseDate' ~ '^\d{4}-\d{2}-\d{2}'))[1]::date,
  (array_agg(i."data"->>'apkUrl' ORDER BY i."externalKey") FILTER (WHERE COALESCE(i."data"->>'apkUrl', '') <> ''))[1],
  (array_agg(i."data"->>'releaseNotes' ORDER BY i."externalKey") FILTER (WHERE COALESCE(i."data"->>'releaseNotes', '') <> ''))[1],
  CASE WHEN bool_and(i."archivedAt" IS NOT NULL) THEN max(i."archivedAt") END,
  CURRENT_TIMESTAMP
FROM "WorkItem" i
JOIN "WorkType" w ON w."id" = i."workTypeId" AND w."key" = 'apk-testing'
WHERE COALESCE(i."groupKey", '') <> ''
GROUP BY w."id", i."groupKey";

-- Test cases: one per test case id, taking the newest version's non-empty text.
INSERT INTO "ApkTestCase" ("id", "workTypeId", "code", "title", "scenario", "expected", "steps", "defaultPriority", "updatedAt")
SELECT gen_random_uuid()::text, w."id", i."data"->>'testCaseId',
  (array_agg(i."title" ORDER BY i."groupKey" DESC))[1],
  (array_agg(i."data"->>'scenario' ORDER BY i."groupKey" DESC) FILTER (WHERE COALESCE(i."data"->>'scenario', '') <> ''))[1],
  (array_agg(i."data"->>'expected' ORDER BY i."groupKey" DESC) FILTER (WHERE COALESCE(i."data"->>'expected', '') <> ''))[1],
  (array_agg(i."data"->>'steps' ORDER BY i."groupKey" DESC) FILTER (WHERE COALESCE(i."data"->>'steps', '') <> ''))[1],
  (array_agg(i."data"->>'priority' ORDER BY i."groupKey" DESC) FILTER (WHERE COALESCE(i."data"->>'priority', '') <> ''))[1],
  CURRENT_TIMESTAMP
FROM "WorkItem" i
JOIN "WorkType" w ON w."id" = i."workTypeId" AND w."key" = 'apk-testing'
WHERE COALESCE(i."data"->>'testCaseId', '') <> ''
GROUP BY w."id", i."data"->>'testCaseId';

-- Runs: link every row to its version and test case.
INSERT INTO "ApkTest" ("itemId", "versionId", "testCaseId")
SELECT i."id", v."id", c."id"
FROM "WorkItem" i
JOIN "WorkType" w ON w."id" = i."workTypeId" AND w."key" = 'apk-testing'
JOIN "ApkVersion" v ON v."workTypeId" = w."id" AND v."key" = i."groupKey"
JOIN "ApkTestCase" c ON c."workTypeId" = w."id" AND c."code" = i."data"->>'testCaseId';

-- The copied fields now live in the new tables only.
UPDATE "WorkItem" SET "data" = "data" - 'scenario' - 'expected' - 'steps' - 'releaseDate' - 'apkUrl' - 'releaseNotes'
WHERE "workTypeId" IN (SELECT "id" FROM "WorkType" WHERE "key" = 'apk-testing');
