import Link from 'next/link';
import type { LoadLevel } from '@/lib/analytics-core';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className = '' }: { title?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-[15px] font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Kpi({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: 'ok' | 'warn' | 'bad' | 'brand' }) {
  const color = tone === 'bad' ? 'text-bad' : tone === 'warn' ? 'text-warn' : tone === 'ok' ? 'text-ok' : tone === 'brand' ? 'text-brand' : 'text-ink';
  return (
    <div className="card px-3.5 py-3 sm:px-4 sm:py-3.5">
      <div className="truncate text-xs font-medium text-muted">{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums sm:mt-1.5 sm:text-2xl ${color}`}>{value}</div>
      {hint && <div className="mt-0.5 truncate text-[11px] text-muted sm:text-xs">{hint}</div>}
    </div>
  );
}

export function KpiGrid({ children }: { children: React.ReactNode }) {
  return <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 2xl:grid-cols-7">{children}</div>;
}

export function StatusBadge({ label, color }: { label: string; color: string }) {
  return (
    <span className="chip" style={{ background: `${color}1a`, color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

const LOAD: Record<LoadLevel, { label: string; cls: string }> = {
  idle: { label: 'Idle', cls: 'bg-slate-100 text-slate-600' },
  low: { label: 'Low load', cls: 'bg-emerald-50 text-emerald-700' },
  normal: { label: 'Normal', cls: 'bg-sky-50 text-sky-700' },
  high: { label: 'High load', cls: 'bg-amber-50 text-amber-700' },
  overloaded: { label: 'Overloaded', cls: 'bg-red-50 text-red-700' },
};

export function LoadBadge({ level }: { level: LoadLevel }) {
  const l = LOAD[level];
  return <span className={`chip ${l.cls}`}>{l.label}</span>;
}

export const loadLabel = (level: LoadLevel) => LOAD[level].label;

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed border-line py-8 text-center text-sm text-muted">{children}</div>;
}

export function Tabs({ items, active }: { items: { href: string; label: string }[]; active: string }) {
  return (
    <nav className="-mx-4 mb-5 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
      {items.map(t => (
        <Link
          key={t.href}
          href={t.href}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap ${t.href === active ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink'}`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

export function Delay({ days }: { days: number | null }) {
  if (days == null) return <span className="text-muted">—</span>;
  if (days <= 0) return <span className="text-ok">{days === 0 ? 'Due today' : `${-days}d left`}</span>;
  return <span className="font-medium text-bad">{days}d late</span>;
}

export const pct = (x: number | null | undefined) => (x == null ? '—' : `${Math.round(x * 100)}%`);
