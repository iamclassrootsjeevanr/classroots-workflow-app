---
name: handoff
description: Save session state and push so work can continue in any tool (Claude Code, Codex, Cursor, desktop or web). Use when the user says handoff, stop, pause, switch, checkpoint, save progress, wrap up, or when a long task finishes.
---

# Handoff

Goal: a different agent, in a different tool, with zero chat history, can continue from the repo alone — without touching collaborators' work.

This repo has **one working branch: `start-here`**. Every handoff saves the latest state there, so every new session starts from it.
Permanent branches: `development` (default), `staging`, `main` (production). Any other branch is temporary and is deleted once merged.

0. **Be on `start-here`.** Run `git rev-parse --abbrev-ref HEAD`.
   - On `start-here`: good.
   - On another branch: commit nothing yet. `git fetch`, then `git checkout start-here` (uncommitted work moves with you; if the checkout is blocked, stop and tell the user). If `start-here` does not exist: `git checkout -b start-here origin/development`.
   - Then bring it up to date: `git merge --no-edit origin/development` (no-op when nothing new). Never force-push, never reset.
1. **Write the state file** `.ai/state/start-here.md` (copy `.ai/state/_template.md` if it doesn't exist). Overwrite it completely, under 80 lines:
   - Header: `branch: start-here`. `Updated:` UTC ISO time · `by:` your tool · `owner:` the user's name.
   - **Goal** — what is being built now.
   - **Done this stretch** — what changed this session (files, features), terse.
   - **In progress** — exact file/function and what's half-done. Say if code is currently broken.
   - **Next steps** — ordered, concrete, each startable without asking the user.
   - **Blockers / open questions** — anything needing the user's or a collaborator's decision.
   - **Key files** — paths the next agent should open first.
2. **Record lasting knowledge** not yet written: decisions → append `.ai/DECISIONS.md`; gotchas → `.ai/LEARNINGS.md`. These are shared with the team — keep entries factual and short.
3. **Checkpoint**: run
   `python3 .ai/bin/checkpoint.py <tool> "<one-line summary>"`  (Windows: `py -3` instead of `python3`)
   with tool = `claude-code`, `claude-code-web`, `codex`, `codex-cloud`, `cursor`, or `other`. It refuses protected branches, logs, commits all changes (including WIP), blocks likely secrets, and pushes the branch.
   - Aborted on secrets: remove them or `.gitignore` them, re-run. Never bypass.
   - Push failed: report the error. Never force-push.
4. **Remove unwanted branches.** `git fetch --prune`, then for every local and remote branch except `development`, `staging`, `main` and `start-here`:
   - delete it (`git push origin --delete <b>` and `git branch -D <b>`) only if its work is already in `development`: its pull request is merged (`gh pr list --state merged --head <b>`) **or** `git diff --quiet origin/development origin/<b> -- . ':(exclude).ai'` succeeds;
   - otherwise keep it and tell the user it still has unmerged work. Delete its `.ai/state/<branch>.md` together with the branch (logs in `.ai/log/` stay as history).
5. **Reply to the user** in 2 lines max: what was saved (on `start-here`), and which branches were removed.

Merging `start-here` into `development`: pull request with **Create a merge commit** (not squash), so `start-here` stays in step with `development` and never needs a force-push.
