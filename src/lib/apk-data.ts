/**
 * APK Testing keeps its shared facts in tables: version details on ApkVersion, test case text on ApkTestCase. A test run (WorkItem)
 * only stores its own result (status, tester, comments, bug, remarks, log date, priority) in `data`. These pure helpers
 * merge the shared facts back into one `data` object for reading and split a flat object apart for writing.
 */
import { normalizeDate } from './time';

/** Field key -> ApkVersion column. */
export const VERSION_COLUMNS = { releaseDate: 'releaseDate', apkUrl: 'link', releaseNotes: 'notes' } as const;
/** Field key -> ApkTestCase column. */
export const CASE_COLUMNS = { scenario: 'scenario', expected: 'expected', steps: 'steps', defaultPriority: 'defaultPriority' } as const;

export type VersionField = keyof typeof VERSION_COLUMNS;
export type CaseField = keyof typeof CASE_COLUMNS;

export const isVersionField = (k: string): k is VersionField => k in VERSION_COLUMNS;
export const isCaseField = (k: string): k is CaseField => k in CASE_COLUMNS;

export type ApkVersionRow = { id: string; releaseDate: Date | null; link: string | null; notes: string | null };
export type ApkCaseRow = { id: string; scenario: string | null; expected: string | null; steps: string | null; defaultPriority: string | null };
export type ApkLink = { version: ApkVersionRow; testCase: ApkCaseRow } | null | undefined;

/** The run's own data plus the shared version and test-case fields, as one flat object (ids are added as `_versionId` / `_caseId`). */
export function hydrateApkData(data: Record<string, unknown>, apk: ApkLink): Record<string, unknown> {
  if (!apk) return data;
  const out: Record<string, unknown> = { ...data, _versionId: apk.version.id, _caseId: apk.testCase.id };
  if (apk.version.releaseDate) out.releaseDate = normalizeDate(apk.version.releaseDate);
  if (apk.version.link) out.apkUrl = apk.version.link;
  if (apk.version.notes) out.releaseNotes = apk.version.notes;
  for (const k of Object.keys(CASE_COLUMNS) as CaseField[]) {
    const v = apk.testCase[CASE_COLUMNS[k]];
    if (v) out[k] = v;
  }
  return out;
}

/** A version's own facts as flat field values (the version item has no test case). */
export function hydrateVersion(v: { releaseDate: Date | null; link: string | null; notes: string | null }): Record<string, unknown> {
  return { ...(v.releaseDate ? { releaseDate: normalizeDate(v.releaseDate) } : {}), ...(v.link ? { apkUrl: v.link } : {}), ...(v.notes ? { releaseNotes: v.notes } : {}) };
}

export type SplitApkData = {
  /** What stays on the run. */
  execution: Record<string, unknown>;
  version: { releaseDate?: string; link?: string; notes?: string };
  testCase: { scenario?: string; expected?: string; steps?: string; defaultPriority?: string };
};

const text = (v: unknown) => (v == null ? '' : String(v).trim());

/** Split a flat object (from the importer, the version planner or the sheet) into run data and shared version / test-case facts. */
export function splitApkData(data: Record<string, unknown>): SplitApkData {
  const execution: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) if (!isVersionField(k) && !isCaseField(k) && !k.startsWith('_')) execution[k] = v;
  const version: SplitApkData['version'] = {};
  const date = text(data.releaseDate) ? normalizeDate(data.releaseDate) : '';
  if (date) version.releaseDate = date;
  if (text(data.apkUrl)) version.link = text(data.apkUrl);
  if (text(data.releaseNotes)) version.notes = text(data.releaseNotes);
  const testCase: SplitApkData['testCase'] = {};
  for (const k of ['scenario', 'expected', 'steps'] as const) if (text(data[k])) testCase[k] = text(data[k]);
  // A run's own priority doubles as the test case's default the first time the case is seen.
  const prio = text(data.defaultPriority) || text(data.priority);
  if (prio) testCase.defaultPriority = prio;
  return { execution, version, testCase };
}
