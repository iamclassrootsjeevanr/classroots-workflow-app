import { z } from 'zod';
import type { GroupSummaryRow, WorkTypeDefinition } from '../types';

/**
 * APK Testing – every APK build is run through the test-case list. One item per build × test case,
 * grouped by APK version. Testers run the cases; the app developer marks failures as fixed; testers retest.
 * Mirrors the "Test Execution" tab of the APK Testing Tracker sheet.
 */

/** Result rules from the tracker's Version Summary tab. */
export const APK_RESULT_RULES = { goodAtLeast: 0.8, stableAtLeast: 0.9 };

export function apkVersionResult(r: { total: number; pass: number; fail: number; notTested: number; inProgress: number }): NonNullable<GroupSummaryRow['result']> {
  if (!r.total) return { label: 'No tests', tone: 'muted' };
  if (r.notTested === r.total) return { label: 'Not started', tone: 'muted' };
  if (r.pass === r.total) return { label: 'All passed', tone: 'ok' };
  const rate = r.pass / r.total;
  if (rate >= APK_RESULT_RULES.stableAtLeast) return { label: 'Stable', tone: 'ok' };
  if (rate >= APK_RESULT_RULES.goodAtLeast) return { label: 'Good', tone: 'ok' };
  if (r.fail) return { label: 'Has failures', tone: 'bad' };
  return { label: 'In progress', tone: 'warn' };
}

