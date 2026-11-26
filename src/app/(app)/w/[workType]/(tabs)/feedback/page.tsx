import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Sheet } from '@/components/sheet';
import { Card, Empty, StatusBadge, ToneChip } from '@/components/ui';
import { severityTone } from '@/lib/feedback';
import { shortKey } from '@/lib/notifications-core';
import { formatDate } from '@/lib/time';
import { getModule } from '@/modules/registry';
import { ticketList, TICKET_LIST_MAX, type TicketRow, type TicketShow } from '@/server/feedback-list';
import { loadWorkTypePage } from '@/server/work-type-page';

export async function generateMetadata({ params }: { params: Promise<{ workType: string }> }) {
  const { workType } = await params;
  const mod = getModule(workType);
  return { title: mod ? `${mod.name} · ${mod.pages?.feedback ?? 'Feedback'}` : 'Work' };
}

const SHOWS: { value: TicketShow; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
  { value: 'all', label: 'All' },
];

/**
 * Feedback tickets of a work type, for the people who give and take feedback: the tickets waiting on me, then the ones I raised.
 * An admin also gets every ticket. View-only people do not see this tab.
 */
export default async function FeedbackPage({ params, searchParams }: { params: Promise<{ workType: string }>; searchParams: Promise<{ show?: string }> }) {
  const { workType: key } = await params;
  const sp = await searchParams;
  const { user, access, wtAccess, mod, wt, scope, tz } = await loadWorkTypePage(key);
  if (!mod.pages?.feedback || !(access.isAdmin || wtAccess.canEdit)) notFound();
  const show: TicketShow = SHOWS.some(s => s.value === sp.show) ? (sp.show as TicketShow) : 'open';

  const [mine, raised, all] = await Promise.all([
    ticketList(wt.id, scope, { toId: user.id }, show),
    ticketList(wt.id, scope, { authorId: user.id }, show),
    access.isAdmin ? ticketList(wt.id, scope, {}, show) : null,
  ]);
  const noun = mod.itemNoun;
  const stage = (status: string) => mod.statuses.find(s => s.key === status);

  const table = (list: { rows: TicketRow[]; total: number }, other: 'From' | 'To' | 'both', empty: string) =>
    list.rows.length ? (
      <>
        <Sheet maxHeight="60vh">
          <table className="sheet">
            <thead>
              <tr>
                <th className="pin">Ticket</th>
                <th>{mod.pages?.items ? mod.pages.items.replace(/s$/, '') : 'Item'}</th>
                <th>Title</th>
                <th>Severity</th>
                {other !== 'To' && <th>From</th>}
                {other !== 'From' && <th>To</th>}
                <th>Stage</th>
                <th>Raised</th>
                <th>Replies</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {list.rows.map(t => {
                const s = stage(t.itemStatus);
                const tone = severityTone(t.severity);
                return (
                  <tr key={t.id}>
                    <td className="pin font-mono text-xs font-medium whitespace-nowrap">
                      <Link className="link" href={`/w/${key}/${t.itemId}/feedback`}>
                        {t.code}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap" data-fv={shortKey(t.itemKey)}>
                      <Link className="link font-mono text-xs" href={`/w/${key}/${t.itemId}`}>
                        {shortKey(t.itemKey)}
                      </Link>
                      {t.itemTitle && t.itemTitle !== t.itemKey && <span className="ml-2 text-xs text-muted">{t.itemTitle}</span>}
                    </td>
                    <td className="max-w-80 truncate" title={t.title}>
                      {t.title}
                    </td>
                    <td data-fv={t.severity ?? 'None'}>{t.severity ? <ToneChip tone={tone === 'bad' ? 'bad' : tone === 'warn' ? 'warn' : 'muted'}>{t.severity}</ToneChip> : <span className="text-muted">—</span>}</td>
                    {other !== 'To' && <td className="whitespace-nowrap">{t.from}</td>}
                    {other !== 'From' && <td className="whitespace-nowrap">{t.to ?? <span className="text-muted">Nobody</span>}</td>}
                    <td className="whitespace-nowrap" data-fv={s?.label ?? t.itemStatus}>
                      {s ? <StatusBadge label={s.label} color={s.color} /> : t.itemStatus}
                    </td>
                    <td className="whitespace-nowrap">{formatDate(t.createdAt, tz)}</td>
                    <td className="tabular-nums">{t.replies}</td>
                    <td data-fv={t.open ? 'Open' : 'Closed'}>
                      <ToneChip tone={t.open ? 'info' : 'ok'}>{t.open ? 'Open' : 'Closed'}</ToneChip>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Sheet>
        {list.total > list.rows.length && (
          <p className="mt-2 text-xs text-muted">
            Showing the newest {TICKET_LIST_MAX} of {list.total}.
          </p>
        )}
      </>
    ) : (
      <Empty>{empty}</Empty>
    );

  const which = show === 'all' ? '' : `${show} `;
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <nav className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5" aria-label="Tickets shown">
          {SHOWS.map(s => (
            <Link
              key={s.value}
              href={`/w/${key}/feedback${s.value === 'open' ? '' : `?show=${s.value}`}`}
              aria-current={show === s.value ? 'page' : undefined}
              className={`rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${show === s.value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}
            >
              {s.label}
            </Link>
          ))}
        </nav>
        <p className="text-xs text-muted">Open a ticket to read it, reply or close it.</p>
      </div>
      <Card title={`Assigned to me (${mine.open} open)`} description={`Tickets raised for you on a ${noun}. Reply on the ticket; the person who raised it closes it.`} className="mb-5">
        {table(mine, 'From', `No ${which}tickets are waiting on you.`)}
      </Card>
      <Card title={`Opened by me (${raised.open} open)`} description="Tickets you raised. Close one when the fix is right." className="mb-5">
        {table(raised, 'To', `You have raised no ${which}tickets.`)}
      </Card>
      {all && (
        <Card title={`All tickets (${all.open} open)`} description={`Every ticket on a ${noun}. Admins only.`} className="mb-5">
          {table(all, 'both', `No ${which}tickets.`)}
        </Card>
      )}
    </>
  );
}
