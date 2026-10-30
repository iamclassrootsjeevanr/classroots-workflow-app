/**
 * Demo sign-ins, one per role mix, so you can walk through every view locally.
 * Password: DEMO_PASSWORD in .env. Safe to re-run (updates the same accounts).
 *
 *   npm run demo:users
 *
 * Developer and SME demos are linked to people imported from the sheet (Jeevan, Aswin) so they show real work.
 * Remove them later from Admin → People & access (Deactivate, or Remove for those with no history).
 */
import { hashPassword, passwordProblem } from '../src/lib/password';
import { db } from '../src/server/db';
import { enableModule, ensureSystemRoles } from '../src/server/services/work-types';

type Demo = {
  email: string;
  name: string;
  isAdmin?: boolean;
  linkToImported?: boolean;
  /** Role keys in Journey Applets; data scope, edit right and pages come from the roles (Admin → Roles). */
  roles?: string[];
};

const DEMOS: Demo[] = [
  { email: 'admin@demo.classroots.local', name: 'Demo Admin', isAdmin: true },
  { email: 'jeevan@demo.classroots.local', name: 'Jeevan', linkToImported: true, roles: ['developer'] },
  { email: 'aswin@demo.classroots.local', name: 'Aswin', linkToImported: true, roles: ['reviewer'] },
  { email: 'coordinator@demo.classroots.local', name: 'Demo Coordinator', roles: ['coordinator'] },
  { email: 'lead@demo.classroots.local', name: 'Demo Lead', roles: ['developer', 'reviewer'] },
  { email: 'viewer@demo.classroots.local', name: 'Demo Viewer', roles: ['viewer'] },
];

async function main() {
  const password = process.env.DEMO_PASSWORD ?? '';
  const problem = passwordProblem(password);
  if (problem) throw new Error(`Set DEMO_PASSWORD in .env first (${problem})`);
  const passwordHash = await hashPassword(password);
  await ensureSystemRoles();
  const wt = await enableModule('journey-applet');
  const roleIds = new Map((await db.accessRole.findMany()).map(r => [r.key, r.id]));

  for (const d of DEMOS) {
    const base = { isAdmin: Boolean(d.isAdmin), active: true, passwordHash, passwordUpdatedAt: new Date() };
    let user = await db.user.findUnique({ where: { email: d.email } });
    if (user) user = await db.user.update({ where: { id: user.id }, data: base });
    else {
      const imported = d.linkToImported ? await db.user.findFirst({ where: { email: null, name: { equals: d.name, mode: 'insensitive' } } }) : null;
      user = imported
        ? await db.user.update({ where: { id: imported.id }, data: { ...base, email: d.email } })
        : await db.user.create({ data: { ...base, email: d.email, name: d.name } });
    }
    if (d.roles) {
      const key = { workTypeId_userId: { workTypeId: wt.id, userId: user.id } };
      await db.workTypeMember.upsert({ where: key, create: { workTypeId: wt.id, userId: user.id }, update: {} });
      await db.workTypeMemberRole.deleteMany({ where: { workTypeId: wt.id, userId: user.id } });
      await db.workTypeMemberRole.createMany({ data: d.roles.map(r => ({ workTypeId: wt.id, userId: user!.id, roleId: roleIds.get(r)! })) });
    }
    console.log(`${d.email.padEnd(36)} ${d.isAdmin ? 'Admin' : d.roles?.join(' + ')}`);
  }
  console.log('Password: the DEMO_PASSWORD value in .env');
}

main()
  .catch(e => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
