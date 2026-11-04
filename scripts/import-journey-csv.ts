/**
 * Journey from the SME tracker (Slack list export, CSV): replaces the Journey work type's items with the tracker's rows.
 *
 *   npm run import:journey -- "/path/to/tracker-export.csv"            # dry run: prints what it would do and every mismatch
 *   npm run import:journey -- "/path/to/tracker-export.csv" --replace  # deletes all Journey items, then imports
 *
 * Also: creates the chapters, the Journey team (docs/JOURNEY-BRIEF.md answers, A5) with their roles, and removes the
 * Journey roles of the old demo flow (Developer, SME / Reviewer, Viewer). Columns:
 * Journey, Chapter, SME creator, Picked up, Creation stage, Submitted for review, Days taken, SME reviewer, Review state,
 * Review date, Closure due, Final status.
 */
import fs from 'node:fs';
import { parseJourneyKey, splitJourneyCell, workingDaysInclusive } from '../src/lib/journey';
import { normalizeDate, withWorkDays, zonedToUtc } from '../src/lib/time';
import { requireModule } from '../src/modules/registry';
import { db } from '../src/server/db';
import { workCalendar } from '../src/server/settings';
import { refreshStages } from '../src/server/stages';
import { createItemTx } from '../src/server/services/work-items';
import { enableModule, ensureAdmins } from '../src/server/services/work-types';

const KEY = 'journey-applet';

/** The Journey team from the SME's answers. Roles: creator, reviewer, coordinator, program manager. */
const TEAM: { name: string; email: string; roles: string[] }[] = [
  { name: 'Arjun Singh', email: 'arjun@classrootsedu.com', roles: ['coordinator', 'sme-reviewer', 'sme-creator'] },
  { name: 'Aswin', email: 'aswin@classrootsedu.com', roles: ['coordinator', 'sme-reviewer', 'sme-creator'] },
  { name: 'Devjyoti Mondal', email: 'devjyoti@classrootsedu.com', roles: ['coordinator', 'sme-reviewer', 'sme-creator'] },
  { name: 'Vinay M R', email: 'vinay@classrootsedu.com', roles: ['coordinator', 'sme-reviewer', 'sme-creator'] },
  { name: 'Kapil Sankhwar', email: 'kapil@classrootsedu.com', roles: ['sme-creator'] },
  { name: 'Animesh Mittal', email: 'animesh@classrootsedu.com', roles: ['sme-creator'] },
  { name: 'Krishna Rander', email: 'krishna.rander@classrootsedu.com', roles: ['sme-creator'] },
  { name: 'Manasa K', email: 'manasa@classrootsedu.com', roles: ['sme-creator'] },
  { name: 'Preethi Esther', email: 'preethi@classrootsedu.com', roles: ['sme-creator'] },
  { name: 'Vaishali Rathore', email: 'vaishali@classrootsedu.com', roles: ['sme-creator'] },
  { name: 'Supriya Manjrekar', email: 'supriya@classrootsedu.com', roles: ['sme-creator'] },
  { name: 'Divyanshu Medatwal', email: 'divyanshu@classrootsedu.com', roles: ['sme-creator'] },
  { name: 'Jeevan', email: 'jeevan@classrootsedu.com', roles: ['program-manager'] },
  { name: 'Kishor', email: 'kishor@classrootsedu.com', roles: ['program-manager'] },
];

const CREATION: Record<string, string> = { 'not started': 'allocated', '3a · spine': 'spine', '3b · script': 'script', '4 · build': 'build', '5 · ship': 'ship', published: 'ship' };
const REVIEW: Record<string, string> = { 'ready for review': 'ready_for_review', 'in progress': 'review_in_progress', 'changes asked': 'changes_asked', 'correction verification': 'correction_verification', closed: 'closed' };
const CREATION_ORDER = ['allocated', 'spine', 'script', 'build', 'ship'];

