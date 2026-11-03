# Deploy Classroots Work (production) — do these in order

Production = Railway, deployed from the `main` branch, with a copy of this Mac's database (APK + Journey demo data and people).
About 1 hour. Keep this page open and tick each step.

Already done for you: the code is merged into `development` and `staging` (PRs #6, #7), the production build passes, and the
release pull request **#8 (staging → main)** is open with all checks green.

---

## Step 1 — Put the code on `main` (2 min)

On GitHub open pull request **#8 "Release to production"** → **Merge pull request** → choose **Create a merge commit** → confirm.
(It needs 1 approval; as the owner tick "Merge without waiting for requirements", or in the terminal: `gh pr merge 8 --merge --admin`.)

## Step 2 — Create the app and database on Railway (15 min)

1. <https://railway.com> → sign in with GitHub → **New Project** → **Deploy from GitHub repo** → `classroots-workflow-app`. Allow access to the repo if asked.
2. Click the new service → **Settings** → **Source** → Branch: **`main`**.
3. In the project: **+ Create** → **Database** → **PostgreSQL**. Wait until it is green.
4. App service → **Settings** → **Networking** → **Generate Domain**. Copy it, e.g. `https://classroots-work-production.up.railway.app`. This is your **app address**.
5. On your Mac, make a secret: `openssl rand -base64 32` → copy the output.
6. App service → **Variables** → **Raw Editor** → paste, fill the `<…>` parts → **Update Variables**:
   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}?connection_limit=10&pool_timeout=20
   AUTH_SECRET=<output of step 5>
   AUTH_URL=<app address from step 4>
   ADMIN_EMAILS=jeevan@classrootsedu.com,kishor@classrootsedu.com
   OFFICE_DOMAINS=classrootsedu.com
   APP_TIMEZONE=Asia/Kolkata
   ```
7. Railway redeploys by itself (**Deployments** tab, 3–5 min). When it shows **Active**, open `<app address>/api/health` → it must say `{"ok":true}`.

## Step 3 — Copy this Mac's data to the server (5 min)

1. Railway → **Postgres** service → **Variables** → copy the value of **`DATABASE_PUBLIC_URL`** (host like `xxx.proxy.rlwy.net`). It contains the password: only paste it in the terminal.
2. On the Mac, terminal 1: `npm run db:start` (leave it running).
3. Terminal 2, in the project folder:
   ```bash
   npm run db:copy -- --to '<DATABASE_PUBLIC_URL from 1>'
   ```
   It lists each table and ends with **"Done. Every table matches."** Sheet sync is switched off on the server.
4. Open the app address → sign in under **Everyone else** with **`etp4.creates@gmail.com`** and the demo password (`DEMO_PASSWORD` in your `.env`). You see the same APK versions as on the Mac (18, the newest 2.0.1.14_2026-11-02).
5. Right away: your name (bottom left) → **My account** → **Change password** (the demo password must not stay on a public site).

## Step 4 — Google sign-in for @classrootsedu.com (15 min)

Signed in to the browser with your `@classrootsedu.com` Google account:

1. <https://console.cloud.google.com> → project picker → **New project** → name `Classroots Work`, location `classrootsedu.com` → **Create** → select it.
2. **APIs & Services** → **OAuth consent screen** (or **Google Auth Platform** → **Get started**): app name `Classroots Work`, support email yours, Audience **Internal**, contact email yours → **Create**.
3. **Credentials** (or **Clients**) → **Create credentials** → **OAuth client ID** → **Web application**, name `Classroots Work`:
   - Authorized JavaScript origins: `<app address>` and `http://localhost:3000`
   - Authorized redirect URIs: `<app address>/api/auth/callback/google` and `http://localhost:3000/api/auth/callback/google`
   - **Create** → copy **Client ID** and **Client secret**.
4. Railway → app → **Variables** → add:
   ```
   AUTH_GOOGLE_ID=<Client ID>
   AUTH_GOOGLE_SECRET=<Client secret>
   ```
   (Also put both in your Mac's `.env` if you want Google locally.)
5. After the redeploy: open the app in a private window → **Sign in with Google** → `jeevan@classrootsedu.com` → you are in.

## Step 5 — Email for invites and "Forgot password?" (10 min)

1. Signed in as the mailbox that will send (e.g. `jeevan@classrootsedu.com`): <https://myaccount.google.com/security> → turn on **2-Step Verification**.
2. <https://myaccount.google.com/apppasswords> → name `Classroots Work` → **Create** → copy the 16 letters (no spaces).
3. Railway → app → **Variables** → add (the `@` in the email is written `%40`):
   ```
   EMAIL_SERVER=smtps://jeevan%40classrootsedu.com:<16 letters>@smtp.gmail.com:465
   EMAIL_FROM=Classroots Work <jeevan@classrootsedu.com>
   ```
4. After the redeploy, **People & access** no longer shows "Email sending is not set up".
   Test: sign out → **Forgot password?** → `etp4.creates@gmail.com` → the email arrives → choose a new password.

## Step 6 — People (10 min)

Signed in as admin → **People & access**:

1. Admins already in the copied data: **Jeevan** (`jeevan@classrootsedu.com`) and **Kishor** (`kishor@classrootsedu.com`), both with Google, plus `etp4.creates@gmail.com` and `etp2.creates@gmail.com`. More admins: their name → **Edit access** → **Admin** → **Save changes**.
2. **Deactivate** every remaining `@demo.classroots.local` account (Demo Client, Coordinator, Lead, Viewer). Their history stays.
3. Real office people (`@classrootsedu.com`): **+ Add user** → name, email → APK Testing role → keep **Email them an invite now** → **Add user**. If they are already in the list without an email (from the sheet), use **"Already in the system from the sheet?"** to pick them so their past work links up.
4. Others (Gmail etc.): **+ Add user** → name, email → **Generate** password → role → keep **Email them an invite now** → **Add user**. The email contains their password.
5. Swathi, Jeevan and Kishor already have office emails: press **Send invite** next to them.

## Step 7 — Optional: daily workload history

The workload chart fills from a job. Railway → **+ Create** → **Empty Service** → **Settings** → **Source: Docker Image** `curlimages/curl` → **Cron Schedule** `0 * * * *` → **Custom Start Command**:
```
curl -fsS -H "Authorization: Bearer <CRON_SECRET>" <app address>/api/cron/run
```
and add `CRON_SECRET=<another openssl rand -base64 32>` to the **app's** Variables (same value in the command).

---

## Later

- **Every new change:** branch from `development` → PR into `development` → "Release to staging" → "Release to production" (README "Branches and environments"). Railway redeploys `main` by itself.
- **Staging site:** Railway → Environments → Duplicate production → name `staging` → app branch `staging`; it gets its own database (`npm run db:copy -- --to <its DATABASE_PUBLIC_URL>`), its own `AUTH_URL`/`AUTH_SECRET`; add its address to the Google client.
- **Live data when Journey is ready:** `docs/NEXT-STEPS.md` § 6 "Later".
- **Problems:** Railway → app → **Deployments** → latest → **View logs**. `/api/health` not ok = database variable wrong.
