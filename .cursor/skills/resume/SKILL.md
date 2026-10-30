---
name: resume
description: Pick up work started in another tool or session (Claude Code, Codex, Cursor, desktop or web). Use when the user says resume, continue, pick up, where were we, carry on, or opens a session with no specific task. Also "resume <branch>".
---

# Resume

Python command: `python3` on macOS/Linux, `py -3` on Windows.

1. **Branch named?** If the user wrote a branch (e.g. `resume alice/dilation`) and it isn't the current one: run `git fetch`, then `git checkout <branch>`. If uncommitted changes block the checkout, stop and tell the user — never discard them. (Web sessions often start on their own branch; this puts them on the user's.)
2. Run `python3 .ai/bin/context.py --pull`. It fast-forwards this branch and prints its state file, LEARNINGS, git status and recent commits.
3. If the branch is protected (e.g. `main`) and no branch was named, list recent branches with `git branch -a --sort=-committerdate` and ask which to continue. Keep any uncommitted changes.
4. If the state file says "none yet", say so and ask what to work on.
5. If `AGENTS.md` → Project still has TODOs, fill them in from the repo (stack, commands, layout) as part of this session.
6. Uncommitted changes you didn't make are the previous session's WIP. Keep them.
7. Reply in at most 4 lines: goal, where it stopped, the next step you're starting now. Then start it — don't wait for confirmation unless the state lists a blocker that needs the user.
