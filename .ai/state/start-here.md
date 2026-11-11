# STATE — branch: start-here
<!-- Overwritten on every handoff. Under 80 lines. Describes NOW. -->

Updated: 2026-11-11T11:35:45Z · by: claude-code · owner: Jeevan

## Goal
Test deployment on Render is live and in use. Next: per-role checks on the live app, then decide the long-term host (Render paid vs Railway per `docs/DEPLOY.md`).

## Done this stretch
- APK Testing: one APK version = one work item, test cases are child results (`WorkItem.parentId`, migration `20261111090000_apk_version_items`, `src/lib/apk-rollup.ts`). Committed bc8ad9a.
- Data moving: `REMOTE_DATABASE_URL` in `.env` drives `db:pull` (remote → local, replaces), `db:push` (`-- --replace` to overwrite remote), `db:deploy:remote`, `db:studio:remote` (`scripts/copy-db.ts`, `scripts/prisma-remote.ts`). README "Render" + "Moving data" sections.
- Dockerfile: Prisma CLI installed in its own stage (`/prisma-cli`) so `migrate deploy` runs on start (was "Cannot find module 'effect'").
- PR #15 (teams, APK versions, db scripts) and PR #16 (Docker fix) merged into `development` (5fe9694).
- Render (Jeevan's account, Singapore): Postgres `classroots_works_postgres` + Docker web service deploying from `development`, env DATABASE_URL (internal + connection_limit), AUTH_SECRET, AUTH_URL (onrender.com address), ADMIN_EMAILS, OFFICE_DOMAINS, APP_TIMEZONE. Local data pushed (486 items, 18 users). Sign-in works.
- `npm run typecheck` clean, `npm test` 194 passing.

## In progress
Nothing mid-edit. Code is not broken.

## Next steps
1. On the live Render app, check per role (admin, coordinator Arjun, SME creator Kapil, tester) at 375px and desktop, light and dark: Teams, Chapters, Journeys list, journey page, APK versions + All tests, a version page.
2. Data master: while testing alone the Mac is master (`db:push -- --replace`); once the team enters data on Render, Render is master (`db:pull` only, never push).
3. Before real use: paid Render web service + Postgres (free DB expires ~30 days after 11 Nov), rotate the Render DB credentials (the external URL was pasted in a chat), Google OAuth redirect URI for the onrender address, `EMAIL_SERVER` for invites.
4. Sheet sync is off on Render (copy switches it off). Turn on in Admin → Sheet sync only when Render is the master; add a Render Cron Job calling `/api/cron/run` with `CRON_SECRET`.
5. Release flow later: `development` → `staging` → `main` per README "Branches and environments".

## Blockers / open questions
- Jeevan: Render or Railway long term? README/DEPLOY.md still describe Railway as the target.
- Jeevan: 5 Team Devjyoti journeys (G04C05ST2J1, ST4J1, ST5J1, G05C02ST4J1, ST4J2) still have Arjun as SME reviewer. Move or keep?
- Jeevan / Arjun: peer reviewer's duty (person only, no stage today); should a QA fix return to User testing and QA?
- G06C07 has no steward; Aswin and Vinay are in no team (7 journeys get no default reviewer).
- Agents cannot sign in locally (auto mode blocks reading `DEMO_PASSWORD`); Jeevan signs in.

## Key files
- `Dockerfile`, `scripts/copy-db.ts`, `scripts/prisma-remote.ts`, README "Deploy" section
- `src/lib/apk-rollup.ts`, `src/server/services/apk-versions.ts`, `src/server/services/items-query.ts` (`level`)
- `src/lib/teams.ts`, `src/server/services/work-items.ts`, `src/modules/journey-applet/definition.ts`
- `.ai/DECISIONS.md` (2026-11-06, 2026-11-11), `.ai/LEARNINGS.md`
