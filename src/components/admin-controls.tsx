'use client';

import { useState, useTransition } from 'react';
import type { WorkTypeState } from '@prisma/client';
import {
  createItemAction,
  enableModuleAction,
  setWorkTypeStateAction,
  syncNowAction,
  updateSyncAction,
  type ActionResult,
} from '@/app/actions';
import type { SyncDirection } from '@/server/services/work-items';
import { ActionMessage, type PersonOption } from './controls';
import { Segmented, Switch } from './form';

function useAction() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const exec = (fn: () => Promise<ActionResult>, onOk?: () => void) =>
    start(async () => {
      const r = await fn();
      setResult(r);
      if (r.ok) onOk?.();
    });
  return { pending, result, exec };
}

export function NewItemForm({
  workTypeId,
  noun,
  smes,
  developers,
  labels,
  groups,
  keyExample = 'G07C04J05',
  showDue = true,
}: {
  workTypeId: string;
  noun: string;
  smes: PersonOption[];
  developers: PersonOption[];
  labels?: { assignee?: string; owner?: string; group?: string; due?: string };
  /** Groups the person may add to (a coordinator: their chapters). Absent = free text. */
  groups?: string[];
  keyExample?: string;
  /** False when the module works the due date out itself (Journey: Closure due). */
  showDue?: boolean;
}) {
  const { pending, result, exec } = useAction();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ externalKey: '', title: '', groupKey: '', ownerId: '', assigneeId: '', dueAt: '' });
  const groupLabel = labels?.group ?? 'Group (chapter code / version)';
  if (!open) {
    return (
      <button className="btn-primary" onClick={() => setOpen(true)}>
        + New {noun}
      </button>
    );
  }
  const field = (k: keyof typeof v) => ({ value: v[k], onChange: (e: { target: { value: string } }) => setV(s => ({ ...s, [k]: e.target.value })) });
  return (
    <form
      className="card mb-5 w-full"
      onSubmit={e => {
        e.preventDefault();
        exec(() => createItemAction(workTypeId, v), () => setV({ externalKey: '', title: '', groupKey: '', ownerId: '', assigneeId: '', dueAt: '' }));
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <label>
          <span className="label">Key (e.g. {keyExample})</span>
          <input className="input font-mono" required {...field('externalKey')} />
        </label>
        <label className="sm:col-span-2">
          <span className="label">Title</span>
          <input className="input" required {...field('title')} />
        </label>
        <label>
          <span className="label">{groupLabel}</span>
          {groups ? (
            <select className="input font-mono" {...field('groupKey')}>
              <option value="">{groups.length === 1 ? groups[0] : 'From the key'}</option>
              {groups.length > 1 &&
                groups.map(g => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
            </select>
          ) : (
            <input className="input font-mono" placeholder="G07C04" {...field('groupKey')} />
          )}
        </label>
        <label>
          <span className="label">{labels?.owner ?? 'SME'}</span>
          <select className="input" {...field('ownerId')}>
            <option value="">—</option>
            {smes.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">{labels?.assignee ?? 'Developer'}</span>
          <select className="input" {...field('assigneeId')}>
            <option value="">Unassigned</option>
            {developers.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.hint ? ` · ${p.hint}` : ''}
              </option>
            ))}
          </select>
        </label>
        {showDue && (
          <label>
            <span className="label">{labels?.due ?? 'Expected completion'}</span>
            <input className="input" type="date" {...field('dueAt')} />
          </label>
        )}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button className="btn-primary" disabled={pending}>
          {pending ? 'Creating…' : `Create ${noun}`}
        </button>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
          Close
        </button>
        <ActionMessage result={result} />
      </div>
    </form>
  );
}

export function WorkTypeStateButtons({ id, state }: { id: string; state: WorkTypeState }) {
  const { pending, result, exec } = useAction();
  const go = (s: WorkTypeState, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    exec(() => setWorkTypeStateAction(id, s));
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {state !== 'ACTIVE' && (
        <button className="btn-primary" disabled={pending} onClick={() => go('ACTIVE')}>
          Resume
        </button>
      )}
      {state === 'ACTIVE' && (
        <button className="btn-ghost" disabled={pending} onClick={() => go('PAUSED', 'Pause this work type? People can still see it, but nobody can change items and sync stops.')}>
          Pause
        </button>
      )}
      {state !== 'ARCHIVED' && (
        <button className="btn-danger" disabled={pending} onClick={() => go('ARCHIVED', 'Archive this work type? It disappears from navigation; its data stays in reports.')}>
          Archive
        </button>
      )}
      <ActionMessage result={result} />
    </div>
  );
}

export function EnableModuleButton({ moduleKey }: { moduleKey: string }) {
  const { pending, result, exec } = useAction();
  return (
    <div>
      <button className="btn-primary" disabled={pending} onClick={() => exec(() => enableModuleAction(moduleKey))}>
        Enable
      </button>
      <ActionMessage result={result} />
    </div>
  );
}

export function SyncSettings({ id, enabled, tab, spreadsheetId, direction, configured }: { id: string; enabled: boolean; tab: string; spreadsheetId: string; direction: SyncDirection; configured: boolean }) {
  const { pending, result, exec } = useAction();
  const [v, setV] = useState({ enabled, tab, spreadsheetId, direction });
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={e => {
        e.preventDefault();
        exec(() => updateSyncAction(id, v));
      }}
    >
      <div className="w-full overflow-hidden rounded-xl border border-line">
        <Switch checked={v.enabled} disabled={!configured} onChange={enabled => setV({ ...v, enabled })} label="Sync with Google Sheet" help={configured ? undefined : 'Set APPS_SCRIPT_URL and SYNC_TOKEN first'} />
      </div>
      <div className="w-full">
        <span className="label">Direction</span>
        <Segmented
          label="Direction"
          value={v.direction}
          onChange={direction => setV({ ...v, direction })}
          options={[
            { value: 'app-to-sheet', label: 'App → sheet' },
            { value: 'two-way', label: 'Two-way' },
          ]}
        />
        <p className="mt-1 text-xs text-muted">
          {v.direction === 'app-to-sheet'
            ? 'The sheet mirrors the app. Edits made in the sheet are overwritten; rows only in the sheet are left alone.'
            : 'Edits made in the sheet are pulled into the app and new sheet rows become items. If both change a cell, the app wins.'}
        </p>
      </div>
      <label className="min-w-56">
        <span className="label">Sheet tab</span>
        <input className="input" value={v.tab} onChange={e => setV({ ...v, tab: e.target.value })} />
      </label>
      <label className="min-w-full flex-1 sm:min-w-72">
        <span className="label">Spreadsheet ID (blank = the script’s default sheet)</span>
        <input className="input font-mono text-xs" value={v.spreadsheetId} placeholder="from the sheet URL: /spreadsheets/d/<ID>/edit" onChange={e => setV({ ...v, spreadsheetId: e.target.value })} />
      </label>
      <button className="btn-ghost" disabled={pending || (v.enabled === enabled && v.tab === tab && v.spreadsheetId === spreadsheetId && v.direction === direction)}>
        Save
      </button>
      <ActionMessage result={result} />
    </form>
  );
}

export function SyncNowButton({ id, disabled }: { id: string; disabled?: boolean }) {
  const { pending, result, exec } = useAction();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button className="btn-primary" disabled={pending || disabled} onClick={() => exec(() => syncNowAction(id))}>
        {pending ? 'Syncing…' : 'Sync now'}
      </button>
      <ActionMessage result={result} />
    </div>
  );
}
