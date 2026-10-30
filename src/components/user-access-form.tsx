'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { saveUserAction, type ActionResult, type UserInput } from '@/app/actions';
import { CAPABILITY_LABELS, PAGE_LABELS, combineRoles, type Capability, type DataScope, type PageKey, type RoleLite } from '@/lib/access-core';
import { ActionMessage } from './controls';

export type WorkTypeOption = { id: string; name: string; state: string };
export type RoleOption = { id: string; name: string; description: string | null; color: string; capabilities: Capability[]; dataScope: DataScope; canEdit: boolean; pages: PageKey[] };
export type PersonChoice = { id: string; name: string; note?: string; access?: UserInput['access'] };
type AccessRow = UserInput['access'][number];

const emptyAccess = (workTypeId: string): AccessRow => ({ workTypeId, enabled: false, roleIds: [] });

/** Turn a role option back into the shape the access engine combines. */
function toRoleLite(r: RoleOption): RoleLite {
  return {
    id: r.id,
    name: r.name,
    color: r.color,
    capWork: r.capabilities.includes('work'),
    capReview: r.capabilities.includes('review'),
    capAssign: r.capabilities.includes('assign'),
    capCreate: r.capabilities.includes('create'),
    capManageFields: r.capabilities.includes('manageFields'),
    dataScope: r.dataScope,
    canEdit: r.canEdit,
    pageDashboard: r.pages.includes('dashboard'),
    pageItems: r.pages.includes('items'),
    pageReports: r.pages.includes('reports'),
    pageExport: r.pages.includes('export'),
  };
}

