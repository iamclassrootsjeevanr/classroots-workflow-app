/** Base data: admin users from ADMIN_EMAILS, work calendar, and a WorkType row per registered module. */
import { db } from '../src/server/db';
import { ensureAdmins, ensureAllModules, ensureSystemRoles } from '../src/server/services/work-types';

async function main() {
  await ensureSystemRoles();
  await ensureAdmins();
  await ensureAllModules();
  await db.appSetting.upsert({
    where: { key: 'calendar' },
    create: { key: 'calendar', value: { workDays: [1, 2, 3, 4, 5, 6], startHour: 10, endHour: 19 } },
    update: {},
  });
  const [admins, types] = await Promise.all([db.user.count({ where: { isAdmin: true } }), db.workType.count()]);
  console.log(`Seed done: ${admins} admin(s), ${types} work type(s).`);
}

main()
  .catch(e => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
