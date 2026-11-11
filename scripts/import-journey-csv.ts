/**
 * Journey from the SME tracker (Slack list export, CSV): replaces the Journey work type's items with the tracker's rows.
 *
 *   npm run import:journey -- "/path/to/tracker-export.csv"            # dry run: prints what it would do and every mismatch
 *   npm run import:journey -- "/path/to/tracker-export.csv" --replace  # deletes all Journey items, then imports
 *
 * Also: creates the chapters (with their names), the Journey team (docs/JOURNEY-BRIEF.md answers, A5; follow-up answers 5)
 * with their roles and chapters, and removes the Journey roles of the old demo flow. The SME's corrections and current review
 * states (docs/JOURNEY-FOLLOW-UP.md answers, 5 Nov 2026) are applied over the tracker. Columns:
 * Journey, Chapter, SME creator, Picked up, Creation stage, Submitted for review, Days taken, SME reviewer, Review state,
 * Review date, Closure due, Final status. Creation stage and Review state are read separately: a journey can be submitted
 * for review before it reaches 5 · Ship.
 */
import fs from 'node:fs';
import { creationStageFor, daysTaken, parseJourneyKey, splitJourneyCell } from '../src/lib/journey';
import { normalizeDate, withWorkDays, zonedToUtc } from '../src/lib/time';
import { requireModule } from '../src/modules/registry';
import { db } from '../src/server/db';
import { workCalendar } from '../src/server/settings';
import { refreshStages } from '../src/server/stages';
import { createItemTx } from '../src/server/services/work-items';
import { enableModule, ensureAdmins, resetSystemRole } from '../src/server/services/work-types';

const KEY = 'journey-applet';

/**
 * The Journey team from the SME's answers. Roles: creator, reviewer, coordinator, program manager. `chapters` = the chapters a
 * coordinator steers (their assign / add / edit rights apply there only). Aswin is admin for all three chapters.
 */
const TEAM: { name: string; email: string; roles: string[]; chapters?: string[]; admin?: boolean }[] = [
  { name: 'Arjun Singh', email: 'arjun@classrootsedu.com', roles: ['coordinator', 'sme-reviewer', 'sme-creator'], chapters: ['G04C05'] },
  { name: 'Aswin', email: 'aswin@classrootsedu.com', roles: ['sme-reviewer', 'sme-creator'], admin: true },
  { name: 'Devjyoti Mondal', email: 'devjyoti@classrootsedu.com', roles: ['coordinator', 'sme-reviewer', 'sme-creator'], chapters: ['G05C02'] },
  { name: 'Vinay M R', email: 'vinay@classrootsedu.com', roles: ['coordinator', 'sme-reviewer', 'sme-creator'], chapters: ['G06C07'] },
  { name: 'Kapil Sankhwar', email: 'kapil@classrootsedu.com', roles: ['sme-creator'] },
  { name: 'Animesh Mittal', email: 'animesh@classrootsedu.com', roles: ['sme-creator'] },
  { name: 'Krishna Rander', email: 'krishna@classrootsedu.com', roles: ['sme-creator'] },
  { name: 'Manasa K', email: 'manasa@classrootsedu.com', roles: ['sme-creator'] },
  { name: 'Preethi Esther', email: 'preethi@classrootsedu.com', roles: ['sme-creator'] },
  { name: 'Vaishali Rathore', email: 'vaishali@classrootsedu.com', roles: ['sme-creator'] },
  { name: 'Supriya Manjrekar', email: 'supriya@classrootsedu.com', roles: ['sme-creator'] },
  { name: 'Divyanshu Medatwal', email: 'divyanshu@classrootsedu.com', roles: ['sme-creator'] },
  { name: 'Jeevan', email: 'jeevan@classrootsedu.com', roles: ['program-manager'], admin: true },
  { name: 'Kishor', email: 'kishor@classrootsedu.com', roles: ['program-manager'], admin: true },
];

