-- New people start with capacity 10 (decided 25 Nov 2026). Existing rows are not changed here.
ALTER TABLE "User" ALTER COLUMN "capacity" SET DEFAULT 10;
