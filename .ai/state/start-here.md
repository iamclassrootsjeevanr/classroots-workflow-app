# STATE — branch: start-here
<!-- Overwritten on every handoff. Under 80 lines. Describes NOW. -->

Updated: 2026-11-23T10:30:22Z · by: claude-code · owner: Jeevan

## Goal
One flow across RELAY and the Dashboard: a journey is built on the relay, "up for review" there submits it here, the review runs here, and "ready for students" on the relay (review over, final in UAT; not Done) closes the review here and sends the journey to design standardization. Design, prod steps and Done are dashboard only.

## Done this stretch
- PR #24 merged (Design check stage); `development` = db710ac, merged back into `start-here`.
- **On `start-here`, not in `development` yet (3fe53e1, 7303979, 0b7c9d9). No PR open.**
  - `src/lib/relay-review.ts` (pure, tested): `reviewMoves`, `relayMismatch`, `appletFixesText`.
    - Relay `up_for_review`: allocated/creating → ready_for_review; changes_asked → correction_verification.
    - Relay `ready_for_student`: walks submit → review → closed (dates stamped: submitted = first `up_for_review` time, review = `ready_for_student` time); closing hands off to design standardization with a developer, who is notified.
    - Guard: only when the relay status is later than the last `source: APP` stage change. A later change here stands.
  - `syncRelay` applies the moves, reports `reviewMoves` / `mismatches`, and calls `refreshStages(true)` itself.
  - Journey page RELAY card: relay status + mismatch note. Admin → Sheet sync lists moves and mismatches.
  - Notifications: design check → reviewer (else stewards); send-back from design check → developer; Review closed → stewards "Set the relay status: ready for students" (only when the relay is not there yet).
  - `POST /api/relay/journeys/<key>/applet-fixes` `{fixed, total, reviewUrl?}` → fields **Applets fixed**, **Fix review journey** (no migration: JSON data).
  - RELAY side (`../RELAY`, not a git repo): `bin/dash-push fixes|show`, CLAUDE.md step 7 line, `memory/classroots-work-dashboard.md`, `.dash.env` git-ignored.
- Verified: 245 tests + typecheck pass; rule applied on the local DB (reviews closed, dates stamped, re-run moves 0); endpoint and `dash-push` tested against local dev only. **Journey page not checked in a browser** (agents cannot sign in).
- Read-only dry run against Render (23 Nov): the first sync after deploy moves 24 journeys, 0 errors.
  - 14 close → Design standardization, split between Jeevan R and Swathi: G04C05ST1J2, ST1J3, ST1J4, ST3J2, ST4J1, ST5J1; G05C02ST4J1, ST4J2; G06C07ST1J1, ST1J2, ST2J1, ST4J1, ST4J2, ST6J4.
  - 9 → Ready for review: G06C07ST2J2, ST3J1, ST3J2, ST4J3, ST6J2, ST6J3; G07P1C03ST1J1, ST1J2; G05C02ST1J1.
  - 1 → Correction verification: G04C05ST2J1.
  - 4 stay flagged (in corrections on the relay, not submitted here): G06C07ST7J1, G07P1C08ST5J1, G05C02ST6J1, ST6J2.

## In progress
Nothing mid-edit. Code is not broken. The live site is unchanged: the 14 journeys close only after the PR is merged, Render deploys and the next sync runs.

## Next steps
1. Jeevan: sign in locally (`npm run db:start`, `npm run dev`), open a journey with a relay status (e.g. G06C07ST3J1) and check the RELAY card at 375px + desktop, light + dark.
2. Tell the team: the first sync moves 24 journeys (14 to the developers' design queue, 9 to reviewers, 1 to correction verification).
3. PR `start-here` → `development`, **Create a merge commit**. Jeevan had not yet said yes to opening it.
4. After deploy: Admin → Sheet sync, check the 24 moves match the list above and the 4 flags remain.
5. Render: confirm `RELAY_KEY` is set and equals the one `RELAY/bin/dash-push` reads (a 401 means it differs). `dash-push` has not been run against the live site.
6. Ask the relay admin whether the dashboard's token may call `publish_status` (then Ask for changes → `corrections_wip` and Review closed → `ready_for_student` can be written instead of reminded).
7. Promote development → staging → main; ticket attachments; more screen redesigns.

## Blockers / open questions
- Render DB password was exposed in an earlier session: rotate it.
- 5 Team Devjyoti journeys still have Arjun as SME reviewer; peer reviewer meaning; QA fix routing.
- Settled 23 Nov (in DECISIONS): "ready for students" = review over, final in UAT; it is not Done, and it closes the review here.

## Key files
- `src/lib/relay-review.ts`, `src/lib/relay-map.ts`, `src/server/services/relay-sync.ts`, `src/server/services/relay.ts`
- `src/server/services/work-items.ts` (`notifyStage`, `relayNotReady`), `src/modules/journey-applet/definition.ts`
- `src/app/api/relay/**`, `src/app/(app)/admin/sync/page.tsx`, `src/app/(app)/w/[workType]/[itemId]/page.tsx`
- `tests/relay-review.test.ts`; `.ai/DECISIONS.md` (17 Nov, 23 Nov entries); `.ai/LEARNINGS.md` (remote dry-run wrapper)
- RELAY: `bin/dash-push`, `CLAUDE.md`, `memory/classroots-work-dashboard.md`
