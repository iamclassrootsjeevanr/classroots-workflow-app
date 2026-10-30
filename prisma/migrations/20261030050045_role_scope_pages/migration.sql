-- Data scope, edit right and page access now live on the role; a person's access = the sum of their roles.
ALTER TABLE "AccessRole"
  ADD COLUMN "dataScope" "DataScope" NOT NULL DEFAULT 'OWN',
  ADD COLUMN "canEdit" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "pageDashboard" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "pageItems" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "pageReports" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "pageExport" BOOLEAN NOT NULL DEFAULT false;

-- Sensible defaults for the built-in roles
UPDATE "AccessRole" SET "dataScope"='OWN', "canEdit"=true,  "pageDashboard"=true, "pageItems"=true, "pageReports"=false, "pageExport"=false WHERE "key"='developer';
UPDATE "AccessRole" SET "dataScope"='ALL', "canEdit"=true,  "pageDashboard"=true, "pageItems"=true, "pageReports"=true,  "pageExport"=false WHERE "key"='reviewer';
UPDATE "AccessRole" SET "dataScope"='ALL', "canEdit"=true,  "pageDashboard"=true, "pageItems"=true, "pageReports"=true,  "pageExport"=true  WHERE "key"='coordinator';
UPDATE "AccessRole" SET "dataScope"='ALL', "canEdit"=false, "pageDashboard"=true, "pageItems"=true, "pageReports"=true,  "pageExport"=false WHERE "key"='viewer';

ALTER TABLE "WorkTypeMember"
  DROP COLUMN "dataScope",
  DROP COLUMN "canEdit",
  DROP COLUMN "pageDashboard",
  DROP COLUMN "pageItems",
  DROP COLUMN "pageReports",
  DROP COLUMN "pageExport";
