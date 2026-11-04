# STATE — branch: start-here
<!-- Overwritten on every handoff. Under 80 lines. Describes NOW. -->

Updated: 2026-11-04T12:14:54Z · by: cursor · owner: Jeevan

## Goal
Journey rebuilt from the SME's answers (done, PR open). Next: go live on Railway (development, staging, production per
`docs/DEPLOY.md`), then app → sheet sync for APK.

## Done this stretch
- Journey work type rebuilt from Arjun's `journey-answers.md` + tracker CSV (35 journeys, 3 chapters G04C05/G05C02/G06C07):
  stages Allocated → 3a Spine → 3b Script → 4 Build → 5 Ship → Ready for review → In progress (↺ Changes asked / Correction
  verification) → Closed → Design standardization (paused) → Last look → Video replacement → UAT→prod → Published on prod →
  User testing and QA → Done. Roles SME creator / SME reviewer / Coordinator / Program manager. `src/modules/journey-applet/definition.ts`.
- Configurable stages: `WorkflowStage` table (migration 20261104120000_workflow_stages), `src/lib/stages.ts` (applyStageConfig,
  stuckRules), `src/server/stages.ts` (cache refresh + save/add/remove), Admin → Work types → Stages
  (`src/app/(app)/admin/work-types/[key]/stages/page.tsx`, `src/components/stage-editor.tsx`).
- Workflow rules: `OWNER` actor, `requires: 'feedback'`, `stamp`, module `compute` (Days taken, Closure due → dueAt, `src/lib/journey.ts`),
  `dueEndsAt: 'approved'` (handedOff: no workload/delay after review close), per-module `workDays`, per-stage `stuckHours`,
  `phaseLimits`; SME reviewer picker on the item page (`setOwner`); creator replies on feedback (Feedback.note); inbox for
  submitted / review closed / overdue (`src/server/services/overdue.ts`, run by cron).
- Local DB: 93 demo journeys + old Journey roles replaced via `npm run import:journey -- /tmp/journey-tracker-2026-11-04.csv --replace`
  (14 people with @classrootsedu.com emails and roles). `scripts/import-xlsx.ts` removed. APK untouched (428 items).
- Tests: tests/stages.test.ts, tests/journey.test.ts; old flow kept as fixture tests/fixtures/review-flow.ts. 145 pass, typecheck ok.
- Browser-checked as admin (desktop + 375px, light + dark): overview, Journeys list, item page full review loop, Stages screen
  (add QA check after Build, skip Script, then reverted). Test changes undone: tracker re-imported (G05C02ST2J1 back to Ready
  for review, no feedback), WorkflowStage table empty. Saving a stage back to its code defaults now deletes its row.
- `npm run build` passes (run with dev stopped; `.next` cleared, dev restarted). Labels keep acronyms (`src/lib/text.ts` lowerLabel).
- Users cleaned (local DB, 18 left): removed 16 Journey-demo accounts without history (first-name-only sheet people, Demo
  Client/Coordinator/Lead/Viewer, aswin@demo). Importer `--replace` now also removes no-email people without roles or work.
- `docs/JOURNEY-FOLLOW-UP.md` ready to send: each question says what the app does until Arjun answers, plus where each answer goes.
- Docs: README Journey + Configurable stages, NEXT-STEPS § 4/6/8, `docs/JOURNEY-FOLLOW-UP.md` (questions for Arjun), DECISIONS, LEARNINGS.

## Where things stand
- Code: start-here ahead of development by this work + earlier docs (DEPLOY three envs, JOURNEY-BRIEF). PR to development opened this session.
- Typecheck, 146 tests and `npm run build` pass. PR #13 (start-here → development) open, CI green.
- Local dev: DB and `next dev` were restarted in the background by the agent (start.command window ended).
- Railway: NOT set up yet.

## In progress
Nothing mid-edit.

## Next steps
1. Merge PR #13 start-here → development (merge commit) once CI is green.
2. Send `docs/JOURNEY-FOLLOW-UP.md` to Arjun. His answers: after-step owners/limits → Admin → Stages (no code); half-day Days
   taken, Closure due rule, coordinator-per-chapter scope → code.
3. Deploy per `docs/DEPLOY.md` (production, then staging + development). db:copy now carries the 35 real journeys.
   On each server, Admin → Work types shows Journey with the new stages; the Journey people sign in with Google.
4. APK sheet sync app → sheet only; then an API so Claude can move a journey's creation stage from the relay.

## Blockers / open questions
- Needs Jeevan/Kishor: Railway account, Google Cloud (Workspace admin), mailbox app password.
- Needs Arjun: the answers in `docs/JOURNEY-FOLLOW-UP.md`.

## Key files
- `src/modules/journey-applet/definition.ts`, `src/lib/stages.ts`, `src/server/stages.ts`, `src/lib/journey.ts`, `src/modules/types.ts`.
- `src/server/services/work-items.ts` (changeStatusTx: stamps/compute/notify; correctionsMove; setOwner; noteFeedback).
- `scripts/import-journey-csv.ts`, `docs/JOURNEY-FOLLOW-UP.md`, `docs/DEPLOY.md`.
