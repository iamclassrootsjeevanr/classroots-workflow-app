# STATE — branch: jeevan/ui-redesign
<!-- Overwritten on every handoff. Under 80 lines. Describes NOW. -->

Updated: 2026-11-03T12:30:00Z · by: claude-code · owner: Jeevan

## Goal
Classroots Work (Next.js 15, Prisma/Postgres): modern UI, per-work-type pages and roles, APK Testing on database tables, Google Sheet sync,
ready for Railway. This branch holds ALL of it; PR #5 (`jeevan/ui-redesign` -> `main`) is open and only waits for a review approval.

## Done (whole session, all on this branch, all tested: tsc clean, 105 tests, prod build OK)
- Design: tokens + dark mode, per-user theme/text size/density, collapsible sidebar (per-work-type icons, page dropdowns), icon KPI tiles,
  clickable analytics (`itemsUrl`, every tile/slice/bar opens the filtered Items list), dashboard order cards > graphs > tables > items.
- Work type pages (tabs): Overview, APK versions, Test execution, Test cases; Journey: Overview + Journey chapters.
- Roles belong to ONE work type and come from the module flow (`rolesForModule`, `ensureModuleRoles`); APK: Tester, App Developer, Test Lead, Viewer.
- Inbox (Notification table, `notify()`): delete -> 5 s toast -> Inbox Undo for 30 min; version delete/undo; assignment + feedback notices.
- APK: versions/cases/bug/remarks/time log; delete version with Undo; tester AND app developer can add versions and cases.
- APK on tables: `ApkVersion`, `ApkTestCase`, `ApkTest` (migrations 20261103090000/91000, data migrated), hydrate/split in `src/lib/apk-data.ts`,
  `src/server/apk/store.ts`; Items + Cases pages filter/page in Postgres (`items-query`); `/api/health`, `railway.json`, README Railway section.
- Google Sheet: `apps-script/Code.gs` finds tabs by name (no spreadsheet ID), updates Lists (not the formula column D) > Test Cases > APK Releases >
  Version Summary row > Test Execution, never changes dropdown design.

## In progress
Nothing mid-edit. PR #5 is mergeable but BLOCKED by branch policy (needs one approval). It was not bypassed.

## Next steps (full detail with exact tabs, headers and clicks: docs/NEXT-STEPS.md)
1. Approve + squash-merge PR #5 on GitHub (or temporarily relax the `main` rule), then branch from `main`.
2. Make the APK tracker a Google Sheet with the tabs/headers listed in docs/NEXT-STEPS.md; share it with the Apps Script owner.
3. Paste latest `apps-script/Code.gs`, set `SYNC_TOKEN` property, authorize Drive, deploy a NEW version; `.env` `APPS_SCRIPT_URL` + `SYNC_TOKEN`.
4. Admin > Sheet sync: APK tab `Test Execution`, Spreadsheet ID empty, on, Sync now; test with a new APK version.
5. Deploy on Railway (README § Railway), move data (pg_dump or import scripts), cron every 5 min, check `/api/health`.
6. Remove demo users, assign real roles, set `ADMIN_EMAILS`; later Google sign-in (`AUTH_GOOGLE_*`, `ALLOWED_DOMAINS`) and SMTP.
7. Later: Journey Applets on tables (same pattern), more work types, SQL aggregates for Overview past ~50k runs.

## Blockers / open questions
- Review approval for PR #5. Unverified: light theme + 375px on Inbox/Cases/new tiles, a real Railway deploy, sync against live Google.

## Key files
- `docs/NEXT-STEPS.md` (the checklist), `README.md` (Deploy, APK data model, Roles, Inbox), `.ai/DECISIONS.md`, `.ai/LEARNINGS.md`.
- `prisma/schema.prisma`, `src/modules/` (module definitions), `src/server/apk/store.ts`, `src/server/sync/google-sheet.ts`, `apps-script/Code.gs`.
- Local run: `npm run db:start` (tab 1), `npm run dev` (tab 2); sign in with `npm run demo:users` accounts (password `DEMO_PASSWORD`).
