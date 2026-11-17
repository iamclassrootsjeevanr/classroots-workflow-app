# STATE — branch: start-here
<!-- Overwritten on every handoff. Under 80 lines. Describes NOW. -->

Updated: 2026-11-17T07:05:00Z · by: claude-code · owner: Jeevan

## Goal
Run the Journey workflow on the deployed `development` site (Render) from RELAY data: stewards, creators, teams, developers. Keep Dashboard and RELAY in sync (relay feeds creation; dashboard owns review and after).

## Done this stretch
- Surveyed both projects. RELAY = fix seat on remote buildjourneyrelay (applet fixes to Canvas 2.4.0; `journeys/` is its own git repo `relay-journeys`). Dashboard pulls from the relay via `syncRelay`.
- Render cron is live: `RelaySyncState.lastRunAt` 2026-11-17 06:50 UTC, ok, zero changes (no drift); a workload snapshot exists for 2026-11-17. Render deploy has the latest migrations (`20261116130000_developer_own_data`).
- Commits 8ba0b8c / ade85b7 (subtopic-held journeys follow holder; teams are defaults, nobody moved) are in `development`; `start-here` is level with it.
- Docs: README relay-sync wording now says cron, not 5–10 min timer; README Render section gained a "Schedule" step (Cron Job calling `/api/cron/run`); `docs/USER-MANUAL.md` has the live URL https://classroots-workflow-app.onrender.com; LEARNINGS cron note updated.
- Krishna's email already krishna.rander@classrootsedu.com on Render. `npm run typecheck` and 232 tests pass.

## In progress
Nothing mid-edit. Code is not broken.

## Next steps
1. Live site: Admin → Sheet sync → Journey relay → Dry run, spot-check stewards (G06C07 → Vinay, G08P2C01 → Aswin), Change steward, and View as Jeevan R / Swathi (developers see only theirs). 375px + desktop, light + dark.
2. Applet-fix sync gap: Dashboard has no record of RELAY fix-seat work (27 G06C07ST6J1 applets "in progress · canvas 2.4.0 sync" in `RELAY/applets/INDEX.md`). Decide shape (a work type or field + endpoint under `/api/relay`, called by the seat at route step 7); `RELAY_KEY` is not yet in RELAY's seat files.
3. Cross-reference notes: add a short pointer in RELAY `memory/` to this Dashboard and its `/api/relay` door, and in `.ai/LEARNINGS.md` the reverse (done here only for cron).
4. Promote development → staging → main when ready; ticket attachments; more screen redesigns.

## Blockers / open questions
- Render DB password was exposed in an earlier session: Jeevan should rotate it.
- Krishna, Vaishali, Supriya work in both relay teams: dashboard keeps one team each.
- 5 Team Devjyoti journeys still have Arjun as SME reviewer; peer reviewer meaning; QA fix routing.
- Cron interval on Render not verified from here (only that one run ran at 06:50 UTC); check the Cron Job's schedule in Render.

## Key files
- `src/lib/relay-map.ts`, `src/server/services/relay-sync.ts`, `src/server/relay/client.ts`, `src/server/jobs.ts`
- `src/app/api/cron/run/route.ts`, `src/app/api/relay/**` (push door, unused)
- `README.md` (Render section), `docs/USER-MANUAL.md`
- RELAY side: `RELAY/CLAUDE.md`, `RELAY/applets/INDEX.md`, `RELAY/journeys/README.md`
