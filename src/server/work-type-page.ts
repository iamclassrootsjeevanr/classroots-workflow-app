import 'server-only';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { kpis } from '@/lib/analytics-core';
import type { Capability } from '@/lib/access-core';
import { getModule } from '@/modules/registry';
import { requireWorkTypePage, scopeWhere } from './access';
import { db } from './db';
import { appTz } from './settings';
import { loadLiteItems } from './services/analytics';

/** Everything the pages of one work type share, loaded once per request. */
export const loadWorkTypePage = cache(async (key: string) => {
  const { user, access, wt: wtAccess } = await requireWorkTypePage(key, 'items');
  const mod = getModule(key);
  const wt = await db.workType.findUnique({ where: { key } });
  if (!mod || !wt) notFound();
  // Light rows only: this runs on every page of the work type (header, KPIs); pages that list items query their own page.
  const scope = scopeWhere(access, [wtAccess]);
  const items = await loadLiteItems(key, scope);
  const can = (c: Capability) => access.isAdmin || (wtAccess.canEdit && wtAccess.capabilities.has(c));
  return { user, access, wtAccess, mod, wt, items, scope, can, tz: appTz(), editable: wt.state === 'ACTIVE',
    /** Own-data role: sees only their items, so the page must not show colleagues. */
    ownOnly: wtAccess.dataScope === 'OWN' && !access.isAdmin, kpis: kpis(items, new Date()) };
});
