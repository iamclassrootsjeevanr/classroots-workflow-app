'use client';

import { Bell, CheckCircle2, MessageSquare, RotateCcw, Trash2, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { deleteNotificationsAction, loadInboxAction, markNotificationsAction } from '@/app/actions';
import { timeAgo, undoMinutesLeft, undoOpen, type NotificationView } from '@/lib/notifications-core';
import { UndoButton, UndoVersionButton } from './undo-toasts';

const ICONS: Record<string, typeof Bell> = {
  'item.deleted': Trash2,
  'item.restored': RotateCcw,
  'version.deleted': Trash2,
  'version.restored': RotateCcw,
  'item.assigned': UserPlus,
  'item.feedback': MessageSquare,
  'feedback.reply': MessageSquare,
  'feedback.closed': CheckCircle2,
  'feedback.reopened': RotateCcw,
  'item.relay-reopened': RotateCcw,
  'item.relay-holder': RotateCcw,
};

/** One inbox message: icon, title, text, time, unread dot and (for a deleted row) an Undo button while the 30 minutes last. */
export function NotificationRow({ n, selected, onSelect, onChanged, compact }: { n: NotificationView; selected?: boolean; onSelect?: (on: boolean) => void; onChanged?: () => void; compact?: boolean }) {
  const Icon = ICONS[n.kind] ?? Bell;
  const router = useRouter();
  const canUndo = undoOpen(n);
  const [shown, setShown] = useState(false);
  const open = () => {
    if (!n.read) void markNotificationsAction(true, [n.id]).then(() => onChanged?.());
  };
  // A delete notice with Undo left does not navigate: clicking it reveals the Undo button.
  const isVersion = n.kind === 'version.deleted';
  const expandable = canUndo && (isVersion ? typeof n.data.version === 'string' && typeof n.data.deletedAt === 'string' : typeof n.data.itemId === 'string');
  const titleEl = expandable ? (
    <button type="button" className="text-left font-medium text-ink hover:text-brand" aria-expanded={shown} onClick={() => setShown(v => !v)}>
      {n.title}
    </button>
  ) : n.href ? (
    <Link href={n.href} onClick={open} className="font-medium text-ink hover:text-brand">
      {n.title}
    </Link>
  ) : (
    <span className="font-medium text-ink">{n.title}</span>
  );
  return (
    <li className={`flex gap-3 ${compact ? 'px-4 py-3' : 'px-4 py-3.5'} ${n.read ? '' : 'bg-brand-soft/30'}`}>
      {onSelect && <input type="checkbox" className="mt-1.5 size-4 shrink-0 accent-[var(--color-brand)]" checked={selected} onChange={e => onSelect(e.target.checked)} aria-label={`Select ${n.title}`} />}
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted">
        <Icon size={15} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2 text-sm">
          <span className="min-w-0 flex-1 truncate">{titleEl}</span>
          {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" aria-label="Unread" />}
        </div>
        {n.body && <p className="mt-0.5 line-clamp-2 text-sm text-muted">{n.body}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-muted">
          <span>{timeAgo(n.createdAt)}</span>
          {expandable && !shown && <span>Click to undo · {undoMinutesLeft(n)} min left</span>}
          {(n.kind === 'item.deleted' || isVersion) && !canUndo && <span>Undo time is over</span>}
        </div>
        {expandable && shown && (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {isVersion ? (
              <UndoVersionButton
                workTypeId={String(n.data.workTypeId)}
                version={String(n.data.version)}
                deletedAt={String(n.data.deletedAt)}
                onDone={() => {
                  onChanged?.();
                  router.refresh();
                }}
              />
            ) : (
              <UndoButton
                itemId={String(n.data.itemId)}
                onDone={() => {
                  onChanged?.();
                  router.refresh();
                }}
              />
            )}
            <span className="text-2xs text-muted">{undoMinutesLeft(n)} min left</span>
          </div>
        )}
      </div>
    </li>
  );
}

/**
 * The bell in the top bar: unread count on it, and the latest messages in a card under it. "View all" opens the Inbox page.
 */
export function InboxMenu({ unread }: { unread: number }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationView[] | null>(null);
  const [count, setCount] = useState(unread);
  const btn = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ right: 0, top: 0 });
  useEffect(() => setCount(unread), [unread]);
  useEffect(() => setOpen(false), [path]);

  const load = useCallback(async () => {
    const r = await loadInboxAction();
    if (r.ok) {
      setItems(r.items);
      setCount(r.unread);
    }
  }, []);
  const toggle = () => {
    if (!open && btn.current) {
      const r = btn.current.getBoundingClientRect();
      setPos({ right: Math.max(8, window.innerWidth - r.right - 4), top: r.bottom + 8 });
      void load();
    }
    setOpen(o => !o);
  };
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      btn.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  const [, start] = useTransition();

  return (
    <>
      <button
        ref={btn}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={count > 0 ? `Inbox, ${count} unread` : 'Inbox'}
        title="Inbox"
        className={`relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-surface-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:outline-none ${open || path === '/inbox' ? 'bg-surface-2 text-ink' : 'text-muted'}`}
      >
        <Bell size={18} strokeWidth={1.8} aria-hidden="true" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[1.125rem] rounded-full bg-brand px-1 text-center text-[0.625rem] leading-[1.125rem] font-semibold text-white tabular-nums ring-2 ring-surface" aria-hidden="true">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>
      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div role="dialog" aria-label="Inbox" className="fixed z-50 w-[min(24rem,calc(100vw-1rem))] overflow-hidden rounded-xl border border-line bg-surface text-left shadow-[var(--shadow-pop)]" style={{ right: pos.right, top: pos.top }}>
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <h2 className="text-md font-semibold text-ink">
                  Inbox {count > 0 && <span className="ml-1 rounded-full bg-brand-soft px-1.5 py-px text-2xs font-semibold text-brand tabular-nums">{count} new</span>}
                </h2>
                <div className="flex items-center gap-1.5">
                  {count > 0 && (
                    <button type="button" className="btn-ghost min-h-7 px-2 text-xs" onClick={() => start(async () => { await markNotificationsAction(true); await load(); })}>
                      Mark all read
                    </button>
                  )}
                  <Link href="/inbox" className="btn-ghost min-h-7 px-2 text-xs text-brand" onClick={() => setOpen(false)}>
                    View all
                  </Link>
                </div>
              </div>
              <div className="max-h-[min(26rem,60vh)] overflow-y-auto">
                {items === null ? (
                  <p className="px-4 py-8 text-center text-sm text-muted">Loading…</p>
                ) : items.length ? (
                  <ul className="divide-y divide-line">
                    {items.map(n => (
                      <NotificationRow key={n.id} n={n} onChanged={load} compact />
                    ))}
                  </ul>
                ) : (
                  <p className="px-4 py-8 text-center text-sm text-muted">No new notifications</p>
                )}
              </div>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}

/** Full inbox list with select, mark read and delete. */
export function InboxList({ items }: { items: NotificationView[] }) {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const all = items.length > 0 && picked.size === items.length;
  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      setPicked(new Set());
      router.refresh();
    });
  const ids = [...picked];
  return (
    <div className="card p-0">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="size-4 accent-[var(--color-brand)]"
            checked={all}
            onChange={e => setPicked(e.target.checked ? new Set(items.map(i => i.id)) : new Set())}
          />
          Select all
        </label>
        {picked.size > 0 && (
          <span className="flex items-center gap-2">
            <button type="button" className="btn-ghost min-h-8 px-3 text-xs" disabled={pending} onClick={() => run(() => markNotificationsAction(true, ids))}>
              Mark read
            </button>
            <button type="button" className="btn-ghost min-h-8 px-3 text-xs" disabled={pending} onClick={() => run(() => markNotificationsAction(false, ids))}>
              Mark unread
            </button>
            <button type="button" className="btn-danger min-h-8 px-3 text-xs" disabled={pending} onClick={() => run(() => deleteNotificationsAction(ids))}>
              Delete
            </button>
          </span>
        )}
      </div>
      {items.length ? (
        <ul className="divide-y divide-line">
          {items.map(n => (
            <NotificationRow
              key={n.id}
              n={n}
              selected={picked.has(n.id)}
              onSelect={on => setPicked(s => {
                const next = new Set(s);
                if (on) next.add(n.id);
                else next.delete(n.id);
                return next;
              })}
              onChanged={() => router.refresh()}
            />
          ))}
        </ul>
      ) : (
        <p className="px-4 py-12 text-center text-sm text-muted">Nothing here.</p>
      )}
    </div>
  );
}
