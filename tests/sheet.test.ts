import { describe, expect, it } from 'vitest';
import { journeyApplet as mod } from '@/modules/journey-applet/definition';
import { diffRow, itemSheetValues, sheetRowValues, statusFromSheet } from '@/lib/sheet-core';
import { dueDateToInstant } from '@/lib/time';

describe('3-way diff', () => {
  const base = { 'Applet Status': 'WIP', Developers: 'Jeevan' };

  it('applies sheet-only changes to the app', () => {
    const d = diffRow({ 'Applet Status': 'Done', Developers: 'Jeevan' }, base, { 'Applet Status': 'WIP', Developers: 'Jeevan' });
    expect(d).toEqual({ fromSheet: ['Applet Status'], toSheet: [], conflicts: [] });
  });

  it('pushes app-only changes to the sheet', () => {
    const d = diffRow(base, base, { 'Applet Status': 'Ready for Review', Developers: 'Jeevan' });
    expect(d).toEqual({ fromSheet: [], toSheet: ['Applet Status'], conflicts: [] });
  });

  it('flags conflicts when both changed differently', () => {
    const d = diffRow({ 'Applet Status': 'Done', Developers: 'Jeevan' }, base, { 'Applet Status': 'Reviewed', Developers: 'Jeevan' });
    expect(d.conflicts).toEqual(['Applet Status']);
  });

  it('does nothing when both sides already agree', () => {
    const d = diffRow({ 'Applet Status': 'Done', Developers: 'Swathi' }, base, { 'Applet Status': 'Done', Developers: 'Swathi' });
    expect(d).toEqual({ fromSheet: [], toSheet: [], conflicts: [] });
  });

  it('takes the sheet value on first sync of a column', () => {
    expect(diffRow({ Owner: 'Krishna' }, {}, { Owner: '' }).fromSheet).toEqual(['Owner']);
  });

  it('never pushes app-only statuses', () => {
    expect(diffRow(base, base, { 'Applet Status': null, Developers: 'Jeevan' })).toEqual({ fromSheet: [], toSheet: [], conflicts: [] });
    expect(diffRow({ ...base, 'Applet Status': 'Done' }, base, { 'Applet Status': null, Developers: 'Jeevan' }).fromSheet).toEqual(['Applet Status']);
  });
});

describe('mapping', () => {
  it('maps sheet status text to module statuses', () => {
    expect(statusFromSheet(mod, 'WIP', true)).toBe('in_progress');
    expect(statusFromSheet(mod, 'corrections in progress', true)).toBe('corrections');
    expect(statusFromSheet(mod, '', false)).toBe('received');
    expect(statusFromSheet(mod, '', true)).toBe('assigned');
    expect(statusFromSheet(mod, 'Something else', true)).toBeNull();
  });

  it('normalizes rows and round-trips app values', () => {
    const row = {
      GxxCxxJxx: 'G07C04J01',
      'Journey Name': 'Introduction to letter-number ',
      'Applet Status': 'Done',
      Developers: 'Jeevan',
      Owner: 'Krishna',
      GxxCxx: 'G07C04',
      'Expected Completion Date': '02/09/2026',
      'J#': 1,
      'Week of Month': '1',
    };
    const v = sheetRowValues(mod, row);
    expect(v['Expected Completion Date']).toBe('2026-09-02');
    expect(v['Journey Name']).toBe('Introduction to letter-number');
    const app = itemSheetValues(mod, {
      title: 'Introduction to letter-number',
      status: 'done',
      groupKey: 'G07C04',
      dueAt: dueDateToInstant('2026-09-02'),
      data: { jNumber: 1, weekOfMonth: 1 },
      assigneeName: 'Jeevan',
      ownerName: 'Krishna',
    });
    expect(diffRow(v, v, app)).toEqual({ fromSheet: [], toSheet: [], conflicts: [] });
  });
});

describe('linked tabs (lists, reference tables) are updated first', () => {
  it('builds lists, test cases and releases for new items, in order', async () => {
    const { linkedPayloads } = await import('@/lib/sheet-core');
    const { apkTesting } = await import('@/modules/apk-testing/definition');
    const items = [
      { title: 'Login', groupKey: 'v2', assigneeName: 'Asha', data: { testCaseId: 'TC_1', scenario: 'Sign in', expected: 'Home', defaultPriority: 'High', steps: '1. open', releaseDate: '2026-11-02', apkUrl: 'https://x/a.apk', releaseNotes: 'new' } },
      { title: 'Home', groupKey: 'v2', assigneeName: 'Asha', data: { testCaseId: 'TC_2' } },
    ];
    const p = linkedPayloads(apkTesting, items);
    expect(p.map(x => `${x.tab}:${x.kind}`)).toEqual(['Lists:values', 'Test Cases:rows', 'APK Releases:rows', 'Version Summary:summary']);
    expect(p[0]).toMatchObject({ column: 'Tested By', values: ['Asha'] });
    const cases = p[1];
    expect(cases.kind === 'rows' && cases.rows.map(r => r.key)).toEqual(['TC_1', 'TC_2']);
    expect(cases.kind === 'rows' && cases.rows[0].values).toMatchObject({ 'Feature / Module': 'Login', 'Test Scenario': 'Sign in', 'Default Priority': 'High' });
    const rel = p[2];
    expect(rel.kind === 'rows' && rel.rows).toEqual([{ key: 'v2', values: { 'Release Date': '2026-11-02', 'APK Link': 'https://x/a.apk', Notes: 'new' } }]);
    expect(p[3]).toMatchObject({ kind: 'summary', values: ['v2'], totalLabel: 'Total' });
  });
  it('skips empty values', async () => {
    const { linkedPayloads } = await import('@/lib/sheet-core');
    const { apkTesting } = await import('@/modules/apk-testing/definition');
    expect(linkedPayloads(apkTesting, [{ title: 'x', groupKey: null, assigneeName: null, data: {} }])).toEqual([]);
  });
});
