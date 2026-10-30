---
name: resume
description: Pick up work started in another tool or session (Claude Code, Codex, Cursor, desktop or web). Use when the user says resume, continue, pick up, where were we, carry on, or opens a session with no specific task.
---

# Resume

1. Run `python3 .ai/bin/context.py --fetch` (use `python` if `python3` is missing). It pulls new commits fast-forward and prints STATE, LEARNINGS, git status and recent commits.
2. If STATE's `branch:` differs from the current branch, tell the user and ask before switching — uncommitted work may exist here.
3. Uncommitted changes you didn't make are the previous session's WIP. Keep them.
4. Reply in at most 4 lines: goal, where it stopped, the next step you're starting now. Then start it — don't wait for confirmation unless STATE lists a blocker that needs the user.
