import type { Prisma } from '@prisma/client';
import type { StatusCategory, WorkTypeDefinition } from '@/modules/types';
import { inList } from './items-url';

/** Filters of the Items page (all optional). `status` and `cat` accept comma lists. */
export type ItemsFilters = { status?: string; cat?: string; dev?: string; sme?: string; group?: string; grade?: string; q?: string; scope?: string };

const keysOf = (mod: WorkTypeDefinition, test: (cat: StatusCategory) => boolean) => mod.statuses.filter(s => test(s.category)).map(s => s.key);

/** The database filter for the Items page: the same rules the page used to apply in memory, now run by Postgres. */
export function itemsWhere(mod: WorkTypeDefinition, f: ItemsFilters, userId: string, now: Date = new Date()): Prisma.WorkItemWhereInput {
  const and: Prisma.WorkItemWhereInput[] = [];
  if (f.status) and.push({ status: { in: mod.statuses.map(s => s.key).filter(k => inList(k, f.status)) } });
  if (f.cat) and.push({ status: { in: keysOf(mod, c => inList(c, f.cat)) } });
  if (f.dev) and.push(f.dev === 'none' ? { assigneeId: null } : { assigneeId: f.dev });
  if (f.sme) and.push({ ownerId: f.sme });
  if (f.group) and.push({ groupKey: f.group });
  if (f.grade) and.push({ chapter: { grade: Number(f.grade) } });
  if (f.q?.trim()) {
    const q = f.q.trim();
    and.push({ OR: [{ externalKey: { contains: q, mode: 'insensitive' } }, { title: { contains: q, mode: 'insensitive' } }, { chapter: { title: { contains: q, mode: 'insensitive' } } }] });
  }
  if (f.scope === 'mine') and.push({ OR: [{ assigneeId: userId }, { ownerId: userId }] });
  if (f.scope === 'review') and.push({ status: { in: keysOf(mod, c => c === 'review') } });
  if (f.scope === 'overdue') and.push({ dueAt: { lt: now }, status: { notIn: keysOf(mod, c => c === 'done') } });
  return and.length ? { AND: and } : {};
}

