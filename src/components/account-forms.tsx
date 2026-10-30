'use client';

import { useState, useTransition } from 'react';
import { changeMyPasswordAction, type ActionResult } from '@/app/actions';
import { ActionMessage } from './controls';

export function ChangePasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [v, setV] = useState({ current: '', next: '', confirm: '' });
  return (
    <form
      className="max-w-sm space-y-3"
      onSubmit={e => {
        e.preventDefault();
        start(async () => {
          const r = await changeMyPasswordAction(v);
          setResult(r);
          if (r.ok) setV({ current: '', next: '', confirm: '' });
        });
      }}
    >
      {hasPassword && (
        <label className="block">
          <span className="label">Current password</span>
          <input className="input" type="password" autoComplete="current-password" required value={v.current} onChange={e => setV({ ...v, current: e.target.value })} />
        </label>
      )}
      <label className="block">
        <span className="label">New password</span>
        <input className="input" type="password" autoComplete="new-password" required value={v.next} onChange={e => setV({ ...v, next: e.target.value })} />
      </label>
      <label className="block">
        <span className="label">Repeat new password</span>
        <input className="input" type="password" autoComplete="new-password" required value={v.confirm} onChange={e => setV({ ...v, confirm: e.target.value })} />
      </label>
      <p className="text-xs text-muted">At least 10 characters, with letters and numbers.</p>
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={pending}>
          {hasPassword ? 'Change password' : 'Set password'}
        </button>
        <ActionMessage result={result} />
      </div>
    </form>
  );
}
