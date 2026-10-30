'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { deleteRoleAction, saveRoleAction, type ActionResult, type RoleInput } from '@/app/actions';
import { CAPABILITIES, CAPABILITY_LABELS, PAGE_LABELS, type Capability, type PageKey } from '@/lib/access-core';
import { ActionMessage } from './controls';
import { Checkbox, GroupLabel, OptionList, Radio, Switch } from './form';

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

/** Add or edit one role: what it can do, which data it sees, whether it may edit, and which pages it opens. */
export function RoleForm({ initial, members, isSystem }: { initial?: RoleInput; members?: number; isSystem?: boolean }) {
  const isNew = !initial?.id;
  const [v, setV] = useState<RoleInput>(initial ?? blank);
  const [open, setOpen] = useState(!isNew);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const caps = CAPABILITIES.filter(c => v[CAP_FIELD[c]]).length;

  if (isNew && !open) {
    return (
      <button className="btn-primary" onClick={() => setOpen(true)}>
        <Plus size={16} aria-hidden="true" />
        Add role
      </button>
    );
  }

  return (
    <form
      className={`card ${isNew ? 'ring-2 ring-brand/30' : ''}`}
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
      <div className="grid gap-3 sm:grid-cols-[auto_1fr_2fr]">
        <label className="flex flex-col">
          <span className="label">Colour</span>
          <span className="relative h-9 w-9 overflow-hidden rounded-lg border border-line shadow-sm" style={{ background: v.color }}>
            <input className="absolute -inset-2 h-14 w-14 cursor-pointer opacity-0" type="color" value={v.color} onChange={e => setV({ ...v, color: e.target.value })} aria-label="Role colour" />
          </span>
        </label>
        <label>
          <span className="label">Role name *</span>
          <input className="input" required value={v.name} onChange={e => setV({ ...v, name: e.target.value })} placeholder="e.g. QA, Client, Content writer" />
        </label>
        <label>
          <span className="label">What this role is for</span>
          <input className="input" value={v.description ?? ''} onChange={e => setV({ ...v, description: e.target.value })} placeholder="One line people will see when picking it" />
        </label>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div>
          <GroupLabel note={caps ? `${caps} of ${CAPABILITIES.length}` : 'look only'}>This role can…</GroupLabel>
          <OptionList>
            {CAPABILITIES.map(c => {
              const field = CAP_FIELD[c];
              return <Checkbox key={c} checked={Boolean(v[field])} onChange={on => setV({ ...v, [field]: on })} label={CAPABILITY_LABELS[c].label} help={CAPABILITY_LABELS[c].help} />;
            })}
          </OptionList>
        </div>

        <div>
          <GroupLabel>Data this role sees</GroupLabel>
          <OptionList>
            <Radio name="scope" checked={v.dataScope === 'OWN'} onChange={() => setV({ ...v, dataScope: 'OWN' })} label="Own data" help="Items assigned to, owned by or created by the person" />
            <Radio name="scope" checked={v.dataScope === 'ALL'} onChange={() => setV({ ...v, dataScope: 'ALL' })} label="All data" help="Every item in the work type" />
            <Switch checked={v.canEdit} onChange={canEdit => setV({ ...v, canEdit })} label="Can edit" help={v.canEdit ? 'Changes allowed by the ticks' : 'View only'} />
          </OptionList>
        </div>

        <div>
          <GroupLabel>Pages this role opens</GroupLabel>
          <OptionList>
            {(Object.keys(PAGE_FIELD) as PageKey[]).map(p => (
              <Checkbox
                key={p}
                checked={Boolean(v[PAGE_FIELD[p]]) && (p !== 'export' || v.pageReports)}
                disabled={p === 'export' && !v.pageReports}
                onChange={on => setV({ ...v, [PAGE_FIELD[p]]: on })}
                label={PAGE_LABELS[p]}
                help={p === 'export' && !v.pageReports ? 'Needs Reports' : undefined}
              />
            ))}
          </OptionList>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted">A person with several roles gets everything any of them grants: the widest data scope, edit rights if any role can edit, and every page.</p>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
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
            <Trash2 size={15} aria-hidden="true" />
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
