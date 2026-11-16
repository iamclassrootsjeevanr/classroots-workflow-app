'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { removeUserAction, sendInviteAction, setUserActiveAction, type ActionResult } from '@/app/actions';
import { useConfirm } from './confirm';
import { ActionMessage } from './controls';

/** Send invite / deactivate / activate / remove buttons for one person. `canInvite` = active and has an email. */
export function PeopleActions({ userId, active, isSelf, canInvite, afterRemove }: { userId: string; active: boolean; isSelf: boolean; canInvite?: boolean; afterRemove?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const { confirm, dialog } = useConfirm();
  if (isSelf) return <span className="text-xs text-muted">you</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-3">
      {canInvite && (
        <button
          type="button"
          className="text-xs font-medium text-brand hover:underline disabled:opacity-40"
          disabled={pending}
          title="Email them that they have access and how to sign in"
          onClick={() => start(async () => setResult(await sendInviteAction(userId)))}
        >
          Send invite
        </button>
      )}
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
        onClick={async () => {
          if (!(await confirm({ title: 'Remove this person?', description: 'This is permanent. It only works if they have no work history; otherwise deactivate them.', confirmLabel: 'Remove' }))) return;
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
      {dialog}
    </span>
  );
}