const CHAPTERS: Record<string, { title: string; book: string }> = {
  G04C05: { title: 'Sharing and Measuring', book: 'CBSE Grade 4' },
  G05C02: { title: 'Fractions', book: 'CBSE Grade 5' },
  G06C07: { title: 'Fractions', book: 'CBSE Grade 6' },
};

const REVIEW: Record<string, string> = { 'ready for review': 'ready_for_review', 'in progress': 'review_in_progress', 'review in progress': 'review_in_progress', 'changes asked': 'changes_asked', 'correction verification': 'correction_verification', closed: 'closed' };

/** The SME's answers (docs/JOURNEY-FOLLOW-UP.md, 5 Nov 2026) over the 4 Nov tracker export: corrections and current review states. */
const ANSWERS: Record<string, { creationStage?: string; status?: string; reviewDate?: string; reviewStarted?: string; pickedUpHalf?: string; daysTypo?: boolean }> = {
  G04C05ST1J1: { creationStage: '5 · Ship', status: 'ready_for_review', pickedUpHalf: 'Second half' },
  G04C05ST2J1: { status: 'changes_asked', reviewDate: '2026-11-04', pickedUpHalf: 'Second half' },
  G04C05ST3J1: { status: 'ready_for_review', pickedUpHalf: 'Second half' },
  G04C05ST4J1: { status: 'ready_for_review', pickedUpHalf: 'Second half' },
  G04C05ST5J1: { status: 'changes_asked', reviewDate: '2026-11-03', pickedUpHalf: 'Second half' },
  G05C02ST2J1: { status: 'review_in_progress', reviewStarted: '2026-11-02' },
  G05C02ST3J1: { status: 'ready_for_review' },
  G05C02ST4J1: { status: 'ready_for_review' },
  G05C02ST4J2: { status: 'ready_for_review' },
  G05C02ST5J1: { daysTypo: true },
};

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

  type Planned = { key: string; name: string; chapter: string; creator: string; reviewer: string; status: string; data: Record<string, string>; enteredAt: string; reviewStarted?: string };
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
    const answer = ANSWERS[key] ?? {};
    const pickedUp = normalizeDate(r['Picked up']);
    const submitted = normalizeDate(r['Submitted for review']);
    const reviewDate = answer.reviewDate ?? normalizeDate(r['Review date']);
    const notStarted = !r['Creation stage'] || norm(r['Creation stage']) === 'not started';
    const creation = answer.creationStage ?? (notStarted ? undefined : creationStageFor(r['Creation stage']));
    const review = answer.status ?? REVIEW[norm(r['Review state'] ?? '')];
    if (!notStarted && !creation) warn(key, `unknown Creation stage “${r['Creation stage']}”`);
    if (r['Review state'] && !REVIEW[norm(r['Review state'])]) warn(key, `unknown Review state “${r['Review state']}”`);

    let status = review ?? (submitted ? 'ready_for_review' : creation ? 'creating' : 'allocated');
    if (!review && norm(r['Final status'] ?? '') === 'closed') status = 'closed';
    if (['changes_asked', 'correction_verification', 'closed'].includes(status) && !reviewDate) warn(key, `Review state is “${status}” but there is no Review date`);
    const days = daysTaken(pickedUp, submitted, { pickedUp: answer.pickedUpHalf }, cal);
    if (r['Days taken'] && !submitted && !answer.daysTypo) warn(key, `Days taken ${r['Days taken']} but no Submitted for review date (dropped)`);
    else if (r['Days taken'] && days != null && Number(r['Days taken']) !== days) warn(key, `Days taken ${r['Days taken']} in the tracker, ${days} in the app (Mon–Fri, half days) from ${pickedUp} to ${submitted}`);
    if (r['SME reviewer'] && !submitted && !review) warn(key, `has SME reviewer ${r['SME reviewer']} before it was submitted`);

    const data: Record<string, string> = {};
    if (creation) data.creationStage = creation;
    if (pickedUp) data.pickedUpAt = pickedUp;
    if (answer.pickedUpHalf) data.pickedUpHalf = answer.pickedUpHalf;
    if (submitted) data.submittedAt = submitted;
    if (reviewDate) data.reviewDate = reviewDate;
    const enteredAt =
      (status === 'review_in_progress' ? answer.reviewStarted : '') ||
      (['review_in_progress', 'changes_asked', 'correction_verification', 'closed'].includes(status) ? reviewDate : '') ||
      (status === 'ready_for_review' || status === 'review_in_progress' ? submitted : '') ||
      pickedUp ||
      normalizeDate(new Date());
    planned.push({ key, name, chapter: parsed.chapter, creator: r['SME creator'] ?? '', reviewer: r['SME reviewer'] ?? '', status, data, enteredAt, reviewStarted: answer.reviewStarted });
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
  // The SME's role table (brief A4) is the source: built-in roles go back to the module's defaults.
  for (const [k, id] of roleIds) if (keep.has(k)) await resetSystemRole(id);

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
    const named = CHAPTERS[code];
    await db.chapter.upsert({
      where: { code },
      create: { code, title: named?.title ?? code, book: named?.book, grade: k.grade, chapterNo: Number(code.slice(4)) },
      update: named ? { title: named.title, book: named.book } : {},
    });
  }
  const chapterIds = new Map((await db.chapter.findMany({ select: { id: true, code: true } })).map(c => [c.code, c.id]));

  // People: by email, else an existing person with the same name and no email (keeps their history), else new.
  const userIds = new Map<string, string>();
  for (const t of TEAM) {
    let user = await db.user.findUnique({ where: { email: t.email } });
    user ??= await db.user.findFirst({ where: { email: null, name: { equals: t.name, mode: 'insensitive' } } });
    const admin = t.admin ? { isAdmin: true } : {};
    user = user
      ? await db.user.update({ where: { id: user.id }, data: { email: t.email, active: true, ...admin } })
      : await db.user.create({ data: { name: t.name, email: t.email, capacity: 3, active: true, ...admin } });
    userIds.set(norm(t.name), user.id);
    const roles = t.roles.map(k => roleIds.get(k)).filter((x): x is string => Boolean(x));
    const groupKeys = t.chapters ?? [];
    await db.workTypeMember.upsert({ where: { workTypeId_userId: { workTypeId: wt.id, userId: user.id } }, create: { workTypeId: wt.id, userId: user.id, groupKeys }, update: { groupKeys } });
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
          firstReviewAt: day(p.reviewStarted) ?? day(p.data.reviewDate),
          lastFeedbackAt: def.category === 'feedback' ? day(p.data.reviewDate) : null,
          approvedAt: p.status === 'closed' ? (day(p.data.reviewDate) ?? entered) : null,
        },
      });
    }, { timeout: 20_000 });
  }

  // People the old sheet imports created by first name only (no email) and who now have no role or work: remove them.
  const orphans = await db.user.findMany({
    where: {
      email: null,
      memberships: { none: {} },
      assignedItems: { none: {} },
      ownedItems: { none: {} },
      createdItems: { none: {} },
      events: { none: {} },
      feedback: { none: {} },
      intervals: { none: {} },
    },
    select: { id: true, name: true },
  });
  for (const o of orphans) {
    await db.$transaction([db.notification.deleteMany({ where: { userId: o.id } }), db.workloadSnapshot.deleteMany({ where: { userId: o.id } }), db.user.delete({ where: { id: o.id } })]);
  }

  console.log(`\nRemoved ${removed.count} existing journeys, ${oldRoles.length} old roles and ${orphans.length} people without email or work${orphans.length ? ` (${orphans.map(o => o.name).join(', ')})` : ''}. Imported ${planned.length} journeys, ${TEAM.length} people.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

