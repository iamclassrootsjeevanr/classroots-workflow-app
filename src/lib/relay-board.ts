/**
 * The relay board: who holds which journey at which creation stage, and how long it has sat there. Pure (no DB).
 * Rows are people, columns are creation stages; stage 5 splits by the relay's publish status. Journeys not started are
 * grouped by grade ("G7 x3") instead of listed.
 */
import { CREATION_STAGES } from './journey';

export type BoardColumnKey = 'new' | 'spine' | 'script' | 'build' | 'ship' | 'review' | 'ready';
export const BOARD_COLUMNS: { key: BoardColumnKey; label: string }[] = [
  { key: 'new', label: 'Not started' },
  { key: 'spine', label: '3a · Spine' },
  { key: 'script', label: '3b · Script' },
  { key: 'build', label: '4 · Build' },
  { key: 'ship', label: '5 · No status' },
  { key: 'review', label: '5 · Review / corrections' },
  { key: 'ready', label: 'Ready' },
];

/** The relay's publish status shown as a letter on a chip: r = up for review, c = corrections. */
export const PUBLISH_MARK: Record<string, 'r' | 'c'> = { up_for_review: 'r', corrections_wip: 'c' };

export type BoardInput = {
  id: string;
  /** Journey key, e.g. G06C07ST3J1. */
  key: string;
  personId: string | null;
  personName: string | null;
  /** The dashboard's Creation stage ("4 · Build", "Published") or empty. */
  creationStage: string | null;
  /** The relay's latest publish status (up_for_review, corrections_wip, ready_from_content) or null. */
  publishStatus: string | null;
  /** When the journey entered its current state (latest relay event, else the pick-up date). */
  since: Date | null;
  /** The review is closed or the journey is published: it leaves the board. */
  finished: boolean;
};

export type BoardChip = { id: string; key: string; days: number | null; tone: 'fresh' | 'mid' | 'old' | 'none'; mark: 'r' | 'c' | null };
export type BoardCell = { chips: BoardChip[]; /** Not-started journeys: count per grade, e.g. G7 x3. */ groups: { label: string; count: number }[] };
export type BoardRow = { personId: string | null; name: string; cells: Record<BoardColumnKey, BoardCell>; total: number };

const DAY_MS = 86_400_000;
export const FRESH_DAYS = 2;
export const OLD_DAYS = 5;

/** Whole days since `since`, never negative. */
export const daysSince = (since: Date | null, now: Date): number | null => (since ? Math.max(0, Math.floor((now.getTime() - since.getTime()) / DAY_MS)) : null);

export const toneOf = (days: number | null): BoardChip['tone'] => (days == null ? 'none' : days <= FRESH_DAYS ? 'fresh' : days >= OLD_DAYS ? 'old' : 'mid');

/** "G06C07ST3J1" → "G6", "G7" for the not-started groups. */
export const gradeLabel = (key: string): string => {
  const m = /^G0?(\d+)/i.exec(key);
  return m ? `G${m[1]}` : 'Other';
};

/** The column a journey sits in. Null = not on the board (finished). */
export function columnOf(i: Pick<BoardInput, 'creationStage' | 'publishStatus' | 'finished'>): BoardColumnKey | null {
  if (i.finished) return null;
  if (i.publishStatus === 'ready_from_content' || i.creationStage === 'Published') return 'ready';
  const stage = CREATION_STAGES.find(s => s === i.creationStage);
  if (stage === '3a · Spine') return 'spine';
  if (stage === '3b · Script') return 'script';
  if (stage === '4 · Build') return 'build';
  if (stage === '5 · Ship') return i.publishStatus && PUBLISH_MARK[i.publishStatus] ? 'review' : 'ship';
  return 'new';
}

const emptyCells = (): Record<BoardColumnKey, BoardCell> =>
  Object.fromEntries(BOARD_COLUMNS.map(c => [c.key, { chips: [], groups: [] } as BoardCell])) as Record<BoardColumnKey, BoardCell>;

/** Group journeys into one row per person, oldest chip first in each cell. People sort by name; nobody-assigned goes last. */
export function buildBoard(inputs: BoardInput[], now: Date): BoardRow[] {
  const rows = new Map<string, BoardRow>();
  for (const i of inputs) {
    const col = columnOf(i);
    if (!col) continue;
    const id = i.personId ?? '';
    const row = rows.get(id) ?? { personId: i.personId, name: i.personName ?? 'Unassigned', cells: emptyCells(), total: 0 };
    rows.set(id, row);
    row.total++;
    const cell = row.cells[col];
    if (col === 'new') {
      const label = gradeLabel(i.key);
      const g = cell.groups.find(x => x.label === label);
      if (g) g.count++;
      else cell.groups.push({ label, count: 1 });
      continue;
    }
    const days = daysSince(i.since, now);
    cell.chips.push({ id: i.id, key: i.key, days, tone: toneOf(days), mark: col === 'review' ? (PUBLISH_MARK[i.publishStatus ?? ''] ?? null) : null });
  }
  for (const r of rows.values()) {
    for (const c of Object.values(r.cells)) {
      c.chips.sort((a, b) => (b.days ?? -1) - (a.days ?? -1) || a.key.localeCompare(b.key));
      c.groups.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
    }
  }
  return [...rows.values()].sort((a, b) => Number(a.personId === null) - Number(b.personId === null) || a.name.localeCompare(b.name));
}

/** Journeys per column across all rows, for the column headers. */
export function columnTotals(rows: BoardRow[]): Record<BoardColumnKey, number> {
  const t = Object.fromEntries(BOARD_COLUMNS.map(c => [c.key, 0])) as Record<BoardColumnKey, number>;
  for (const r of rows) for (const c of BOARD_COLUMNS) t[c.key] += r.cells[c.key].chips.length + r.cells[c.key].groups.reduce((n, g) => n + g.count, 0);
  return t;
}
