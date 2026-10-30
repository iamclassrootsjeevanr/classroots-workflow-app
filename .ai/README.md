# .ai/ — shared AI memory for this repo

This folder lets Claude Code, Codex and Cursor (desktop and web) pick up work where another tool — or another teammate — left off. It is managed by **ai-continuity-kit**. You don't need to install anything to use it.

## For you, as a collaborator

1. Work on your own branch — one person per branch: `git checkout -b <your-name>/<topic>`
2. In any AI tool, type **`resume`** to continue where your branch left off.
3. Before switching tools or stopping, type **`handoff`**. The agent saves state, commits and pushes your branch.
4. Merge through a pull request (Squash and merge keeps history clean).

`handoff` refuses to commit to shared branches listed in `config.json` (`main`, `master`, …).
Requires Python 3.8+ (`python3` on macOS/Linux, `py -3` on Windows). Without it, everything else still works — you just can't use `resume`/`handoff`.

## Files

| File | Owner | Purpose |
|---|---|---|
| `state/<branch>.md` | that branch's author | Where this branch's work stands right now. Overwritten each handoff. Don't edit other people's. |
| `state/_template.md` | kit | Starting point for a new branch's state file. |
| `LEARNINGS.md` | team | Gotchas and "how it actually works here". Curate it. |
| `DECISIONS.md` | team | Lasting decisions and why. Append-only. |
| `log/<branch>.md` | that branch's author | One line per handoff on that branch. Append-only. |
| `mcp.json` | team | MCP servers for all tools. Edit, then run `python3 .ai/bin/sync.py`. |
| `config.json` | team | Protected branches. |
| `bin/` | kit | `context.py` (resume), `checkpoint.py` (handoff), `sync.py` (skills + MCP fan-out). |
| `.kit-version` | kit | Which kit version is installed. |

Files marked **kit** are overwritten when someone runs `aikit .` to upgrade. Don't customise them; put project rules in `/AGENTS.md`.
