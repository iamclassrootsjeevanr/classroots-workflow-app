/**
 * Pull the live journey relay into the dashboard.
 *
 *   npm run relay:sync -- --dry-run            # report only, nothing written
 *   npm run relay:sync                          # apply
 *   npm run relay:sync -- --key G04C05ST1J1     # one journey
 *   npm run relay:sync -- --full                # read every journey, not only those the relay's change feed names
 *   npm run relay:sync -- --push                # only send what happened here to the relay's dashboard log (with --dry-run: count it)
 *   npm run relay:sync -- --log G04C05ST1J1     # read-only: what the relay's dashboard log holds for one journey

 *   npm run relay:sync -- --fixture file.json   # use a recorded reply file instead of the live relay: { "allocations": {...}, "status": { "<key>": {...} } }
 *   npm run relay:sync -- --probe               # read-only: whoami + allocations (count) + one journey_status; prints the reply shapes
 */
import { db } from '../src/server/db';
import { readFileSync } from 'node:fs';
import { httpRelayClient, relayConfigured, type RelayClient } from '../src/server/relay/client';
import { pushRelay } from '../src/server/services/relay-push';
import { syncRelay } from '../src/server/services/relay-sync';

const flag = (n: string) => process.argv.includes(n);
const keyArg = flag('--key') ? process.argv[process.argv.indexOf('--key') + 1] : undefined;

async function main() {
  const fixture = flag('--fixture') ? (JSON.parse(readFileSync(process.argv[process.argv.indexOf('--fixture') + 1], 'utf8')) as { allocations: unknown; status?: Record<string, unknown>; feed?: unknown; sent?: unknown[] }) : null;
  let feedCall = 0;
  if (!fixture && !relayConfigured()) throw new Error('Set RELAY_URL, RELAY_CF_CLIENT_ID and RELAY_CF_CLIENT_SECRET in .env first.');
  const client: RelayClient = fixture
    ? {
        allocations: async () => fixture.allocations,
        journeyStatus: async k => fixture.status?.[k] ?? {},
        whoami: async () => ({}),
        // A fixture with a `feed` reply (or a list of them, one per call) and a `sent` list plays the two new lanes too.
        ...(fixture.feed ? { syncFeed: async (a: { head?: boolean }) => (Array.isArray(fixture.feed) ? (a.head ? fixture.feed[0] : (fixture.feed[feedCall++] ?? fixture.feed[fixture.feed.length - 1])) : fixture.feed) } : {}),
        ...(fixture.sent ? { dashboardEvents: async (events: unknown[]) => { fixture.sent!.push(...events); return { ok: true, recorded: (events as { event_id: string }[]).map(e => e.event_id), duplicate: [], rejected: [] }; } } : {}),
      }
    : httpRelayClient();
  if (flag('--probe')) {
    const shape = (v: unknown, depth = 0): unknown => (Array.isArray(v) ? [`${v.length} items`, v[0] === undefined ? null : shape(v[0], depth + 1)] : v && typeof v === 'object' && depth < 3 ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x, depth + 1)])) : typeof v);
    console.log('whoami', JSON.stringify(shape(await client.whoami()), null, 2));
    const all = await client.allocations();
    console.log('allocations', JSON.stringify(shape(all), null, 2));
    if (keyArg) console.log('journey_status', JSON.stringify(shape(await client.journeyStatus(keyArg)), null, 2));
    for (const [name, call] of [['sync_feed (head)', () => client.syncFeed?.({ head: true })], ['dashboard_log', () => client.dashboardLog?.({ limit: 1 })], ['kg_nm_list_chapters', () => client.chapters?.()]] as const) {
      try {
        console.log(name, JSON.stringify(shape(await call()), null, 2));
      } catch (e) {
        console.log(name, 'not available:', e instanceof Error ? e.message : e);
      }
    }
    return;
  }
  if (flag('--log')) {
    console.log(JSON.stringify(await client.dashboardLog?.({ key: process.argv[process.argv.indexOf('--log') + 1] }), null, 2));
    return;
  }
  if (flag('--push')) {
    console.log(JSON.stringify(await pushRelay(client, { dryRun: flag('--dry-run') }), null, 2));
    if (fixture?.sent) console.log(JSON.stringify({ sent: fixture.sent }, null, 2));
    return;
  }
  const r = await syncRelay(client, { dryRun: flag('--dry-run'), key: keyArg, full: flag('--full') });
  console.log(JSON.stringify(r, null, 2));
}

main()
  .catch(e => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
