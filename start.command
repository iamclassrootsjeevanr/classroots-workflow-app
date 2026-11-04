#!/bin/bash
# Double-click to run Classroots Work locally: starts the database, then the app, and opens the browser.
# Close this window (or press Ctrl+C) to stop both.
cd "$(dirname "$0")"
URL="http://localhost:3000/"

# Already running (another window, or a terminal): open it instead of starting a second copy.
# Two dev servers share .next and break each other ("no such file … .next/server/…").
if lsof -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Classroots Work is already running – opening $URL"
  [ -z "$NO_OPEN" ] && open "$URL"
  exit 0
fi

npm run db:start &
DB_PID=$!
trap 'kill $DB_PID 2>/dev/null; wait $DB_PID 2>/dev/null' EXIT

until nc -z localhost 5432 2>/dev/null; do sleep 0.5; done
echo "Updating the database and the app's database client…"
npx prisma migrate deploy >/dev/null || { echo "Database update failed – see the message above."; exit 1; }
npx prisma generate >/dev/null || exit 1

# A fresh build folder: a production build or a crashed dev server can leave a broken one behind.
rm -rf .next

[ -z "$NO_OPEN" ] && (until curl -s -o /dev/null http://localhost:3000/signin; do sleep 1; done; open "$URL") &
npm run dev
