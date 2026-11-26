import type { NavIcon } from '@/components/icons';
import type { WorkTypeDefinition } from '@/modules/types';

export type WorkTypeTab = { href: string; label: string; icon: NavIcon };

/** Pages of a work type, from its module definition. Overview is always first. */
export function workTypeTabs(mod: Pick<WorkTypeDefinition, 'key' | 'groupSummary' | 'pages' | 'versions' | 'teams' | 'relayBoard'>, opts: { board?: boolean; /** The person gives or takes feedback here (can make changes), or is an admin. */ feedback?: boolean } = {}): WorkTypeTab[] {
  const base = `/w/${mod.key}`;
  const tabs: WorkTypeTab[] = [{ href: base, label: 'Overview', icon: 'overview' }];
  if (mod.groupSummary) tabs.push({ href: `${base}/versions`, label: mod.pages?.groups ?? `By ${mod.groupSummary.label}`, icon: 'versions' });
  tabs.push({ href: `${base}/items`, label: mod.pages?.items ?? 'Items', icon: 'execution' });
  if (mod.versions) tabs.push({ href: `${base}/cases`, label: mod.pages?.cases ?? 'Cases', icon: 'cases' });
  if (mod.teams) tabs.push({ href: `${base}/teams`, label: mod.pages?.teams ?? 'Teams', icon: 'people' });
  if (mod.relayBoard && opts.board !== false) tabs.push({ href: `${base}/board`, label: mod.pages?.board ?? 'Relay board', icon: 'route' });
  if (mod.pages?.feedback && opts.feedback) tabs.push({ href: `${base}/feedback`, label: mod.pages.feedback, icon: 'tickets' });
  return tabs;
}
