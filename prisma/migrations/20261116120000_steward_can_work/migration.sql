-- Stewards also build their own journeys: the Journey Steward role gets the "work" right (start, submit, corrections, last look).
UPDATE "AccessRole" SET "capWork" = true, "updatedAt" = NOW()
WHERE "key" = 'coordinator' AND "workTypeId" IN (SELECT "id" FROM "WorkType" WHERE "key" = 'journey-applet');
