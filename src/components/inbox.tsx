'use client';

import { Bell, MessageSquare, RotateCcw, Trash2, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { deleteNotificationsAction, loadInboxAction, markNotificationsAction } from '@/app/actions';
import { timeAgo, undoMinutesLeft, undoOpen, type NotificationView } from '@/lib/notifications-core';
import { useSidebar } from './sidebar';
import { UndoButton } from './undo-toasts';

const ICONS: Record<string, typeof Bell> = {
  'item.deleted': Trash2,
  'item.restored': RotateCcw,
  'item.assigned': UserPlus,
  'item.feedback': MessageSquare,
};

/** One inbox message: icon, title, text, time, unread dot and (for a deleted row) an Undo button while the 30 minutes last. */
export function NotificationRow({ n, selected, onSelect, onChanged, compact }: { n: NotificationView; selected?: boolean; onSelect?: (on: boolean) => void; onChanged?: () => void; compact?: boolean }) {
  const Icon = ICONS[n.kind] ?? Bell;
  const router = useRouter();
  const canUndo = undoOpen(n);
  const open = () => {
    if (!n.read) void markNotificationsAction(true, [n.id]).then(() => onChanged?.());
  };
  const titleEl = n.href ? (
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
          {canUndo && <span>Undo for {undoMinutesLeft(n)} more min</span>}
          {n.kind === 'item.deleted' && !canUndo && <span>Undo time is over</span>}
        </div>
        {canUndo && typeof n.data.itemId === 'string' && (
          <div className="mt-2">
            <UndoButton
              itemId={n.data.itemId}
              onDone={() => {
                onChanged?.();
                router.refresh();
              }}
            />
          </div>
        )}
      </div>
    </li>
  );
}

/** Inbox entry in the sidebar: unread badge, and a popover with the latest messages. */
export function InboxMenu({ unread }: { unread: number }) {
  const { collapsed } = useSidebar();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationView[] | null>(null);
  const [count, setCount] = useState(unread);
  const btn = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ left: 0, bottom: 0 });
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
      setPos({ left: r.right + 10, bottom: Math.max(12, window.innerHeight - r.bottom - 4) });
      void load();
    }
    setOpen(o => !o);
  };
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
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
        title={collapsed ? 'Inbox' : undefined}
        className={`relative flex min-h-9 w-full items-center gap-2.5 rounded-lg transition-colors hover:bg-surface-2 ${collapsed ? 'justify-center px-0' : 'px-2.5'} ${open ? 'bg-surface-2 text-ink' : 'text-ink/90'}`}
      >
        <Bell size={17} strokeWidth={1.8} className="shrink-0 text-muted" aria-hidden="true" />
        {!collapsed && <span className="flex-1 truncate text-left">Inbox</span>}
        {count > 0 &&
          (collapsed ? (
            <span className="absolute top-1 right-2.5 size-2 rounded-full bg-brand" aria-label={`${count} unread`} />
          ) : (
            <span className="rounded-full bg-brand px-1.5 py-px text-2xs font-semibold text-white tabular-nums" aria-label={`${count} unread`}>
              {count > 99 ? '99+' : count}
            </span>
          ))}
      </button>
      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div role="dialog" aria-label="Inbox" className="fixed z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-line bg-surface text-left shadow-[var(--shadow-pop)]" style={{ left: pos.left, bottom: pos.bottom }}>
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <h2 className="text-md font-semibold text-ink">Inbox</h2>
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
