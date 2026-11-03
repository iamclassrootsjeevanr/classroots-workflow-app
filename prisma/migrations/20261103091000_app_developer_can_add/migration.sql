-- In APK Testing both the tester and the app developer can add APK versions and test cases.
UPDATE "AccessRole" SET "capCreate" = true
WHERE "key" = 'app-developer' AND "workTypeId" IN (SELECT "id" FROM "WorkType" WHERE "key" = 'apk-testing');
