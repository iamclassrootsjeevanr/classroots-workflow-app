import { formatDuration } from '@/lib/time';
import type { CompareRow } from '@/lib/analytics-core';

const fmt = (r: CompareRow, v: number | null) => (v == null ? '—' : r.kind === 'minutes' ? formatDuration(v) : String(v));

/** "You vs team average": two bars per measure and a plain verdict. Only aggregates, never other people. */
export function YouVsTeam({ rows }: { rows: CompareRow[] }) {
  return (
    <ul className="space-y-4">
      {rows.map(r => {
        const max = Math.max(r.me ?? 0, r.team ?? 0) || 1;
        const better = r.me == null || r.team == null || r.me === r.team ? null : r.kind === 'minutes' ? r.me < r.team : r.me > r.team;
        return (
          <li key={r.label}>
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium text-ink">{r.label}</span>
              <span className="text-2xs text-muted">{r.hint}</span>
            </div>
            {(
              [
                ['You', r.me, 'var(--color-brand)'],
                ['Team average', r.team, 'var(--color-muted)'],
              ] as const
            ).map(([who, v, color]) => (
              <div key={who} className="mb-1 flex items-center gap-2 text-xs">
                <span className="w-24 shrink-0 text-muted">{who}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <span className="block h-full rounded-full" style={{ width: `${v == null ? 0 : Math.max(3, (v / max) * 100)}%`, background: color }} />
                </span>
                <span className="w-14 shrink-0 text-right tabular-nums text-ink">{fmt(r, v)}</span>
              </div>
            ))}
            {better !== null && <span className={`text-2xs font-medium ${better ? 'text-ok' : 'text-warn'}`}>{better ? 'Better than the team average' : 'Behind the team average'}</span>}
          </li>
        );
      })}
    </ul>
  );
}
