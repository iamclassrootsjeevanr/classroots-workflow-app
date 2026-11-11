import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { getModule } from '@/modules/registry';
import { itemsUrl, type ItemsFilter } from '@/lib/items-url';
import { PAGE_SIZE } from '@/lib/paging';
import { formatDate, formatDateTime } from '@/lib/time';
import type { WorkTypeDefinition } from '@/modules/types';
import type { ItemRow } from '@/server/services/analytics';
import { AssignSelect, DeleteItemButton, EditItemButton, LinkButton, StatusSelect, type PersonOption, type StatusOption } from './controls';
import { Sheet } from './sheet';
import { Delay, Empty, StatusBadge } from './ui';

type Props = {
  items: ItemRow[];
  statusOptions?: Map<string, StatusOption[]>;
  /** Per item, the fields the viewer may edit; rows with an entry get an Edit button. */
  fieldEdits?: ReadonlySet<string>;
  /** Ids of items the viewer may delete; those rows get a Delete button. */
  deletable?: ReadonlySet<string>;
  people?: PersonOption[];
  /** Ids of items the viewer may assign (default: all, when `people` is given). */
  assignable?: ReadonlySet<string>;
  showWorkType?: boolean;
  showAssignee?: boolean;
  groupByChapter?: boolean;
  tz: string;
  empty?: string;
  /** Work type keys whose item pages the viewer may open; others render as plain text. Default: all. */
  linkable?: ReadonlySet<string>;
  /** Column names for this work type (mixed lists keep the defaults). */
  labels?: { assignee?: string; owner?: string; due?: string };
  /** Hide default columns / add data columns (from the work type definition). */
  table?: WorkTypeDefinition['table'];
};

const LINK_FIELDS: Record<string, string> = { cmsUrl: 'CMS', aiTutorUrl: 'AI Tutor', buildUrl: 'Build', apkUrl: 'APK' };