function Section({ n, title, help, children }: { n: number; title: string; help?: string; children: React.ReactNode }) {
  return (
    <section className="card">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white">{n}</span>
        <div>
          <h2 className="text-[15px] font-semibold">{title}</h2>
          {help && <p className="text-xs text-muted">{help}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Tick({ checked, onChange, label, help, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: React.ReactNode; help?: string; disabled?: boolean }) {
  return (
    <label className={`flex items-start gap-2 text-sm ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-brand" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
      <span>
        {label}
        {help && <span className="block text-xs text-muted">{help}</span>}
      </span>
    </label>
  );
}

/** What a set of roles adds up to, in words. */
function CombinedSummary({ roles }: { roles: RoleOption[] }) {
  if (!roles.length) return <span className="text-warn">Pick at least one role.</span>;
  const c = combineRoles(roles.map(toRoleLite));
  const caps = [...c.capabilities].map(k => CAPABILITY_LABELS[k].label.toLowerCase());
  return (
    <>
      <b>{roles.map(r => r.name).join(' + ')}</b> · {c.dataScope === 'ALL' ? 'all data' : 'own data only'} · {c.canEdit ? 'can edit' : 'view only'}
      <span className="block text-xs text-muted">
        Can: {c.canEdit && caps.length ? caps.join(', ') : 'look only'} · Sees: {[...c.pages].map(p => PAGE_LABELS[p]).join(', ') || 'no pages'}
      </span>
    </>
  );
}

/** One guided form for adding a person or changing their details and access. */
export function UserAccessForm({
  initial,
  workTypes,
  roles,
  placeholders,
  copySources,
  hasPassword,
  isSelf,
}: {
  initial: UserInput;
  workTypes: WorkTypeOption[];
  roles: RoleOption[];
  /** People imported from the sheet without an account yet (only when adding). */
  placeholders: PersonChoice[];
  /** Other people whose access can be copied. */
  copySources: PersonChoice[];
  hasPassword: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const isNew = !initial.id;
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [v, setV] = useState<UserInput>(() => ({
    ...initial,
    access: workTypes.map(wt => initial.access.find(a => a.workTypeId === wt.id) ?? emptyAccess(wt.id)),
  }));
  const set = (patch: Partial<UserInput>) => setV(s => ({ ...s, ...patch }));
  const setAccess = (workTypeId: string, patch: Partial<AccessRow>) =>
    setV(s => ({ ...s, access: s.access.map(a => (a.workTypeId === workTypeId ? { ...a, ...patch } : a)) }));
  const roleById = useMemo(() => new Map(roles.map(r => [r.id, r])), [roles]);
  const rolesOf = (a: AccessRow) => a.roleIds.map(id => roleById.get(id)).filter((r): r is RoleOption => Boolean(r));
  const applyAccess = (access?: UserInput['access']) => {
    if (access) set({ access: workTypes.map(wt => access.find(a => a.workTypeId === wt.id) ?? emptyAccess(wt.id)) });
  };

  const save = () =>
    start(async () => {
      const r = await saveUserAction({ ...v, password: v.password || undefined });
      setResult(r);
      if (r.ok && isNew && r.id) router.push(`/admin/users/${r.id}?added=1`);
      else if (r.ok) router.refresh();
    });

  return (
    <form
      className="space-y-5"
      onSubmit={e => {
        e.preventDefault();
        save();
      }}
    >
      <Section n={1} title="Who is this?" help="Basic details. Capacity = how many items they can carry at once (used for workload).">
        {isNew && placeholders.length > 0 && (
          <label className="mb-4 block">
            <span className="label">Already in the system from the sheet? Pick them to give them an account</span>
            <select
              className="input"
              value={v.linkUserId ?? ''}
              onChange={e => {
                const p = placeholders.find(x => x.id === e.target.value);
                set({ linkUserId: p?.id, name: p ? p.name : v.name });
                applyAccess(p?.access);
              }}
            >
              <option value="">No – this is a new person</option>
              {placeholders.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.note ? ` · ${p.note}` : ''}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label>
            <span className="label">Name *</span>
            <input className="input" required value={v.name} onChange={e => set({ name: e.target.value })} />
          </label>
          <label className="lg:col-span-2">
            <span className="label">Email (used to sign in)</span>
            <input className="input" type="email" value={v.email} onChange={e => set({ email: e.target.value })} placeholder="name@company.com" />
          </label>
          <label>
            <span className="label">Capacity</span>
            <input className="input" type="number" min={1} max={20} value={v.capacity} onChange={e => set({ capacity: Number(e.target.value) || 1 })} />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-6">
          <Tick checked={v.active} disabled={isSelf} onChange={active => set({ active })} label="Active" help="Unticked = can’t sign in; history is kept." />
          <Tick checked={v.isAdmin} disabled={isSelf} onChange={isAdmin => set({ isAdmin })} label={<b>Admin</b>} help="Full access to every work type, plus People, Roles, Work types and Sync." />
        </div>
      </Section>

      <Section n={2} title="How they sign in" help="Organizations & clients use email + password. Classroots staff can use Google. Anyone can request an email link.">
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="label">{isNew ? 'Temporary password (optional)' : hasPassword ? 'New password (leave blank to keep the current one)' : 'Set a password (optional)'}</span>
            <input className="input" type="text" autoComplete="off" value={v.password ?? ''} onChange={e => set({ password: e.target.value })} placeholder="min 10 characters, letters + numbers" />
          </label>
          <p className="self-end text-xs text-muted">
            {hasPassword ? 'A password is set. ' : 'No password yet. '}Share a temporary password privately; they can change it under My account.
          </p>
        </div>
      </Section>

      <Section
        n={3}
        title="What they can access"
        help="Tick each work type they work in and give one or more roles. Each role brings its own data scope, edit right and pages; several roles add up."
      >
        {v.isAdmin && <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">Admins already have full access everywhere. The settings below apply only if Admin is unticked later.</p>}
        {copySources.length > 0 && (
          <label className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">Copy access from</span>
            <select className="input w-full sm:w-auto sm:max-w-md" value="" onChange={e => applyAccess(copySources.find(c => c.id === e.target.value)?.access)}>
              <option value="">choose a person…</option>
              {copySources.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.note ? ` · ${c.note}` : ''}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="space-y-3">
          {workTypes.map(wt => {
            const a = v.access.find(x => x.workTypeId === wt.id)!;
            return (
              <div key={wt.id} className={`rounded-xl border p-4 transition-colors ${a.enabled ? 'border-brand/40 bg-brand-soft/30' : 'border-line'}`}>
                <Tick
                  checked={a.enabled}
                  onChange={enabled => setAccess(wt.id, { enabled })}
                  label={
                    <span className="font-semibold">
                      {wt.name} {wt.state !== 'ACTIVE' && <span className="text-xs font-normal text-warn">({wt.state.toLowerCase()})</span>}
                    </span>
                  }
                />
                {a.enabled && (
                  <div className="mt-4 grid gap-5 lg:grid-cols-[3fr_2fr]">
                    <div>
                      <div className="label">Roles (tick one or more)</div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {roles.map(r => {
                          const on = a.roleIds.includes(r.id);
                          return (
                            <label key={r.id} className={`flex cursor-pointer items-start gap-2 rounded-lg border bg-white p-2.5 text-sm transition-colors ${on ? 'border-brand/50' : 'border-line hover:border-brand/30'}`}>
                              <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-brand" checked={on} onChange={e => setAccess(wt.id, { roleIds: e.target.checked ? [...a.roleIds, r.id] : a.roleIds.filter(id => id !== r.id) })} />
                              <span className="min-w-0">
                                <span className="inline-flex items-center gap-1.5 font-medium">
                                  <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />
                                  {r.name}
                                </span>
                                {r.description && <span className="block text-xs text-muted">{r.description}</span>}
                                <span className="mt-1 flex flex-wrap gap-1">
                                  {r.capabilities.map(c => (
                                    <span key={c} className="rounded bg-canvas px-1.5 text-[10px] text-muted ring-1 ring-line">
                                      {CAPABILITY_LABELS[c].label}
                                    </span>
                                  ))}
                                  <span className="rounded bg-canvas px-1.5 text-[10px] text-muted ring-1 ring-line">{r.dataScope === 'ALL' ? 'all data' : 'own data'}</span>
                                  {!r.canEdit && <span className="rounded bg-canvas px-1.5 text-[10px] text-muted ring-1 ring-line">view only</span>}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      <p className="mt-2 text-xs text-muted">
                        Change what a role brings under{' '}
                        <Link href="/admin/roles" className="link">
                          Roles
                        </Link>
                        .
                      </p>
                    </div>
                    <div className="rounded-lg bg-white p-3 text-sm ring-1 ring-line">
                      <div className="label">Adds up to</div>
                      <CombinedSummary roles={rolesOf(a)} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      <Section n={4} title="Check and save" help="This is what they will see after signing in.">
        {v.isAdmin ? (
          <p className="text-sm">
            <b>{v.name || 'This person'}</b> is an <b>admin</b>: every work type, all data, can edit, plus People, Roles, Work types and Sync.
          </p>
        ) : v.access.some(a => a.enabled) ? (
          <ul className="space-y-2 text-sm">
            {v.access
              .filter(a => a.enabled)
              .map(a => (
                <li key={a.workTypeId} className="rounded-md bg-canvas px-3 py-2">
                  <span className="font-semibold">{workTypes.find(w => w.id === a.workTypeId)?.name}:</span> <CombinedSummary roles={rolesOf(a)} />
                </li>
              ))}
          </ul>
        ) : (
          <p className="text-sm text-warn">No work type ticked – they will be able to sign in but see “No access yet”.</p>
        )}
        {!v.email && <p className="mt-2 text-xs text-warn">No email: they can be assigned work but can’t sign in yet.</p>}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button className="btn-primary px-5 py-2" disabled={pending}>
            {pending ? 'Saving…' : isNew ? 'Add user' : 'Save changes'}
          </button>
          <Link href="/admin/users" className="btn-ghost">
            Back to people
          </Link>
          <ActionMessage result={result} />
        </div>
      </Section>
    </form>
  );
}
