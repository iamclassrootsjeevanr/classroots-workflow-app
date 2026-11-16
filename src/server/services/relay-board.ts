import 'server-only';
import type { Prisma } from '@prisma/client';
import { buildBoard, type BoardInput, type BoardRow } from '@/lib/relay-board';
import { journeyPart } from '@/modules/journey-applet/definition';
import { getModule } from '@/modules/registry';
import { db } from '../db';

/**
 * The relay board for the journeys `scope` lets the viewer see: one row per creator, one column per creation stage.
 * "Since" is the latest relay event that moved the journey (a step or approval; a publish status counts for the review column),
 * else the date it was picked up. Journeys past review (closed and after) leave the board.
 */
export async function loadRelayBoard(workTypeKey: string, scope: Prisma.WorkItemWhereInput, now = new Date()): Promise<{ rows: BoardRow[]; total: number }> {
  const mod = getModule(workTypeKey);
  if (!mod) return { rows: [], total: 0 };
  const items = await db.workItem.findMany({
    where: { archivedAt: null, workType: { key: workTypeKey }, parentId: null, AND: [scope] },
    select: { id: true, externalKey: true, title: true, status: true, assigneeId: true, assignee: { select: { name: true, email: true } }, data: true, firstStartedAt: true, assignedAt: true },
  });
  if (!items.length) return { rows: [], total: 0 };
  const events = await db.relayEvent.findMany({
    where: { itemId: { in: items.map(i => i.id) }, withdrawn: false, kind: { in: ['step', 'approval', 'publish'] } },
    select: { itemId: true, kind: true, what: true, at: true },
    orderBy: { at: 'desc' },
  });
  const latest = new Map<string, { stepAt?: Date; publish?: { status: string; at: Date } }>();
  for (const e of events) {
    const l = latest.get(e.itemId) ?? {};
    latest.set(e.itemId, l);
    if (e.kind === 'publish') l.publish ??= { status: e.what ?? '', at: e.at };
    else l.stepAt ??= e.at;
  }
  const inputs: BoardInput[] = items.map(i => {
    const l = latest.get(i.id);
    const data = (i.data ?? {}) as Record<string, unknown>;
    const part = journeyPart(mod, i.status);
    const publish = l?.publish?.status || null;
    const marked = publish === 'up_for_review' || publish === 'corrections_wip' || publish === 'ready_for_student';
    return {
      id: i.id,
      key: i.externalKey ?? i.title,
      personId: i.assigneeId,
      personName: i.assignee ? (i.assignee.name ?? i.assignee.email) : null,
      creationStage: typeof data.creationStage === 'string' ? data.creationStage : null,
      publishStatus: publish,
      since: (marked ? l?.publish?.at : l?.stepAt) ?? l?.stepAt ?? i.firstStartedAt ?? i.assignedAt ?? null,
      finished: part === 'closed' || part === 'after' || part === 'done',
    };
  });
  const rows = buildBoard(inputs, now);
  return { rows, total: rows.reduce((n, r) => n + r.total, 0) };
}
