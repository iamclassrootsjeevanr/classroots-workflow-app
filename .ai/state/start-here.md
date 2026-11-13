# STATE — branch: start-here
<!-- Overwritten on every handoff. Under 80 lines. Describes NOW. -->

Updated: 2026-11-14T12:00:00Z · by: claude-code · owner: Jeevan

## Goal
Journey: live link to the RELAY (buildjourneyrelay) so creation progress flows into the dashboard; the dashboard keeps review and everything after. Earlier: APK Testing versions as work items, Journey developer handoff.

## Done this stretch
- **RELAY pull sync** (relay feeds creation, dashboard owns review; one way RELAY → dashboard). `src/server/relay/client.ts` (MCP over HTTPS, Cloudflare service token or `RELAY_AUTH=sso` + `RELAY_SSO_HOME` for local tests), `src/lib/relay-map.ts` (pure parse/map, tests in `tests/relay-map.test.ts`), `src/server/services/relay-sync.ts` (`syncRelay`: creates allocated journeys, assigns creators by email then by name, Creation stage from the relay's `stage`, stores events in `RelayEvent`, never lowers a stage, never touches review statuses). Runs from `runJobs`, Admin → Sheet sync → Journey relay (Sync now / Dry run), `npm run relay:sync` (`--dry-run`, `--key`, `--probe`, `--fixture`).
- Migrations `20261114090000_relay_events`, `20261114100000_relay_event_per_journey` (applied locally only). RELAY card on the journey page. Journey keys accept `G07P1C03ST2J1` and `_slug` (`parseJourneyKey`, `journeyKeyOf`).
- Applied to the LOCAL db with Jeevan's SSO (read-only on the relay): 39 G07 journeys added, 23 stages updated, ~490 events. Krishna's email changed to krishna.rander@classrootsedu.com locally and in scripts.
- Journey: coordinator role is shown as **Steward**; list Developer column is a dropdown (steward or creator, only while in Design standardization, tinted; paused stage = no developer); design loop: creator sends back from Last look with feedback, developer fixes and presses Design done again (feedback/replies/notifications for the developer); My dashboard shows journeys held as developer; Journeys list/inbox link fix (resolve by key).
- Admin "View as" (VIEW_AS) for testing roles. `docs/CHAPTER-WALKTHROUGH.md` (simple end-to-end example by role). README, DECISIONS, LEARNINGS updated.
- `npm run typecheck` clean, `npm test` 211 passing. Signed-in pages NOT viewed in a browser (agents cannot sign in).

## In progress
Nothing mid-edit. Code is not broken. Unverified: the React "unique key" warning fix in `src/app/(app)/layout.tsx` / `mobile-nav.tsx` (best guess).

## Next steps
1. Jeevan: restart `next dev` (`rm -rf .next && npm run dev`) after the Prisma changes; check My dashboard (as Developer), journey page RELAY card, Journeys list Developer dropdown, Last look send-back, Admin → Sheet sync.
2. Get a Cloudflare Access **service token** (must be allowed to call `allocations` and `journey_status`). Then on Render set `RELAY_URL`, `RELAY_CF_CLIENT_ID`, `RELAY_CF_CLIENT_SECRET`, run `npm run db:deploy`, `npm run relay:sync -- --dry-run`, review, then apply.
3. Render/staging DB also needs: `npm run apk:versions -- --apply --close-old`, `npm run journey:developers -- --people "Jeevan,Swathi" --apply`, `npm run notifications:fix-links -- --apply`, and Krishna's email changed in Admin → People.
4. Relay report items to decide: 5 journeys whose relay holder differs from the tracker creator, 3 journeys Published here but at 5 on the relay, 7 old journeys not on the relay; whether the relay's publish status (up_for_review, corrections_wip, ready_for_student) should ever drive a dashboard status (today display only).
5. Later: more workflow stages, round counter / verify step in the design loop, count developer-held journeys in load.

## Blockers / open questions
- Cloudflare service token (needs an Access admin).
- Journey: 5 Team Devjyoti journeys still have Arjun as SME reviewer; peer reviewer meaning; QA fix routing.
- Railway/Render account details for deployment.

## Key files
- `src/server/services/relay-sync.ts`, `src/server/relay/client.ts`, `src/lib/relay-map.ts`, `scripts/relay-sync.ts`
- `src/server/jobs.ts`, `src/app/(app)/admin/sync/page.tsx`, `src/app/(app)/w/[workType]/[itemId]/page.tsx`
- `src/modules/journey-applet/definition.ts`, `src/lib/stages.ts` (developerStage), `src/server/view.ts` (developerEditsFor)
- `docs/CHAPTER-WALKTHROUGH.md`, `docs/JOURNEY-WORKFLOW.md`
