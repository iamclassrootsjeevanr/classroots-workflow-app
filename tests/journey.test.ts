import { describe, expect, it } from 'vitest';
import { addWorkingDays, creationStageFor, daysTaken, parseJourneyKey, splitJourneyCell, workingDaysInclusive } from '@/lib/journey';
import { journeyApplet as base, journeyPart } from '@/modules/journey-applet/definition';
import { applyStageConfig, landingStage } from '@/lib/stages';
import { halfOfDay } from '@/lib/time';
import { groupRollup, groupTrend } from '@/lib/groups';
import { lowerLabel } from '@/lib/text';
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
    expect(workingDaysInclusive('2026-10-28', '2026-11-01', monFri)).toBe(3);
  });
  it('skips holidays and needs both dates', () => {
    expect(workingDaysInclusive('2026-10-26', '2026-10-30', { ...monFri, holidays: new Set(['2026-10-28']) })).toBe(4);
    expect(workingDaysInclusive('2026-10-26', '', monFri)).toBeNull();
    expect(workingDaysInclusive('2026-10-30', '2026-10-26', monFri)).toBeNull();
  });
});

describe('Days taken with half days', () => {
  it('counts a pick-up in the second half and a submission in the first half as half a day', () => {
    // G04C05ST1J1: picked up Wed 28 Oct after lunch, submitted Sun 1 Nov → 0.5 + 1 + 1.
    expect(daysTaken('2026-10-28', '2026-11-01', { pickedUp: 'Second half' }, monFri)).toBe(2.5);
    expect(daysTaken('2026-10-26', '2026-10-30', { submitted: 'First half' }, monFri)).toBe(4.5);
    expect(daysTaken('2026-10-26', '2026-10-30', { pickedUp: 'Second half', submitted: 'First half' }, monFri)).toBe(4);
    expect(daysTaken('2026-10-26', '2026-10-30', { pickedUp: 'First half', submitted: 'Second half' }, monFri)).toBe(5);
  });
  it('ignores the half of a weekend day and never goes below half a day', () => {
    expect(daysTaken('2026-10-31', '2026-11-03', { pickedUp: 'Second half' }, monFri)).toBe(2);
    expect(daysTaken('2026-11-02', '2026-11-02', { pickedUp: 'Second half', submitted: 'First half' }, monFri)).toBe(0.5);
    expect(daysTaken('2026-11-02', '', {}, monFri)).toBeNull();
  });
  it('picks the half from the clock: before 14:30 is the first half of a 10:00–19:00 day', () => {
    const cal = { tz: 'Asia/Kolkata', startHour: 10, endHour: 19 };
    expect(halfOfDay(new Date('2026-11-05T08:59:00Z'), cal)).toBe('First half'); // 14:29 IST
    expect(halfOfDay(new Date('2026-11-05T09:00:00Z'), cal)).toBe('Second half'); // 14:30 IST
  });
});

describe('Creation stage', () => {
  it('understands the relay’s and the tracker’s spellings', () => {
    expect(creationStageFor('4 Build')).toBe('4 · Build');
    expect(creationStageFor('build')).toBe('4 · Build');
    expect(creationStageFor('3a Spine')).toBe('3a · Spine');
    expect(creationStageFor('3B · script')).toBe('3b · Script');
    expect(creationStageFor('published')).toBe('Published');
    expect(creationStageFor('Not started')).toBeUndefined();
    expect(creationStageFor(4)).toBeUndefined();
  });
  it('is a field: Start sets 3a · Spine, setting it on an Allocated journey starts it', () => {
    expect(mod.transitions.find(t => t.from === 'allocated')).toMatchObject({ to: 'creating', stamp: ['pickedUpAt'], set: { creationStage: '3a · Spine' } });
    expect(base.fieldMoves).toEqual([{ field: 'creationStage', from: 'allocated', to: 'creating' }]);
    expect(base.dataSchema.safeParse({ creationStage: '4 · Build' }).success).toBe(true);
    expect(base.dataSchema.safeParse({ creationStage: 'build' }).success).toBe(false);
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
    const half = base.compute!({ externalKey: 'G04C05ST1J1', data: { pickedUpAt: '2026-10-28', pickedUpHalf: 'Second half', submittedAt: '2026-11-01' } }, { ...monFri, tz: 'Asia/Kolkata', startHour: 10, endHour: 19 });
    expect(half.data.daysTaken).toBe(2.5);
  });
  it('the review date is the day the review is done, not the day it starts', () => {
    expect(mod.transitions.find(t => t.from === 'ready_for_review')?.stamp).toBeUndefined();
    expect(mod.transitions.find(t => t.from === 'review_in_progress' && t.to === 'changes_asked')?.stamp).toEqual(['reviewDate']);
    expect(mod.transitions.find(t => t.from === 'review_in_progress' && t.to === 'closed')?.stamp).toEqual(['reviewDate']);
  });
});

