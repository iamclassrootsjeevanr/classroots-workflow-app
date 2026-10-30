import type { Capability } from '@/lib/access-core';
import type { Actor, FieldDef, StageMark, Transition, WorkTypeDefinition } from '@/modules/types';

export type ActorContext = {
  isAdmin: boolean;
  /** Union of the person's role capabilities in this work type. */
  capabilities: ReadonlySet<Capability>;
  /** The acting user is the item's assignee. */
  isAssignee: boolean;
  /** False = view only in this work type. */
  canEdit: boolean;
};

export function hasCap(ctx: ActorContext, cap: Capability): boolean {
  return ctx.isAdmin || (ctx.canEdit && ctx.capabilities.has(cap));
}

function actorMatches(by: Actor[], ctx: ActorContext): boolean {
  if (ctx.isAdmin) return true;
  if (!ctx.canEdit) return false;
  return by.some(a => (a === 'ASSIGNEE' ? ctx.isAssignee && ctx.capabilities.has('work') : ctx.capabilities.has(a)));
}

/** Transitions offered to this actor from the item's current status. Admins may move to any status. */
export function allowedTransitions(mod: WorkTypeDefinition, from: string, ctx: ActorContext): Transition[] {
  if (ctx.isAdmin) {
    const defined = mod.transitions.filter(t => t.from === from);
    const extra = mod.statuses
      .filter(s => s.key !== from && !defined.some(t => t.to === s.key))
      .map(s => ({ from, to: s.key, by: [] as Actor[], label: `Set ${s.label}` }));
    return [...defined, ...extra];
  }
  return mod.transitions.filter(t => t.from === from && actorMatches(t.by, ctx));
}

export function canTransition(mod: WorkTypeDefinition, from: string, to: string, ctx: ActorContext): boolean {
  if (from === to || !mod.statuses.some(s => s.key === to)) return false;
  return allowedTransitions(mod, from, ctx).some(t => t.to === to);
}

export function canEditField(field: FieldDef, ctx: ActorContext): boolean {
  return actorMatches(field.editableBy, ctx);
}

export type StageState = {
  status: string;
  assignedAt: Date | null;
  firstStartedAt: Date | null;
  lastSubmittedAt: Date | null;
  firstReviewAt: Date | null;
  lastFeedbackAt: Date | null;
  approvedAt: Date | null;
  completedAt: Date | null;
  reviewRounds: number;
  reopenCount: number;
};

export type StagePatch = Partial<StageState>;

/** Timestamp / counter changes caused by moving an item into status `to`. */
export function stagePatch(mod: WorkTypeDefinition, item: StageState, to: string, now: Date): StagePatch {
  const fromDef = mod.statuses.find(s => s.key === item.status);
  const toDef = mod.statuses.find(s => s.key === to);
  const marks = new Set<StageMark>(toDef?.marks ?? []);
  const patch: StagePatch = { status: to };

  if (marks.has('assigned') && !item.assignedAt) patch.assignedAt = now;
  if (marks.has('started') && !item.firstStartedAt) patch.firstStartedAt = now;
  if (marks.has('submitted')) {
    patch.lastSubmittedAt = now;
    patch.reviewRounds = item.reviewRounds + 1;
  }
  if (marks.has('review') && !item.firstReviewAt) patch.firstReviewAt = now;
  if (marks.has('feedback')) patch.lastFeedbackAt = now;
  if (marks.has('approved') && !item.approvedAt) patch.approvedAt = now;
  if (marks.has('completed')) patch.completedAt = now;

  // Leaving a done state = reopen.
  if (fromDef?.category === 'done' && toDef?.category !== 'done') {
    patch.reopenCount = item.reopenCount + 1;
    patch.completedAt = null;
    if (!marks.has('approved')) patch.approvedAt = null;
  }
  // Sent back for corrections after approval: approval no longer stands.
  if (toDef?.category === 'feedback' && item.approvedAt) patch.approvedAt = null;
  return patch;
}

/** Categories that count as an item being "open" on someone's plate. */
export const OPEN_CATEGORIES = new Set(['queue', 'active', 'review', 'feedback', 'hold']);
export const WORKING_CATEGORIES = new Set(['active', 'feedback']);
