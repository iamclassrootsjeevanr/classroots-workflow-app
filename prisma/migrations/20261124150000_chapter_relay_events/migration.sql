-- Relay feed rows recorded at chapter and subtopic keys (stages 1 and 2), kept as sent: the Chapters page shows a chapter's
-- relay progress from them before any journey key is allocated.
CREATE TABLE "ChapterRelayEvent" (
    "id" TEXT NOT NULL,
    "seq" TEXT NOT NULL,
    "chapter" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "by" TEXT,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChapterRelayEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChapterRelayEvent_seq_key" ON "ChapterRelayEvent"("seq");
CREATE INDEX "ChapterRelayEvent_chapter_idx" ON "ChapterRelayEvent"("chapter");
