-- Roles belong to one work type (they follow that work type's flow). A work type has many roles.
-- Existing global roles are copied into every work type that uses them, members are moved to the copies, then the globals go.

ALTER TABLE "AccessRole" ADD COLUMN "workTypeId" TEXT;
DROP INDEX IF EXISTS "AccessRole_key_key";

INSERT INTO "AccessRole" ("id","key","name","description","color","isSystem","capWork","capReview","capAssign","capCreate","capManageFields","dataScope","canEdit","pageDashboard","pageItems","pageReports","pageExport","workTypeId","updatedAt")
SELECT r."id" || '_' || w."id", r."key", r."name", r."description", r."color", r."isSystem", r."capWork", r."capReview", r."capAssign", r."capCreate", r."capManageFields", r."dataScope", r."canEdit", r."pageDashboard", r."pageItems", r."pageReports", r."pageExport", w."id", CURRENT_TIMESTAMP
FROM "AccessRole" r CROSS JOIN "WorkType" w
WHERE r."workTypeId" IS NULL
  AND (
    EXISTS (SELECT 1 FROM "WorkTypeMemberRole" m WHERE m."roleId" = r."id" AND m."workTypeId" = w."id")
    OR (NOT r."isSystem" AND NOT EXISTS (SELECT 1 FROM "WorkTypeMemberRole" m2 WHERE m2."roleId" = r."id"))
  );

UPDATE "WorkTypeMemberRole" SET "roleId" = "roleId" || '_' || "workTypeId"
WHERE "roleId" IN (SELECT "id" FROM "AccessRole" WHERE "workTypeId" IS NULL);

DELETE FROM "AccessRole" WHERE "workTypeId" IS NULL;

ALTER TABLE "AccessRole" ALTER COLUMN "workTypeId" SET NOT NULL;
ALTER TABLE "AccessRole" ADD CONSTRAINT "AccessRole_workTypeId_fkey" FOREIGN KEY ("workTypeId") REFERENCES "WorkType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "AccessRole_workTypeId_key_key" ON "AccessRole"("workTypeId", "key");
