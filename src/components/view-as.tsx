'use client';

import { Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { viewAsAction } from '@/app/actions';

export type ViewAsPerson = { id: string; name: string; roles: string };

/** Admin testing: pick a person to see the app exactly as they do. Nobody else sees this. */
export function ViewAsPicker({ people, currentId, className = '' }: { people: ViewAsPerson[]; currentId?: string; className?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <label className={`flex items-center gap-1.5 text-xs ${className}`}>
      <Eye size={14} aria-hidden="true" className="shrink-0 text-muted" />
      <select
        aria-label="View as"
        className="input w-auto max-w-56 py-1 text-xs"
        value={currentId ?? ''}
        disabled={pending}
        onChange={e =>
          start(async () => {
            await viewAsAction(e.target.value || null);
            router.push('/my');
            router.refresh();
          })
        }
      >
        <option value="">View as…</option>
        {people.map(p => (
          <option key={p.id} value={p.id}>
            {p.name} · {p.roles}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ExitViewAs() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="btn-ghost min-h-7 px-2.5 py-0.5 text-xs"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await viewAsAction(null);
          router.push('/admin');
          router.refresh();
        })
      }
    >
      Exit
    </button>
  );
}
