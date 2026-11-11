import 'server-only';
import type { Prisma, WorkType } from '@prisma/client';
import { CASE_COLUMNS, VERSION_COLUMNS, isCaseField, isVersionField, splitApkData, type ApkLink } from '@/lib/apk-data';
import { normalizeDate } from '@/lib/time';

type Tx = Prisma.TransactionClient;

/** Relation to load with a WorkItem so its shared version / test-case facts can be merged into `data`. */
export const APK_INCLUDE = {
  apkTest: {
    select: {
      version: { select: { id: true, releaseDate: true, link: true, notes: true } },
      testCase: { select: { id: true, scenario: true, expected: true, steps: true, defaultPriority: true } },
    },
  },
} satisfies Prisma.WorkItemInclude;

export type WithApk = { apkTest: ApkLink };

const dateOnly = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/**
 * Before a run is created: make sure its version and test case exist (creating them, or filling facts they are still missing),
 * and return the data that stays on the run. `link` ties the created item to them.
 */
export async function prepareApkCreate(tx: Tx, wt: Pick<WorkType, 'id'>, input: { title: string; groupKey?: string | null; data?: Record<string, unknown> }) {
  const flat = input.data ?? {};
  const code = String(flat.testCaseId ?? '').trim();
  const versionKey = (input.groupKey ?? '').trim();
  if (!code || !versionKey) return { data: flat, link: async (_itemId: string) => {} };
  const { execution, version, testCase } = splitApkData(flat);

  let v = await tx.apkVersion.findUnique({ where: { workTypeId_key: { workTypeId: wt.id, key: versionKey } } });
  if (!v) {
    v = await tx.apkVersion.create({ data: { workTypeId: wt.id, key: versionKey, releaseDate: version.releaseDate ? dateOnly(version.releaseDate) : null, link: version.link ?? null, notes: version.notes ?? null } });
  } else {
    const fill: Prisma.ApkVersionUpdateInput = {};
    if (!v.releaseDate && version.releaseDate) fill.releaseDate = dateOnly(version.releaseDate);
    if (!v.link && version.link) fill.link = version.link;
    if (!v.notes && version.notes) fill.notes = version.notes;
    if (v.archivedAt) fill.archivedAt = null;
    if (Object.keys(fill).length) v = await tx.apkVersion.update({ where: { id: v.id }, data: fill });
  }

  let c = await tx.apkTestCase.findUnique({ where: { workTypeId_code: { workTypeId: wt.id, code } } });
  if (!c) {
    c = await tx.apkTestCase.create({ data: { workTypeId: wt.id, code, title: input.title || code, ...testCase } });
  } else {
    const fill: Prisma.ApkTestCaseUpdateInput = {};
    for (const k of ['scenario', 'expected', 'steps', 'defaultPriority'] as const) if (!c[k] && testCase[k]) fill[k] = testCase[k];
    if (c.archivedAt) fill.archivedAt = null;
    if (Object.keys(fill).length) c = await tx.apkTestCase.update({ where: { id: c.id }, data: fill });
  }

  return {
    data: execution,
    // skipDuplicates: a second run of the same version and case (odd sheet keys) stays unlinked instead of breaking the sync.
    link: async (itemId: string) => {
      await tx.apkTest.createMany({ data: [{ itemId, versionId: v!.id, testCaseId: c!.id }], skipDuplicates: true });
    },
  };
}

/** The version (and test case, for a test result) a work item stands for. A version item has no test case. */
async function resolveApk(tx: Tx, itemId: string): Promise<{ version: { id: string; releaseDate: Date | null; link: string | null; notes: string | null }; testCase: { id: string; scenario: string | null; expected: string | null; steps: string | null; defaultPriority: string | null } | null } | null> {
  const t = await tx.apkTest.findUnique({ where: { itemId }, include: { version: true, testCase: true } });
  if (t) return t;
  const item = await tx.workItem.findUnique({ where: { id: itemId }, select: { workTypeId: true, externalKey: true, parentId: true } });
  if (!item || item.parentId) return null;
  const version = await tx.apkVersion.findUnique({ where: { workTypeId_key: { workTypeId: item.workTypeId, key: item.externalKey } } });
  return version ? { version, testCase: null } : null;
}

/** Current shared values of a run's version and test case, as flat field values (for "before" in the change log). */
export async function currentApkFields(tx: Tx, itemId: string): Promise<Record<string, string>> {
  const t = await resolveApk(tx, itemId);
  if (!t) return {};
  return {
    releaseDate: t.version.releaseDate ? normalizeDate(t.version.releaseDate) : '',
    apkUrl: t.version.link ?? '',
    releaseNotes: t.version.notes ?? '',
    scenario: t.testCase?.scenario ?? '',
    expected: t.testCase?.expected ?? '',
    steps: t.testCase?.steps ?? '',
    defaultPriority: t.testCase?.defaultPriority ?? '',
  };
}

/** Write shared fields (version details, test case text) from a run's edit. They apply to the version / test case, not just this run. */
export async function writeApkFields(tx: Tx, itemId: string, patch: Record<string, string | null>) {
  const r = await resolveApk(tx, itemId);
  if (!r) throw new Error('This test is not linked to an APK version and test case yet.');
  const t = { versionId: r.version.id, testCaseId: r.testCase?.id ?? null };
  const version: Prisma.ApkVersionUpdateInput = {};
  const testCase: Prisma.ApkTestCaseUpdateInput = {};
  for (const [k, v] of Object.entries(patch)) {
    if (isVersionField(k)) {
      const col = VERSION_COLUMNS[k];
      version[col === 'releaseDate' ? 'releaseDate' : col] = col === 'releaseDate' ? (v ? dateOnly(v) : null) : v;
    } else if (isCaseField(k)) testCase[CASE_COLUMNS[k]] = v;
  }
  if (Object.keys(version).length) await tx.apkVersion.update({ where: { id: t.versionId }, data: version });
  if (Object.keys(testCase).length && t.testCaseId) await tx.apkTestCase.update({ where: { id: t.testCaseId }, data: testCase });
}
