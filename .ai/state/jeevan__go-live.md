# STATE — branch: jeevan/go-live
<!-- Overwritten on every handoff. Under 80 lines. Describes NOW. -->

Updated: 2026-11-03T06:40:00Z · by: cursor · owner: Jeevan

## Goal
Take Classroots Work live for APK Testing: sign-in for the Google organisation (classrootsedu.com) and for normal email users,
app → sheet sync for the APK tracker, deploy on Railway, real people with roles. Journey is NOT built now (only renamed).

## What exists (main + this branch, tsc clean, 112 tests)
- All feature work from PR #5 (UI, work type pages, roles per work type, inbox, APK on tables, Railway files).
- This branch (PR #6, needs one approval): theme fix after sign-in (`ThemeWatcher` gets `theme` prop), tile labels wrap,
  "Journey Applets" → "Journey" (migration 20261103120000_rename_journey), sign-in/invite work below, docs.

## Done this stretch (cursor)
- Sign-in already existed (Google, email + password, email link; invite-only). Added:
  - `src/server/mail.ts` (one mail sender; no EMAIL_SERVER → printed in server log), used by the email-link provider.
  - `src/lib/invite.ts` + `tests/invite.test.ts`: who signs in how (Google for ALLOWED_DOMAINS / linked Google, else password, else link) and the invite email.
  - `sendInviteAction` in `src/app/actions.ts`; **Send invite** in `PeopleActions` (People list + person page). Passwords never emailed.
  - People page warns when Google or email is not set up. Sign-in page pre-fills `?email=`. Google always shows the account picker.
  - `env.AUTH_URL` (links in emails), `emailEnabled()`.
- Docs: `docs/NEXT-STEPS.md` § 7 step-by-step (Google Cloud OAuth, Internal consent screen, Gmail app-password SMTP, invites); README, .env.example.
- Verified in browser: Send invite → "Email isn't set up… printed in the server log"; setup warning shows.

## In progress
Nothing mid-edit.

## Next steps
1. Jeevan: Google Cloud OAuth client (NEXT-STEPS § 7A) and a mail sender (§ 7B); put values in `.env` / Railway. Then test Google
   sign-in with an @classrootsedu.com account and Send invite to a Gmail address.
2. Sheet sync is two-way today. Jeevan wants **app → sheet only** for APK (existing versions pushed too). Build a push-only mode
   (per work type sync config, skip pull/3-way diff) in `src/server/sync/google-sheet.ts` + Admin → Sheet sync toggle; then sheet steps § 2–4.
3. Railway (README § Railway, NEXT-STEPS § 5): Postgres, variables (incl. sign-in ones), domain + `AUTH_URL`, cron, move data, `/api/health`.
   Add the Railway URL to the Google OAuth client's origins and redirect URIs.
4. Remove demo users, add real people with APK roles, Send invite.
5. Later, only when Jeevan asks: build the Journey work type from the real Journey tracker.

## Blockers / open questions
- Needs Jeevan: Google Cloud + Workspace admin, a mailbox app password (or Resend), Railway account, approval of PR #6.
- Unverified: real Google sign-in, real SMTP send, live sheet sync, Railway deploy.

## Key files
- `docs/NEXT-STEPS.md`, `README.md` (Signing in, Inviting people, Deploy), `.ai/DECISIONS.md`, `.ai/LEARNINGS.md`.
- `src/server/auth.ts`, `src/server/mail.ts`, `src/lib/invite.ts`, `src/app/(auth)/signin/page.tsx`, `src/app/(app)/admin/users/`.
- `src/server/sync/google-sheet.ts`, `apps-script/Code.gs`, `prisma/schema.prisma`, `src/modules/`.
- Run locally: `npm run db:start` (tab 1), `npm run dev` (tab 2); demo sign-ins via `npm run demo:users`.
