#!/usr/bin/env python3
"""Log, commit everything, and push — so any other tool (incl. web/cloud) can pick up.
Usage: python3 .ai/bin/checkpoint.py <tool> "<one-line summary>"
  tool: claude-code | claude-code-web | codex | codex-cloud | cursor | other
Aborts if staged changes look like they contain secrets.
"""
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SECRET_PATTERNS = [
    r"sk-[A-Za-z0-9_\-]{20,}",            # OpenAI / Anthropic style keys
    r"sk-ant-[A-Za-z0-9_\-]{20,}",
    r"gh[pousr]_[A-Za-z0-9]{30,}",         # GitHub tokens
    r"AKIA[0-9A-Z]{16}",                   # AWS access key
    r"AIza[0-9A-Za-z_\-]{35}",             # Google API key
    r"xox[abpr]-[A-Za-z0-9\-]{10,}",       # Slack
    r"-----BEGIN [A-Z ]*PRIVATE KEY-----",
]
SECRET_FILES = re.compile(r"(^|/)(\.env(\..+)?|.*\.pem|id_rsa|id_ed25519)$")


def git(*args, check=True):
    r = subprocess.run(["git", "-C", str(ROOT), *args], capture_output=True, text=True)
    if check and r.returncode != 0:
        sys.exit(f"checkpoint: git {' '.join(args)} failed:\n{r.stderr.strip()}")
    return (r.stdout if r.returncode == 0 else r.stderr).strip(), r.returncode


def main():
    if len(sys.argv) < 3:
        sys.exit('usage: checkpoint.py <tool> "<summary>"')
    tool, summary = sys.argv[1], " ".join(sys.argv[2:]).replace("\n", " ").strip()
    branch, _ = git("rev-parse", "--abbrev-ref", "HEAD")
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ")

    try:
        prot = json.loads((ROOT / ".ai" / "config.json").read_text(encoding="utf-8")).get("protected_branches", [])
    except (OSError, ValueError):
        prot = ["main", "master"]
    if branch in prot or branch == "HEAD":
        sys.exit(f"checkpoint: REFUSED — '{branch}' is a shared/protected branch. Nothing was committed.\n"
                 "Create your own branch (your uncommitted work comes with you), then re-run:\n"
                 "  git checkout -b <your-name>/<topic>")

    state = ROOT / ".ai" / "state" / (branch.replace("/", "__") + ".md")
    if not state.exists():
        print(f"checkpoint: warning — {state.relative_to(ROOT).as_posix()} not found; next session starts without state.")

    with open(ROOT / ".ai" / "LOG.md", "a", encoding="utf-8") as f:
        f.write(f"- {ts} | {tool} | {branch} | {summary}\n")

    git("add", "-A")
    staged, _ = git("diff", "--cached", "--name-only")
    if not staged:
        print("checkpoint: nothing to commit.")
        return

    bad_files = [f for f in staged.splitlines() if SECRET_FILES.search(f) and not f.endswith(".example")]
    diff, _ = git("diff", "--cached", "-U0")
    added = "\n".join(l for l in diff.splitlines() if l.startswith("+") and not l.startswith("+++"))
    hits = [p for p in SECRET_PATTERNS if re.search(p, added)]
    if bad_files or hits:
        git("reset", "-q")
        sys.exit("checkpoint: ABORTED — possible secrets staged.\n"
                 f"  files: {bad_files or '-'}\n  patterns: {hits or '-'}\n"
                 "Remove them or add to .gitignore, then re-run.")

    git("commit", "-q", "-m", f"checkpoint({tool}): {summary}")
    sha, _ = git("rev-parse", "--short", "HEAD")

    remotes, _ = git("remote", check=False)
    if not remotes:
        print(f"checkpoint: committed {sha} on {branch}. No remote — local only (web/cloud tools won't see it).")
        return
    _, has_upstream = git("rev-parse", "--abbrev-ref", "@{u}", check=False)
    remote = "origin" if "origin" in remotes.split() else remotes.split()[0]
    args = ["push", "-q"] if has_upstream == 0 else ["push", "-q", "-u", remote, branch]
    out, rc = git(*args, check=False)
    if rc != 0:
        print(f"checkpoint: committed {sha} on {branch}, but PUSH FAILED. Fix and run `git push`.\n{out}")
        sys.exit(1)
    print(f"checkpoint: committed {sha} and pushed {branch}. Resume anywhere on branch '{branch}'.")


if __name__ == "__main__":
    main()
