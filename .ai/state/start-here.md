# STATE — branch: start-here
<!-- Overwritten on every handoff. Under 80 lines. Describes NOW. -->

Updated: 2026-11-16T10:58:44Z · by: claude-code · owner: Jeevan

## Goal
Run the Journey workflow on the deployed `development` site (Render) from RELAY data: stewards, creators, teams, developers.

## Done this stretch
- **PR #20 merged** (acb5082): relay sync sets chapter stewards from relay chapter rows (`parseChapterStewards`, `planStewards` in `src/lib/relay-map.ts`; `syncStewards` in `src/server/services/relay-sync.ts`).
- **PR #21 merged** (936ad5f), all in `development`:
  - Admins named by the relay (Vinay G06C07, Aswin G08P2C01) get the Steward role in Journey and those chapters; an admin never displaces a non-admin steward (`keptCurrent`).
  - Steward role gets `work` (stewards build their own journeys); own journeys count like team ones in `capabilitiesIn` (self added to `teamUserIds`). Migration `20261116120000_steward_can_work`.
  - Chapters tab: **Change steward** (`moveChapter` in `services/teams.ts`, `moveChapterAction`, `ChangeStewardButton`); admins can be picked, also on Add chapter.
  - Relay sync follows reassignments: `relayHolderWins(relay at, last APP assignment)`; new holder notified. Report `reassigned`, `creatorDiffers` = changed here later (kept).
  - Relay teams: `planTeams` moves a creator to the team all their relay journeys share; split people reported (`teamIssues`).
  - Developer role = own data; own data includes `developerId` (`isOwnItem`, `scopeWhere`). Migration `20261116130000_developer_own_data`.
- Local DB: relay sync applied (5 journeys moved, Animesh → Team Devjyoti); re-run dry run is clean. 230 tests pass.
- `docs/USER-MANUAL.md` (WIP, committed by this handoff): Steward section updated with relay chapters, Change steward and reassignment rules. Still has `[add the live URL here]`.

## In progress
Nothing mid-edit. Code is not broken. Render redeploy of 936ad5f not yet confirmed.

## Next steps
1. Render: confirm the deploy of `936ad5f` is Live (migrations run on start).
2. Live site: Admin → Sheet sync → Journey relay → Dry run. Expect stewards G06C07 → Vinay, G08P2C01 → Aswin; moved G05C02ST5J1/J2 → Animesh, G06C07ST1J1 → Vaishali, G06C07ST1J2/J3 → Kapil; Animesh → Team Devjyoti; Krishna, Vaishali, Supriya in both teams (left). Then Sync RELAY now.
3. Spot-check signed in: Chapters tab stewards + Change steward; View as Jeevan R / Swathi (developers) shows only their journeys; a steward can Start/Submit their own journey (375px + desktop, light + dark).
4. Admin → People: Krishna's email → krishna.rander@classrootsedu.com.
5. Put https://classroots-workflow-app.onrender.com in `docs/USER-MANUAL.md`.
6. Fix README wording that says the relay syncs every 5–10 minutes (needs a cron).
7. Optional: Render cron calling `/api/cron/run` with `CRON_SECRET` (Jeevan chose manual sync for now).
8. Later: promote development → staging → main; ticket attachments; more screen redesigns.

## Blockers / open questions
- Render DB password was exposed in an earlier session: Jeevan should rotate it.
- Krishna, Vaishali, Supriya work in both relay teams: dashboard keeps one team each (choose in Teams tab if needed).
- Journey: 5 Team Devjyoti journeys still have Arjun as SME reviewer; peer reviewer meaning; QA fix routing.

## Key files
- `src/lib/relay-map.ts`, `src/server/services/relay-sync.ts`, `src/server/services/teams.ts`
- `src/lib/access-core.ts`, `src/server/access.ts`, `src/modules/journey-applet/definition.ts`
- `src/components/chapters-panel.tsx`, `src/app/(app)/w/[workType]/(tabs)/versions/page.tsx`, `src/app/(app)/admin/sync/page.tsx`
- `docs/USER-MANUAL.md`
