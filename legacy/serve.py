#!/usr/bin/env python3
"""
JC Tracker server.

Reads APPS_SCRIPT_URL from .env (never sent to the browser) and
proxies live sheet rows at /api/live.

    python3 serve.py
    http://127.0.0.1:8765/
"""
import json
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, quote, urlparse
from urllib.request import Request, urlopen

ROOT = os.path.dirname(os.path.abspath(__file__))


def load_env(path):
    env = {}
    if not os.path.exists(path):
        return env
    with open(path, encoding="utf-8") as fh:
        for raw in fh:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            env[key.strip()] = val.strip().strip('"').strip("'")
    return env


ENV = load_env(os.path.join(ROOT, ".env"))
for key, val in ENV.items():
    os.environ.setdefault(key, val)

APPS_SCRIPT_URL = os.environ.get("APPS_SCRIPT_URL", "").strip()
DEFAULT_TAB = os.environ.get("SHEET_TAB", "Journeys in Chapters")
PORT = int(os.environ.get("PORT", "8765"))


def script_get(params):
    if not APPS_SCRIPT_URL:
        raise RuntimeError("APPS_SCRIPT_URL is not set in .env")
    qs = "&".join("%s=%s" % (quote(str(k)), quote(str(v))) for k, v in params.items() if v is not None)
    sep = "&" if "?" in APPS_SCRIPT_URL else "?"
    url = "%s%s%s" % (APPS_SCRIPT_URL, sep, qs)
    req = Request(url, headers={"User-Agent": "JC-Tracker/1.0", "Accept": "application/json"})
    with urlopen(req, timeout=25) as resp:
        body = resp.read()
    data = json.loads(body.decode("utf-8"))
    if isinstance(data, dict) and data.get("error"):
        raise RuntimeError(data["error"])
    return data


def fetch_live_rows(tab):
    data = script_get({"tab": tab})
    rows = data.get("rows") if isinstance(data, dict) else None
    if isinstance(rows, list):
        data["rows"] = [
            row for row in rows
            if str((row or {}).get("Developers") or "").strip()
        ]
        data["assigned"] = True
    return data


def update_sheet_row(tab, key, field, value):
    data = script_get({
        "action": "update",
        "tab": tab,
        "key": key,
        "field": field,
        "value": value,
    })
    if not isinstance(data, dict) or not data.get("ok"):
        raise RuntimeError(
            "Write not enabled yet. Paste the new apps-script/Code.gs, then "
            "Deploy → Manage deployments → pencil → New version → Deploy."
        )
    return data


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/live":
            self.proxy_live(parsed)
            return
        if parsed.path in ("/.env", "/.env.example", "/code.txt"):
            self.send_error(404)
            return
        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/update":
            self.proxy_update()
            return
        self.send_error(404)

    def proxy_update(self):
        length = int(self.headers.get("Content-Length") or 0)
        try:
            payload = json.loads(self.rfile.read(length) or b"{}")
            data = update_sheet_row(
                payload.get("tab") or DEFAULT_TAB,
                payload.get("key") or "",
                payload.get("field") or "",
                payload.get("value") if payload.get("value") is not None else "",
            )
        except HTTPError as e:
            self.json_error(e.code, str(e))
            return
        except (URLError, RuntimeError, ValueError, json.JSONDecodeError) as e:
            self.json_error(502, str(e))
            return
        raw = json.dumps(data).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(raw)

    def proxy_live(self, parsed):
        q = parse_qs(parsed.query)
        tab = (q.get("tab") or [DEFAULT_TAB])[0]
        try:
            data = fetch_live_rows(tab)
        except HTTPError as e:
            self.json_error(e.code, str(e))
            return
        except (URLError, RuntimeError, ValueError, json.JSONDecodeError) as e:
            self.json_error(502, str(e))
            return
        payload = json.dumps(data).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(payload)

    def json_error(self, status, message):
        payload = json.dumps({"error": message}).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, fmt, *args):
        print("[%s] %s" % (self.log_date_time_string(), fmt % args), flush=True)


if __name__ == "__main__":
    httpd = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print("JC Tracker at http://127.0.0.1:%s/" % PORT, flush=True)
    print("Apps Script URL is loaded from .env and is not shown in the UI.", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")
