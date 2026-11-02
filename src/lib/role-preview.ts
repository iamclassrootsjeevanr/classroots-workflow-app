/**
 * What a role lets a person do inside each work type's workflow. Pure: the server turns module
 * definitions into `FlowLite` (plain data), the role editor evaluates the ticks against it live.
 */
import type { Capability, DataScope } from './access-core';
import { actorMatches, type ActorContext } from './workflow';
import type { Actor, WorkTypeDefinition } from '@/modules/types';

export type StatusLite = { key: string; label: string; color: string };
export type FlowLite = {
  key: string;
  name: string;
  itemNoun: string;
  assigneeLabel: string;
  statuses: StatusLite[];
  transitions: { from: string; to: string; by: Actor[]; label?: string }[];
  fields: { key: string; label: string; editableBy: Actor[] }[];
};

/** Serialisable slice of a module definition (no functions or schemas), safe to pass to client components. */
export function flowLite(mod: WorkTypeDefinition): FlowLite {
  return {
    key: mod.key,
    name: mod.name,
    itemNoun: mod.itemNoun,
    assigneeLabel: mod.labels?.assignee ?? 'Developer',
    statuses: mod.statuses.map(s => ({ key: s.key, label: s.label, color: s.color })),
    transitions: mod.transitions.map(t => ({ from: t.from, to: t.to, by: [...t.by], label: t.label })),
    fields: mod.fields.map(f => ({ key: f.key, label: f.label, editableBy: [...f.editableBy] })),
  };
}

export type RoleAbilities = { capabilities: Iterable<Capability>; canEdit: boolean; dataScope: DataScope };

export type RoleMove = { from: StatusLite; to: StatusLite; label: string; onlyOwnItems: boolean };
export type RoleField = { key: string; label: string; onlyOwnItems: boolean };
export type RolePreview = { moves: RoleMove[]; fields: RoleField[]; canComment: boolean };

const status = (flow: FlowLite, key: string): StatusLite => flow.statuses.find(s => s.key === key) ?? { key, label: key, color: '#9e9e9e' };

/**
 * Every status move and editable field this role unlocks in one work type.
 * `onlyOwnItems` marks things allowed only because the person is the item's assignee.
 */
export function rolePreview(flow: FlowLite, role: RoleAbilities): RolePreview {
  const capabilities = new Set(role.capabilities);
  const asAssignee: ActorContext = { isAdmin: false, capabilities, canEdit: role.canEdit, isAssignee: true };
  const asOther: ActorContext = { ...asAssignee, isAssignee: false };
  const moves: RoleMove[] = [];
  for (const t of flow.transitions) {
    if (!actorMatches(t.by, asAssignee)) continue;
    const to = status(flow, t.to);
    moves.push({ from: status(flow, t.from), to, label: t.label ?? to.label, onlyOwnItems: !actorMatches(t.by, asOther) });
  }
  const fields: RoleField[] = [];
  for (const f of flow.fields) {
    if (!actorMatches(f.editableBy, asAssignee)) continue;
    fields.push({ key: f.key, label: f.label, onlyOwnItems: !actorMatches(f.editableBy, asOther) });
  }
  return { moves, fields, canComment: role.canEdit };
}
