# STATE — branch: jeevan/railway
<!-- Overwritten on every handoff. Under 80 lines. Describes NOW. -->

Updated: 2026-11-03T13:45:12Z · by: cursor · owner: Jeevan

## Goal
Put Classroots Work live on Railway (production = `main`) with a copy of the local DB, Google sign-in for @classrootsedu.com,
email for invites / forgot password, real people. Then build app → sheet sync for APK. Journey is built later.

## Where things stand
- Code: everything released. development = staging = main (same files; main 7564280, PRs #6–#11 merged). No open PRs.
  Production build passes; CI (`checks`) + `branch-flow` required on PRs; main needs 1 approval (owner merges with --admin).
- Branch flow: feature branch → PR into `development` (squash) → "Release to staging" → "Release to production" (merge commits).
- Railway: NOT set up yet. Nothing deployed.
- Local DB (this Mac, `npm run db:start` or double-click `start.command`): 18 APK versions (17 tested + 2.0.1.14_2026-11-02,
  20 tests Not Tested, assigned Jeevan); Journey demo data (93). Admins: Jeevan (jeevan@classrootsedu.com, password),
  Kishor (kishor@classrootsedu.com, Google only), Demo Admin (etp4.creates@gmail.com, demo password), etp2.creates@gmail.com
  (Google only → can't sign in on server: give a password or deactivate). Swathi = swathi@classrootsedu.com.
- Sign-in model: only admin-added people; OFFICE_DOMAINS → Google; others email + admin-generated password (sent in invite);
  Forgot password via 1 h email link; needs EMAIL_SERVER on the server.

## In progress
Nothing mid-edit. This branch is fresh from development (only this state file).

## Next steps — follow `docs/DEPLOY.md` (Jeevan + Kishor do them; help when asked)
1. Step 2 Railway: project from repo (branch main) — Kishor needs GitHub collaborator access or a Railway invite; Postgres;
   domain; variables (DATABASE_URL ref + ?connection_limit=10&pool_timeout=20, AUTH_SECRET, AUTH_URL,
   ADMIN_EMAILS=jeevan@classrootsedu.com,kishor@classrootsedu.com, OFFICE_DOMAINS=classrootsedu.com, APP_TIMEZONE); /api/health ok.
2. Step 3 on Jeevan's Mac: `npm run db:copy -- --to '<DATABASE_PUBLIC_URL>'`; sign in, change demo password.
3. Step 4 Google OAuth client (Internal) with the Railway address → AUTH_GOOGLE_ID/SECRET.
4. Step 5 Gmail app password → EMAIL_SERVER/EMAIL_FROM; test Forgot password.
5. Step 6 people: deactivate @demo accounts, fix etp2.creates, Send invite to Jeevan/Swathi/Kishor, add real people.
6. Then build: APK sheet sync app → sheet only (push-only mode per work type, existing versions pushed) — sync stays OFF on the server until then.
7. Later: Journey work type from the real tracker; switch server to live data (NEXT-STEPS § 6 "Later").

## Blockers / open questions
- Needs Jeevan/Kishor: Railway account, Google Cloud (Workspace admin), mailbox app password.

## Key files
- `docs/DEPLOY.md` (the checklist), `docs/NEXT-STEPS.md` (§ 6 data, § 7 sign-in), README "Branches and environments", "Deploy".
- `scripts/copy-db.ts`, `Dockerfile`, `railway.json`, `src/server/auth.ts`, `src/server/mail.ts`, `src/lib/invite.ts`,
  `src/server/sync/google-sheet.ts`, `apps-script/Code.gs`.
