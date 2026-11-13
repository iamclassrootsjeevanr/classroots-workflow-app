/**
 * Journey: a developer checks design standardization once the review closes.
 * Gives the Developer role to the named people, opens the Design standardization stage (it was paused), and hands every journey
 * that is Closed (or already in design standardization with nobody on it) to a developer. Safe to re-run.
 *
 *   npm run journey:developers -- --people "Jeevan,Swathi"            # show
 *   npm run journey:developers -- --people "Jeevan,Swathi" --apply
 */
import { Prisma } from '@prisma/client';
import { requireModule } from '../src/modules/registry';
import { DEFAULT_CALENDAR } from '../src/lib/time';
import { db } from '../src/server/db';
import { refreshStages } from '../src/server/stages';
import { internals } from '../src/server/services/work-items';
import { ensureModuleRoles } from '../src/server/services/work-types';

const apply = process.argv.includes('--apply');
const people = (process.argv[process.argv.indexOf('--people') + 1] ?? '').split(',').map(s => s.trim()).filter(Boolean);

async function main() {
  await refreshStages(true);
  const wt = await db.workType.findUniqueOrThrow({ where: { key: 'journey-applet' } });
  const mod = requireModule(wt.key);
  const hand = mod.developerHandoff!;
  if (apply) await ensureModuleRoles(wt.id, mod);
  const role = await db.accessRole.findFirst({ where: { workTypeId: wt.id, key: hand.role } });
  console.log(`Role ${hand.role}: ${role ? 'exists' : 'will be created'}`);

  for (const name of people) {
    const found = await db.user.findMany({ where: { active: true, name: { contains: name, mode: 'insensitive' } }, select: { id: true, name: true, email: true } });
    if (found.length !== 1) {
      console.log(`  ${name}: ${found.length ? `${found.length} matches (${found.map(u => u.email).join(', ')})` : 'no user'} – skipped`);
      continue;
    }
    const u = found[0];
    console.log(`  ${u.name} (${u.email}) → ${hand.label}`);
    if (apply && role) {
      await db.workTypeMember.upsert({ where: { workTypeId_userId: { workTypeId: wt.id, userId: u.id } }, create: { workTypeId: wt.id, userId: u.id }, update: {} });
      await db.workTypeMemberRole.upsert({ where: { workTypeId_userId_roleId: { workTypeId: wt.id, userId: u.id, roleId: role.id } }, create: { workTypeId: wt.id, userId: u.id, roleId: role.id }, update: {} });
    }
  }

  const next = 'design_standardization';
  const stage = await db.workflowStage.findFirst({ where: { workTypeId: wt.id, key: next } });
  if (stage && (stage.state === 'paused' || stage.movedBy)) {
    console.log(`Stage ${next}: stored ${stage.state ?? ''} ${stage.movedBy ? 'buttons' : ''} → back to the flow's default`);
    if (apply) await db.workflowStage.update({ where: { id: stage.id }, data: { state: null, movedBy: Prisma.DbNull } });
  }

  const waiting = await db.workItem.findMany({
    where: { workTypeId: wt.id, archivedAt: null, OR: [{ status: hand.after }, { status: next, developerId: null }] },
    select: { id: true, externalKey: true, status: true },
    orderBy: { externalKey: 'asc' },
  });
  console.log(`${waiting.length} journey(s) to hand to a developer`);
  for (const w of waiting) {
    console.log(`  ${w.externalKey} (${w.status})`);
    if (!apply) continue;
    await db.$transaction(async tx => {
      if (w.status === hand.after) await internals.handOffToDeveloperTx(tx, w.id, { userId: null, ctx: null, source: 'IMPORT' }, new Date(), DEFAULT_CALENDAR);
      else {
        const dev = await tx.user.findFirst({ where: { active: true, memberships: { some: { workTypeId: wt.id, roles: { some: { role: { key: hand.role } } } } } }, orderBy: { name: 'asc' }, select: { id: true } });
        if (dev) await tx.workItem.update({ where: { id: w.id }, data: { developerId: dev.id, version: { increment: 1 } } });
      }
    });
  }
  if (!apply) console.log('\nDry run. Add --apply to write.');
}

main().finally(() => db.$disconnect());
