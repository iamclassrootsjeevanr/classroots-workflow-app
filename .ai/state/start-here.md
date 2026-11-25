# STATE — branch: start-here
<!-- Overwritten on every handoff. Under 80 lines. Describes NOW. -->

Updated: 2026-11-25T12:19:24Z · by: claude-code · owner: Jeevan

## Goal
Close the gaps between the relay and the Dashboard, prompt by prompt, from the plan page `../RELAY/scratch/relay-dashboard-workflow.html` (tabs: Relay 1-5, Dashboard 1-11, Fix seat 1). Rule of 24 Nov: one side owns each action, the other side copies it. Each prompt has its own gates ("ask me before you build").

## Done this stretch (24-25 Nov)
- **25 Nov, capacity 10** (commit 5f60a1a), PR 33 **merged** 25 Nov 12:18Z, both checks passed; Render deploy not checked. Migration `20261125120000` (column default 10), applied locally.
  - Data: all 21 users set to 10 on the local and Render databases (were 3, one already 10).
  - PR 32 (counts) merged 12:03Z and checked live: Overdue card 6 = list 6.
- **25 Nov, counts vs lists** (commit eb9ce4a), PR `start-here` → `development`. PR 31's Render deploy was checked: live.
  - Overdue list leaves out approved items where the due date ends there (`isOverdue`); Overview's Overdue tile opens a list with no work type picked.
  - My dashboard "My work": tiles and lists = assignee or developer (`?holder`, chip "Work of"); due-in-7 leaves out handed-off items.
  - 307 tests and typecheck pass; checked on the local copy (View as Jeevan R). `npm run build` not run; phone width and light mode not checked.
- **25 Nov, Overview / Reports / search** (commit 8162880), **merged** as PR 31 (merge commit be62fc2, 25 Nov 07:14Z); `start-here` = `development`. Render deploy not checked.
  - Overview and Reports: Search, Work type, User filters (`?q`, `?user`); tiles carry both to the item list.
  - Search: part or all of a word, every word anywhere, as you type (`src/lib/search.ts`, `searchWhere`, `stewardMatches`).
  - Reports: one table per work type, per person under the role name; mixed lists say User (`src/lib/role-names.ts`).
  - Sign-in: "Classroots users", no-password line removed.
  - 305 tests and typecheck pass; checked in Chrome (desktop dark; Overview/Reports phone light and dark). `npm run build` not run here; both PR checks passed.
- **Dashboard 3, 4, 5, 6, 7 built, merged and live.** PR 30 (`start-here` → `development`, merge commit 5919aa7), Render deployed it and applied both migrations at 24 Nov 12:33Z. `start-here` = `development`.
  - 3 (9b26689): a relay reopen moves the Creation stage back (`reopenFollow`, `reopenStanding`, `reopenLine` in `src/lib/relay-review.ts`); the review stage never moves; stewards get one Inbox message.
  - 4 (8305184): the relay's holder is kept (`RelayEvent` kind `allocation`); "Relay holder: …" note; creator change asks first (`src/lib/relay-holder.ts`, `src/server/relay-holder.ts`).
  - 5 (eb7078b): `ChapterRelayEvent` (migration `20261124150000`); "Relay progress" card on the Chapters page (`src/lib/relay-chapters.ts`).
  - 6 (5c61940): last look by creator, SME reviewer or steward; Design check passed with the reviewer's or steward's look (`stageAfterOwnCheck`); a steward gives feedback only.
  - 7 (1ef958f): peer reviewer removed; columns dropped (migration `20261124160000`, Jeevan's choice).
- **Relay 1, 3, 4 built, pushed, not merged.** Repo `../journey_studio_mcpiser`, branch `workflow-dashboard` (in step with origin, 5 commits ahead of `main`, `main` merged in). PR https://github.com/classrootsedu/journey_studio_mcpiser/pull/736 is OPEN and CONFLICTING since Aswin merged relay PR 738 (25 Nov 06:43Z); no review. Aswin (relay admin) has the PR and details on Slack. Jeevan: push it later.
  - 1: an applet fix step (`sim:<id>`) carries its journeys (`data.journeys`, JSON text). First step ~20 s.
  - 3: the relay copies the reviewer's decision from `dashboard_event` (changes asked → `corrections_wip`, closed or later → `ready_from_content`); new table `dashboard_copies`; rows marked `via: "dashboard"`. Item 5 (tell the SME reviewer's own seat) left out.
  - 4: project, detail and journey pages and `journey_status` show the dashboard stage.
