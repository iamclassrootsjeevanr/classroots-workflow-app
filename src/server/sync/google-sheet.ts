/**
 * Two-way sync between Postgres (primary) and a Google Sheet tab.
 *
 * 1. push: pending SyncOutbox cells → sheet (rows created in the app are appended)
 * 2. pull: every sheet row → 3-way diff (sheet now / last snapshot / app now)
 *      sheet-only change → applied in the app as a SHEET event
 *      app-only change   → queued for push
 *      both changed      → app wins, SYNC_CONFLICT event, queued for push
 *      new row           → created
 *      row gone          → item flagged sheetMissing (never auto-deleted)
 */
import type { Prisma, WorkType } from '@prisma/client';
import { requireModule } from '@/modules/registry';
import type { WorkTypeDefinition } from '@/modules/types';
import { diffRow, itemSheetValues, keyColumns, norm, rowKey, sheetRowValues, statusFromSheet, type SheetValues } from '@/lib/sheet-core';
import { dueDateToInstant } from '@/lib/time';
import { db } from '../db';
import { workCalendar } from '../settings';
import { createItemTx, internals, workTypeConfig, type ChangeActor, type NewItem } from '../services/work-items';
import { batchUpdate, readSheet } from './apps-script';

const SHEET_ACTOR: ChangeActor = { userId: null, ctx: null, source: 'SHEET' };

export type SyncResult = { workType: string; pushed: number; pulled: number; created: number; conflicts: number; missing: number; failedPushes: number; skipped?: string };

/**
 * Resolves people by display name (sheet columns hold names). Unknown names become placeholder people
 * (no email, can't sign in), and everyone resolved gets the matching role in this work type so they show up
 * as assignable developers / SMEs.
 */
export class PeopleDirectory {
  private byName = new Map<string, string>();
  private ensured = new Set<string>();
  private roleIds = new Map<string, string>();
  constructor(
    private tx: Prisma.TransactionClient | typeof db,
    private workTypeId: string,
  ) {}
  async load() {
    const [users, roles] = await Promise.all([
      this.tx.user.findMany({ select: { id: true, name: true } }),
      this.tx.accessRole.findMany({ select: { id: true, key: true } }),
    ]);
    for (const u of users) if (u.name) this.byName.set(norm(u.name), u.id);
    for (const r of roles) this.roleIds.set(r.key, r.id);
    return this;
  }
  async resolve(name: string, roleKey: string): Promise<string | null> {
    const key = norm(name);
    if (!key) return null;
    let id = this.byName.get(key);
    if (!id) {
      id = (await this.tx.user.create({ data: { name: name.trim(), active: true } })).id;
      this.byName.set(key, id);
    }
    await this.ensureRole(id, roleKey);
    return id;
  }
  private async ensureRole(userId: string, roleKey: string) {
    const roleId = this.roleIds.get(roleKey);
    const tag = `${userId}:${roleKey}`;
    if (!roleId || this.ensured.has(tag)) return;
    this.ensured.add(tag);
    const where = { workTypeId_userId: { workTypeId: this.workTypeId, userId } };
    const member = await this.tx.workTypeMember.findUnique({ where, include: { roles: true } });
    if (!member) {
      await this.tx.workTypeMember.create({ data: { workTypeId: this.workTypeId, userId, roles: { create: { roleId } } } });
    } else if (!member.roles.length) {
      await this.tx.workTypeMemberRole.create({ data: { workTypeId: this.workTypeId, userId, roleId } });
    }
  }
}

/** Build a new work item from mapped sheet values. */
export async function newItemFromSheet(mod: WorkTypeDefinition, key: string, values: SheetValues, people: PeopleDirectory): Promise<NewItem> {
  const data: Record<string, unknown> = {};
  const item: NewItem = { externalKey: key, title: key, data, sheetSnapshot: values };
  let statusText = '';
  for (const c of mod.sheet?.columns ?? []) {
    const v = values[c.column];
    if (v === undefined) continue;
    switch (c.kind) {
      case 'title':
        item.title = v || key;
        break;
      case 'status':
        statusText = v;
        break;
      case 'assignee':
        item.assigneeId = await people.resolve(v, mod.importRoles?.assignee ?? 'developer');
        break;
      case 'owner':
        item.ownerId = await people.resolve(v, mod.importRoles?.owner ?? 'reviewer');
        break;
      case 'group':
        item.groupKey = v || null;
        break;
      case 'dueAt':
        item.dueAt = v ? dueDateToInstant(v) : null;
        break;
      case 'data':
        if (v !== '') data[c.field] = c.type === 'number' ? Number(v) : v;
        break;
    }
  }
  item.status = statusFromSheet(mod, statusText, Boolean(item.assigneeId)) ?? undefined;
  if (mod.sortOrder) item.sortOrder = mod.sortOrder(data);
  return item;
}

