#!/usr/bin/env python3
"""Print everything an agent needs to resume this branch, in one call.

Usage: python3 .ai/bin/context.py [--fetch | --pull]
  (none)    local only
  --fetch   fetch and report if the branch is behind the remote (never changes files)
  --pull    fetch and fast-forward the branch if behind (never merges)
Claude Code runs it with --fetch at session start. Agents run it with --pull on resume.
"""
import json
import subprocess
import sys
from pathlib import Path


for _s in (sys.stdout, sys.stderr):  # Windows consoles: never crash on non-ASCII
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

ROOT = Path(__file__).resolve().parents[2]


def git(*args, timeout=10):
    try:
        r = subprocess.run(["git", "-C", str(ROOT), *args], capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout)
        return (r.stdout if r.returncode == 0 else r.stderr).strip(), r.returncode
    except (OSError, subprocess.TimeoutExpired) as e:
        return f"(git unavailable: {e})", 1


def protected():
    try:
        return json.loads((ROOT / ".ai" / "config.json").read_text(encoding="utf-8")).get("protected_branches", [])
    except (OSError, ValueError):
        return ["main", "master"]


def state_path(branch):
    return ROOT / ".ai" / "state" / (branch.replace("/", "__") + ".md")


def section(title, body):
    print(f"\n===== {title} =====")
    print(body.strip() or "(empty)")


def read(p):
    return p.read_text(encoding="utf-8") if p.exists() else None


def main():
    branch, rc = git("symbolic-ref", "--short", "-q", "HEAD")
    branch = branch if rc == 0 and branch else "HEAD (detached)"
    print("RESUME CONTEXT — follow the Session protocol in AGENTS.md. Continue from 'Next steps'.")
    print(f"Branch: {branch}")

    if "--fetch" in sys.argv or "--pull" in sys.argv:
        out, rc = git("fetch", "--quiet", timeout=8)
        if rc == 0:
            behind, _ = git("rev-list", "--count", "HEAD..@{u}")
            if behind.isdigit() and int(behind) > 0:
                if "--pull" in sys.argv:
                    out, rc = git("pull", "--ff-only", "--quiet", timeout=15)
                    print(f"Pulled {behind} new commit(s)." if rc == 0
                          else f"Behind remote by {behind}; fast-forward failed — tell the user: {out}")
                else:
                    print(f"Behind remote by {behind} commit(s). Run: python3 .ai/bin/context.py --pull")
        elif out:
            print(f"(fetch skipped: {out.splitlines()[0]})")

    if branch in protected():
        print(f"\n!! '{branch}' is a protected shared branch. Before changing anything, create your own branch:"
              f"\n   git checkout -b <your-name>/<topic>")

    sp = state_path(branch)
    rel = sp.relative_to(ROOT).as_posix()
    body = read(sp)
    if body is None:
        legacy = read(ROOT / ".ai" / "STATE.md")
        body = legacy or "(none yet — this branch has no saved state. On handoff, create it from .ai/state/_template.md)"
    section(f"STATE FILE {rel}", body)
    section(".ai/LEARNINGS.md", read(ROOT / ".ai" / "LEARNINGS.md") or "(missing)")
    section("git status", git("status", "-sb")[0])
    section("last 5 commits", git("log", "-5", "--pretty=format:%h %ad %an: %s", "--date=short")[0])


if __name__ == "__main__":
    main()
