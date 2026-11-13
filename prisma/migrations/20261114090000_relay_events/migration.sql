-- Journey relay: the relay's ledger events per journey, and the last sync run.
CREATE TABLE "RelayEvent" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "stage" TEXT,
    "version" INTEGER,
    "what" TEXT,
    "approval" TEXT,
    "approver" TEXT,
    "fingerprint" TEXT,
    "at" TIMESTAMP(3) NOT NULL,
    "withdrawn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RelayEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RelayEvent_eventId_key" ON "RelayEvent"("eventId");
CREATE INDEX "RelayEvent_itemId_at_idx" ON "RelayEvent"("itemId", "at");
ALTER TABLE "RelayEvent" ADD CONSTRAINT "RelayEvent_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "RelaySyncState" (
    "workTypeId" TEXT NOT NULL,
    "lastRunAt" TIMESTAMP(3) NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "report" JSONB NOT NULL,
    CONSTRAINT "RelaySyncState_pkey" PRIMARY KEY ("workTypeId")
);
ALTER TABLE "RelaySyncState" ADD CONSTRAINT "RelaySyncState_workTypeId_fkey" FOREIGN KEY ("workTypeId") REFERENCES "WorkType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
