/**
 * Import the APK Testing Tracker workbook (Test Execution, APK Releases, Test Cases) into the APK Testing work type.
 * Safe to re-run: existing tests are left as they are.
 *
 *   npm run import:apk -- "/path/to/APK Testing Tracker.xlsx"
 */
import os from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { requireModule } from '../src/modules/registry';
import { rowKey, sheetRowValues } from '../src/lib/sheet-core';
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
    if ('formula' in v || 'sharedFormula' in v || 'result' in v) return plain((v as { result?: ExcelJS.CellValue }).result ?? null);
    if ('richText' in v) return v.richText.map(t => t.text).join('');
    if ('hyperlink' in v) return { text: String((v as { text?: unknown }).text ?? ''), url: (v as { hyperlink: string }).hyperlink };
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
    let empty = false;
    headers.forEach((h, col) => {
      if (!h) return;
      const v = plain(row.getCell(col).value);
      if (v !== '' && v != null) empty = false;
      obj[h] = v;
    });
    if (!empty || Object.values(obj).some(v => v !== '')) rows.push(obj);
  });
  return rows;
}

const str = (v: unknown) => (v && typeof v === 'object' && 'text' in (v as object) ? String((v as { text: string }).text) : String(v ?? '')).trim();
const url = (v: unknown) => (v && typeof v === 'object' && 'url' in (v as object) ? String((v as { url: string }).url) : '');

async function main() {
  const file = process.argv[2] ?? path.join(os.homedir(), 'Downloads', 'APK Testing Tracker.xlsx');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  console.log(`Reading ${file}`);

  await ensureAdmins();
  await ensureSystemRoles();
  const mod = requireModule('apk-testing');
  const wt = await enableModule(mod.key);
  const people = await new PeopleDirectory(db, wt.id).load();

  const releases = new Map(
    rowsOf(wb.getWorksheet('APK Releases')).map(r => [
      str(r['APK Version']),
      { releaseDate: normalizeDate(r['Release Date']), apkUrl: url(r['APK Link']), apkName: str(r['APK Link']), releaseNotes: str(r['Notes']) },
    ]),
  );
  const cases = new Map(
    rowsOf(wb.getWorksheet('Test Cases')).map(r => [
      str(r['Test Case ID']),
      { scenario: str(r['Test Scenario']), expected: str(r['Expected Result']), steps: str(r['Test Steps']), defaultPriority: str(r['Default Priority']) },
    ]),
  );

  let created = 0;
  let skipped = 0;
  for (const r of rowsOf(wb.getWorksheet(mod.sheet!.defaultTab))) {
    const row: Row = Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'object' && v && 'text' in v ? str(v) : v]));
    const key = rowKey(mod, row);
    if (!key) continue;
    const exists = await db.workItem.findUnique({ where: { workTypeId_externalKey: { workTypeId: wt.id, externalKey: key } } });
    if (exists) {
      skipped++;
      continue;
    }
    const values = sheetRowValues(mod, row);
    const input = await newItemFromSheet(mod, key, values, people);
    const version = str(row['APK Version']);
    const tc = cases.get(str(row['Test Case ID']));
    const rel = releases.get(version);
    input.data = {
      ...input.data,
      ...(tc ? { scenario: tc.scenario, expected: tc.expected, steps: tc.steps } : {}),
      ...(rel ? { releaseDate: rel.releaseDate, apkUrl: rel.apkUrl, releaseNotes: [rel.apkName, rel.releaseNotes].filter(Boolean).join(' – ') } : {}),
    };
    if (!input.data.priority && tc?.defaultPriority) input.data.priority = tc.defaultPriority;
    await db.$transaction(tx => createItemTx(tx, wt, { userId: null, ctx: null, source: 'IMPORT' }, input));
    created++;
  }

  const byStatus = await db.workItem.groupBy({ by: ['status'], where: { workTypeId: wt.id }, _count: true });
  const versions = await db.workItem.findMany({ where: { workTypeId: wt.id }, distinct: ['groupKey'], select: { groupKey: true } });
  console.log(`Tests created: ${created} (already present: ${skipped}) · APK versions: ${versions.length}`);
  console.log('By status:', byStatus.map(s => `${s.status}=${s._count}`).join(', '));
}

main()
  .catch(e => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
