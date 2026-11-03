import 'server-only';
import type { VersionOption } from '@/components/new-apk-version';
import { db } from '../db';

const natural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

/** APK versions (oldest first) with their link, date and notes, for dialogs and filters. Test cases are loaded when a version is chosen. */
export async function loadVersionOptions(workTypeId: string): Promise<VersionOption[]> {
  const rows = await db.apkVersion.findMany({
    where: { workTypeId, archivedAt: null },
    select: { key: true, releaseDate: true, link: true, notes: true, _count: { select: { tests: { where: { item: { archivedAt: null } } } } } },
  });
  return rows
    .sort((a, b) => natural(a.key, b.key))
    .map(r => ({ name: r.key, releaseDate: r.releaseDate ? r.releaseDate.toISOString().slice(0, 10) : '', apkUrl: r.link ?? '', releaseNotes: r.notes ?? '', caseCount: r._count.tests }));
}

/** The test cases run in one version (for "copy test cases from"). */
export async function loadVersionCases(workTypeId: string, versionKey: string): Promise<{ id: string; title: string }[]> {
  const rows = await db.apkTest.findMany({
    where: { version: { workTypeId, key: versionKey }, item: { archivedAt: null }, testCase: { archivedAt: null } },
    select: { testCase: { select: { code: true } }, item: { select: { title: true } } },
  });
  return rows.map(r => ({ id: r.testCase.code, title: r.item.title })).sort((a, b) => natural(a.id, b.id));
}
