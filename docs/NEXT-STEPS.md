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
2. App service → Variables: `DATABASE_URL` (the Postgres private URL + `?connection_limit=10&pool_timeout=20`), `AUTH_SECRET`, `AUTH_URL` (the public URL), `ADMIN_EMAILS`, `APP_TIMEZONE`, `APPS_SCRIPT_URL`, `SYNC_TOKEN`, `CRON_SECRET`, and for sign-in (§ 7) `OFFICE_DOMAINS`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, and optionally `EMAIL_SERVER`, `EMAIL_FROM`.
3. Generate a domain; set `AUTH_URL` to it; redeploy. The app runs the database migrations by itself on start.
4. Add a Railway **Cron** service every 5 minutes: `curl -fsS -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/run"`.
5. Move your data: `pg_dump` your local database and restore it into Railway, or start empty and run `npm run import:apk -- "<file>"` and `npm run import:xlsx -- "<file>"` against the Railway database.
6. Open `<your url>/api/health`: it must say `{"ok":true}`.

## 6. Before real users arrive

- Remove the demo accounts (Admin → People & access → deactivate or remove the `@demo.classroots.local` people) and never run `npm run demo:users` on the live database.
- Give real people their **roles per work type** (Admin → People & access). In APK Testing: Tester, App Developer, Test Lead, Viewer. In Journey: Developer, SME / Reviewer, Coordinator, Viewer.
- Admin emails go in `ADMIN_EMAILS`.

## 7. Who can sign in, and how

**The rule:** only people you (the admin) add in **People & access** can sign in. Nobody can sign themselves up.

| Person | How they sign in | What they get when you add them |
| --- | --- | --- |
| Office staff, email ends in `@classrootsedu.com` | **Sign in with Google** button | An invite email: "open the app, press Sign in with Google". No password. |
| Everyone else (Gmail, Outlook, school email, clients…) | Their **email + password** | An invite email with the app address, their email and the password you generated |

Forgot password (everyone else): they press **Forgot password?** on the sign-in page, get an email link, and choose a new password themselves. Office staff never need a password.

### Step 1 — Settings (2 minutes)

In `.env` (and later in Railway → Variables):

```
OFFICE_DOMAINS=classrootsedu.com
ADMIN_EMAILS=jeevan@classrootsedu.com
```

Restart the app (`Ctrl+C` in the `npm run dev` terminal, then `npm run dev`).

### Step 2 — Turn on "Sign in with Google" for office staff (15 minutes, once)

Do this in your browser, signed in with your `@classrootsedu.com` Google account (a Workspace admin if possible).

1. Open <https://console.cloud.google.com>.
2. At the top, click the project picker → **New project**. Name: `Classroots Work`. Location: `classrootsedu.com`. Click **Create**, then select the new project.
3. Left menu → **APIs & Services** → **OAuth consent screen** (on new consoles: **Google Auth Platform** → **Get started**).
   - App name: `Classroots Work`. User support email: your email.
   - Audience / User type: **Internal** (only `@classrootsedu.com` accounts can use it).
   - Contact email: your email → **Create** / **Save**.
4. Left menu → **Credentials** (or **Clients**) → **Create credentials** → **OAuth client ID**.
   - Application type: **Web application**. Name: `Classroots Work`.
   - **Authorized JavaScript origins** → Add URI: `http://localhost:3000`
   - **Authorized redirect URIs** → Add URI: `http://localhost:3000/api/auth/callback/google`
   - Click **Create**.
5. Copy the **Client ID** and **Client secret** into `.env`:
   ```
   AUTH_GOOGLE_ID=<Client ID>
   AUTH_GOOGLE_SECRET=<Client secret>
   ```
6. Restart the app. Open <http://localhost:3000/signin> → **Sign in with Google** → pick your `@classrootsedu.com` account.
7. Later, after Railway gives you a web address (§ 5), open the same OAuth client and **add** `https://<your-railway-address>` (origins) and `https://<your-railway-address>/api/auth/callback/google` (redirect URIs). Save.

### Step 3 — Let the app send emails (10 minutes, once)

Needed for invite emails and for **Forgot password?**. Without it, both are only printed in the server log and you must send people their login details yourself.

1. Choose the mailbox that sends: your own `jeevan@classrootsedu.com`, or a `no-reply@classrootsedu.com` mailbox.
2. Signed in as that mailbox: <https://myaccount.google.com/security> → turn on **2-Step Verification**.
3. Open <https://myaccount.google.com/apppasswords> → name `Classroots Work` → **Create** → copy the 16-letter password (remove the spaces).
4. In `.env` (write the `@` of the email as `%40`):
   ```
   EMAIL_SERVER=smtps://jeevan%40classrootsedu.com:<16-letter password>@smtp.gmail.com:465
   EMAIL_FROM=Classroots Work <jeevan@classrootsedu.com>
   ```
5. Restart the app. The "Email sending is not set up" note on People & access disappears.

### Step 4 — Add a person (every time someone joins)

Sign in as admin → **People & access** → **+ Add user**.

**Office person (`@classrootsedu.com`):**
1. Name and email, e.g. `asha@classrootsedu.com`. Section 2 shows "Sign in with Google. No password needed."
2. Section 3: switch on **APK Testing**, tick a role (Tester, App Developer, Test Lead or Viewer).
3. Section 4: leave **Email them an invite now** ticked → **Add user**.
4. Asha gets an email: open the app → **Sign in with Google**.

**Anyone else (e.g. `client@gmail.com`):**
1. Name and email.
2. Section 2: press **Generate** (a password like `Haxuttuq8m5x` appears).
3. Section 3: switch on **APK Testing**, tick a role.
4. Section 4: leave **Email them an invite now** ticked → **Add user**.
5. They get an email with the app address, their email and that password. They sign in under **Everyone else**, then change the password under **My account** (their name, bottom left).

The page then says "Added. Invite emailed." If it says the email could not be sent, press **Copy login details** before saving next time and send them yourself, or fix step 3 and press **Send invite** on their page (that emails a link to choose a password).

### Step 5 — When someone forgets their password

**They do it themselves:** sign-in page → **Forgot password?** → enter email → **Email me a reset link** → open the email (link works 1 hour, once) → type the new password twice → **Save password** → sign in.

**Or you do it:** People & access → their name → **Edit access** → section 2 → **Generate** → tick **Email them the new password** → **Save changes**.

Office staff use Google, so they never reset a password here.

**Remove access:** their name → **Deactivate**. They can no longer sign in; their past work stays.

### Checklist

- [ ] `OFFICE_DOMAINS` and `ADMIN_EMAILS` set
- [ ] Google OAuth client created, `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` set, Google sign-in tested
- [ ] `EMAIL_SERVER` / `EMAIL_FROM` set; add yourself a test person with a Gmail address and check the invite arrives
- [ ] **Forgot password?** tested with that Gmail person
- [ ] On Railway: the same variables, and the Railway address added to the Google OAuth client

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
npm run typecheck && npm test           # should be clean, 119 tests
```

Then say "resume" to the assistant: it reads `.ai/state/<branch>.md` (for `jeevan/go-live`: `.ai/state/jeevan__go-live.md`), `.ai/DECISIONS.md` and `.ai/LEARNINGS.md`. Demo sign-ins: `npm run demo:users` (password is `DEMO_PASSWORD` in `.env`).
