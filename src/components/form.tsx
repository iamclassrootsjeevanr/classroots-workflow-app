'use client';

import { Check } from 'lucide-react';
import { useId } from 'react';

/* Shared form controls: every tick, radio, switch and segmented control in the app looks the same.
   Rows put the control, the label and its help text on one line and make the whole row clickable. */

export function OptionList({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface ${className}`}>{children}</div>;
}

type RowProps = { checked: boolean; onChange: (v: boolean) => void; label: React.ReactNode; help?: React.ReactNode; disabled?: boolean; end?: React.ReactNode; name?: string };

const rowCls = (disabled?: boolean, checked?: boolean) =>
  `group flex min-h-10 items-center gap-3 px-3 py-2 text-sm transition-colors ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-surface-2/70'} ${checked && !disabled ? 'bg-brand-soft/50' : ''}`;

function Text({ label, help }: { label: React.ReactNode; help?: React.ReactNode }) {
  return (
    <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className="font-medium text-ink">{label}</span>
      {help && <span className="text-xs text-muted">{help}</span>}
    </span>
  );
}

export function Checkbox({ checked, onChange, label, help, disabled, end, name }: RowProps) {
  return (
    <label className={rowCls(disabled, checked)}>
      <input type="checkbox" name={name} className="peer sr-only" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
      <span className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border border-line bg-surface text-white transition-colors peer-checked:border-brand peer-checked:bg-brand peer-focus-visible:ring-2 peer-focus-visible:ring-brand/30 group-hover:border-brand/50">
        <Check size={12} strokeWidth={3} className={checked ? 'opacity-100' : 'opacity-0'} aria-hidden="true" />
      </span>
      <Text label={label} help={help} />
      {end}
    </label>
  );
}

export function Radio({ checked, onChange, label, help, disabled, end, name }: RowProps) {
  return (
    <label className={rowCls(disabled, checked)}>
      <input type="radio" name={name} className="peer sr-only" checked={checked} disabled={disabled} onChange={() => onChange(true)} />
      <span className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border border-line bg-surface transition-colors peer-checked:border-brand peer-focus-visible:ring-2 peer-focus-visible:ring-brand/30 group-hover:border-brand/50">
        <span className={`h-2 w-2 rounded-full bg-brand transition-transform ${checked ? 'scale-100' : 'scale-0'}`} />
      </span>
      <Text label={label} help={help} />
      {end}
    </label>
  );
}

export function Switch({ checked, onChange, label, help, disabled, end, name }: RowProps) {
  return (
    <label className={rowCls(disabled, false)}>
      <input type="checkbox" role="switch" name={name} className="peer sr-only" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
      <Text label={label} help={help} />
      {end}
      <span className="relative h-5 w-9 shrink-0 rounded-full bg-line transition-colors peer-checked:bg-brand peer-focus-visible:ring-2 peer-focus-visible:ring-brand/30">
        <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </span>
    </label>
  );
}

/** Small pill group for one-of-N choices (theme, text size…). */
export function Segmented<T extends string>({ value, onChange, options, label, size = 'md' }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; icon?: React.ReactNode }[]; label?: string; size?: 'sm' | 'md' }) {
  const id = useId();
  const i = options.findIndex(o => o.value === value);
  return (
    <div role="radiogroup" aria-label={label} id={id} className="inline-flex max-w-full rounded-lg border border-line bg-surface-2 p-0.5">
      {options.map((o, j) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={o.value === value || (i < 0 && j === 0) ? 0 : -1}
          onClick={() => onChange(o.value)}
          onKeyDown={e => {
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
            e.preventDefault();
            const n = options[(j + (e.key === 'ArrowRight' ? 1 : options.length - 1)) % options.length];
            onChange(n.value);
            (e.currentTarget.parentElement?.children[options.indexOf(n)] as HTMLElement | undefined)?.focus();
          }}
          className={`inline-flex items-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:outline-none ${size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'} ${
            o.value === value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
          }`}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, help, children, className = '' }: { label: React.ReactNode; help?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {help && <span className="mt-1 block text-xs text-muted">{help}</span>}
    </label>
  );
}

/** Section heading inside a form: small caps title plus optional note. */
export function GroupLabel({ children, note }: { children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-2">
      <span className="text-xs font-semibold tracking-wide text-muted uppercase">{children}</span>
      {note && <span className="text-xs text-muted">{note}</span>}
    </div>
  );
}
