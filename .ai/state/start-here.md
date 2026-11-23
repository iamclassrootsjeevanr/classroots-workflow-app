# STATE — branch: start-here
<!-- Overwritten on every handoff. Under 80 lines. Describes NOW. -->

Updated: 2026-11-23T12:18:55Z · by: claude-code · owner: Jeevan

## Goal
One flow across RELAY and the Dashboard: a journey is built on the relay, "up for review" there submits it here, the review runs here, and "ready for students" on the relay (review over, final in UAT; not Done) closes the review here and sends the journey to design standardization. Design, prod steps and Done are dashboard only.

## Done this stretch
- **Everything is in `development`** (378c487); `start-here` fast-forwarded to it. No PR open.
  - PR #25 merged: relay `up_for_review` submits here, `ready_for_student` closes the review → design standardization; RELAY card + mismatch note; Admin → Sheet sync lists moves; applet-fixes endpoint (`src/lib/relay-review.ts`, `relay-sync.ts`).
  - PR #26 merged (another session): Journeys list column order via a work type's `table.order` (SME creator, Creation stage, Status, SME reviewer, Steward, Peer reviewer, Developer) — `src/components/items-table.tsx`, `src/modules/types.ts`, `journey-applet/definition.ts`.
  - PR #27 merged (another session): relay `corrections_wip` → Changes asked here (submit + review started on the way; Correction verification goes back to Changes asked); same "later than the last APP stage change" guard; creator is told.
- RELAY card checked in a browser (Chrome, Demo Admin): light + dark, desktop + a 375px-wide layout forced inside a 570px window (Chrome's minimum; not a real 375px viewport). G06C07ST3J1 (no note) and G06C07ST7J1 (mismatch note) both fine.
- **Render DB updated by hand (23 Nov, ~12:00Z):** `db:pull` (local = Render copy from before the sync), schema current (22 migrations), then a real `relay:sync` run from this Mac against Render: 24 moves, 0 errors; dry run right after = 0 moves.
  - 14 → Design standardization: G04C05ST1J2, ST1J3, ST1J4, ST3J2, ST4J1, ST5J1; G05C02ST4J1, ST4J2; G06C07ST1J1, ST1J2, ST2J1, ST4J1, ST4J2, ST6J4.
  - 9 → Ready for review: G06C07ST2J2, ST3J1, ST3J2, ST4J3, ST6J2, ST6J3; G07P1C03ST1J1, ST1J2; G05C02ST1J1.
  - 1 → Correction verification: G04C05ST2J1.
  - 4 reported as mismatches (corrections on the relay, not submitted here): G06C07ST7J1, G07P1C08ST5J1, G05C02ST6J1, ST6J2. **Not checked whether that run already had the PR #27 rule on disk**; if not, the next sync moves these 4 to Changes asked.
  - In-app notifications were created for developers/reviewers (the sync sends no email).
- 245 tests + typecheck passed before PR #26/#27; not re-run after them.
- RELAY side: `RELAY/.claude/launch.json` has `dashboard-app` (runs this repo's `start.command`), because a session opened in RELAY reads its launch config there.

## In progress
Nothing mid-edit. Code is not broken. Local DB and dev server are stopped. Local DB = Render data from before the 24 moves, sheet sync off.

## Next steps
1. `npm test` + `npm run typecheck` on `start-here` (covers PR #26/#27).
2. Read-only dry run against Render (wrapper in LEARNINGS): see whether the 4 `corrections_wip` journeys are still mismatches or now move to Changes asked; tell Jeevan before applying.
3. Tell the team (Jeevan's go needed; nothing sent yet): 24 journeys moved on Render — 14 to the developers' design queue, 9 to reviewers, 1 to correction verification.
4. Check which commit the live Render site runs and that the RELAY card / mismatch notes show there.
5. Render: confirm `RELAY_KEY` is set and equals the one `RELAY/bin/dash-push` reads (401 = differs). `dash-push` has not been run against the live site.
6. Ask the relay admin whether the dashboard's token may call `publish_status` (then Ask for changes → `corrections_wip` and Review closed → `ready_for_student` can be written instead of reminded).
7. Promote development → staging → main; ticket attachments; more screen redesigns.

## Blockers / open questions
- Render DB password was exposed in an earlier session: rotate it.
- 5 Team Devjyoti journeys still have Arjun as SME reviewer; peer reviewer meaning; QA fix routing.
- Two sessions worked on this checkout at once on 23 Nov (this one and the one behind PR #26/#27); check `git log` before assuming the state above is complete.

## Key files
- `src/lib/relay-review.ts`, `src/lib/relay-map.ts`, `src/server/services/relay-sync.ts`, `src/server/services/relay.ts`
- `src/server/services/work-items.ts` (`notifyStage`, `relayNotReady`), `src/modules/journey-applet/definition.ts`
- `src/components/items-table.tsx`, `src/modules/types.ts` (`table.order`)
- `src/app/api/relay/**`, `src/app/(app)/admin/sync/page.tsx`, `src/app/(app)/w/[workType]/[itemId]/page.tsx`
- `tests/relay-review.test.ts`; `.ai/DECISIONS.md` (17 Nov, 23 Nov entries); `.ai/LEARNINGS.md` (remote sync wrapper)
- RELAY: `bin/dash-push`, `CLAUDE.md`, `memory/classroots-work-dashboard.md`, `.claude/launch.json`
