'use client';

import { ExternalLink, Pencil, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { useEffect, useState, useTransition } from 'react';
import { rememberDeletion } from './undo-toasts';
import {
  assignAction,
  changeStatusAction,
  deleteItemAction,
  commentAction,
  feedbackAction,
  loadEditFieldsAction,
  noteFeedbackAction,
  resolveFeedbackAction,
  setOwnerAction,
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
  // Show the chosen status at once; the server round trip finishes in the background.
  const [next, setNext] = useState<string | null>(null);
  useEffect(() => {
    if (!pending) setNext(null);
  }, [pending]);
  const style = { '--status': current.color } as React.CSSProperties;
  if (!options.length) {
    return (
      <span className="status-control inline-flex rounded-md border px-2 py-1 text-xs font-semibold whitespace-nowrap" style={style}>
        {current.label}
      </span>
    );
  }
  return (
    <div className="min-w-0">
      <select
        aria-label="Change status"
        className={`status-control max-w-full cursor-pointer rounded-md border font-semibold outline-none focus-visible:ring-2 focus-visible:ring-brand/30 ${compact ? 'px-1.5 py-1 text-xs' : 'px-2.5 py-1.5 text-sm'} disabled:cursor-wait disabled:opacity-60`}
        style={style}
        value={next ?? current.key}
        disabled={pending}
        onChange={e => {
          const to = e.target.value;
          setNext(to);
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

/** Who works on the item (default), or with `owner` who owns it (e.g. its SME reviewer). */
export function AssignSelect({ itemId, assigneeId, people, compact, owner, label = 'Assign developer' }: { itemId: string; assigneeId: string | null; people: PersonOption[]; compact?: boolean; owner?: boolean; label?: string }) {
  const { pending, result, exec } = useAction();
  const [next, setNext] = useState<string | null>(null);
  useEffect(() => {
    if (!pending) setNext(null);
  }, [pending]);
  return (
    <div className="min-w-0">
      <select
        aria-label={label}
        className={`input ${compact ? 'w-auto py-1 text-xs' : ''}`}
        value={next ?? assigneeId ?? ''}
        disabled={pending}
        onChange={e => {
          const id = e.target.value || null;
          setNext(e.target.value);
          exec(() => (owner ? setOwnerAction(itemId, id) : assignAction(itemId, id)));
        }}
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

/** A choice field saved as soon as it changes (e.g. a journey's Creation stage beside its status). */
export function FieldSelect({ itemId, field }: { itemId: string; field: EditableField }) {
  const { pending, result, exec } = useAction();
  const [next, setNext] = useState<string | null>(null);
  useEffect(() => {
    if (!pending) setNext(null);
  }, [pending]);
  if (!field.editable) return <div className="py-1.5 text-sm">{field.value || <span className="text-muted">—</span>}</div>;
  return (
    <div className="min-w-0">
      <select
        aria-label={field.label}
        className="input"
        value={next ?? field.value}
        disabled={pending}
        onChange={e => {
          setNext(e.target.value);
          exec(() => updateFieldsAction(itemId, { [field.key]: e.target.value || null }));
        }}
      >
        <option value="">—</option>
        {(field.options ?? []).map(o => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      {result && !result.ok && <ActionMessage result={result} />}
    </div>
  );
}

export type EditableField = { key: string; label: string; type: string; value: string; editable: boolean; linkLabel?: string; options?: readonly string[] };

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
            ) : field.type === 'select' ? (
              <select id={id} className="input" autoFocus value={draft} disabled={pending} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === 'Escape' && cancel()}>
                <option value="">—</option>
                {(field.options ?? []).map(o => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
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
              <button type="button" className="btn-icon" aria-label={`Edit ${field.label}`} title="Edit" disabled={pending} onClick={startEdit}>
                <Pencil size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="btn-icon hover:bg-bad-soft hover:text-bad"
                aria-label={`Delete ${field.label}`}
                title="Delete"
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

/** Trash on a row (or the item page): asks first, then deletes the whole item. Deleted items leave every list and report. */
export function DeleteItemButton({ itemId, itemKey, compact, redirectTo }: { itemId: string; itemKey: string; compact?: boolean; redirectTo?: string }) {
  const { pending, result, exec, clear } = useAction();
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();
  if (confirming) {
    return (
      <span className="confirm inline-flex items-center gap-1.5 text-xs">
        <span className="text-muted">{compact ? 'Delete row?' : `Delete ${itemKey}?`}</span>
        <button
          type="button"
          className="btn-danger min-h-7 px-2.5 py-0.5 text-xs"
          disabled={pending}
          onClick={() =>
            exec(
              () => deleteItemAction(itemId),
              () => {
                rememberDeletion(itemId, itemKey);
                if (redirectTo) router.push(redirectTo);
                else setConfirming(false);
              },
            )
          }
        >
          {pending ? 'Deleting…' : 'Delete'}
        </button>
        <button type="button" className="btn-ghost min-h-7 px-2.5 py-0.5 text-xs" disabled={pending} onClick={() => setConfirming(false)}>
          Cancel
        </button>
        {result && !result.ok && <span className="text-bad">{result.error}</span>}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={compact ? 'btn-icon hover:bg-bad-soft hover:text-bad' : 'btn-danger min-h-8 gap-1 px-2.5 text-xs'}
      aria-label={`Delete ${itemKey}`}
      title={compact ? 'Delete row' : undefined}
      onClick={() => {
        clear();
        setConfirming(true);
      }}
    >
      <Trash2 size={14} aria-hidden="true" />
      {!compact && 'Delete'}
    </button>
  );
}

/** Pencil on a list row: opens a panel with that item's fields (same Edit / Delete rows as the item page). Fields load on open. */
export function EditItemButton({ itemId, itemKey, title, compact }: { itemId: string; itemKey: string; title: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<EditableField[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    let live = true;
    setError(null);
    loadEditFieldsAction(itemId).then(r => {
      if (!live) return;
      if (r.ok) setFields(r.fields);
      else setError(r.error);
    });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      live = false;
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, itemId]);
  const editable = fields?.filter(f => f.editable).length ?? 0;
  return (
    <>
      <button
        type="button"
        className={compact ? 'btn-icon' : 'btn-ghost min-h-8 gap-1 px-2.5 text-xs'}
        aria-label={`Edit ${itemKey}`}
        title={compact ? 'Edit details' : undefined}
        onClick={() => setOpen(true)}
      >
        <Pencil size={14} aria-hidden="true" />
        {!compact && 'Edit'}
      </button>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 text-left backdrop-blur-[2px] sm:items-center sm:p-6" onClick={() => setOpen(false)}>
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={`edit-${itemId}`}
              className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-line bg-surface p-5 shadow-[var(--shadow-pop)] sm:rounded-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-mono text-2xs text-muted">{itemKey}</div>
                  <h2 id={`edit-${itemId}`} className="text-md leading-snug font-semibold text-ink">
                    {title}
                  </h2>
                  {fields && (
                    <p className="mt-0.5 text-xs text-muted">
                      {editable} of {fields.length} details editable by you · each row saves on its own
                    </p>
                  )}
                </div>
                <button type="button" className="btn-icon" aria-label="Close" onClick={() => setOpen(false)}>
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
              {error ? <p className="text-sm text-bad">{error}</p> : fields ? <FieldsForm itemId={itemId} fields={fields} /> : <p className="py-6 text-center text-sm text-muted">Loading…</p>}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

export function FeedbackForm({ itemId, canRequestCorrections, correctionsLabel = 'Send back for corrections' }: { itemId: string; canRequestCorrections: boolean; correctionsLabel?: string }) {
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
            {correctionsLabel}
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

/** The creator's reply under one feedback point ("Their note" in the tracker). Read-only for everyone else. */
export function FeedbackReply({ id, note, by, editable }: { id: string; note: string | null; by?: string | null; editable: boolean }) {
  const { pending, result, exec } = useAction();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note ?? '');
  if (!editing) {
    return (
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 border-t border-line pt-2 text-sm">
        {note ? (
          <p className="min-w-0 flex-1 whitespace-pre-wrap">
            <span className="text-xs font-medium text-muted">{by ?? 'Reply'}: </span>
            {note}
          </p>
        ) : (
          <span className="flex-1 text-xs text-muted">No reply yet.</span>
        )}
        {editable && (
          <button type="button" className="text-xs font-medium text-brand hover:underline" onClick={() => setEditing(true)}>
            {note ? 'Edit reply' : 'Reply'}
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="mt-2 space-y-2 border-t border-line pt-2">
      <textarea className="input min-h-16" aria-label="Your reply" placeholder="What you changed, or why not" value={text} onChange={e => setText(e.target.value)} />
      <div className="flex gap-2">
        <button type="button" className="btn-primary" disabled={pending} onClick={() => exec(() => noteFeedbackAction(id, text), () => setEditing(false))}>
          {pending ? 'Saving…' : 'Save reply'}
        </button>
        <button type="button" className="btn-ghost" disabled={pending} onClick={() => setEditing(false)}>
          Cancel
        </button>
      </div>
      <ActionMessage result={result} />
    </div>
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
