---
name: handoff
description: Save session state and push so work can continue in any tool (Claude Code, Codex, Cursor, desktop or web). Use when the user says handoff, stop, pause, switch, checkpoint, save progress, wrap up, or when a long task finishes.
---

# Handoff

Goal: a different agent, in a different tool, with zero chat history, can continue from the repo alone — without touching collaborators' work.

0. **Branch check.** Run `git rev-parse --abbrev-ref HEAD`. If it is listed in `.ai/config.json` `protected_branches` (e.g. `main`), create a personal branch first: `git checkout -b <name>/<short-topic>` (ask the user for their name once if unknown; uncommitted work moves with you). Tell the user the new branch name.
1. **Write this branch's state file** `.ai/state/<branch>.md` (replace `/` in the branch name with `__`; copy `.ai/state/_template.md` if it doesn't exist). Overwrite it completely, under 80 lines:
   - Header: branch name. `Updated:` UTC ISO time · `by:` your tool · `owner:` the user's name.
   - **Goal** — what this branch is building.
   - **Done this stretch** — what changed this session (files, features), terse.
   - **In progress** — exact file/function and what's half-done. Say if code is currently broken.
   - **Next steps** — ordered, concrete, each startable without asking the user.
   - **Blockers / open questions** — anything needing the user's or a collaborator's decision.
   - **Key files** — paths the next agent should open first.
   Never edit another branch's state file.
2. **Record lasting knowledge** not yet written: decisions → append `.ai/DECISIONS.md`; gotchas → `.ai/LEARNINGS.md`. These are shared with the team — keep entries factual and short.
3. **Checkpoint**: run
   `python3 .ai/bin/checkpoint.py <tool> "<one-line summary>"`  (Windows: `py -3` instead of `python3`)
   with tool = `claude-code`, `claude-code-web`, `codex`, `codex-cloud`, `cursor`, or `other`. It refuses protected branches, logs, commits all changes (including WIP), blocks likely secrets, and pushes the branch.
   - Aborted on secrets: remove them or `.gitignore` them, re-run. Never bypass.
   - Push failed: report the error. Never force-push.
4. **Reply to the user** in 2 lines max: what was saved, and the branch to open in the next tool.
