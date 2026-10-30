/**
 * Local PostgreSQL 16 for development, from the embedded-postgres npm package (prebuilt binaries,
 * no system install). Settings come from DATABASE_URL in .env; data lives in ./.pgdata.
 *
 *   npm run db:start      (keep this terminal open; Ctrl+C stops the database)
 *
 * Production uses a normal hosted Postgres – this script is only for this machine.
 */
import { existsSync, readFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envFile = path.join(root, '.env');
  if (!existsSync(envFile)) throw new Error('No .env file – copy .env.example to .env first.');
  const line = readFileSync(envFile, 'utf8').split('\n').find(l => l.startsWith('DATABASE_URL='));
  if (!line) throw new Error('DATABASE_URL is missing in .env');
  return line.slice('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '');
}

const url = new URL(databaseUrl());
if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
  console.log(`DATABASE_URL points at ${url.hostname}, not this machine – nothing to start.`);
  process.exit(0);
}
const port = Number(url.port || 5432);
const user = decodeURIComponent(url.username);
const password = decodeURIComponent(url.password);
const database = url.pathname.slice(1);

const inUse = await new Promise(resolve => {
  const s = net.connect(port, '127.0.0.1');
  s.once('connect', () => (s.destroy(), resolve(true)));
  s.once('error', () => resolve(false));
});
if (inUse) {
  console.log(`Something is already listening on port ${port} – assuming the database is running.`);
  process.exit(0);
}

const dataDir = path.join(root, '.pgdata');
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user, password, port, persistent: true, onLog: () => {} });

if (!existsSync(path.join(dataDir, 'PG_VERSION'))) {
  console.log('Creating a new local database in .pgdata …');
  await pg.initialise();
}
await pg.start();
try {
  await pg.createDatabase(database);
  console.log(`Created database "${database}".`);
} catch {
  // already exists
}
console.log(`PostgreSQL ready on localhost:${port} (database "${database}"). Press Ctrl+C to stop.`);

let stopping = false;
const stop = async () => {
  if (stopping) return;
  stopping = true;
  await pg.stop();
  console.log('PostgreSQL stopped.');
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 1 << 30);
