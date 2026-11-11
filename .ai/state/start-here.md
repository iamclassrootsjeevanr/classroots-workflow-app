# STATE — branch: start-here
<!-- Overwritten on every handoff. Under 80 lines. Describes NOW. -->

Updated: 2026-11-11T12:44:28Z · by: claude-code · owner: Jeevan

## Goal
APK Testing: one APK version is one work item; test cases are results inside it. Then Journey review per role, Railway deploy.

## Done this stretch
- `WorkItem.parentId` (migration 20261111090000). Version item = the work (key = version name); test cases = child results (ApkTest link). Results stay out of lists/KPIs/analytics (`levelWhere`: work | runs | groups | all). Sheet sync and outbox use results only.
- Version status derived from results (`src/lib/apk-rollup.ts`, `rollupVersionTx` in work-items.ts); never set by hand. New Closed status (done): Close / Reopen version button on the version page, always allowed (warns if tests not updated).
- Assigning a version assigns its results; delete/restore a version takes its results with it.
- UI: APK versions list (rolled-up columns), version page with Test results table, All tests toggle (`?view=tests`), Results by version tab, chart drilldown to tests.
- Overview: Work done card (per person + team average, columns per role: tests updated, passed, failures found, versions done, fixes marked); own-data roles see only themselves + average. `doneMetrics` on the module, `src/lib/work-done.ts`, `src/components/work-done.tsx`.
- Local data: `npm run apk:versions -- --apply --close-old` ran (23 versions, 331 live results; all but the newest closed).
- `npm run typecheck` clean, `npm test` 199 passing (23 files). Signed-in pages NOT viewed in a browser (agents cannot sign in).

## In progress
Nothing mid-edit. Code is not broken.

## Next steps
1. Jeevan: look at APK versions, a version page, Overview Work done and All tests in the Browser pane (light/dark, 375px).
2. Production/staging DB with old APK data: run `npm run apk:versions -- --apply --close-old` after `db:deploy`.
3. Journey: browser check per role (Teams, Chapters, Journeys list, journey page); Railway per docs/DEPLOY.md.
4. Journey open questions below.

## Blockers / open questions
- Journey: 5 Team Devjyoti journeys still have Arjun as SME reviewer; what does the peer reviewer do; should a QA fix return to User testing and QA.
- Railway account, Workspace admin and mailbox app-password needed for deployment.
- Fixes marked counts only from app use (imported history has no person).

## Key files
- `src/lib/apk-rollup.ts`, `src/server/services/work-items.ts` (rollupVersionTx, setVersionClosedTx, ensureVersionItemTx)
- `src/server/services/analytics.ts` (levelWhere, apkVersionFacts), `src/server/services/work-done.ts`
- `src/modules/apk-testing/definition.ts`, `scripts/apk-version-items.ts`
- `src/app/(app)/w/[workType]/[itemId]/page.tsx`, `.../(tabs)/items/page.tsx`
