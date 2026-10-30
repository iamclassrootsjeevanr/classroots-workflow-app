-- Per-work-type access: admin-managed roles, own/all data scope, edit and page ticks.
-- Existing users keep equivalent access (data step in the middle).

-- 1. New structures
CREATE TYPE "DataScope" AS ENUM ('OWN', 'ALL');

CREATE TABLE "AccessRole" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#1976d2',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "capWork" BOOLEAN NOT NULL DEFAULT false,
    "capReview" BOOLEAN NOT NULL DEFAULT false,
    "capAssign" BOOLEAN NOT NULL DEFAULT false,
    "capCreate" BOOLEAN NOT NULL DEFAULT false,
    "capManageFields" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AccessRole_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AccessRole_key_key" ON "AccessRole"("key");

CREATE TABLE "WorkTypeMemberRole" (
    "workTypeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    CONSTRAINT "WorkTypeMemberRole_pkey" PRIMARY KEY ("workTypeId","userId","roleId")
);
CREATE INDEX "WorkTypeMemberRole_roleId_idx" ON "WorkTypeMemberRole"("roleId");

ALTER TABLE "User" ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "WorkItem" ADD COLUMN "createdById" TEXT;
ALTER TABLE "WorkTypeMember"
  ADD COLUMN "canEdit" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "dataScope" "DataScope" NOT NULL DEFAULT 'OWN',
  ADD COLUMN "pageDashboard" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "pageExport" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "pageItems" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "pageReports" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 2. Seed system roles
INSERT INTO "AccessRole" ("id","key","name","description","color","isSystem","capWork","capReview","capAssign","capCreate","capManageFields","updatedAt") VALUES
  ('role_developer',   'developer',   'Developer',      'Builds the work: gets assigned, starts, submits for review.',            '#1976d2', true, true,  false, false, false, false, CURRENT_TIMESTAMP),
  ('role_reviewer',    'reviewer',    'SME / Reviewer', 'Reviews submissions: approves, requests corrections, gives feedback.',   '#7e57c2', true, false, true,  false, false, true,  CURRENT_TIMESTAMP),
  ('role_coordinator', 'coordinator', 'Coordinator',    'Plans the work: creates items and assigns people.',                      '#ef6c00', true, false, false, true,  true,  false, CURRENT_TIMESTAMP),
  ('role_viewer',      'viewer',      'Viewer',         'Can look but not act.',                                                   '#78909c', true, false, false, false, false, false, CURRENT_TIMESTAMP);

-- 3. Move global roles to per-work-type access
UPDATE "User" SET "isAdmin" = ("role" = 'ADMIN');

INSERT INTO "WorkTypeMember" ("workTypeId","userId","dataScope","canEdit","pageDashboard","pageItems","pageReports","pageExport","createdAt","updatedAt")
SELECT wt."id", u."id",
       CASE WHEN COALESCE(m."role", u."role") = 'VIEWER' THEN 'ALL'::"DataScope" ELSE 'OWN'::"DataScope" END,
       COALESCE(m."role", u."role") <> 'VIEWER',
       true, true, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User" u
CROSS JOIN "WorkType" wt
LEFT JOIN "WorkTypeMember" m ON m."userId" = u."id" AND m."workTypeId" = wt."id"
WHERE COALESCE(m."role", u."role") IN ('DEVELOPER','SME','VIEWER')
ON CONFLICT ("workTypeId","userId") DO UPDATE SET
  "dataScope" = EXCLUDED."dataScope", "canEdit" = EXCLUDED."canEdit";

INSERT INTO "WorkTypeMemberRole" ("workTypeId","userId","roleId")
SELECT m."workTypeId", m."userId",
       CASE u."role" WHEN 'DEVELOPER' THEN 'role_developer' WHEN 'SME' THEN 'role_reviewer' ELSE 'role_viewer' END
FROM "WorkTypeMember" m JOIN "User" u ON u."id" = m."userId"
WHERE u."role" IN ('DEVELOPER','SME','VIEWER');

-- 4. Drop the old global role
DROP INDEX "User_role_active_idx";
ALTER TABLE "User" DROP COLUMN "role";
ALTER TABLE "WorkTypeMember" DROP COLUMN "role";
DROP TYPE "Role";
ALTER TABLE "WorkTypeMember" ALTER COLUMN "updatedAt" DROP DEFAULT;

CREATE INDEX "User_isAdmin_active_idx" ON "User"("isAdmin", "active");
CREATE INDEX "WorkTypeMember_userId_idx" ON "WorkTypeMember"("userId");

ALTER TABLE "WorkTypeMemberRole" ADD CONSTRAINT "WorkTypeMemberRole_workTypeId_userId_fkey" FOREIGN KEY ("workTypeId", "userId") REFERENCES "WorkTypeMember"("workTypeId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkTypeMemberRole" ADD CONSTRAINT "WorkTypeMemberRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "AccessRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
