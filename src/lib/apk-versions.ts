/** Plan the tests of a new APK version from an earlier version's test cases. Pure: no DB. */
import { normalizeDate } from './time';

export const KEY_SEP = ' | ';

export type SourceTest = { testCaseId: string; title: string; data: Record<string, unknown> };

export type ExtraCase = { testCaseId: string; title: string; scenario?: string; expected?: string; steps?: string; priority?: string };

export type VersionInput = {
  version: string;
  apkUrl?: string;
  releaseDate?: string;
  releaseNotes?: string;
  /** Test case ids to copy from the source version. */
  includeCaseIds: string[];
  extraCases: ExtraCase[];
  assigneeId: string | null;
};

export type PlannedTest = {
  externalKey: string;
  title: string;
  groupKey: string;
  assigneeId: string | null;
  data: Record<string, unknown>;
};

/** Fields copied from the source test; everything else (bug, comments, remarks, log date) starts empty. */
const COPIED = ['scenario', 'expected', 'steps', 'priority'] as const;

export function checkVersionMeta(input: Pick<VersionInput, 'version' | 'apkUrl' | 'releaseDate'>) {
  const version = input.version.trim();
  if (!version) throw new Error('APK version is required');
  if (version.includes('|')) throw new Error('APK version cannot contain "|"');
  const apkUrl = (input.apkUrl ?? '').trim();
  if (apkUrl && !/^https?:\/\//i.test(apkUrl)) throw new Error('APK link must start with http:// or https://');
  const releaseDate = input.releaseDate?.trim() ? normalizeDate(input.releaseDate) : '';
  if (input.releaseDate?.trim() && !releaseDate) throw new Error('Release date must be a date');
  return { version, apkUrl, releaseDate: releaseDate ?? '' };
}

export function planVersionTests(source: SourceTest[], input: VersionInput): PlannedTest[] {
  const { version, apkUrl, releaseDate } = checkVersionMeta(input);
  const notes = (input.releaseNotes ?? '').trim();
  const byCase = new Map(source.map(s => [s.testCaseId.trim(), s]));
  const seen = new Set<string>();
  const out: PlannedTest[] = [];

  const add = (testCaseId: string, title: string, fields: Record<string, unknown>) => {
    const id = testCaseId.trim();
    if (!id) throw new Error('Every test case needs an ID');
    if (id.includes('|')) throw new Error(`Test case ${id} cannot contain "|"`);
    if (seen.has(id)) throw new Error(`Test case ${id} appears twice`);
    seen.add(id);
    const data: Record<string, unknown> = { testCaseId: id };
    for (const k of COPIED) {
      const v = String(fields[k] ?? '').trim();
      if (v) data[k] = v;
    }
    if (releaseDate) data.releaseDate = releaseDate;
    if (apkUrl) data.apkUrl = apkUrl;
    if (notes) data.releaseNotes = notes;
    out.push({ externalKey: `${version}${KEY_SEP}${id}`, title: title.trim() || id, groupKey: version, assigneeId: input.assigneeId, data });
  };

  for (const raw of input.includeCaseIds) {
    const s = byCase.get(raw.trim());
    if (!s) throw new Error(`Test case ${raw} is not in the version you copy from`);
    add(s.testCaseId, s.title, s.data);
  }
  for (const c of input.extraCases) add(c.testCaseId, c.title, c);
  if (!out.length) throw new Error('Add at least one test case');
  return out;
}
