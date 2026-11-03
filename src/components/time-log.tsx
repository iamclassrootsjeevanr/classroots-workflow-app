import { Sheet } from '@/components/sheet';
import { formatDateTime, formatDuration } from '@/lib/time';
import type { LogEntry, LogTotals } from '@/lib/time-log';

const KIND: Record<LogEntry['kind'], string> = {
  created: 'bg-neutral-soft text-muted',
  status: 'bg-info-soft text-info',
  assign: 'bg-neutral-soft text-muted',
  bug: 'bg-bad-soft text-bad',
  remarks: 'bg-ok-soft text-ok',
  comment: 'bg-neutral-soft text-muted',
  field: 'bg-neutral-soft text-muted',
};
const KIND_LABEL: Record<LogEntry['kind'], string> = { created: 'Created', status: 'Status', assign: 'Assigned', bug: 'Bug', remarks: 'Developer', comment: 'Comment', field: 'Detail' };

/** Chronological log of status changes and edits, newest first, with time spent in the previous status. */
export function TimeLog({ entries, totals, tz }: { entries: LogEntry[]; totals: LogTotals; tz: string }) {
  const stat = (label: string, value: string) => (
    <div className="rounded-lg border border-line bg-surface-2/50 px-3 py-2">
      <div className="text-2xs font-medium text-muted">{label}</div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
  const rows = [...entries].reverse();
  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stat('To first result', totals.toFirstResult == null ? '—' : formatDuration(totals.toFirstResult))}
        {stat('Failed', `${totals.failures} time${totals.failures === 1 ? '' : 's'}`)}
        {stat('Waiting for fix', formatDuration(totals.waitingForFix))}
        {stat('Waiting for retest', formatDuration(totals.waitingForRetest))}
      </div>
      <Sheet maxHeight="50vh">
        <table className="sheet">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>What</th>
                <th>Time in status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(e => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap text-xs text-muted tabular-nums">{formatDateTime(e.at, tz)}</td>
                  <td className="whitespace-nowrap text-xs">{e.who}</td>
                  <td className="min-w-64 !whitespace-normal">
                    <span className={`mr-2 rounded-md px-1.5 py-0.5 text-2xs font-semibold ${KIND[e.kind]}`}>{KIND_LABEL[e.kind]}</span>
                    <span className="text-sm">{e.text}</span>
                    {e.detail && <p className="mt-0.5 max-w-xl text-xs whitespace-pre-wrap text-muted">{e.detail}</p>}
                  </td>
                  <td className="whitespace-nowrap text-xs tabular-nums">{e.spent == null ? '—' : formatDuration(e.spent)}</td>
                </tr>
              ))}
            </tbody>
        </table>
      </Sheet>
    </div>
  );
}
