# STATE — branch: start-here
<!-- Overwritten on every handoff. Under 80 lines. Describes NOW. -->

Updated: 2026-11-06T07:51:12Z · by: claude-code · owner: Jeevan

## Goal
Journey now has teams and two-level ownership (built 6 Nov, commit 43df088). Get it reviewed in the browser per role, merged to `development`, then deploy to Railway.

## Done this stretch
- `docs/JOURNEY-WORKFLOW.md` (guide for new team members), linked from README.
- Local DB: merged the duplicate Krishna account into krishna@classrootsedu.com; fixed that email in `scripts/import-journey-csv.ts`.
- Teams (`teams: true` on Journey): `Team` / `TeamMember` tables, `WorkItem.peerReviewerId`, migration `20261106090000_teams_peer_reviewer` (also drops `buildUrl` from journeys).
- Journey owner = coordinator of the creator's team (derived, shown as "Owner"); that coordinator has steward rights on it in any chapter and is the default SME reviewer; the buddy is the peer reviewer. Defaults applied on create / assign and when a team setting changes (`nextDefault`: only empty slots or ones still on the old default).
- New Teams tab (`/w/journey-applet/teams`); Chapters tab shows stewards, All / My chapters, add chapter, remove empty chapter; Journeys list has Peer reviewer and Owner columns, Team filter, Show → My team; journey page shows Peer reviewer (editable by coordinator) and Owner.
- Field rights: Picked up / Picked up in = coordinator only; Submitted / Submitted in = stamp only (admin can correct); Applet build removed.
- Local data: `npm run journey:teams -- --apply` ran. Team Arjun (Kapil ↔ Animesh, Preethi ↔ Supriya), Team Devjyoti (Vaishali ↔ Divyanshu, Krishna ↔ Manasa). 26 of 35 journeys got reviewer + peer reviewer.
- `npm run typecheck` clean, `npm test` 187 passing (22 files). Pushed.

## In progress
Nothing mid-edit. Code is not broken.

## Next steps
1. Browser check per role at 375px and desktop, light and dark: Teams, Chapters (All / My), Journeys list, a journey page. No agent has seen these pages signed in; Jeevan looked at them in his own browser as admin only. Coordinator (Arjun) and SME creator (Kapil) views are covered by unit tests only.
2. Open a PR `start-here` → `development` (Create a merge commit): two commits ahead (1b16882 guide, 43df088 teams).
3. Railway: provision production, staging, development per `docs/DEPLOY.md` steps 1–2; copy the local DB (it carries the teams); Google OAuth and email with the Workspace admin; set a distinct production `RELAY_KEY` and share it with the relay team.
4. If Arjun answers the QA-fix question (below), update `definition.ts` and the "User testing and QA" part of `docs/JOURNEY-WORKFLOW.md`.

## Blockers / open questions
- Jeevan: 5 journeys by Team Devjyoti creators (G04C05ST2J1, ST4J1, ST5J1, G05C02ST4J1, ST4J2) still have Arjun as SME reviewer from the tracker. Move them to Devjyoti or keep?
- Jeevan / Arjun: what does the peer reviewer do? Today it is a person on the journey (shown, in "Mine", changeable), not a stage.
- Chapter delete only works for an empty chapter, and never a coordinator's last one. Journeys page does not default to the coordinator's team (Team filter / My team instead). Say if either should change.
- G06C07 has no steward (Vinay has no Journey role locally). Aswin and Vinay are in no team, so their 7 journeys get no default reviewer.
- Arjun: should a QA fix return to User testing and QA instead of re-running the after-steps?
- Railway account, Google Workspace admin and mailbox app-password are needed for deployment. Design standardization stays paused until Hitheshwar's document.
- Agents cannot sign in locally (auto mode blocks reading `DEMO_PASSWORD` and setting passwords): Jeevan signs in in the Browser pane.

## Key files
- `src/lib/teams.ts`, `src/server/teams.ts`, `src/server/services/teams.ts`, `tests/teams.test.ts`
- `src/server/services/work-items.ts` (`setPersonTx`, `applyReviewDefaultsTx`, `refillReviewDefaults`)
- `src/lib/access-core.ts` (`capabilitiesIn`, `teamUserIds`), `src/server/access.ts`
- `src/modules/journey-applet/definition.ts`, `tests/journey-roles.test.ts`
- `src/app/(app)/w/[workType]/(tabs)/teams/page.tsx`, `.../versions/page.tsx`, `src/components/teams-panel.tsx`, `src/components/chapters-panel.tsx`
- `scripts/journey-teams.ts`, `docs/JOURNEY-WORKFLOW.md`, `docs/DEPLOY.md`, `.ai/DECISIONS.md` (2026-11-06 entry)
