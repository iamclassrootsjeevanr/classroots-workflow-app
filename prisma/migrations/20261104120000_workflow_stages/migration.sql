-- An admin's changes to a work type's stages (rename, reorder, pause, skip, add); null columns keep the module's default.
-- Plus the creator's note on a feedback point.
CREATE TABLE "WorkflowStage" (
    "id" TEXT NOT NULL,
    "workTypeId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT,
    "color" TEXT,
    "category" TEXT,
    "position" INTEGER,
    "state" TEXT,
    "nextLabel" TEXT,
    "movedBy" JSONB,
    "stuckHours" DOUBLE PRECISION,
    "custom" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowStage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkflowStage_workTypeId_key_key" ON "WorkflowStage"("workTypeId", "key");

ALTER TABLE "WorkflowStage" ADD CONSTRAINT "WorkflowStage_workTypeId_fkey" FOREIGN KEY ("workTypeId") REFERENCES "WorkType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Feedback" ADD COLUMN "note" TEXT;
ALTER TABLE "Feedback" ADD COLUMN "noteById" TEXT;
ALTER TABLE "Feedback" ADD COLUMN "noteAt" TIMESTAMP(3);
