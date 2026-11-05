# STATE — branch: start-here
<!-- Overwritten on every handoff. Under 80 lines. Describes NOW. -->

Updated: 2026-11-05T08:20:00Z · by: cursor · owner: Jeevan

## Goal
Journey built to Arjun's answers and audited role by role (done). Next: merge PR #14, go live on Railway
(docs/DEPLOY.md), give the relay team its RELAY_KEY.

## Done this stretch
- Role audit against the brief (A4): matrix test `tests/journey-roles.test.ts` (creator / reviewer / coordinator in and
  outside chapter / program manager: visibility, moves, editable fields, assign / add / delete, feedback).
- Found and fixed:
  - Saved roles had drifted from code (SME creator "own data", Coordinator without "edit details"). Admin → Roles shows
    "Differs from the flow's default" + **Reset to default** (`resetSystemRole`, `rightsDrift` in src/modules/roles.ts);
    Journey importer resets Journey roles. Local DB reset: all four Journey roles match.
  - Feedback (write + resolve) only by the journey's own reviewer (`canGiveFeedback` in src/lib/workflow.ts).
  - Submitted with no SME reviewer → Inbox "Ready for review, no SME reviewer" to the chapter's coordinators
    (`stewardIds` in services/notifications.ts); overdue notices now go to the chapter's coordinators only.
  - New journey form: Journey labels, chapters the person steers, chapter derived/checked from the key
    (`groupFromKey`, `keyExample`), no hand-typed due date; out-of-chapter key refused.
  - Delay label: calendar days in IST (was "Due today" for 1 day late, "1d left" for due today).
- Signed-in browser tests (temporary local passwords, removed after): Kapil (creator), Arjun (coordinator G04C05 +
  reviewer + creator), a temporary program manager (deleted). Full flow: creator stage change + submit (First half,
  Days taken 6.5) → coordinator notice → pick reviewer → start review → ask for changes (Review date + Closure due
  next working day) → program manager view only, Reports 200, Export CSV, Admin blocked. Data restored by re-import.
- Typecheck, 175 tests, `npm run build` pass.

## Where things stand
- PR #14 (start-here → development) open; this push adds the audit work.
- Local: nothing running; `.next` holds a production build (start.command clears it).
- Local APK sheet sync still enabled with the real APPS_SCRIPT_URL (Sync now would overwrite the live sheet).
- APK roles App Developer and Viewer differ from their defaults (shown on Roles page); left as they are.
- Railway: NOT set up yet. Repo is PUBLIC.

## In progress
Nothing mid-edit.

## Next steps
1. CI on PR #14, then merge start-here → development (merge commit).
2. Ask Arjun: after a QA fix, should the journey return to User testing and QA instead of re-running the after-steps?
3. Deploy per docs/DEPLOY.md; set RELAY_KEY on production and send it with README "Journey relay API".
4. Decide whether APK App Developer / Viewer should be reset to defaults (Admin → Roles).
5. Switch local APK sheet sync off unless local runs should write the live sheet.

## Blockers / open questions
- Needs Jeevan/Kishor: Railway account, Google Cloud (Workspace admin), mailbox app password.
- Needs Arjun: item 2. Design standardization stays paused until Hitheshwar's design document is ready.

## Key files
- `tests/journey-roles.test.ts`, `src/modules/journey-applet/definition.ts`, `src/lib/workflow.ts`, `src/lib/access-core.ts`.
- `src/modules/roles.ts` (templateColumns, rightsDrift), `src/server/services/work-types.ts` (resetSystemRole).
- `src/server/services/work-items.ts` (notifyStage), `src/server/services/notifications.ts` (stewardIds), `src/app/actions.ts`.
