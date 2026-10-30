import { loadLevel, type LoadLevel } from '@/lib/analytics-core';

const COLORS: Record<LoadLevel, string> = {
  idle: 'var(--heat-idle)',
  low: 'var(--heat-low)',
  normal: 'var(--heat-normal)',
  high: 'var(--heat-high)',
  overloaded: 'var(--heat-over)',
};

/** Developer × day grid of items on each person's plate, coloured by load vs capacity. */
export function WorkloadHeatmap({
  days,
  rows,
}: {
  days: string[];
  rows: { name: string; capacity: number; counts: number[] }[];
}) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted">No developers yet.</p>;
  const weekday = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-IN', { weekday: 'narrow', timeZone: 'UTC' });
  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-[3px] text-xs">
        <thead>
          <tr>
            <th />
            {days.map(d => (
              <th key={d} className="w-7 text-center font-normal text-muted" title={d}>
                <div>{weekday(d)}</div>
                <div className="text-[0.625rem]">{d.slice(8)}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.name}>
              <td className="pr-2 font-medium whitespace-nowrap">{r.name}</td>
              {r.counts.map((c, i) => {
                const level = loadLevel(c, r.capacity);
                return (
                  <td
                    key={days[i]}
                    className={`h-7 w-7 rounded-md text-center tabular-nums ${c ? 'text-ink' : 'text-muted/60'}`}
                    style={{ background: COLORS[level] }}
                    title={`${r.name} · ${days[i]}: ${c} item(s), capacity ${r.capacity}`}
                  >
                    {c || ''}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex flex-wrap gap-3 text-2xs text-muted">
        {(Object.keys(COLORS) as LoadLevel[]).map(l => (
          <span key={l} className="inline-flex items-center gap-1">
            <i className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[l] }} />
            {l}
          </span>
        ))}
        <span>· counts items queued, in progress, in corrections or on hold that day</span>
      </div>
    </div>
  );
}
