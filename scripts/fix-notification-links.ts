/**
 * Inbox links that point at a journey that no longer exists (the journeys were re-imported, so every id changed) open a 404.
 * Re-point each one at the journey with the same key, or at the list when there is none. Safe to re-run.
 *
 *   npm run notifications:fix-links            # show
 *   npm run notifications:fix-links -- --apply
 */
import { db } from '../src/server/db';

const apply = process.argv.includes('--apply');
const KEY = /G\d+C\d+ST\d+J\d+/i;

async function main() {
  const rows = await db.notification.findMany({ where: { href: { startsWith: '/w/' } }, select: { id: true, href: true, title: true, body: true } });
  let fixed = 0;
  for (const n of rows) {
    const [, , wt, id] = (n.href ?? '').split('?')[0].split('/');
    if (!wt || !id || id === 'items' || id === 'versions') continue;
    if (await db.workItem.findUnique({ where: { id }, select: { id: true } })) continue;
    const key = `${n.title} ${n.body ?? ''}`.match(KEY)?.[0]?.toUpperCase();
    const item = key ? await db.workItem.findFirst({ where: { workType: { key: wt }, externalKey: key, archivedAt: null }, select: { id: true } }) : null;
    const href = item ? `/w/${wt}/${item.id}` : `/w/${wt}/items`;
    console.log(`${n.title}  ${n.href} → ${href}`);
    fixed++;
    if (apply) await db.notification.update({ where: { id: n.id }, data: { href } });
  }
  console.log(`${fixed} stale link(s)${apply ? ' fixed' : ''}.${apply ? '' : ' Add --apply to write.'}`);
}

main().finally(() => db.$disconnect());
