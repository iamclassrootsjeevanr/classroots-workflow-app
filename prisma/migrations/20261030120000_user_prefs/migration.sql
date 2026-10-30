-- Per-user UI preferences (theme, text size, density). Parsed by src/lib/prefs.ts; unknown keys are ignored.
ALTER TABLE "User" ADD COLUMN "prefs" JSONB NOT NULL DEFAULT '{}';