describe('labels mid-sentence', () => {
  it('lower-cases words but keeps acronyms', () => {
    expect(lowerLabel('SME creator')).toBe('SME creator');
    expect(lowerLabel('Tested by')).toBe('tested by');
    expect(lowerLabel('APK version')).toBe('APK version');
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

  it('creation belongs to the assigned creator, who can submit at any creation stage', () => {
    expect(canTransition(mod, 'allocated', 'creating', creator)).toBe(true);
    expect(canTransition(mod, 'creating', 'ready_for_review', creator)).toBe(true);
    expect(canTransition(mod, 'allocated', 'creating', otherCreator)).toBe(false);
    expect(canTransition(mod, 'allocated', 'creating', reviewer)).toBe(false);
    expect(base.fields.find(f => f.key === 'creationStage')?.editableBy).toEqual(['ASSIGNEE', 'manageFields']);
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

  it('the last look can send a journey back to design; QA sends it back to Changes asked with feedback', () => {
    expect(canTransition(mod, 'last_look', 'design_standardization', creator)).toBe(true);
    expect(mod.statuses.find(s => s.key === 'last_look')?.stuckHours).toBe(4.5);
    expect(allowedTransitions(mod, 'user_testing_qa', coordinator).find(t => t.to === 'changes_asked')?.requires).toBe('feedback');
    expect(canTransition(mod, 'user_testing_qa', 'changes_asked', creator)).toBe(false);
  });

  it('skips Video replacement for journeys without placeholder videos', () => {
    expect(landingStage(mod.statuses, 'video_replacement', { needsVideoReplacement: 'No' })).toBe('uat_to_prod');
    expect(landingStage(mod.statuses, 'video_replacement', { needsVideoReplacement: 'Yes' })).toBe('video_replacement');
    expect(landingStage(mod.statuses, 'video_replacement', {})).toBe('video_replacement');
  });
});

describe('per-chapter rollup', () => {
  it('counts each part of the journey and the share with review closed', () => {
    const item = (groupKey: string, status: string) => ({ groupKey, status, category: mod.statuses.find(s => s.key === status)!.category, data: {}, assigneeId: 'u' });
    const rows = groupRollup(mod, [item('G04C05', 'creating'), item('G04C05', 'closed'), item('G04C05', 'changes_asked'), item('G04C05', 'done'), item('G05C02', 'allocated')]);
    expect(rows.map(r => r.group)).toEqual(['G04C05', 'G05C02']);
    expect(rows[0].cells).toMatchObject({ total: 4, creating: 1, changes: 1, closed: 1, done: 1, closedPct: '50%' });
    expect(rows[0].result?.label).toBe('Changes asked');
    const t = groupTrend(mod, rows);
    expect(t.successLabel).toBe('Review closed');
    expect(t.points.map(p => p.rate)).toEqual([50, 0]);
  });
});

describe('tracker columns from the stage', () => {
  const view = (status: string, creationStage?: string) => base.view!({ status, data: creationStage ? { creationStage } : {} }, mod);
  it('shows creation stage, review state and final status like the Slack list, each on its own', () => {
    expect(view('allocated')).toEqual({ creationStage: 'Not started', reviewState: '', finalStatus: 'In progress' });
    expect(view('creating', '4 · Build')).toEqual({ creationStage: '4 · Build', reviewState: '', finalStatus: 'In progress' });
    // G05C02ST4J2: submitted while still at 3a · Spine.
    expect(view('ready_for_review', '3a · Spine')).toEqual({ creationStage: '3a · Spine', reviewState: 'Ready for review', finalStatus: 'In progress' });
    expect(view('changes_asked', 'Published')).toEqual({ creationStage: 'Published', reviewState: 'Changes asked', finalStatus: 'In progress' });
    expect(view('video_replacement', 'Published')).toEqual({ creationStage: 'Published', reviewState: 'Closed', finalStatus: 'Closed' });
  });
  it('places every stage in one part of the journey', () => {
    expect(mod.statuses.map(s => journeyPart(mod, s.key))).toEqual([
      'not_started', 'creating', 'review', 'review', 'changes', 'review', 'closed', 'after', 'after', 'after', 'after', 'after', 'after', 'done',
    ]);
  });
});
