-- Relay two-way: where the pull stands in the relay's change feed, and the queue of changes made here that go to the relay's dashboard log.
ALTER TABLE "RelaySyncState" ADD COLUMN "cursor" JSONB;

CREATE TABLE "RelayOutbox" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "workEventId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "payload" JSONB,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    CONSTRAINT "RelayOutbox_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RelayOutbox_workEventId_key" ON "RelayOutbox"("workEventId");
CREATE UNIQUE INDEX "RelayOutbox_eventId_key" ON "RelayOutbox"("eventId");
CREATE INDEX "RelayOutbox_status_createdAt_idx" ON "RelayOutbox"("status", "createdAt");
CREATE INDEX "RelayOutbox_itemId_idx" ON "RelayOutbox"("itemId");
ALTER TABLE "RelayOutbox" ADD CONSTRAINT "RelayOutbox_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RelayOutbox" ADD CONSTRAINT "RelayOutbox_workEventId_fkey" FOREIGN KEY ("workEventId") REFERENCES "WorkItemEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
