'use client';

import { Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { addChapterAction, removeChapterAction, type ActionResult } from '@/app/actions';
import { ActionMessage, type PersonOption } from './controls';

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

/** Add a chapter to the list. A coordinator becomes its steward; an admin picks the steward. */
export function AddChapterForm({ workTypeId, known, stewards, example = 'G04C05' }: { workTypeId: string; /** Chapters of the syllabus, to fill the name from the code. */ known: { code: string; title: string }[]; /** Admin only: who can steer a chapter. */ stewards?: PersonOption[]; example?: string }) {
  const { pending, result, exec } = useAction();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ code: '', title: '', stewardId: '' });
  if (!open) {
    return (
      <button className="btn-primary" onClick={() => setOpen(true)}>
        + New chapter
      </button>
    );
  }
  const setCode = (raw: string) => {
    const code = raw.toUpperCase();
    const hit = known.find(k => k.code === code);
    setV(s => ({ ...s, code, title: hit ? hit.title : s.title }));
  };
  return (
    <form
      className="card mb-5 w-full"
      onSubmit={e => {
        e.preventDefault();
        exec(() => addChapterAction(workTypeId, v), () => setV({ code: '', title: '', stewardId: '' }));
      }}
    >
      <div className="grid gap-3 sm:grid-cols-4">
        <label>
          <span className="label">Chapter code (e.g. {example})</span>
          <input className="input font-mono" required list="chapter-codes" value={v.code} onChange={e => setCode(e.target.value)} />
          <datalist id="chapter-codes">
            {known.map(k => (
              <option key={k.code} value={k.code}>
                {k.title}
              </option>
            ))}
          </datalist>
        </label>
        <label className="sm:col-span-2">
          <span className="label">Name</span>
          <input className="input" required value={v.title} onChange={e => setV(s => ({ ...s, title: e.target.value }))} />
        </label>
        {stewards && (
          <label>
            <span className="label">Steward</span>
            <select className="input" required value={v.stewardId} onChange={e => setV(s => ({ ...s, stewardId: e.target.value }))}>
              <option value="">Choose a coordinator</option>
              {stewards.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button className="btn-primary" disabled={pending}>
          {pending ? 'Adding…' : 'Add chapter'}
        </button>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
          Close
        </button>
        <ActionMessage result={result} />
      </div>
    </form>
  );
}

/** Take an empty chapter off the list (one with journeys says how many must go first). */
export function RemoveChapterButton({ workTypeId, code }: { workTypeId: string; code: string }) {
  const { pending, result, exec } = useAction();
  return (
    <span className="inline-flex flex-col items-end">
      <button
        className="btn-ghost text-bad"
        disabled={pending}
        title={`Remove ${code}`}
        onClick={() => {
          if (confirm(`Remove ${code} from the chapters?`)) exec(() => removeChapterAction(workTypeId, code));
        }}
      >
        <Trash2 size={14} aria-hidden="true" />
        Remove
      </button>
      {result && !result.ok && <ActionMessage result={result} />}
    </span>
  );
}
