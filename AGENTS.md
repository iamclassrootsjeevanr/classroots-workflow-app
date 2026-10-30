# AGENTS.md

Single source of truth for every coding agent on this repo (Claude Code, Codex, Cursor — desktop and web).
`CLAUDE.md` imports this file. Do not duplicate instructions elsewhere.

<!-- ai-continuity:start -->
## Session protocol (mandatory, every tool, every session)

The repo is the shared memory. Anything not written to `.ai/` and pushed is lost when the user switches tools.
This is a shared repo: each branch has its own state file, so collaborators never overwrite each other.

**On start**
1. Run `python3 .ai/bin/context.py --pull` (use `python` if `python3` is missing). One call fast-forwards the branch, then prints this branch's state file, LEARNINGS, git status and recent commits. Claude Code gets a read-only version injected at session start; if it reports "behind remote", run the command above.
2. Uncommitted changes you did not make are the previous session's work in progress — never discard or overwrite them.
3. State in one line what you are resuming, then continue from "Next steps". Do not ask the user to re-explain anything that is in `.ai/`.

**During work**
- Decision with lasting effect (library, architecture, data shape, naming) → append to `.ai/DECISIONS.md` (shared by the team).
- Gotcha, workaround, or "how it actually works here" → add to `.ai/LEARNINGS.md` (shared). Curate: edit existing lines instead of piling up duplicates.
- `.ai/LOG.md` is append-only history. Read it only when you need history.

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

_Any section still marked TODO: inspect the repo and fill it in during your first session. Keep each short._

**What this is:** TODO

**Stack:** TODO

**Commands**
- Install: TODO
- Dev: TODO
- Test: TODO
- Lint/format: TODO
- Build: TODO

**Layout:** TODO (key directories and what lives in each)

**Conventions:** TODO (naming, structure, style rules agents keep getting wrong)

**Done means:** code runs, tests/lint pass, `.ai/STATE.md` updated, pushed.
