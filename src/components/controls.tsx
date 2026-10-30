'use client';

import { useState, useTransition } from 'react';
import {
  assignAction,
  changeStatusAction,
  commentAction,
  feedbackAction,
  resolveFeedbackAction,
  updateFieldsAction,
  type ActionResult,
} from '@/app/actions';

function useAction() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const exec = (fn: () => Promise<ActionResult>, onOk?: () => void) =>
    start(async () => {
      const r = await fn();
      setResult(r);
      if (r.ok) onOk?.();
    });
  return { pending, result, exec, clear: () => setResult(null) };
}

export function ActionMessage({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  if (result.ok) return result.message ? <p className="mt-1 text-xs text-ok">{result.message}</p> : null;
  return <p className="mt-1 text-xs text-bad">{result.error}</p>;
}

export type StatusOption = { to: string; label: string; statusLabel: string };

/** Current status as a coloured select; options are only the moves this user may make. */
export function StatusSelect({
  itemId,
  version,
  current,
  options,
  compact,
}: {
  itemId: string;
  version: number;
  current: { key: string; label: string; color: string };
  options: StatusOption[];
  compact?: boolean;
}) {
  const { pending, result, exec } = useAction();
  const style = { background: `${current.color}1a`, color: current.color, borderColor: `${current.color}55` };
  if (!options.length) {
    return (
      <span className="inline-flex rounded-md border px-2 py-1 text-xs font-semibold whitespace-nowrap" style={style}>
        {current.label}
      </span>
    );
  }
  return (
    <div>
      <select
        aria-label="Change status"
        className={`cursor-pointer rounded-md border font-semibold outline-none ${compact ? 'px-1.5 py-1 text-xs' : 'px-2.5 py-1.5 text-sm'} disabled:cursor-wait disabled:opacity-60`}
        style={style}
        value={current.key}
        disabled={pending}
        onChange={e => {
          const to = e.target.value;
          exec(() => changeStatusAction(itemId, to, version));
        }}
      >
        <option value={current.key}>{current.label}</option>
        {options.map(o => (
          <option key={o.to} value={o.to}>
            → {o.label === `Set ${o.statusLabel}` ? o.statusLabel : `${o.label} (${o.statusLabel})`}
          </option>
        ))}
      </select>
      {result && !result.ok && <ActionMessage result={result} />}
    </div>
  );
}

export type PersonOption = { id: string; name: string; hint?: string };

export function AssignSelect({ itemId, assigneeId, people, compact }: { itemId: string; assigneeId: string | null; people: PersonOption[]; compact?: boolean }) {
  const { pending, result, exec } = useAction();
  return (
    <div>
      <select
        aria-label="Assign developer"
        className={`input ${compact ? 'w-auto py-1 text-xs' : ''}`}
        value={assigneeId ?? ''}
        disabled={pending}
        onChange={e => exec(() => assignAction(itemId, e.target.value || null))}
      >
        <option value="">Unassigned</option>
        {people.map(p => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.hint ? ` · ${p.hint}` : ''}
          </option>
        ))}
      </select>
      {result && !result.ok && <ActionMessage result={result} />}
    </div>
  );
}

export type EditableField = { key: string; label: string; type: string; value: string; editable: boolean; linkLabel?: string };

