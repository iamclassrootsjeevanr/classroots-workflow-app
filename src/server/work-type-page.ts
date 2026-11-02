import 'server-only';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { kpis } from '@/lib/analytics-core';
import type { Capability } from '@/lib/access-core';
import { getModule } from '@/modules/registry';
import { requireWorkTypePage, scopeWhere } from './access';
import { db } from './db';
import { appTz } from './settings';
import { loadItems } from './services/analytics';

export type WorkTypeTab = { href: string; label: string };

/** Tabs of a work type, from its module definition. Overview is always first. */
export function workTypeTabs(key: string): WorkTypeTab[] {
  const mod = getModule(key);
  if (!mod) return [];
  const base = `/w/${key}`;
  const tabs: WorkTypeTab[] = [{ href: base, label: 'Overview' }];
  if (mod.groupSummary) tabs.push({ href: `${base}/versions`, label: mod.pages?.groups ?? `By ${mod.groupSummary.label}` });
  tabs.push({ href: `${base}/items`, label: mod.pages?.items ?? 'Items' });
  if (mod.versions) tabs.push({ href: `${base}/cases`, label: mod.pages?.cases ?? 'Cases' });
  return tabs;
}

/** Everything the pages of one work type share, loaded once per request. */
export const loadWorkTypePage = cache(async (key: string) => {
  const { user, access, wt: wtAccess } = await requireWorkTypePage(key, 'items');
  const mod = getModule(key);
  const wt = await db.workType.findUnique({ where: { key } });
  if (!mod || !wt) notFound();
  const items = await loadItems({ workTypeKeys: [key], where: scopeWhere(access, [wtAccess]) });
  const can = (c: Capability) => access.isAdmin || (wtAccess.canEdit && wtAccess.capabilities.has(c));
  return { user, access, wtAccess, mod, wt, items, can, tz: appTz(), editable: wt.state === 'ACTIVE', kpis: kpis(items, new Date()) };
});
