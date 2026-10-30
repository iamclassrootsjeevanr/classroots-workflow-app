/**
 * Pure mapping between work items and sheet rows, plus the 3-way diff used by two-way sync.
 * Values are compared as normalized strings (dates as YYYY-MM-DD).
 */
import type { FieldType, SheetColumn, WorkTypeDefinition } from '@/modules/types';
import { instantToDateKey, normalizeDate } from './time';

export type SheetValues = Record<string, string>;

export const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();

export function normalizeCell(type: FieldType | 'text', v: unknown): string {
  if (v == null) return '';
  if (type === 'date') return normalizeDate(v);
  if (type === 'number') {
    const s = String(v).trim();
    if (!s) return '';
    const n = Number(s);
    // Non-numeric text in a number column (e.g. a formula error) is treated as empty.
    return Number.isFinite(n) ? String(n) : '';
  }
  return String(v).trim();
}

function columnType(c: SheetColumn): FieldType {
  if (c.kind === 'data') return c.type;
  if (c.kind === 'dueAt') return 'date';
  return 'text';
}

/** Mapped (non-key) columns of a module. */
export function syncColumns(mod: WorkTypeDefinition): SheetColumn[] {
  return (mod.sheet?.columns ?? []).filter(c => c.kind !== 'key');
}

export const KEY_SEPARATOR = ' | ';

/** Key column(s); several make a composite key. */
export function keyColumns(mod: WorkTypeDefinition): string[] {
  const cols = (mod.sheet?.columns ?? []).filter(c => c.kind === 'key').map(c => c.column);
  if (!cols.length) throw new Error(`${mod.key} has no sheet key column`);
  return cols;
}

/** External key of a sheet row: the key columns' trimmed values joined with " | ". Empty when any part is missing. */
export function rowKey(mod: WorkTypeDefinition, row: Record<string, unknown>): string {
  const parts = keyColumns(mod).map(c => String(row[c] ?? '').trim());
  return parts.some(p => !p) ? '' : parts.join(KEY_SEPARATOR);
}

/** Normalize a raw sheet row (header → value) to the mapped columns. */
export function sheetRowValues(mod: WorkTypeDefinition, row: Record<string, unknown>): SheetValues {
  const out: SheetValues = {};
  for (const c of syncColumns(mod)) {
    if (c.column in row) out[c.column] = normalizeCell(columnType(c), row[c.column]);
  }
  return out;
}

export type ItemForSheet = {
  title: string;
  status: string;
  groupKey: string | null;
  dueAt: Date | null;
  data: Record<string, unknown>;
  assigneeName: string | null;
  ownerName: string | null;
};

/** What the app currently holds, expressed as sheet values. `null` = not representable (app-only status). */
export function itemSheetValues(mod: WorkTypeDefinition, item: ItemForSheet, tz?: string): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const c of syncColumns(mod)) {
    switch (c.kind) {
      case 'title':
        out[c.column] = item.title.trim();
        break;
      case 'status': {
        const def = mod.statuses.find(s => s.key === item.status);
        out[c.column] = def?.sheetValue === undefined ? def?.label ?? item.status : def.sheetValue;
        break;
      }
      case 'assignee':
        out[c.column] = (item.assigneeName ?? '').trim();
        break;
      case 'owner':
        out[c.column] = (item.ownerName ?? '').trim();
        break;
      case 'group':
        out[c.column] = (item.groupKey ?? '').trim();
        break;
      case 'dueAt':
        out[c.column] = instantToDateKey(item.dueAt, tz);
        break;
      case 'data':
        out[c.column] = normalizeCell(c.type, item.data[c.field]);
        break;
    }
  }
  return out;
}

/** Sheet status text → module status key. '' → initial status; unknown → null. */
export function statusFromSheet(mod: WorkTypeDefinition, value: string, hasAssignee: boolean): string | null {
  const v = norm(value);
  if (!v) return hasAssignee ? mod.assignedStatus : mod.initialStatus;
  const match = mod.statuses.find(s => s.sheetValue != null && norm(s.sheetValue) === v) ?? mod.statuses.find(s => norm(s.label) === v);
  return match?.key ?? null;
}

export type RowDiff = {
  /** sheet changed, app did not → apply sheet value in the app */
  fromSheet: string[];
  /** app changed, sheet did not → write app value to the sheet */
  toSheet: string[];
  /** both changed to different values → app wins (pushed), logged as conflict */
  conflicts: string[];
};

/**
 * 3-way diff per column between the sheet now, the last snapshot both sides agreed on, and the app now.
 * Columns whose app value is null (app-only status) never push and never conflict.
 */
export function diffRow(sheet: SheetValues, snapshot: SheetValues | null, app: Record<string, string | null>): RowDiff {
  const d: RowDiff = { fromSheet: [], toSheet: [], conflicts: [] };
  const base = snapshot ?? {};
  for (const col of Object.keys(app)) {
    const s = sheet[col];
    if (s === undefined) continue; // column not present in this sheet
    const a = app[col];
    const b = base[col];
    if (a === null) {
      if (b !== undefined && s !== b) d.fromSheet.push(col);
      continue;
    }
    if (s === a) continue;
    if (b === undefined) {
      // No common base (first sync of this column): sheet is treated as the truth.
      d.fromSheet.push(col);
    } else if (s !== b && a === b) d.fromSheet.push(col);
    else if (s === b && a !== b) d.toSheet.push(col);
    else d.conflicts.push(col);
  }
  return d;
}