export const apkTesting: WorkTypeDefinition = {
  key: 'apk-testing',
  name: 'APK Testing',
  description: 'Each APK build run through the test-case list: tested, failures fixed, retested, passed.',
  itemNoun: 'test',
  labels: { assignee: 'Tested by', owner: 'Owner', group: 'APK version' },
  importRoles: { assignee: 'tester', owner: 'app-developer' },
  categoryLabels: { queue: 'Not tested', active: 'In process', feedback: 'Failed', review: 'Fixed / pending retest', done: 'Passed', hold: 'Not reported' },

  statuses: [
    { key: 'not_tested', label: 'Not Tested', color: '#90a4ae', category: 'queue', marks: ['assigned'], sheetValue: 'Not Tested' },
    { key: 'in_process', label: 'In Process', color: '#fb8c00', category: 'active', marks: ['started'], sheetValue: 'In Process' },
    { key: 'fail', label: 'Fail', color: '#e53935', category: 'feedback', marks: ['started', 'submitted', 'feedback'], sheetValue: 'Fail' },
    { key: 'fixed', label: 'Fixed', color: '#5c6bc0', category: 'review', marks: ['review'], sheetValue: 'Fixed' },
    { key: 'pending_retest', label: 'Pending Retest', color: '#fdd835', category: 'review', marks: ['review'], sheetValue: 'Pending Retest' },
    { key: 'pass', label: 'Pass', color: '#43a047', category: 'done', marks: ['started', 'submitted', 'approved', 'completed'], sheetValue: 'Pass' },
    { key: 'not_reported', label: 'Not Reported', color: '#8d6e63', category: 'hold', sheetValue: 'Not Reported' },
  ],
  initialStatus: 'not_tested',
  assignedStatus: 'not_tested',

  transitions: [
    { from: 'not_tested', to: 'in_process', by: ['ASSIGNEE'], label: 'Start testing' },
    { from: 'not_tested', to: 'pass', by: ['ASSIGNEE'], label: 'Pass' },
    { from: 'not_tested', to: 'fail', by: ['ASSIGNEE'], label: 'Fail' },
    { from: 'not_tested', to: 'not_reported', by: ['ASSIGNEE'], label: 'Not reported' },
    { from: 'in_process', to: 'pass', by: ['ASSIGNEE'], label: 'Pass' },
    { from: 'in_process', to: 'fail', by: ['ASSIGNEE'], label: 'Fail' },
    { from: 'in_process', to: 'not_reported', by: ['ASSIGNEE'], label: 'Not reported' },
    { from: 'fail', to: 'fixed', by: ['review'], label: 'Mark fixed (developer)' },
    { from: 'fail', to: 'pending_retest', by: ['review', 'ASSIGNEE'], label: 'Send for retest' },
    { from: 'fixed', to: 'pending_retest', by: ['ASSIGNEE', 'review'], label: 'Queue retest' },
    { from: 'fixed', to: 'pass', by: ['ASSIGNEE'], label: 'Retested – pass' },
    { from: 'fixed', to: 'fail', by: ['ASSIGNEE'], label: 'Retested – still fails' },
    { from: 'pending_retest', to: 'pass', by: ['ASSIGNEE'], label: 'Retested – pass' },
    { from: 'pending_retest', to: 'fail', by: ['ASSIGNEE'], label: 'Retested – still fails' },
    { from: 'not_reported', to: 'in_process', by: ['ASSIGNEE'], label: 'Start testing' },
    { from: 'pass', to: 'fail', by: ['ASSIGNEE', 'review'], label: 'Reopen as fail' },
  ],

  fields: [
    { key: 'testCaseId', label: 'Test case', type: 'text', source: 'data', editableBy: [] },
    { key: 'scenario', label: 'Test scenario', type: 'longtext', source: 'data', editableBy: ['manageFields'] },
    { key: 'expected', label: 'Expected result', type: 'longtext', source: 'data', editableBy: ['manageFields'] },
    { key: 'steps', label: 'Test steps', type: 'longtext', source: 'data', editableBy: ['manageFields'] },
    { key: 'priority', label: 'Priority', type: 'text', source: 'data', editableBy: ['ASSIGNEE', 'manageFields'] },
    { key: 'comments', label: 'Tester comments', type: 'longtext', source: 'data', editableBy: ['ASSIGNEE'] },
    { key: 'bug', label: 'Bug / issue', type: 'longtext', source: 'data', editableBy: ['ASSIGNEE'] },
    { key: 'developerRemarks', label: 'Developer remarks', type: 'longtext', source: 'data', editableBy: ['review'] },
    { key: 'logDate', label: 'Log date', type: 'date', source: 'data', editableBy: ['ASSIGNEE'] },
    { key: 'releaseDate', label: 'APK release date', type: 'date', source: 'data', editableBy: ['manageFields'] },
    { key: 'apkUrl', label: 'APK file', type: 'url', source: 'data', editableBy: ['manageFields'], linkLabel: 'Open APK' },
    { key: 'releaseNotes', label: 'Release notes', type: 'longtext', source: 'data', editableBy: ['manageFields'] },
  ],

  dataSchema: z
    .object({
      testCaseId: z.string().optional(),
      scenario: z.string().optional(),
      expected: z.string().optional(),
      steps: z.string().optional(),
      priority: z.string().optional(),
      comments: z.string().optional(),
      bug: z.string().optional(),
      developerRemarks: z.string().optional(),
      logDate: z.string().optional(),
      releaseDate: z.string().optional(),
      apkUrl: z.string().optional(),
      releaseNotes: z.string().optional(),
    })
    .passthrough(),

  columns: [
    { key: 'testCaseId', label: 'Test case' },
    { key: 'title', label: 'Feature / module' },
    { key: 'assignee', label: 'Tested by' },
    { key: 'status', label: 'Status' },
    { key: 'priority', label: 'Priority' },
    { key: 'bug', label: 'Bug / issue' },
  ],

  workloadWeight: 0.05,

  sortOrder: data => {
    const m = String(data.testCaseId ?? '').match(/(\d+)/);
    return m ? Number(m[1]) : 0;
  },

  groupSummary: {
    label: 'APK version',
    columns: [
      { key: 'releaseDate', label: 'Release date' },
      { key: 'total', label: 'Total tests' },
      { key: 'pass', label: 'Pass' },
      { key: 'fail', label: 'Fail' },
      { key: 'pendingRetest', label: 'Pending retest' },
      { key: 'notTested', label: 'Not tested' },
      { key: 'other', label: 'Other' },
      { key: 'passRate', label: 'Pass %' },
    ],
    compute: items => {
      const count = (...keys: string[]) => items.filter(i => keys.includes(i.status)).length;
      const total = items.length;
      const pass = count('pass');
      const fail = count('fail');
      const pendingRetest = count('pending_retest', 'fixed');
      const notTested = count('not_tested');
      const inProgress = count('in_process');
      const other = total - pass - fail - pendingRetest - notTested;
      const releaseDate = String(items.find(i => i.data.releaseDate)?.data.releaseDate ?? '');
      return {
        cells: { releaseDate, total, pass, fail, pendingRetest, notTested, other, passRate: total ? `${Math.round((pass / total) * 1000) / 10}%` : '—' },
        result: apkVersionResult({ total, pass, fail, notTested, inProgress }),
        series: { Pass: pass, Fail: fail, 'Pending retest': pendingRetest, 'Not tested': notTested, Other: other },
      };
    },
    seriesColors: { Pass: '#43a047', Fail: '#e53935', 'Pending retest': '#fdd835', 'Not tested': '#90a4ae', Other: '#8d6e63' },
  },

  sheet: {
    defaultTab: 'Test Execution',
    updatedAtColumn: 'App Updated At',
    columns: [
      { column: 'APK Version', kind: 'key' },
      { column: 'Test Case ID', kind: 'key' },
      { column: 'APK Version', kind: 'group' },
      { column: 'Feature / Module', kind: 'title' },
      { column: 'Tested By', kind: 'assignee' },
      { column: 'Status', kind: 'status' },
      { column: 'Test Case ID', kind: 'data', field: 'testCaseId', type: 'text' },
      { column: 'Comments', kind: 'data', field: 'comments', type: 'longtext' },
      { column: 'Bug / Issue', kind: 'data', field: 'bug', type: 'longtext' },
      { column: 'Priority', kind: 'data', field: 'priority', type: 'text' },
      { column: 'Developer Remarks', kind: 'data', field: 'developerRemarks', type: 'longtext' },
      { column: 'Log Date', kind: 'data', field: 'logDate', type: 'date' },
    ],
  },

  stuckAfterHours: { queue: 45, active: 18, review: 27, feedback: 45, hold: 45 },
};
