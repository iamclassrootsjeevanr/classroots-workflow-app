-- Feedback becomes a ticket: a number, a title, the other party, who closed it, and a chat thread.
ALTER TABLE "Feedback" ADD COLUMN "ticketNo" SERIAL NOT NULL;
ALTER TABLE "Feedback" ADD COLUMN "title" TEXT;
ALTER TABLE "Feedback" ADD COLUMN "toId" TEXT;
ALTER TABLE "Feedback" ADD COLUMN "closedById" TEXT;
CREATE UNIQUE INDEX "Feedback_ticketNo_key" ON "Feedback"("ticketNo");

CREATE TABLE "FeedbackMessage" (
    "id" TEXT NOT NULL,
    "feedbackId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeedbackMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FeedbackMessage_feedbackId_createdAt_idx" ON "FeedbackMessage"("feedbackId", "createdAt");
ALTER TABLE "FeedbackMessage" ADD CONSTRAINT "FeedbackMessage_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "Feedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeedbackMessage" ADD CONSTRAINT "FeedbackMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Old feedback: the other party was the item's creator; the creator's single reply becomes the first chat message.
UPDATE "Feedback" f SET "toId" = i."assigneeId" FROM "WorkItem" i WHERE i."id" = f."itemId";
INSERT INTO "FeedbackMessage" ("id", "feedbackId", "authorId", "body", "createdAt")
SELECT 'fm_' || "id", "id", "noteById", "note", COALESCE("noteAt", "createdAt") FROM "Feedback" WHERE "note" IS NOT NULL AND btrim("note") <> '';
