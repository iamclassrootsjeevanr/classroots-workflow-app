# STATE — branch: start-here
<!-- Overwritten on every handoff. Under 80 lines. Describes NOW. -->

Updated: 2026-11-25T13:35:00Z · by: claude-code · owner: Jeevan

## Goal
Close the gaps between the relay and the Dashboard, prompt by prompt, from the plan page `../RELAY/scratch/relay-dashboard-workflow.html` (tabs: Relay 1-5, Dashboard 1-11, Fix seat 1). Rule of 24 Nov: one side owns each action, the other side copies it. Each prompt has its own gates ("ask me before you build").

## Done this stretch (25 Nov, afternoon)
- PR 35 (relay chapter names) checked: Render syncs clean (13:00Z ok, no errors). Can't prove it is live: every chapter already has a name, so it has nothing to do. Live Chapters page and picker checked signed in (Demo Admin, desktop dark).
- **Relay audit** (read-only, relay vs Render). Holders, stewards, teams and each journey's chapter all match. Found 4 gaps; Jeevan said "fix all one by one":
  1. Grade 9 (2401747): migration `20261125160000_grade9_part_codes`. `G09C01-08` → `G09P1C01-08`, plus `G09P2C09-C14` with the relay's titles (Part 2 numbered on from 9, as on the relay). Applied locally.
  2. Cut journeys (ccff71c): the sync archives a journey the relay dropped from allocations, only when the relay made it, it was never started, it is at "allocated", and its chapter still has relay rows (note "Cut on the relay"). Restored if allocated again. `src/lib/relay-cut.ts`, `relayArchive` in `services/work-items.ts`. On Render: `G07P1C03ST1J3`, `G07P1C03ST3J4`.
  3. Journey names (875e827): taken from the relay's `journey_state.name` feed rows (`<key>_<slug>`, kept as the slug), read on their own cursor (`cursor.names`). Only a journey named by its key (or still carrying the relay's earlier name) is renamed. `src/lib/relay-names.ts`, `relayRename`. Render dry run: 87 named.
  4. Chapter titles: no change. The dashboard matches the NCERT books; the relay has 3 wrong titles. Note for Aswin: `../RELAY/scratch/relay-chapter-titles-note.md` (not sent).
  - Admin → Sheet sync lists named, cut, restored and not-on-relay journeys.
- Checks: typecheck, 326 tests. Render dry runs: exactly 2 cuts, 87 names, 0 errors. Local real runs: the second run changes nothing; a fixture that allocates a cut journey again restores it. Chrome on the local copy: journeys list (102), Grade 9 picker, Admin → Sheet sync in dark, light and 375px.
- **PR 36 merged** 13:22Z (merge 3292260) and **live**: migration applied on Render 13:24Z (14 Grade 9 chapters). The 13:30Z cron sync archived the 2 cut journeys, named 85 journeys (0 left named by their key), 0 errors, `notOnRelay` empty, names cursor saved. Live journeys list (102) checked in Chrome. Local DB re-pulled from Render (`npm run db:pull`).

## In progress
Nothing mid-edit. `start-here` = `development`.

## Next steps
1. Send the chapter-titles note to Aswin only on Jeevan's word.
2. Count gaps still open (Jeevan fixed 1-3 earlier): My dashboard charts open everyone's items; "Done (30 days)" lists have no date filter; Reports chapter chart ignores From/To and drops User/Search; Overview "Period" does not change the tiles; "Unassigned" and Teams "open" lists would include done; many numbers are not clickable; "In progress" counts corrections on Overview but not in the Journey header.
3. When Jeevan says: resolve relay PR 736's conflicts (merge relay `main` into `workflow-dashboard` in `../journey_studio_mcpiser`, `npm test`, push). Do not merge it. Check: `gh pr view 736 --repo classrootsedu/journey_studio_mcpiser --json state`.
4. When Jeevan says "the relay is live": build Dashboard 1 (count applet fixes from the feed's `data.journeys`) and Dashboard 8 (the reviewer decides here, the relay copies; drop the "set the relay status" reminders; read `data.via`). Prompt text from the plan page. One PR.
5. Relay 2: the note `../RELAY/scratch/relay-2-prod-check-note.md` is written, not sent. Send on Jeevan's word; build Relay 2, then Dashboard 2, after Aswin's yes.
6. Phase 2: Relay 5, Dashboard 10, Dashboard 11 (after 6), Fix seat 1. Dashboard 9 on hold.
7. Promote development → staging → main: Jeevan's call ("Not yet").

## Blockers / open questions
- Relay PR 736 needs its conflicts fixed, then Aswin's review and merge.
- Journey names are kept as relay slugs ("brahmaguptas-formula"), matching the five older ones. If Jeevan wants "Brahmaguptas formula", change it in `relayJourneyNames`.
- Relay 3 item 5 needs the admin told first. The relay's page build can't run on this Mac (no kg-portal access).
- Render DB password was exposed in an earlier session: rotate it.

## Key files
- Audit work: `src/lib/relay-cut.ts`, `src/lib/relay-names.ts`, `src/server/services/relay-sync.ts` (`followCuts`, `nameJourneys`), `src/server/services/work-items.ts` (`relayArchive`, `relayRename`), `prisma/migrations/20261125160000_grade9_part_codes/`
- Plan: `../RELAY/scratch/relay-dashboard-workflow.html`; notes: `../RELAY/scratch/relay-2-prod-check-note.md`, `../RELAY/scratch/relay-chapter-titles-note.md`
- Relay in: `src/lib/relay-review.ts`, `src/lib/relay-map.ts`, `src/lib/relay-chapters.ts`, `src/lib/chapter-codes.ts`; out: `src/lib/relay-push.ts`, contract `src/lib/relay-contract.ts`
- `scripts/relay-sync.ts` (`--dry-run`, `--full`, `--key`, `--fixture`, `--push`); `.ai/DECISIONS.md`; `.ai/LEARNINGS.md`
