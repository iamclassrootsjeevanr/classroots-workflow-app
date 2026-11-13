'use client';

import Link from 'next/link';
import { Trash2, UserPlus } from 'lucide-react';
import { useState, useTransition } from 'react';
import {
  addTeamMemberAction,
  deleteTeamAction,
  fillReviewersAction,
  removeTeamMemberAction,
  saveTeamAction,
  setMemberPeerAction,
  setTeamReviewerAction,
  type ActionResult,
} from '@/app/actions';
import { ActionMessage, type PersonOption } from './controls';
import { Card } from './ui';

export type TeamView = {
  id: string;
  name: string;
  coordinatorId: string;
  coordinatorName: string;
  reviewerId: string | null;
  members: { userId: string; name: string; peerReviewerId: string | null; peerReviewerName: string | null; open: number; href: string }[];
  /** The viewer may change this team (its coordinator, or an admin). */
  canManage: boolean;
  itemsHref: string;
  open: number;
};

type Labels = { creator: string; reviewer: string; peer: string; noun: string };

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

/** One team: its coordinator, the default SME reviewer, and each member with their peer reviewer. */
export function TeamCard({ workTypeId, team, creators, reviewers, coordinators, isAdmin, labels }: { workTypeId: string; team: TeamView; creators: (PersonOption & { teamName?: string })[]; reviewers: PersonOption[]; coordinators: PersonOption[]; isAdmin: boolean; labels: Labels }) {
  const { pending, result, exec } = useAction();
  const [add, setAdd] = useState('');
  const [editing, setEditing] = useState(false);
  const free = creators.filter(c => !c.teamName && c.id !== team.coordinatorId);
  const peers = (memberId: string) => creators.filter(c => c.id !== memberId);
  const reviewerName = reviewers.find(r => r.id === team.reviewerId)?.name;

  return (
    <Card
      title={team.name}
      description={
        <>
          Steward <b className="text-ink">{team.coordinatorName}</b> owns every {labels.noun} of this team, in any chapter.
        </>
      }
      actions={
        <>
          <Link className="btn-ghost" href={team.itemsHref}>
            {team.open} open {labels.noun}
            {team.open === 1 ? '' : 's'}
          </Link>
          {isAdmin && (
            <button className="btn-ghost" onClick={() => setEditing(e => !e)}>
              {editing ? 'Close' : 'Edit team'}
            </button>
          )}
        </>
      }
    >
      {editing && <TeamForm workTypeId={workTypeId} team={team} coordinators={coordinators} onDone={() => setEditing(false)} />}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block">
          <span className="label">Default {labels.reviewer.toLowerCase()}</span>
          {team.canManage ? (
            <select className="input" value={team.reviewerId ?? ''} disabled={pending} onChange={e => exec(() => setTeamReviewerAction(team.id, e.target.value || null))}>
              <option value="">{team.coordinatorName} (coordinator)</option>
              {reviewers
                .filter(r => r.id !== team.coordinatorId)
                .map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
            </select>
          ) : (
            <div className="py-1.5 text-sm">{reviewerName ?? `${team.coordinatorName} (coordinator)`}</div>
          )}
          <span className="mt-1 block text-xs text-muted">New {labels.noun}s of the team go to this reviewer. Open ones still on the old default move too.</span>
        </label>
      </div>

      {team.members.length ? (
        <ul className="divide-y divide-line border-y border-line">
          {team.members.map(m => (
            <li key={m.userId} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
              <div className="min-w-40 flex-1">
                <div className="text-sm font-medium text-ink">{m.name}</div>
                <Link className="link text-xs" href={m.href}>
                  {m.open} open {labels.noun}
                  {m.open === 1 ? '' : 's'}
                </Link>
              </div>
              <label className="min-w-52 flex-1 sm:flex-none">
                <span className="label">{labels.peer}</span>
                {team.canManage ? (
                  <select className="input" aria-label={`${labels.peer} of ${m.name}`} value={m.peerReviewerId ?? ''} disabled={pending} onChange={e => exec(() => setMemberPeerAction(team.id, m.userId, e.target.value || null))}>
                    <option value="">None</option>
                    {peers(m.userId).map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="py-1.5 text-sm">{m.peerReviewerName ?? '—'}</div>
                )}
              </label>
              {team.canManage && (
                <button
                  className="btn-ghost text-bad"
                  disabled={pending}
                  title={`Remove ${m.name} from ${team.name}`}
                  onClick={() => {
                    if (confirm(`Remove ${m.name} from ${team.name}? Their ${labels.noun}s keep their reviewers.`)) exec(() => removeTeamMemberAction(team.id, m.userId));
                  }}
                >
                  <Trash2 size={14} aria-hidden="true" />
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="border-y border-line py-4 text-sm text-muted">No members yet.</p>
      )}

      {team.canManage && (
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <label className="min-w-52 flex-1 sm:flex-none">
            <span className="label">Add {labels.creator.toLowerCase()}</span>
            <select className="input" value={add} onChange={e => setAdd(e.target.value)}>
              <option value="">{free.length ? 'Choose a person' : 'Everyone is in a team'}</option>
              {free.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button className="btn-primary" disabled={pending || !add} onClick={() => exec(() => addTeamMemberAction(team.id, add), () => setAdd(''))}>
            <UserPlus size={14} aria-hidden="true" />
            Add
          </button>
          <button className="btn-ghost" disabled={pending} title={`Give open ${labels.noun}s with no ${labels.reviewer.toLowerCase()} or ${labels.peer.toLowerCase()} the team default`} onClick={() => exec(() => fillReviewersAction(team.id))}>
            Fill missing reviewers
          </button>
          {isAdmin && (
            <button
              className="btn-ghost text-bad sm:ml-auto"
              disabled={pending}
              onClick={() => {
                if (confirm(`Remove ${team.name}? Its ${labels.noun}s keep their reviewers.`)) exec(() => deleteTeamAction(team.id));
              }}
            >
              Remove team
            </button>
          )}
        </div>
      )}
      <ActionMessage result={result} />
    </Card>
  );
}

/** Admin: add a team, or rename one and change its coordinator. */
export function TeamForm({ workTypeId, team, coordinators, onDone }: { workTypeId: string; team?: { id: string; name: string; coordinatorId: string }; coordinators: PersonOption[]; onDone?: () => void }) {
  const { pending, result, exec } = useAction();
  const [name, setName] = useState(team?.name ?? '');
  const [coordinatorId, setCoordinatorId] = useState(team?.coordinatorId ?? '');
  return (
    <form
      className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border border-line bg-surface-2/60 p-3"
      onSubmit={e => {
        e.preventDefault();
        exec(
          () => saveTeamAction(workTypeId, { id: team?.id, name, coordinatorId }),
          () => {
            if (!team) {
              setName('');
              setCoordinatorId('');
            }
            onDone?.();
          },
        );
      }}
    >
      <label className="min-w-44 flex-1 sm:flex-none">
        <span className="label">Team name</span>
        <input className="input" required value={name} onChange={e => setName(e.target.value)} placeholder="Team Arjun" />
      </label>
      <label className="min-w-52 flex-1 sm:flex-none">
        <span className="label">Steward</span>
        <select className="input" required value={coordinatorId} onChange={e => setCoordinatorId(e.target.value)}>
          <option value="">Choose a steward</option>
          {coordinators.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <button className="btn-primary" disabled={pending}>
        {team ? 'Save team' : 'Add team'}
      </button>
      <ActionMessage result={result} />
    </form>
  );
}
