# AGENTS.md

Single source of truth for every coding agent on this repo (Claude Code, Codex, Cursor — desktop and web).
`CLAUDE.md` imports this file. Do not duplicate instructions elsewhere.

<!-- ai-continuity:start -->
## Session protocol (mandatory, every tool, every session)

The repo is the shared memory. Anything not written to `.ai/` and pushed is lost when the user switches tools.
This is a shared repo: each branch has its own state and log file, so collaborators never overwrite each other. One person per branch.
**Python command:** examples use `python3` (macOS/Linux). On Windows use `py -3` (or `python`).

**On start**
1. Run `python3 .ai/bin/context.py --pull`. One call fast-forwards the branch, then prints this branch's state file, LEARNINGS, git status and recent commits. Claude Code gets a read-only version injected at session start; if it reports "behind remote", run the command above.
2. Uncommitted changes you did not make are the previous session's work in progress — never discard or overwrite them.
3. State in one line what you are resuming, then continue from "Next steps". Do not ask the user to re-explain anything that is in `.ai/`.

**During work**
- Decision with lasting effect (library, architecture, data shape, naming) → append to `.ai/DECISIONS.md` (shared by the team).
- Gotcha, workaround, or "how it actually works here" → add to `.ai/LEARNINGS.md` (shared). Curate: edit existing lines instead of piling up duplicates.
- `.ai/log/<branch>.md` is this branch's append-only handoff history (written by `checkpoint.py`). Read it only when you need history.

**On handoff** — user says stop, pause, handoff, switch, checkpoint, wrap up, or a long task finishes:
run the `handoff` skill (or follow `.agents/skills/handoff/SKILL.md` directly).

**Rules**
- Never write secrets, tokens, or credentials into `.ai/` or any committed file.
- The branch state file (`.ai/state/<branch>.md`, path printed by `context.py`) is overwritten each handoff, stays under 80 lines, and describes *now*, not history. Never edit another branch's state file.
- Checkpoints never go to protected branches (`.ai/config.json`). Work on your own branch and merge through a pull request.
- Web/cloud sessions (Claude Code web, Codex cloud) only see what is pushed. Always push on handoff.
- MCP servers are defined once in `.ai/mcp.json`. After editing it, run `python3 .ai/bin/sync.py`. Never hand-edit `.mcp.json`, `.cursor/mcp.json`, or `.codex/config.toml`.
<!-- ai-continuity:end -->

## Project

**What this is:** Classroots Work — work tracking, review and analytics for Classroots teams. Items (Journey Applets, APK tests) move through per-work-type workflows; every step is timestamped and turned into dashboards. Optional two-way Google Sheet sync. Full docs in `README.md`.

**Stack:** Next.js 15 App Router + React 19, TypeScript, Tailwind CSS v4 (CSS-first tokens), Prisma 6 on PostgreSQL (embedded local DB via `npm run db:start`), Auth.js v5 (Google, password, magic link), Recharts, lucide-react, Vitest.

**Commands**
- Install: `npm install`, copy `.env.example` → `.env`
- Dev: `npm run db:start` (terminal 1) · `npm run db:deploy && npm run db:seed` once · `npm run dev` (terminal 2) → http://localhost:3000
- Test: `npm test` (Vitest, `tests/`)
- Lint/format: `npm run typecheck` (`tsc --noEmit`); Prettier config in repo
- Build: `npm run build` (runs `prisma generate` first; stop the dev server before building)
- Demo sign-ins: `npm run demo:users` (password is `DEMO_PASSWORD` in `.env`, never commit it)

**Layout:** `src/modules/` work-type definitions (statuses, transitions, fields, sheet mapping) · `src/lib/` pure logic, unit-tested, no DB · `src/server/` DB, auth, services, sync (`services/work-items.ts` is the only write path for items) · `src/app/` routes, `actions.ts` server actions · `src/components/` UI (`ui.tsx`, `form.tsx` primitives) · `prisma/` schema and hand-written SQL migrations · `scripts/` imports and local DB · `tests/` Vitest.

**Conventions:**
- Colours only via tokens from `src/app/globals.css` (`bg-surface`, `text-muted`, `bg-ok-soft`, `.status-chip` with `--status`). No raw Tailwind palette classes (`bg-white`, `text-emerald-700`) in `src/`.
- Classes that get `@apply`'d must be `@utility`, not `@layer components` (Tailwind v4 build fails otherwise).
- Business rules in `src/lib/` with a test; DB access in `src/server/`; never write items outside `services/work-items.ts`.
- Schema change → new folder in `prisma/migrations/` + `npm run db:deploy`; commit the migration.
- Form controls use `src/components/form.tsx` (Checkbox/Radio/Switch rows, Segmented); nav icons via `src/components/icons.tsx` string keys.
- Verify UI in a browser at phone (375px) and desktop widths, light and dark, before calling it done.

**Done means:** code runs, `npm run typecheck && npm test` pass, `.ai/state/<branch>.md` updated via `handoff`, pushed.
