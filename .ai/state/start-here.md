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
- New Journey stage **Design check** after Last look (`definition.ts`): SME reviewer or steward approves or sends back to the developer with feedback. Docs, tests and DECISIONS updated. Journeys sitting at Last look move on to it. 232 tests pass.
- Krishna's email already krishna.rander@classrootsedu.com on Render. `npm run typecheck` and 232 tests pass.

## In progress
Nothing mid-edit. Code is not broken.

## Next steps
1. Live site: Admin → Sheet sync → Journey relay → Dry run, spot-check stewards (G06C07 → Vinay, G08P2C01 → Aswin), Change steward, and View as Jeevan R / Swathi (developers see only theirs). 375px + desktop, light + dark.
2. Applet-fix visibility: the fix loops are the Journey's own two loops (creator↔reviewer, developer↔creator/reviewer), so no new work type. Show the relay's fix activity on the journey: pull `journey_status` version bumps/reopens as RelayEvents (already stored) and show them in the journey history; Jeevan has RELAY_KEY (Dashboard `.env` has it) for the `/api/relay` push if the seat should call it. Open: what exactly should the seat push at route step 7 (upload / re-link)?
2b. Merge to development (PR, merge commit) so Render gets Design check, then test it on live.
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
