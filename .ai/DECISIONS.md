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

## 2026-11-03 — Sign-in: admin adds everyone; Google for office emails, admin-set password for the rest
Decision: invite-only (existing active user or `ADMIN_EMAILS`); no self sign-up (`ALLOWED_DOMAINS` removed) and no email magic link (provider and /signin/check-email removed). `OFFICE_DOMAINS=classrootsedu.com`: these sign in with Google (OAuth client, Internal consent screen); Google is refused for other domains. Everyone else signs in with email + a password the admin sets (Generate + Copy login details in the user form); saving a non-office person without a password is refused (`missingPasswordProblem`). Optional `EMAIL_SERVER` only powers **Send invite** (never contains a password). APK sheet sync will be app → sheet only (to build).
Why: Jeevan's model: admin controls who gets in; office staff have Workspace accounts, outsiders don't; magic links confused users. Rejected: domain auto sign-up, emailing passwords.
By: cursor

## 2026-11-03 — Invite on add (with the generated password) and self-service forgot password
Decision: adding a person emails them by default (`notify`): office → Google steps; others → email + the password the admin just generated (Jeevan wants the password sent). Re-sending later (Send invite) gives password users a 72 h set-password link instead (old password unknown). Forgot password: /forgot-password → 1 h one-time link → /reset-password; tokens hashed (SHA-256) in VerificationToken as `pwreset:<reset|invite>:<email>`, new link replaces old, max one per 2 min, response never reveals whether the email exists; office (Google) users get no link. Needs EMAIL_SERVER in production.
Why: Jeevan's flow; outsiders must recover without the admin. Rejected: storing plaintext passwords, new tables (VerificationToken already exists).
By: cursor

## 2026-11-03 — Branches: development → staging → main (production)
Decision: `development` is the default branch (feature PRs, squash). `staging` deploys Railway staging (own DB, own AUTH_URL/AUTH_SECRET), `main` deploys production. Promotion only by merge-commit PRs development → staging → main; `hotfix/*` → main then back-merge main → staging/development. GitHub rulesets "Development" / "Staging" / "Production (main)": no delete/force-push, PR only, required checks `checks` (.github/workflows/ci.yml) and `branch-flow` (.github/workflows/branch-flow.yml, staging/main only); main needs 1 approval; admins may bypass in a PR. `.ai/config.json` protects `development` too.
Why: Jeevan wants separate development, staging and production. Merge commits (not squash) for promotions keep the three histories identical so releases never conflict.
By: cursor

## 2026-11-03 — Server starts with a copy of the local demo database; live data later
Decision: no production data yet. The Railway database gets a copy of this machine's DB via `npm run db:copy -- --to <url> [--replace]` (scripts/copy-db.ts: Prisma + row_to_json/json_populate_recordset, FK order, migrations must match, skips Session/VerificationToken/SyncOutbox, turns sheet sync off). When Journey is built: `prisma migrate reset` on the server, seed, import:apk + import:xlsx from the live trackers, re-add people (NEXT-STEPS § 6).
Why: Jeevan wants to use the app now with APK + Journey demo data. Rejected: pg_dump (not installed; no system Postgres tools on this Mac).
By: cursor

## 2026-11-03 — One working branch `start-here`; handoff removes merged branches
Decision: all work and every handoff happen on `start-here` (state `.ai/state/start-here.md`); sessions resume there. It merges into `development` by PR with a merge commit (not squash), so it stays in step without force-push; then development → staging → main as before. Handoff step 4 deletes any other branch whose work is already in `development` (merged PR or no diff outside `.ai`) plus its state file; logs stay. Skills edited in `.agents/skills/` and mirrored with `python3 .ai/bin/sync.py` (a kit upgrade may overwrite them: re-apply).
Why: Jeevan wants one obvious place to start and no leftover branches. Replaces "one personal branch per topic".
By: cursor

