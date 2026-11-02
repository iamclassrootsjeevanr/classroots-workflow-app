'use client';

import { ArrowRight, Eye, MessageSquare, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState, useTransition } from 'react';
import { deleteRoleAction, saveRoleAction, type ActionResult, type RoleInput } from '@/app/actions';
import { CAPABILITIES, CAPABILITY_LABELS, PAGE_LABELS, type Capability, type PageKey } from '@/lib/access-core';
import { rolePreview, type FlowLite } from '@/lib/role-preview';
import { ActionMessage } from './controls';
import { Checkbox, GroupLabel, OptionList, Radio, Segmented } from './form';
import { StatusBadge } from './ui';

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

const blank: Omit<RoleInput, 'workTypeId'> = {
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

const capsOf = (v: RoleInput) => CAPABILITIES.filter(c => Boolean(v[CAP_FIELD[c]]));

/** Add or edit one role. Left: plain choices. Right: what those choices unlock in each work type's flow. */
export function RoleForm({ initial, members, isSystem, flows, workTypeId }: { initial?: RoleInput; members?: number; isSystem?: boolean; flows: FlowLite[]; /** The work type this role belongs to. */ workTypeId: string }) {
  const isNew = !initial?.id;
  const [v, setV] = useState<RoleInput>(initial ?? { ...blank, workTypeId });
  const [open, setOpen] = useState(!isNew);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const caps = capsOf(v);

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
            setV({ ...blank, workTypeId });
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
          <input className="input" required value={v.name} onChange={e => setV({ ...v, name: e.target.value })} placeholder="e.g. Tester, Reviewer, Client" />
        </label>
        <label>
          <span className="label">What this role is for</span>
          <input className="input" value={v.description ?? ''} onChange={e => setV({ ...v, description: e.target.value })} placeholder="One line people will see when picking it" />
        </label>
      </div>

      <div className="mt-5 grid gap-6 xl:grid-cols-[3fr_2fr]">
        {/* Choices */}
        <div className="space-y-5">
          <div>
            <GroupLabel>Can people with this role make changes?</GroupLabel>
            <Segmented<'edit' | 'view'>
              value={v.canEdit ? 'edit' : 'view'}
              onChange={m => setV({ ...v, canEdit: m === 'edit' })}
              options={[
                { value: 'edit', label: 'Yes, as ticked below', icon: <Pencil size={14} aria-hidden="true" /> },
                { value: 'view', label: 'No, view only', icon: <Eye size={14} aria-hidden="true" /> },
              ]}
              label="Can make changes"
            />
            {!v.canEdit && <p className="mt-2 text-xs text-muted">View only: they can open pages and read items, but cannot change status, edit details or comment. The ticks below are kept but switched off.</p>}
          </div>

          <div className={v.canEdit ? '' : 'opacity-50'}>
            <GroupLabel note={v.canEdit ? `${caps.length} of ${CAPABILITIES.length}` : 'off'}>What they can do</GroupLabel>
            <OptionList>
              {CAPABILITIES.map(c => {
                const field = CAP_FIELD[c];
                return <Checkbox key={c} checked={Boolean(v[field])} disabled={!v.canEdit} onChange={on => setV({ ...v, [field]: on })} label={CAPABILITY_LABELS[c].label} help={CAPABILITY_LABELS[c].help} />;
              })}
            </OptionList>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <GroupLabel>Which items they see</GroupLabel>
              <OptionList>
                <Radio name="scope" checked={v.dataScope === 'OWN'} onChange={() => setV({ ...v, dataScope: 'OWN' })} label="Only their own" help="Assigned to, owned by or created by them" />
                <Radio name="scope" checked={v.dataScope === 'ALL'} onChange={() => setV({ ...v, dataScope: 'ALL' })} label="Everything" help="Every item in the work type" />
              </OptionList>
            </div>
            <div>
              <GroupLabel>Pages they can open</GroupLabel>
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
        </div>

        {/* Live preview */}
        <RolePreviewPanel v={v} flows={flows} />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
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
            {members ?? 0} {members === 1 ? 'person has' : 'people have'} this role{isSystem ? ' · built-in (can’t be removed)' : ''}
          </span>
        )}
        <ActionMessage result={result} />
      </div>
    </form>
  );
}

