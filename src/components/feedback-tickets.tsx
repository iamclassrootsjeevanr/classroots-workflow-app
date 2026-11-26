'use client';

import { CheckCircle2, Link2, MessageSquare, Plus, Send } from 'lucide-react';
import { useState, useTransition } from 'react';
import { feedbackAction, replyFeedbackAction, resolveFeedbackAction, type ActionResult } from '@/app/actions';
import { SEVERITIES, severityTone } from '@/lib/feedback';
import { linkParts } from '@/lib/links';
import { ConfirmDialog } from './confirm';
import { ActionMessage } from './controls';
import { Segmented } from './form';
import { ToneChip } from './ui';

export type TicketMessage = { id: string; authorId: string | null; authorName: string; body: string; at: string };
export type TicketView = {
  id: string;
  code: string;
  title: string;
  body: string;
  severity: string | null;
  category: string | null;
  open: boolean;
  createdAt: string;
  closedAt: string | null;
  authorName: string;
  toName: string | null;
  mine: boolean;
  canClose: boolean;
  canReply: boolean;
  messages: TicketMessage[];
};

/** Who a new ticket can be addressed to, with the part they play ("Asha · SME reviewer"). The first one is the usual other side. */
export type TicketReader = { id: string; label: string };
/** A send-back this person may make with a ticket: the stage it goes to and the button's words. */
export type SendBack = { to: string; label: string };

/**
 * Ticket and chat text: as typed, with each http(s) link as a chip that opens in a new tab. React escapes the text, and nothing but
 * http and https becomes a link.
 */
export function RichText({ text, className = '' }: { text: string; className?: string }) {
  return (
    <p className={`break-words whitespace-pre-wrap ${className}`}>
      {linkParts(text).map((p, i) =>
        p.type === 'text' ? (
          <span key={i}>{p.text}</span>
        ) : (
          <a
            key={i}
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            title={p.url}
            className="mx-0.5 inline-flex max-w-full items-center gap-1 rounded-full border border-line bg-surface px-2 py-0.5 align-baseline text-xs font-medium text-brand no-underline transition-colors hover:border-brand/50 hover:bg-brand-soft focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:outline-none"
          >
            <Link2 size={12} className="shrink-0" aria-hidden="true" />
            <span className="truncate">{p.label}</span>
          </a>
        ),
      )}
    </p>
  );
}

function useRun() {
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

const CATEGORIES = ['Content', 'Design / UI', 'Interaction', 'Bug', 'Audio / Media', 'Other'];
const initial = (name: string) => (name.trim()[0] ?? '?').toUpperCase();

/** The ticket list of one item: raise a ticket, chat on it, close it. Filters Open / Closed / All. */
export function FeedbackTickets({
  itemId,
  tickets,
  currentUserId,
  canRaise,
  readers = [],
  sendBacks = [],
}: {
  itemId: string;
  tickets: TicketView[];
  currentUserId: string;
  canRaise: boolean;
  /** Who a new ticket can go to (the first is picked). */
  readers?: TicketReader[];
  /** The send-backs this person can make with a ticket (Journey QA has two: to the creator and to the developer). */
  sendBacks?: SendBack[];
}) {
  const openCount = tickets.filter(t => t.open).length;
  const [filter, setFilter] = useState<'open' | 'closed' | 'all'>(openCount || !tickets.length ? 'open' : 'all');
  const [raising, setRaising] = useState(false);
  const shown = tickets.filter(t => (filter === 'all' ? true : filter === 'open' ? t.open : !t.open));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Show tickets"
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'open', label: `Open · ${openCount}` },
            { value: 'closed', label: `Closed · ${tickets.length - openCount}` },
            { value: 'all', label: `All · ${tickets.length}` },
          ]}
        />
        {canRaise && !raising && (
          <button type="button" className="btn-primary gap-1" onClick={() => setRaising(true)}>
            <Plus size={15} aria-hidden="true" /> New ticket
          </button>
        )}
      </div>

      {raising && <NewTicket itemId={itemId} readers={readers} sendBacks={sendBacks} onDone={() => (setRaising(false), setFilter('open'))} onCancel={() => setRaising(false)} />}

      {shown.length ? (
        <ul className="space-y-3">
          {shown.map(t => (
            <Ticket key={t.id} t={t} currentUserId={currentUserId} defaultOpen={t.open && shown.length <= 3} />
          ))}
        </ul>
      ) : (
        !raising && (
          <div className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">
            {tickets.length ? `No ${filter} tickets.` : canRaise ? 'No tickets yet. Raise one when something needs fixing.' : 'No tickets yet.'}
          </div>
        )
      )}
    </div>
  );
}

