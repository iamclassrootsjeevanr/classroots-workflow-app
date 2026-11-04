import { describe, expect, it } from 'vitest';
import { applyStageConfig, isLockedStage, nextActiveAfter, positionAfter, stageKeyFor, stagePositions, stuckRules, type StageRow } from '@/lib/stages';
import { journeyApplet as base } from '@/modules/journey-applet/definition';
import { apkTesting } from '@/modules/apk-testing/definition';
import type { IntervalLite } from '@/lib/analytics-core';

const row = (key: string, patch: Partial<StageRow>): StageRow => ({
  key,
  label: null,
  color: null,
  category: null,
  position: null,
  state: null,
  nextLabel: null,
  movedBy: null,
  stuckHours: null,
  custom: false,
  ...patch,
});

const moves = (mod: ReturnType<typeof applyStageConfig>, from: string) => mod.transitions.filter(t => t.from === from).map(t => `${t.label}→${t.to}`);

describe('applyStageConfig with code defaults', () => {
  const mod = applyStageConfig(base, []);

  it('builds a forward move for every main-line stage', () => {
    expect(moves(mod, 'allocated')).toEqual(['Start→spine']);
    expect(moves(mod, 'ship')).toEqual(['Submit for review→ready_for_review']);
    expect(mod.transitions.find(t => t.from === 'ship')?.stamp).toEqual(['submittedAt']);
    expect(moves(mod, 'review_in_progress')).toEqual(['Ask for changes→changes_asked', 'Close review→closed']);
    expect(moves(mod, 'correction_verification')).toEqual(['Ask for changes again→changes_asked', 'Close review→closed']);
    expect(moves(mod, 'done')).toEqual([]);
  });

  it('starts Design standardization paused: items wait there as on hold', () => {
    const ds = mod.statuses.find(s => s.key === 'design_standardization')!;
    expect(ds.state).toBe('paused');
    expect(ds.category).toBe('hold');
    expect(ds.baseCategory).toBe('active');
    expect(moves(mod, 'closed')).toEqual(['Send to design standardization→design_standardization']);
    expect(moves(mod, 'design_standardization')).toEqual([]);
  });

  it('locks first, last, side and marked stages; APK stages have no forward move so all are locked', () => {
    expect(isLockedStage(base, 'allocated')).toBe(true);
    expect(isLockedStage(base, 'done')).toBe(true);
    expect(isLockedStage(base, 'changes_asked')).toBe(true);
    expect(isLockedStage(base, 'closed')).toBe(true);
    expect(isLockedStage(base, 'spine')).toBe(false);
    expect(apkTesting.statuses.every(s => isLockedStage(apkTesting, s.key))).toBe(true);
  });

  it('leaves APK Testing unchanged', () => {
    const apk = applyStageConfig(apkTesting, []);
    expect(apk.transitions).toEqual(apkTesting.transitions);
    expect(apk.statuses.map(s => s.key)).toEqual(apkTesting.statuses.map(s => s.key));
  });
});

