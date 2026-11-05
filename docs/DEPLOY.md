# Deploy Classroots Work — development, staging and production (do these in order)

One Railway project with **three environments**, each deploying its own branch, with its own database, address and secrets.
About 1.5 hours the first time. Keep this page open and tick each step.

| Environment | Branch | Gets code when | Database | Who uses it |
| --- | --- | --- | --- | --- |
| **production** | `main` | PR "Release to production" (`staging → main`) is merged | own Postgres, copy of this Mac's data now, live trackers later | the team |
| **staging** | `staging` | PR "Release to staging" (`development → staging`) is merged | own Postgres, copy of this Mac's data; can be wiped any time | Jeevan + Kishor test a release before production |
| **development** | `development` | PR `start-here → development` is merged | own Postgres, copy of this Mac's data; can be wiped any time | see every merged change on a real address |

**Already done:** the code is on `main` (7564280, PRs #6–#11), `development` and `staging` carry the same code plus docs, the production build passes, CI (`checks`) and `branch-flow` guard the branches. Nothing is on Railway yet.

**Who does what:** **Kishor** (`kishor@classrootsedu.com`, Google Workspace and Railway admin) does steps 1, 2, 4 and 5. **Jeevan** does step 3 (the local database is on his Mac) and step 6. For step 1 Railway must see the GitHub repo, so first either Jeevan adds Kishor on GitHub (repo → **Settings → Collaborators → Add people**) or Jeevan creates the Railway project and invites Kishor (Railway → project → **Settings → Members**). Both are admins in the app.

**Cost note:** three environments run three apps and three databases. Railway bills by usage; staging and development can be deleted later (Settings → Environments) if they are not used.

---

## Step 1 — Production on Railway (15 min)

1. <https://railway.com> → sign in with GitHub → **New Project** → **Deploy from GitHub repo** → `classroots-workflow-app`. Allow access to the repo if asked.
2. Click the new service → **Settings** → rename it `app` → **Source** → Branch: **`main`**.
3. In the project: **+ Create** → **Database** → **PostgreSQL**. Wait until it is green.
4. `app` → **Settings** → **Networking** → **Generate Domain**. Copy it, e.g. `https://app-production.up.railway.app`. This is the **production address**.
5. On a Mac terminal make a secret: `openssl rand -base64 32` → copy the output.
6. `app` → **Variables** → **Raw Editor** → paste, fill the `<…>` parts → **Update Variables**:
   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}?connection_limit=10&pool_timeout=20
   AUTH_SECRET=<output of step 5>
   AUTH_URL=<production address from step 4>
   ADMIN_EMAILS=jeevan@classrootsedu.com,kishor@classrootsedu.com
   OFFICE_DOMAINS=classrootsedu.com
   APP_TIMEZONE=Asia/Kolkata
   ```
7. Railway redeploys by itself (**Deployments** tab, 3–5 min). When it shows **Active**, open `<production address>/api/health` → it must say `{"ok":true}`.

## Step 2 — Staging and development environments (10 min)

Do this twice: once for `staging`, once for `development`.

1. Top bar → environment dropdown (`production`) → **+ New Environment** → **Duplicate Environment** → name `staging` (then `development`). Railway copies the `app` and `Postgres` services and their variables; the new Postgres is **empty** and separate.
2. A **staged changes** banner appears → **Deploy**.
3. In the new environment: `app` → **Settings** → **Source** → Branch: **`staging`** (or **`development`**).
4. `app` → **Settings** → **Networking** → **Generate Domain** → copy it (the **staging address** / **development address**).
5. `app` → **Variables**: set `AUTH_URL` to that address and `AUTH_SECRET` to a **new** `openssl rand -base64 32` (never reuse production's). `DATABASE_URL` already points at this environment's own Postgres; leave it.
6. Wait for **Active**, then open `<address>/api/health` → `{"ok":true}`.

Variables at a glance:

| Variable | production | staging | development |
| --- | --- | --- | --- |
| `AUTH_URL` | production address | staging address | development address |
| `AUTH_SECRET`, `CRON_SECRET` | own value | own value | own value |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}?connection_limit=10&pool_timeout=20` in every environment (resolves to that environment's database) | | |
| `ADMIN_EMAILS`, `OFFICE_DOMAINS`, `APP_TIMEZONE`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | same in all three | | |
| `EMAIL_SERVER`, `EMAIL_FROM` | set (step 5) | set, from name `Classroots Work (staging)` | leave empty: mails go to the server log |
| `APPS_SCRIPT_URL`, `SYNC_TOKEN` | not yet (sheet sync stays off until app → sheet sync is built) | | |

## Step 3 — Copy this Mac's data to each server (5 min each)

For each environment (production first, then staging, then development):

1. Railway → that environment → **Postgres** → **Variables** → copy the value of **`DATABASE_PUBLIC_URL`** (host like `xxx.proxy.rlwy.net`). It contains the password: only paste it in the terminal.
2. On the Mac, terminal 1: `npm run db:start` (leave it running).
3. Terminal 2, in the project folder:
   ```bash
   npm run db:copy -- --to '<DATABASE_PUBLIC_URL>'
   ```
   It lists each table and ends with **"Done. Every table matches."** Sheet sync is switched off in the copy. To refresh staging or development later with a new copy, add `--replace` (wipes that server's data; never do that on production without asking).
4. Open the address → sign in under **Everyone else** with **`etp4.creates@gmail.com`** and the demo password (`DEMO_PASSWORD` in your `.env`). You see the same APK versions as on the Mac (18, the newest 2.0.1.14_2026-11-02).
5. On **production** right away: your name (bottom left) → **My account** → **Change password** (the demo password must not stay on a public site). Do the same on staging and development, or deactivate the demo accounts there (step 6).

## Step 4 — Google sign-in for @classrootsedu.com (15 min)

One OAuth client serves all three servers and your Mac. Signed in to the browser with your `@classrootsedu.com` Google account:

1. <https://console.cloud.google.com> → project picker → **New project** → name `Classroots Work`, location `classrootsedu.com` → **Create** → select it.
2. **APIs & Services** → **OAuth consent screen** (or **Google Auth Platform** → **Get started**): app name `Classroots Work`, support email yours, Audience **Internal**, contact email yours → **Create**.
3. **Credentials** (or **Clients**) → **Create credentials** → **OAuth client ID** → **Web application**, name `Classroots Work`:
   - **Authorized JavaScript origins** (four): production address, staging address, development address, `http://localhost:3000`
   - **Authorized redirect URIs** (four): each of those + `/api/auth/callback/google`, e.g. `https://app-production.up.railway.app/api/auth/callback/google`
   - **Create** → copy **Client ID** and **Client secret**.
4. In **each** Railway environment: `app` → **Variables** → add:
   ```
   AUTH_GOOGLE_ID=<Client ID>
   AUTH_GOOGLE_SECRET=<Client secret>
   ```
   Also put both in the Mac's `.env` for Google locally.
5. After the redeploys: open each address in a private window → **Sign in with Google** → `jeevan@classrootsedu.com` → you are in.

## Step 5 — Email for invites and "Forgot password?" (10 min)

1. Signed in as the mailbox that will send (e.g. `jeevan@classrootsedu.com`): <https://myaccount.google.com/security> → turn on **2-Step Verification**.
2. <https://myaccount.google.com/apppasswords> → name `Classroots Work` → **Create** → copy the 16 letters (no spaces).
3. Railway → **production** → `app` → **Variables** → add (the `@` in the email is written `%40`):
   ```
   EMAIL_SERVER=smtps://jeevan%40classrootsedu.com:<16 letters>@smtp.gmail.com:465
   EMAIL_FROM=Classroots Work <jeevan@classrootsedu.com>
   ```
   **staging**: the same `EMAIL_SERVER`, but `EMAIL_FROM=Classroots Work (staging) <jeevan@classrootsedu.com>` so test mails are recognisable.
   **development**: leave both empty; invite and reset mails are printed in **Deployments → View logs** instead, so nobody gets mail from a test server.
4. After the redeploy, **People & access** on production no longer shows "Email sending is not set up".
   Test on production: sign out → **Forgot password?** → `etp4.creates@gmail.com` → the email arrives → choose a new password.

## Step 6 — People (10 min, production)

Signed in as admin on **production** → **People & access**:

1. Admins already in the copied data: **Jeevan** (`jeevan@classrootsedu.com`) and **Kishor** (`kishor@classrootsedu.com`), both with Google, plus `etp4.creates@gmail.com` and `etp2.creates@gmail.com` (Google only, so it cannot sign in: give it a password or deactivate it). More admins: their name → **Edit access** → **Admin** → **Save changes**.
2. The Journey team is already in the copied data with office emails and roles (Arjun, Aswin, Devjyoti and Vinay as coordinator + reviewer + creator; eight more SME creators; Jeevan and Kishor as program managers): press **Send invite** next to each. The old demo accounts are gone; only **Sourab** (`sourab@demo.classroots.local`, APK App Developer with test history) is left: give him his real email (**Edit access**) or **Deactivate** him. His history stays either way.
3. Real office people (`@classrootsedu.com`): **+ Add user** → name, email → APK Testing role → keep **Email them an invite now** → **Add user**. If they are already in the list without an email (from the sheet), use **"Already in the system from the sheet?"** to pick them so their past work links up.
4. Others (Gmail etc.): **+ Add user** → name, email → **Generate** password → role → keep **Email them an invite now** → **Add user**. The email contains their password.
5. Swathi, Jeevan and Kishor already have office emails: press **Send invite** next to them.

On **staging** and **development** do not add real people or press **Send invite**; they hold a copy for testing. Refresh them from production-like data with `npm run db:copy -- --replace` when needed.

## Step 7 — Optional: daily workload history

The workload chart fills from a job. Needed on production only. Railway → **production** → **+ Create** → **Empty Service** → **Settings** → **Source: Docker Image** `curlimages/curl` → **Cron Schedule** `0 * * * *` → **Custom Start Command**:

```
curl -fsS -H "Authorization: Bearer <CRON_SECRET>" <production address>/api/cron/run
```

and add `CRON_SECRET=<another openssl rand -base64 32>` to the **app's** Variables (same value in the command).

## Step 8 — Final check

| Check | production | staging | development |
| --- | --- | --- | --- |
| `<address>/api/health` says `{"ok":true}` | [ ] | [ ] | [ ] |
| **Sign in with Google** works for `jeevan@classrootsedu.com` | [ ] | [ ] | [ ] |
| APK versions page shows 18 versions | [ ] | [ ] | [ ] |
| Demo password changed or demo accounts deactivated | [ ] | [ ] | [ ] |
| **Forgot password?** mail arrives | [ ] | [ ] | n/a |
| Release flow: merge a small PR `start-here → development` → the development address redeploys on its own | | | [ ] |

---

## Every new change (release flow)

```
start-here ──PR (merge commit)──▶ development ──"Release to staging"──▶ staging ──"Release to production"──▶ main
                                   development site                      staging site                         production site
```

1. Work on `start-here`, open the PR into `development`, merge with **Create a merge commit** when CI is green. Railway deploys the **development** site.
2. When ready to test a release: `gh pr create --base staging --head development --title "Release to staging"` → merge → test on the **staging** site.
3. When staging is good: `gh pr create --base main --head staging --title "Release to production"` → needs 1 approval (as owner: `gh pr merge <n> --merge --admin`) → **production** redeploys.
4. A database migration in the change runs by itself on every start (`prisma migrate deploy` in the Dockerfile), on each environment in turn: development first, so a broken migration never reaches production untested.
5. Urgent production fix: `hotfix/<topic>` from `main` → PR into `main`, then PRs `main → staging` and `main → development` so the fix is not lost.

Details: README "Branches and environments".

## Later

- **Custom domain** (e.g. `work.classrootsedu.com`): Railway → production → `app` → **Settings → Networking → Custom Domain**, add the CNAME it shows in the Workspace DNS, then change `AUTH_URL` and add the new origin + redirect URI to the Google client.
- **Live data when Journey is ready:** `docs/NEXT-STEPS.md` § 6 "Later" — do it on staging first.
- **Sheet sync (app → sheet) when built:** add `APPS_SCRIPT_URL`, `SYNC_TOKEN` to production only and turn sync on in Admin → Sheet sync.
- **Problems:** Railway → environment → `app` → **Deployments** → latest → **View logs**. `/api/health` not ok = database variable wrong. Google sign-in error `redirect_uri_mismatch` = that environment's address is missing from the OAuth client (step 4.3). Sign-in loops back to the sign-in page = `AUTH_URL` does not match the address in the browser.
