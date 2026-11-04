import { describe, expect, it } from 'vitest';
import { addWorkingDays, parseJourneyKey, splitJourneyCell, workingDaysInclusive } from '@/lib/journey';
import { journeyApplet as base, journeyPart } from '@/modules/journey-applet/definition';
import { applyStageConfig } from '@/lib/stages';
import { groupRollup, groupTrend } from '@/lib/groups';
import { allowedTransitions, canTransition, type ActorContext } from '@/lib/workflow';
import type { Capability } from '@/lib/access-core';

const monFri = { workDays: [1, 2, 3, 4, 5], holidays: new Set<string>() };
const mod = applyStageConfig(base, []);
const ctx = (caps: Capability[], who: { assignee?: boolean; owner?: boolean } = {}): ActorContext => ({
  isAdmin: false,
  capabilities: new Set(caps),
  canEdit: true,
  isAssignee: Boolean(who.assignee),
  isOwner: Boolean(who.owner),
});

describe('Days taken (Mon–Fri, both days counted)', () => {
  it('matches the tracker rows', () => {
    expect(workingDaysInclusive('2026-10-26', '2026-10-31', monFri)).toBe(5); // G05C02ST2J1
    expect(workingDaysInclusive('2026-10-27', '2026-11-01', monFri)).toBe(4); // G05C02ST4J1
    expect(workingDaysInclusive('2026-10-26', '2026-11-01', monFri)).toBe(5); // G05C02ST3J1
    expect(workingDaysInclusive('2026-10-28', '2026-11-01', monFri)).toBe(3); // tracker says 2.5 (half day): asked
  });
  it('skips holidays and needs both dates', () => {
    expect(workingDaysInclusive('2026-10-26', '2026-10-30', { ...monFri, holidays: new Set(['2026-10-28']) })).toBe(4);
    expect(workingDaysInclusive('2026-10-26', '', monFri)).toBeNull();
    expect(workingDaysInclusive('2026-10-30', '2026-10-26', monFri)).toBeNull();
  });
});

describe('Closure due = Review date + 1 working day', () => {
  it('skips the weekend', () => {
    expect(addWorkingDays('2026-11-04', 1, monFri)).toBe('2026-11-05');
    expect(addWorkingDays('2026-11-06', 1, monFri)).toBe('2026-11-09');
    expect(addWorkingDays(undefined, 1, monFri)).toBeNull();
  });
  it('is set with Days taken by the module', () => {
    const r = base.compute!({ externalKey: 'G04C05ST3J1', data: { pickedUpAt: '2026-10-26', submittedAt: '2026-10-30', reviewDate: '2026-10-30' } }, { ...monFri, tz: 'Asia/Kolkata', startHour: 10, endHour: 19 });
    expect(r.data).toMatchObject({ daysTaken: 5, subtopic: 'ST3', journeyNo: 1 });
    expect(r.dueAt).toBe('2026-11-02');
  });
});

describe('journey keys', () => {
  it('parses GxxCxxSTnJn and the tracker cell', () => {
    expect(parseJourneyKey('G04C05ST3J1')).toEqual({ grade: 4, chapter: 'G04C05', subtopic: 'ST3', journey: 1 });
    expect(parseJourneyKey('G07C04J01')).toBeNull();
    expect(splitJourneyCell('G04C05ST1J1 · halves')).toEqual({ key: 'G04C05ST1J1', name: 'halves' });
    expect(splitJourneyCell('G06C07ST1J2')).toEqual({ key: 'G06C07ST1J2', name: 'G06C07ST1J2' });
  });
});

