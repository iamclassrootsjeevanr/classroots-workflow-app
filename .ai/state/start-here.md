# STATE — branch: start-here
<!-- Overwritten on every handoff. Under 80 lines. Describes NOW. -->

Updated: 2026-11-24T05:45:00Z · by: claude-code · owner: Jeevan

## Goal
One flow across RELAY and the Dashboard, both ways, through one contract: the relay feeds creation and its publish status; the dashboard owns review and everything after, and tells the relay what happens here. The relay's own flow is not changed.

## Done this stretch (23-24 Nov)
- **Two-way sync built and deployed on both sides.**
  - Relay repo `classrootsedu/journey_studio_mcpiser` (local clone `../journey_studio_mcpiser`, branch `workflow-dashboard`): PRs 733 and 734 merged to `main`, deployed 24 Nov ~05:33Z. New tools: `sync_feed` (read), `dashboard_event` (write, this dashboard's token only, via `DASHBOARD_TOKENS`), `dashboard_log` (read). New table `dashboard_events`. Nothing existing changed. Contract doc: `docs/DASHBOARD-SYNC.md` there.
  - Dashboard: commit 4c934c1 on `start-here`, live on Render (migrations `20261123140000_relay_two_way`, `20261124090000_relay_ready_from_content` applied 05:31Z). PR 28 (`start-here` → `development`) merged by Jeevan 24 Nov 05:29Z (1b2b259, CI green); `start-here` fast-forwarded to it.
- **How it runs** (each cron tick, `src/server/jobs.ts` `relayJob`): `pushRelay` (queue every journey `WorkItemEvent` in `RelayOutbox`, send with `dashboard_event`) → `syncRelay` (`sync_feed` from `RelaySyncState.cursor`, `allocations`, `journey_status` only for journeys the feed names; full pass first time, daily, `--full`, or no feed).
- **Relay renamed its final status** `ready_for_student` → `ready_from_content` on 23 Nov (relay PRs 730/731). The old Dashboard code did not close reviews for it. Fixed: new name everywhere, `publishName` reads the old one, stored publish events renamed (25 on Render).
- Flags: a relay/dashboard status difference is not flagged once the later change here is in the relay's log (`relaySettled`); Published vs relay "5 · Ship" is not "ahead".
- Checked: 262 tests, typecheck, `npm run build`; relay `npm test`; a local run of this repo's sync code against the relay's modules (281 changes sent, 0 refused, same stage both sides for 74/74 journeys); live `--probe` shows `sync_feed` and `dashboard_log` answering.
- **First live run, Render 24 Nov 05:40Z:** full pass, 98 journeys read, 0 errors, 0 mismatches, cursor saved; 403 changes sent to the relay, 0 refused. `--log G06C07ST7J1` on the live relay gave 6 events, status changes_asked, creationStage 5 · Ship (same as here).
- First relay deploy (PR 733) failed at the page mint: `/machinery` must list every tool as a chip (`relay/pages-src/machinery.html`). PR 734 added them.

## In progress
Nothing mid-edit. Local DB stopped; it has both migrations and no outbox rows.

## Next steps
1. Look at the new admin section in a browser (never seen rendered; needs Jeevan's sign-in).
2. Promote development → staging → main (Jeevan's call).
3. Tell the team about the journeys the sync moved (Jeevan's go; not sent). Counts on 23 Nov: 14 design standardization, 8 reviewers, 1 correction verification, 5 changes asked.
4. Later, on the relay (Jeevan will take it up): whether the relay's `publish_status` should follow the dashboard. Today a seat still sets it; the Inbox reminder to stewards on Review closed is unchanged.
5. Render: confirm `RELAY_KEY` equals the one `RELAY/bin/dash-push` reads (401 = differs); `dash-push` not yet run against the live site.

## Blockers / open questions
- Render DB password was exposed in an earlier session: rotate it.
- 5 Team Devjyoti journeys still have Arjun as SME reviewer; peer reviewer meaning; QA fix routing.
- A reassignment here does not change the relay's allocation (stays a `creatorDiffers` report).
- A stage an admin adds here is sent to the relay as a field named `status`, not as a status (the contract lists 15).

## Key files
- Contract: `src/lib/relay-contract.ts`, `tests/fixtures/relay-contract.v1.json` (same file as the relay's `relay/test/fixtures/dashboard-contract.v1.json`)
- Out: `src/lib/relay-push.ts`, `src/server/services/relay-push.ts`, model `RelayOutbox`
- In: `src/server/services/relay-sync.ts`, `src/lib/relay-map.ts`, `src/lib/relay-review.ts`, `src/server/relay/client.ts`
- `src/server/jobs.ts`, `scripts/relay-sync.ts` (`--probe`, `--full`, `--push`, `--log`), `src/app/(app)/admin/sync/page.tsx`
- `tests/relay-contract.test.ts`; `.ai/DECISIONS.md` (23, 24 Nov); `.ai/LEARNINGS.md`
- Relay: `relay/src/lib/{sync-feed,dashboard-events,dashboard-contract,readonly}.mjs`, `relay/src/worker.js`, `relay/wrangler.toml`
