#!/bin/bash
# Double-click to run Classroots Work locally: starts the database, then the app, and opens the browser.
# Close this window (or press Ctrl+C) to stop both.
cd "$(dirname "$0")"

npm run db:start &
DB_PID=$!
trap 'kill $DB_PID 2>/dev/null; wait $DB_PID 2>/dev/null' EXIT

until nc -z localhost 5432 2>/dev/null; do sleep 0.5; done
npx prisma migrate deploy >/dev/null

(until curl -s -o /dev/null http://localhost:3000/signin; do sleep 1; done; open "http://localhost:3000/") &
npm run dev