export function FieldsForm({ itemId, fields }: { itemId: string; fields: EditableField[] }) {
  const { pending, result, exec } = useAction();
  const [values, setValues] = useState(() => Object.fromEntries(fields.map(f => [f.key, f.value])));
  const dirty = fields.filter(f => f.editable && (values[f.key] ?? '') !== f.value);
  return (
    <form
      className="space-y-3"
      onSubmit={e => {
        e.preventDefault();
        if (!dirty.length) return;
        exec(() => updateFieldsAction(itemId, Object.fromEntries(dirty.map(f => [f.key, values[f.key] || null]))));
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map(f => (
          <div key={f.key} className={f.type === 'longtext' ? 'sm:col-span-2' : ''}>
            <label className="label" htmlFor={`f-${f.key}`}>
              {f.label}
            </label>
            {!f.editable ? (
              <div className="min-h-[34px] rounded-md bg-canvas px-3 py-1.5 text-sm break-all">
                {f.type === 'url' && f.value ? (
                  <a className="link" href={f.value} target="_blank" rel="noopener noreferrer">
                    {f.linkLabel ?? 'Open'} ↗
                  </a>
                ) : (
                  f.value || <span className="text-muted">—</span>
                )}
              </div>
            ) : f.type === 'longtext' ? (
              <textarea id={`f-${f.key}`} className="input min-h-20" value={values[f.key]} onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))} />
            ) : (
              <div className="flex gap-2">
                <input
                  id={`f-${f.key}`}
                  className="input"
                  type={f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : f.type === 'url' ? 'url' : 'text'}
                  value={values[f.key]}
                  placeholder={f.type === 'url' ? 'https://…' : ''}
                  onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                />
                {f.type === 'url' && f.value && (
                  <a className="btn-ghost shrink-0" href={f.value} target="_blank" rel="noopener noreferrer" title={f.linkLabel}>
                    ↗
                  </a>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      {fields.some(f => f.editable) && (
        <div className="flex items-center gap-3">
          <button className="btn-primary" disabled={pending || !dirty.length}>
            {pending ? 'Saving…' : 'Save changes'}
          </button>
          <ActionMessage result={result} />
        </div>
      )}
    </form>
  );
}

export function FeedbackForm({ itemId, canRequestCorrections }: { itemId: string; canRequestCorrections: boolean }) {
  const { pending, result, exec } = useAction();
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState('');
  const submit = (requestCorrections: boolean) =>
    exec(() => feedbackAction(itemId, { body, category, severity, requestCorrections }), () => setBody(''));
  return (
    <div className="space-y-2">
      <textarea className="input min-h-20" placeholder="What needs to change?" value={body} onChange={e => setBody(e.target.value)} />
      <div className="flex flex-wrap items-center gap-2">
        <select className="input w-auto" value={category} onChange={e => setCategory(e.target.value)} aria-label="Category">
          <option value="">Category</option>
          <option>Content</option>
          <option>Design / UI</option>
          <option>Interaction</option>
          <option>Bug</option>
          <option>Audio / Media</option>
          <option>Other</option>
        </select>
        <select className="input w-auto" value={severity} onChange={e => setSeverity(e.target.value)} aria-label="Severity">
          <option value="">Severity</option>
          <option>Minor</option>
          <option>Major</option>
          <option>Blocker</option>
        </select>
        <button className="btn-ghost" disabled={pending || !body.trim()} onClick={() => submit(false)}>
          Add feedback
        </button>
        {canRequestCorrections && (
          <button className="btn-danger" disabled={pending || !body.trim()} onClick={() => submit(true)}>
            Send back for corrections
          </button>
        )}
      </div>
      <ActionMessage result={result} />
    </div>
  );
}

export function ResolveFeedbackButton({ id, resolved }: { id: string; resolved: boolean }) {
  const { pending, exec } = useAction();
  return (
    <button className="text-xs font-medium text-brand hover:underline disabled:opacity-50" disabled={pending} onClick={() => exec(() => resolveFeedbackAction(id))}>
      {resolved ? 'Reopen' : 'Mark resolved'}
    </button>
  );
}

export function CommentForm({ itemId }: { itemId: string }) {
  const { pending, result, exec } = useAction();
  const [body, setBody] = useState('');
  return (
    <form
      className="flex gap-2"
      onSubmit={e => {
        e.preventDefault();
        exec(() => commentAction(itemId, body), () => setBody(''));
      }}
    >
      <input className="input" placeholder="Add a comment or update…" value={body} onChange={e => setBody(e.target.value)} />
      <button className="btn-ghost shrink-0" disabled={pending || !body.trim()}>
        Post
      </button>
      <ActionMessage result={result} />
    </form>
  );
}
