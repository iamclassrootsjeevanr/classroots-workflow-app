/**
 * Copy one database into another without pg_dump. Both must have the same migrations.
 * `local` = DATABASE_URL, `remote` = REMOTE_DATABASE_URL (both in .env); a postgresql:// URL also works.
 *
 *   npm run db:pull                       remote → local, replaces the local data
 *   npm run db:push                       local → remote, remote must be empty
 *   npm run db:push -- --replace          local → remote, wipes the remote data first
 *   npm run db:copy -- --to "postgresql://…"  local → that database (add --replace to overwrite)
 *
 * Not copied: sign-in sessions, password/verification links and the pending sheet-sync queue.
 * Sheet sync is switched off in the target, so a copy never writes to the Google Sheet by itself.
 */
import { PrismaClient } from '@prisma/client';

const SKIP = new Set(['_prisma_migrations', 'Session', 'VerificationToken', 'SyncOutbox']);
const BATCH = 500;

function arg(name: string) {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
}

const q = (t: string) => `"${t.replace(/"/g, '""')}"`;
const where = (u: string) => {
  const x = new URL(u);
  return `${x.hostname}:${x.port || 5432}${x.pathname}`;
};

async function migrations(db: PrismaClient) {
  const rows = await db.$queryRawUnsafe<{ migration_name: string }[]>(
    'SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name',
  );
  return rows.map(r => r.migration_name);
}

/** Tables in an order where every table comes after the tables it references. */
async function tablesInOrder(db: PrismaClient) {
  const tables = (await db.$queryRawUnsafe<{ t: string }[]>("SELECT tablename AS t FROM pg_tables WHERE schemaname = 'public'")).map(r => r.t).filter(t => !SKIP.has(t));
  const fks = await db.$queryRawUnsafe<{ child: string; parent: string }[]>(
    `SELECT cl.relname AS child, pl.relname AS parent FROM pg_constraint c
     JOIN pg_class cl ON cl.oid = c.conrelid JOIN pg_class pl ON pl.oid = c.confrelid
     JOIN pg_namespace n ON n.oid = c.connamespace WHERE c.contype = 'f' AND n.nspname = 'public'`,
  );
  const deps = new Map(tables.map(t => [t, new Set(fks.filter(f => f.child === t && f.parent !== t && tables.includes(f.parent)).map(f => f.parent))]));
  const order: string[] = [];
  while (order.length < tables.length) {
    const ready = tables.filter(t => !order.includes(t) && [...deps.get(t)!].every(p => order.includes(p)));
    if (!ready.length) throw new Error('Circular foreign keys – cannot order the copy.');
    order.push(...ready.sort());
  }
  return order;
}

/** Rows that point at a row of the same table (WorkItem.parentId) must come after it, so sort them parents first. */
async function parentsFirst(db: PrismaClient, t: string, rows: { r: unknown }[]) {
  const cols = await db.$queryRawUnsafe<{ col: string }[]>(
    `SELECT a.attname AS col FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
     WHERE c.contype = 'f' AND c.conrelid = c.confrelid AND c.conrelid = $1::regclass`,
    q(t),
  );
  if (!cols.length) return rows;
  const byId = new Map(rows.map(x => [(x.r as Record<string, unknown>).id, x.r as Record<string, unknown>]));
  const depth = (r: Record<string, unknown>, seen = 0): number => {
    if (seen > 50) return seen;
    const up = cols.map(c => byId.get(r[c.col])).filter((x): x is Record<string, unknown> => Boolean(x));
    return up.length ? 1 + Math.max(...up.map(u => depth(u, seen + 1))) : 0;
  };
  return rows.map(x => ({ x, d: depth(x.r as Record<string, unknown>) })).sort((a, b) => a.d - b.d).map(v => v.x);
}

async function count(db: PrismaClient, t: string) {
  const [r] = await db.$queryRawUnsafe<{ n: number }[]>(`SELECT count(*)::int AS n FROM ${q(t)}`);
  return r.n;
}

/** `local` / `remote` / a URL → a URL. */
function resolve(v: string | undefined, role: string) {
  const name = v === 'remote' ? 'REMOTE_DATABASE_URL' : v === 'local' ? 'DATABASE_URL' : null;
  const url = name ? process.env[name] : v;
  if (!url?.startsWith('postgres')) {
    throw new Error(name ? `${name} is not set in .env.` : `Give the ${role}: --${role === 'source' ? 'from' : 'to'} local | remote | "postgresql://…"`);
  }
  return url;
}

async function main() {
  const from = resolve(arg('--from') ?? 'local', 'source');
  const to = resolve(arg('--to'), 'target');
  const replace = process.argv.includes('--replace');
  if (where(from) === where(to)) throw new Error('Source and target are the same database.');

  const src = new PrismaClient({ datasources: { db: { url: from } } });
  const dst = new PrismaClient({ datasources: { db: { url: to } } });
  try {
    console.log(`From ${where(from)}\nTo   ${where(to)}${replace ? '  (replacing its data)' : ''}\n`);

    const [a, b] = await Promise.all([migrations(src), migrations(dst)]);
    const missing = a.filter(m => !b.includes(m));
    const extra = b.filter(m => !a.includes(m));
    if (missing.length) throw new Error(`The target is missing migrations: ${missing.join(', ')}. Apply them there first (npm run db:deploy for local, npm run db:deploy:remote for remote).`);
    if (extra.length) throw new Error(`The source is missing migrations: ${extra.join(', ')}. Apply them there first (npm run db:deploy for local, npm run db:deploy:remote for remote).`);

    const order = await tablesInOrder(src);
    const filled = [];
    for (const t of order) if ((await count(dst, t)) > 0) filled.push(t);
    if (filled.length && !replace) throw new Error(`The target already has data (${filled.join(', ')}). Add --replace to wipe it and copy again.`);

    await dst.$transaction(
      async tx => {
        if (replace) await tx.$executeRawUnsafe(`TRUNCATE ${[...order, ...SKIP].filter(t => t !== '_prisma_migrations').map(q).join(', ')} CASCADE`);
        for (const t of order) {
          const rows = await parentsFirst(src, t, await src.$queryRawUnsafe<{ r: unknown }[]>(`SELECT row_to_json(x) AS r FROM ${q(t)} x`));
          for (let i = 0; i < rows.length; i += BATCH) {
            const chunk = JSON.stringify(rows.slice(i, i + BATCH).map(x => x.r));
            await tx.$executeRawUnsafe(`INSERT INTO ${q(t)} SELECT * FROM json_populate_recordset(NULL::${q(t)}, $1::json)`, chunk);
          }
          console.log(`${t.padEnd(24)} ${rows.length}`);
        }
        await tx.$executeRawUnsafe(`UPDATE "WorkType" SET config = jsonb_set(config, '{sync,enabled}', 'false') WHERE config ? 'sync'`);
      },
      { timeout: 15 * 60_000, maxWait: 60_000 },
    );

    for (const t of order) {
      const [x, y] = await Promise.all([count(src, t), count(dst, t)]);
      if (x !== y) throw new Error(`Count mismatch in ${t}: ${x} here, ${y} in the target.`);
    }
    console.log('\nDone. Every table matches. Sheet sync is off in the target (Admin → Sheet sync to turn it on).');
  } finally {
    await Promise.all([src.$disconnect(), dst.$disconnect()]);
  }
}

main().catch(e => {
  console.error(`\n${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
