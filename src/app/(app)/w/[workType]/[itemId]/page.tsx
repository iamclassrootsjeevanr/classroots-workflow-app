import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AssignSelect, CommentForm, FeedbackForm, FieldsForm, ResolveFeedbackButton, StatusSelect, type EditableField } from '@/components/controls';
import { StageTimeline } from '@/components/stage-timeline';
import { Card, Delay, StatusBadge } from '@/components/ui';
import { delayDays } from '@/lib/analytics-core';
import { businessMinutesBetween, formatDate, formatDateTime, formatDuration, instantToDateKey } from '@/lib/time';
import { canSeeItem } from '@/lib/access-core';
import { allowedTransitions, canEditField, hasCap } from '@/lib/workflow';
import { getModule, statusDef } from '@/modules/registry';
import { db } from '@/server/db';
import { actorContextFor, requireAccess, requireWorkTypePage } from '@/server/access';
import { appTz, workCalendar } from '@/server/settings';
import { loadItems } from '@/server/services/analytics';
import { assignablePeople } from '@/server/view';

const EVENT_TEXT: Record<string, string> = {
  CREATED: 'created',
  IMPORTED: 'imported',
  STATUS_CHANGED: 'changed status',
  ASSIGNED: 'assigned',
  UNASSIGNED: 'unassigned',
  FIELD_CHANGED: 'updated',
  FEEDBACK: 'gave feedback',
  COMMENTED: 'commented',
  SYNC_CONFLICT: 'sync conflict',
};

export async function generateMetadata({ params }: { params: Promise<{ workType: string; itemId: string }> }) {
  const { workType, itemId } = await params;
  const { access } = await requireAccess();
  const item = await db.workItem.findUnique({ where: { id: itemId }, select: { externalKey: true, title: true, assigneeId: true, ownerId: true, createdById: true } });
  // Never reveal a title the person isn't allowed to see.
  return { title: item && canSeeItem(access, workType, item) ? `${item.externalKey} ${item.title}` : 'Not found' };
}

