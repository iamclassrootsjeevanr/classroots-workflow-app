'use client';

import { RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { restoreItemAction } from '@/app/actions';

const EVENT = 'cr:undo-toast';
/** How long the Undo toast stays on screen; afterwards the message lives in the Inbox (30 minutes of Undo). */
export const TOAST_SECONDS = 5;

type Toast = { id: string; itemId: string; label: string };

/** Show the Undo toast for a row that was just deleted. */
export function rememberDeletion(itemId: string, itemKey: string) {
  window.dispatchEvent(new CustomEvent<Toast>(EVENT, { detail: { id: `${itemId}-${Date.now()}`, itemId, label: itemKey.split(' | ').pop() ?? itemKey } }));
}

/** Undo button for one deleted row (toast and Inbox). */
export function UndoButton({ itemId, label = 'Undo', onDone }: { itemId: string; label?: string; onDone?: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        className="btn-ghost min-h-8 gap-1 px-2.5 text-xs"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await restoreItemAction(itemId);
            if (r.ok) {
              onDone?.();
              router.refresh();
            } else setError(r.error);
          })
        }
      >
        <RotateCcw size={13} aria-hidden="true" /> {pending ? 'Restoring…' : label}
      </button>
      {error && <span className="text-xs text-bad">{error}</span>}
    </span>
  );
}

/** Bottom-left toast, 5 seconds, right after a delete. Mounted once in the app layout. */
export function UndoToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => {
    const onToast = (e: Event) => {
      const t = (e as CustomEvent<Toast>).detail;
      setToasts(list => [t, ...list].slice(0, 3));
      setTimeout(() => setToasts(list => list.filter(x => x.id !== t.id)), TOAST_SECONDS * 1000);
    };
    window.addEventListener(EVENT, onToast);
    return () => window.removeEventListener(EVENT, onToast);
  }, []);
  if (!toasts.length) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-[60] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2" role="status" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto relative overflow-hidden rounded-xl border border-line bg-surface px-3.5 py-2.5 shadow-[var(--shadow-pop)]">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-ink">Deleted {t.label}</div>
              <div className="text-2xs text-muted">Moves to your Inbox. Undo stays there for 30 min.</div>
            </div>
            <UndoButton itemId={t.itemId} onDone={() => setToasts(list => list.filter(x => x.id !== t.id))} />
          </div>
          <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-brand" style={{ animation: `toast-shrink ${TOAST_SECONDS}s linear forwards` }} />
        </div>
      ))}
    </div>
  );
}
