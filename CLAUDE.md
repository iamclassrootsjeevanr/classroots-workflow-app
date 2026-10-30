@AGENTS.md

## Claude Code only
- This branch's state file and recent commits are injected at session start (read-only, by the SessionStart hook in `.claude/settings.json`). If it says "Behind remote", run `python3 .ai/bin/context.py --pull` before working.
- `/handoff` and `/resume` are skills in `.claude/skills/` (mirrored from `.agents/skills/` by `python3 .ai/bin/sync.py`).
