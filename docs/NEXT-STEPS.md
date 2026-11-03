# Next steps (simple, in order)

Written at the end of the redesign + APK database session. Do them top to bottom. Each step says where to click and what you should see.

## 1. Merge the work into `main` — DONE

The redesign, work type pages, roles per work type, inbox, APK database tables and Railway files are in `main` (squashed commit `4abce15`, PR #5). The old branches `jeevan/ui-redesign` and `jeevan/apk-database` are deleted on GitHub and on this machine.

Start any new work from `main` on a new branch: `git checkout main && git pull && git checkout -b <your-name>/<topic>`. The next topic is `jeevan/go-live` (steps 2 to 6 below); its state file is `.ai/state/jeevan__go-live.md`.

Note: `main` requires one approval on pull requests. PR #5 was merged with admin rights. For later PRs ask a teammate to approve, or use `gh pr merge <number> --squash --admin` as the owner.

## 2. Make the APK tracker a Google Sheet the script can use

The app syncs with the **APK Testing Tracker**. It must be a real Google Sheet (not an uploaded Excel file).

1. Upload `APK Testing Tracker.xlsx` to Google Drive, open it, and choose File → **Save as Google Sheets**.
2. File → Settings → set the **Time zone** (Asia/Kolkata).
3. Check that these tabs and **exact column headers** exist (row 1):

| Tab | Row 1 headers | Notes |
| --- | --- | --- |
| **Test Execution** | APK Version, Test Case ID, Feature / Module, Tested By, Status, Comments, Bug / Issue, Priority, Developer Remarks, Log Date | The app adds an **App Updated At** column by itself. Dropdowns here can stay as they are. |
| **APK Releases** | APK Version, Release Date, APK Link, Notes | One row per APK version. |
| **Test Cases** | Test Case ID, Feature / Module, Test Scenario, Expected Result, Default Priority, Test Steps | One row per test case. |
| **Lists** | A: Tested By, B: Status, C: Priority, D: APK Versions | **Column D is a formula** (FILTER over APK Releases). Never type in it. Tested By names go in column A. |
| **Version Summary** | APK Version, Release Date, Total Tests, Pass, Fail, … | One formula row per release, then a **Total** row. The app copies the last row for a new version. |

4. Share this Google Sheet with the **same Google account that owns the Apps Script** (Editor).

## 3. Put the latest script in Google Apps Script

1. Open your Apps Script project (the one whose web-app URL is in `.env` as `APPS_SCRIPT_URL`). If you made a new "Untitled project", use that one and replace the URL in step 4.
2. Open `apps-script/Code.gs` from this repo, copy **everything**, paste it over the project's code, save.
3. Project Settings (gear) → **Script properties** → add `SYNC_TOKEN` with the same value as `SYNC_TOKEN` in the app's `.env`.
4. Click **Run** once (function `doGet`) → Review permissions → Advanced → "Go to project" → Allow (this includes Google Drive; the script needs it to find tabs by name).
5. **Deploy → Manage deployments → pencil → New version → Deploy**. (New project: Deploy → New deployment → Web app → Execute as **Me**, Who has access **Anyone**.)
6. If the URL changed, put the new `/exec` URL in `.env` as `APPS_SCRIPT_URL` and restart the app.

You do **not** need a Spreadsheet ID. The script finds the tab by name. (The default tracker is the Journey sheet set as `SHEET_ID` at the top of `Code.gs`.)

## 4. Turn sync on in the app

1. Sign in as admin → **Admin → Sheet sync**.
2. **Journey**: tab `Journeys in Chapters`. **APK Testing**: tab `Test Execution`. Leave Spreadsheet ID empty. Switch sync **on**, press **Sync now**.
3. You should see "pulled N rows" and no red error. Then add a test APK version in the app (APK versions → New APK version) and press Sync now: check the sheet gets a row in **APK Releases**, new cases in **Test Cases**, a new row in **Version Summary**, and the version in **Lists** (via the formula), then the tests in **Test Execution**.

If you see an error:

| Message | Fix |
| --- | --- |
| Unauthorized | `SYNC_TOKEN` differs between `.env` and the script property. |
| Tab not found | The Google account that owns the script cannot open the sheet (share it), or the tab name differs (spelling, spaces). |
| Invalid argument: timeZone | Paste the latest `Code.gs` and deploy a new version. |
| Data validation rules | Paste the latest `Code.gs` and deploy a new version. |
| Lists shows `#REF!` | Something was typed into Lists column D. Clear D3 downwards so the FILTER formula in D2 can spill again. |
| "old version" of the script | Deploy a **new version**, not just save. |

## 5. Put the app online (Railway)

Full steps with variable names are in the README under **Deploy → Railway**. Short version:

1. railway.app → New project → Deploy from GitHub repo → pick this repo. Add the **PostgreSQL** plugin.
2. App service → Variables: `DATABASE_URL` (the Postgres private URL + `?connection_limit=10&pool_timeout=20`), `AUTH_SECRET`, `AUTH_URL` (the public URL), `ADMIN_EMAILS`, `APP_TIMEZONE`, `APPS_SCRIPT_URL`, `SYNC_TOKEN`, `CRON_SECRET`, and for sign-in (§ 7) `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ALLOWED_DOMAINS`, `EMAIL_SERVER`, `EMAIL_FROM`.
3. Generate a domain; set `AUTH_URL` to it; redeploy. The app runs the database migrations by itself on start.
4. Add a Railway **Cron** service every 5 minutes: `curl -fsS -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/run"`.
5. Move your data: `pg_dump` your local database and restore it into Railway, or start empty and run `npm run import:apk -- "<file>"` and `npm run import:xlsx -- "<file>"` against the Railway database.
6. Open `<your url>/api/health`: it must say `{"ok":true}`.

## 6. Before real users arrive

- Remove the demo accounts (Admin → People & access → deactivate or remove the `@demo.classroots.local` people) and never run `npm run demo:users` on the live database.
- Give real people their **roles per work type** (Admin → People & access). In APK Testing: Tester, App Developer, Test Lead, Viewer. In Journey: Developer, SME / Reviewer, Coordinator, Viewer.
- Admin emails go in `ADMIN_EMAILS`.

## 7. Sign-in: Google for the organisation, email for everyone else

Two kinds of people:

| Who | How they sign in | What you set up |
| --- | --- | --- |
| Classroots staff (`@classrootsedu.com`) | **Sign in with Google** | Google OAuth client (A) + `ALLOWED_DOMAINS` |
| Clients, partners, anyone with Gmail, Outlook, school mail… | **Email + password**, or **Email me a sign-in link** | An email sender (B), or give them a temporary password |

Nobody can sign in unless they were added in **People & access**, are in `ADMIN_EMAILS`, or (Google only) have an `ALLOWED_DOMAINS` email.

### A. Google sign-in (organisation)

Do this signed in as a Google Workspace admin of classrootsedu.com.

1. Open [console.cloud.google.com](https://console.cloud.google.com) → project picker → **New project** → name `Classroots Work`, organisation `classrootsedu.com` → Create.
2. **APIs & Services → OAuth consent screen** (or "Google Auth Platform → Branding"): app name `Classroots Work`, support email yours. **Audience / User type: Internal**. Internal means only `@classrootsedu.com` Google accounts can use it. Save.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application**, name `Classroots Work`.
   - Authorized JavaScript origins: `http://localhost:3000` and your Railway URL, e.g. `https://classroots-work.up.railway.app`.
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google` and `https://<railway-url>/api/auth/callback/google`.
4. Copy the **Client ID** and **Client secret**. Put them in `.env` (local) and Railway → Variables:
   ```
   AUTH_GOOGLE_ID=<client id>
   AUTH_GOOGLE_SECRET=<client secret>
   ALLOWED_DOMAINS=classrootsedu.com
   ADMIN_EMAILS=jeevan@classrootsedu.com
   ```
   `ALLOWED_DOMAINS` lets any classrootsedu.com person sign in with Google without being added first. They see "No access yet" until you give them roles. Leave it empty if you want to add every person yourself.
5. Restart the app. The sign-in page's **Sign in with Google** now works, and Google always asks which account to use.

### B. Email sender (for sign-in links and invites)

Pick one. Both give you an `EMAIL_SERVER` value.

- **Google Workspace mailbox (simplest):** use a mailbox such as `no-reply@classrootsedu.com` (or your own). Turn on 2-Step Verification for it, then [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) → create an app password `Classroots Work` (16 letters, no spaces).
  ```
  EMAIL_SERVER=smtps://no-reply%40classrootsedu.com:<app password>@smtp.gmail.com:465
  EMAIL_FROM=Classroots Work <no-reply@classrootsedu.com>
  ```
  The `@` in the user name is written `%40`. Gmail sends about 2,000 mails a day per mailbox, plenty here.
- **Resend / SendGrid / Brevo:** create an account, verify the `classrootsedu.com` domain (DNS records), create an SMTP key, and use the SMTP URL they show (e.g. `smtps://resend:<api key>@smtp.resend.com:465`).

Restart the app. **People & access** no longer shows "Email is not set up".

### C. Add people and invite them

1. **People & access → + Add user**: name, email, roles per work type. For a client without Google you may type a **temporary password**.
2. On their page (or in the list) press **Send invite**. The email tells them how to sign in:
   - `@classrootsedu.com` → "Sign in with Google".
   - Others with a password → sign in with email + the password you share privately (never sent by email).
   - Others without a password → "Email me a sign-in link". They can set a password later under **My account**.
3. The invite link opens the sign-in page with their email already filled in.

Without an email sender, **Send invite** and sign-in links are only printed in the server log, so give people a temporary password and the app address yourself.

## 8. Build further (next sessions)

1. **Build the Journey work type** (later, from the real Journey tracker). Journey on database tables like APK: follow the pattern in README "APK Testing data model" (shared facts in their own tables, one link table to the run, hydrate on read, `FieldDef.source` for fields that live in shared tables, `storage` flag on the module, migration that moves existing data).
2. **New work types:** write a module (statuses, transitions, fields, `roles`, optional `sheet.linked`), register it, enable it in Admin → Work types. Its roles appear on their own. Every tile and chart must link to the filtered item list (`itemsUrl`); a test enforces `seriesStatuses`.
3. **Scale:** Overview and APK versions still read every run of a work type. Move them to SQL counts when a work type passes about 50,000 runs.
4. **Checks not yet done:** a real Railway deploy, Google sign-in and email sending with real credentials.

## 9. How to resume in a new session or another tool

```bash
git checkout main && git pull           # or: git checkout jeevan/go-live
npm install
npm run db:start                        # terminal 1: local database
npm run db:deploy && npm run db:seed    # once: migrations, roles, work types
npm run dev                             # terminal 2: http://localhost:3000
npm run typecheck && npm test           # should be clean, 112 tests
```

Then say "resume" to the assistant: it reads `.ai/state/<branch>.md` (for `jeevan/go-live`: `.ai/state/jeevan__go-live.md`), `.ai/DECISIONS.md` and `.ai/LEARNINGS.md`. Demo sign-ins: `npm run demo:users` (password is `DEMO_PASSWORD` in `.env`).
