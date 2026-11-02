import { requireModule } from '@/modules/registry';
import { checkVersionMeta, KEY_SEP, planVersionTests, type SourceTest, type VersionInput } from '@/lib/apk-versions';
import { hasCap } from '@/lib/workflow';
import { db } from '../db';
import { ForbiddenError, PausedError } from '../errors';
import { createItemTx, internals, type ChangeActor } from './work-items';

const MODULE = 'apk-testing';

export type NewVersionInput = Omit<VersionInput, 'includeCaseIds'> & { copyFrom?: string; includeCaseIds: string[] };

/** Add an APK version: its tests are copied from an earlier version (as Not Tested) plus any extra cases. */
export async function createApkVersion(actor: ChangeActor, workTypeId: string, input: NewVersionInput) {
  if (actor.ctx && !hasCap(actor.ctx, 'create')) throw new ForbiddenError('You don’t have permission to add APK versions.');
  if (actor.ctx && input.assigneeId && input.assigneeId !== actor.userId && !hasCap(actor.ctx, 'assign')) {
    throw new ForbiddenError('You don’t have permission to assign work here.');
  }
  const { version } = checkVersionMeta(input);
  return db.$transaction(async tx => {
    const wt = await tx.workType.findUniqueOrThrow({ where: { id: workTypeId } });
    if (wt.key !== MODULE) throw new Error('New versions are only for APK Testing.');
    if (actor.source === 'APP' && wt.state !== 'ACTIVE') throw new PausedError(wt.name);
    const clash = await tx.workItem.findFirst({
      where: { workTypeId, OR: [{ groupKey: version }, { externalKey: { startsWith: `${version}${KEY_SEP}` } }] },
      select: { id: true },
    });
    if (clash) throw new Error(`APK version ${version} already exists`);
    const sourceRows = input.copyFrom
      ? await tx.workItem.findMany({ where: { workTypeId, groupKey: input.copyFrom, archivedAt: null }, select: { title: true, data: true } })
      : [];
    const source: SourceTest[] = sourceRows.map(r => {
      const data = (r.data ?? {}) as Record<string, unknown>;
      return { testCaseId: String(data.testCaseId ?? ''), title: r.title, data };
    });
    const planned = planVersionTests(source.filter(s => s.testCaseId), input);
    const mod = requireModule(MODULE);
    for (const t of planned) {
      const item = await createItemTx(tx, wt, actor, {
        externalKey: t.externalKey,
        title: t.title,
        groupKey: t.groupKey,
        assigneeId: t.assigneeId,
        data: t.data,
        sortOrder: mod.sortOrder?.(t.data) ?? 0,
      });
      await internals.enqueue(tx, item.id, wt, mod, actor, (mod.sheet?.columns ?? []).filter(c => c.kind !== 'key').map(c => c.column));
    }
    return { version, count: planned.length };
  });
}

export type VersionMeta = { apkUrl?: string; releaseDate?: string; releaseNotes?: string };

/** Change the APK link, release date or notes on every test of a version. */
export async function updateApkVersion(actor: ChangeActor, workTypeId: string, version: string, meta: VersionMeta) {
  if (actor.ctx && !hasCap(actor.ctx, 'create') && !hasCap(actor.ctx, 'manageFields')) throw new ForbiddenError('You don’t have permission to edit APK versions.');
  const { apkUrl, releaseDate } = checkVersionMeta({ version, apkUrl: meta.apkUrl, releaseDate: meta.releaseDate });
  const patch = { apkUrl: apkUrl || null, releaseDate: releaseDate || null, releaseNotes: (meta.releaseNotes ?? '').trim() || null };
  return db.$transaction(async tx => {
    const wt = await tx.workType.findUniqueOrThrow({ where: { id: workTypeId } });
    if (wt.key !== MODULE) throw new Error('Versions are only for APK Testing.');
    if (actor.source === 'APP' && wt.state !== 'ACTIVE') throw new PausedError(wt.name);
    const rows = await tx.workItem.findMany({ where: { workTypeId, groupKey: version, archivedAt: null }, select: { id: true } });
    if (!rows.length) throw new Error(`APK version ${version} has no tests`);
    const now = new Date();
    for (const r of rows) {
      const item = await internals.loadItem(tx, r.id);
      await internals.updateFieldsTx(tx, item, { ...actor, ctx: null }, patch, now);
    }
    return { count: rows.length };
  });
}