/** What the current ticks unlock, per work type: status moves, editable details, items seen, pages. Updates as you tick. */
function RolePreviewPanel({ v, flows }: { v: RoleInput; flows: FlowLite[] }) {
  const [flowKey, setFlowKey] = useState(flows[0]?.key ?? '');
  const flow = flows.find(f => f.key === flowKey) ?? flows[0];
  const preview = useMemo(() => (flow ? rolePreview(flow, { capabilities: capsOf(v), canEdit: v.canEdit, dataScope: v.dataScope }) : null), [flow, v]);
  const pages = (Object.keys(PAGE_FIELD) as PageKey[]).filter(p => v[PAGE_FIELD[p]] && (p !== 'export' || v.pageReports));

  if (!flow || !preview) return null;
  const noun = flow.itemNoun;

  return (
    <aside className="rounded-xl border border-line bg-surface-2/60 p-4 xl:sticky xl:top-20 xl:self-start">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">What this means in the flow</h3>
        {flows.length > 1 && <Segmented value={flow.key} onChange={setFlowKey} options={flows.map(f => ({ value: f.key, label: f.name }))} size="sm" label="Work type" />}
      </div>

      {!pages.length ? (
        <p className="note-warn mt-3 text-xs">No pages ticked, so people with only this role cannot open {flow.name} at all.</p>
      ) : (
        <p className="mt-2 text-xs text-muted">
          In <b className="text-ink">{flow.name}</b> a person with only this role sees <b className="text-ink">{v.dataScope === 'ALL' ? `every ${noun}` : `only their own ${noun}s`}</b> on{' '}
          {pages.map(p => PAGE_LABELS[p].replace(' (CSV / Excel)', '')).join(', ')}.
        </p>
      )}

      <div className="mt-4">
        <div className="mb-1.5 text-2xs font-semibold tracking-wide text-muted uppercase">Status moves they can make · {preview.moves.length}</div>
        {preview.moves.length ? (
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
            {preview.moves.map(m => (
              <li key={`${m.from.key}-${m.to.key}`} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 text-xs">
                <StatusBadge label={m.from.label} color={m.from.color} />
                <ArrowRight size={12} className="text-muted" aria-hidden="true" />
                <StatusBadge label={m.to.label} color={m.to.color} />
                <span className="text-muted">{m.label}</span>
                {m.onlyOwnItems && <span className="ml-auto text-2xs text-muted">their own {noun}s only</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-line px-3 py-2 text-xs text-muted">None. {v.canEdit ? `Tick “${CAPABILITY_LABELS.work.label}” or “${CAPABILITY_LABELS.review.label}” to let them move ${noun}s along.` : 'View only.'}</p>
        )}
      </div>

      <div className="mt-4">
        <div className="mb-1.5 text-2xs font-semibold tracking-wide text-muted uppercase">Details they can edit · {preview.fields.length}</div>
        {preview.fields.length ? (
          <div className="flex flex-wrap gap-1.5">
            {preview.fields.map(f => (
              <span key={f.key} className="chip bg-surface ring-1 ring-line" title={f.onlyOwnItems ? `Only on their own ${noun}s` : 'On any item they can see'}>
                {f.label}
                {f.onlyOwnItems && <span className="ml-1 text-muted">· own</span>}
              </span>
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-line px-3 py-2 text-xs text-muted">None.</p>
        )}
      </div>

      <ul className="mt-4 space-y-1 text-xs text-muted">
        <li className="flex items-center gap-1.5">
          <MessageSquare size={12} aria-hidden="true" /> {preview.canComment ? 'Can comment on items.' : 'Cannot comment.'}
        </li>
        {v.capAssign && v.canEdit && <li>Can choose the {flow.assigneeLabel.toLowerCase()} on any {noun} they can see.</li>}
        {v.capCreate && v.canEdit && <li>Can add new {noun}s.</li>}
        <li>People with several roles get everything any of their roles allows.</li>
      </ul>
    </aside>
  );
}
