/**
 * APK Testing: one APK version is one work item. Creates the version item for every version that has test results, links the
 * results to it (parentId), and sets the version's status, dates and tester from them. Safe to re-run.
 *
 *   npm run apk:versions            # show what would change
 *   npm run apk:versions -- --apply
 */
import { versionStatus } from '../src/lib/apk-rollup';
import { requireModule } from '../src/modules/registry';
import { db } from '../src/server/db';
import { internals } from '../src/server/services/work-items';
import { DEFAULT_CALENDAR } from '../src/lib/time';

const apply = process.argv.includes('--apply');
const min = (xs: (Date | null)[]) => xs.filter((x): x is Date => Boolean(x)).sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
const max = (xs: (Date | null)[]) => xs.filter((x): x is Date => Boolean(x)).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

async function main() {
  const types = await db.workType.findMany({ where: { key: 'apk-testing' } });
  for (const wt of types) {
    requireModule(wt.key);
    const runs = await db.workItem.findMany({ where: { workTypeId: wt.id, apkTest: { isNot: null } }, include: { apkTest: { select: { version: { select: { key: true } } } } } });
    const byVersion = new Map<string, typeof runs>();
    for (const r of runs) byVersion.set(r.apkTest!.version.key, [...(byVersion.get(r.apkTest!.version.key) ?? []), r]);
    console.log(`${wt.name}: ${byVersion.size} versions, ${runs.length} test results`);
    for (const [key, list] of [...byVersion].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))) {
      const live = list.filter(r => !r.archivedAt);
      const status = versionStatus(live.map(r => r.status));
      console.log(`  ${key}: ${live.length} tests → ${status}${list.some(r => r.parentId) ? ' (linked)' : ''}`);
      if (!apply) continue;
      await db.$transaction(
        async tx => {
          const id = await internals.ensureVersionItemTx(tx, wt, { userId: null, ctx: null, source: 'IMPORT' }, key, new Date(), DEFAULT_CALENDAR);
          await tx.workItem.updateMany({ where: { id: { in: list.map(r => r.id) } }, data: { parentId: id } });
          // The tester of the version = whoever tests most of it.
          const tally = new Map<string, number>();
          for (const r of live) if (r.assigneeId) tally.set(r.assigneeId, (tally.get(r.assigneeId) ?? 0) + 1);
          const lead = [...tally].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
          const done = status === 'pass';
          const received = min(list.map(r => r.receivedAt)) ?? new Date();
          await tx.workItem.update({
            where: { id },
            data: {
              status,
              assigneeId: lead,
              archivedAt: live.length ? null : new Date(),
              receivedAt: received,
              assignedAt: lead ? min(live.map(r => r.assignedAt)) ?? received : null,
              firstStartedAt: min(live.map(r => r.firstStartedAt)),
              lastSubmittedAt: max(live.map(r => r.lastSubmittedAt)),
              firstReviewAt: min(live.map(r => r.firstReviewAt)),
              lastFeedbackAt: max(live.map(r => r.lastFeedbackAt)),
              approvedAt: done ? max(live.map(r => r.approvedAt ?? r.completedAt)) : null,
              completedAt: done ? max(live.map(r => r.completedAt)) : null,
              version: { increment: 1 },
            },
          });
          // One open stage interval for the current status, from when the version arrived.
          await tx.workItemStageInterval.deleteMany({ where: { itemId: id } });
          await tx.workItemStageInterval.create({ data: { itemId: id, status, assigneeId: lead, enteredAt: max(live.map(r => r.updatedAt)) ?? received, round: 1 } });
        },
        { timeout: 60_000 },
      );
    }
  }
  if (!apply) console.log('\nDry run. Add --apply to write.');
}

main().finally(() => db.$disconnect());
