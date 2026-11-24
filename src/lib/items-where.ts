import { Prisma } from '@prisma/client';
import type { StatusCategory, WorkTypeDefinition } from '@/modules/types';
import { inList } from './items-url';
import { teamOf, teamPeople, type TeamLite } from './teams';

/**
 * Filters of the Items page (all optional). Every one but `q`, `scope` and `view` accepts a comma list (any of the values).
 * People filters take user ids, and `none` for nobody. `f_<field>` filters a select field kept in the item's data
 * (`f_creationStage=4 · Build`); `none` there means not set.
 */
export type ItemsFilters = {
  status?: string;
  cat?: string;
  dev?: string;
  sme?: string;
  /** The developer of the handoff slot, and the peer reviewer. */
  developer?: string;
  peer?: string;
  group?: string;
  grade?: string;
  q?: string;
  scope?: string;
  /** Team ids: items assigned to their people. */
  team?: string;
  /** APK Testing: `tests` = list the test results, not the APK versions. */
  view?: string;
} & { [field: `f_${string}`]: string | undefined };

export const NONE = 'none';
const list = (v: string | undefined) => (v ?? '').split(',').map(s => s.trim()).filter(Boolean);

/** A person column: any of the ids, with `none` for nobody. */
function person(field: 'assigneeId' | 'ownerId' | 'developerId' | 'peerReviewerId', value: string | undefined): Prisma.WorkItemWhereInput | null {
  const ids = list(value);
  if (!ids.length) return null;
  const real = ids.filter(i => i !== NONE);
  const parts: Prisma.WorkItemWhereInput[] = [...(real.length ? [{ [field]: { in: real } }] : []), ...(ids.includes(NONE) ? [{ [field]: null }] : [])];
  return parts.length === 1 ? parts[0] : { OR: parts };
}

/** The select fields of a work type that live in the item's data: the ones a column title can filter. */
export const dataSelectFields = (mod: WorkTypeDefinition) => mod.fields.filter(f => f.type === 'select' && f.source === 'data' && f.options?.length);

const keysOf = (mod: WorkTypeDefinition, test: (cat: StatusCategory) => boolean) => mod.statuses.filter(s => test(s.category)).map(s => s.key);

/** The database filter for the Items page: the same rules the page used to apply in memory, now run by Postgres. */
export function itemsWhere(mod: WorkTypeDefinition, f: ItemsFilters, userId: string, now: Date = new Date(), teams: readonly TeamLite[] = []): Prisma.WorkItemWhereInput {
  const and: Prisma.WorkItemWhereInput[] = [];
  if (f.status) and.push({ status: { in: mod.statuses.map(s => s.key).filter(k => inList(k, f.status)) } });
  if (f.cat) and.push({ status: { in: keysOf(mod, c => inList(c, f.cat)) } });
  for (const p of [person('assigneeId', f.dev), person('ownerId', f.sme), person('developerId', f.developer), person('peerReviewerId', f.peer)]) if (p) and.push(p);
  if (f.group) and.push({ groupKey: { in: list(f.group) } });
  if (f.grade) and.push({ chapter: { grade: { in: list(f.grade).map(Number).filter(Number.isFinite) } } });
  for (const field of dataSelectFields(mod)) {
    const want = list(f[`f_${field.key}`]);
    if (!want.length) continue;
    const known = want.filter(v => field.options!.includes(v));
    const parts: Prisma.WorkItemWhereInput[] = known.map(v => ({ data: { path: [field.key], equals: v } }));
    // Not set: the field is missing, null or empty. (NOT any-option would skip a missing field: SQL compares it to NULL.)
    if (want.includes(NONE)) parts.push({ data: { path: [field.key], equals: Prisma.AnyNull } }, { data: { path: [field.key], equals: '' } });
    and.push(parts.length ? { OR: parts } : { id: '__none__' });
  }
  if (f.q?.trim()) {
    const q = f.q.trim();
    and.push({ OR: [{ externalKey: { contains: q, mode: 'insensitive' } }, { title: { contains: q, mode: 'insensitive' } }, { chapter: { title: { contains: q, mode: 'insensitive' } } }] });
  }
  if (f.team) {
    const picked = teams.filter(t => list(f.team).includes(t.id));
    and.push(picked.length ? { assigneeId: { in: [...new Set(picked.flatMap(teamPeople))] } } : { id: '__none__' });
  }
  if (f.scope === 'mine') and.push({ OR: [{ assigneeId: userId }, { ownerId: userId }, ...(mod.teams ? [{ peerReviewerId: userId }] : []), ...(mod.developerHandoff ? [{ developerId: userId }] : [])] });
  // My team: the items of the team I coordinate or belong to.
  if (f.scope === 'team') {
    const mine = teams.filter(t => t.coordinatorId === userId);
    const list = mine.length ? mine : [teamOf(teams, userId)].filter((t): t is TeamLite => Boolean(t));
    and.push(list.length ? { assigneeId: { in: [...new Set(list.flatMap(teamPeople))] } } : { id: '__none__' });
  }
  if (f.scope === 'review') and.push({ status: { in: keysOf(mod, c => c === 'review') } });
  if (f.scope === 'overdue') and.push({ dueAt: { lt: now }, status: { notIn: keysOf(mod, c => c === 'done') } });
  return and.length ? { AND: and } : {};
}

