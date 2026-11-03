import 'server-only';
import type { Prisma } from '@prisma/client';
import { itemsWhere, type ItemsFilters } from '@/lib/items-where';
import { PAGE_SIZE } from '@/lib/paging';
import type { WorkTypeDefinition } from '@/modules/types';
import { db } from '../db';
import { loadItems } from './analytics';

/** One page of the Items list, filtered and counted by the database. */
export async function queryItemsPage(mod: WorkTypeDefinition, scope: Prisma.WorkItemWhereInput, f: ItemsFilters, userId: string, page: number, size = PAGE_SIZE) {
  const where: Prisma.WorkItemWhereInput = { AND: [scope, itemsWhere(mod, f, userId)] };
  const base = { workType: { key: mod.key }, archivedAt: null, ...where };
  const total = await db.workItem.count({ where: base });
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  const rows = await loadItems({ workTypeKeys: [mod.key], where, skip: (current - 1) * size, take: size });
  const from = total ? (current - 1) * size + 1 : 0;
  return { rows, total, page: current, pages, from, to: Math.min(total, current * size) };
}

export type { ItemsFilters };
