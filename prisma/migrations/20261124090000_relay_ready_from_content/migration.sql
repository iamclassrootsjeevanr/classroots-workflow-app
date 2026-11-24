-- The relay renamed its final publish status on 2026-11-23: ready_for_student is now ready_from_content (its own stored rows were renamed too).
-- Relay events kept here from before carry the old name; bring them to the new one so the two sides read the same.
UPDATE "RelayEvent" SET "what" = 'ready_from_content' WHERE "kind" = 'publish' AND "what" = 'ready_for_student';