async function push(wt: WorkType, mod: WorkTypeDefinition, tab: string, spreadsheetId?: string) {
  const pending = await db.syncOutbox.findMany({
    where: { status: 'PENDING', attempts: { lt: 10 }, item: { workTypeId: wt.id } },
    include: { item: { select: { externalKey: true, sheetSnapshot: true } } },
    orderBy: { createdAt: 'asc' },
    take: 500,
  });
  if (!pending.length) return { pushed: 0, failed: 0 };
  const result = await batchUpdate(
    tab,
    keyColumns(mod),
    pending.map(p => ({ key: p.item.externalKey, column: p.column, value: p.value })),
    mod.sheet?.updatedAtColumn,
    spreadsheetId,
  );
  const failedKeys = new Set(result.failed.map(f => `${f.key}\u0000${f.column}`));
  let pushed = 0;
  for (const p of pending) {
    const failed = failedKeys.has(`${p.item.externalKey}\u0000${p.column}`);
    if (failed) {
      const err = result.failed.find(f => f.key === p.item.externalKey && f.column === p.column)?.error ?? 'failed';
      await db.syncOutbox.update({ where: { id: p.id }, data: { attempts: { increment: 1 }, lastError: err, status: p.attempts >= 9 ? 'FAILED' : 'PENDING' } });
      continue;
    }
    pushed++;
    await db.$transaction([
      db.syncOutbox.update({ where: { id: p.id }, data: { status: 'SENT', sentAt: new Date(), attempts: { increment: 1 } } }),
      db.$executeRaw`UPDATE "WorkItem" SET "sheetSnapshot" = COALESCE("sheetSnapshot", '{}'::jsonb) || jsonb_build_object(${p.column}::text, ${p.value}::text) WHERE id = ${p.itemId}`,
    ]);
  }
  return { pushed, failed: pending.length - pushed };
}

async function applyFromSheet(
  tx: Prisma.TransactionClient,
  itemId: string,
  mod: WorkTypeDefinition,
  cols: string[],
  sheet: SheetValues,
  people: PeopleDirectory,
  cal: Awaited<ReturnType<typeof workCalendar>>,
) {
  const now = new Date();
  const { loadItem, changeStatusTx, assignTx, saveItem } = internals;
  const colDef = (col: string) => mod.sheet!.columns.find(c => c.column === col)!;

  // Assignment first, so a status change lands on the right person's interval.
  for (const col of cols.filter(c => colDef(c).kind === 'assignee')) {
    const item = await loadItem(tx, itemId);
    await assignTx(tx, item, SHEET_ACTOR, await people.resolve(sheet[col], mod.importRoles?.assignee ?? 'developer'), now, cal);
  }
  for (const col of cols.filter(c => colDef(c).kind === 'status')) {
    const item = await loadItem(tx, itemId);
    const to = statusFromSheet(mod, sheet[col], Boolean(item.assigneeId));
    if (to && to !== item.status) await changeStatusTx(tx, item, SHEET_ACTOR, to, now, cal);
  }

  const rest = cols.filter(c => !['assignee', 'status'].includes(colDef(c).kind));
  if (!rest.length) return;
  const item = await loadItem(tx, itemId);
  const data = { ...((item.data ?? {}) as Record<string, unknown>) };
  const update: Prisma.WorkItemUncheckedUpdateInput = {};
  const events: Prisma.WorkItemEventCreateManyInput[] = [];
  for (const col of rest) {
    const c = colDef(col);
    const v = sheet[col];
    let field = col;
    let before: unknown;
    if (c.kind === 'title') {
      before = item.title;
      update.title = v || item.externalKey;
      field = 'title';
    } else if (c.kind === 'group') {
      before = item.groupKey;
      update.groupKey = v || null;
      field = 'group';
    } else if (c.kind === 'dueAt') {
      before = item.dueAt?.toISOString().slice(0, 10) ?? null;
      update.dueAt = v ? dueDateToInstant(v) : null;
      field = 'dueAt';
    } else if (c.kind === 'owner') {
      before = item.ownerId;
      update.ownerId = await people.resolve(v, mod.importRoles?.owner ?? 'reviewer');
      field = 'owner';
    } else if (c.kind === 'data') {
      before = data[c.field];
      if (v === '') delete data[c.field];
      else data[c.field] = c.type === 'number' ? Number(v) : v;
      field = c.field;
    }
    events.push({ itemId, type: 'FIELD_CHANGED', field, fromValue: before == null ? null : String(before), toValue: v || null, source: 'SHEET', at: now });
  }
  await saveItem(tx, item, { ...update, data: data as Prisma.InputJsonValue });
  await tx.workItemEvent.createMany({ data: events });
}

