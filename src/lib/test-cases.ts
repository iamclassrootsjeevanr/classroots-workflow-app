/** Test-case views over the items of a versioned work type (APK Testing). Pure. */
import { normalizeDate } from './time';

export type CaseItem = {
  id: string;
  groupKey: string | null;
  title: string;
  status: string;
  statusLabel: string;
  statusColor: string;
  data: Record<string, unknown>;
};

const byName = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });
const text = (d: Record<string, unknown>, k: string) => (d[k] == null ? '' : String(d[k]));

export type VersionOptionLite = { name: string; releaseDate: string; apkUrl: string; releaseNotes: string; cases: { id: string; title: string }[] };

/** One entry per version (oldest first) with its link, date, notes and test cases. */
export function versionOptions(items: CaseItem[]): VersionOptionLite[] {
  const groups = new Map<string, CaseItem[]>();
  for (const i of items) if (i.groupKey) groups.set(i.groupKey, [...(groups.get(i.groupKey) ?? []), i]);
  return [...groups]
    .sort(([a], [b]) => byName(a, b))
    .map(([name, list]) => {
      const pick = (k: string) => text(list.find(i => i.data[k])?.data ?? {}, k);
      return {
        name,
        releaseDate: normalizeDate(pick('releaseDate')),
        apkUrl: pick('apkUrl'),
        releaseNotes: pick('releaseNotes'),
        cases: list.filter(i => i.data.testCaseId).map(i => ({ id: String(i.data.testCaseId), title: i.title })),
      };
    });
}

export type CaseRow = {
  id: string;
  title: string;
  scenario: string;
  expected: string;
  steps: string;
  priority: string;
  versions: string[];
  latestVersion: string;
  latestStatus: string;
  latestColor: string;
  /** Test item of the newest version; the one an edit applies to. */
  latestItemId: string;
};

/** One row per test case id. Definition and result come from the newest version that has the case. */
export function rollupCases(items: CaseItem[]): CaseRow[] {
  const byCase = new Map<string, CaseItem[]>();
  for (const i of items) {
    const id = text(i.data, 'testCaseId').trim();
    if (id) byCase.set(id, [...(byCase.get(id) ?? []), i]);
  }
  return [...byCase]
    .map(([id, list]) => {
      const sorted = [...list].sort((a, b) => byName(a.groupKey ?? '', b.groupKey ?? ''));
      const latest = sorted[sorted.length - 1];
      // Newest non-empty value wins, so a definition filled in an older version is not lost.
      const field = (k: string) => [...sorted].reverse().map(i => text(i.data, k)).find(Boolean) ?? '';
      return {
        id,
        title: latest.title,
        scenario: field('scenario'),
        expected: field('expected'),
        steps: field('steps'),
        priority: field('priority'),
        versions: sorted.map(i => i.groupKey ?? '').filter(Boolean),
        latestVersion: latest.groupKey ?? '',
        latestStatus: latest.statusLabel,
        latestColor: latest.statusColor,
        latestItemId: latest.id,
      };
    })
    .sort((a, b) => byName(a.id, b.id));
}
