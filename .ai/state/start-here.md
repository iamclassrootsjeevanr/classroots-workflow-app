# STATE — branch: start-here
<!-- Overwritten on every handoff. Under 80 lines. Describes NOW. -->

Updated: 2026-11-04T06:16:00Z · by: cursor · owner: Jeevan

## Goal
Put Classroots Work live on Railway (production = `main`) with a copy of the local DB, Google sign-in for @classrootsedu.com,
email for invites / forgot password, real people. Then build app → sheet sync for APK. Then rebuild the Journey work type
from the SME / coordinator's real process (brief sent out this session).

## Done this stretch
- Merged PR #12 (`start-here → development`, merge commit): docs/skills/.ai from the previous session. development = a58d975.
- Wrote `docs/JOURNEY-BRIEF.md`: plain-English brief for the SME / coordinator. Prompt to paste into Claude, what a work type is
  (APK as the example), today's Journey demo to confirm / change / remove (10 stages, 16 moves, 4 roles, sheet columns, Chapter
  List, stuck limits), 60 questions in blocks 3A–3M (item, stages, moves, roles/people, fields, feedback, dates, dashboards,
  notifications, sheet, existing data, chapters, scope), checks, files to send back, Appendix A answer template, Appendix B
  answer → module glossary. `docs/NEXT-STEPS.md` § 8.1 points to it.

## Where things stand
- Code: development (a58d975) = staging + main (7564280) + docs/skills only. This branch adds the Journey brief (not yet in development).
- Railway: NOT set up yet. Nothing deployed. `docs/DEPLOY.md` intro / Step 1 still describe PR #8 as open (it was merged; trim when touched).
- Local DB (`npm run db:start` or double-click `start.command`): 18 APK versions, Journey demo (93). Admins: Jeevan (password),
  Kishor (Google only), Demo Admin etp4.creates@gmail.com (demo password), etp2.creates@gmail.com (Google only → give a password
  or deactivate). Swathi = swathi@classrootsedu.com.
- Journey brief is with Jeevan to forward to the SME / coordinator. Nothing in `src/` changed for Journey yet.

## In progress
Nothing mid-edit.

## Next steps
1. Open PR `start-here → development` for `docs/JOURNEY-BRIEF.md` + NEXT-STEPS pointer (merge commit).
2. Railway go-live per `docs/DEPLOY.md` steps 2–6 (needs Jeevan / Kishor accounts): Railway project + Postgres + variables, `/api/health`;
   on this Mac `npm run db:copy -- --to '<DATABASE_PUBLIC_URL>'`; Google OAuth client; Gmail app password; people cleanup.
3. APK sheet sync app → sheet only (push-only mode); sync stays OFF on the server until then.
4. When `journey-answers.md` + the live tracker come back: translate Appendix A into the Journey module (statuses with category,
   transitions, roles, fields, groupSummary per chapter with seriesStatuses, sheet mapping, stuckAfterHours), status-mapping
   migration for existing demo rows, update `scripts/import-xlsx.ts`, tests; then live data on the server (NEXT-STEPS § 6 "Later").
   Consider Journey on relational tables like APK (README "APK Testing data model").

## Blockers / open questions
- Needs Jeevan/Kishor: Railway account, Google Cloud (Workspace admin), mailbox app password.
- Needs the SME / coordinator: filled `journey-answers.md` and the files listed in `docs/JOURNEY-BRIEF.md` § 5.

## Key files
- `docs/JOURNEY-BRIEF.md` (the brief), `docs/DEPLOY.md` (go-live checklist), `docs/NEXT-STEPS.md` (§ 6 data, § 7 sign-in, § 8 build).
- `src/modules/journey-applet/definition.ts` (today's Journey module), `src/modules/types.ts`, `src/modules/apk-testing/definition.ts` (pattern).
- `scripts/import-xlsx.ts` (Journey importer), `scripts/copy-db.ts`, `src/server/sync/google-sheet.ts`, `apps-script/Code.gs`.
- `.agents/skills/handoff/SKILL.md`, `.agents/skills/resume/SKILL.md`.
