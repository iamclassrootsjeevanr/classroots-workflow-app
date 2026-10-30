/**
 * Tiny scheduler for self-hosted deployments (Docker): calls the app's cron endpoint every few minutes.
 * On Vercel use vercel.json crons instead.
 *
 *   APP_URL=http://app:3000 CRON_SECRET=… SYNC_INTERVAL_MINUTES=5 npm run scheduler
 */
const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
const secret = process.env.CRON_SECRET ?? '';
const minutes = Math.max(1, Number(process.env.SYNC_INTERVAL_MINUTES ?? 5));

async function tick() {
  const started = new Date();
  try {
    const res = await fetch(`${appUrl}/api/cron/run`, { headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(5 * 60000) });
    console.log(`[scheduler] ${started.toISOString()} → ${res.status} ${(await res.text()).slice(0, 300)}`);
  } catch (e) {
    console.error(`[scheduler] ${started.toISOString()} failed:`, e instanceof Error ? e.message : e);
  }
}

console.log(`[scheduler] calling ${appUrl}/api/cron/run every ${minutes} min`);
void tick();
setInterval(tick, minutes * 60000);