function NewTicket({ itemId, readers, sendBacks, onDone, onCancel }: { itemId: string; readers: TicketReader[]; sendBacks: SendBack[]; onDone: () => void; onCancel: () => void }) {
  const { pending, result, exec } = useRun();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>('Medium');
  const [category, setCategory] = useState('');
  const [toId, setToId] = useState(readers[0]?.id ?? '');
  const submit = (sendBackTo?: string) => exec(() => feedbackAction(itemId, { title, body, severity, category, toId: toId || undefined, sendBackTo }), onDone);
  return (
    <section className="card space-y-3" aria-label="New ticket">
      <div>
        <label htmlFor="t-title" className="mb-1 block text-xs font-medium text-muted">
          Title
        </label>
        <input id="t-title" className="input" autoFocus placeholder="What needs to change? (short)" value={title} onChange={e => setTitle(e.target.value)} />
      </div>
      <div>
        <label htmlFor="t-body" className="mb-1 block text-xs font-medium text-muted">
          Description
        </label>
        <textarea id="t-body" className="input min-h-24" placeholder="Where, what is wrong, what it should be" value={body} onChange={e => setBody(e.target.value)} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Segmented label="Severity" size="sm" value={severity} onChange={setSeverity} options={SEVERITIES.map(s => ({ value: s, label: s }))} />
        <select className="input w-auto" value={category} onChange={e => setCategory(e.target.value)} aria-label="Category">
          <option value="">Category</option>
          {CATEGORIES.map(c => (
            <option key={c}>{c}</option>
          ))}
        </select>
        {readers.length > 0 && (
          <label className="flex items-center gap-2 text-xs font-medium text-muted">
            To
            <select className="input w-auto" value={toId} onChange={e => setToId(e.target.value)} aria-label="To">
              {readers.map(r => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {sendBacks.length > 0 && <p className="text-xs text-muted">A send-back ticket goes to the person who gets the work back.</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary" disabled={pending || !body.trim()} onClick={() => submit()}>
          {pending ? 'Raising…' : 'Raise ticket'}
        </button>
        {sendBacks.map(s => (
          <button key={s.to} type="button" className="btn-danger" disabled={pending || !body.trim()} onClick={() => submit(s.to)}>
            {s.label}
          </button>
        ))}
        <button type="button" className="btn-ghost" disabled={pending} onClick={onCancel}>
          Cancel
        </button>
      </div>
      <ActionMessage result={result} />
    </section>
  );
}

function Ticket({ t, currentUserId, defaultOpen }: { t: TicketView; currentUserId: string; defaultOpen: boolean }) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const [asking, setAsking] = useState(false);
  const close = useRun();
  const tone = severityTone(t.severity);
  return (
    <li className={`card p-0 ${t.open ? '' : 'opacity-90'}`}>
      <button type="button" className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
        <span className="font-mono text-xs font-semibold text-muted">{t.code}</span>
        {t.severity && <ToneChip tone={tone === 'bad' ? 'bad' : tone === 'warn' ? 'warn' : 'muted'}>{t.severity}</ToneChip>}
        <ToneChip tone={t.open ? 'info' : 'ok'}>{t.open ? 'Open' : 'Closed'}</ToneChip>
        <span className="min-w-0 flex-1 basis-full truncate font-medium text-ink sm:basis-auto">{t.title}</span>
        <span className="flex items-center gap-1 text-xs text-muted">
          <MessageSquare size={13} aria-hidden="true" /> {t.messages.length}
        </span>
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-line px-4 py-4">
          <p className="text-xs text-muted">
            Raised by <b className="text-ink">{t.mine ? 'you' : t.authorName}</b> · {t.createdAt}
            {t.toName && (
              <>
                {' '}
                · To <b className="text-ink">{t.toName}</b>
              </>
            )}
            {t.category && <> · {t.category}</>}
            {t.closedAt && <> · Closed {t.closedAt}</>}
          </p>
          <RichText text={t.body} className="text-sm" />

          <Thread t={t} currentUserId={currentUserId} />

          {t.canClose && (
            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
              {t.open ? (
                <button type="button" className="btn-ghost gap-1 border border-line" onClick={() => (close.clear(), setAsking(true))}>
                  <CheckCircle2 size={15} aria-hidden="true" /> Close ticket
                </button>
              ) : (
                <button type="button" className="btn-ghost border border-line" disabled={close.pending} onClick={() => close.exec(() => resolveFeedbackAction(t.id))}>
                  Reopen ticket
                </button>
              )}
              <ActionMessage result={close.result} />
            </div>
          )}
        </div>
      )}

      {asking && (
        <ConfirmDialog
          title={`Close ${t.code}?`}
          description="Both of you can still read it. You can reopen it any time."
          confirmLabel="Close ticket"
          tone="warn"
          pending={close.pending}
          error={close.result && !close.result.ok ? close.result.error : null}
          onCancel={() => setAsking(false)}
          onConfirm={() => close.exec(() => resolveFeedbackAction(t.id), () => setAsking(false))}
        />
      )}
    </li>
  );
}

function Thread({ t, currentUserId }: { t: TicketView; currentUserId: string }) {
  const { pending, result, exec } = useRun();
  const [text, setText] = useState('');
  const send = () => text.trim() && exec(() => replyFeedbackAction(t.id, text), () => setText(''));
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Conversation · {t.messages.length}</h3>
      {t.messages.length > 0 && (
        <ul className="mb-3 space-y-3">
          {t.messages.map(m => {
            const me = m.authorId === currentUserId;
            return (
              <li key={m.id} className={`flex gap-2 ${me ? 'flex-row-reverse' : ''}`}>
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold text-muted" aria-hidden="true">
                  {initial(m.authorName)}
                </span>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${me ? 'rounded-tr-sm bg-brand-soft text-ink' : 'rounded-tl-sm bg-surface-2 text-ink'}`}>
                  <p className="mb-0.5 text-2xs text-muted">
                    <b className="font-semibold text-ink">{me ? 'You' : m.authorName}</b> · {m.at}
                  </p>
                  <RichText text={m.body} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {t.canReply && t.open ? (
        <div>
          <div className="flex items-end gap-2">
            <textarea
              className="input min-h-11 flex-1"
              rows={2}
              aria-label={`Message on ${t.code}`}
              placeholder="Type your message…"
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <button type="button" className="btn-primary gap-1" disabled={pending || !text.trim()} onClick={send}>
              <Send size={14} aria-hidden="true" /> Send
            </button>
          </div>
          <ActionMessage result={result} />
        </div>
      ) : (
        !t.open && <p className="text-xs text-muted">This ticket is closed. Reopen it to continue the chat.</p>
      )}
    </div>
  );
}