export async function syncWorkType(workTypeId: string, opts: { force?: boolean } = {}): Promise<SyncResult> {
  const wt = await db.workType.findUniqueOrThrow({ where: { id: workTypeId } });
  const mod = requireModule(wt.key);
  const cfg = workTypeConfig(wt);
  const result: SyncResult = { workType: wt.name, pushed: 0, pulled: 0, created: 0, conflicts: 0, missing: 0, failedPushes: 0 };
  if (!mod.sheet) return { ...result, skipped: 'module has no sheet mapping' };
  if (!cfg.sync?.enabled) return { ...result, skipped: 'sync disabled' };
  if (wt.state !== 'ACTIVE' && !opts.force) return { ...result, skipped: `work type ${wt.state.toLowerCase()}` };
  const tab = cfg.sync.tab || mod.sheet.defaultTab;
  const spreadsheetId = cfg.sync.spreadsheetId || undefined;

  await db.syncState.upsert({ where: { workTypeId }, create: { workTypeId, lastRunAt: new Date() }, update: { lastRunAt: new Date() } });
  try {
    // The old Code.gs only returned assigned rows as display text – syncing against it would lose data.
    let sheet = await readSheet(tab, spreadsheetId);
    if (!sheet.complete) {
      throw new Error('The deployed Apps Script is the old version. Paste apps-script/Code.gs, add the SYNC_TOKEN script property, and deploy a new version.');
    }
    const p = await push(wt, mod, tab, spreadsheetId);
    result.pushed = p.pushed;
    result.failedPushes = p.failed;
    if (p.pushed) sheet = await readSheet(tab, spreadsheetId);

    const cal = await workCalendar();
    const people = await new PeopleDirectory(db, wt.id).load();
    const items = await db.workItem.findMany({
      where: { workTypeId },
      include: { assignee: { select: { name: true } }, owner: { select: { name: true } } },
    });
    const byKey = new Map(items.map(i => [i.externalKey, i]));
    const seen = new Set<string>();

    for (const row of sheet.rows) {
      const key = rowKey(mod, row);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      result.pulled++;
      const values = sheetRowValues(mod, row);
      const item = byKey.get(key);

      if (!item) {
        const input = await newItemFromSheet(mod, key, values, people);
        await db.$transaction(tx => createItemTx(tx, wt, SHEET_ACTOR, input));
        result.created++;
        continue;
      }

      const app = itemSheetValues(mod, {
        title: item.title,
        status: item.status,
        groupKey: item.groupKey,
        dueAt: item.dueAt,
        data: (item.data ?? {}) as Record<string, unknown>,
        assigneeName: item.assignee?.name ?? null,
        ownerName: item.owner?.name ?? null,
      });
      const snapshot = (item.sheetSnapshot ?? null) as SheetValues | null;
      const diff = diffRow(values, snapshot, app);

      await db.$transaction(async tx => {
        if (diff.fromSheet.length) await applyFromSheet(tx, item.id, mod, diff.fromSheet, values, people, cal);
        for (const col of [...diff.toSheet, ...diff.conflicts]) {
          const value = app[col];
          if (value == null) continue;
          await tx.syncOutbox.deleteMany({ where: { itemId: item.id, column: col, status: 'PENDING' } });
          await tx.syncOutbox.create({ data: { itemId: item.id, column: col, value } });
        }
        for (const col of diff.conflicts) {
          await tx.workItemEvent.create({
            data: { itemId: item.id, type: 'SYNC_CONFLICT', field: col, fromValue: values[col], toValue: app[col], source: 'SYSTEM', note: 'Changed in both the app and the sheet – app value kept and re-sent to the sheet.' },
          });
        }
        // New base: what the sheet holds now, except columns still waiting to be pushed.
        const nextSnapshot: SheetValues = { ...(snapshot ?? {}), ...values };
        for (const col of [...diff.toSheet, ...diff.conflicts]) {
          if (snapshot && col in snapshot) nextSnapshot[col] = snapshot[col];
        }
        await tx.workItem.update({ where: { id: item.id }, data: { sheetSnapshot: nextSnapshot, sheetMissing: false } });
      });
      result.conflicts += diff.conflicts.length;
    }

    if (sheet.complete) {
      const missing = items.filter(i => !seen.has(i.externalKey) && !i.archivedAt).map(i => i.id);
      result.missing = missing.length;
      await db.workItem.updateMany({ where: { id: { in: missing } }, data: { sheetMissing: true } });
    }

    await db.syncState.update({
      where: { workTypeId },
      data: {
        lastSuccessAt: new Date(),
        lastError: result.failedPushes ? `${result.failedPushes} cell(s) failed to push` : null,
        pulled: result.pulled,
        created: result.created,
        pushed: result.pushed,
        conflicts: result.conflicts,
        missing: result.missing,
      },
    });
    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.syncState.update({ where: { workTypeId }, data: { lastError: message } });
    throw e;
  }
}

export async function syncAll(opts: { force?: boolean } = {}) {
  const types = await db.workType.findMany({ where: { state: { not: 'ARCHIVED' } } });
  const results: (SyncResult | { workType: string; error: string })[] = [];
  for (const wt of types) {
    try {
      results.push(await syncWorkType(wt.id, opts));
    } catch (e) {
      results.push({ workType: wt.name, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return results;
}
