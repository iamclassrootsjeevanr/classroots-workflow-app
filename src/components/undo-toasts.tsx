'use client';

import { RotateCcw, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { restoreItemAction } from '@/app/actions';
import { UNDO_DELETE_MINUTES } from '@/lib/workflow';

const STORE = 'cr:deleted';
const EVENT = 'cr:deleted-changed';
const WINDOW_MS = UNDO_DELETE_MINUTES * 60_000;

type Entry = { itemId: string; itemKey: string; at: number };

function read(): Entry[] {
  try {
    const list = JSON.parse(localStorage.getItem(STORE) ?? '[]') as Entry[];
    return list.filter(e => Date.now() - e.at < WINDOW_MS);
  } catch {
    return [];
  }
}
function write(list: Entry[]) {
  try {
    localStorage.setItem(STORE, JSON.stringify(list));
  } catch {
    /* private mode: the toast still shows for this page view */
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Called right after a delete so the Undo toast appears at once, on every page, for the next 30 minutes. */
export function rememberDeletion(itemId: string, itemKey: string) {
  write([{ itemId, itemKey, at: Date.now() }, ...read().filter(e => e.itemId !== itemId)]);
}
const forget = (itemId: string) => write(read().filter(e => e.itemId !== itemId));

/** Undo button for one deleted row. */
export function UndoButton({ itemId, label = 'Undo' }: { itemId: string; label?: string }) {
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
              forget(itemId);
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

/** Bottom-left toasts for rows deleted in the last 30 minutes, with Undo. Mounted once in the app layout. */
export function UndoToasts() {
  const [list, setList] = useState<Entry[]>([]);
  const [, tick] = useState(0);
  const refresh = useCallback(() => setList(read()), []);
  useEffect(() => {
    refresh();
    window.addEventListener(EVENT, refresh);
    window.addEventListener('storage', refresh);
    const t = setInterval(() => {
      refresh();
      tick(n => n + 1);
    }, 30_000);
    return () => {
      window.removeEventListener(EVENT, refresh);
      window.removeEventListener('storage', refresh);
      clearInterval(t);
    };
  }, [refresh]);
  if (!list.length) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2" role="status" aria-live="polite">
      {list.slice(0, 3).map(e => {
        const left = Math.max(1, Math.ceil((WINDOW_MS - (Date.now() - e.at)) / 60_000));
        return (
          <div key={e.itemId} className="pointer-events-auto flex items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5 shadow-[var(--shadow-pop)]">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-ink">Deleted {e.itemKey.split(' | ').pop()}</div>
              <div className="text-2xs text-muted">Undo for {left} more min</div>
            </div>
            <UndoButton itemId={e.itemId} />
            <button type="button" className="btn-icon h-7 w-7" aria-label="Dismiss" onClick={() => forget(e.itemId)}>
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
