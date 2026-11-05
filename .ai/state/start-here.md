# STATE — branch: start-here
<!-- Overwritten on every handoff. Under 80 lines. Describes NOW. -->

Updated: 2026-11-05T05:46:11Z · by: cursor · owner: Jeevan

## Goal
Journey built to Arjun's follow-up answers (done this session) and APK sheet sync app → sheet (done). Next: merge PR #14,
go live on Railway (docs/DEPLOY.md), give the relay team its RELAY_KEY.

## Done this stretch
- PR #13 merged into development. Sheet sync direction app → sheet (default) / two-way (see DECISIONS 2026-11-05).
- Arjun's answers (`docs/JOURNEY-FOLLOW-UP.md`, now the answered file) built:
  - Creation stage is a `select` field (`CREATION_STAGES` in src/lib/journey.ts), beside Status on the journey page
    (`headerFields`); line = Allocated → In creation → review → after-steps. Start sets 3a · Spine (`NextMove.set`); setting
    it on an Allocated journey starts it (`fieldMoves`). Submit possible at any creation stage.
  - Half days: `pickedUpHalf` / `submittedHalf` (`halfOf` stamps from the clock, before 14:30 = first half); `daysTaken()`.
  - Review date stamped on Ask for changes / Close review (not Start review). Closure due unchanged.
  - After-steps: Last look ½ day + "Send back to design"; Video replacement skipped when Needs video replacement = No
    (`StatusDef.skipWhen`, `landingStage` in src/lib/stages.ts); QA "Send back for a fix" → Changes asked with feedback
    (coordinator may give that feedback).
  - Coordinators per chapter: `WorkTypeMember.groupKeys` (migration 20261105090000), `capabilitiesIn` in access-core,
    `actorContextFor` needs the item's groupKey; People & access → "Chapters they steer"; items table hides assign outside.
  - Relay API: `/api/relay/journeys`, `/api/relay/journeys/<key>`, `POST …/creation-stage` (Bearer `RELAY_KEY`), service
    src/server/services/relay.ts; EventSource RELAY shown as "Claude" (`eventWho` in src/lib/text.ts).
  - Importer: creation/review read separately, `ANSWERS` corrections (5 Nov), chapter names, Aswin admin, coordinator
    chapters. Local DB re-imported: 35 journeys (6 Allocated, 20 In creation, 6 Ready for review, 1 In progress, 2 Changes asked).
  - Aswin added to ADMIN_EMAILS (local .env, docs/DEPLOY.md). Local .env has a RELAY_KEY (local only).
- Verified: typecheck, 160 tests, `npm run build`; relay via curl (401 no/wrong key, stage aliases, Allocated → In creation,
  400/404 errors); browser: header Creation stage, Submit stamps First half → Days taken 3.5, People form chapters at 375px
  dark + desktop; skip path via changeStatus script. Test changes undone by re-import.
- Docs: README Journey + relay API + env table, DEPLOY variables, NEXT-STEPS § 8.1, DECISIONS, LEARNINGS.

## Where things stand
- start-here ahead of development by the sync work + this; PR #14 (start-here → development) open, gets this push.
- Local: nothing running. Local APK sync config is enabled with the real APPS_SCRIPT_URL: Sync now would overwrite the
  live APK sheet from local data (ask Jeevan to switch it off).
- Repo is PUBLIC: no tracker CSV or secrets committed; the importer and docs already name the team.
- Railway: NOT set up yet.

## In progress
Nothing mid-edit.

## Next steps
1. Wait for CI on PR #14 (title/body updated), merge start-here → development with a merge commit.
2. Ask Arjun: after a QA fix, should the journey go back to User testing and QA instead of re-running the after-steps
   from Design standardization (today: Changes asked → Correction verification → Closed → Design standardization …)?
3. Old role descriptions in the DB (SME creator still says "moves them through Spine…") are not overwritten by code;
   update them in Admin → Roles or on the server after db:copy.
4. Deploy per docs/DEPLOY.md; set RELAY_KEY on production and send it to the relay team with README "Journey relay API".
5. Switch local APK sheet sync off unless Jeevan wants local runs to write the live sheet.

## Blockers / open questions
- Needs Jeevan/Kishor: Railway account (CLI not installed), Google Cloud (Workspace admin), mailbox app password.
- Needs Arjun: item 2 above. Design standardization stays paused until Hitheshwar's design document is ready.

## Key files
- `src/modules/journey-applet/definition.ts`, `src/lib/journey.ts`, `src/lib/stages.ts` (landingStage), `src/modules/types.ts`.
- `src/server/services/work-items.ts` (changeStatusTx set/halfOf/skip, updateFieldsTx fieldMoves), `src/server/services/relay.ts`.
- `src/lib/access-core.ts` (capabilitiesIn), `src/server/access.ts`, `src/components/user-access-form.tsx`.
- `scripts/import-journey-csv.ts` (ANSWERS), `docs/JOURNEY-FOLLOW-UP.md`.
