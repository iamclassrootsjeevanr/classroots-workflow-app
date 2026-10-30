@AGENTS.md

## Claude Code only
- `.ai/STATE.md` and recent commits are injected at session start by the SessionStart hook in `.claude/settings.json`. Don't re-read them unless they changed mid-session.
- `/handoff` and `/resume` are skills in `.claude/skills/` (mirrored from `.agents/skills/` by `python3 .ai/bin/sync.py`).