## 2026-11-04 — Railway runs three environments: development, staging, production
Decision: one Railway project, environments `production` (← `main`), `staging` (← `staging`) and `development` (← `development`), made by duplicating production. Each has its own Postgres (empty on duplication, filled with `npm run db:copy`), address, `AUTH_URL`, `AUTH_SECRET`, `CRON_SECRET`. Shared: one Google OAuth client with all three addresses + localhost, `ADMIN_EMAILS`, `OFFICE_DOMAINS`. Email: production and staging (from name "Classroots Work (staging)"), development none (mails in logs). Checklist: `docs/DEPLOY.md`.
Why: Jeevan wants every merged change visible on a real address and a release tested on staging before production; migrations then run development → staging → production in turn. Extends the 2026-11-03 branches decision (development was "local / optional").
By: cursor

## 2026-11-04 — Stages are configurable by admins (WorkflowStage overrides over module code)
Decision: module code keeps the default stages; `WorkflowStage` rows store only an admin's changes (null = code default) plus custom stages. `applyStageConfig` (src/lib/stages.ts, pure, tested) merges them, generates "next stage" moves from `StatusDef.next`, retargets moves around skipped stages (`to: '@next:<key>'`), turns paused stages into 'hold'. `getModule` returns the merged module from a registry cache refreshed every 10 s from `currentUser` and on save (src/server/stages.ts). Rows are written only when edited (not seeded on enable), so later code changes still reach unedited stages. First/last/side/`locked` stages and stages without `next` (all of APK Testing) can't be paused/skipped. Removing a stage with history skips it.
Why: Jeevan wants to add, pause or skip stages anywhere as the Journey after-steps get standardised, without a deploy. Rejected: a fully DB-defined workflow (would touch every module consumer and lose type-checked defaults).
By: cursor

## 2026-11-04 — Journey rebuilt from the SME's answers; demo data replaced by the real tracker
Decision: key stays `journey-applet`. One stage line: Allocated → 3a Spine → 3b Script → 4 Build → 5 Ship → Ready for review → In progress (↺ Changes asked / Correction verification) → Closed → 6 after-steps → Done. New actor `OWNER` (the item's owner with the review capability) so only a journey's own SME reviewer reviews it; "Ask for changes" `requires: 'feedback'`; moves `stamp` Submitted for review / Review date; module `compute` sets Days taken (Mon–Fri inclusive) and Closure due (Review date + 1 working day) as `dueAt`; `dueEndsAt: 'approved'` ends workload/delay/overdue at review close (`ItemLite.handedOff`); per-module `workDays` (Journey Mon–Fri), per-stage `stuckHours` and `phaseLimits` (creation 18 h). Roles: SME creator, SME reviewer, Coordinator, Program manager. No Google Sheet for Journey (tracker is a Slack list): `npm run import:journey -- <csv> --replace` replaced the 93 demo journeys with the 35 real ones; old importer `import:xlsx` removed; old flow kept as test fixture `tests/fixtures/review-flow.ts`.
Why: Arjun's journey-answers.md (docs/JOURNEY-BRIEF.md). Rejected: separate work types per phase (one row per journey was his answer).
By: cursor


## 2026-11-05 — Sheet sync has a direction; app → sheet is the default
Decision: `config.sync.direction` = `'app-to-sheet'` (default when unset) or `'two-way'`, picked under Admin → Sheet sync. App → sheet (`queueMirror` in src/server/sync/google-sheet.ts, column picker `mirrorColumns` in src/lib/sheet-core.ts): read the tab, queue every mapped cell that differs from the app (sheet edits overwritten, '' clears), queue the non-empty cells of items the tab lacks (appended; archived items skipped), push. Rows only in the sheet are left alone (counted in SyncState.missing); `created` = rows to append; nothing in the app changes, `sheetMissing` is cleared. A cell already queued with the same value is not re-queued, so its attempts still reach FAILED. Two-way is unchanged.
Why: after go-live the team updates work in the app; the APK sheet stays as a copy for readers (2026-11-03 sign-in decision: "APK sheet sync will be app → sheet only"). Kept two-way as an option rather than deleting it.
By: cursor
