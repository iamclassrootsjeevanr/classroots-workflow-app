# STATE — branch: jeevan/go-live
<!-- Overwritten on every handoff. Under 80 lines. Describes NOW. -->

Updated: 2026-11-03T06:40:00Z · by: cursor · owner: Jeevan

## Goal
Take Classroots Work live for APK Testing: sign-in for the Google organisation (classrootsedu.com) and for normal email users,
app → sheet sync for the APK tracker, deploy on Railway, real people with roles. Journey is NOT built now (only renamed).

## What exists (main + this branch, tsc clean, 117 tests)
- All feature work from PR #5 (UI, work type pages, roles per work type, inbox, APK on tables, Railway files).
- This branch (PR #6, needs one approval): theme fix after sign-in (`ThemeWatcher` gets `theme` prop), tile labels wrap,
  "Journey Applets" → "Journey" (migration 20261103120000_rename_journey), sign-in/invite work below, docs.

## Done this stretch (cursor) — sign-in model Jeevan asked for
- Only admin-added people (or ADMIN_EMAILS) sign in. `OFFICE_DOMAINS=classrootsedu.com` → Google only (refused for other
  domains); everyone else → email + admin-set password. Email magic link REMOVED (provider + /signin/check-email), ALLOWED_DOMAINS removed.
- `src/lib/invite.ts` (+ tests): signInMethod, missingPasswordProblem (non-office person must have a password), generatePassword,
  loginDetailsText, inviteEmail. `src/server/mail.ts` sends invites (optional EMAIL_SERVER).
- User form § 2 adapts to the email: office → "Sign in with Google, no password"; others → Password * + Generate + Copy login details.
- Sign-in page: "Classroots staff → Google" / "Everyone else → email + password" / "Forgot? Ask your admin".
- People page notes when OFFICE_DOMAINS / Google / email are missing; **Send invite** per person.
- Docs: `docs/NEXT-STEPS.md` § 7 rewritten as simple click-by-click steps + checklist; README, .env.example, AGENTS.md.
- Local `.env` now has OFFICE_DOMAINS=classrootsedu.com. Browser-checked Add user (Gmail → password + Generate) and sign-in page.

## In progress
Nothing mid-edit.

## Next steps
1. Jeevan: NEXT-STEPS § 7 steps 1–2 (OFFICE_DOMAINS, ADMIN_EMAILS, Google OAuth client → AUTH_GOOGLE_ID/SECRET), test Google
   sign-in with an @classrootsedu.com account; optional step 4 (Gmail app password → EMAIL_SERVER) for Send invite.
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
