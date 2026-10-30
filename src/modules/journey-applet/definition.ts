import { z } from 'zod';
import type { WorkTypeDefinition } from '../types';

/**
 * Journey Applets – SMEs hand over a journey, a developer builds the applet,
 * it goes through review rounds and is marked done.
 * Mirrors the "Journeys in Chapters" tab of JC-TrackerDemo.
 */
export const journeyApplet: WorkTypeDefinition = {
  key: 'journey-applet',
  name: 'Journey Applets',
  description: 'Applets built for SME journeys, from hand-over to review and completion.',
  itemNoun: 'journey',
  labels: { assignee: 'Developer', owner: 'SME', group: 'Chapter' },
  importRoles: { assignee: 'developer', owner: 'reviewer' },

  statuses: [
    { key: 'received', label: 'Received from SME', color: '#78909c', category: 'queue', sheetValue: '' },
    { key: 'assigned', label: 'YTS', color: '#90a4ae', category: 'queue', marks: ['assigned'], sheetValue: 'YTS' },
    { key: 'in_progress', label: 'WIP', color: '#fb8c00', category: 'active', marks: ['started'], sheetValue: 'WIP' },
    { key: 'ready_for_review', label: 'Ready for Review', color: '#7e57c2', category: 'review', marks: ['submitted'], sheetValue: 'Ready for Review' },
    { key: 'in_review', label: 'In Review', color: '#5c6bc0', category: 'review', marks: ['review'], sheetValue: null },
    { key: 'corrections', label: 'Corrections in Progress', color: '#e53935', category: 'feedback', marks: ['review', 'feedback'], sheetValue: 'Corrections in Progress' },
    { key: 'reviewed', label: 'Reviewed', color: '#43a047', category: 'approved', marks: ['review', 'approved'], sheetValue: 'Reviewed' },
    { key: 'done', label: 'Done', color: '#1e88e5', category: 'done', marks: ['approved', 'completed'], sheetValue: 'Done' },
    { key: 'on_hold', label: 'On Hold', color: '#8d6e63', category: 'hold', sheetValue: null },
    { key: 'blocked', label: 'Blocked', color: '#d81b60', category: 'hold', sheetValue: null },
  ],
  initialStatus: 'received',
  assignedStatus: 'assigned',

  transitions: [
    { from: 'assigned', to: 'in_progress', by: ['ASSIGNEE'], label: 'Start' },
    { from: 'in_progress', to: 'ready_for_review', by: ['ASSIGNEE'], label: 'Submit for review' },
    { from: 'in_progress', to: 'on_hold', by: ['ASSIGNEE'], label: 'Put on hold' },
    { from: 'in_progress', to: 'blocked', by: ['ASSIGNEE'], label: 'Mark blocked' },
    { from: 'on_hold', to: 'in_progress', by: ['ASSIGNEE'], label: 'Resume' },
    { from: 'blocked', to: 'in_progress', by: ['ASSIGNEE'], label: 'Unblock' },
    { from: 'ready_for_review', to: 'in_progress', by: ['ASSIGNEE'], label: 'Withdraw' },
    { from: 'ready_for_review', to: 'in_review', by: ['review'], label: 'Start review' },
    { from: 'ready_for_review', to: 'reviewed', by: ['review'], label: 'Approve' },
    { from: 'ready_for_review', to: 'corrections', by: ['review'], label: 'Request corrections' },
    { from: 'in_review', to: 'reviewed', by: ['review'], label: 'Approve' },
    { from: 'in_review', to: 'corrections', by: ['review'], label: 'Request corrections' },
    { from: 'corrections', to: 'ready_for_review', by: ['ASSIGNEE'], label: 'Re-submit' },
    { from: 'reviewed', to: 'done', by: ['ASSIGNEE', 'review'], label: 'Mark done' },
    { from: 'done', to: 'corrections', by: ['review'], label: 'Reopen' },
  ],

  fields: [
    { key: 'dueAt', label: 'Expected completion', type: 'date', source: 'core', editableBy: ['manageFields'] },
    { key: 'cmsUrl', label: 'UAT CMS journey', type: 'url', source: 'data', editableBy: ['ASSIGNEE', 'manageFields'], linkLabel: 'Open CMS' },
    { key: 'aiTutorUrl', label: 'AI Tutor (English)', type: 'url', source: 'data', editableBy: ['ASSIGNEE', 'manageFields'], linkLabel: 'Open AI Tutor' },
    { key: 'buildUrl', label: 'Applet build / preview', type: 'url', source: 'data', editableBy: ['ASSIGNEE'], linkLabel: 'Open build' },
    { key: 'cmsName', label: 'UAT CMS journey name', type: 'text', source: 'data', editableBy: ['manageFields'] },
    { key: 'journeyStatus', label: 'Journey status (SME)', type: 'text', source: 'data', editableBy: ['manageFields'] },
    { key: 'journeyCompletedAt', label: 'Journey completion date (SME)', type: 'date', source: 'data', editableBy: ['manageFields'] },
    { key: 'weekOfMonth', label: 'Week of month', type: 'number', source: 'data', editableBy: ['manageFields'] },
    { key: 'sheetFeedback', label: 'Reviewer notes (sheet)', type: 'longtext', source: 'data', editableBy: ['manageFields'] },
    { key: 'notes', label: 'Developer notes', type: 'longtext', source: 'data', editableBy: ['ASSIGNEE'] },
  ],

  dataSchema: z
    .object({
      chapterTitle: z.string().optional(),
      jNumber: z.number().optional(),
      cmsName: z.string().optional(),
      cmsUrl: z.string().optional(),
      aiTutorUrl: z.string().optional(),
      buildUrl: z.string().optional(),
      journeyStatus: z.string().optional(),
      journeyCompletedAt: z.string().optional(),
      weekOfMonth: z.number().optional(),
      sheetFeedback: z.string().optional(),
      notes: z.string().optional(),
    })
    .passthrough(),

  columns: [
    { key: 'externalKey', label: 'GxxCxxJxx' },
    { key: 'title', label: 'Journey' },
    { key: 'owner', label: 'SME' },
    { key: 'assignee', label: 'Developer' },
    { key: 'status', label: 'Applet status' },
    { key: 'dueAt', label: 'Expected' },
    { key: 'delay', label: 'Delay' },
    { key: 'cmsUrl', label: 'CMS' },
    { key: 'aiTutorUrl', label: 'AI Tutor' },
  ],

  sortOrder: data => Number(data.jNumber) || 0,

  sheet: {
    defaultTab: 'Journeys in Chapters',
    updatedAtColumn: 'App Updated At',
    columns: [
      { column: 'GxxCxxJxx', kind: 'key' },
      { column: 'Journey Name', kind: 'title' },
      { column: 'Applet Status', kind: 'status' },
      { column: 'Developers', kind: 'assignee' },
      { column: 'Owner', kind: 'owner' },
      { column: 'GxxCxx', kind: 'group' },
      { column: 'Expected Completion Date', kind: 'dueAt' },
      { column: 'Chapter', kind: 'data', field: 'chapterTitle', type: 'text' },
      { column: 'J#', kind: 'data', field: 'jNumber', type: 'number' },
      { column: 'UAT CMS journey Name', kind: 'data', field: 'cmsName', type: 'text' },
      { column: 'UAT CMS journey ID', kind: 'data', field: 'cmsUrl', type: 'url' },
      { column: 'AI Tutor English Link', kind: 'data', field: 'aiTutorUrl', type: 'url' },
      { column: 'Completion Date', kind: 'data', field: 'journeyCompletedAt', type: 'date' },
      { column: 'Week of Month', kind: 'data', field: 'weekOfMonth', type: 'number' },
      { column: 'Status', kind: 'data', field: 'journeyStatus', type: 'text' },
      { column: 'Aswin feedback', kind: 'data', field: 'sheetFeedback', type: 'longtext' },
    ],
  },

  stuckAfterHours: { queue: 27, active: 45, review: 18, feedback: 27, hold: 45 },
};
