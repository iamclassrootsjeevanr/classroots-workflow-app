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

## 2026-11-05 — Journey: Creation stage is a field; review date = review done; coordinators per chapter; relay API
Decision: from Arjun's follow-up answers (docs/JOURNEY-FOLLOW-UP.md). (1) The stage line is Allocated → In creation → review → after-steps; `creationStage` (3a · Spine … Published, `CREATION_STAGES` in src/lib/journey.ts) is a `select` data field beside Status (`headerFields`), changed by creator / coordinator / relay, history via FIELD_CHANGED; setting it on an Allocated journey starts it (`fieldMoves`); Start sets 3a · Spine (`NextMove.set`). Old statuses spine/script/build/ship are gone (local DB re-imported). (2) Days taken counts halves (`pickedUpHalf` / `submittedHalf`, `halfOf` stamps the half from the clock, midpoint of business hours). (3) reviewDate is stamped by Ask for changes / Close review, not Start review. (4) After-steps: `skipWhen` on Video replacement (needsVideoReplacement = No), Last look → Design standardization, QA → Changes asked (requires feedback; coordinators may give feedback for a send-back they can make). (5) `WorkTypeMember.groupKeys`: assign / create / manageFields apply only in those groups (`capabilitiesIn`); empty = all; set in People & access and by the importer. (6) `/api/relay/journeys[/<key>[/creation-stage]]` with Bearer `RELAY_KEY`: read journeys + set Creation stage only; EventSource RELAY shown as "Claude"; `at` clamped to not before the journey's last event.
Why: Arjun: "Creation stage and Review state are separate… don't work out one from the other"; Claude must change only the creation stage and show "by Claude". Rejected: keeping creation stages as statuses with a parallel review field (review has the loops, owner, notifications and due date, so review stays the line).
By: cursor

