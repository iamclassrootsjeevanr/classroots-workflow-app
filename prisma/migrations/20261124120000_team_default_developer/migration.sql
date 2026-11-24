-- A team's default developer: checks design standardization for every journey of the team (null = the least busy developer).
ALTER TABLE "Team" ADD COLUMN "developerId" TEXT;
ALTER TABLE "Team" ADD CONSTRAINT "Team_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Starting pairs (changed later on the Teams tab): Jeevan works with Team Devjyoti, Swathi with Team Arjun.
-- Each line does nothing when the team or an active person with the Developer role of that name is not there.
UPDATE "Team" t SET "developerId" = d."id"
FROM (
  SELECT u."id", u."name", mr."workTypeId"
  FROM "User" u
  JOIN "WorkTypeMemberRole" mr ON mr."userId" = u."id"
  JOIN "AccessRole" r ON r."id" = mr."roleId" AND r."key" = 'developer'
  WHERE u."active"
) d
WHERE d."workTypeId" = t."workTypeId"
  AND ((t."name" ILIKE '%Devjyoti%' AND d."name" ILIKE 'Jeevan%') OR (t."name" ILIKE '%Arjun%' AND d."name" ILIKE 'Swathi%'));
