'use client';

import { ArrowRight, Lock, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { addStageAction, removeStageAction, saveStageAction, type ActionResult } from '@/app/actions';
import { ActionMessage } from './controls';
import { Checkbox, Field, OptionList, Segmented } from './form';
import { Modal } from './modal';
import { StatusBadge, ToneChip } from './ui';
import type { StageView } from '@/server/stages';
import type { Actor, StageState, StatusCategory } from '@/modules/types';

const KINDS: { value: StatusCategory; label: string }[] = [
  { value: 'queue', label: 'Waiting' },
  { value: 'active', label: 'Being worked' },
  { value: 'review', label: 'In review' },
  { value: 'feedback', label: 'Sent back' },
  { value: 'approved', label: 'Approved' },
  { value: 'done', label: 'Done' },
  { value: 'hold', label: 'On hold' },
];
const kindLabel = (c: StatusCategory) => KINDS.find(k => k.value === c)?.label ?? c;

const STATES: { value: StageState; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'skipped', label: 'Skipped' },
];
const STATE_HELP: Record<StageState, string> = {
  active: 'Items move through it as normal.',
  paused: 'Items reach it and wait there (counted as on hold) until you set it back to Active.',
  skipped: 'Moves jump straight past it. Items already in it can still move on.',
};
const STATE_TONE: Record<StageState, 'ok' | 'warn' | 'muted'> = { active: 'ok', paused: 'warn', skipped: 'muted' };

export type ActorLabels = { assignee: string; owner: string; developer?: string };

function actorOptions(l: ActorLabels): { value: Actor; label: string; help: string }[] {
  return [
    { value: 'ASSIGNEE', label: `The assigned ${l.assignee}`, help: 'Only on items assigned to them' },
    { value: 'OWNER', label: `The item’s ${l.owner}`, help: 'Only on items where they are set, and they need a reviewing role' },
    ...(l.developer ? [{ value: 'DEVELOPER' as Actor, label: `The item’s ${l.developer}`, help: 'Only on items where they are set' }] : []),
    { value: 'assign', label: 'Stewards', help: 'Anyone whose role assigns people' },
    { value: 'review', label: 'Any reviewer', help: 'Anyone whose role reviews' },
    { value: 'work', label: 'Anyone who does the work', help: 'On every item, not only their own' },
    { value: 'manageFields', label: 'Anyone who edits details', help: '' },
    { value: 'create', label: 'Anyone who adds items', help: '' },
  ];
}

export function actorText(by: Actor[], l: ActorLabels): string {
  if (!by.length) return 'admins only';
  const opts = actorOptions(l);
  return by.map(a => opts.find(o => o.value === a)?.label ?? a).join(' or ');
}

type Draft = { label: string; color: string; category: StatusCategory; state: StageState; nextLabel: string; movedBy: Actor[]; stuckHours: string };

const draftOf = (s: StageView): Draft => ({ label: s.label, color: s.color, category: s.category, state: s.state, nextLabel: s.nextLabel ?? '', movedBy: s.movedBy, stuckHours: s.stuckHours == null ? '' : String(s.stuckHours) });
const NEW_STAGE: Draft = { label: '', color: '#78909c', category: 'active', state: 'active', nextLabel: 'Mark done', movedBy: ['assign'], stuckHours: '' };

