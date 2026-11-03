# STATE — branch: jeevan/apk-database
<!-- Overwritten on every handoff. Under 80 lines. Describes NOW. -->

Updated: 2026-11-03T11:30:00Z · by: claude-code · owner: Jeevan

## Goal
Move APK Testing onto real database tables so it can be deployed (Railway) and scale: shared version and test-case data live once,
lists are filtered and paged in Postgres, and the repo has a Railway recipe. Branched from jeevan/ui-redesign (stacked).

## Done this stretch
- Schema + migrations (applied locally): `ApkVersion`, `ApkTestCase`, `ApkTest` (run -> version + case, unique per pair), extra `WorkItem`
  indexes (20261103090000_apk_relational); existing data moved by the same migration (20 versions, 20 cases, 368 runs linked, shared text
  removed from run JSON). 20261103091000_app_developer_can_add: App Developer role can add versions and cases.
- `src/lib/apk-data.ts` (hydrate / split, tested), `src/server/apk/store.ts` (create hook, write routing, `APK_INCLUDE`),
  `FieldDef.source` 'version' | 'case', module `storage: 'apk'`. createItemTx / updateFieldsTx / loadItems / item page / sheet push use it.
- `apk-versions` service on the tables (create copies from ApkTestCase, edit version = one row, delete/restore archives the ApkVersion too),
  `updateTestCase`, lazy `loadVersionCasesAction`, Cases page reads `ApkTestCase` (50 per page, search).
- Items page: filters, count and paging in Postgres (`src/lib/items-where.ts`, `items-query.ts`); `loadLiteItems` for headers and workload.
- Deploy: `/api/health`, `railway.json`, README "Railway" + "APK data model", `.env.example` pooling note. Prod build OK; production timings
  Items page ~200 ms. Tests 105 pass, tsc clean. Verified in browser: create version, edit shared scenario (all versions change, event logged).

## In progress
Nothing mid-edit. Waiting for the user's review before merge.

## Next steps
1. User reviews the PR (base: jeevan/ui-redesign) and says merge or not. NOTE: jeevan/ui-redesign itself has unmerged work since PR #3 merged
   (UI redesign, roles per work type, inbox, APK pages, sheet sync); it needs its own PR into main.
2. On Railway: set variables per README, run the deploy, pg_dump the local DB (or re-import the xlsx), try Sync now with the new Code.gs.
3. Later scale work: Overview and Versions pages still read every run of a work type (fine to ~tens of thousands); move to SQL aggregates if needed.

## Blockers / open questions
- None.

## Key files
- `prisma/schema.prisma` (APK models), `src/server/apk/store.ts`, `src/lib/apk-data.ts`, `src/server/services/apk-versions.ts`.
- `src/server/services/items-query.ts`, `src/lib/items-where.ts`, `railway.json`, README § Railway.
