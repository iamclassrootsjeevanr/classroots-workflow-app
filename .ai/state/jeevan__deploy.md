# STATE — branch: jeevan/deploy
<!-- Overwritten on every handoff. Under 80 lines. Describes NOW. -->

Updated: 2026-11-03T08:10:00Z · by: cursor · owner: Jeevan

## Goal
Deploy Classroots Work to production on Railway (from `main`) with a copy of the local DB, Google sign-in for @classrootsedu.com,
email for invites / forgot password, and real people. Follow `docs/DEPLOY.md` step by step.

## Done
- All go-live work merged: PR #6 → development (squash 64df768), PR #7 development → staging (merge). Production build passes.
- PR #8 "Release to production" (staging → main) open, checks green, waits for Jeevan (1 approval / admin merge).
- Local DB: 18 APK versions (17 tested + 2.0.1.14_2026-11-02, 20 tests Not Tested, Jeevan); emails Jeevan →
  jeevan@classrootsedu.com, Swathi → swathi@classrootsedu.com, Demo Admin → etp4.creates@gmail.com (admin).
- `docs/DEPLOY.md`: the one ordered checklist (this branch, not yet in development).

## In progress
Nothing mid-edit. jeevan/go-live is merged (its state file is history).

## Next steps (Jeevan does them; agent helps with any step)
1. Merge PR #8 (`gh pr merge 8 --merge --admin`).
2. Railway: project from repo (branch main), Postgres, domain, variables (DEPLOY.md step 2), `/api/health` ok.
3. `npm run db:copy -- --to <DATABASE_PUBLIC_URL>`; sign in as etp4.creates@gmail.com, change the demo password.
4. Google OAuth client (Internal) with the Railway address → AUTH_GOOGLE_ID/SECRET.
5. Gmail app password → EMAIL_SERVER/EMAIL_FROM; test Forgot password.
6. People: Jeevan admin?, deactivate @demo accounts, add/invite real people.
7. Open a PR jeevan/deploy → development for docs/DEPLOY.md (and any fixes found while deploying).
8. Next build: app → sheet only sync for APK; later Journey from the real tracker.

## Blockers / open questions
- Needs Jeevan: Railway account, Google Cloud (Workspace) admin, mailbox app password.

## Key files
- `docs/DEPLOY.md`, `docs/NEXT-STEPS.md` (§ 6 data, § 7 sign-in), README "Branches and environments" / "Deploy".
- `scripts/copy-db.ts`, `Dockerfile`, `railway.json`, `src/server/auth.ts`, `src/server/mail.ts`, `src/lib/invite.ts`.
