import Link from 'next/link';
import type { LoadLevel } from '@/lib/analytics-core';

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode; eyebrow?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-2xs font-semibold tracking-wide text-muted uppercase">{eyebrow}</div>}
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  title,
  description,
  actions,
  children,
  className = '',
  flush,
}: {
  title?: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** No inner padding – for tables that run edge to edge. */
  flush?: boolean;
}) {
  return (
    <section className={`card ${flush ? 'card-flush' : ''} ${className}`}>
      {(title || actions) && (
        <div className={`flex flex-wrap items-start justify-between gap-2 ${flush ? 'border-b border-line px-4 py-3 sm:px-5' : 'mb-4'}`}>
          <div className="min-w-0">
            {title && <h2 className="text-md font-semibold text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

const TONE_TEXT = { ok: 'text-ok', warn: 'text-warn', bad: 'text-bad', brand: 'text-brand' } as const;

export function Kpi({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: keyof typeof TONE_TEXT }) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-surface px-3.5 py-3 shadow-[var(--shadow-card)] sm:px-4 sm:py-3.5">
      <div className="truncate text-xs font-medium text-muted">{label}</div>
      <div className={`mt-1 text-xl font-semibold tracking-tight tabular-nums sm:text-2xl ${tone ? TONE_TEXT[tone] : 'text-ink'}`}>{value}</div>
      {hint && <div className="mt-0.5 truncate text-2xs text-muted sm:text-xs">{hint}</div>}
    </div>
  );
}

export function KpiGrid({ children }: { children: React.ReactNode }) {
  return <div className="mb-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 2xl:grid-cols-7">{children}</div>;
}

/** Coloured status pill; the colour comes from the work type's status definition. */
export function StatusBadge({ label, color }: { label: string; color: string }) {
  return (
    <span className="chip status-chip" style={{ '--status': color } as React.CSSProperties}>
      <i aria-hidden="true" />
      {label}
    </span>
  );
}

/** Soft tone pill (ok / warn / bad / info / muted) with a leading dot. */
export function ToneChip({ tone, children, className = '' }: { tone: 'ok' | 'warn' | 'bad' | 'info' | 'muted'; children: React.ReactNode; className?: string }) {
  const cls = { ok: 'bg-ok-soft text-ok', warn: 'bg-warn-soft text-warn', bad: 'bg-bad-soft text-bad', info: 'bg-info-soft text-info', muted: 'bg-neutral-soft text-muted' }[tone];
  return (
    <span className={`chip ${cls} ${className}`}>
      <i className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {children}
    </span>
  );
}

const LOAD: Record<LoadLevel, { label: string; tone: 'ok' | 'warn' | 'bad' | 'info' | 'muted' }> = {
  idle: { label: 'Idle', tone: 'muted' },
  low: { label: 'Low load', tone: 'ok' },
  normal: { label: 'Normal', tone: 'info' },
  high: { label: 'High load', tone: 'warn' },
  overloaded: { label: 'Overloaded', tone: 'bad' },
};

export function LoadBadge({ level }: { level: LoadLevel }) {
  const l = LOAD[level];
  return <ToneChip tone={l.tone}>{l.label}</ToneChip>;
}

export const loadLabel = (level: LoadLevel) => LOAD[level].label;

export function Empty({ children, icon, action }: { children: React.ReactNode; icon?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-surface-2/40 px-4 py-9 text-center text-sm text-muted">
      {icon && <div className="text-muted/70">{icon}</div>}
      <div>{children}</div>
      {action}
    </div>
  );
}

export function Tabs({ items, active }: { items: { href: string; label: string }[]; active: string }) {
  return (
    <nav className="-mx-4 mb-5 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0" aria-label="Sections">
      {items.map(t => {
        const on = t.href === active;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? 'page' : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${on ? 'border-brand text-ink' : 'border-transparent text-muted hover:bg-surface-2/60 hover:text-ink'}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Delay({ days }: { days: number | null }) {
  if (days == null) return <span className="text-muted">—</span>;
  if (days <= 0) return <span className="text-ok tabular-nums">{days === 0 ? 'Due today' : `${-days}d left`}</span>;
  return <span className="font-medium text-bad tabular-nums">{days}d late</span>;
}

export const pct = (x: number | null | undefined) => (x == null ? '—' : `${Math.round(x * 100)}%`);
