# STATE — branch: jeevan/go-live
<!-- Overwritten on every handoff. Under 80 lines. Describes NOW. -->

Updated: 2026-11-03T05:58:00Z · by: cursor · owner: Jeevan

## Goal
Take Classroots Work live: connect the APK Google Sheet through the Apps Script, deploy on Railway, load real data, give real people access.
All feature work is already in `main` (squashed PR #5, commit 4abce15). Old branches jeevan/ui-redesign and jeevan/apk-database are deleted.

## What exists (all in main, tested: tsc clean, 105 tests, production build OK)
- UI: dark mode + per-user theme/text size/density, collapsible sidebar (per-work-type icons, page dropdowns), clickable analytics
  (`itemsUrl`), dashboards ordered cards > graphs > tables > items, Inbox with 30-minute Undo, lean data grids.
- Work type pages (Overview, APK versions, Test execution, Test cases; Journey: Overview + Journey chapters).
- Roles belong to one work type and follow its flow (`rolesForModule`); APK: Tester, App Developer, Test Lead, Viewer; tester and app
  developer can both add versions and cases and each writes their own comment column.
- APK on tables: `ApkVersion`, `ApkTestCase`, `ApkTest` (data migrated), DB-side filtering and paging, `/api/health`, `railway.json`.
- Google Sheet: `apps-script/Code.gs` finds tabs by name; updates Lists (not formula column D) > Test Cases > APK Releases > Version Summary
  row > Test Execution; never changes dropdown design.

## Done this stretch (cursor)
- Fixed: signing in from a "system"-theme sign-in page on a dark device left the app dark although the user saved light
  (`ThemeWatcher` now takes `theme` from the root layout and re-syncs `data-theme` when it changes).
- Metric tile labels wrap to two lines instead of truncating ("Fixed / pending retest", "Not reported") in `src/components/ui.tsx`.
- Checked in browser: Inbox, Test cases, APK overview tiles at 375px light, overview at desktop light. tsc clean, 105 tests.
- Work type "Journey Applets" renamed to "Journey" (definition name + migration 20261103120000_rename_journey for the DB row;
  key `journey-applet` and URLs unchanged). Docs and tests updated.

## In progress
Nothing mid-edit. Branch = docs, state file, the two UI fixes and the Journey rename; open as PR #6 into main (needs one approval).
Jeevan: Journey work type is NOT to be built now (no tables, no new features) — only APK Testing goes live. Keep Journey visible as is.

## Next steps (exact tabs, headers and clicks are in docs/NEXT-STEPS.md)
1. Convert the APK tracker to a Google Sheet with tabs Test Execution, APK Releases, Test Cases, Lists, Version Summary; share with the script owner.
2. Paste latest `apps-script/Code.gs`, add `SYNC_TOKEN` property, run once and authorize (Drive), deploy a NEW version; put the /exec URL in `.env`.
3. Admin > Sheet sync: APK tab `Test Execution`, Spreadsheet ID empty, on, Sync now; try a new APK version and watch the tabs fill.
4. Railway (README § Railway): Postgres plugin, variables, domain + `AUTH_URL`, cron every 5 min, move data, `/api/health`.
5. Remove demo users, assign real roles per work type, set `ADMIN_EMAILS`; later Google sign-in (`AUTH_GOOGLE_*`, `ALLOWED_DOMAINS`) and SMTP.
6. Later, only when Jeevan asks: build the Journey work type from the real Journey tracker (chapters page, time log, sheet sync;
   one item = one journey and chapters already have their own table, so APK-style tables add little). New work types, SQL aggregates.

## Blockers / open questions
- Needs Jeevan: the Google Sheet and Apps Script account steps, Railway account, approval of PR #6.
- Unverified: live sheet sync, a real Railway deploy.

## Key files
- `docs/NEXT-STEPS.md`, `README.md` (Deploy, APK data model, Roles, Inbox), `.ai/DECISIONS.md`, `.ai/LEARNINGS.md`.
- `prisma/schema.prisma`, `src/modules/`, `src/server/apk/store.ts`, `src/server/sync/google-sheet.ts`, `apps-script/Code.gs`.
- Run locally: `npm run db:start` (tab 1), `npm run dev` (tab 2); demo sign-ins via `npm run demo:users`.
