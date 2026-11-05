# STATE — branch: start-here
<!-- Overwritten on every handoff. Under 80 lines. Describes NOW. -->

Updated: 2026-11-05T05:21:29Z · by: cursor · owner: Jeevan

## Goal
Go live on Railway (development, staging, production per `docs/DEPLOY.md`) with Journey and APK. APK sheet sync is now
app → sheet (the sheet is a copy of the app). Next code work: an API so Claude can move a journey's creation stage.

## Done this stretch
- PR #13 (Journey rebuild + configurable stages) merged into `development` (merge commit 59c4281); start-here fast-forwarded.
- Sheet sync direction: `config.sync.direction` = `app-to-sheet` (default when unset) | `two-way`.
  - `queueMirror` in `src/server/sync/google-sheet.ts`: read tab → queue every mapped cell that differs from the app
    (sheet edits overwritten, '' clears) + non-empty cells of items the tab lacks (appended; archived skipped) → push.
    Rows only in the sheet left alone (SyncState.missing); `created` = rows to append; app untouched; sheetMissing cleared.
    Cells already queued with the same value aren't re-queued (attempts still reach FAILED).
  - Pure picker `mirrorColumns` in `src/lib/sheet-core.ts` + 4 tests in `tests/sheet.test.ts`.
  - Admin → Sheet sync: switch "Sync with Google Sheet" + Direction segmented control with help text; direction-aware
    "Last result" and Sync now message (`syncNowAction`, `updateSyncAction` in `src/app/actions.ts`).
  - Spreadsheet ID field no longer overflows the card at 375px (`min-w-full sm:min-w-72`).
- Verified: real `syncWorkType` against a fake in-memory Apps Script (331 APK items): sheet-edited cell restored, sheet-only
  comment cleared, deleted row re-appended, sheet-only row kept, no app item changed; second run wrote 0 cells. Local DB
  restored afterwards (config, outbox, snapshots, SyncState). Browser-checked Admin → Sheet sync desktop + 375px, light + dark.
- Docs: README "Google Sheet sync" (Direction section, anchor renamed), NEXT-STEPS § 4 and § 6, DECISIONS 2026-11-05.

## Where things stand
- Typecheck and 150 tests pass. `npm run build` not re-run this session (only small server/UI changes).
- start-here is ahead of development by this sync work → open a PR start-here → development (merge commit).
- Local: nothing running. Local APK sync config is **enabled** with the real `APPS_SCRIPT_URL` in `.env` and now defaults to
  app → sheet: pressing Sync now locally (or `npm run sync:run`) would overwrite the live APK sheet with local data.
- Railway: NOT set up yet.

## In progress
Nothing mid-edit.

## Next steps
1. Open PR start-here → development for the sync direction work; merge with a merge commit when CI is green.
2. Ask Jeevan whether to switch local APK sync off (Admin → Sheet sync) so local runs can't overwrite the live sheet.
3. Send `docs/JOURNEY-FOLLOW-UP.md` to Arjun (Jeevan). His answers: after-step owners/limits → Admin → Stages (no code);
   half-day Days taken, Closure due rule, coordinator-per-chapter scope → code (NEXT-STEPS § 8.1).
4. Deploy per `docs/DEPLOY.md` (production, then staging + development). Sync is copied off; turn APK on with App → sheet.
5. API route with a per-relay key so Claude can move a journey's creation stage (NEXT-STEPS § 8.1 row 8).

## Blockers / open questions
- Needs Jeevan/Kishor: Railway account (CLI not installed here), Google Cloud (Workspace admin), mailbox app password.
- Needs Arjun: the answers in `docs/JOURNEY-FOLLOW-UP.md`.

## Key files
- `src/server/sync/google-sheet.ts` (queueMirror, syncWorkType), `src/lib/sheet-core.ts` (mirrorColumns, diffRow).
- `src/server/services/work-items.ts` (SyncDirection, syncDirection), `src/components/admin-controls.tsx` (SyncSettings).
- `src/modules/journey-applet/definition.ts`, `src/lib/stages.ts`, `docs/DEPLOY.md`, `docs/NEXT-STEPS.md`.