describe('admin stage changes', () => {
  it('skipping a stage makes moves jump over it', () => {
    const mod = applyStageConfig(base, [row('script', { state: 'skipped' })]);
    expect(moves(mod, 'spine')).toEqual(['Spine done→build']);
    expect(nextActiveAfter(mod.statuses, 'spine')).toBe('build');
    // Items already sitting in the skipped stage can still move on.
    expect(moves(mod, 'script')).toEqual(['Script done→build']);
  });

  it('resuming a paused stage gives its button back', () => {
    const mod = applyStageConfig(base, [row('design_standardization', { state: 'active' })]);
    expect(moves(mod, 'design_standardization')).toEqual(['Design done→last_look']);
    expect(mod.statuses.find(s => s.key === 'design_standardization')?.category).toBe('active');
  });

  it('ignores pause / skip on locked stages', () => {
    const mod = applyStageConfig(base, [row('closed', { state: 'skipped' }), row('allocated', { state: 'paused' })]);
    expect(mod.statuses.find(s => s.key === 'closed')?.state).toBe('active');
    expect(moves(mod, 'review_in_progress')).toContain('Close review→closed');
    expect(mod.initialStatus).toBe('allocated');
  });

  it('renames, recolours, re-times and re-assigns a stage button', () => {
    const mod = applyStageConfig(base, [row('build', { label: 'Build applets', color: '#000000', stuckHours: 6, nextLabel: 'Applets built', movedBy: ['assign'] })]);
    const s = mod.statuses.find(x => x.key === 'build')!;
    expect(s).toMatchObject({ label: 'Build applets', color: '#000000', stuckHours: 6 });
    expect(mod.transitions.find(t => t.from === 'build')).toMatchObject({ label: 'Applets built', by: ['assign'], to: 'ship' });
  });

  it('adds a custom stage between two stages', () => {
    const positions = stagePositions(base, []);
    const pos = positionAfter(applyStageConfig(base, []), positions, 'build');
    expect(pos).toBe(45);
    const mod = applyStageConfig(base, [row('qa_check', { custom: true, label: 'QA check', category: 'review', position: pos, nextLabel: 'QA passed', movedBy: ['review'] })]);
    expect(mod.statuses.map(s => s.key).slice(3, 6)).toEqual(['build', 'qa_check', 'ship']);
    expect(moves(mod, 'build')).toEqual(['Build done→qa_check']);
    expect(moves(mod, 'qa_check')).toEqual(['QA passed→ship']);
    expect(mod.statuses.find(s => s.key === 'qa_check')?.custom).toBe(true);
    expect(mod.statuses.find(s => s.key === 'qa_check')?.locked).toBeFalsy();
  });

  it('retargets a correction-loop exit when the stage after review is changed', () => {
    const mod = applyStageConfig(base, [row('sign_off', { custom: true, label: 'Sign-off', category: 'review', position: 75, nextLabel: 'Signed off', movedBy: ['review'] })]);
    expect(moves(mod, 'correction_verification')).toContain('Close review→sign_off');
    expect(moves(mod, 'review_in_progress')).toContain('Close review→sign_off');
  });

  it('builds the chapter summary from the effective stages', () => {
    const mod = applyStageConfig(base, [row('qa_check', { custom: true, label: 'QA check', category: 'review', position: 45, movedBy: ['review'] })]);
    expect(mod.groupSummary?.seriesStatuses?.Creating).toEqual(['spine', 'script', 'build', 'qa_check', 'ship']);
    expect(mod.groupSummary?.seriesStatuses?.['In review']).toEqual(['ready_for_review', 'review_in_progress', 'correction_verification']);
  });

  it('makes unique keys for new stages', () => {
    expect(stageKeyFor('QA check', ['spine'])).toBe('qa_check');
    expect(stageKeyFor('Spine', ['spine', 'spine_2'])).toBe('spine_3');
  });
});

describe('stuck rules', () => {
  const mod = applyStageConfig(base, []);
  const at = (h: number) => new Date(Date.UTC(2026, 10, 2, 4 + h));
  const iv = (status: string, from: number, to: number | null): IntervalLite => ({ itemId: 'a', status, category: 'active', assigneeId: 'u', enteredAt: at(from), exitedAt: to == null ? null : at(to), round: 1 });

  it('measures the creation phase from entering its first stage', () => {
    const list = [iv('allocated', 0, 1), iv('spine', 1, 2), iv('script', 2, null)];
    expect(stuckRules(mod, list)(list[2])).toEqual({ hours: 18, since: at(0) });
  });

  it('uses the stage limit for review stages and none for paused stages', () => {
    const r = iv('ready_for_review', 0, null);
    expect(stuckRules(mod, [r])(r)).toEqual({ hours: 4.5 });
    const p = iv('design_standardization', 0, null);
    expect(stuckRules(mod, [p])(p)).toBeUndefined();
  });
});
