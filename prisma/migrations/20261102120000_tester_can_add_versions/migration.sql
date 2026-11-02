-- Testers can add new APK versions (and single test cases).
UPDATE "AccessRole" SET "capCreate" = true WHERE "key" = 'tester';
