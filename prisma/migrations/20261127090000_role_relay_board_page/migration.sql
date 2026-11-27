-- The Relay board tab becomes a page a role opts into (Admin → Roles). It starts ticked for the Journey roles that see every
-- journey on it: Steward, SME reviewer and QA. Every other role starts without it; an admin always sees it.
ALTER TABLE "AccessRole" ADD COLUMN "pageBoard" BOOLEAN NOT NULL DEFAULT false;

UPDATE "AccessRole" r
SET "pageBoard" = true
FROM "WorkType" w
WHERE r."workTypeId" = w.id AND w.key = 'journey-applet' AND r.key IN ('coordinator', 'sme-reviewer', 'qa');
