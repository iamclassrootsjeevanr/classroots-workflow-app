import { formatDateTime, formatDuration } from '@/lib/time';

export type TimelineInterval = {
  status: string;
  label: string;
  color: string;
  enteredAt: Date;
  exitedAt: Date | null;
  businessMinutes: number;
  round: number;
  assigneeName: string | null;
};

/** Gantt-style bar of every stage the item went through, with exact date/time and business-hour duration. */
export function StageTimeline({ intervals, now, tz }: { intervals: TimelineInterval[]; now: Date; tz: string }) {
  if (!intervals.length) return <p className="text-sm text-muted">No stage history yet.</p>;
  const start = intervals[0].enteredAt.getTime();
  const end = Math.max(now.getTime(), ...intervals.map(i => (i.exitedAt ?? now).getTime()));
  const span = Math.max(1, end - start);

  return (
    <div>
      <div className="flex h-7 w-full overflow-hidden rounded-md bg-canvas" role="img" aria-label="Stage timeline">
        {intervals.map((iv, idx) => {
          const w = (((iv.exitedAt ?? now).getTime() - iv.enteredAt.getTime()) / span) * 100;
          return (
            <div
              key={idx}
              className="h-full border-r border-surface/70"
              style={{ width: `${Math.max(w, 0.8)}%`, background: iv.color, opacity: iv.exitedAt ? 0.85 : 1 }}
              title={`${iv.label}: ${formatDateTime(iv.enteredAt, tz)} → ${iv.exitedAt ? formatDateTime(iv.exitedAt, tz) : 'now'} (${formatDuration(iv.businessMinutes)} business)`}
            />
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-2xs text-muted">
        <span>{formatDateTime(intervals[0].enteredAt, tz)}</span>
        <span>now</span>
      </div>

      <div className="table-wrap mt-3"><table className="table">
        <thead>
          <tr>
            <th>Stage</th>
            <th>Entered</th>
            <th>Left</th>
            <th>Business time</th>
            <th>Developer</th>
          </tr>
        </thead>
        <tbody>
          {intervals.map((iv, idx) => (
            <tr key={idx}>
              <td className="whitespace-nowrap">
                <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: iv.color }} />
                {iv.label}
                {iv.round > 1 && <span className="ml-1 text-xs text-muted">(round {iv.round})</span>}
              </td>
              <td className="whitespace-nowrap tabular-nums">{formatDateTime(iv.enteredAt, tz)}</td>
              <td className="whitespace-nowrap tabular-nums">{iv.exitedAt ? formatDateTime(iv.exitedAt, tz) : <span className="font-medium text-brand">current</span>}</td>
              <td className="tabular-nums">{formatDuration(iv.businessMinutes)}</td>
              <td className="text-muted">{iv.assigneeName ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