- Live check after the deploy: health 200; 12:40Z sync: `chapterFeedRows` 436, `relayHolderRows` 97, 0 errors, 0 mismatches, 0 reopened. Local DB is a fresh copy of Render (`npm run db:pull`, sheet sync off in the copy).
- At the 24 Nov merge: typecheck, tests and build passed; relay `npm test` passed.

## In progress
Nothing mid-edit. Both working trees clean.

## Next steps
0. Check the Render deploy of PR 33: health, and People & access → Add person starts at capacity 10.
0b. Count gaps found and not fixed (Jeevan said "fix 1–3 for now"): My dashboard charts open everyone's items; "Done (30 days)" and "Approved / done (30 days)" lists have no date filter; Reports chapter chart ignores From/To and drops User/Search; Overview "Period" does not change the tiles; "Unassigned" and Teams "open" lists would include done; many numbers are not clickable (Overview with no work type, workload table, charts, Work done, Reports summary); "In progress" includes corrections on Overview, not in the Journey header.
1. When Jeevan says: resolve relay PR 736's conflicts (`docs/DASHBOARD-SYNC.md`, `relay/src/worker.js`: merge relay `main` into `workflow-dashboard`, `npm test`, push). Then wait for Aswin to merge. Check: `gh pr view 736 --repo classrootsedu/journey_studio_mcpiser --json state`. Do not merge it yourself.
2. When Jeevan says "the relay is live": build **Dashboard 1** (count applet fixes from the feed's `data.journeys`; replaces the hand count of `dash-push fixes`) and **Dashboard 8** (review: the reviewer decides here, the relay copies; drop the "set the relay status" reminders that Relay 3 makes untrue; read `data.via`). Take each prompt's text from the plan page. One PR to `development`.
3. Relay 2 (read-only check that a journey is on prod): the note `../RELAY/scratch/relay-2-prod-check-note.md` is written, not sent. Send it to Aswin on Jeevan's word; build Relay 2, then Dashboard 2, only after Aswin's yes.
4. Phase 2, after phase 1: Relay 5, Dashboard 10, Dashboard 11 (after 6), Fix seat 1. Dashboard 9 is on hold ("Do not run this now").
5. Offered, not asked for: update the plan page ("Gaps in this page", today's changes; its `dash-push` line is out of date).
6. Promote development → staging → main (Jeevan's call; he said "Not yet").

## Blockers / open questions
- Offered: split Reports' Items list per work type (it is still one list); desktop light mode not checked.
- Relay PR 736 needs the conflicts fixed, then Aswin's review and merge. Nothing goes to the relay's `main` without his OK.
- Relay 3 item 5 needs the admin told first.
- The relay's full page build (`relay/scripts/build-pages.sh`) could not run on this Mac: the gh login cannot read `classrootsedu/kg-portal`. Only the tool-chip check was done by hand (52 tools match).
- Render DB password was exposed in an earlier session: rotate it.
- Test not written: "a reviewer who is not the steward" (went with Relay 3 item 5).

## Key files
- Plan: `../RELAY/scratch/relay-dashboard-workflow.html`; note: `../RELAY/scratch/relay-2-prod-check-note.md`
- In: `src/server/services/relay-sync.ts`, `src/lib/relay-review.ts`, `src/lib/relay-map.ts`, `src/lib/relay-chapters.ts`, `src/lib/relay-holder.ts`
- Out: `src/lib/relay-push.ts`, `src/server/services/relay-push.ts`; contract `src/lib/relay-contract.ts`, `tests/fixtures/relay-contract.v1.json` (unchanged this stretch)
- Journey flow: `src/modules/journey-applet/definition.ts`, `src/lib/stages.ts`, `src/server/services/work-items.ts`, `src/components/controls.tsx`
- `scripts/relay-sync.ts` (`--dry-run`, `--key`, `--fixture`, `--push`); `.ai/DECISIONS.md` (24 Nov, five entries); `.ai/LEARNINGS.md`
- Relay: `relay/src/lib/{publish-status,sync-feed,dashboard-events,applet-uses,steps,project-page}.mjs`, `relay/src/worker.js`, `docs/DASHBOARD-SYNC.md`