describe('who presses which button', () => {
  const creator = ctx(['work'], { assignee: true });
  const otherCreator = ctx(['work']);
  const reviewer = ctx(['review'], { owner: true });
  const otherReviewer = ctx(['review']);
  const coordinator = ctx(['assign', 'create', 'manageFields']);

  it('creation belongs to the assigned creator', () => {
    expect(canTransition(mod, 'allocated', 'spine', creator)).toBe(true);
    expect(canTransition(mod, 'ship', 'ready_for_review', creator)).toBe(true);
    expect(canTransition(mod, 'allocated', 'spine', otherCreator)).toBe(false);
    expect(canTransition(mod, 'allocated', 'spine', reviewer)).toBe(false);
  });

  it('review belongs to the journey’s own reviewer', () => {
    expect(canTransition(mod, 'ready_for_review', 'review_in_progress', reviewer)).toBe(true);
    expect(canTransition(mod, 'review_in_progress', 'closed', reviewer)).toBe(true);
    expect(canTransition(mod, 'ready_for_review', 'review_in_progress', otherReviewer)).toBe(false);
    expect(canTransition(mod, 'ready_for_review', 'review_in_progress', creator)).toBe(false);
  });

  it('the correction loop', () => {
    expect(allowedTransitions(mod, 'review_in_progress', reviewer).find(t => t.to === 'changes_asked')?.requires).toBe('feedback');
    expect(canTransition(mod, 'changes_asked', 'correction_verification', creator)).toBe(true);
    expect(canTransition(mod, 'correction_verification', 'closed', reviewer)).toBe(true);
    expect(canTransition(mod, 'correction_verification', 'changes_asked', reviewer)).toBe(true);
  });

  it('after-steps belong to the coordinator, except the last look', () => {
    expect(canTransition(mod, 'closed', 'design_standardization', coordinator)).toBe(true);
    expect(canTransition(mod, 'last_look', 'video_replacement', creator)).toBe(true);
    expect(canTransition(mod, 'last_look', 'video_replacement', coordinator)).toBe(false);
    expect(canTransition(mod, 'user_testing_qa', 'done', coordinator)).toBe(true);
  });
});

describe('per-chapter rollup', () => {
  it('counts each part of the journey and the share with review closed', () => {
    const item = (groupKey: string, status: string) => ({ groupKey, status, category: mod.statuses.find(s => s.key === status)!.category, data: {}, assigneeId: 'u' });
    const rows = groupRollup(mod, [item('G04C05', 'build'), item('G04C05', 'closed'), item('G04C05', 'changes_asked'), item('G04C05', 'done'), item('G05C02', 'allocated')]);
    expect(rows.map(r => r.group)).toEqual(['G04C05', 'G05C02']);
    expect(rows[0].cells).toMatchObject({ total: 4, creating: 1, changes: 1, closed: 1, done: 1, closedPct: '50%' });
    expect(rows[0].result?.label).toBe('Changes asked');
    const t = groupTrend(mod, rows);
    expect(t.successLabel).toBe('Review closed');
    expect(t.points.map(p => p.rate)).toEqual([50, 0]);
  });
});

describe('tracker columns from the stage', () => {
  const view = (status: string) => base.view!({ status, data: {} }, mod);
  it('shows creation stage, review state and final status like the Slack list', () => {
    expect(view('allocated')).toEqual({ creationStage: 'Not started', reviewState: '', finalStatus: 'In progress' });
    expect(view('build')).toEqual({ creationStage: '4 · Build', reviewState: '', finalStatus: 'In progress' });
    expect(view('changes_asked')).toEqual({ creationStage: 'Published', reviewState: 'Changes asked', finalStatus: 'In progress' });
    expect(view('video_replacement')).toEqual({ creationStage: 'Published', reviewState: 'Closed', finalStatus: 'Closed' });
  });
  it('places every stage in one part of the journey', () => {
    expect(mod.statuses.map(s => journeyPart(mod, s.key))).toEqual([
      'not_started', 'creating', 'creating', 'creating', 'creating', 'review', 'review', 'changes', 'review', 'closed', 'after', 'after', 'after', 'after', 'after', 'after', 'done',
    ]);
  });
});
