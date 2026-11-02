'use client';

import { ExternalLink, Pencil, Trash2 } from 'lucide-react';
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
  const style = { '--status': current.color } as React.CSSProperties;
  if (!options.length) {
    return (
      <span className="status-control inline-flex rounded-md border px-2 py-1 text-xs font-semibold whitespace-nowrap" style={style}>
        {current.label}
      </span>
    );
  }
  return (
    <div>
      <select
        aria-label="Change status"
        className={`status-control cursor-pointer rounded-md border font-semibold outline-none focus-visible:ring-2 focus-visible:ring-brand/30 ${compact ? 'px-1.5 py-1 text-xs' : 'px-2.5 py-1.5 text-sm'} disabled:cursor-wait disabled:opacity-60`}
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

/** A link field shown as a button that opens the URL in a new tab. */
export function LinkButton({ href, label, size = 'sm' }: { href: string; label: string; size?: 'xs' | 'sm' }) {
  return (
    <a
      className={`btn-ghost ${size === 'xs' ? 'min-h-7 gap-1 px-2 py-0.5 text-xs' : 'min-h-8 px-3 text-xs'}`}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={href}
    >
      {label} <ExternalLink size={12} aria-hidden="true" />
    </a>
  );
}

function inputType(type: string) {
  return type === 'date' ? 'date' : type === 'number' ? 'number' : type === 'url' ? 'url' : 'text';
}

/** One data field as a row: label · value · Edit / Delete. Each row saves on its own. */
function FieldRow({ itemId, field }: { itemId: string; field: EditableField }) {
  const { pending, result, exec, clear } = useAction();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [draft, setDraft] = useState(field.value);
  const id = `f-${field.key}`;
  const has = field.value !== '';

  const startEdit = () => {
    clear();
    setConfirming(false);
    setDraft(field.value);
    setEditing(true);
  };
  const cancel = () => {
    setEditing(false);
    clear();
  };
  const save = () => {
    const next = draft.trim();
    if (next === field.value) return cancel();
    exec(() => updateFieldsAction(itemId, { [field.key]: next || null }), () => setEditing(false));
  };
  const remove = () =>
    exec(
      async () => {
        const r = await updateFieldsAction(itemId, { [field.key]: null });
        return r.ok ? { ...r, message: 'Deleted' } : r;
      },
      () => setConfirming(false),
    );

  const display = !has ? (
    <span className="text-muted">—</span>
  ) : field.type === 'url' ? (
    <LinkButton href={field.value} label={field.linkLabel ?? 'Open link'} />
  ) : (
    <span className={field.type === 'longtext' ? 'whitespace-pre-wrap' : 'break-words'}>{field.value}</span>
  );

  return (
    <li className="flex flex-wrap items-start gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0">
      <label htmlFor={id} className="order-1 shrink-0 pt-1.5 text-xs font-medium text-muted sm:w-40">
        {field.label}
      </label>
      <div className="order-3 min-w-0 basis-full sm:order-2 sm:min-w-0 sm:flex-1 sm:basis-0">
        {editing ? (
          <div className="space-y-2">
            {field.type === 'longtext' ? (
              <textarea
                id={id}
                className="input min-h-24"
                autoFocus
                value={draft}
                disabled={pending}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => e.key === 'Escape' && cancel()}
              />
            ) : (
              <input
                id={id}
                className="input"
                type={inputType(field.type)}
                autoFocus
                value={draft}
                placeholder={field.type === 'url' ? 'https://…' : ''}
                disabled={pending}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    save();
                  }
                  if (e.key === 'Escape') cancel();
                }}
              />
            )}
            <div className="flex items-center gap-2">
              <button type="button" className="btn-primary min-h-8 px-3 text-xs" disabled={pending} onClick={save}>
                {pending ? 'Saving…' : 'Save'}
              </button>
              <button type="button" className="btn-ghost min-h-8 px-3 text-xs" disabled={pending} onClick={cancel}>
                Cancel
              </button>
              <ActionMessage result={result} />
            </div>
          </div>
        ) : (
          <div className="min-h-8 py-1 text-sm">
            {display}
            {result && <ActionMessage result={result} />}
          </div>
        )}
      </div>
      {field.editable && !editing && (
        <div className="order-2 ml-auto flex shrink-0 items-center gap-0.5 self-start sm:order-3 sm:ml-0 sm:pt-0.5">
          {confirming ? (
            <>
              <span className="mr-1 text-xs text-muted">Delete this value?</span>
              <button type="button" className="btn-danger min-h-8 px-2.5 text-xs" disabled={pending} onClick={remove}>
                {pending ? 'Deleting…' : 'Delete'}
              </button>
              <button type="button" className="btn-ghost min-h-8 px-2.5 text-xs" disabled={pending} onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn-icon" aria-label={`Edit ${field.label}`} data-tip="Edit" disabled={pending} onClick={startEdit}>
                <Pencil size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="btn-icon hover:bg-bad-soft hover:text-bad"
                aria-label={`Delete ${field.label}`}
                data-tip="Delete"
                disabled={pending || !has}
                onClick={() => {
                  clear();
                  setConfirming(true);
                }}
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      )}
    </li>
  );
}

/** All data fields of an item as rows. Editable rows have Edit and Delete; link rows open in a new tab. */
export function FieldsForm({ itemId, fields }: { itemId: string; fields: EditableField[] }) {
  if (!fields.length) return <p className="text-sm text-muted">No fields for this work type.</p>;
  return (
    <ul className="divide-y divide-line">
      {fields.map(f => (
        <FieldRow key={f.key} itemId={itemId} field={f} />
      ))}
    </ul>
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
