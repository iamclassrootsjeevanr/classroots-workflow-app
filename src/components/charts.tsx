'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const AXIS = { fontSize: 12, fill: 'var(--color-muted)' };
const GRID = 'var(--color-line)';
/** Tooltip + legend follow the theme (Recharts' defaults are white / grey). */
const TOOLTIP = {
  contentStyle: { background: 'var(--color-surface)', border: '1px solid var(--color-line)', borderRadius: 8, color: 'var(--color-ink)', fontSize: 12, boxShadow: 'var(--shadow-pop)' },
  labelStyle: { color: 'var(--color-muted)', marginBottom: 4 },
  itemStyle: { color: 'var(--color-ink)' },
  cursor: { fill: 'var(--color-surface-2)' },
};
const LEGEND = { fontSize: 12, color: 'var(--color-ink)' };
const fmtHours = (v: number) => `${v < 10 ? v.toFixed(1) : Math.round(v)}h`;

export type Slice = { label: string; color: string; count: number };

export function StatusPie({ slices, height = 260 }: { slices: Slice[]; height?: number }) {
  const total = slices.reduce((s, x) => s + x.count, 0);
  if (!total) return <p className="py-10 text-center text-sm text-muted">No items yet.</p>;
  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={slices} dataKey="count" nameKey="label" innerRadius="55%" outerRadius="85%" paddingAngle={1} isAnimationActive={false} label={({ value }) => value}>
            {slices.map(s => (
              <Cell key={s.label} fill={s.color} stroke="var(--color-surface)" />
            ))}
          </Pie>
          <Tooltip {...TOOLTIP} cursor={false} formatter={(v: number, n: string) => [`${v} (${Math.round((v / total) * 100)}%)`, n]} />
          <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="fill-ink text-2xl font-semibold">
            {total}
          </text>
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
        {slices.map(s => (
          <span key={s.label} className="inline-flex items-center gap-1.5 text-xs text-ink">
            <i className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label} <b className="tabular-nums">{s.count}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

/** One bar per person, stacked by status. */
export function StackedByPerson({ rows, series, height = 280, labelWidth = 90 }: { rows: Record<string, string | number>[]; series: Slice[]; height?: number; /** Room for the category labels (longer for APK versions). */ labelWidth?: number }) {
  if (!rows.length) return <p className="py-10 text-center text-sm text-muted">No assigned work.</p>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" allowDecimals={false} tick={AXIS} />
        <YAxis type="category" dataKey="name" width={labelWidth} tick={{ ...AXIS, fontSize: 11 }} />
        <Tooltip {...TOOLTIP} />
        <Legend wrapperStyle={LEGEND} />
        {series.map(s => (
          <Bar key={s.label} dataKey={s.label} stackId="a" fill={s.color} isAnimationActive={false} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ThroughputChart({ rows, height = 260 }: { rows: { week: string; started: number; submitted: number; completed: number; late: number }[]; height?: number }) {
  const data = rows.map(r => ({ ...r, week: r.week.slice(5) }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ left: -16, right: 8 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="week" tick={AXIS} />
        <YAxis allowDecimals={false} tick={AXIS} />
        <Tooltip {...TOOLTIP} cursor={{ stroke: 'var(--color-line)' }} labelFormatter={l => `Week of ${l}`} />
        <Legend wrapperStyle={LEGEND} />
        <Line type="monotone" dataKey="started" name="Started" stroke="var(--color-chart-2)" strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="submitted" name="Submitted" stroke="var(--color-chart-3)" strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="completed" name="Completed" stroke="var(--color-chart-1)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="late" name="Completed late" stroke="var(--color-chart-4)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Average / p90 business hours per stage. */
export function StageTimeChart({ rows, height = 260 }: { rows: { label: string; color: string; avg: number | null; p90: number | null; count: number }[]; height?: number }) {
  const data = rows.map(r => ({ label: r.label, color: r.color, avg: r.avg == null ? 0 : r.avg / 60, p90: r.p90 == null ? 0 : r.p90 / 60, count: r.count }));
  if (!data.length) return <p className="py-10 text-center text-sm text-muted">No stage history yet – it builds up as work moves.</p>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ left: -8, right: 8 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={{ ...AXIS, fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
        <YAxis tick={AXIS} tickFormatter={fmtHours} />
        <Tooltip {...TOOLTIP} formatter={(v: number, n: string) => [`${v.toFixed(1)} business hours`, n]} />
        <Legend wrapperStyle={LEGEND} />
        <Bar dataKey="avg" name="Average" isAnimationActive={false}>
          {data.map(d => (
            <Cell key={d.label} fill={d.color} />
          ))}
        </Bar>
        <Bar dataKey="p90" name="90th percentile" fill="var(--color-chart-6)" isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MeVsTeamChart({ rows, height = 240 }: { rows: { label: string; me: number | null; team: number | null }[]; height?: number }) {
  if (!rows.length) return <p className="py-10 text-center text-sm text-muted">No stage history yet.</p>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ left: -8, right: 8 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={{ ...AXIS, fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
        <YAxis tick={AXIS} tickFormatter={fmtHours} />
        <Tooltip {...TOOLTIP} formatter={(v: number, n: string) => [`${(v ?? 0).toFixed(1)} business hours`, n]} />
        <Legend wrapperStyle={LEGEND} />
        <Bar dataKey="me" name="Me" fill="var(--color-chart-1)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
        <Bar dataKey="team" name="Team average" fill="var(--color-chart-5)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SimpleBars({ rows, x, y, color = 'var(--color-chart-1)', height = 220, name }: { rows: Record<string, string | number>[]; x: string; y: string; color?: string; height?: number; name?: string }) {
  if (!rows.length) return <p className="py-10 text-center text-sm text-muted">No data yet.</p>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ left: -16, right: 8 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey={x} tick={AXIS} />
        <YAxis allowDecimals={false} tick={AXIS} />
        <Tooltip {...TOOLTIP} />
        <Bar dataKey={y} name={name ?? y} fill={color} radius={[3, 3, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function FunnelBars({ rows, height = 240 }: { rows: { stage: string; count: number }[]; height?: number }) {
  const max = Math.max(1, ...rows.map(r => r.count));
  return (
    <div className="space-y-1.5" style={{ minHeight: height / 2 }}>
      {rows.map((r, i) => (
        <div key={r.stage} className="flex items-center gap-3 text-sm">
          <span className="w-20 shrink-0 text-xs text-muted">{r.stage}</span>
          <div className="h-6 flex-1 rounded-md bg-surface-2">
            <div
              className="flex h-6 items-center justify-end rounded-md pr-2 text-xs font-semibold text-white"
              style={{ width: `${Math.max(4, (r.count / max) * 100)}%`, background: `hsl(${210 - i * 12} 70% ${45 + i * 3}%)` }}
            >
              {r.count}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
