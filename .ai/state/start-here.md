# STATE — branch: start-here
<!-- Overwritten on every handoff. Under 80 lines. Describes NOW. -->

Updated: 2026-11-23T08:00:00Z · by: claude-code · owner: Jeevan

## Goal
One flow across RELAY and the Dashboard: a journey is built on the relay, "up for review" there submits it here, review and the after-steps run here, and both end at ready for students.

## Done this stretch
- PR #24 merged (Design check stage); `development` = db710ac.
- **Commit 3fe53e1 on `start-here`, not in `development` yet:**
  - `src/lib/relay-review.ts` (pure, tested): `reviewMoves` (relay `up_for_review` → creating → ready_for_review; changes_asked → correction_verification; only when later than the last `source: APP` stage change), `relayMismatch` (what to do where relay status and stage disagree), `appletFixesText`.
  - `syncRelay` applies the moves (stamped with the relay's time, note "Up for review on the relay", reviewer notified) and reports `reviewMoves` / `mismatches`; it now calls `refreshStages(true)` itself.
  - Journey page RELAY card: relay status + the mismatch note. Admin → Sheet sync lists moves and mismatches.
  - Notifications: design check → reviewer (else stewards); send-back from design check → developer; Done → stewards "Set the relay status: ready for students" (only when the relay is not there yet).
  - `POST /api/relay/journeys/<key>/applet-fixes` `{fixed, total, reviewUrl?}` → fields **Applets fixed**, **Fix review journey** (no migration: JSON data).
  - RELAY side (not a git repo): `RELAY/bin/dash-push fixes|show`, CLAUDE.md step 7 line, `memory/classroots-work-dashboard.md`.
- Verified: 242 tests + typecheck pass; local DB synced for real (10 moves, re-run moves 0); endpoint and `dash-push` tested against local dev. **Journey page not checked in a browser** (agents cannot sign in).
- Dry run against Render (read-only, 23 Nov): the first sync after deploy will move 10 journeys (G04C05ST2J1 → Correction verification; G06C07ST2J2, ST3J1, ST3J2, ST4J3, ST6J2, ST6J3, G07P1C03ST1J1, ST1J2, G05C02ST1J1 → Ready for review) and flag 17 (14 "ready for students on the relay" but not submitted / review not closed here; 3 in corrections on the relay, not submitted here).

## In progress
Nothing mid-edit. Code is not broken. `docs/JOURNEY-BRIEF.md` and `docs/JOURNEY-FOLLOW-UP.md` were renamed to `*-done.md` by Jeevan (not by this session).

## Next steps
1. Jeevan: sign in locally, open a journey with a relay status (e.g. G06C07ST3J1) and check the RELAY card at 375px + desktop, light + dark.
2. PR `start-here` → `development` (merge commit). Tell reviewers first: 10 journeys get submitted on the first sync.
3. Render: confirm `RELAY_KEY` is set and equals the one `RELAY/bin/dash-push` reads (a 401 means it differs).
4. Decide the 14 journeys that are ready for students on the relay but never reviewed here: review them here, or an admin sets their stage.
5. Ask the relay admin whether the dashboard's token may call `publish_status` (then Ask for changes → `corrections_wip`, Done → `ready_for_student` can be written instead of reminded).
6. Promote development → staging → main; ticket attachments; more screen redesigns.

## Blockers / open questions
- When is a journey "ready for students"? On the relay it is set after the UAT look, before design and prod; here Done is after prod QA. Today: reminder at Done, no auto-close from the relay.
- Render DB password was exposed in an earlier session: rotate it.
- 5 Team Devjyoti journeys still have Arjun as SME reviewer; peer reviewer meaning; QA fix routing.

## Key files
- `src/lib/relay-review.ts`, `src/lib/relay-map.ts`, `src/server/services/relay-sync.ts`, `src/server/services/relay.ts`
- `src/server/services/work-items.ts` (`notifyStage`, `relayNotReady`), `src/modules/journey-applet/definition.ts`
- `src/app/api/relay/**`, `src/app/(app)/admin/sync/page.tsx`, `src/app/(app)/w/[workType]/[itemId]/page.tsx`
- RELAY: `bin/dash-push`, `CLAUDE.md`, `memory/classroots-work-dashboard.md`
