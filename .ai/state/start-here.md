# STATE — branch: start-here
<!-- Overwritten on every handoff. Under 80 lines. Describes NOW. -->

Updated: 2026-11-03T13:50:05Z · by: cursor · owner: Jeevan

## Goal
Put Classroots Work live on Railway (production = `main`) with a copy of the local DB, Google sign-in for @classrootsedu.com,
email for invites / forgot password, real people. Then build app → sheet sync for APK. Journey is built later.

## Done this stretch
- `start-here` is now the one working branch (renamed from jeevan/railway). Handoff/resume skills updated (`.agents/skills/*`,
  mirrored by `python3 .ai/bin/sync.py`): handoff always saves here, merges origin/development in, and deletes merged branches.
- Deleted branches jeevan/go-live and jeevan/deploy (local + GitHub); removed their state files and upgrade-ai-kit's (logs kept).
- Docs: AGENTS.md "Branches", README "Branches and environments" / Contributing, NEXT-STEPS § 1 now describe `start-here`.

## Where things stand
- Code: development = staging = main (main 7564280, PRs #6–#11 merged). This branch adds only docs/skills/.ai changes (not yet in development).
- Railway: NOT set up yet. Nothing deployed.
- Local DB (`npm run db:start` or double-click `start.command`): 18 APK versions (17 tested + 2.0.1.14_2026-11-02, 20 tests
  Not Tested, Jeevan); Journey demo (93). Admins: Jeevan (jeevan@classrootsedu.com, password), Kishor (kishor@classrootsedu.com,
  Google only), Demo Admin (etp4.creates@gmail.com, demo password), etp2.creates@gmail.com (Google only → can't sign in on the
  server: give a password or deactivate). Swathi = swathi@classrootsedu.com.

## In progress
Nothing mid-edit.

## Next steps — follow `docs/DEPLOY.md` (Jeevan + Kishor; help when asked)
1. Open PR `start-here → development` for this branch's docs/skills (merge commit), release when convenient.
2. DEPLOY step 2 Railway: project from repo (branch main; Kishor needs GitHub collaborator access or a Railway invite), Postgres,
   domain, variables (DATABASE_URL ref + ?connection_limit=10&pool_timeout=20, AUTH_SECRET, AUTH_URL,
   ADMIN_EMAILS=jeevan@classrootsedu.com,kishor@classrootsedu.com, OFFICE_DOMAINS=classrootsedu.com, APP_TIMEZONE); /api/health ok.
3. Step 3 on Jeevan's Mac: `npm run db:copy -- --to '<DATABASE_PUBLIC_URL>'`; sign in, change demo password.
4. Step 4 Google OAuth client (Internal) with the Railway address → AUTH_GOOGLE_ID/SECRET.
5. Step 5 Gmail app password → EMAIL_SERVER/EMAIL_FROM; test Forgot password.
6. Step 6 people: deactivate @demo accounts, fix etp2.creates, Send invite to Jeevan/Swathi/Kishor, add real people.
7. Then build APK sheet sync app → sheet only (push-only mode, existing versions pushed); sync stays OFF on the server until then.
8. Later: Journey from the real tracker; switch the server to live data (NEXT-STEPS § 6 "Later").

## Blockers / open questions
- Needs Jeevan/Kishor: Railway account, Google Cloud (Workspace admin), mailbox app password.

## Key files
- `docs/DEPLOY.md` (the checklist), `docs/NEXT-STEPS.md` (§ 6 data, § 7 sign-in), README "Branches and environments", "Deploy".
- `.agents/skills/handoff/SKILL.md`, `.agents/skills/resume/SKILL.md`.
- `scripts/copy-db.ts`, `Dockerfile`, `railway.json`, `src/server/auth.ts`, `src/server/mail.ts`, `src/lib/invite.ts`,
  `src/server/sync/google-sheet.ts`, `apps-script/Code.gs`.
