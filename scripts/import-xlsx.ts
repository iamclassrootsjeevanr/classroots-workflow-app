/**
 * Import the tracker workbook (Chapter List, Dropdowns, Journeys in Chapters) into Postgres.
 * Safe to re-run: chapters are upserted, existing journeys are left as they are.
 *
 *   npm run import:xlsx -- "/path/to/JC-TrackerDemo.xlsx"
 */
import os from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { requireModule } from '../src/modules/registry';
import { sheetRowValues } from '../src/lib/sheet-core';
import { normalizeDate } from '../src/lib/time';
import { db } from '../src/server/db';
import { createItemTx } from '../src/server/services/work-items';
import { enableModule, ensureAdmins, ensureSystemRoles } from '../src/server/services/work-types';
import { newItemFromSheet, PeopleDirectory } from '../src/server/sync/google-sheet';

type Row = Record<string, unknown>;

function plain(v: ExcelJS.CellValue): unknown {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    // Formula cells: use the cached result (absent when the workbook was never recalculated).
    if ('formula' in v || 'sharedFormula' in v || 'result' in v) return plain((v as { result?: ExcelJS.CellValue }).result ?? null);
    if ('richText' in v) return v.richText.map(t => t.text).join('');
    if ('hyperlink' in v) return (v as { hyperlink: string; text?: string }).hyperlink;
    if ('text' in v) return (v as { text: string }).text;
    if ('error' in v) return '';
  }
  return v;
}

function rowsOf(ws: ExcelJS.Worksheet | undefined): Row[] {
  if (!ws) return [];
  const headers: string[] = [];
  ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => (headers[col] = String(plain(cell.value)).trim()));
  const rows: Row[] = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const obj: Row = {};
    let empty = true;
    headers.forEach((h, col) => {
      if (!h) return;
      const v = plain(row.getCell(col).value);
      if (String(v).trim() !== '') empty = false;
      obj[h] = v;
    });
    if (!empty) rows.push(obj);
  });
  return rows;
}

const num = (v: unknown) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v));
const str = (v: unknown) => (String(v ?? '').trim() || null);

async function main() {
  const file = process.argv[2] ?? path.join(os.homedir(), 'Downloads', 'JC-TrackerDemo.xlsx');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  console.log(`Reading ${file}`);

  await ensureAdmins();
  await ensureSystemRoles();
  const mod = requireModule('journey-applet');
  const wt = await enableModule(mod.key);
  const people = await new PeopleDirectory(db, wt.id).load();

  // Chapters
  let chapters = 0;
  for (const r of rowsOf(wb.getWorksheet('Chapter List'))) {
    const code = str(r['Grade + Chapter']);
    if (!code) continue;
    const data = {
      grade: num(r['Grade']),
      book: str(r['Book']),
      part: str(r['Part']),
      chapterNo: num(r['Chapter No']),
      title: str(r['Chapter']) ?? code,
      teachingMonths: str(r['Ideal teaching months']),
      ncertUrl: str(r['NCERT PDF URL']),
      creator: str(r['Creator']),
      expectedCompletion: normalizeDate(r['Expected Completion']) ? new Date(normalizeDate(r['Expected Completion'])) : null,
    };
    await db.chapter.upsert({ where: { code }, create: { code, ...data }, update: data });
    chapters++;
  }

  // SME list
  let smes = 0;
  for (const r of rowsOf(wb.getWorksheet('Dropdowns'))) {
    if (str(r['Owner']) && (await people.resolve(String(r['Owner']), 'reviewer'))) smes++;
  }

  // Journeys
  const chapterIds = new Map((await db.chapter.findMany({ select: { id: true, code: true } })).map(c => [c.code, c.id]));
  const keyCol = mod.sheet!.columns.find(c => c.kind === 'key')!.column;
  let created = 0;
  let skipped = 0;
  for (const r of rowsOf(wb.getWorksheet(mod.sheet!.defaultTab))) {
    const key = str(r[keyCol]);
    if (!key) continue;
    const exists = await db.workItem.findUnique({ where: { workTypeId_externalKey: { workTypeId: wt.id, externalKey: key } } });
    if (exists) {
      skipped++;
      continue;
    }
    const values = sheetRowValues(mod, r);
    const input = await newItemFromSheet(mod, key, values, people);
    input.chapterId = input.groupKey ? chapterIds.get(input.groupKey) ?? null : null;
    await db.$transaction(tx => createItemTx(tx, wt, { userId: null, ctx: null, source: 'IMPORT' }, input));
    created++;
  }

  const assigned = await db.workItem.groupBy({ by: ['assigneeId'], where: { workTypeId: wt.id, assigneeId: { not: null } }, _count: true });
  const names = new Map((await db.user.findMany({ select: { id: true, name: true } })).map(u => [u.id, u.name]));
  console.log(`Chapters: ${chapters} · SMEs in list: ${smes} · Journeys created: ${created} (already present: ${skipped})`);
  console.log('Assigned per developer:', assigned.map(a => `${names.get(a.assigneeId!)}=${a._count}`).join(', ') || 'none');
}

main()
  .catch(e => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
