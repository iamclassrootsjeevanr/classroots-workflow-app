# STATE — branch: start-here
<!-- Overwritten on every handoff. Under 80 lines. Describes NOW. -->

Updated: 2026-11-05T10:13:18Z · by: codex · owner: Jeevan

## Goal
Journey workflow is built and role-audited. Deploy it to Railway and give the relay team its production RELAY_KEY.

## Done this stretch
- PR #14 (`start-here` → `development`) passed `checks` and `branch-flow`, then merged with merge commit `868700c`.
- Fast-forwarded `start-here` to merged `development`; it remains the working branch.

## In progress
Nothing mid-edit. Railway has not been set up.

## Next steps
1. Kishor/Jeevan: provision Railway production, staging and development per `docs/DEPLOY.md` steps 1–2.
2. Jeevan: copy the local database to each environment, then complete Google OAuth and email setup with the Workspace admin.
3. Set a distinct production `RELAY_KEY`, share it with the Journey relay team, and verify health, sign-in, and APK data.
4. Ask Arjun whether a QA fix should return the Journey to User testing and QA rather than re-running after-steps.
5. Decide whether to reset APK App Developer / Viewer defaults and turn local APK sheet sync off.

## Blockers / open questions
- Railway account, Google Workspace admin, and mailbox app-password access are required for deployment.
- Needs Arjun's decision on the QA-fix loop. Design standardization remains paused until Hitheshwar's document is ready.

## Key files
- `docs/DEPLOY.md`, `README.md`, `src/modules/journey-applet/definition.ts`
- `tests/journey-roles.test.ts`, `src/lib/workflow.ts`, `src/modules/roles.ts`