/** Work items with inline status changes. A table on wide screens, stacked cards on phones. */
export function ItemsTable({ items, statusOptions, fieldEdits, deletable, people, assignable, showWorkType, showAssignee = true, groupByChapter = true, tz, empty, linkable, labels, table }: Props) {
  if (!items.length) return <Empty>{empty ?? 'Nothing here yet.'}</Empty>;
  const assigneeLabel = labels?.assignee ?? 'Developer';
  const ownerLabel = labels?.owner ?? 'SME';
  const dueLabel = labels?.due ?? 'Expected';
  const anyActions = Boolean(fieldEdits?.size || deletable?.size);
  const hide = new Set(table?.hide ?? []);
  const extra = table?.extra ?? [];
  const showOwner = !hide.has('owner');
  const showExpected = !hide.has('expected');
  const showDelay = !hide.has('delay');
  const showUpdated = extra.length > 0;
  const cols = 4 + (showOwner ? 1 : 0) + (showExpected ? 1 : 0) + (showDelay ? 1 : 0) + extra.length + (showUpdated ? 1 : 0) + (showWorkType ? 1 : 0) + (showAssignee ? 1 : 0) + (anyActions ? 1 : 0);
  const text = (it: ItemRow, field: string) => (it.data[field] == null ? '' : String(it.data[field]));
  const rowActions = (it: ItemRow, compact: boolean) => {
    const f = fieldEdits?.has(it.id);
    const canDelete = deletable?.has(it.id);
    if (!f && !canDelete) return null;
    return (
      <span className={compact ? 'row-actions' : 'inline-flex items-center gap-1.5'}>
        {f && <EditItemButton itemId={it.id} itemKey={it.externalKey} title={it.title} compact={compact} />}
        {canDelete && <DeleteItemButton itemId={it.id} itemKey={it.externalKey} compact={compact} />}
      </span>
    );
  };
  /** Keys like "<version> | TC_001" show only the test case when the version is already the group heading. */
  const keyOf = (it: ItemRow) => (it.groupKey && it.externalKey.startsWith(`${it.groupKey} | `) ? it.externalKey.slice(it.groupKey.length + 3) : it.externalKey);
  const groupOf = (it: ItemRow) => (groupByChapter ? [it.groupKey, it.chapterTitle].filter(Boolean).join(' · ') : '');
  const canOpen = (it: ItemRow) => !linkable || linkable.has(it.workTypeKey);
  const linksOf = (it: ItemRow) => Object.entries(LINK_FIELDS).filter(([k]) => typeof it.data[k] === 'string' && it.data[k]);

  const status = (it: ItemRow, compact: boolean) =>
    statusOptions ? (
      <StatusSelect compact={compact} itemId={it.id} version={it.version} current={{ key: it.status, label: it.statusLabel, color: it.statusColor }} options={statusOptions.get(it.id) ?? []} />
    ) : (
      <StatusBadge label={it.statusLabel} color={it.statusColor} />
    );
  const assignee = (it: ItemRow, compact: boolean) =>
    people && (!assignable || assignable.has(it.id)) ? (
      <AssignSelect compact={compact} itemId={it.id} assigneeId={it.assigneeId} people={people} />
    ) : (
      (it.assigneeName ?? <span className="text-muted">Unassigned</span>)
    );
  const title = (it: ItemRow, className: string) =>
    canOpen(it) ? (
      <Link href={`/w/${it.workTypeKey}/${it.id}`} className={`${className} hover:text-brand`}>
        {it.title}
      </Link>
    ) : (
      <span className={className}>{it.title}</span>
    );

  let lastGroup: string | null = null;
  let lastCardGroup: string | null = null;

  return (
    <>
      {/* Phones: one card per item */}
      <ul className="space-y-2 md:hidden">
        {items.map(it => {
          const g = groupOf(it);
          const header = groupByChapter && g !== lastCardGroup;
          lastCardGroup = g;
          const links = linksOf(it);
          return (
            <li key={it.id}>
              {header && <div className="mt-3 mb-1.5 text-xs font-semibold text-brand first:mt-0">{g || 'No chapter'}</div>}
              <div className="rounded-xl border border-line bg-surface p-3.5 shadow-[var(--shadow-card)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono text-2xs text-muted" title={it.externalKey}>
                      {keyOf(it)}
                      {showWorkType && <span className="ml-1.5 font-sans">· {it.workTypeName}</span>}
                      {it.sheetMissing && (
                        <span className="ml-1 inline-flex align-middle text-warn" title="Not found in the Google Sheet on the last sync">
                          <AlertTriangle size={12} aria-hidden="true" />
                        </span>
                      )}
                    </div>
                    {title(it, 'mt-0.5 block text-md leading-snug font-medium text-ink')}
                  </div>
                  {showDelay && <span className="shrink-0 text-xs">{it.category === 'done' && !it.completedAt ? '' : <Delay days={it.delay} finished={Boolean(it.completedAt || it.handedOff)} />}</span>}
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                  <div className="min-w-0">
                    <dt className="text-muted">Status</dt>
                    <dd className="mt-0.5">{status(it, false)}</dd>
                  </div>
                  {showAssignee && (
                    <div className="min-w-0">
                      <dt className="text-muted">{assigneeLabel}</dt>
                      <dd className="mt-0.5 text-sm">{assignee(it, false)}</dd>
                    </div>
                  )}
                  {showOwner && (
                    <div className="min-w-0">
                      <dt className="text-muted">{ownerLabel}</dt>
                      <dd className="mt-0.5 text-sm">{it.ownerName ?? '—'}</dd>
                    </div>
                  )}
                  {showExpected && (
                    <div className="min-w-0">
                      <dt className="text-muted">{dueLabel}</dt>
                      <dd className="mt-0.5 text-sm">{formatDate(it.dueAt, tz) || '—'}</dd>
                    </div>
                  )}
                  {extra
                    .filter(c => text(it, c.field))
                    .map(c => (
                      <div key={c.field} className="col-span-2 min-w-0">
                        <dt className="text-muted">{c.label}</dt>
                        <dd className="mt-0.5 line-clamp-3 text-sm whitespace-pre-wrap">{text(it, c.field)}</dd>
                      </div>
                    ))}
                  {showUpdated && (
                    <div className="col-span-2 min-w-0 text-muted tabular-nums">Updated {formatDateTime(it.updatedAt, tz)}</div>
                  )}
                </dl>
                {(links.length > 0 || it.reviewRounds > 1 || fieldEdits?.has(it.id) || deletable?.has(it.id)) && (
                  <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line pt-2.5 text-xs">
                    {rowActions(it, false)}
                    {links.map(([k, label]) => (
                      <LinkButton key={k} href={String(it.data[k])} label={label} size="xs" />
                    ))}
                    {it.reviewRounds > 1 && <span className="ml-auto text-muted">{it.reviewRounds} review rounds</span>}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Wider screens: table */}
      <Sheet className="hidden md:block">
        <table className="sheet">
          <thead>
            <tr>
              {showWorkType && <th>Work type</th>}
              <th className="pin">Key</th>
              <th>Title</th>
              {showOwner && <th>{ownerLabel}</th>}
              {showAssignee && <th>{assigneeLabel}</th>}
              <th>Status</th>
              {extra.map(c => (
                <th key={c.field}>{c.label}</th>
              ))}
              {showUpdated && <th>Last update</th>}
              {showExpected && <th>{dueLabel}</th>}
              {showDelay && <th>Delay</th>}
              <th>Links</th>
              {anyActions && <th className="pin-end">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {items.map(it => {
              const g = groupOf(it);
              const header = groupByChapter && g !== lastGroup;
              lastGroup = g;
              const links = linksOf(it);
              return [
                header && (
                  <tr key={`g-${it.id}`}>
                    <td colSpan={cols} className="group">
                      <div className="sticky left-3 w-max">{g || 'No chapter'}</div>
                    </td>
                  </tr>
                ),
                <tr key={it.id}>
                  {showWorkType && <td className="text-xs text-muted">{it.workTypeName}</td>}
                  <td className="pin font-mono text-xs">
                    {canOpen(it) ? (
                      <Link className="link" href={`/w/${it.workTypeKey}/${it.id}`} title={it.externalKey}>
                        {keyOf(it)}
                      </Link>
                    ) : (
                      keyOf(it)
                    )}
                    {it.sheetMissing && (
                      <span className="ml-1 inline-flex items-center gap-0.5 align-middle text-[0.625rem] text-warn" title="Not found in the Google Sheet on the last sync">
                        <AlertTriangle size={11} aria-hidden="true" /> sheet
                      </span>
                    )}
                  </td>
                  <td className="min-w-48">
                    <div className="max-w-[28rem] truncate" title={it.title}>
                      {title(it, 'font-medium text-ink')}
                      {it.reviewRounds > 1 && <span className="ml-1.5 text-2xs text-muted">· {it.reviewRounds} review rounds</span>}
                    </div>
                  </td>
                  {showOwner && <td className="whitespace-nowrap text-muted">{it.ownerName ?? '—'}</td>}
                  {showAssignee && <td className="whitespace-nowrap">{assignee(it, true)}</td>}
                  <td>{status(it, true)}</td>
                  {extra.map(c => (
                    <td key={c.field} className="max-w-56 text-xs">
                      {text(it, c.field) ? (
                        <div className="truncate" title={text(it, c.field)}>
                          {text(it, c.field)}
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  ))}
                  {showUpdated && <td className="whitespace-nowrap text-xs text-muted tabular-nums">{formatDateTime(it.updatedAt, tz)}</td>}
                  {showExpected && <td className="whitespace-nowrap text-muted">{formatDate(it.dueAt, tz) || '—'}</td>}
                  {showDelay && <td className="whitespace-nowrap text-xs">{it.category === 'done' && !it.completedAt ? '—' : <Delay days={it.delay} finished={Boolean(it.completedAt || it.handedOff)} />}</td>}
                  <td className="whitespace-nowrap text-xs">
                    {links.length ? (
                      <span className="inline-flex flex-wrap gap-1">
                        {links.map(([k, label]) => (
                          <LinkButton key={k} href={String(it.data[k])} label={label} size="xs" />
                        ))}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                    {!getModule(it.workTypeKey) && <span className="text-bad">module missing</span>}
                  </td>
                  {anyActions && <td className="pin-end">{rowActions(it, true)}</td>}
                </tr>,
              ];
            })}
          </tbody>
        </table>
      </Sheet>
    </>
  );
}

/** Mixed lists: one table per work type, each with that work type's own columns and labels. A single type renders one plain table. */
export function ItemsTables({ items, empty, moreFilter, ...rest }: Omit<Props, 'labels' | 'table' | 'showWorkType'> & { /** Filter for the "open all" link when a list is cut short. */ moreFilter?: ItemsFilter }) {
  if (!items.length) return <Empty>{empty ?? 'Nothing here yet.'}</Empty>;
  const byType = new Map<string, ItemRow[]>();
  for (const it of items) byType.set(it.workTypeKey, [...(byType.get(it.workTypeKey) ?? []), it]);
  const render = (key: string, list: ItemRow[]) => {
    const mod = getModule(key);
    const shown = list.slice(0, PAGE_SIZE);
    return (
      <>
        <ItemsTable {...rest} items={shown} labels={mod?.labels} table={mod?.table} showWorkType={false} empty={empty} />
        {list.length > shown.length && (
          <p className="mt-2 text-xs text-muted">
            Showing the first {shown.length} of {list.length}.{' '}
            <Link className="link" href={itemsUrl(key, moreFilter)}>
              Open all {list.length}
            </Link>
          </p>
        )}
      </>
    );
  };
  if (byType.size === 1) {
    const [[key, list]] = [...byType];
    return render(key, list);
  }
  return (
    <div className="space-y-6">
      {[...byType].map(([key, list]) => (
        <section key={key}>
          <h3 className="mb-2 flex items-baseline gap-2 text-sm font-semibold text-ink">
            {getModule(key)?.name ?? key}
            <span className="text-xs font-normal text-muted">{list.length}</span>
          </h3>
          {render(key, list)}
        </section>
      ))}
    </div>
  );
}
