-- A relay event (e.g. a chapter approval) is listed under every journey beneath it: unique per journey, not globally.
DROP INDEX "RelayEvent_eventId_key";
CREATE UNIQUE INDEX "RelayEvent_itemId_eventId_key" ON "RelayEvent"("itemId", "eventId");
