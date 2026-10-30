---
name: handoff
description: Save session state and push so work can continue in any tool (Claude Code, Codex, Cursor, desktop or web). Use when the user says handoff, stop, pause, switch, checkpoint, save progress, wrap up, or when a long task finishes.
---

# Handoff

Goal: a different agent, in a different tool, with zero chat history, can continue from the repo alone.

1. **Rewrite `.ai/STATE.md`** completely (keep its headings, under 80 lines):
   - `Updated:` UTC ISO time · `by:` your tool name · `branch:` current branch.
   - **Goal** — what we're building right now.
   - **Done this stretch** — what changed this session (files, features), terse.
   - **In progress** — exact file/function/line and what's half-done. Say if code is currently broken.
   - **Next steps** — ordered, concrete, each startable without asking the user.
   - **Blockers / open questions** — anything needing the user's decision.
   - **Key files** — paths the next agent should open first.
2. **Record lasting knowledge** not yet written: decisions → append `.ai/DECISIONS.md`; gotchas → merge into `.ai/LEARNINGS.md`. If `AGENTS.md` Project section has TODOs you can now fill, fill them.
3. **Checkpoint**: run
   `python3 .ai/bin/checkpoint.py <tool> "<one-line summary>"`
   with tool = `claude-code`, `claude-code-web`, `codex`, `codex-cloud`, `cursor`, or `other`. It logs, commits all changes (including WIP code), blocks likely secrets, and pushes.
   - If it aborts on secrets: remove them or `.gitignore` them, re-run. Never bypass.
   - If push fails: report the error; do not force-push.
4. **Reply to the user** in 2 lines max: what was saved, and the branch to open in the next tool.