export default async function ItemPage({ params }: { params: Promise<{ workType: string; itemId: string }> }) {
  const { workType: key, itemId } = await params;
  const { access } = await requireWorkTypePage(key, 'items');
  const mod = getModule(key);
  const item = await db.workItem.findUnique({
    where: { id: itemId },
    include: {
      workType: true,
      assignee: { select: { id: true, name: true } },
      owner: { select: { name: true } },
      chapter: true,
      intervals: { orderBy: { enteredAt: 'asc' }, include: { assignee: { select: { name: true } } } },
      events: { orderBy: { at: 'desc' }, take: 200, include: { actor: { select: { name: true, email: true } } } },
      feedback: { orderBy: { createdAt: 'desc' }, include: { author: { select: { name: true } } } },
    },
  });
  if (!mod || !item || item.workType.key !== key) notFound();
  if (!canSeeItem(access, key, item)) notFound();

  const tz = appTz();
  const cal = await workCalendar();
  const now = new Date();
  const ctx = actorContextFor(access, key, item);
  const editable = item.workType.state === 'ACTIVE';
  const def = statusDef(mod, item.status);
  const transitions = editable
    ? allowedTransitions(mod, item.status, ctx).map(t => ({ to: t.to, label: t.label ?? statusDef(mod, t.to).label, statusLabel: statusDef(mod, t.to).label }))
    : [];
  const people = hasCap(ctx, 'assign') && editable ? await assignablePeople(await loadItems({ workTypeKeys: [key] }), [key]) : null;
  const data = (item.data ?? {}) as Record<string, unknown>;
  const fields: EditableField[] = mod.fields.map(f => ({
    key: f.key,
    label: f.label,
    type: f.type,
    linkLabel: f.linkLabel,
    value: f.key === 'dueAt' ? instantToDateKey(item.dueAt, tz) : data[f.key] == null ? '' : String(data[f.key]),
    editable: editable && canEditField(f, ctx),
  }));
  const isReviewer = hasCap(ctx, 'review');
  const canRequestCorrections = isReviewer && transitions.some(t => statusDef(mod, t.to).category === 'feedback');
  const delay = delayDays({ dueAt: item.dueAt, completedAt: item.completedAt, category: def.category }, now);

  const intervals = item.intervals.map(iv => {
    const d = statusDef(mod, iv.status);
    return {
      status: iv.status,
      label: d.label,
      color: d.color,
      enteredAt: iv.enteredAt,
      exitedAt: iv.exitedAt,
      round: iv.round,
      assigneeName: iv.assignee?.name ?? null,
      businessMinutes: iv.businessMinutes ?? businessMinutesBetween(iv.enteredAt, iv.exitedAt ?? now, cal),
    };
  });

  const milestones: [string, Date | null][] = [
    ['Received', item.receivedAt],
    ['Assigned', item.assignedAt],
    ['Started', item.firstStartedAt],
    ['Last submitted', item.lastSubmittedAt],
    ['First review', item.firstReviewAt],
    ['Last feedback', item.lastFeedbackAt],
    ['Approved', item.approvedAt],
    ['Completed', item.completedAt],
  ];
  const label = (s: string | null) => (s ? statusDef(mod, s).label : '—');

  return (
    <>
      <nav className="mb-2 text-sm text-muted">
        <Link href={`/w/${key}`} className="link">
          {mod.name}
        </Link>{' '}
        / <span className="font-mono">{item.externalKey}</span>
      </nav>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{item.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {[item.groupKey, item.chapter?.title ?? (data.chapterTitle as string | undefined), item.chapter?.grade ? `Grade ${item.chapter.grade}` : null].filter(Boolean).join(' · ')}
            {item.owner?.name && <> · SME {item.owner.name}</>}
          </p>
          {item.sheetMissing && <p className="mt-1 text-xs text-warn">⚠ Not found in the Google Sheet on the last sync.</p>}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <span className="label">Status</span>
            <StatusSelect itemId={item.id} version={item.version} current={{ key: item.status, label: def.label, color: def.color }} options={transitions} />
          </div>
          <div className="min-w-52">
            <span className="label">{mod.labels?.assignee ?? 'Developer'}</span>
            {people ? <AssignSelect itemId={item.id} assigneeId={item.assigneeId} people={people} /> : <div className="py-1.5 text-sm">{item.assignee?.name ?? 'Unassigned'}</div>}
          </div>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-8">
        {milestones.map(([name, at]) => (
          <div key={name} className="card px-3 py-2.5">
            <div className="text-[11px] font-medium text-muted">{name}</div>
            <div className={`mt-0.5 text-xs tabular-nums ${at ? 'text-ink' : 'text-muted'}`}>{at ? formatDateTime(at, tz) : '—'}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="min-w-0 space-y-5 xl:col-span-2">
          <Card title="Stage timeline" actions={<span className="text-xs text-muted">business hours: {cal.startHour}:00–{cal.endHour}:00</span>}>
            <StageTimeline intervals={intervals} now={now} tz={tz} />
          </Card>

          <Card title="Details & links">
            <FieldsForm itemId={item.id} fields={fields} />
          </Card>

          <Card title={`Feedback (${item.feedback.length})`}>
            {isReviewer && editable && (
              <div className="mb-4">
                <FeedbackForm itemId={item.id} canRequestCorrections={canRequestCorrections} />
              </div>
            )}
            {item.feedback.length ? (
              <ul className="space-y-3">
                {item.feedback.map(f => (
                  <li key={f.id} className={`rounded-md border p-3 ${f.resolvedAt ? 'border-line bg-canvas' : 'border-red-100 bg-red-50/40'}`}>
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <b className="text-ink">{f.author?.name ?? 'Reviewer'}</b>· round {f.round} · {formatDateTime(f.createdAt, tz)}
                      {f.category && <span className="rounded bg-white px-1.5">{f.category}</span>}
                      {f.severity && <span className={`rounded px-1.5 ${f.severity === 'Blocker' ? 'bg-red-100 text-bad' : 'bg-white'}`}>{f.severity}</span>}
                      {f.resolvedAt && <span className="text-ok">resolved {formatDateTime(f.resolvedAt, tz)}</span>}
                      <span className="ml-auto">{(ctx.isAssignee || isReviewer) && <ResolveFeedbackButton id={f.id} resolved={Boolean(f.resolvedAt)} />}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{f.body}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No feedback yet.</p>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-5">
          <Card title="Summary">
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-muted">Status</dt>
              <dd>
                <StatusBadge label={def.label} color={def.color} />
              </dd>
              <dt className="text-muted">Expected</dt>
              <dd>{formatDate(item.dueAt, tz) || '—'}</dd>
              <dt className="text-muted">Delay</dt>
              <dd>
                <Delay days={delay} />
              </dd>
              <dt className="text-muted">Review rounds</dt>
              <dd>{item.reviewRounds}</dd>
              <dt className="text-muted">Feedback items</dt>
              <dd>{item.feedbackCount}</dd>
              <dt className="text-muted">Reopened</dt>
              <dd>{item.reopenCount}</dd>
              <dt className="text-muted">Wait before start</dt>
              <dd>{item.assignedAt && item.firstStartedAt ? formatDuration(businessMinutesBetween(item.assignedAt, item.firstStartedAt, cal)) : '—'}</dd>
              <dt className="text-muted">Cycle time</dt>
              <dd>{item.firstStartedAt ? formatDuration(businessMinutesBetween(item.firstStartedAt, item.completedAt ?? now, cal)) + (item.completedAt ? '' : ' so far') : '—'}</dd>
            </dl>
          </Card>

          <Card title="Activity">
            <div className="mb-3">
              {(ctx.isAdmin || ctx.canEdit) && editable ? <CommentForm itemId={item.id} /> : <p className="text-xs text-muted">View only.</p>}
            </div>
            <ol className="space-y-2.5 text-sm">
              {item.events.map(e => (
                <li key={e.id} className="border-l-2 border-line pl-3">
                  <div className="text-xs text-muted tabular-nums">{formatDateTime(e.at, tz)}</div>
                  <div>
                    <b>{e.actor?.name ?? e.actor?.email ?? (e.source === 'SHEET' ? 'Google Sheet' : e.source === 'IMPORT' ? 'Import' : 'System')}</b>{' '}
                    <span className="text-muted">{EVENT_TEXT[e.type] ?? e.type.toLowerCase()}</span>{' '}
                    {e.type === 'STATUS_CHANGED' && (
                      <>
                        {label(e.fromValue)} → <b>{label(e.toValue)}</b>
                      </>
                    )}
                    {(e.type === 'CREATED' || e.type === 'IMPORTED') && <>as {label(e.toValue)}</>}
                    {(e.type === 'ASSIGNED' || e.type === 'UNASSIGNED') && <>{e.fromValue ? `${e.fromValue} → ` : ''}<b>{e.toValue ?? 'nobody'}</b></>}
                    {(e.type === 'FIELD_CHANGED' || e.type === 'SYNC_CONFLICT') && (
                      <>
                        <span className="font-medium">{e.field}</span>
                        <span className="block truncate text-xs text-muted" title={`${e.fromValue ?? '—'} → ${e.toValue ?? '—'}`}>
                          {e.fromValue ?? '—'} → {e.toValue ?? '—'}
                        </span>
                      </>
                    )}
                    {e.note && <p className="mt-0.5 text-sm whitespace-pre-wrap text-ink/90">{e.note}</p>}
                    {e.source === 'SHEET' && e.type !== 'IMPORTED' && <span className="ml-1 rounded bg-emerald-50 px-1 text-[10px] text-emerald-700">from sheet</span>}
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}
