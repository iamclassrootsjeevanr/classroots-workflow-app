-- A role can hold the QA right: act at a work type's QA stage (Journey: "User testing and QA").
ALTER TABLE "AccessRole" ADD COLUMN "capQa" BOOLEAN NOT NULL DEFAULT false;
