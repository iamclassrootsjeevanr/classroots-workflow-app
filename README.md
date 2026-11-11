# Classroots Work

Work tracking, review and analytics for Classroots teams.

Every piece of work moves through a defined workflow, and every step is timestamped and attributed. The app then turns that history into dashboards: workload per person, time spent in each stage, review rounds, delays and stuck items. A Google Sheet can be kept as a copy of the app (or in two-way sync), so teams who prefer the spreadsheet can keep reading it.

Two work types ship today:

| Work type | What one item is | Flow |
| --- | --- | --- |
| **Journey** | One SME journey built with Claude, reviewed by an SME, then taken to prod | Allocated → In creation (3a Spine … Published) → Review ↺ Changes asked → Closed → after-steps → Done |
| **APK Testing** | One APK build (its test cases are results inside it) | Not Tested → In Process → Fail → Pending Retest → Pass, following its test results |

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
9. [Signing in (Google for office staff, password for everyone else)](#signing-in)
10. [Appearance: theme, text size, density, sidebar](#appearance-theme-text-size-density-sidebar)
11. [Google Sheet sync](#google-sheet-sync)
12. [Add a new kind of work](#add-a-new-kind-of-work)
13. [Database and migrations](#database-and-migrations)
14. [Tests and checks](#tests-and-checks)
15. [Branches and environments](#branches-and-environments)
16. [Deploy](#deploy)
17. [Scripts reference](#scripts-reference)
18. [Troubleshooting](#troubleshooting)
19. [Working with AI coding tools](#working-with-ai-coding-tools)
20. [Contributing](#contributing)

---

## Tech stack

| Layer | Tool |
| --- | --- |
| Framework | Next.js 15 (App Router, Server Components, Server Actions) |
| Language | TypeScript 5 |
| Database | PostgreSQL 16 through Prisma 6 (local: `embedded-postgres`, no install needed) |
| Auth | Auth.js v5 (Google OAuth for office staff, email + password for everyone else) |
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
npm run import:journey -- "$HOME/Downloads/journey-tracker.csv"            # Journey: dry run, lists rows to check
npm run import:journey -- "$HOME/Downloads/journey-tracker.csv" --replace  # Journey: replaces all journeys
npm run import:apk  -- "$HOME/Downloads/APK Testing Tracker.xlsx"         # APK Testing
npm run apk:versions -- --apply                                         # APK Testing: make a version item per APK version (after an import into an older database)
```

The APK import is safe to re-run (existing items are skipped). The Journey import reads the SME's Slack "Journey tracker" list exported as CSV; with `--replace` it deletes every journey first, then creates the chapters, the Journey team with their roles and every row (`scripts/import-journey-csv.ts`).

### 7. Run the app

```bash
npm run dev
```

Open <http://localhost:3000> and sign in with `admin@demo.classroots.local` and your `DEMO_PASSWORD`.

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
| `OFFICE_DOMAINS` | yes for Google | Comma-separated office email domains (e.g. `classrootsedu.com`). These people sign in with Google; everyone else with email + password. |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | no | Enables "Sign in with Google". |
| `EMAIL_SERVER` | yes in prod | SMTP URL for invite and forgot-password emails. Empty means they are printed in the server log. |
| `EMAIL_FROM` | no | Sender for invite and reset emails. |
| `APP_TIMEZONE` | no | Team time zone for dates and business hours (default `Asia/Kolkata`). |
| `APPS_SCRIPT_URL` | for sync | `/exec` URL of the deployed `apps-script/Code.gs`. |
| `SYNC_TOKEN` | for sync | Shared secret between the app and the Apps Script (same value in both). |
| `CRON_SECRET` | for jobs | Protects `/api/cron/run`. The scheduler and Vercel Cron send it as a Bearer token. |
| `RELAY_KEY` | for the relay | Bearer key of the journey relay (Claude) for `/api/relay`: read journeys, set Creation stage, nothing else. Empty = off. |
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
  import-journey-csv.ts            Import the Journey tracker (Slack list CSV) with the SME's corrections
  import-apk-xlsx.ts               Import the APK Testing tracker workbook
  demo-users.ts                    Demo sign-ins
  set-password.ts                  Set a password from the terminal
  run-jobs.ts                      Run sheet sync + workload snapshot once
  scheduler.ts                     Calls /api/cron/run every N minutes (self-hosted)
src/
  modules/                         Work-type modules: the "what"
    types.ts                       WorkTypeDefinition contract
    registry.ts                    List of enabled module definitions
    journey-applet/definition.ts   Stages, moves, roles, fields, chapter rollup (no sheet)
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
    auth.ts                        Auth.js config (Google for OFFICE_DOMAINS, password; invite-only)
    rbac.ts / access.ts            Current user and their access per work type
    services/work-items.ts         The ONLY write path for items
    services/analytics.ts          Dashboard data
    services/reports.ts            Report tables, CSV / Excel export
    services/work-types.ts         Enable / pause / archive work types; system roles
    sync/google-sheet.ts           Sync engine (app → sheet, two-way)
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

### Journey (`src/modules/journey-applet/definition.ts`)

One row per journey (`GxxCxxSTnJn`: grade, chapter, subtopic, journey), grouped by chapter. Built from the SME / coordinator's answers (`docs/JOURNEY-BRIEF.md`, `docs/JOURNEY-FOLLOW-UP.md`).

New team members: read the [Journey workflow guide](docs/JOURNEY-WORKFLOW.md) for role responsibilities and the end-to-end process.

`Allocated → In creation → Ready for review → In progress → Closed`, with the loop `In progress → Changes asked → Correction verification → Closed` (or back to Changes asked), then the after-steps `Design standardization (starts paused) → Last look after design → Video replacement → UAT → prod migration → Published on prod → User testing and QA → Done`.

**Creation stage is a field, not a stage of the line** (`3a · Spine → 3b · Script → 4 · Build → 5 · Ship → Published`, published = in UAT). A creator can submit for review at any creation stage and keeps building during the review, so the two are never worked out from each other. It sits beside Status on the journey page (`headerFields`), is changed by the creator, a coordinator or Claude (relay API below), and every change is in the history with its time. **Start** sets it to 3a · Spine; setting it on an Allocated journey moves that journey to In creation (`fieldMoves`).

- **SME creator** (the journey's assignee) sets the creation stage, submits, makes the corrections and does the last look after design (½ day; can send it back to Design standardization). Submit stamps *Submitted for review* and *Submitted in* (first / second half, from the clock: before 14:30 = first half). The creator does not type dates: *Picked up* / *Picked up in* belong to the coordinator (Start stamps them when still empty), and *Submitted* is the stamp only (an admin can correct it).
- **SME reviewer** (the journey's owner; actor `OWNER`) starts the review, asks for changes (only with feedback, from the Feedback card), verifies corrections and closes the review. *Review date* is stamped when the review is done: feedback sent or review closed. Other reviewers can't act on it or give it feedback (`canGiveFeedback`). A journey submitted with no SME reviewer sends its chapter's coordinators an Inbox message to pick one.
- **Coordinator** adds journeys, picks creator and reviewer, edits details, marks *Needs video replacement* (No = the journey skips Video replacement, `skipWhen`), moves the after-steps, and sends a journey back from User testing and QA to Changes asked (with feedback). A coordinator can be limited to their own chapters (People & access → Chapters they steer); Arjun G04C05, Devjyoti G05C02, Vinay G06C07; Aswin is admin. A coordinator also acts on every journey of their team's creators, in any chapter (see Teams below). **Program manager**: dashboards and reports, view only.
- **Teams and ownership** (`teams: true`, `src/lib/teams.ts`, 6 Nov 2026). Ownership has two levels. *Chapter*: its **steward** is the coordinator who steers it (People & access → Chapters they steer); the **Chapters** tab lists every chapter with its steward, has an **All chapters / My chapters** switch, and lets a coordinator add a chapter (they become its steward; an admin picks the steward) or remove an empty one. *Journey*: it belongs to the coordinator of its **creator's team**, whoever allocated it and in whichever chapter, shown as **Owner** in the list and on the journey. That coordinator is its default **SME reviewer**; the creator's buddy is its **Peer reviewer** (shown, and changed per journey by a coordinator; it is not a stage of the flow). The **Teams** tab holds the settings: a team's coordinator adds and removes members (from the SME creators not yet in a team), changes the team's *Default SME reviewer* (e.g. while they are away) and each member's *Peer reviewer*; an admin adds teams and changes their coordinator. When a default changes, or a journey gets a new creator, open journeys (review not closed) follow only where the slot is empty or still holds the old default; a reviewer picked by hand stays (`nextDefault`). **Fill missing reviewers** fills empty slots. The Journeys list filters by **Team** and **Show → My team**. First setup: `npm run journey:teams -- --apply` (Team Arjun, Team Devjyoti and their buddies).
- **Days taken** = working days Picked up → Submitted (Mon–Fri, both counted), where the pick-up day counts ½ if picked up in its second half and the submit day ½ if submitted in its first half (*Picked up in* / *Submitted in*). **Closure due** = Review date + 1 working day, stored as the due date. Holidays are not counted; the coordinator corrects a date by hand. Once the review is closed the creator's part is over (`dueEndsAt: 'approved'`): no workload, delay or overdue from then on.
- Journey works Mon–Fri (`workDays`); stuck limits: creation 2 days from picked up (phase limit), each review stage ½ day, correction verification ¼ day, last look ½ day.
- Inbox: assigned, submitted (to the reviewer, or to the chapter's coordinators when there is none), feedback, review closed (to the creator), overdue past Closure due (reviewer + the chapter's coordinators, from the cron job).
- Who sees and does what (brief A4, tested in `tests/journey-roles.test.ts`): everyone sees every journey. **SME creator**: their own journeys' creation stage, links (UAT CMS journey, AI Tutor) and moves; read and comment elsewhere. **SME reviewer**: their own journeys' review moves, feedback, review date and links. **Coordinator**: in their chapters and on their team's journeys anywhere, assign creator, reviewer and peer reviewer, set the pick-up date, add (the chapter comes from the key), edit every detail, delete, after-step moves; elsewhere read only. **Program manager**: Dashboard, Journeys (view only), Reports, Export. New journeys: the form offers only the coordinator's chapters and refuses a key from another chapter.
- The list shows the Slack tracker's columns (Review state and Final status are worked out from the stage). No Google Sheet sync.

**Journey relay API (Claude).** The relay ([buildjourneyrelay](https://buildjourneyrelay.classrootsedu.in), driven from Claude Desktop) keeps the creation stage in step. It sends `Authorization: Bearer <RELAY_KEY>`; the key can only read journeys and set their Creation stage, and its changes show as **Claude** in the history (event source `RELAY`). No key set = the API is off.

```bash
curl -H "Authorization: Bearer $RELAY_KEY" "$APP_URL/api/relay/journeys?chapter=G04C05"     # every journey with its creation stage
curl -H "Authorization: Bearer $RELAY_KEY" "$APP_URL/api/relay/journeys/G04C05ST1J1"         # one journey
curl -X POST -H "Authorization: Bearer $RELAY_KEY" -H "Content-Type: application/json" \
  -d '{"stage": "4 Build", "at": "2026-11-05T10:30:00+05:30"}' "$APP_URL/api/relay/journeys/G04C05ST1J1/creation-stage"
```

`stage` accepts `3a Spine`, `4 · Build`, `build`, `Published` and the like; `at` (optional) is when it changed on the relay: not in the future, at most 31 days back, and never before the journey's last recorded change. Answers are JSON: the journey, its `creationStage`, `stage` (the line) and `changed`; errors are `{"error": …}` with 400 (bad input), 401 (key), 404 (no such journey) or 409 (Journey paused).

### Configurable stages (Admin → Work types → Stages)

The module code holds the default stages; an admin can rename them, change colour, kind and time limit, change the button and who may press it, set a stage **Paused** (items arrive and wait, counted as on hold) or **Skipped** (moves jump over it), and **add a stage** after any stage that has a "next" button. Stages with history are skipped, never deleted. Only the changes are stored (`WorkflowStage`, null = code default); `applyStageConfig` in `src/lib/stages.ts` merges them and generates the "next stage" moves, and `getModule` returns the merged definition (refreshed every 10 s and on save, `src/server/stages.ts`). First, last and loop stages are fixed. Work types without `next` buttons (APK Testing) can only be renamed and re-timed.

### APK Testing (`src/modules/apk-testing/definition.ts`)

One work item per **APK version**. Its test cases are **test results** under it (child items, `WorkItem.parentId`): they carry the tester, bug, remarks, log date and time log, and they are what the Google Sheet's Test Execution tab lists. Results are not work: they stay out of the APK versions list, the KPI tiles and the analytics (`level: 'work'` in `loadItems`); the version page lists them, and **All tests** on the APK versions page (or a chart segment) lists them across versions (`?view=tests`).

A version's status is never set by hand. It follows its results (`versionStatus` in `src/lib/apk-rollup.ts`): Not Tested until a result moves, **Fail** while any result fails, Pending Retest once failures are fixed, In Process while some are untested, **Pass** when all passed (or were not reported). Every result change rolls the version up (`rollupVersionTx`), so cycle time, stuck and done on versions follow the testing. The tester of a version is the tester of its results; assigning the version assigns the results nobody else took. Deleting or restoring a version takes its results with it. The version items are app-only (not in the sheet).

A result's own flow: `Not Tested → In Process → Pass / Fail / Not Reported`. A failure goes `Fail → Fixed (app developer) → Pending Retest → Pass`.

- **Testers** run cases, pass or fail them, retest, and fill in comments, bug and log date.
- **App developers** mark failures fixed and add developer remarks.
- Per-version chart and table (Results by version) count the **results**, not the versions: each version has a summary row: total, pass, fail, pending retest, not tested and pass %. The result is **All passed**, **Stable** (≥ 90 %), **Good** (≥ 80 %), **Has failures** or **In progress**.

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
2. How they sign in: office emails use Google (nothing to set); anyone else needs a password (**Generate**, then **Copy login details** to send it to them).
3. Tick each work type, then one or more roles in it. You can use "Copy access from…" another person.
4. Review and save.

**Capacity** is how many items a person can comfortably carry at once (default 3). It only drives the workload levels and the "least-loaded first" order in assign dropdowns. It never blocks an assignment.

**Removing a person:** **Deactivate** blocks sign-in and keeps their name on past work. **Remove** deletes them permanently and is only allowed for people with no work history.

The server enforces the same rules as the UI, in server actions and the export API, so hiding a button is never the only protection.

---

## Signing in

Only people an admin added in **People & access** can sign in (plus `ADMIN_EMAILS`, so the first admin can get in). Nobody signs themselves up.

| Who | Method | Notes |
| --- | --- | --- |
| Office staff (email domain in `OFFICE_DOMAINS`, e.g. `classrootsedu.com`) | **Sign in with Google** | Shown when `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` are set. No password. Google sign-in is refused for other domains. |
| Everyone else | **Email + password** | The admin generates the password when adding them. "Remember me" keeps the session 30 days, otherwise 12 hours. |

**Invite on add.** Saving a new person with **Email them an invite now** ticked emails them the app address, their work types and roles, and how to sign in: Google for office emails, or their email and the password just generated. When an admin sets a new password later, **Email them the new password** does the same. **Send invite** (People list or person page) re-sends it; for password users it contains a link to choose a password instead (valid 72 hours), because the old password is not known.

**Forgot password.** Sign-in page → **Forgot password?** → email → a one-time link valid for 1 hour (`/reset-password`) → new password. The answer never reveals whether an email exists, a link is sent at most every 2 minutes per email, and links are stored hashed in `VerificationToken` (`src/server/password-reset.ts`). Office staff use Google and get no link.

Saving someone outside the office domains without a password is refused, because they could not sign in.

Email (invites and reset links) needs `EMAIL_SERVER` (SMTP URL, e.g. `smtps://you%40yourdomain.com:<app password>@smtp.gmail.com:465`) and `EMAIL_FROM`; without it mails are printed in the server log. Mail goes through `src/server/mail.ts`; wording and rules in `src/lib/invite.ts` (tested).

**First admin on a fresh server:** put your office email in `ADMIN_EMAILS` and use Google, or set a password from the terminal:

```bash
npm run user:password -- you@company.com
```

### Google SSO setup

1. Google Cloud Console → OAuth consent screen with user type **Internal** (only your Google Workspace organisation can use it).
2. APIs & Services → Credentials → **Create OAuth client** → *Web application*. Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`, plus `<production URL>/api/auth/callback/google`.
3. Put the ID and secret in `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`, set `OFFICE_DOMAINS`, restart. Google always shows the account picker.

Click-by-click: `docs/NEXT-STEPS.md` § 7.

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

### APK Testing data model

APK Testing stores its shared facts in real tables instead of copying them into every row:

| Table | Holds | Used by |
| --- | --- | --- |
| `ApkVersion` | version name, release date, APK link, notes | version table, New / Edit / Delete version |
| `ApkTestCase` | test case id, feature, scenario, expected result, steps, default priority | Test cases page, "copy from an earlier version" |
| `ApkTest` | links one run (`WorkItem`) to its version and test case; each pair exists once | everything that reads a run |

A run is still a `WorkItem`, so status, assignment, comments, bug, developer remarks, the time log, sheet sync and permissions work as before. Its own `data` keeps only its result (priority, comments, bug, remarks, log date, test case id). Reads merge the shared fields back in (`hydrateApkData`); editing a shared field (scenario, APK link, ...) writes to the shared row, so the whole version or test case changes together and the change is logged on the run. New runs from the importer, the New version dialog or the sheet find or create their version and test case (`src/server/apk/store.ts`). Both testers and app developers can add versions and test cases and each writes their own comment column.

### APK Testing: versions, bugs and the time log

- **Add a version.** Testers (the Tester role has "Add new items") and admins press **New APK version**: version name, APK link, release date and notes, then pick an earlier version to copy test cases from (untick any, add extra cases). The tests start as Not Tested, with bug, comments and remarks empty, and the creator is the tester unless an assigner picks someone else. **Add test case** adds one test to an existing version. The pencil in the By APK version table edits the link, date and notes of every test in that version. The bin next to it deletes (deactivates) the whole version and its tests, for admins and anyone who can edit test details. It asks first, then offers Undo for 5 seconds and from the Inbox for 30 minutes. History is kept. Code: `src/lib/apk-versions.ts` (pure planner), `src/server/services/apk-versions.ts`, `src/components/new-apk-version.tsx`.
- **Lean list.** The APK list drops Owner, Expected and Delay and shows Priority, Bug / issue, Developer remarks and Last update instead. A module controls this with `table: { hide, extra }`.
- **Bug and remarks.** On a test's page, the tester writes the bug / issue and the developer writes remarks in their own cards. Each shows who edited last and when.
- **Time log.** Every test has a log of status changes, bug and remark edits, comments and assignments, each with who and when, plus how long the test sat in the status it left. Totals show time to first result, times failed, waiting for fix and waiting for retest. Code: `src/lib/time-log.ts`, `src/components/time-log.tsx`; a module opts in with `timeLog: true`.

### Data grids (spreadsheet feel, modern look)

The item lists, the per-group summary (for example By APK version) and the report tables share one grid (`<Sheet>` in `src/components/sheet.tsx` with the `.sheet` styles in `globals.css`). It has no gridlines; it behaves like a spreadsheet instead. Columns keep their natural width and the grid scrolls sideways with always-visible scrollbars and a fade at the right edge. The header row, the first column and the Actions column stay pinned. Click a cell, then use the arrow keys, Home or End to move; Ctrl or Cmd plus C copies the cell. To use it on a new table: wrap it in `<Sheet>`, give the table `className="sheet"`, and put `className="pin"` on the first column's cells (and `pin-end` on an actions column).

**Inbox and undo.** After a delete, a toast (bottom left) offers Undo for 5 seconds, then the message lives in your **Inbox** (sidebar, above your name) where Undo stays for 30 minutes: click the message to show its Undo button. After Undo, or when the 30 minutes are over, the message moves to Read. The Inbox popover shows the latest unread messages and links to the full `/inbox` page (All / Unread / Read, search, select, mark read, delete). The same inbox also tells you when you are assigned something or get feedback. To notify someone from new code call `notify(db, userId, { kind, title, body, href, data })` from `src/server/services/notifications.ts`; new kinds need no migration. After 30 minutes a row can no longer be restored from the app (`UNDO_DELETE_MINUTES` in `src/lib/workflow.ts`).

**Speed.** Item tables are paged (50 per page on the Items page; the first 50 per work type on My dashboard, with an Open all link). The Edit dialog loads a row's fields only when opened, and status and assignee selects update instantly while the save finishes. Dev mode (`npm run dev`) is slower than the real thing; check speed with `npm run build && npm start`.

Every item row has **Edit** (opens that item's fields) and **Delete** (asks first). Delete is for admins and anyone who can edit item details. It archives the item: it leaves every list, report and dashboard and its page returns 404, but its history stays in the database. The Google Sheet row is not touched and will not bring the item back.

---

## Google Sheet sync

> **No spreadsheet ID needed.** `apps-script/Code.gs` finds a work type's tab by name: first in the default tracker, then in any Google Sheet the script owner can open (it remembers where it found it). After pasting a new `Code.gs`, deploy a new version and approve the Drive permission once. To pin a tab to one sheet, add the script property `TAB_SHEET::<tab name>` with the sheet's ID.
>
> **Linked tabs are updated first.** The APK tracker's tabs depend on each other, so a push goes in this order: **Lists** (new tester names; the APK Versions column is a formula over APK Releases, so the script never types into it), **Test Cases** (a row for each new test case, empty cells filled), **APK Releases** (the version's date, link and notes, kept in step), **Version Summary** (a build with no row gets a copy of the last row and the Total row grows by one), then **Test Execution**. A work type declares this in `sheet.linked` in its module. A tracker without one of those tabs just skips it. The script never changes dropdowns or formatting. Paste the latest `apps-script/Code.gs` and deploy a new version for this to work.

Postgres is the source of truth. Sync is **off** until an admin turns it on, so nothing touches the live sheet by accident.

### Setup (once)

1. Open the Google Sheet → **Extensions → Apps Script**. Replace the code with `apps-script/Code.gs`.
2. **Project Settings → Script properties**: add `SYNC_TOKEN` with the same value as in `.env`.
3. **Deploy → Manage deployments → ✎ → New version → Deploy.** Put the `/exec` URL in `APPS_SCRIPT_URL`.
4. In the app: **Admin → Sheet sync**. Switch on **Sync with Google Sheet**, pick the **Direction**, check the tab name, **Save**, then **Sync now**.

One deployment can serve several trackers. For a work type whose data lives in another spreadsheet (for example APK Testing), paste that sheet's **Spreadsheet ID** on the Sheet sync page. The script owner needs access to that sheet. Keys can be composite: APK Testing matches rows on `APK Version` + `Test Case ID`.

### Direction

- **App → sheet** (default): the sheet is a copy of the app. Each sync reads the tab, queues every mapped cell that differs from the app (edits typed in the sheet are overwritten, cells cleared in the app are cleared), appends a row for every item the tab lacks, then pushes. Rows only in the sheet are left alone and counted. Nothing in the app changes and no conflicts are logged. Columns the tab doesn't have and app-only statuses are skipped.
- **Two-way**: as below.

### What happens on each two-way sync

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
   - `statuses`: each with a **category** (`queue`, `active`, `review`, `feedback`, `approved`, `done` or `hold`). Categories drive all the analytics. A stage with `next: { label, by }` gets a button to the next active stage and can be paused, skipped or followed by admin-added stages; `line: 'side'` marks loop stages.
   - `transitions`: extra moves (loops, send-backs). Use a capability (`work`, `review`, `assign`, `create`, `manageFields`), `ASSIGNEE` or `OWNER`; `to: '@next:<key>'` = the next active stage after `<key>`; `requires: 'feedback'` and `stamp: [field]` as needed.
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

## Branches and environments

| Branch | Environment | Who merges into it | How |
| --- | --- | --- | --- |
| `start-here` | your machine | you, every day | the one working branch: push freely; every AI handoff saves the latest state here and every session starts here |
| `development` (default branch) | Railway **development** (its own database) | `start-here` | pull request, **Create a merge commit** (keeps `start-here` in step, no force-push), CI must pass |
| `staging` | Railway **staging** (its own database) | only `development` | pull request "Release to staging", **Create a merge commit**, CI + branch-flow must pass |
| `main` | Railway **production** | only `staging` | pull request "Release to production", **Create a merge commit**, 1 approval, CI + branch-flow must pass |

**Daily flow**

```bash
git checkout start-here && git pull       # then type "resume" in your AI tool
git merge origin/development              # pick up anything merged meanwhile
# work, commit, push (or type "handoff")
gh pr create --base development --head start-here   # "Create a merge commit" when CI is green
```

Any other branch is temporary: the AI `handoff` deletes branches whose work is already in `development`.

**Release** (when development is ready to test, then to ship):

```bash
gh pr create --base staging --head development --title "Release to staging"
# test on the staging URL, then
gh pr create --base main --head staging --title "Release to production"
```

Use **Create a merge commit** for these two (the rulesets allow nothing else), so the three branches keep the same history and the next release has no conflicts.

**Urgent fix in production:** branch `hotfix/<topic>` from `main`, pull request into `main`, then open pull requests `main → staging` and `main → development` so the fix is not lost.

**Enforced on GitHub** (Settings → Rules → Rulesets): no deleting or force-pushing `development`, `staging` or `main`; changes only by pull request; required checks `checks` (`.github/workflows/ci.yml`: install, `prisma generate`, typecheck, tests) and, for `staging` and `main`, `branch-flow` (`.github/workflows/branch-flow.yml`: rejects any other source branch). Repository admins can bypass in a pull request when needed.

**Railway:** one project with three environments (`production` ← `main`, `staging` ← `staging`, `development` ← `development`), each with its own Postgres, address and secrets. Click-by-click: [docs/DEPLOY.md](docs/DEPLOY.md); variables: [Railway](#railway-app--postgres).

---

## Deploy

> **What to do next, step by step** (merge, Google Sheet tabs, Apps Script, Railway, going live): see [docs/NEXT-STEPS.md](docs/NEXT-STEPS.md).

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
- turning on **two-way** sync pulls every row in (the default, app → sheet, only writes to the sheet)

To load the Excel files instead, run the import scripts from a checkout whose `DATABASE_URL` points at the server database.

### Railway (app + Postgres)

The repo is ready for Railway: `railway.json` builds the `Dockerfile` (migrations run on every start) and probes `/api/health`.

1. **New project → Deploy from GitHub repo** (this repo). Add the **PostgreSQL** plugin to the same project. In the app service → Settings → Source, set the branch to **`main`**: this environment is **production**.
   Then **Environments → New environment → Duplicate `production`** twice: `staging` (app branch **`staging`**) and `development` (app branch **`development`**). Each duplicate gets its own empty Postgres and its own variables (own `AUTH_URL`, `AUTH_SECRET`, `CRON_SECRET`; same Google and email settings; development without email). Add all three addresses to the Google OAuth client. Every merge into `development`, `staging` or `main` deploys that environment by itself. Step by step: `docs/DEPLOY.md`.
2. In the app service → Variables, set:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`, with `?connection_limit=10&pool_timeout=20` added at the end. Use the private URL (`postgres.railway.internal`) so traffic stays inside Railway.
   - `AUTH_SECRET` (`openssl rand -base64 32`) and `AUTH_URL` = the public URL Railway gives you (or your custom domain).
   - `ADMIN_EMAILS`, `APP_TIMEZONE`, and, for sheet sync, `APPS_SCRIPT_URL`, `SYNC_TOKEN`, `CRON_SECRET`.
   - Optional: `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`, `EMAIL_SERVER` / `EMAIL_FROM`.
3. **Generate a domain** for the service, then set `AUTH_URL` to it and redeploy. For Google sign-in add `<AUTH_URL>/api/auth/callback/google` as a redirect URI.
4. **Schedule** sheet sync: add a second service from the same repo as a **Cron** job (every 5 minutes) with the start command
   `curl -fsS -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/run"` (set `APP_URL` to the public URL, `CRON_SECRET` to the same value as the app).
5. **Put data on it** (after the first deploy created the tables): copy this machine's database with `npm run db:copy -- --to "<Railway DATABASE_PUBLIC_URL>"` (no `pg_dump` needed; add `--replace` to overwrite; sheet sync is switched off in the copy), or start from the live trackers with `DATABASE_URL="<url>" npm run db:seed` and `DATABASE_URL="<url>" npm run import:apk -- <file>`. Step by step: `docs/NEXT-STEPS.md` § 6.

**Scaling notes.** One app instance handles a small team comfortably. When it grows: raise the Railway plan before adding instances; keep `connection_limit` x instances below Postgres's connection cap (put PgBouncer in front beyond that); lists are paged and filtered in the database, and the indexes on `WorkItem` (work type, group, archived, sort) and the APK tables back them. Overview charts still read a work type's items in one pass, which is fine into the tens of thousands of rows.

### Render (app + Postgres)

The same `Dockerfile` runs on Render (migrations run on every start).

1. **New → PostgreSQL** in the region you will use for the app.
2. **New → Web Service** from this repo: runtime **Docker**, same region, health check path `/api/health`. Variables as for Railway: `DATABASE_URL` = the **Internal** Database URL + `?connection_limit=10&pool_timeout=20`, `AUTH_SECRET`, `AUTH_URL` (the `onrender.com` address), `ADMIN_EMAILS`, `OFFICE_DOMAINS`, `APP_TIMEZONE`.
3. Free plan: the service sleeps after ~15 idle minutes and the free database expires after 30 days. Use paid plans for real use.

### Moving data between this machine and the hosted database

Put the hosted database's **External** URL (Render: Connect → External; Railway: `DATABASE_PUBLIC_URL`) with `?sslmode=require` in `.env` as `REMOTE_DATABASE_URL`. Then:

| Command | What it does |
| --- | --- |
| `npm run db:deploy:remote` | Apply this checkout's migrations to the remote database |
| `npm run db:pull` | Remote → local. **Replaces** all local data |
| `npm run db:push` | Local → remote, only when the remote is empty |
| `npm run db:push -- --replace` | Local → remote, **wipes** the remote data first |
| `npm run db:studio:remote` | Browse the remote data at <http://localhost:5555> (edits are live) |

- A copy is the whole database, never a merge. Keep one side as the source of truth: once people use the hosted app, it is; refresh this machine with `db:pull` and never `db:push --replace` over it.
- Both sides need the same migrations. Schema change: commit the migration and push; the hosted app applies it on deploy (or run `db:deploy:remote`), and `npm run db:deploy` applies it here.
- Not copied: sign-in sessions, password links, the sheet-sync queue. Sheet sync is switched off in the copy.

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
| `npm run import:journey -- <file.csv> [--replace]` | Journey from the Slack tracker CSV: dry run lists rows to check; `--replace` replaces all journeys |
| `npm run db:copy -- --to <url> [--replace]` | Copy this machine's database into another one (e.g. Railway); same migrations required, sheet sync switched off in the copy |
| `npm run db:pull` / `db:push [-- --replace]` | Copy remote → local / local → remote (`REMOTE_DATABASE_URL`); see [Moving data](#moving-data-between-this-machine-and-the-hosted-database) |
| `npm run db:deploy:remote` / `db:studio:remote` | Migrate / browse the remote database |
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
| Start work | `git checkout start-here && git pull`, then type **`resume`** in your AI tool |
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

1. **Work on `start-here`** (AI handoffs save there and refuse `development`, `staging` and `main`). Pull requests go `start-here → development` (merge commit); releases move `development → staging → main` (see [Branches and environments](#branches-and-environments)).
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