## 2026-11-05 — Journey roles audited against the brief; built-in roles can be reset; feedback by the journey's own reviewer
Decision: the role matrix of brief A4 is a test (`tests/journey-roles.test.ts`). Saved built-in roles that drift from code show "Differs from the flow's default" on Admin → Roles with **Reset to default** (`resetSystemRole`, `rightsDrift`); the Journey importer resets Journey roles. Where a flow's send-back is OWNER-only (Journey), feedback (write + resolve) is limited to that owner (`canGiveFeedback`). Submitted with no owner → Inbox to the group's coordinators (`stewardIds`, also used by overdue, which now goes to the chapter's coordinators only). New-item form follows the module (labels, groups the person steers, `groupFromKey` derives / checks the chapter from the journey key, no due date when computed). Delay counts calendar days in the team time zone (due dates are 23:59 local).
Why: Jeevan asked for every role's dashboard, visibility and edit rights to be checked; the saved SME creator role was own-data and Coordinator had no edit-details right, contrary to the brief.
By: cursor

## 2026-11-06 — Journey teams: two-level ownership, default SME and peer reviewers, creator loses the date fields
Decision: from Jeevan's brief (team structure, 6 Nov). (1) New tables `Team` (coordinator, `reviewerId` = default SME reviewer, null = the coordinator) and `TeamMember` (one team per person per work type, `peerReviewerId` = buddy); `WorkItem.peerReviewerId`. A module opts in with `teams: true`. (2) Chapter owner = steward = the coordinator whose membership names the chapter (`WorkTypeMember.groupKeys`, unchanged, no second source). Journey owner = coordinator of the creator's team, derived at read time (`reviewDefaults`), not stored. (3) A coordinator's steward rights (`GROUP_CAPABILITIES`) also apply to items assigned to their team's members in any chapter (`capabilitiesIn(a, groupKey, assigneeId)`, `WorkTypeAccess.teamUserIds`). (4) On create / assign, and when a team setting changes, the SME reviewer (`ownerId`) and peer reviewer follow the default only where empty or still on the old default (`nextDefault`); all through `services/work-items.ts`. (5) Fields: Picked up / Picked up in = coordinator only; Submitted / Submitted in = stamp only (`editableBy: []`, admin can correct); `buildUrl` removed (migration drops the value). (6) Coordinators add / remove chapters (remove only when empty, and never a steward's last chapter because empty `groupKeys` means every chapter).
Why: Arjun and Devjyoti own their team's journeys even when another coordinator allocates them, and hand reviews over when away. Rejected: storing the journey owner on the item (drifts when a member changes team); a `Chapter.stewardId` column (second source of truth next to `groupKeys`); a peer-review stage (the brief names the peer reviewer but no step for them); replacing reviewers already set on existing journeys (5 journeys of Team Devjyoti creators stay with Arjun, from the tracker).
By: claude


## 2026-11-11 — APK Testing: one APK version is one work item; test cases are results under it
Decision: `WorkItem.parentId` (migration 20261111090000). The version is a WorkItem (key = version name, groupKey = version, assignee = its tester); each test case run is a child WorkItem (key `<version> | <case>`, linked by `ApkTest`) and keeps the status flow, bug, remarks, log date, time log and sheet sync. The version's status is derived from its results (`versionStatus`, `rollupVersionTx` called from `changeStatusTx`, create, delete, restore) and cannot be moved by hand. Results are excluded from lists, KPIs and analytics by `levelWhere` (`work` default; `runs`; `groups` = what group summaries count: results for APK, work items elsewhere). Sheet sync, the outbox and the Test Execution rows only use results. `npm run apk:versions -- --apply` builds the version items for existing data (23 versions locally).
Why: the work to track is a build, not each of its ~20 cases; counts, cycle time and "what is open" were inflated 20x. Rejected: a separate version table without WorkItem (loses assignment, events, intervals and permissions); dropping per-case rows (loses the tracker's Test Execution data and the time log).
By: claude-code

## 2026-11-13 — Journey: a developer checks design standardization when the review closes
Decision: `WorkItem.developerId` (migration 20261113090000), a Developer role (no capabilities, can edit) and the actor 'DEVELOPER' (`ActorContext.isDeveloper`). Module setting `developerHandoff: { after: 'closed', role: 'developer', label }`: when a journey enters Closed it moves on to Design standardization at once and the least busy developer (fewest journeys waiting in that stage) is assigned; Design done is pressed by the developer or a coordinator. Design standardization is no longer paused. The developer sees their journeys in My work and `scope=mine`. `npm run journey:developers -- --people "Jeevan,Swathi" --apply` gives the role, resets the stored stage config and hands existing Closed journeys over.
Why: the check needs a named person, not any coordinator; round-robin by load keeps it even. Rejected: reusing the peer reviewer slot (different meaning); a new capability column (the role needs no rights beyond editing).
By: claude-code

## 2026-11-14 — Journey: the relay feeds creation (pull), the dashboard owns review
Decision: the live journey relay (buildjourneyrelay, behind Cloudflare Access) is pulled by `syncRelay` (`src/server/services/relay-sync.ts`) from the scheduler and an admin button, using a Cloudflare service token (`RELAY_URL`, `RELAY_CF_CLIENT_ID/SECRET`). It creates journeys the relay allocates, stores its ledger events once per `event_id` (`RelayEvent`, migration 20261114090000), and sets Creation stage (latest counting event; withdrawn approvals ignored; never lowers a stage the dashboard is past). Review, reviewers, developer, feedback and every later status stay with the dashboard. Creators are matched by email; unknown emails are reported, not created. Pull, not push: the relay has no hooks and nothing runs on creators' machines.
Why: the relay has no human SME review cycle and the dashboard has no creation tracking; each owns what it models. Rejected: relay-driven review statuses (conflicts with dashboard moves); a push hook on every seat (nothing to deploy to).
By: claude-code

## 2026-11-14 — Journey: design loop between developer and creator; Steward naming
Decision: the developer checks and fixes in Design standardization; the creator's last look sends it back with written feedback (`last_look → design_standardization` now `requires: 'feedback'`), the developer replies, resolves and presses Design done again. Feedback from the creator is notified to the developer; Design done notifies the creator. The developer can be set or changed only while the journey is in Design standardization and that stage is active (`developerStage` in `src/lib/stages.ts`; paused stage = no auto-assign, no dropdown). Journey's coordinator role is displayed as Steward (role key unchanged).
Why: the check needs a back-and-forth with the creator, like review, and a paused stage must not collect assignments. Rejected: a second feedback round counter (later).
By: claude-code

## 2026-11-16 — Feedback is a ticket with a chat; only the author closes
Decision: each feedback is a ticket (TICK-nnnnn, title, severity) with a chat thread (`FeedbackMessage`). Anyone working on the item can raise and reply; only the author (or an admin) closes or reopens; a closed ticket blocks replies. Inbox messages go to the other side only (new ticket, reply, close, reopen). `resolvedAt` stays the close time.
Why: reviewers and creators need to go back and forth per issue. Rejected: one reply field per feedback (old), and a general "your turn" message on every stage (too noisy; only assignment and feedback messages are wanted).
By: claude-code

## 2026-11-16 — Relay board follows the reports page; one confirm dialog for risky actions
Decision: the Relay board (creators x creation stage) is visible to roles with the `reports` page and shows only what their data scope allows. Risky actions use the shared centered `ConfirmDialog` (`useConfirm` replaces `window.confirm`).
Why: one place and one look for confirmations; the board is analytics, so it reuses the reports permission. Rejected: inline confirm rows (cramped in tables, inconsistent).
By: claude-code

## 2026-11-17 — Journey: Design check after the creator's last look
Decision: a new stage `design_check` (Design check) follows Last look after design. SME reviewer (OWNER) or steward (`assign`) presses **Design approved**, or **Send back to design** with feedback to the developer; the loop then runs developer → creator last look → design check again. Existing journeys at Last look move on to Design check. The relay's fix loop (applet fixed by RELAY seat, creator ↔ reviewer, then developer ↔ reviewer/steward) is the same two loops in the dashboard; no separate applet-fix work type.
Why: Jeevan: the developer's fix is checked by both the creator and the reviewer/steward.

## 2026-11-23 — Relay publish status drives Submit for review; the dashboard never writes to the relay
Decision: `up_for_review` on the relay submits the journey here (creating → ready_for_review; changes_asked → correction_verification), only when the relay's `at` is later than the last `source: APP` stage change. `corrections_wip` and `ready_for_student` move nothing; disagreements are shown (`relayMismatch`), not fixed. `ready_for_student` is not Done (Jeevan, 23 Nov): it is the relay's "review over, final in UAT" and lines up with Review closed here, so closing a review sends the chapter's stewards an Inbox message to set it on the relay; design, prod steps and Done have no relay status. The fix seat reports applet fixes through `POST /api/relay/journeys/<key>/applet-fixes` (RELAY `bin/dash-push`).
Why: creators were doing "up for review" on the relay and never Submit here (10 journeys on 23 Nov); the service token is read-only and relay rule `human-record-16` lets only a human's word set the status. Rejected: auto-closing the review from `ready_for_student` (it is set after the UAT look, before design and prod: 14 journeys had it while not submitted here).

## 2026-11-23 — Relay "ready for students" closes the review here
Decision: `ready_for_student` on the relay walks the journey to Closed (creating → ready_for_review → review_in_progress → closed; changes_asked → correction_verification → closed), which hands it to a developer for design standardization. Submit takes the first `up_for_review` time, the rest the ready time. Same guard as `up_for_review`: only when later than the last `source: APP` stage change, so a reviewer's Ask for changes or a QA send-back made afterwards stands.
Why: Jeevan (23 Nov): the 14 journeys reviewed on the relay and never in the dashboard should be closed and go to the design loop. Supersedes the "rejected: auto-closing" note of the entry above.

## 2026-11-23 — Relay "corrections in progress" asks for changes here (PR #27)
Decision: `corrections_wip` on the relay moves the journey to Changes asked (submitted and review started on the way; Correction verification goes back to Changes asked), under the same "later than the last `source: APP` stage change" guard. Supersedes "`corrections_wip` moves nothing" in the first 23 Nov entry.

## 2026-11-23 — Two-way sync through one contract; the relay's own flow is not changed
Decision (Jeevan, 23 Nov): the relay keeps every existing verb, rule, reply and table as it is. Added beside it: a read over its append-only rows (`sync_feed`, cursor per source), one new table (`dashboard_events`) written only by this dashboard's token (`dashboard_event`, named in the relay's `DASHBOARD_TOKENS`), and `dashboard_log` to read it back. Here: the pull follows the feed (status read only for journeys it names), and every `WorkItemEvent` of a journey is sent to the relay through `RelayOutbox`. One writer per field; contract v1 in `src/lib/relay-contract.ts`, fixture shared with the relay repo.
Why: the old link was a 10-15 minute poll of 73 calls with nothing going back, so people were reminded by Inbox to set the relay status by hand and the two sides showed as mismatches. Rejected for now: the dashboard setting the relay's `publish_status` on a person's behalf (changes relay rule `human-record-16`; Jeevan will take it up on the relay later), a push from the relay into the dashboard (needs a hook in the relay's write paths), and sending a reassignment here to the relay's `allocate`.
Consequence: the relay's own publish status still only changes when a seat sets it. A difference between it and the stage here is not flagged once the later change here is in the relay's dashboard log (`relaySettled`). The Inbox message to stewards on Review closed ("Set the relay status: ready for students") is unchanged.

## 2026-11-24 — The relay's final publish status is `ready_from_content`
Decision: the relay renamed `ready_for_student` to `ready_from_content` on 23 Nov (relay PRs 730, 731; its stored rows were renamed too). Here the new name is used everywhere; `publishName` reads the old name as the new one, and a migration renames the publish events kept from before. Text says "ready from content".
Why: with the old name only, a journey the relay marked `ready_from_content` did not close its review here. It still means the same step: content is done, the review closes, and the journey goes to design standardization (the applet fix seat's stage).


## 2026-11-24 · Column filters, Integrations, relay people, team developer
- **Column filters.** Lists the server pages (Journeys / items) filter through the URL: a column title opens `UrlFilter` (`src/components/column-filter.tsx`), every filter but `q`, `scope`, `view` takes a comma list (`src/lib/items-where.ts`; people take `none`; select fields in the data use `f_<field>`). Every other table filters the rows on screen (`AutoFilters` in `src/components/table-filters.tsx`, built into `<Sheet>`; plain tables are wrapped in `FilterableTable`). A cell's filter value is `data-fv`, else its dropdown's picked option, else its text; `data-nofilter` on a title opts out. The filter panel became one slim row (`FilterBar`: search + pills); on phones the column filters show as pills there.
- **Admin → Sheet sync is now Admin → Integrations** (route `/admin/sync` unchanged).
- **Relay people.** A person the relay names (journey holder or chapter owner) who is not in People is created by `syncRelay` when the email is in `OFFICE_DOMAINS` (`planRelayPeople`): SME creator role for a holder, Steward with the relay's chapters for a chapter owner. Other emails and deactivated people are reported (`peopleIssues`), never added.
- **Team default developer.** `Team.developerId` (migration `20261124120000_team_default_developer`, seeded Jeevan → Team Devjyoti, Swathi → Team Arjun). When a review closes the journey goes to the developer already on it, else the creator's team's developer, else the least busy one. Changed on the Teams tab; journeys waiting in design on the old default follow.

## 2026-11-24 · Relay reopen is followed for the Creation stage only
- A reopen on the relay (`human-record-15`) lowers the Creation stage here to the stage the relay shows now; a reopen of the chapter or subtopic above leaves the journey with no Creation stage. A later change of the Creation stage made here stands.
- The review stage is never moved back by a reopen. A journey reopened while in review or later carries a note (`reopenLine`), and the chapter's stewards get one Inbox message, when the reopen is first seen.
- A reopen "stands" until the journey is back at Ship with an approval after it (`reopenStanding`), computed from the relay rows kept here, so journeys the feed did not name keep the note.

## 2026-11-24 · The relay's holder of a journey is kept, and a creator change here says so
- `syncRelay` keeps each relay allocation as a `RelayEvent` of kind `allocation` (holder email in `approver`, none = released; id from `allocationEventId`). No schema change. `relayHolders` (`src/server/relay-holder.ts`) reads the latest per journey.
- When the creator here is not that holder, the journey page and the Journeys list show "Relay holder: <name>. Ask an allocator to allocate <key> to <creator>." (`relayHolderNote`). The note goes when the relay's allocation agrees.
- Changing the creator of such a journey asks first (not blocked) and sends the chapter's stewards one Inbox message. Nothing is written to the relay.

## 2026-11-24 · Chapter and scope progress from the relay feed
- Relay stages 1 and 2 live under chapter and subtopic keys, which have no journey row. `syncRelay` keeps those feed rows as sent in `ChapterRelayEvent` (migration `20261124150000_chapter_relay_events`): allocation, scope_mode, step, approval, baseline, reopen. It reads them with its own cursor (`cursor.chapterFeed`, from the feed's first row), so no journey row is made early.
- The Chapters page shows a "Relay progress" card worked out from them (`chapterProgress`, `src/lib/relay-chapters.ts`): steward on the relay, chapter read, scopes approved of subtopics seen, scoped by steward or seats, journeys cut against journeys allocated here. A reopen takes back what was approved before it.
- The relay sends a scope approval's `data.journeys` as JSON text (`[{key, name}]`); `scopeJourneys` reads that or a list.

## 2026-11-24 · Last look by three roles, steward feedback
- **Last look after design** can be approved, or sent back to design with feedback, by the SME creator, the SME reviewer or a steward who can act on the journey (`LOOKER` in the Journey definition).
- **Design check is done with the last look** of the SME reviewer or a steward (Jeevan, 24 Nov 2026): the journey passes Design check at once (`passedByMover` on the stage, `stageAfterOwnCheck`). After the creator's last look, Design check runs as before. The history note reads "Design check done with Last look after design".
- **A steward gives feedback only** (Jeevan, 24 Nov 2026): the review buttons (Start review, Ask for changes, Close review) stay with the SME reviewer.
- A ticket's Inbox message names its writer and role; the FEEDBACK event's meta carries `role`, `for` (email) and `for_role`, which go to the relay in `dashboard_event` data with the text in `data.note` (cut at 2000).
- Live check, 24 Nov 2026: the Journey work type has one saved `WorkflowStage` row and none for `last_look`, so no saved "who may press" overrides the code.

## 2026-11-24 · The peer reviewer is removed
- Journey has no peer reviewer any more (Jeevan, 24 Nov 2026). It is gone from the journey page, the Journeys list (column and filter), the Teams tab, new journeys, the relay sync, "Fill missing reviewers", reports and exports, and it is no longer sent to the relay.
- **Columns dropped** (Jeevan's choice): migration `20261124160000_remove_peer_reviewer` drops `WorkItem.peerReviewerId` and `TeamMember.peerReviewerId`. On the live site that deletes the value on 95 journeys and 8 team members (counted 24 Nov). Apply it to Render before the deploy.
- History events with the field "Peer reviewer" are kept and shown; `dashEventFor` skips them (`PEER_FIELD`), so they are not sent.
- `src/lib/relay-contract.ts` and the fixture keep `peer_reviewer` in the role list: a value that is not sent does not move the contract. APK Testing is unchanged.

## 2026-11-25 · One rule for every search box
- Part or all of a word, any case; with several words each must match somewhere (`src/lib/search.ts`). Lists filtered in memory use `matchesSearch`, database lists `searchWhere` (`src/lib/items-where.ts`).
- Items match on key, group, title, chapter name and the names of the creator/assignee, reviewer, developer and Steward (worked out from teams: `stewardMatches`).
- `FilterBar`'s search applies as you type (400 ms pause), and at once on Enter.

## 2026-11-25 · Grade 7 and 8 chapters carry the part; the chapter picker
- The chapter list had grades 7 and 8 under one number for the whole book (G07C01 to G07C15, G08C01 to G08C14). The relay and every journey key name the part (G07P1C03). The relay sync then made a second row per chapter, named by its code, and two stewarded chapters had no row at all (name "—").
- Migration `20261125140000_chapter_part_codes` renumbers the 29 list rows to part codes (G07: 1-8 → P1, 9-15 → P2C01-07; G08: 1-7 → P1, 8-14 → P2C01-07), gives the four relay-made rows the list's name and details, and removes the four duplicates (no journey was on them). Mapping checked against the relay's `kg_nm_list_chapters`, 25 Nov 2026. Grades 9 and 10 are not changed: no journey key exists for them yet.
- A name equal to the code is not a name (`hasChapterName`): the page says "No name" and the picker leaves such rows out. A new code without the part is refused where the grade has part codes (`chapterCodeConflict`).
- The chapter code field is a picker (`ChapterPicker` in `src/components/chapters-panel.tsx`): chapters under their grade, found by code or name, keyboard and pointer; a code not in the list can still be typed.

## 2026-11-25 · A chapter with no name takes the relay's
- `syncRelay` ends with `nameChapters`: a chapter row whose name is empty or its own code takes the title from the relay's chapter list (`kg_nm_list_chapters`, CBSE rows only; the dashboard's read-only token may read it, probed 25 Nov 2026). A chapter that has a name is never changed, and the relay is read only when a chapter needs a name.
- Matching (`relayChapterName`): the relay's code is ours with `CB` in front and always a part. A code here with the part matches exactly; a code without it takes the one chapter of that grade with that number; two candidates = no name, nothing guessed. Such chapters are listed in the report (`chapterUnnamed`) and on Admin → Sheet sync.
- No rows are made from the relay's list: the picker still shows only the dashboard's own chapter list.

## 2026-11-25 · Relay audit: Grade 9, cut journeys, journey names, chapter titles
- Grade 9 follows the relay's chapter list: two books, Part 2 numbered on from 9 (`G09P1C01`-`C08`, `G09P2C09`-`C14`). Migration `20261125160000_grade9_part_codes` renumbers Part 1 and adds the six Part 2 chapters with the relay's titles. Grades 4-6 and 10 stay without a part (one book).
- A journey the relay cut (dropped from `allocations` by a scope re-cut) is archived by the sync only when the relay made it, it was never started, it is at the first status, and its chapter still has allocations on the relay. Event note "Cut on the relay"; if the relay allocates it again it is restored ("Allocated again on the relay"). Anything else missing on the relay is only listed (`notOnRelay`, shown on Admin → Sheet sync). Write path: `relayArchive` in `services/work-items.ts`; rule: `src/lib/relay-cut.ts`.
- Journey names come from the relay's `journey_state.name` feed rows (`<key>_<slug>`; allocations carry no name), kept as the slug. The sync reads the `states` source on its own cursor (`cursor.names`, with the latest name per key). A journey whose name is empty or its key takes the relay's; one still carrying the relay's earlier name follows a rename; a name given here is never changed (`src/lib/relay-names.ts`, `relayRename`).
- Chapter titles: where the relay's list and the dashboard differ, the dashboard keeps the NCERT book's title (checked 25 Nov: "Exploring Some Geometric Themes", "Data Handling and Presentation", "Connecting the Dots..."). The relay's three wrong titles were sent to the relay admin on Slack, 25 Nov (note: `../RELAY/scratch/relay-chapter-titles-note.md`).

## 2026-11-26 · Feedback update: QA role, ticket "To", open tickets on a move, Feedback tab, link chips
- **QA** (Jeevan, 26 Nov 2026): new capability `qa` (`AccessRole.capQa`, migration `20261126090000_qa_role`) and a Journey role `qa`. At User testing and QA a QA person or the steward marks done, or sends back with a ticket: **Send to creator** (→ Changes asked, sets `qaFix`) or **Send to developer** (→ Design standardization). No "Fixed it myself" button.
- **After a QA fix the journey goes to prod again, then QA** (Jeevan's choice). Creator fix: `skipWhen` (now one rule or a list) passes Closed, the design steps and Video replacement while `qaFix = Yes`, so Close review lands at UAT → prod migration, which clears the mark (`StatusDef.clears`). Developer fix: the normal line.
- **Ticket "To"**: the writer picks the creator, the SME reviewer or the developer (`ticketChoices`, `ticketReader`); the default is the old rule (`counterpart`). A send-back ticket always goes to the person who gets the work.
- **Open tickets on a move** (Jeevan: show them, and close them if the person goes ahead): moves marked `settles` (Close review, Last look done, Design approved, Mark done) list the open tickets; confirming closes them with the move (note on the stage event, one Inbox message per ticket side). Without the confirmation the server refuses the move. Corrections done and Design done are not settling. A change the system makes (relay sync) leaves tickets open.
- **Feedback tab** (`/w/journey-applet/feedback`, `mod.pages.feedback`): Assigned to me, Opened by me, and All tickets for admins. Shown to admins and to anyone who can make changes in the work type; not to view-only roles.
- **Links**: `linkParts` turns `http(s)` links in a ticket body or chat message into chips (`RichText`); nothing else becomes a link.
- Relay: the writer role `qa` goes out in the feedback event's `data.role` (free text there; the contract's role list is for assignment events only). The contract fixture is unchanged.
