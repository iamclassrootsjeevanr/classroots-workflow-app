'use client';

import { AlertTriangle, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type ConfirmOptions = {
  title: string;
  /** One or two plain sentences: what happens, and whether it can be undone. */
  description?: React.ReactNode;
  /** Button label, matching the action ("Delete", "Remove", "Pause"). */
  confirmLabel?: string;
  /** danger = red button and trash icon; warn = neutral primary with a caution icon. */
  tone?: 'danger' | 'warn';
};

/**
 * A small dialog in the middle of the screen (phones too) for actions that are hard to undo. Focus starts on Cancel, Esc and a
 * click outside cancel. Controlled: pass `pending` / `error` when the confirm button runs the action itself.
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Confirm',
  tone = 'danger',
  pending,
  pendingLabel,
  error,
  onConfirm,
  onCancel,
}: ConfirmOptions & { pending?: boolean; pendingLabel?: string; error?: string | null; onConfirm: () => void; onCancel: () => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const cancel = useRef(onCancel);
  cancel.current = onCancel;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && cancel.current();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      previous?.focus?.();
    };
  }, []);
  const Icon = tone === 'danger' ? Trash2 : AlertTriangle;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/45 p-4 backdrop-blur-[2px]" onClick={() => !pending && onCancel()}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={description ? 'confirm-desc' : undefined}
        className="w-full max-w-sm rounded-2xl border border-line bg-surface p-5 text-center shadow-[var(--shadow-pop)]"
        onClick={e => e.stopPropagation()}
      >
        <span className={`mx-auto mb-3 grid size-11 place-items-center rounded-full ${tone === 'danger' ? 'bg-bad-soft text-bad' : 'bg-warn-soft text-warn'}`}>
          <Icon size={20} aria-hidden="true" />
        </span>
        <h2 id="confirm-title" className="text-md leading-snug font-semibold text-ink">
          {title}
        </h2>
        {description && (
          <p id="confirm-desc" className="mt-1.5 text-sm text-muted">
            {description}
          </p>
        )}
        {error && <p className="note-bad mt-3 text-left">{error}</p>}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button ref={cancelRef} type="button" className="btn-ghost justify-center border border-line" disabled={pending} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className={`${tone === 'danger' ? 'btn-danger' : 'btn-primary'} justify-center`} disabled={pending} onClick={onConfirm}>
            {pending ? (pendingLabel ?? `${confirmLabel}…`) : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Replacement for `window.confirm`: `const { confirm, dialog } = useConfirm();` render `{dialog}` once, then
 * `if (!(await confirm({ title, description, confirmLabel }))) return;`.
 */
export function useConfirm() {
  const [asking, setAsking] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);
  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>(resolve => setAsking({ ...options, resolve })), []);
  const settle = (ok: boolean) => {
    asking?.resolve(ok);
    setAsking(null);
  };
  const dialog = asking ? <ConfirmDialog {...asking} onConfirm={() => settle(true)} onCancel={() => settle(false)} /> : null;
  return { confirm, dialog };
}