/** RFC 4180 CSV → rows keyed by header. */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') row.push(cell), (cell = '');
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell), rows.push(row), (row = []), (cell = '');
    } else cell += c;
  }
  if (cell || row.length) row.push(cell), rows.push(row);
  const [header, ...body] = rows.filter(r => r.some(x => x.trim()));
  return body.map(r => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
/** 10:00 India time on a 'YYYY-MM-DD' day (the stage dates in the tracker have no time). */
const at10 = (ymd: string, tz: string) => zonedToUtc(+ymd.slice(0, 4), +ymd.slice(5, 7), +ymd.slice(8, 10), 10, 0, tz);

async function main() {
  const file = process.argv[2];
  const replace = process.argv.includes('--replace');
  if (!file || !fs.existsSync(file)) throw new Error('Usage: npm run import:journey -- <tracker-export.csv> [--replace]');
  const rows = parseCsv(fs.readFileSync(file, 'utf8'));
  console.log(`Reading ${file}: ${rows.length} journeys${replace ? '' : ' (dry run: add --replace to import)'}`);

  await refreshStages(true);
  const mod = requireModule(KEY);
  const cal = withWorkDays(await workCalendar(), mod.workDays);
  const issues: string[] = [];
  const warn = (key: string, msg: string) => issues.push(`${key}: ${msg}`);

  type Planned = { key: string; name: string; chapter: string; creator: string; reviewer: string; status: string; data: Record<string, string>; enteredAt: string };
  const planned: Planned[] = [];
  for (const r of rows) {
    const { key, name } = splitJourneyCell(r['Journey'] ?? '');
    const parsed = parseJourneyKey(key);
    if (!parsed) {
      warn(key || '(blank)', 'journey key is not GxxCxxSTnJn; skipped');
      continue;
    }
    const chapter = r['Chapter'] || parsed.chapter;
    if (chapter !== parsed.chapter) warn(key, `Chapter column says ${chapter}, the key says ${parsed.chapter}`);
    const pickedUp = normalizeDate(r['Picked up']);
    const submitted = normalizeDate(r['Submitted for review']);
    const reviewDate = normalizeDate(r['Review date']);
    const creation = CREATION[norm(r['Creation stage'] ?? '')];
    const review = REVIEW[norm(r['Review state'] ?? '')];
    if (r['Creation stage'] && !creation) warn(key, `unknown Creation stage “${r['Creation stage']}”`);
    if (r['Review state'] && !review) warn(key, `unknown Review state “${r['Review state']}”`);

    let status = review ?? (submitted ? 'ready_for_review' : (creation ?? 'allocated'));
    if (!review && norm(r['Final status'] ?? '') === 'closed') status = 'closed';
    if (submitted && creation && CREATION_ORDER.indexOf(creation) < CREATION_ORDER.indexOf('ship') && norm(r['Creation stage']) !== 'published') {
      warn(key, `has Submitted for review ${submitted} but Creation stage is still “${r['Creation stage']}” → imported as Ready for review`);
    }
    if (norm(r['Creation stage'] ?? '') === 'published' && !submitted && !review) warn(key, 'Creation stage is Published but there is no Submitted for review date → imported as 5 · Ship');
    if (review && review !== 'ready_for_review' && !reviewDate) warn(key, `Review state is “${r['Review state']}” but there is no Review date`);
    const days = workingDaysInclusive(pickedUp, submitted, cal);
    if (r['Days taken'] && !submitted) warn(key, `Days taken ${r['Days taken']} but no Submitted for review date (dropped)`);
    else if (r['Days taken'] && days != null && Number(r['Days taken']) !== days) warn(key, `Days taken ${r['Days taken']} in the tracker, ${days} working days (Mon–Fri, both days counted) from ${pickedUp} to ${submitted}`);
    if (r['SME reviewer'] && !submitted && !review) warn(key, `has SME reviewer ${r['SME reviewer']} before it was submitted`);

    const data: Record<string, string> = {};
    if (pickedUp) data.pickedUpAt = pickedUp;
    if (submitted) data.submittedAt = submitted;
    if (reviewDate) data.reviewDate = reviewDate;
    const enteredAt = (['review_in_progress', 'changes_asked', 'correction_verification', 'closed'].includes(status) ? reviewDate : '') || (status === 'ready_for_review' ? submitted : '') || pickedUp || normalizeDate(new Date());
    planned.push({ key, name, chapter: parsed.chapter, creator: r['SME creator'] ?? '', reviewer: r['SME reviewer'] ?? '', status, data, enteredAt });
  }

  const teamNames = new Map(TEAM.map(t => [norm(t.name), t]));
  for (const p of planned) {
    if (p.creator && !teamNames.has(norm(p.creator))) warn(p.key, `SME creator “${p.creator}” is not in the team list`);
    if (p.reviewer && !teamNames.has(norm(p.reviewer))) warn(p.key, `SME reviewer “${p.reviewer}” is not in the team list`);
  }
  const byStatus = new Map<string, number>();
  for (const p of planned) byStatus.set(p.status, (byStatus.get(p.status) ?? 0) + 1);
  console.log('Stages:', [...byStatus].map(([s, n]) => `${mod.statuses.find(x => x.key === s)?.label ?? s} ${n}`).join(' · '));
  console.log(issues.length ? `\nRows to check with the SME (${issues.length}):\n  - ${issues.join('\n  - ')}` : '\nNo mismatches.');
  if (!replace) return;

  await ensureAdmins();
  const wt = await enableModule(KEY);
  const roleIds = new Map((await db.accessRole.findMany({ where: { workTypeId: wt.id } })).map(r => [r.key, r.id]));
  const keep = new Set((mod.roles ?? []).map(r => r.key));

  // Old demo flow: its items and roles go.
  const removed = await db.workItem.deleteMany({ where: { workTypeId: wt.id } });
  const oldRoles = [...roleIds].filter(([k]) => !keep.has(k)).map(([, id]) => id);
  await db.workTypeMemberRole.deleteMany({ where: { roleId: { in: oldRoles } } });
  await db.accessRole.deleteMany({ where: { id: { in: oldRoles } } });
  await db.workTypeMember.deleteMany({ where: { workTypeId: wt.id, roles: { none: {} } } });
  await db.syncState.deleteMany({ where: { workTypeId: wt.id } });

  // Chapters
  for (const code of [...new Set(planned.map(p => p.chapter))]) {
    const k = parseJourneyKey(`${code}ST1J1`)!;
    await db.chapter.upsert({ where: { code }, create: { code, title: code, grade: k.grade, chapterNo: Number(code.slice(4)) }, update: {} });
  }
  const chapterIds = new Map((await db.chapter.findMany({ select: { id: true, code: true } })).map(c => [c.code, c.id]));

  // People: by email, else an existing person with the same name and no email (keeps their history), else new.
  const userIds = new Map<string, string>();
  for (const t of TEAM) {
    let user = await db.user.findUnique({ where: { email: t.email } });
    user ??= await db.user.findFirst({ where: { email: null, name: { equals: t.name, mode: 'insensitive' } } });
    user = user ? await db.user.update({ where: { id: user.id }, data: { email: t.email, active: true } }) : await db.user.create({ data: { name: t.name, email: t.email, capacity: 3, active: true } });
    userIds.set(norm(t.name), user.id);
    const roles = t.roles.map(k => roleIds.get(k)).filter((x): x is string => Boolean(x));
    await db.workTypeMember.upsert({ where: { workTypeId_userId: { workTypeId: wt.id, userId: user.id } }, create: { workTypeId: wt.id, userId: user.id }, update: {} });
    await db.workTypeMemberRole.deleteMany({ where: { workTypeId: wt.id, userId: user.id } });
    await db.workTypeMemberRole.createMany({ data: roles.map(roleId => ({ workTypeId: wt.id, userId: user!.id, roleId })) });
  }

  // Journeys
  const actor = { userId: null, ctx: null, source: 'IMPORT' as const };
  for (const p of planned) {
    const entered = at10(p.enteredAt, cal.tz);
    await db.$transaction(async tx => {
      const item = await createItemTx(
        tx,
        wt,
        actor,
        {
          externalKey: p.key,
          title: p.name,
          status: p.status,
          assigneeId: userIds.get(norm(p.creator)) ?? null,
          ownerId: userIds.get(norm(p.reviewer)) ?? null,
          chapterId: chapterIds.get(p.chapter) ?? null,
          groupKey: p.chapter,
          sortOrder: Number(parseJourneyKey(p.key)!.subtopic.slice(2)) * 100 + parseJourneyKey(p.key)!.journey,
          data: p.data,
        },
        entered,
        cal,
      );
      // The tracker's dates are the real history: received / assigned = picked up, submitted, first review.
      const day = (ymd?: string) => (ymd ? at10(ymd, cal.tz) : null);
      const def = mod.statuses.find(s => s.key === p.status)!;
      const started = def.category !== 'queue';
      await tx.workItem.update({
        where: { id: item.id },
        data: {
          receivedAt: day(p.data.pickedUpAt) ?? entered,
          assignedAt: item.assigneeId ? (day(p.data.pickedUpAt) ?? entered) : null,
          firstStartedAt: started ? (day(p.data.pickedUpAt) ?? entered) : null,
          lastSubmittedAt: day(p.data.submittedAt),
          reviewRounds: p.data.submittedAt ? 1 : 0,
          firstReviewAt: day(p.data.reviewDate),
          approvedAt: p.status === 'closed' ? (day(p.data.reviewDate) ?? entered) : null,
        },
      });
    }, { timeout: 20_000 });
  }

  console.log(`\nRemoved ${removed.count} demo journeys and ${oldRoles.length} old roles. Imported ${planned.length} journeys, ${TEAM.length} people.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

