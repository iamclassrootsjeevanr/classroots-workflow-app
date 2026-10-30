import { describe, expect, it } from 'vitest';
import { journeyApplet as mod } from '@/modules/journey-applet/definition';
import type { Capability } from '@/lib/access-core';
import { allowedTransitions, canEditField, canTransition, stagePatch, type StageState } from '@/lib/workflow';

const ctx = (caps: Capability[], isAssignee = false, canEdit = true) => ({ isAdmin: false, capabilities: new Set(caps), isAssignee, canEdit });
const dev = ctx(['work'], true);
const otherDev = ctx(['work'], false);
const sme = ctx(['review', 'manageFields']);
const admin = { isAdmin: true, capabilities: new Set<Capability>(), isAssignee: false, canEdit: true };

const base: StageState = {
  status: 'assigned',
  assignedAt: new Date('2026-11-02T05:00:00Z'),
  firstStartedAt: null,
  lastSubmittedAt: null,
  firstReviewAt: null,
  lastFeedbackAt: null,
  approvedAt: null,
  completedAt: null,
  reviewRounds: 0,
  reopenCount: 0,
};

describe('transitions', () => {
  it('lets the assignee start, submit and re-submit', () => {
    expect(canTransition(mod, 'assigned', 'in_progress', dev)).toBe(true);
    expect(canTransition(mod, 'in_progress', 'ready_for_review', dev)).toBe(true);
    expect(canTransition(mod, 'corrections', 'ready_for_review', dev)).toBe(true);
  });

  it('does not let a developer approve their own work or touch others’ items', () => {
    expect(canTransition(mod, 'ready_for_review', 'reviewed', dev)).toBe(false);
    expect(canTransition(mod, 'assigned', 'in_progress', otherDev)).toBe(false);
  });

  it('lets SMEs review but not start work', () => {
    expect(canTransition(mod, 'ready_for_review', 'corrections', sme)).toBe(true);
    expect(canTransition(mod, 'in_review', 'reviewed', sme)).toBe(true);
    expect(canTransition(mod, 'assigned', 'in_progress', sme)).toBe(false);
  });

  it('gives admins every other status', () => {
    const to = allowedTransitions(mod, 'received', admin).map(t => t.to);
    expect(to).toHaveLength(mod.statuses.length - 1);
    expect(canTransition(mod, 'received', 'done', admin)).toBe(true);
    expect(canTransition(mod, 'done', 'done', admin)).toBe(false);
  });

  it('blocks everything when view-only, even with roles', () => {
    const viewOnlyDev = ctx(['work', 'review'], true, false);
    expect(allowedTransitions(mod, 'assigned', viewOnlyDev)).toEqual([]);
    expect(canEditField(mod.fields.find(f => f.key === 'cmsUrl')!, viewOnlyDev)).toBe(false);
  });

  it('combines several roles', () => {
    const both = ctx(['work', 'review'], true);
    expect(canTransition(mod, 'assigned', 'in_progress', both)).toBe(true);
    expect(canTransition(mod, 'ready_for_review', 'reviewed', both)).toBe(true);
  });

  it('needs the work capability to act as assignee', () => {
    expect(canTransition(mod, 'assigned', 'in_progress', ctx(['review'], true))).toBe(false);
  });

  it('checks field permissions', () => {
    const build = mod.fields.find(f => f.key === 'buildUrl')!;
    const due = mod.fields.find(f => f.key === 'dueAt')!;
    expect(canEditField(build, dev)).toBe(true);
    expect(canEditField(build, otherDev)).toBe(false);
    expect(canEditField(due, dev)).toBe(false);
    expect(canEditField(due, sme)).toBe(true);
  });
});

describe('stage timestamps', () => {
  const t1 = new Date('2026-11-02T06:00:00Z');
  const t2 = new Date('2026-11-03T06:00:00Z');

  it('stamps first start once', () => {
    const p = stagePatch(mod, base, 'in_progress', t1);
    expect(p.firstStartedAt).toEqual(t1);
    const again = stagePatch(mod, { ...base, status: 'on_hold', firstStartedAt: t1 }, 'in_progress', t2);
    expect(again.firstStartedAt).toBeUndefined();
  });

  it('counts review rounds on every submission', () => {
    const s1 = stagePatch(mod, { ...base, status: 'in_progress' }, 'ready_for_review', t1);
    expect(s1.reviewRounds).toBe(1);
    expect(s1.lastSubmittedAt).toEqual(t1);
    const s2 = stagePatch(mod, { ...base, status: 'corrections', reviewRounds: 1 }, 'ready_for_review', t2);
    expect(s2.reviewRounds).toBe(2);
  });

  it('records feedback, approval and completion', () => {
    const fb = stagePatch(mod, { ...base, status: 'ready_for_review' }, 'corrections', t1);
    expect(fb.lastFeedbackAt).toEqual(t1);
    expect(fb.firstReviewAt).toEqual(t1);
    const ok = stagePatch(mod, { ...base, status: 'in_review', firstReviewAt: t1 }, 'reviewed', t2);
    expect(ok.approvedAt).toEqual(t2);
    const done = stagePatch(mod, { ...base, status: 'reviewed', approvedAt: t2 }, 'done', t2);
    expect(done.completedAt).toEqual(t2);
  });

  it('treats leaving done as a reopen', () => {
    const p = stagePatch(mod, { ...base, status: 'done', approvedAt: t1, completedAt: t1 }, 'corrections', t2);
    expect(p.reopenCount).toBe(1);
    expect(p.completedAt).toBeNull();
    expect(p.approvedAt).toBeNull();
  });
});
