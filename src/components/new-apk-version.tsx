'use client';

import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { createApkVersionAction, createItemAction, updateApkVersionAction, type ActionResult } from '@/app/actions';
import { ActionMessage, type PersonOption } from './controls';
import { Checkbox, Field, GroupLabel, OptionList } from './form';
import { Modal } from './modal';

export type VersionOption = { name: string; releaseDate: string; apkUrl: string; releaseNotes: string; cases: { id: string; title: string }[] };

function useRun() {
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

type Extra = { testCaseId: string; title: string; scenario: string };

/** "New APK version": link, release info and the test cases, copied from an earlier version. */
export function NewApkVersionButton({ workTypeId, versions, people }: { workTypeId: string; versions: VersionOption[]; people?: PersonOption[] }) {
  const newest = versions[versions.length - 1];
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ version: '', apkUrl: '', releaseDate: '', releaseNotes: '', assigneeId: '' });
  const [copyFrom, setCopyFrom] = useState(newest?.name ?? '');
  const source = versions.find(x => x.name === copyFrom);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(newest?.cases.map(c => c.id)));
  const [extras, setExtras] = useState<Extra[]>([]);
  const { pending, result, exec } = useRun();
  const set = (k: keyof typeof v) => ({ value: v[k], onChange: (e: { target: { value: string } }) => setV(s => ({ ...s, [k]: e.target.value })) });
  const pickSource = (name: string) => {
    setCopyFrom(name);
    setPicked(new Set(versions.find(x => x.name === name)?.cases.map(c => c.id)));
  };
  const toggle = (id: string, on: boolean) =>
    setPicked(s => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  const setExtra = (i: number, k: keyof Extra, value: string) => setExtras(list => list.map((x, j) => (j === i ? { ...x, [k]: value } : x)));
  const total = picked.size + extras.filter(e => e.testCaseId.trim()).length;

  return (
    <>
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        <Plus size={16} aria-hidden="true" /> New APK version
      </button>
      {open && (
        <Modal title="New APK version" subtitle="Tests start as Not Tested. Bug, comments and remarks are not copied." wide onClose={() => setOpen(false)}>
          <form
            className="space-y-5"
            onSubmit={e => {
              e.preventDefault();
              exec(
                () =>
                  createApkVersionAction(workTypeId, {
                    ...v,
                    copyFrom: copyFrom || undefined,
                    includeCaseIds: source ? source.cases.filter(c => picked.has(c.id)).map(c => c.id) : [],
                    extraCases: extras.filter(x => x.testCaseId.trim()),
                  }),
                () => setOpen(false),
              );
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="APK version">
                <input className="input font-mono" required placeholder="v1.2.3" {...set('version')} />
              </Field>
              <Field label="Release date">
                <input className="input" type="date" {...set('releaseDate')} />
              </Field>
              <Field label="APK link" className="sm:col-span-2">
                <input className="input" type="url" placeholder="https://" {...set('apkUrl')} />
              </Field>
              <Field label="Release notes" className="sm:col-span-2">
                <textarea className="input min-h-16" {...set('releaseNotes')} />
              </Field>
              {people && (
                <Field label="Tested by" help="Empty = you">
                  <select className="input" {...set('assigneeId')}>
                    <option value="">Me</option>
                    {people.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </div>

            <div>
              <GroupLabel note={`${total} test${total === 1 ? '' : 's'}`}>Test cases</GroupLabel>
              {versions.length > 0 && (
                <div className="mb-2 flex flex-wrap items-end gap-3">
                  <Field label="Copy from">
                    <select className="input" value={copyFrom} onChange={e => pickSource(e.target.value)}>
                      {versions.map(x => (
                        <option key={x.name} value={x.name}>
                          {x.name} · {x.cases.length} tests
                        </option>
                      ))}
                    </select>
                  </Field>
                  <button type="button" className="btn-ghost min-h-9 text-xs" onClick={() => setPicked(new Set(source?.cases.map(c => c.id)))}>
                    Select all
                  </button>
                  <button type="button" className="btn-ghost min-h-9 text-xs" onClick={() => setPicked(new Set())}>
                    Select none
                  </button>
                </div>
              )}
              {source && (
                <OptionList className="max-h-64 overflow-y-auto">
                  {source.cases.map(c => (
                    <Checkbox key={c.id} checked={picked.has(c.id)} onChange={on => toggle(c.id, on)} label={<span className="font-mono text-xs">{c.id}</span>} help={c.title} />
                  ))}
                </OptionList>
              )}
              {extras.length > 0 && (
                <div className="mt-3 space-y-2">
                  {extras.map((x, i) => (
                    <div key={i} className="grid grid-cols-[6rem_1fr_auto] gap-2 sm:grid-cols-[7rem_1fr_1fr_auto]">
                      <input className="input font-mono" placeholder="TC-101" aria-label="Test case ID" value={x.testCaseId} onChange={e => setExtra(i, 'testCaseId', e.target.value)} />
                      <input className="input" placeholder="Feature / module" aria-label="Feature / module" value={x.title} onChange={e => setExtra(i, 'title', e.target.value)} />
                      <input className="input col-span-2 sm:col-span-1 sm:col-start-3" placeholder="Scenario (optional)" aria-label="Scenario" value={x.scenario} onChange={e => setExtra(i, 'scenario', e.target.value)} />
                      <button type="button" className="btn-icon row-start-1 col-start-3 sm:col-start-4" aria-label="Remove case" onClick={() => setExtras(list => list.filter((_, j) => j !== i))}>
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button type="button" className="btn-ghost mt-2 min-h-8 gap-1 px-2.5 text-xs" onClick={() => setExtras(list => [...list, { testCaseId: '', title: '', scenario: '' }])}>
                <Plus size={14} aria-hidden="true" /> Add case
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button className="btn-primary" disabled={pending || total === 0}>
                {pending ? 'Creating…' : 'Create version'}
              </button>
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <ActionMessage result={result} />
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

/** Edit the APK link, release date and notes of one version (applies to all its tests). */
export function EditApkVersionButton({ workTypeId, version, apkUrl, releaseDate, releaseNotes }: { workTypeId: string; version: string; apkUrl: string; releaseDate: string; releaseNotes: string }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ apkUrl, releaseDate, releaseNotes });
  const { pending, result, exec } = useRun();
  const set = (k: keyof typeof v) => ({ value: v[k], onChange: (e: { target: { value: string } }) => setV(s => ({ ...s, [k]: e.target.value })) });
  return (
    <>
      <button type="button" className="btn-icon" aria-label={`Edit ${version}`} title="Edit version" onClick={() => setOpen(true)}>
        <Pencil size={14} aria-hidden="true" />
      </button>
      {open && (
        <Modal title={`Edit ${version}`} subtitle="Applies to every test in this version." onClose={() => setOpen(false)}>
          <form
            className="space-y-3"
            onSubmit={e => {
              e.preventDefault();
              exec(() => updateApkVersionAction(workTypeId, version, v), () => setOpen(false));
            }}
          >
            <Field label="APK link">
              <input className="input" type="url" placeholder="https://" {...set('apkUrl')} />
            </Field>
            <Field label="Release date">
              <input className="input" type="date" {...set('releaseDate')} />
            </Field>
            <Field label="Release notes">
              <textarea className="input min-h-20" {...set('releaseNotes')} />
            </Field>
            <div className="flex flex-wrap items-center gap-2">
              <button className="btn-primary" disabled={pending}>
                {pending ? 'Saving…' : 'Save version'}
              </button>
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <ActionMessage result={result} />
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

/** Add one test case to an existing APK version. */
export function AddTestCaseButton({ workTypeId, versions, assigneeId }: { workTypeId: string; versions: VersionOption[]; assigneeId?: string }) {
  const [open, setOpen] = useState(false);
  const empty = { testCaseId: '', title: '', scenario: '', expected: '', steps: '', priority: '' };
  const [version, setVersion] = useState(versions[versions.length - 1]?.name ?? '');
  const [v, setV] = useState(empty);
  const { pending, result, exec } = useRun();
  const set = (k: keyof typeof v) => ({ value: v[k], onChange: (e: { target: { value: string } }) => setV(s => ({ ...s, [k]: e.target.value })) });
  const meta = versions.find(x => x.name === version);
  if (!versions.length) return null;
  return (
    <>
      <button type="button" className="btn-ghost" onClick={() => setOpen(true)}>
        <Plus size={16} aria-hidden="true" /> Add test case
      </button>
      {open && (
        <Modal title="Add test case" subtitle="Adds one test, Not Tested, to an existing APK version." onClose={() => setOpen(false)}>
          <form
            className="space-y-3"
            onSubmit={e => {
              e.preventDefault();
              const id = v.testCaseId.trim();
              exec(
                () =>
                  createItemAction(workTypeId, {
                    externalKey: `${version} | ${id}`,
                    title: v.title || id,
                    groupKey: version,
                    assigneeId,
                    data: {
                      testCaseId: id,
                      scenario: v.scenario,
                      expected: v.expected,
                      steps: v.steps,
                      priority: v.priority,
                      releaseDate: meta?.releaseDate ?? '',
                      apkUrl: meta?.apkUrl ?? '',
                      releaseNotes: meta?.releaseNotes ?? '',
                    },
                  }),
                () => {
                  setV(empty);
                  setOpen(false);
                },
              );
            }}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="APK version">
                <select className="input" value={version} onChange={e => setVersion(e.target.value)}>
                  {versions.map(x => (
                    <option key={x.name}>{x.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Test case ID">
                <input className="input font-mono" required placeholder="TC-101" {...set('testCaseId')} />
              </Field>
              <Field label="Priority">
                <input className="input" placeholder="High / Medium / Low" {...set('priority')} />
              </Field>
              <Field label="Feature / module" className="sm:col-span-3">
                <input className="input" required {...set('title')} />
              </Field>
              <Field label="Test scenario" className="sm:col-span-3">
                <textarea className="input min-h-14" {...set('scenario')} />
              </Field>
              <Field label="Expected result" className="sm:col-span-3">
                <textarea className="input min-h-14" {...set('expected')} />
              </Field>
              <Field label="Test steps" className="sm:col-span-3">
                <textarea className="input min-h-14" {...set('steps')} />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button className="btn-primary" disabled={pending}>
                {pending ? 'Adding…' : 'Add test case'}
              </button>
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <ActionMessage result={result} />
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
