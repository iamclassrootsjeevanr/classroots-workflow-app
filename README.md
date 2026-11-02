# Classroots Work

Work tracking, review and analytics for Classroots teams.

Every piece of work moves through a defined workflow, and every step is timestamped and attributed. The app then turns that history into dashboards: workload per person, time spent in each stage, review rounds, delays and stuck items. A Google Sheet can be kept in two-way sync, so teams who prefer the spreadsheet can keep using it.

Two work types ship today:

| Work type | What one item is | Flow |
| --- | --- | --- |
| **Journey Applets** | One SME journey that a developer turns into an applet | Received → Assigned → WIP → Review ↺ Corrections → Reviewed → Done |
| **APK Testing** | One test case run on one APK build | Not Tested → In Process → Pass / Fail → Fixed → Retest → Pass |

New work types are added as **modules** (one definition file each). No database migration is needed for a new work type.

Works on phones, tablets and desktops: tables turn into cards on small screens and the sidebar becomes a menu.

---

## Table of contents

1. [Quick start (about 10 minutes)](#quick-start-about-10-minutes)
2. [Everyday development](#everyday-development)
3. [Environment variables](#environment-variables)
4. [Demo accounts](#demo-accounts)
5. [Project structure](#project-structure)
6. [How the app works](#how-the-app-works)
7. [Work types](#work-types)
8. [People, roles and access](#people-roles-and-access)
9. [Signing in (Google, password, email link)](#signing-in)
10. [Appearance: theme, text size, density, sidebar](#appearance-theme-text-size-density-sidebar)
11. [Google Sheet two-way sync](#google-sheet-two-way-sync)
12. [Add a new kind of work](#add-a-new-kind-of-work)
13. [Database and migrations](#database-and-migrations)
14. [Tests and checks](#tests-and-checks)
15. [Deploy](#deploy)
16. [Scripts reference](#scripts-reference)
17. [Troubleshooting](#troubleshooting)
18. [Working with AI coding tools](#working-with-ai-coding-tools)
19. [Contributing](#contributing)

---

## Tech stack

| Layer | Tool |
| --- | --- |
| Framework | Next.js 15 (App Router, Server Components, Server Actions) |
| Language | TypeScript 5 |
| Database | PostgreSQL 16 through Prisma 6 (local: `embedded-postgres`, no install needed) |
| Auth | Auth.js v5 (Google OAuth, email + password, email magic link) |
| UI | React 19, Tailwind CSS v4, Recharts |
| Validation | Zod |
| Excel | ExcelJS (import and export) |
| Tests | Vitest |

---

## Quick start (about 10 minutes)

### 1. Prerequisites

- **Node.js 22** (20.18 or newer works). Check with `node -v`.
- **npm** (comes with Node).
- **Git**.
- You do **not** need to install PostgreSQL. The project runs its own local copy.

### 2. Get the code and install

```bash
git clone <repo-url> classroots-work
cd classroots-work
npm install --legacy-peer-deps
```

> `--legacy-peer-deps` is required because Auth.js v5 is still a beta and declares strict peer versions.

### 3. Create your `.env`

```bash
cp .env.example .env
```

Then fill in at least these values (see [Environment variables](#environment-variables) for all of them):

```bash
# a random secret for sessions
openssl rand -base64 32        # paste the output into AUTH_SECRET

ADMIN_EMAILS=you@yourcompany.com
DEMO_PASSWORD=Demo12345pass    # min 10 chars, letters + numbers
```

The default `DATABASE_URL` (`postgresql://user:password@localhost:5432/classroots_work`) works as-is for local development.

### 4. Start the database (keep this terminal open)

```bash
npm run db:start
```

The first run creates the database in `.pgdata/`. Leave this running and press `Ctrl+C` to stop it.

### 5. In a second terminal: create tables and base data

```bash
npx prisma migrate deploy   # create all tables
npm run db:seed             # roles, admins from ADMIN_EMAILS, work calendar, work types
npm run demo:users          # optional: one sign-in per role (see "Demo accounts")
```

### 6. (Optional) Load real data from the Excel trackers

```bash
npm run import:xlsx -- "$HOME/Downloads/JC-TrackerDemo.xlsx"          # Journey Applets
npm run import:apk  -- "$HOME/Downloads/APK Testing Tracker.xlsx"     # APK Testing
```

Both imports are safe to re-run. Items that already exist are skipped.

### 7. Run the app

```bash
npm run dev
```

Open <http://localhost:3000> and sign in with `admin@demo.classroots.local` and your `DEMO_PASSWORD`. You can also use the email link: with no email server set up, the link is printed in the terminal running `npm run dev`.

---

## Everyday development

**macOS one-click:** double-click **`start.command`**. It:
1. starts the database
2. applies any new migrations
3. starts the app
4. opens the browser

Close the window to stop everything.

**Any OS, by hand (two terminals):**

```bash
# terminal 1
npm run db:start

# terminal 2
npx prisma migrate deploy   # only needed after pulling new migrations
npm run dev
```

After you `git pull`, also run `npm install --legacy-peer-deps` if `package.json` changed. If `prisma/schema.prisma` changed, run `npx prisma generate`.

---

## Environment variables

All settings live in `.env`. It is git-ignored, so **never commit it**, and don't commit copies of it like `test.env.txt` either. `.env.example` is the template.

| Variable | Required | What it does |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection. Locally, `npm run db:start` reads the user, password, port and database name from it. |
| `AUTH_SECRET` | yes | Signs session tokens. Generate with `openssl rand -base64 32`. |
| `AUTH_URL` | yes in prod | Public URL of the app (`http://localhost:3000` locally). |
| `ADMIN_EMAILS` | yes | Comma-separated emails that are always admins. |
| `ALLOWED_DOMAINS` | no | Comma-separated domains whose Google users may sign up without an invite. |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | no | Enables "Sign in with Google". |
| `EMAIL_SERVER` | no | SMTP URL for magic-link emails. Empty means the link is printed in the server log. |
| `EMAIL_FROM` | no | Sender for magic-link emails. |
| `APP_TIMEZONE` | no | Team time zone for dates and business hours (default `Asia/Kolkata`). |
| `APPS_SCRIPT_URL` | for sync | `/exec` URL of the deployed `apps-script/Code.gs`. |
| `SYNC_TOKEN` | for sync | Shared secret between the app and the Apps Script (same value in both). |
| `CRON_SECRET` | for jobs | Protects `/api/cron/run`. The scheduler and Vercel Cron send it as a Bearer token. |
| `DEMO_PASSWORD` | local only | Password for `npm run demo:users` accounts. |

---

## Demo accounts

`npm run demo:users` creates or updates these accounts. They all use `DEMO_PASSWORD`.

| Email | Access |
| --- | --- |
| `admin@demo.classroots.local` | Admin (everything) |
| `jeevan@demo.classroots.local` | Developer (linked to the imported "Jeevan", so it shows real work) |
| `aswin@demo.classroots.local` | SME / Reviewer (linked to the imported "Aswin") |
| `coordinator@demo.classroots.local` | Coordinator (assigns and creates) |
| `lead@demo.classroots.local` | Developer + SME / Reviewer (shows how roles add up) |
| `viewer@demo.classroots.local` | Viewer (read-only) |

Deactivate or remove them under **Admin → People & access** before going live.

---

## Project structure

```
apps-script/
  Code.gs                          Google Sheet API: read rows, batch-write cells (token-protected, multi-sheet)
prisma/
  schema.prisma                    Database schema
  migrations/                      SQL migrations (applied with `prisma migrate deploy`)
  seed.ts                          Base data: system roles, admins, work calendar, work types
scripts/
  local-db.mjs                     Local embedded Postgres (`npm run db:start`)
  import-xlsx.ts                   Import the Journey tracker workbook
  import-apk-xlsx.ts               Import the APK Testing tracker workbook
  demo-users.ts                    Demo sign-ins
  set-password.ts                  Set a password from the terminal
  run-jobs.ts                      Run sheet sync + workload snapshot once
  scheduler.ts                     Calls /api/cron/run every N minutes (self-hosted)
src/
  modules/                         Work-type modules: the "what"
    types.ts                       WorkTypeDefinition contract
    registry.ts                    List of enabled module definitions
    journey-applet/definition.ts   Statuses, transitions, fields, sheet mapping
    apk-testing/definition.ts      Same, plus a per-APK-version summary
  lib/                             Pure logic, no database (unit-tested)
    workflow.ts                    Who may move which status; stage timestamps
    access-core.ts                 Roles → capabilities, data scope, pages
    analytics-core.ts              KPIs, flow times, workload, heatmap, funnel, stuck items
    sheet-core.ts                  Item ↔ sheet row mapping and 3-way sync diff
    groups.ts                      Group summaries (e.g. per APK version)
    time.ts                        Time zones, business hours, date parsing
    password.ts                    scrypt hashing and password rules
  server/                          Server-only code
    auth.ts                        Auth.js config (Google, password, magic link; invite-only)
    rbac.ts / access.ts            Current user and their access per work type
    services/work-items.ts         The ONLY write path for items
    services/analytics.ts          Dashboard data
    services/reports.ts            Report tables, CSV / Excel export
    services/work-types.ts         Enable / pause / archive work types; system roles
    sync/google-sheet.ts           Two-way sync engine
    sync/apps-script.ts            HTTP client for Code.gs
    jobs.ts                        Scheduled jobs (sync + daily workload snapshot)
    settings.ts                    Work calendar (business hours, holidays)
    env.ts                         Validated environment variables
  app/                             Pages and routes (Next.js App Router)
    (auth)/signin                  Sign-in and "check your email"
    (app)/admin                    Admin overview
    (app)/admin/users              People & access (list, add, edit)
    (app)/admin/roles              Roles editor
    (app)/admin/work-types         Enable / pause / archive work types
    (app)/admin/sync               Sheet sync settings and status
    (app)/my                       Personal dashboard (My work / Waiting for my review)
    (app)/w/[workType]             Item list for a work type
    (app)/w/[workType]/[itemId]    Item page (timeline, fields, feedback, activity)
    (app)/reports                  Reports (scoped to the user's access)
    (app)/account                  Change my password
    actions.ts                     Server actions called by the UI
    api/cron/run                   Scheduler endpoint (Bearer CRON_SECRET)
    api/reports/export             CSV / Excel download
  components/                      UI components (tables, forms, charts, heatmap, nav)
tests/                             Vitest unit tests
legacy/                            The original single-page tracker (reference only)
AGENTS.md                          Instructions for every AI coding agent (CLAUDE.md imports it)
.ai/                               Shared AI memory: per-branch state, decisions, learnings, kit scripts
.agents/skills/                    `handoff` and `resume` skills (mirrored into `.claude/skills/`)
```

---

## How the app works

### One write path

Every change to an item goes through `src/server/services/work-items.ts`, whether it comes from a button in the app, the Google Sheet or an import. In one database transaction it:

1. **Checks permission.** It looks at the user's roles in that work type, whether they are the assignee, and whether the work type is paused.
2. **Updates the item.** An optimistic `version` check stops two people overwriting each other.
3. **Writes an immutable event**: who, when, from → to, and whether the source was app, sheet or import.
4. **Closes and opens a stage interval.** This records time in each status in calendar minutes and business minutes.
5. **Queues a sheet write.** The changed cells go to `SyncOutbox`, if sync is on.

On the item page every detail field is its own row with **Edit** and **Delete** buttons (`FieldsForm` in `src/components/controls.tsx`). The same editor opens from the pencil at the end of every list row (`EditItemButton`), so details can be fixed without leaving the list; the server decides per item which fields the viewer may edit (`editableFieldsFor` in `src/server/view.ts`). Saving or deleting one field is one transaction and one `FIELD_CHANGED` event; Delete clears the value (sets it to empty) after an inline confirmation. Link fields (CMS, AI Tutor, build, APK) render as buttons that open in a new tab, on the item page and in the item lists.

```mermaid
flowchart LR
  ui["Button or select in the UI"] --> action["Server action (actions.ts)"]
  action --> svc["work-items service"]
  sheet["Google Sheet edit"] --> sync["Sync engine"]
  sync --> svc
  xlsx["Excel import"] --> svc
  svc --> item[("WorkItem")]
  svc --> evt[("WorkItemEvent")]
  svc --> iv[("StageInterval")]
  svc --> outbox[("SyncOutbox")]
  outbox --> sync
```

### Analytics come from the history

Events and stage intervals feed:
- lead time, cycle time and wait-before-start
- review turnaround and correction time
- review rounds and first-pass approval rate
- on-time percentage and delay
- **workload** per person (active items ÷ the person's **capacity**: Low / Normal / High / Overloaded)
- a person × day workload heatmap
- stuck-item alerts (business hours in a stage over the module's limit)

Business hours default to **Mon–Sat, 10:00–19:00** in `APP_TIMEZONE`. They are stored in the `AppSetting` "calendar" row, and holidays are stored in the `Holiday` table.

---

## Work types

### Journey Applets (`src/modules/journey-applet/definition.ts`)

`Received from SME → YTS (assigned) → WIP → Ready for Review → In Review → Corrections in Progress ↺ → Reviewed → Done`. Items can also go **On Hold** or **Blocked**.

- **Do the work** role (e.g. Developer), on their own items: start, submit, re-submit, withdraw, hold or block, and mark reviewed work done.
- **Review** role (e.g. SME / Reviewer): start review, approve, request corrections with feedback, and reopen.
- **Assign** / **Create** roles (e.g. Coordinator): assign developers and add journeys.
- **Admins**: everything, including setting any status.

### APK Testing (`src/modules/apk-testing/definition.ts`)

One item per **APK version × test case**, grouped by APK version.

`Not Tested → In Process → Pass / Fail / Not Reported`. A failure goes `Fail → Fixed (app developer) → Pending Retest → Pass`.

- **Testers** run cases, pass or fail them, retest, and fill in comments, bug and log date.
- **App developers** mark failures fixed and add developer remarks.
- Each APK version gets a summary row: total, pass, fail, pending retest, not tested and pass %. The result is **All passed**, **Stable** (≥ 90 %), **Good** (≥ 80 %), **Has failures** or **In progress**.

---

## People, roles and access

The Roles editor (Admin → Roles) is built from plain choices: can they make changes or only view, what they can do (work on, review, assign, add, edit details), which items they see, which pages they open. A panel beside each role, **What this means in the flow**, lists for every active work type the exact status moves and item details those choices unlock (`src/lib/role-preview.ts`), so a new role can be checked against the workflow before it is saved.

Everything is managed in the app under **Admin → People & access** and **Admin → Roles**. No code changes are needed.

**A role** (Admin → Roles) defines:
- **What it can do:** Do the work · Review · Assign people · Create items · Edit owner fields
- **Data scope:** *Own data* (assigned to, owned by or created by the person) or *All data*
- **Can edit:** unticked means view only
- **Pages:** Dashboard · Items · Reports · Export

**Built-in roles:** Developer, SME / Reviewer, Coordinator, Tester, App Developer, Viewer. You can add your own, such as QA or Client.

**A person's access in a work type is the sum of their roles there.** They get every capability and page any role grants, "All data" if any role has it, and edit rights if any role can edit. The same roles apply in every work type.

**Adding a person** (Admin → People & access → **Add user**) takes four steps:
1. Name, email, capacity and the Admin tick. If the person was imported from the sheet without an email, pick them from the list so their existing work links up.
2. An optional temporary password. Google and email links work too.
3. Tick each work type, then one or more roles in it. You can use "Copy access from…" another person.
4. Review and save.

**Capacity** is how many items a person can comfortably carry at once (default 3). It only drives the workload levels and the "least-loaded first" order in assign dropdowns. It never blocks an assignment.

**Removing a person:** **Deactivate** blocks sign-in and keeps their name on past work. **Remove** deletes them permanently and is only allowed for people with no work history.

The server enforces the same rules as the UI, in server actions and the export API, so hiding a button is never the only protection.

---

## Signing in

All three methods are **invite-only**. A person can sign in only if they already exist and are active, their email is in `ADMIN_EMAILS`, or their Google email's domain is in `ALLOWED_DOMAINS`.

| Method | Who it's for | Notes |
| --- | --- | --- |
| **Sign in with Google** | Staff | Shown when `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` are set. The first sign-in creates the account. |
| **Email + password** | Organizations and clients | An admin sets a temporary password; the user changes it under **My account**. "Remember me" keeps the session for 30 days; otherwise it lasts 12 hours. |
| **Email me a sign-in link** | Anyone without a password | Without `EMAIL_SERVER`, the link is printed in the server terminal. |

**First admin on a fresh server:** sign in with an `ADMIN_EMAILS` address using the email link. With no email server, run this instead:

```bash
npm run user:password -- you@company.com
```

### Google SSO setup

1. Google Cloud Console → APIs & Services → Credentials → **Create OAuth client** → *Web application*.
2. Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`, plus `<production URL>/api/auth/callback/google`.
3. Put the ID and secret in `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`. Optionally set `ALLOWED_DOMAINS`. Restart the app.

### Magic-link email in production

Set `EMAIL_SERVER` to an SMTP URL, for example `smtps://user:pass@smtp.example.com:465` (Google Workspace relay, Resend, SendGrid or SES), and set `EMAIL_FROM`.

---

## Appearance: theme, text size, density, sidebar

Every signed-in person has their own appearance settings under **My account → Appearance**:

| Setting | Options | Notes |
| --- | --- | --- |
| Theme | Light · Dark · System | *System* follows the device and switches live. |
| Text size | Small · Default · Large | Scales the whole UI, including tables and charts (everything is rem-based). |
| Density | Comfortable · Compact | Compact tightens card padding and table rows. |

Changes apply instantly (no reload) and are saved on the user (`User.prefs`), so they follow the person to every device. A `cr_prefs` cookie mirrors them so the sign-in page and the very first paint already use them; a tiny inline script in `src/app/layout.tsx` resolves *System* before the page is painted, so there is no flash.

- Colours live as CSS variables in `src/app/globals.css` (`:root` for light, `[data-theme='dark']` for dark) and are exposed to Tailwind through `@theme inline` as `bg-surface`, `text-muted`, `bg-ok-soft`, `text-brand` … Use those names in components; never raw palette classes like `bg-white` or `text-amber-700`.
- Status colours defined by a work type (hex) are rendered with the `.status-chip` rule, which mixes them toward the text colour so they stay readable on both themes.
- Charts (`src/components/charts.tsx`) read `var(--color-…)` strings, so they re-theme with no JavaScript.
- Icons come from `lucide-react`; nav icons are looked up by key in `src/components/icons.tsx`.
- Shared controls (`src/components/form.tsx`): `Checkbox`, `Radio`, `Switch` (one row each: control · label · help), `Segmented`, `OptionList`. Use them for every tick in the app.

**Sidebar.** On screens 1024px and wider the sidebar collapses to an icon rail with the button at its top or the `[` key; the state is kept in the `cr_nav` cookie so the next page loads with the same width. Below 1024px the menu is a slide-over drawer (Escape closes it).

---

### APK version chart and table

On the APK Testing list, the dashboards and Reports, the per-version summary is a full-width chart with the table underneath. Versions run left to right in release order. Each column stacks that build's test results (Pass, Fail, Pending retest, Not tested, Other). A line on the right-hand 0 to 100% axis shows the pass rate per build, with dashed lines at the tracker's Good (80%) and Stable (90%) cut-offs, so improving or regressing builds stand out at a glance. Hover a column for the full version name and every count. A work type opts in through `groupSummary` (`successSeries`, `rateLines`) in its module definition; the data comes from `groupTrend` in `src/lib/groups.ts`.

### Roles follow the work type

Roles are made from a work type's flow, not the other way round. A work type has many roles; a role belongs to exactly one work type (`AccessRole.workTypeId`). A module lists its roles in `roles` in its definition (see `src/modules/apk-testing/definition.ts`); if it lists none, they are derived from who may move statuses and edit fields (`rolesForModule` in `src/modules/roles.ts`). Roles are created when a work type is enabled and again whenever its module gains a role (`ensureModuleRoles`); existing roles are never overwritten. Admin → Roles shows one tab per work type with only that work type's roles, and when giving someone access you pick from that work type's roles. A test fails if a flow needs a capability that none of its roles has.

To add a work type: write its module (statuses, transitions, fields, and optionally `roles`), register it, enable it. Its roles appear on their own.

### Work type pages

Each work type has its own pages, shown as tabs under its name (code: `src/app/(app)/w/[workType]/(tabs)/`):

| Page | Content | APK Testing name |
|---|---|---|
| Overview | Metrics and graphs only: KPIs, status, work per person, weekly flow, needs attention | Overview |
| Groups (if the module has a group summary) | Full-width chart, then the table; versions are added and edited here | APK versions |
| Items | Filters and the item table; single items are added here | Test execution |
| Cases (if the module has `versions`) | One row per test case across versions; edit a case here | Test cases |

Tab names come from `pages` in the module definition. Item pages open without tabs. Old links like `/w/apk-testing?status=fail` redirect to the Items page. On My dashboard every section's metrics and graphs come first and the item tables follow, one table per work type.

**Clickable analytics.** On every Overview, KPI tiles, By status slices, per-person bars, version columns and Latest-version cards open the Items page with the matching filter applied (`cat`, `status`, `dev`, `group`, `scope=overdue`). The same links work on My dashboard and the admin overview when one work type is in view. By status and the per-person bars leave Done out; Done is on its own tile.

**Own-data roles.** A person whose role sees only their own data gets "You vs team average" instead of the per-person chart. The team side is aggregates only; no colleague appears anywhere on the page.

**Sidebar.** Each work type has its own icon (`icon` in the module definition) and a dropdown of its pages. Tab names and icons come from `workTypeTabs` in `src/lib/work-type-tabs.ts`.

### APK Testing: versions, bugs and the time log

- **Add a version.** Testers (the Tester role has "Add new items") and admins press **New APK version**: version name, APK link, release date and notes, then pick an earlier version to copy test cases from (untick any, add extra cases). The tests start as Not Tested, with bug, comments and remarks empty, and the creator is the tester unless an assigner picks someone else. **Add test case** adds one test to an existing version. The pencil in the By APK version table edits the link, date and notes of every test in that version. Code: `src/lib/apk-versions.ts` (pure planner), `src/server/services/apk-versions.ts`, `src/components/new-apk-version.tsx`.
- **Lean list.** The APK list drops Owner, Expected and Delay and shows Priority, Bug / issue, Developer remarks and Last update instead. A module controls this with `table: { hide, extra }`.
- **Bug and remarks.** On a test's page, the tester writes the bug / issue and the developer writes remarks in their own cards. Each shows who edited last and when.
- **Time log.** Every test has a log of status changes, bug and remark edits, comments and assignments, each with who and when, plus how long the test sat in the status it left. Totals show time to first result, times failed, waiting for fix and waiting for retest. Code: `src/lib/time-log.ts`, `src/components/time-log.tsx`; a module opts in with `timeLog: true`.

### Data grids (spreadsheet feel, modern look)

The item lists, the per-group summary (for example By APK version) and the report tables share one grid (`<Sheet>` in `src/components/sheet.tsx` with the `.sheet` styles in `globals.css`). It has no gridlines; it behaves like a spreadsheet instead. Columns keep their natural width and the grid scrolls sideways with always-visible scrollbars and a fade at the right edge. The header row, the first column and the Actions column stay pinned. Click a cell, then use the arrow keys, Home or End to move; Ctrl or Cmd plus C copies the cell. To use it on a new table: wrap it in `<Sheet>`, give the table `className="sheet"`, and put `className="pin"` on the first column's cells (and `pin-end` on an actions column).

**Inbox and undo.** After a delete, a toast (bottom left) offers Undo for 5 seconds, then the message lives in your **Inbox** (sidebar, above your name) where Undo stays for 30 minutes: click the message to show its Undo button. After Undo, or when the 30 minutes are over, the message moves to Read. The Inbox popover shows the latest unread messages and links to the full `/inbox` page (All / Unread / Read, search, select, mark read, delete). The same inbox also tells you when you are assigned something or get feedback. To notify someone from new code call `notify(db, userId, { kind, title, body, href, data })` from `src/server/services/notifications.ts`; new kinds need no migration. After 30 minutes a row can no longer be restored from the app (`UNDO_DELETE_MINUTES` in `src/lib/workflow.ts`).

**Speed.** Item tables are paged (50 per page on the Items page; the first 50 per work type on My dashboard, with an Open all link). The Edit dialog loads a row's fields only when opened, and status and assignee selects update instantly while the save finishes. Dev mode (`npm run dev`) is slower than the real thing; check speed with `npm run build && npm start`.

Every item row has **Edit** (opens that item's fields) and **Delete** (asks first). Delete is for admins and anyone who can edit item details. It archives the item: it leaves every list, report and dashboard and its page returns 404, but its history stays in the database. The Google Sheet row is not touched and will not bring the item back.

---

## Google Sheet two-way sync

Postgres is the source of truth. Sync is **off** until an admin turns it on, so nothing touches the live sheet by accident.

### Setup (once)

1. Open the Google Sheet → **Extensions → Apps Script**. Replace the code with `apps-script/Code.gs`.
2. **Project Settings → Script properties**: add `SYNC_TOKEN` with the same value as in `.env`.
3. **Deploy → Manage deployments → ✎ → New version → Deploy.** Put the `/exec` URL in `APPS_SCRIPT_URL`.
4. In the app: **Admin → Sheet sync**. Tick **Two-way sync**, check the tab name, **Save**, then **Sync now**.

One deployment can serve several trackers. For a work type whose data lives in another spreadsheet (for example APK Testing), paste that sheet's **Spreadsheet ID** on the Sheet sync page. The script owner needs access to that sheet. Keys can be composite: APK Testing matches rows on `APK Version` + `Test Case ID`.

### What happens on each sync

1. **Push:** queued app changes are written to the sheet. New rows are appended, and an `App Updated At` column is stamped.
2. **Pull:** every row is read and compared three ways: the sheet now, the last agreed snapshot, and the app now.
   - Changed only in the sheet: applied in the app as a "from sheet" event.
   - Changed only in the app: queued for the next push.
   - Changed in both: **the app wins**. The conflict is logged and listed on the Sheet sync page.
   - A new row in the sheet: a new item is created.
   - A row removed from the sheet: the item is **flagged**, never deleted.

Sync runs on **Sync now**, from `npm run sync:run`, and on a schedule: the Docker `scheduler` service every 5 minutes, or Vercel Cron every 10 minutes.

> If you edit `Code.gs`, deploy a **new version**. Otherwise the old code keeps running behind the same URL.

---

## Add a new kind of work

1. Copy `src/modules/journey-applet/definition.ts` to `src/modules/<your-key>/definition.ts` and define:
   - `statuses`: each with a **category** (`queue`, `active`, `review`, `feedback`, `approved`, `done` or `hold`). Categories drive all the analytics.
   - `transitions`: who may move from which status to which. Use a capability (`work`, `review`, `assign`, `create`, `manageFields`) or `ASSIGNEE`.
   - `fields` and `dataSchema`: module-specific fields, stored in `WorkItem.data` (JSON).
   - `columns`: the list table columns.
   - optionally `sheet` (the column mapping for sync), `groupSummary`, `stuckAfterHours` and `labels`.
2. Add it to `src/modules/registry.ts`.
3. In the app: **Admin → Work types → Enable**, then give people roles in it.

Lists, item pages, dashboards, reports, workload and sync all work from the definition. **No migration is needed.**

---

## Database and migrations

```bash
npm run db:studio                         # browse and edit data in the browser (Prisma Studio)
npm run db:migrate -- --name my_change    # after editing schema.prisma: create and apply a migration (dev)
npx prisma migrate deploy                 # apply committed migrations (CI / prod / after pulling)
npx prisma generate                       # regenerate the Prisma client after schema changes
npx prisma migrate reset                  # ⚠ wipe the local DB, re-apply migrations and re-seed
```

- Commit every new folder under `prisma/migrations/`. Never edit a migration that's already committed; add a new one instead.
- Local data lives in `.pgdata/` (git-ignored). Deleting it with the database stopped gives you a fresh database.

---

## Tests and checks

```bash
npm test             # Vitest: workflow rules, access, business hours, analytics, sync diff, groups, passwords, preferences
npm run typecheck    # TypeScript, no emit
npm run build        # production build (also catches route and type errors)
```

The pure logic lives in `src/lib/` precisely so it can be unit-tested without a database. When you change it, add or update a test in `tests/`.

---

## Deploy

### Docker (any server)

```bash
cp .env.example .env     # fill in secrets; DATABASE_URL is overridden by docker-compose
docker compose up -d --build
```

This starts three services:
- **db**: Postgres 16
- **app**: applies migrations on start, then serves on port 3000
- **scheduler**: calls `/api/cron/run` every 5 minutes

No seed step is needed:
- the first sign-in from an `ADMIN_EMAILS` address creates that admin
- **Admin → Work types → Enable** creates a work type
- turning on sync pulls every row in

To load the Excel files instead, run the import scripts from a checkout whose `DATABASE_URL` points at the server database.

### Vercel + managed Postgres (Neon, Supabase, …)

- Set the variables from `.env.example`, including `CRON_SECRET` and `AUTH_URL` = your public URL.
- Build command: `prisma migrate deploy && npm run build`.
- `vercel.json` schedules `/api/cron/run` every 10 minutes.

---

## Scripts reference

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on <http://localhost:3000> |
| `npm run db:start` | Local PostgreSQL (embedded, data in `.pgdata/`) |
| `npm run build` / `npm start` | Production build / run |
| `npm test` | Unit tests |
| `npm run typecheck` | TypeScript check |
| `npm run db:migrate` | Create and apply a migration (dev) |
| `npm run db:deploy` | Apply committed migrations |
| `npm run db:seed` | System roles, admins from `ADMIN_EMAILS`, work calendar, work types |
| `npm run db:studio` | Browse the database |
| `npm run demo:users` | Create the demo sign-ins |
| `npm run user:password -- <email>` | Set someone's password from the terminal |
| `npm run import:xlsx -- <file>` | Import the Journey tracker workbook (safe to re-run) |
| `npm run import:apk -- <file>` | Import the APK Testing workbook (safe to re-run) |
| `npm run sync:run` | Run sheet sync and the workload snapshot once |
| `npm run scheduler` | Call `/api/cron/run` every N minutes (self-hosted) |

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `npm install` fails with peer-dependency errors | Use `npm install --legacy-peer-deps`. |
| `db:start` says something is already listening on 5432 | Another Postgres is running. Stop it, or change the port in `DATABASE_URL`. |
| `Can't reach database server at localhost:5432` | Start the database first with `npm run db:start` in its own terminal. |
| `@prisma/client did not initialize` or missing model errors | Run `npx prisma generate`, then restart `npm run dev`. |
| Tables or columns missing after a pull | Run `npx prisma migrate deploy`. |
| Magic-link email never arrives (local) | Expected without `EMAIL_SERVER`. Copy the link from the `npm run dev` terminal. |
| "This account has not been invited yet" | Add the person under Admin → People & access, or add the email to `ADMIN_EMAILS`. |
| "Google sign-in isn't set up" | Set `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` and restart. |
| Sync error: "the deployed Apps Script is the old version" | Paste the current `apps-script/Code.gs`, add `SYNC_TOKEN`, and deploy a **new version**. |
| Sync error "Unauthorized" | `SYNC_TOKEN` in `.env` doesn't match the Apps Script property. |
| A sidebar link is missing for a user | Check their roles for that work type: pages come from the roles (Admin → Roles). |
| `demo:users` fails | Set a valid `DEMO_PASSWORD` (min 10 chars, letters + numbers) and run `npm run db:seed` first. |

---

## Working with AI coding tools

The repo carries its own memory for AI assistants, so Claude Code, Codex and Cursor (desktop or web) can pick up where another tool or teammate left off. This is managed by **ai-continuity-kit** (version in `.ai/.kit-version`). Nothing to install beyond Python 3.8+, which the kit scripts use.

### Daily use

| You want to… | Do this |
| --- | --- |
| Start work | `git checkout -b <your-name>/<topic>`, then type **`resume`** in your AI tool |
| Stop, switch tool, or switch machine | Type **`handoff`**. The agent writes the state file, commits everything on your branch and pushes |
| See where a branch stands without an agent | `python3 .ai/bin/context.py --pull` |
| Ship | Open a pull request and squash-merge into `main` |

`handoff` refuses to run on `main` and the other branches in `.ai/config.json`, so shared branches never get work-in-progress commits. It also blocks commits that look like they contain secrets.

### What lives in `.ai/`

| Path | Who edits it | What it is |
| --- | --- | --- |
| `state/<branch>.md` | the branch owner (via `handoff`) | Goal, what is done, what is half-finished, next steps. Overwritten each handoff, under 80 lines |
| `DECISIONS.md` | everyone | Lasting choices (library, data shape, naming) and why. Append-only |
| `LEARNINGS.md` | everyone | Gotchas and "how it really works here". Curated, not a log |
| `log/<branch>.md` | `checkpoint.py` | One line per handoff on that branch |
| `mcp.json` | everyone | MCP servers for all tools. After editing, run `python3 .ai/bin/sync.py`; never hand-edit `.mcp.json`, `.cursor/mcp.json` or `.codex/config.toml` |
| `config.json` | everyone | Protected branches |
| `bin/` | the kit | `context.py` (resume), `checkpoint.py` (handoff), `sync.py` (skills and MCP fan-out) |

Project rules for agents live in [AGENTS.md](AGENTS.md). `CLAUDE.md` only imports it, so there is one place to edit. Files owned by the kit are overwritten when someone upgrades it with `aikit .`, so put repo-specific guidance in `AGENTS.md`, not in `.ai/bin/`.

### Branch names in state and log files

A `/` in the branch name becomes `__` in the file name: branch `jeevan/ui-redesign` has its state in `.ai/state/jeevan__ui-redesign.md`.

---

## Contributing

1. **Branch** from `main`: `<your-name>/<short-topic>` (one person per branch; AI handoffs refuse `main`).
2. **Keep the layers:**
   - business rules go in `src/lib/` (pure and tested)
   - database access goes in `src/server/`
   - pages go in `src/app/`
   - every item change goes through `services/work-items.ts`
3. **Schema change?** Run `npm run db:migrate -- --name <what_changed>` and commit the migration folder.
4. **Before pushing:** run `npm run typecheck && npm test`.
5. **Never commit secrets:** `.env`, copies of it, `.pgdata/` or tokens. Use `.env.example` for new settings, with an empty value and a comment.
6. Open a pull request with a short description and screenshots for UI changes.
7. **Using an AI tool?** Type `handoff` before you stop so the next session can `resume`. See [Working with AI coding tools](#working-with-ai-coding-tools).

---

## Legacy

`legacy/` holds the original single-page tracker: `index.html` plus a `serve.py` proxy to the Apps Script. It is kept for reference only. It isn't built, deployed or maintained.
