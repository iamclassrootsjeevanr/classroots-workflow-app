import { Prisma } from '@prisma/client';
import type { StatusCategory, WorkTypeDefinition } from '@/modules/types';
import { inList } from './items-url';
import { searchWords } from './search';
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
  /** The developer of the handoff slot. */
  developer?: string;
  /** A person in any role on the item: assignee, SME reviewer or developer (Overview and Reports). */
  user?: string;
  /** The assignee or the developer: the items in a person's "My work". */
  holder?: string;
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
function person(field: 'assigneeId' | 'ownerId' | 'developerId', value: string | undefined): Prisma.WorkItemWhereInput | null {
  const ids = list(value);
  if (!ids.length) return null;
  const real = ids.filter(i => i !== NONE);
  const parts: Prisma.WorkItemWhereInput[] = [...(real.length ? [{ [field]: { in: real } }] : []), ...(ids.includes(NONE) ? [{ [field]: null }] : [])];
  return parts.length === 1 ? parts[0] : { OR: parts };
}

/** The search box (see `searchWords`): every word in a key, a title, the chapter name or the name of someone on the item. */
export function searchWhere(value: string | undefined, bySteward: (word: string) => Prisma.WorkItemWhereInput[] = () => []): Prisma.WorkItemWhereInput | null {
  const words = searchWords(value).map(w => {
    const has = { contains: w, mode: 'insensitive' as const };
    return { OR: [{ externalKey: has }, { groupKey: has }, { title: has }, { chapter: { title: has } }, { assignee: { name: has } }, { owner: { name: has } }, { developer: { name: has } }, ...bySteward(w)] };
  });
  return words.length ? { AND: words } : null;
}

/** Items a person is on in any role: assignee, SME reviewer or developer. */
export function userWhere(value: string | undefined): Prisma.WorkItemWhereInput | null {
  const parts = [person('assigneeId', value), person('ownerId', value), person('developerId', value)].filter((p): p is Prisma.WorkItemWhereInput => Boolean(p));
  return parts.length ? { OR: parts } : null;
}

/** Items a person has to work on: assignee or developer (My dashboard's "My work" tiles). */
export function holderWhere(value: string | undefined): Prisma.WorkItemWhereInput | null {
  const parts = [person('assigneeId', value), person('developerId', value)].filter((p): p is Prisma.WorkItemWhereInput => Boolean(p));
  return parts.length ? { OR: parts } : null;
}

/** The select fields of a work type that live in the item's data: the ones a column title can filter. */
export const dataSelectFields = (mod: WorkTypeDefinition) => mod.fields.filter(f => f.type === 'select' && f.source === 'data' && f.options?.length);

const keysOf = (mod: WorkTypeDefinition, test: (cat: StatusCategory) => boolean) => mod.statuses.filter(s => test(s.category)).map(s => s.key);

/** The database filter for the Items page: the same rules the page used to apply in memory, now run by Postgres. */
export function itemsWhere(mod: WorkTypeDefinition, f: ItemsFilters, userId: string, now: Date = new Date(), teams: readonly TeamLite[] = [], bySteward?: (word: string) => Prisma.WorkItemWhereInput[]): Prisma.WorkItemWhereInput {
  const and: Prisma.WorkItemWhereInput[] = [];
  if (f.status) and.push({ status: { in: mod.statuses.map(s => s.key).filter(k => inList(k, f.status)) } });
  if (f.cat) and.push({ status: { in: keysOf(mod, c => inList(c, f.cat)) } });
  for (const p of [person('assigneeId', f.dev), person('ownerId', f.sme), person('developerId', f.developer)]) if (p) and.push(p);
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
  for (const w of [userWhere(f.user), holderWhere(f.holder), searchWhere(f.q, bySteward)]) if (w) and.push(w);
  if (f.team) {
    const picked = teams.filter(t => list(f.team).includes(t.id));
    and.push(picked.length ? { assigneeId: { in: [...new Set(picked.flatMap(teamPeople))] } } : { id: '__none__' });
  }
  if (f.scope === 'mine') and.push({ OR: [{ assigneeId: userId }, { ownerId: userId }, ...(mod.developerHandoff ? [{ developerId: userId }] : [])] });
  // My team: the items of the team I coordinate or belong to.
  if (f.scope === 'team') {
    const mine = teams.filter(t => t.coordinatorId === userId);
    const list = mine.length ? mine : [teamOf(teams, userId)].filter((t): t is TeamLite => Boolean(t));
    and.push(list.length ? { assigneeId: { in: [...new Set(list.flatMap(teamPeople))] } } : { id: '__none__' });
  }
  if (f.scope === 'review') and.push({ status: { in: keysOf(mod, c => c === 'review') } });
  // The same rule as the Overdue tiles (`isOverdue`): where the due date ends at approval, an approved item is not overdue.
  if (f.scope === 'overdue') and.push({ dueAt: { lt: now }, status: { notIn: keysOf(mod, c => c === 'done') }, ...(mod.dueEndsAt === 'approved' ? { approvedAt: null } : {}) });
  return and.length ? { AND: and } : {};
}

