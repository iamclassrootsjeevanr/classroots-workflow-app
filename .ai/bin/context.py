#!/usr/bin/env python3
"""Print everything an agent needs to resume, in one call.
Claude Code runs this automatically (SessionStart hook). Codex/Cursor run it as step 1.
Usage: python3 .ai/bin/context.py [--fetch]
  --fetch   also `git fetch` and pull fast-forward if the branch is behind (safe; never merges).
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def git(*args, timeout=10):
    try:
        r = subprocess.run(["git", "-C", str(ROOT), *args], capture_output=True, text=True, timeout=timeout)
        return (r.stdout or r.stderr).strip(), r.returncode
    except (OSError, subprocess.TimeoutExpired) as e:
        return f"(git unavailable: {e})", 1


def section(title, body):
    print(f"\n===== {title} =====")
    print(body.strip() or "(empty)")


def read(rel):
    p = ROOT / rel
    return p.read_text(encoding="utf-8") if p.exists() else f"({rel} missing)"


def main():
    print("RESUME CONTEXT — follow the Session protocol in AGENTS.md. Continue from STATE 'Next steps'.")
    if "--fetch" in sys.argv:
        out, rc = git("fetch", "--quiet", timeout=8)
        if rc == 0:
            behind, _ = git("rev-list", "--count", "HEAD..@{u}")
            if behind.isdigit() and int(behind) > 0:
                out, rc = git("pull", "--ff-only", "--quiet", timeout=15)
                print(f"(pulled {behind} new commit(s) from remote)" if rc == 0 else f"(behind remote by {behind}; ff pull failed: {out})")
        else:
            print(f"(fetch skipped: {out.splitlines()[0] if out else 'no remote'})")
    section(".ai/STATE.md", read(".ai/STATE.md"))
    section(".ai/LEARNINGS.md", read(".ai/LEARNINGS.md"))
    section("git status", git("status", "-sb")[0])
    section("last 5 commits", git("log", "-5", "--pretty=format:%h %ad %s", "--date=short")[0])


if __name__ == "__main__":
    main()
