import { requireModule } from '@/modules/registry';
import { checkVersionMeta, KEY_SEP, planVersionTests, type SourceTest, type VersionInput } from '@/lib/apk-versions';
import { canDeleteItem, canUndoDelete, hasCap, UNDO_DELETE_MINUTES } from '@/lib/workflow';
import { undoDeadline } from '@/lib/notifications-core';
import { db } from '../db';
import { ForbiddenError, PausedError } from '../errors';
import { createItemTx, internals, type ChangeActor } from './work-items';
import { notify } from './notifications';

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

/**
 * Delete (deactivate) an APK version: all its tests are archived together, so they leave every list, chart and report.
 * History stays in the database and the actor can undo for 30 minutes from the Inbox.
 */
export async function deleteApkVersion(actor: ChangeActor, workTypeId: string, version: string) {
  if (!canDeleteItem(actor.ctx)) throw new ForbiddenError('You can’t delete APK versions here.');
  return db.$transaction(async tx => {
    const wt = await tx.workType.findUniqueOrThrow({ where: { id: workTypeId } });
    if (wt.key !== MODULE) throw new Error('Versions are only for APK Testing.');
    if (actor.source === 'APP' && wt.state !== 'ACTIVE') throw new PausedError(wt.name);
    const rows = await tx.workItem.findMany({ where: { workTypeId, groupKey: version, archivedAt: null }, select: { id: true } });
    if (!rows.length) throw new Error(`APK version ${version} has no tests to delete.`);
    const ids = rows.map(r => r.id);
    const now = new Date();
    await tx.workItem.updateMany({ where: { id: { in: ids } }, data: { archivedAt: now, version: { increment: 1 } } });
    await tx.syncOutbox.deleteMany({ where: { itemId: { in: ids }, status: 'PENDING' } });
    await tx.workItemEvent.createMany({
      data: ids.map(itemId => ({ itemId, actorId: actor.userId, type: 'FIELD_CHANGED' as const, field: 'archivedAt', fromValue: null, toValue: now.toISOString(), source: actor.source, note: `Deleted with APK version ${version}`, at: now })),
    });
    if (actor.userId && actor.source === 'APP') {
      await notify(tx, actor.userId, {
        kind: 'version.deleted',
        title: `Deleted APK version ${version}`,
        body: `${ids.length} tests removed`,
        href: `/w/${wt.key}/versions`,
        data: { workTypeId, version, deletedAt: now.toISOString(), undoUntil: undoDeadline(now).toISOString() },
      });
    }
    return { count: ids.length, deletedAt: now.toISOString() };
  });
}

/** Undo deleteApkVersion within 30 minutes: only the tests removed by that delete come back. */
export async function restoreApkVersion(actor: ChangeActor, workTypeId: string, version: string, deletedAtIso: string) {
  if (!canDeleteItem(actor.ctx)) throw new ForbiddenError('You can’t restore APK versions here.');
  const deletedAt = new Date(deletedAtIso);
  if (Number.isNaN(deletedAt.getTime())) throw new Error('Unknown delete.');
  if (!canUndoDelete(deletedAt)) throw new Error(`Undo is only possible for ${UNDO_DELETE_MINUTES} minutes after deleting.`);
  return db.$transaction(async tx => {
    const wt = await tx.workType.findUniqueOrThrow({ where: { id: workTypeId } });
    if (actor.source === 'APP' && wt.state !== 'ACTIVE') throw new PausedError(wt.name);
    const rows = await tx.workItem.findMany({ where: { workTypeId, groupKey: version, archivedAt: deletedAt }, select: { id: true } });
    const ids = rows.map(r => r.id);
    const now = new Date();
    if (ids.length) {
      await tx.workItem.updateMany({ where: { id: { in: ids } }, data: { archivedAt: null, version: { increment: 1 } } });
      await tx.workItemEvent.createMany({
        data: ids.map(itemId => ({ itemId, actorId: actor.userId, type: 'FIELD_CHANGED' as const, field: 'archivedAt', fromValue: deletedAt.toISOString(), toValue: null, source: actor.source, note: `Restored with APK version ${version}`, at: now })),
      });
    }
    await tx.notification.updateMany({
      where: { kind: 'version.deleted', data: { path: ['deletedAt'], equals: deletedAtIso } },
      data: { kind: 'version.restored', title: `Restored APK version ${version}`, readAt: now },
    });
    return { count: ids.length };
  });
}
