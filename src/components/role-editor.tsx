'use client';

import { useState, useTransition } from 'react';
import { deleteRoleAction, saveRoleAction, type ActionResult, type RoleInput } from '@/app/actions';
import { CAPABILITIES, CAPABILITY_LABELS, PAGE_LABELS, type Capability, type PageKey } from '@/lib/access-core';
import { ActionMessage } from './controls';

const CAP_FIELD: Record<Capability, keyof RoleInput> = {
  work: 'capWork',
  review: 'capReview',
  assign: 'capAssign',
  create: 'capCreate',
  manageFields: 'capManageFields',
};

const PAGE_FIELD: Record<PageKey, keyof RoleInput> = {
  dashboard: 'pageDashboard',
  items: 'pageItems',
  reports: 'pageReports',
  export: 'pageExport',
};

const blank: RoleInput = {
  name: '',
  description: '',
  color: '#1976d2',
  capWork: false,
  capReview: false,
  capAssign: false,
  capCreate: false,
  capManageFields: false,
  dataScope: 'OWN',
  canEdit: true,
  pageDashboard: true,
  pageItems: true,
  pageReports: false,
  pageExport: false,
};

function Tick({ checked, onChange, label, help, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; help?: string; disabled?: boolean }) {
  return (
    <label className={`flex items-start gap-2 rounded-lg border border-line p-2.5 text-sm transition-colors ${disabled ? 'opacity-50' : 'cursor-pointer hover:border-brand/40'} ${checked && !disabled ? 'border-brand/40 bg-brand-soft/40' : ''}`}>
      <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-brand" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
      <span>
        <b className="font-medium">{label}</b>
        {help && <span className="block text-xs text-muted">{help}</span>}
      </span>
    </label>
  );
}

/** Add or edit one role: what it can do, which data it sees, whether it may edit, and which pages it opens. */
export function RoleForm({ initial, members, isSystem }: { initial?: RoleInput; members?: number; isSystem?: boolean }) {
  const isNew = !initial?.id;
  const [v, setV] = useState<RoleInput>(initial ?? blank);
  const [open, setOpen] = useState(!isNew);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  if (isNew && !open) {
    return (
      <button className="btn-primary" onClick={() => setOpen(true)}>
        + Add role
      </button>
    );
  }

  return (
    <form
      className={`card ${isNew ? 'border-brand/40' : ''}`}
      onSubmit={e => {
        e.preventDefault();
        start(async () => {
          const r = await saveRoleAction(v);
          setResult(r);
          if (r.ok && isNew) {
            setV(blank);
            setOpen(false);
          }
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
        <label>
          <span className="label">Role name *</span>
          <input className="input" required value={v.name} onChange={e => setV({ ...v, name: e.target.value })} placeholder="e.g. QA, Client, Content writer" />
        </label>
        <label>
          <span className="label">What this role is for</span>
          <input className="input" value={v.description ?? ''} onChange={e => setV({ ...v, description: e.target.value })} />
        </label>
        <label>
          <span className="label">Colour</span>
          <input className="h-[38px] w-14 cursor-pointer rounded-md border border-line" type="color" value={v.color} onChange={e => setV({ ...v, color: e.target.value })} />
        </label>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[3fr_2fr]">
        <div>
          <div className="label">This role can…</div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {CAPABILITIES.map(c => {
              const field = CAP_FIELD[c];
              return <Tick key={c} checked={Boolean(v[field])} onChange={on => setV({ ...v, [field]: on })} label={CAPABILITY_LABELS[c].label} help={CAPABILITY_LABELS[c].help} />;
            })}
          </div>
          <p className="mt-2 text-xs text-muted">No ticks = can only look.</p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
          <div>
            <div className="label">Data this role sees</div>
            <div className="space-y-1.5">
              {(['OWN', 'ALL'] as const).map(scope => (
                <label key={scope} className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-sm ${v.dataScope === scope ? 'border-brand/40 bg-brand-soft/40' : 'border-line'}`}>
                  <input type="radio" className="mt-0.5 accent-brand" checked={v.dataScope === scope} onChange={() => setV({ ...v, dataScope: scope })} />
                  <span>
                    <b className="font-medium">{scope === 'OWN' ? 'Own data' : 'All data'}</b>
                    <span className="block text-xs text-muted">{scope === 'OWN' ? 'Only items assigned to, owned by or created by the person' : 'Every item in the work type'}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-2">
              <Tick checked={v.canEdit} onChange={canEdit => setV({ ...v, canEdit })} label="Can edit" help="Unticked = view only, whatever the ticks above allow." />
            </div>
          </div>
          <div>
            <div className="label">Pages this role opens</div>
            <div className="space-y-1.5">
              {(Object.keys(PAGE_FIELD) as PageKey[]).map(p => (
                <Tick
                  key={p}
                  checked={Boolean(v[PAGE_FIELD[p]]) && (p !== 'export' || v.pageReports)}
                  disabled={p === 'export' && !v.pageReports}
                  onChange={on => setV({ ...v, [PAGE_FIELD[p]]: on })}
                  label={PAGE_LABELS[p]}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted">A person with several roles gets everything any of them grants: the widest data scope, edit rights if any role can edit, and every page.</p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className="btn-primary" disabled={pending}>
          {pending ? 'Saving…' : isNew ? 'Add role' : 'Save role'}
        </button>
        {isNew && (
          <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
            Cancel
          </button>
        )}
        {!isNew && !isSystem && (
          <button
            type="button"
            className="btn-danger"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(`Remove the role “${v.name}”?`)) return;
              start(async () => setResult(await deleteRoleAction(v.id!)));
            }}
          >
            Remove role
          </button>
        )}
        {!isNew && (
          <span className="text-xs text-muted">
            {members ?? 0} access grant(s) use this role{isSystem ? ' · built-in (can’t be removed)' : ''}
          </span>
        )}
        <ActionMessage result={result} />
      </div>
    </form>
  );
}