function StageForm({ draft, setDraft, locked, pipeline, labels }: { draft: Draft; setDraft: (d: Draft) => void; locked: boolean; pipeline: boolean; labels: ActorLabels }) {
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft({ ...draft, [k]: v });
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <Field label="Name">
          <input className="input" value={draft.label} onChange={e => set('label', e.target.value)} placeholder="e.g. QA check" />
        </Field>
        <Field label="Colour">
          <input type="color" className="h-9 w-16 cursor-pointer rounded-md border border-line bg-surface p-1" value={draft.color} onChange={e => set('color', e.target.value)} aria-label="Colour" />
        </Field>
      </div>
      <Field label="Kind" help={locked ? 'Fixed for this stage.' : 'Decides where it counts on the dashboards: waiting, being worked, in review…'}>
        <select className="input" value={draft.category} disabled={locked} onChange={e => set('category', e.target.value as StatusCategory)}>
          {KINDS.filter(k => k.value !== 'hold').map(k => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </Field>
      {pipeline && (
        <>
          <Field label="State" help={locked ? 'This stage is a fixed part of the flow; it is always active.' : STATE_HELP[draft.state]}>
            {locked ? <ToneChip tone="ok">Active</ToneChip> : <Segmented value={draft.state} onChange={v => set('state', v)} options={STATES} label="State" />}
          </Field>
          <Field label="Button to move on" help="The button people press when this stage is finished.">
            <input className="input" value={draft.nextLabel} onChange={e => set('nextLabel', e.target.value)} placeholder="Mark done" />
          </Field>
          <div>
            <span className="label">Who may press it</span>
            <OptionList>
              {actorOptions(labels).map(o => (
                <Checkbox
                  key={o.value}
                  checked={draft.movedBy.includes(o.value)}
                  onChange={on => set('movedBy', on ? [...draft.movedBy, o.value] : draft.movedBy.filter(a => a !== o.value))}
                  label={o.label}
                  help={o.help}
                />
              ))}
            </OptionList>
            <p className="mt-1 text-xs text-muted">Admins can always move items. Nothing ticked = admins only.</p>
          </div>
        </>
      )}
      <Field label="Time limit (working hours)" help="Items here longer than this show under Needs attention. Empty = the default for its kind. One working day = 9 hours.">
        <input className="input w-32" type="number" min="0" step="0.25" value={draft.stuckHours} onChange={e => set('stuckHours', e.target.value)} />
      </Field>
    </div>
  );
}

const toInput = (d: Draft) => ({ label: d.label, color: d.color, category: d.category, state: d.state, nextLabel: d.nextLabel || null, movedBy: d.movedBy, stuckHours: d.stuckHours === '' ? null : Number(d.stuckHours) });

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

/** Admin → Work types → Stages: the flow in order, each stage editable; add a stage after any stage with a "next" button. */
export function StageEditor({ workTypeId, stages, labels, noun }: { workTypeId: string; stages: StageView[]; labels: ActorLabels; noun: string }) {
  const [editing, setEditing] = useState<StageView | null>(null);
  const [adding, setAdding] = useState<StageView | null>(null);
  const [draft, setDraft] = useState<Draft>(NEW_STAGE);
  const [removing, setRemoving] = useState<string | null>(null);
  const { pending, result, exec, clear } = useRun();
  const main = stages.filter(s => !s.side).map(s => s.key);
  const last = main.at(-1);

  return (
    <>
      <ol className="space-y-2">
        {stages.map(s => (
          <li key={s.key} className={`card px-4 py-3 ${s.side ? 'ml-6 border-dashed sm:ml-10' : ''} ${s.state === 'skipped' ? 'opacity-60' : ''}`}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-6 text-right text-xs text-muted tabular-nums">{s.side ? '↺' : main.indexOf(s.key) + 1}</span>
                  <StatusBadge label={s.label} color={s.color} />
                  <ToneChip tone={STATE_TONE[s.state]}>{STATES.find(x => x.value === s.state)?.label}</ToneChip>
                  <span className="text-xs text-muted">{kindLabel(s.category)}</span>
                  {s.locked && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted" title="Can be renamed but not paused, skipped or removed">
                      <Lock size={12} aria-hidden="true" /> fixed
                    </span>
                  )}
                  {s.custom && <ToneChip tone="info">added</ToneChip>}
                  {s.here > 0 && (
                    <span className="text-xs text-muted">
                      {s.here} {noun}
                      {s.here === 1 ? '' : 's'} here now
                    </span>
                  )}
                  {s.stuckHours != null && <span className="text-xs text-muted">limit {s.stuckHours} h</span>}
                  {s.phase && <span className="text-xs text-muted">phase: {s.phase}</span>}
                </div>
                {s.moves.length > 0 ? (
                  <ul className="mt-1.5 space-y-0.5 pl-8 text-xs text-muted">
                    {s.moves.map(m => (
                      <li key={`${m.label}-${m.to}`} className="flex flex-wrap items-center gap-1">
                        <b className="font-medium text-ink">{m.label}</b>
                        <ArrowRight size={12} aria-hidden="true" />
                        {m.toLabel}
                        <span>· {actorText(m.by, labels)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1.5 pl-8 text-xs text-muted">{s.state === 'paused' ? 'Paused: no button until it is active again (admins can still move items).' : s.key === last ? 'Last stage.' : 'No moves out of this stage.'}</p>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-1 pl-8 sm:pl-0">
                <button type="button" className="btn-ghost min-h-8 gap-1 px-2.5 text-xs" onClick={() => (clear(), setDraft(draftOf(s)), setEditing(s))}>
                  <Pencil size={14} aria-hidden="true" /> Edit
                </button>
                {s.pipeline && !s.side && (
                  <button type="button" className="btn-ghost min-h-8 gap-1 px-2.5 text-xs" onClick={() => (clear(), setDraft(NEW_STAGE), setAdding(s))}>
                    <Plus size={14} aria-hidden="true" /> Add after
                  </button>
                )}
                {!s.locked && (s.custom || s.pipeline) && s.state !== 'skipped' &&
                  (removing === s.key ? (
                    <span className="confirm inline-flex items-center gap-1.5 text-xs">
                      <span className="text-muted">{s.custom && !s.used ? 'Remove?' : 'Skip it?'}</span>
                      <button type="button" className="btn-danger min-h-7 px-2.5 py-0.5 text-xs" disabled={pending} onClick={() => exec(() => removeStageAction(workTypeId, s.key), () => setRemoving(null))}>
                        {s.custom && !s.used ? 'Remove' : 'Skip'}
                      </button>
                      <button type="button" className="btn-ghost min-h-7 px-2.5 py-0.5 text-xs" onClick={() => setRemoving(null)}>
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button type="button" className="btn-icon hover:bg-bad-soft hover:text-bad" aria-label={`Remove ${s.label}`} title={s.custom && !s.used ? 'Remove stage' : 'Has history: skip instead of remove'} onClick={() => (clear(), setRemoving(s.key))}>
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  ))}
              </div>
            </div>
          </li>
        ))}
      </ol>
      {!editing && !adding && <ActionMessage result={result} />}

      {editing && (
        <Modal title={`Edit stage: ${editing.label}`} subtitle={`Key ${editing.key} · stays the same, so history and reports keep working.`} onClose={() => setEditing(null)}>
          <StageForm draft={draft} setDraft={setDraft} locked={editing.locked} pipeline={editing.pipeline && !editing.side} labels={labels} />
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="button" className="btn-primary" disabled={pending || !draft.label.trim()} onClick={() => exec(() => saveStageAction(workTypeId, editing.key, toInput(draft)), () => setEditing(null))}>
              {pending ? 'Saving…' : 'Save stage'}
            </button>
          </div>
          <ActionMessage result={result} />
        </Modal>
      )}

      {adding && (
        <Modal title={`Add a stage after ${adding.label}`} subtitle={`“${adding.nextLabel ?? 'Next'}” on ${adding.label} will lead here; this stage’s button leads on to the stage that came next.`} onClose={() => setAdding(null)}>
          <StageForm draft={draft} setDraft={setDraft} locked={false} pipeline labels={labels} />
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setAdding(null)}>
              Cancel
            </button>
            <button type="button" className="btn-primary" disabled={pending || !draft.label.trim()} onClick={() => exec(() => addStageAction(workTypeId, adding.key, toInput(draft)), () => setAdding(null))}>
              {pending ? 'Adding…' : 'Add stage'}
            </button>
          </div>
          <ActionMessage result={result} />
        </Modal>
      )}
    </>
  );
}
