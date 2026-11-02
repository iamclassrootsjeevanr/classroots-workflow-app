'use client';

import { Pencil } from 'lucide-react';
import { useState, useTransition } from 'react';
import { updateFieldsAction, type ActionResult } from '@/app/actions';
import type { CaseRow } from '@/lib/test-cases';
import { ActionMessage } from './controls';
import { Field } from './form';
import { Modal } from './modal';
import { Sheet } from './sheet';
import { Empty, StatusBadge } from './ui';

function EditCase({ row }: { row: CaseRow }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ scenario: row.scenario, expected: row.expected, steps: row.steps, priority: row.priority });
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const set = (k: keyof typeof v) => ({ value: v[k], onChange: (e: { target: { value: string } }) => setV(s => ({ ...s, [k]: e.target.value })) });
  return (
    <>
      <button type="button" className="btn-icon" aria-label={`Edit ${row.id}`} title="Edit test case" onClick={() => setOpen(true)}>
        <Pencil size={14} aria-hidden="true" />
      </button>
      {open && (
        <Modal title={`Edit ${row.id}`} subtitle={`${row.title} · changes ${row.latestVersion}`} onClose={() => setOpen(false)}>
          <form
            className="space-y-3"
            onSubmit={e => {
              e.preventDefault();
              start(async () => {
                const r = await updateFieldsAction(row.latestItemId, Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x.trim() || null])));
                setResult(r);
                if (r.ok) setOpen(false);
              });
            }}
          >
            <Field label="Priority">
              <input className="input" placeholder="High / Medium / Low" {...set('priority')} />
            </Field>
            <Field label="Test scenario">
              <textarea className="input min-h-16" {...set('scenario')} />
            </Field>
            <Field label="Expected result">
              <textarea className="input min-h-16" {...set('expected')} />
            </Field>
            <Field label="Test steps">
              <textarea className="input min-h-20" {...set('steps')} />
            </Field>
            <div className="flex flex-wrap items-center gap-2">
              <button className="btn-primary" disabled={pending}>
                {pending ? 'Saving…' : 'Save test case'}
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

/** One row per test case with its definition, the versions it is in and its latest result. */
export function CasesTable({ rows, canEdit }: { rows: CaseRow[]; canEdit: boolean }) {
  if (!rows.length) return <Empty>No test cases yet.</Empty>;
  const cell = (s: string) => (s ? <div className="max-w-72 truncate" title={s}>{s}</div> : <span className="text-muted">—</span>);
  return (
    <Sheet maxHeight="70vh">
      <table className="sheet">
        <thead>
          <tr>
            <th className="pin">Test case</th>
            <th>Feature / module</th>
            <th>Priority</th>
            <th>Scenario</th>
            <th>Expected result</th>
            <th>Steps</th>
            <th>Versions</th>
            <th>Latest result</th>
            {canEdit && <th className="pin-end">Edit</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td className="pin font-mono text-xs font-medium">{r.id}</td>
              <td className="font-medium text-ink">{r.title}</td>
              <td className="whitespace-nowrap text-xs">{r.priority || <span className="text-muted">—</span>}</td>
              <td className="text-xs">{cell(r.scenario)}</td>
              <td className="text-xs">{cell(r.expected)}</td>
              <td className="text-xs">{cell(r.steps)}</td>
              <td className="whitespace-nowrap text-xs tabular-nums" title={r.versions.join(', ')}>
                {r.versions.length}
              </td>
              <td className="whitespace-nowrap">
                <StatusBadge label={r.latestStatus} color={r.latestColor} />
                <span className="ml-1.5 text-2xs text-muted">{r.latestVersion}</span>
              </td>
              {canEdit && (
                <td className="pin-end">
                  <EditCase row={r} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </Sheet>
  );
}
