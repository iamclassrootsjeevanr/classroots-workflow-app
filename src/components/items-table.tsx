import Link from 'next/link';
import { getModule } from '@/modules/registry';
import { formatDate } from '@/lib/time';
import type { ItemRow } from '@/server/services/analytics';
import { AssignSelect, StatusSelect, type PersonOption, type StatusOption } from './controls';
import { Delay, Empty, StatusBadge } from './ui';

type Props = {
  items: ItemRow[];
  statusOptions?: Map<string, StatusOption[]>;
  people?: PersonOption[];
  showWorkType?: boolean;
  showAssignee?: boolean;
  groupByChapter?: boolean;
  tz: string;
  empty?: string;
  /** Work type keys whose item pages the viewer may open; others render as plain text. Default: all. */
  linkable?: ReadonlySet<string>;
  /** Column names for this work type (mixed lists keep the defaults). */
  labels?: { assignee?: string; owner?: string };
};

const LINK_FIELDS: Record<string, string> = { cmsUrl: 'CMS', aiTutorUrl: 'AI Tutor', buildUrl: 'Build', apkUrl: 'APK' };

/** Work items with inline status changes. A table on wide screens, stacked cards on phones. */
export function ItemsTable({ items, statusOptions, people, showWorkType, showAssignee = true, groupByChapter = true, tz, empty, linkable, labels }: Props) {
  if (!items.length) return <Empty>{empty ?? 'Nothing here yet.'}</Empty>;
  const assigneeLabel = labels?.assignee ?? 'Developer';
  const ownerLabel = labels?.owner ?? 'SME';
  const cols = 7 + (showWorkType ? 1 : 0) + (showAssignee ? 1 : 0);
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
    people ? <AssignSelect compact={compact} itemId={it.id} assigneeId={it.assigneeId} people={people} /> : (it.assigneeName ?? <span className="text-muted">Unassigned</span>);
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
              <div className="rounded-xl border border-line bg-white p-3.5 shadow-[var(--shadow-card)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono text-[11px] text-muted">
                      {it.externalKey}
                      {showWorkType && <span className="ml-1.5 font-sans">· {it.workTypeName}</span>}
                      {it.sheetMissing && (
                        <span className="ml-1 text-warn" title="Not found in the Google Sheet on the last sync">
                          ⚠
                        </span>
                      )}
                    </div>
                    {title(it, 'mt-0.5 block text-[15px] leading-snug font-medium')}
                  </div>
                  <span className="shrink-0 text-xs">{it.category === 'done' && !it.completedAt ? '' : <Delay days={it.delay} />}</span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                  <div>
                    <dt className="text-muted">Status</dt>
                    <dd className="mt-0.5">{status(it, false)}</dd>
                  </div>
                  {showAssignee && (
                    <div>
                      <dt className="text-muted">{assigneeLabel}</dt>
                      <dd className="mt-0.5 text-sm">{assignee(it, false)}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-muted">{ownerLabel}</dt>
                    <dd className="mt-0.5 text-sm">{it.ownerName ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Expected</dt>
                    <dd className="mt-0.5 text-sm">{formatDate(it.dueAt, tz) || '—'}</dd>
                  </div>
                </dl>
                {(links.length > 0 || it.reviewRounds > 1) && (
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-2.5 text-xs">
                    {links.map(([k, label]) => (
                      <a key={k} className="link" href={String(it.data[k])} target="_blank" rel="noopener noreferrer">
                        {label} ↗
                      </a>
                    ))}
                    {it.reviewRounds > 1 && <span className="text-muted">{it.reviewRounds} review rounds</span>}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Wider screens: table */}
      <div className="hidden max-h-[70vh] overflow-auto rounded-lg border border-line md:block">
        <table className="table">
          <thead>
            <tr>
              {showWorkType && <th>Work type</th>}
              <th>Key</th>
              <th>Title</th>
              <th>{ownerLabel}</th>
              {showAssignee && <th>{assigneeLabel}</th>}
              <th>Status</th>
              <th>Expected</th>
              <th>Delay</th>
              <th>Links</th>
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
                    <td colSpan={cols} className="bg-brand-soft/50 text-xs font-semibold text-brand">
                      {g || 'No chapter'}
                    </td>
                  </tr>
                ),
                <tr key={it.id}>
                  {showWorkType && <td className="text-xs text-muted">{it.workTypeName}</td>}
                  <td className="font-mono text-xs whitespace-nowrap">
                    {canOpen(it) ? (
                      <Link className="link" href={`/w/${it.workTypeKey}/${it.id}`}>
                        {it.externalKey}
                      </Link>
                    ) : (
                      it.externalKey
                    )}
                    {it.sheetMissing && (
                      <span className="ml-1 text-[10px] text-warn" title="Not found in the Google Sheet on the last sync">
                        ⚠ sheet
                      </span>
                    )}
                  </td>
                  <td className="min-w-48">
                    {title(it, '')}
                    {it.reviewRounds > 1 && <span className="ml-1.5 text-[11px] text-muted">· {it.reviewRounds} review rounds</span>}
                  </td>
                  <td className="whitespace-nowrap text-muted">{it.ownerName ?? '—'}</td>
                  {showAssignee && <td className="whitespace-nowrap">{assignee(it, true)}</td>}
                  <td>{status(it, true)}</td>
                  <td className="whitespace-nowrap text-muted">{formatDate(it.dueAt, tz) || '—'}</td>
                  <td className="whitespace-nowrap text-xs">{it.category === 'done' && !it.completedAt ? '—' : <Delay days={it.delay} />}</td>
                  <td className="whitespace-nowrap text-xs">
                    {links.length ? (
                      links.map(([k, label]) => (
                        <a key={k} className="link mr-2" href={String(it.data[k])} target="_blank" rel="noopener noreferrer">
                          {label}
                        </a>
                      ))
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                    {!getModule(it.workTypeKey) && <span className="text-bad">module missing</span>}
                  </td>
                </tr>,
              ];
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
