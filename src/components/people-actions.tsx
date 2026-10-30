'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { removeUserAction, setUserActiveAction, type ActionResult } from '@/app/actions';
import { ActionMessage } from './controls';

/** Deactivate / activate / remove buttons for one person. */
export function PeopleActions({ userId, active, isSelf, afterRemove }: { userId: string; active: boolean; isSelf: boolean; afterRemove?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  if (isSelf) return <span className="text-xs text-muted">you</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-3">
      <button
        type="button"
        className={`text-xs font-medium hover:underline disabled:opacity-40 ${active ? 'text-bad' : 'text-ok'}`}
        disabled={pending}
        onClick={() => start(async () => setResult(await setUserActiveAction(userId, !active)))}
      >
        {active ? 'Deactivate' : 'Activate'}
      </button>
      <button
        type="button"
        className="text-xs font-medium text-muted hover:text-bad hover:underline disabled:opacity-40"
        disabled={pending}
        onClick={() => {
          if (!window.confirm('Remove this person permanently? Only possible if they have no work history – otherwise deactivate them.')) return;
          start(async () => {
            const r = await removeUserAction(userId);
            setResult(r);
            if (r.ok && afterRemove) router.push(afterRemove);
          });
        }}
      >
        Remove
      </button>
      {result && <ActionMessage result={result} />}
    </span>
  );
}
