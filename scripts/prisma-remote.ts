/**
 * Run a Prisma command against the remote database (REMOTE_DATABASE_URL in .env, the External URL of Render/Railway).
 *   npm run db:deploy:remote   apply committed migrations there (the hosted app also does this on every start)
 *   npm run db:studio:remote   browse the remote data at http://localhost:5555 (edits there are live)
 */
import { spawnSync } from 'node:child_process';

const url = process.env.REMOTE_DATABASE_URL;
if (!url?.startsWith('postgres')) {
  console.error('REMOTE_DATABASE_URL is not set in .env (the External URL of the hosted database).');
  process.exit(1);
}
const r = spawnSync('npx', ['prisma', ...process.argv.slice(2)], { stdio: 'inherit', env: { ...process.env, DATABASE_URL: url } });
process.exit(r.status ?? 1);
