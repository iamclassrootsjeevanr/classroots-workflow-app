import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { CREATION_STAGES, creationStageFor } from '@/lib/journey';
import { requireModule, statusDef } from '@/modules/registry';
import { db } from '../db';
import { env } from '../env';
import { updateFields, type ChangeActor } from './work-items';

/**
 * The journey relay (buildjourneyrelay, driven by Claude): reads journeys and sets their Creation stage, nothing else.
 * Changes are recorded with source RELAY, shown as "Claude" in the history.
 */
const JOURNEY = 'journey-applet';
const RELAY_ACTOR: ChangeActor = { userId: null, ctx: null, source: 'RELAY' };
/** How far back the relay may date a change (it sends the time the stage changed on its side). */
const MAX_BACKDATE_DAYS = 31;

export class RelayError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** True when the request carries `Authorization: Bearer <RELAY_KEY>`. No key configured = the relay API is off. */
export function relayAuthorized(header: string | null): boolean {
  const key = env().RELAY_KEY;
  if (!key || !header?.startsWith('Bearer ')) return false;
  const a = Buffer.from(header.slice(7));
  const b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type RelayJourney = { journey: string; title: string; chapter: string | null; creator: string | null; creationStage: string | null; stage: string; updatedAt: string };

const SELECT = { externalKey: true, title: true, groupKey: true, status: true, data: true, updatedAt: true, assignee: { select: { name: true } } } as const;

function toRelay(item: { externalKey: string; title: string; groupKey: string | null; status: string; data: unknown; updatedAt: Date; assignee: { name: string | null } | null }): RelayJourney {
  const data = (item.data ?? {}) as Record<string, unknown>;
  return {
    journey: item.externalKey,
    title: item.title,
    chapter: item.groupKey,
    creator: item.assignee?.name ?? null,
    creationStage: typeof data.creationStage === 'string' ? data.creationStage : null,
    stage: statusDef(requireModule(JOURNEY), item.status).label,
    updatedAt: item.updatedAt.toISOString(),
  };
}

export async function listRelayJourneys(chapter?: string): Promise<RelayJourney[]> {
  const items = await db.workItem.findMany({
    where: { workType: { key: JOURNEY }, archivedAt: null, ...(chapter ? { groupKey: chapter.trim().toUpperCase() } : {}) },
    select: SELECT,
    orderBy: [{ groupKey: 'asc' }, { sortOrder: 'asc' }],
  });
  return items.map(toRelay);
}

async function findJourney(key: string) {
  const item = await db.workItem.findFirst({ where: { workType: { key: JOURNEY }, externalKey: key.trim().toUpperCase(), archivedAt: null }, select: { id: true, ...SELECT } });
  if (!item) throw new RelayError(`No journey ${key}`, 404);
  return item;
}

export async function getRelayJourney(key: string): Promise<RelayJourney> {
  return toRelay(await findJourney(key));
}

/** Set a journey's Creation stage. `at` = when it changed on the relay (default: now). */
export async function setCreationStage(key: string, stage: unknown, at?: unknown): Promise<RelayJourney & { changed: boolean }> {
  const value = creationStageFor(stage);
  if (!value) throw new RelayError(`stage must be one of: ${CREATION_STAGES.join(', ')}`, 400);
  let when: Date | undefined;
  if (at != null && at !== '') {
    when = new Date(String(at));
    const now = Date.now();
    if (Number.isNaN(when.getTime())) throw new RelayError('at must be an ISO date-time, e.g. 2026-11-05T10:30:00+05:30', 400);
    if (when.getTime() > now + 5 * 60_000) throw new RelayError('at is in the future', 400);
    if (when.getTime() < now - MAX_BACKDATE_DAYS * 86_400_000) throw new RelayError(`at is more than ${MAX_BACKDATE_DAYS} days ago`, 400);
  }
  const item = await findJourney(key);
  const before = toRelay(item);
  if (before.creationStage === value) return { ...before, changed: false };
  if (when) {
    const last = await db.workItemEvent.findFirst({ where: { itemId: item.id }, orderBy: { at: 'desc' }, select: { at: true } });
    // History stays in order: a change is never dated before the journey's last recorded change.
    if (last && when < last.at) when = last.at;
  }
  await updateFields(RELAY_ACTOR, item.id, { creationStage: value }, { at: when });
  return { ...(await getRelayJourney(key)), changed: true };
}
