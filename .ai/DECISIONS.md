# DECISIONS
Append-only. One entry per lasting decision, newest at bottom. Supersede, don't delete. Format:

    ## YYYY-MM-DD — Title
    Decision: what was chosen.
    Why: the reason, including what was rejected.
    By: claude-code | codex | cursor

## 2026-10-30 — Semantic colour tokens instead of raw Tailwind palette classes
Decision: all UI colour comes from CSS variables on `:root` / `[data-theme='dark']` mapped via `@theme inline` (`bg-surface`, `text-muted`, `bg-ok-soft`, …). Raw classes like `bg-white`, `text-emerald-700` are banned in `src/`.
Why: one place to tune light and dark; module status hex colours still work through `.status-chip` with `color-mix`. Rejected: duplicating every class with `dark:` variants.
By: claude-code

## 2026-10-30 — User preferences stored in `User.prefs` JSON plus a mirror cookie
Decision: theme / text size / density live in `User.prefs` (authoritative) and are mirrored to cookie `cr_prefs` (`theme.fontSize.density`) so the sign-in page and first paint are right before any DB read; sidebar state is cookie-only (`cr_nav`).
Why: prefs must follow the person across devices, but the root layout must render the correct `<html data-theme>` without a flash. Rejected: localStorage only (flash, not cross-device) and a separate Prefs table (overkill for three fields).
By: claude-code

## 2026-11-02 — "Delete" on an item archives it
Decision: deleting a row sets `WorkItem.archivedAt` (hidden from lists, reports, item page) and logs a FIELD_CHANGED event; nothing is hard-deleted. Allowed for admins and roles with "Edit item details" (`manageFields`).
Why: history, analytics and the Google Sheet sync key off the item; a hard delete would let the next sync re-create the row and lose the audit trail. Sheet rows are never deleted by the app.
By: claude-code

## 2026-11-02 — Testers can add APK versions; a version is a group of tests copied from an earlier one
Decision: the Tester role gets "Add new items" (migration `20261102120000_tester_can_add_versions` plus the seed). A new APK version creates one WorkItem per test case (key `<version> | <case id>`, groupKey = version, version link/date/notes in `data`), copying case definitions only. The time log is derived from existing events and stage intervals; no manual time entries.
Why: testers had to ask for an import to start a build. Reusing items keeps reports, sheet sync and permissions unchanged. Rejected: a separate Version table (duplicates grouping that already exists).
By: claude-code

## 2026-11-02 — Work types are split into tab pages; dashboards put analytics before item tables
Decision: `/w/[workType]` is now Overview (analytics only); `versions`, `items` and `cases` are sibling pages under a `(tabs)` route group with a shared header (`loadWorkTypePage` caches the data). Tabs derive from the module (`pages`, `groupSummary`, `versions`). On `/my` each section returns `{ top, items }` and the page renders all analytics first.
Why: one long page mixed reviewing builds, managing versions, running tests and maintaining test cases. Rejected: client-side tab switching (loses URLs, filters and permissions per page).
By: claude-code

## 2026-11-02 — Own-data people see themselves vs a team average; Done leaves the status charts
Decision: for `dataScope = OWN` non-admins the Overview replaces the per-person chart with `compareWithTeam` (aggregates only). By status and per-person bars exclude `done`-category slices; Done stays a KPI tile. Charts navigate with `router.push` to `/w/<key>/items?...`; KPI tiles are `<Link>`s.
Why: colleagues' names must not leak to own-data roles; Done dominated the charts and hid open work. Rejected: hiding the chart entirely (loses comparison).
By: claude-code

## 2026-11-02 — Delete can be undone for 30 minutes
Decision: delete still archives; `restoreItem` clears `archivedAt` within `UNDO_DELETE_MINUTES` (30) for anyone who may delete, logged as a FIELD_CHANGED 'Restored' event. UI: app-wide toast (localStorage) plus a Recently deleted card on the Items page.
Why: accidental row deletes; archive already kept the data. Rejected: server-side trash with auto-purge (no purge job needed yet).
By: claude-code

## 2026-11-02 — Inbox (Notification table) is the home for app messages; delete Undo moves there after a 5 s toast
Decision: `Notification` rows (kind string, title, body, href, data JSON, readAt) per user, written with `notify()`. Delete creates `item.deleted` with `undoUntil`; restore turns it into `item.restored`. Assignment and feedback also notify. Sidebar: Inbox popover + /inbox page; account is one box (name + My account, no email).
Why: one extensible place for future events instead of per-feature toasts. Rejected: localStorage-only toasts (lost on other devices).
By: claude-code

## 2026-11-02 — Roles belong to one work type and come from its flow
Decision: `AccessRole.workTypeId` (unique with `key`). Modules declare `roles` (or they are derived from the flow); `ensureModuleRoles` adds missing ones on enable and on the Roles/People pages. Migration 20261102210000 copied each global role into every work type that used it, moved members to the copies and removed the globals. APK Testing gained a Test Lead role because its flow needs `manageFields`.
Why: a Developer or Reviewer role means different things in each flow; roles should grow with the flow. Rejected: global roles shared across work types (preview and permissions were ambiguous).
By: claude-code

## 2026-11-03 — APK Testing uses relational tables for versions and test cases
Decision: `ApkVersion`, `ApkTestCase` and `ApkTest` (run -> version + case, unique per pair). Runs stay `WorkItem` rows so workflow, events, sync and permissions are untouched; shared fields (scenario/expected/steps/default priority, release date/link/notes) have `FieldDef.source` 'case' / 'version' and are merged into `data` on read (`hydrateApkData`) and routed on write (`updateFieldsTx`). Migration 20261103090000 moved the existing data (20 versions, 20 cases, every run linked). Items page filters and paging run in Postgres (`items-query`); headers use `loadLiteItems`. Deploy target: Railway (Dockerfile + railway.json + /api/health).
Why: scenario/steps/link text was copied into every run (x versions), edits touched dozens of rows, and lists loaded everything. Rejected: a separate APK app/schema (would duplicate workflow, roles, sync).
By: claude-code

## 2026-11-03 — Work type "Journey Applets" is called "Journey"
Decision: display name `Journey` (module `name` + migration 20261103120000_rename_journey for existing DB rows). Key `journey-applet`, URLs, roles and sheet tab unchanged. The Journey work type itself is built later from the real tracker; only APK Testing goes live now.
Why: Jeevan's naming. `WorkType.name` is only written on first create, so renames need a migration.
By: cursor

## 2026-11-03 — Sign-in: Google for classrootsedu.com, email for everyone else; admins send invites
Decision: Google OAuth client with an Internal consent screen + `ALLOWED_DOMAINS=classrootsedu.com` for staff; clients use email + password (admin-set temporary password) or an email link. All mail goes through `src/server/mail.ts` (SMTP URL in `EMAIL_SERVER`, e.g. a Workspace mailbox app password). **Send invite** emails the right steps per person (`src/lib/invite.ts`); passwords are never emailed. APK sheet sync will be app → sheet only (to build).
Why: staff already have Workspace accounts; external people don't. Rejected: Google-only (locks out clients), emailing passwords.
By: cursor
