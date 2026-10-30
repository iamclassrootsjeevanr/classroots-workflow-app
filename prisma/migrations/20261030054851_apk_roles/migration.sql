-- Roles for the APK Testing work type (same roles work in any work type).
INSERT INTO "AccessRole" ("id","key","name","description","color","isSystem","capWork","capReview","capAssign","capCreate","capManageFields","dataScope","canEdit","pageDashboard","pageItems","pageReports","pageExport","updatedAt") VALUES
  ('role_tester',        'tester',        'Tester',        'Runs test cases on APK builds: tests, logs failures, retests.',            '#00897b', true, true,  false, false, false, false, 'OWN', true, true, true, true, false, CURRENT_TIMESTAMP),
  ('role_app_developer', 'app-developer', 'App Developer', 'Responds to test failures: marks them fixed and adds developer remarks.',  '#6d4c41', true, false, true,  false, false, false, 'ALL', true, true, true, true, false, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
