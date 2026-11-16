-- Journey developers see only the journeys assigned to them (own data), not every journey.
UPDATE "AccessRole" SET "dataScope" = 'OWN', "updatedAt" = NOW()
WHERE "key" = 'developer' AND "workTypeId" IN (SELECT "id" FROM "WorkType" WHERE "key" = 'journey-applet');
