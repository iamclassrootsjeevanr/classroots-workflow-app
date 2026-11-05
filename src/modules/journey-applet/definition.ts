import { z } from 'zod';
import { addWorkingDays, parseJourneyKey, workingDaysInclusive } from '@/lib/journey';
import type { GroupSummary, StatusDef, WorkTypeDefinition } from '../types';

/**
 * Journey – one row per journey (GxxCxxSTnJn). The SME creator builds it with Claude (Spine → Script → Build → Ship), the
 * journey's SME reviewer reviews it (with a correction loop) and closes the review, then the after-steps take it to prod.
 * From the SME / coordinator's answers (docs/JOURNEY-BRIEF.md, Nov 2026); mirrors the Slack "Journey tracker" list.
 * Stages can be renamed, paused, skipped and added in Admin → Work types → Stages (src/lib/stages.ts).
 */

const CREATOR = ['ASSIGNEE'] as const;
const REVIEWER = ['OWNER'] as const;
const COORDINATOR = ['assign'] as const;

const statuses: StatusDef[] = [
  // Creation (the SME creator, with Claude). Two working days from picked up to submitted.
  { key: 'allocated', label: 'Allocated', color: '#90a4ae', category: 'queue', marks: ['assigned'], phase: 'creation', next: { label: 'Start', by: [...CREATOR] } },
  { key: 'spine', label: '3a · Spine', color: '#ffb74d', category: 'active', marks: ['started'], phase: 'creation', next: { label: 'Spine done', by: [...CREATOR] } },
  { key: 'script', label: '3b · Script', color: '#ffa726', category: 'active', marks: ['started'], phase: 'creation', next: { label: 'Script done', by: [...CREATOR] } },
  { key: 'build', label: '4 · Build', color: '#fb8c00', category: 'active', marks: ['started'], phase: 'creation', next: { label: 'Build done', by: [...CREATOR] } },
  { key: 'ship', label: '5 · Ship', color: '#ef6c00', category: 'active', marks: ['started'], phase: 'creation', next: { label: 'Submit for review', by: [...CREATOR], stamp: ['submittedAt'] } },
  // Review (the journey's SME reviewer).
  { key: 'ready_for_review', label: 'Ready for review', color: '#7e57c2', category: 'review', marks: ['submitted'], stuckHours: 4.5, next: { label: 'Start review', by: [...REVIEWER], stamp: ['reviewDate'] } },
  { key: 'review_in_progress', label: 'In progress', color: '#5c6bc0', category: 'review', marks: ['review'], stuckHours: 4.5, locked: true, next: { label: 'Close review', by: [...REVIEWER] } },
  { key: 'changes_asked', label: 'Changes asked', color: '#e53935', category: 'feedback', marks: ['feedback'], stuckHours: 4.5, line: 'side' },
  { key: 'correction_verification', label: 'Correction verification', color: '#8e24aa', category: 'review', marks: ['submitted', 'review'], stuckHours: 2.25, line: 'side' },
  { key: 'closed', label: 'Closed', color: '#43a047', category: 'approved', marks: ['approved'], locked: true, next: { label: 'Send to design standardization', by: [...COORDINATOR] } },
  // After-steps (owners still to be confirmed; the coordinator moves them on by default).
  { key: 'design_standardization', label: 'Design standardization', color: '#26a69a', category: 'active', state: 'paused', next: { label: 'Design done', by: [...COORDINATOR] } },
  { key: 'last_look', label: 'Last look after design', color: '#00897b', category: 'review', next: { label: 'Last look done', by: [...CREATOR] } },
  { key: 'video_replacement', label: 'Video replacement', color: '#00796b', category: 'active', next: { label: 'Videos replaced', by: [...COORDINATOR] } },
  { key: 'uat_to_prod', label: 'UAT → prod migration', color: '#0288d1', category: 'active', next: { label: 'Migrated to prod', by: [...COORDINATOR] } },
  { key: 'published_prod', label: 'Published on prod', color: '#1976d2', category: 'approved', next: { label: 'Start user testing', by: [...COORDINATOR] } },
  { key: 'user_testing_qa', label: 'User testing and QA', color: '#3949ab', category: 'review', next: { label: 'Mark done', by: [...COORDINATOR] } },
  { key: 'done', label: 'Done', color: '#1e88e5', category: 'done', marks: ['completed'] },
];

/** Where a stage sits in the journey's life, from the effective stage order (so added or skipped stages fall in place). */
export type JourneyPart = 'not_started' | 'creating' | 'review' | 'changes' | 'closed' | 'after' | 'done';

export function journeyPart(mod: Pick<WorkTypeDefinition, 'statuses'>, status: string): JourneyPart {
  if (status === 'changes_asked') return 'changes';
  if (status === 'correction_verification') return 'review';
  const main = mod.statuses.filter(s => (s.line ?? 'main') === 'main').map(s => s.key);
  const i = main.indexOf(status);
  const at = (k: string) => main.indexOf(k);
  if (i <= 0) return 'not_started';
  if (i < at('ready_for_review')) return 'creating';
  if (i < at('closed')) return 'review';
  if (i === at('closed')) return 'closed';
  if (i < at('done')) return 'after';
  return 'done';
}

const SERIES: { part: JourneyPart; label: string; color: string }[] = [
  { part: 'not_started', label: 'Not started', color: '#90a4ae' },
  { part: 'creating', label: 'Creating', color: '#fb8c00' },
  { part: 'review', label: 'In review', color: '#7e57c2' },
  { part: 'changes', label: 'Changes asked', color: '#e53935' },
  { part: 'closed', label: 'Closed', color: '#43a047' },
  { part: 'after', label: 'After-steps', color: '#00897b' },
  { part: 'done', label: 'Done', color: '#1e88e5' },
];

function chapterSummary(mod: WorkTypeDefinition): GroupSummary {
  const partOf = (status: string) => journeyPart(mod, status);
  return {
    label: 'Chapter',
    columns: [
      { key: 'total', label: 'Journeys' },
      ...SERIES.map(s => ({ key: s.part, label: s.label })),
      { key: 'closedPct', label: 'Review closed %' },
    ],
    compute: items => {
      const counts = Object.fromEntries(SERIES.map(s => [s.part, 0])) as Record<JourneyPart, number>;
      for (const i of items) counts[partOf(i.status)]++;
      const total = items.length;
      const closed = counts.closed + counts.after + counts.done;
      const pct = total ? Math.round((closed / total) * 1000) / 10 : 0;
      return {
        cells: { total, ...counts, closedPct: total ? `${pct}%` : '—' },
        result: !total ? { label: 'No journeys', tone: 'muted' } : closed === total ? { label: 'All reviewed', tone: 'ok' } : counts.changes ? { label: 'Changes asked', tone: 'bad' } : { label: 'In progress', tone: 'warn' },
        series: Object.fromEntries(SERIES.map(s => [s.label, counts[s.part]])),
      };
    },
    seriesColors: Object.fromEntries(SERIES.map(s => [s.label, s.color])),
    seriesStatuses: Object.fromEntries(SERIES.map(s => [s.label, mod.statuses.filter(st => partOf(st.key) === s.part).map(st => st.key)])),
    successSeries: ['Closed', 'After-steps', 'Done'],
    successLabel: 'Review closed',
    headline: 'closedPct',
  };
}

export const journeyApplet: WorkTypeDefinition = {
  key: 'journey-applet',
  name: 'Journey',
  description: 'Journeys built by SME creators with Claude, reviewed by an SME reviewer, then standardised and taken to prod.',
  icon: 'route',
  pages: { groups: 'Chapters', items: 'Journeys' },
  itemNoun: 'journey',
  labels: { assignee: 'SME creator', owner: 'SME reviewer', group: 'Chapter', due: 'Closure due' },
  categoryLabels: { queue: 'Not started', active: 'Being worked', review: 'In review', feedback: 'Changes asked', approved: 'Review closed', done: 'Done', hold: 'Paused' },
  importRoles: { assignee: 'sme-creator', owner: 'sme-reviewer' },

  roles: [
    { key: 'sme-creator', name: 'SME creator', description: 'Builds journeys with Claude: moves them through Spine, Script, Build and Ship, submits them, makes the corrections.', color: '#ef6c00', capabilities: ['work'], dataScope: 'ALL', canEdit: true, pages: ['dashboard', 'items', 'reports'] },
    { key: 'sme-reviewer', name: 'SME reviewer', description: 'Reviews the journeys where they are the reviewer: starts the review, asks for changes, verifies corrections, closes the review.', color: '#7e57c2', capabilities: ['review'], dataScope: 'ALL', canEdit: true, pages: ['dashboard', 'items', 'reports'] },
    { key: 'coordinator', name: 'Coordinator', description: 'Chapter steward: adds journeys, allocates creators and reviewers, edits details, moves journeys through the after-steps.', color: '#00897b', capabilities: ['assign', 'create', 'manageFields'], dataScope: 'ALL', canEdit: true, pages: ['dashboard', 'items', 'reports', 'export'] },
    { key: 'program-manager', name: 'Program manager', description: 'Watches the dashboards and reports; cannot change journeys.', color: '#546e7a', capabilities: [], dataScope: 'ALL', canEdit: false, pages: ['dashboard', 'items', 'reports', 'export'] },
  ],
  statuses,
  initialStatus: 'allocated',
  assignedStatus: 'allocated',

  transitions: [
    { from: 'review_in_progress', to: 'changes_asked', by: [...REVIEWER], label: 'Ask for changes', requires: 'feedback' },
    { from: 'changes_asked', to: 'correction_verification', by: [...CREATOR], label: 'Corrections done' },
    { from: 'correction_verification', to: 'changes_asked', by: [...REVIEWER], label: 'Ask for changes again', requires: 'feedback' },
    { from: 'correction_verification', to: '@next:review_in_progress', by: [...REVIEWER], label: 'Close review' },
  ],

  fields: [
    { key: 'pickedUpAt', label: 'Picked up', type: 'date', source: 'data', editableBy: ['ASSIGNEE', 'OWNER', 'manageFields'] },
    { key: 'submittedAt', label: 'Submitted for review', type: 'date', source: 'data', editableBy: ['ASSIGNEE', 'OWNER', 'manageFields'] },
    { key: 'daysTaken', label: 'Days taken', type: 'number', source: 'data', editableBy: [], computed: true },
    { key: 'reviewDate', label: 'Review date', type: 'date', source: 'data', editableBy: ['OWNER', 'manageFields'] },
    { key: 'dueAt', label: 'Closure due', type: 'date', source: 'core', editableBy: [], computed: true },
    { key: 'subtopic', label: 'Subtopic', type: 'text', source: 'data', editableBy: [], computed: true },
    { key: 'cmsUrl', label: 'UAT CMS journey', type: 'url', source: 'data', editableBy: ['ASSIGNEE', 'OWNER', 'manageFields'], linkLabel: 'Open CMS' },
    { key: 'aiTutorUrl', label: 'AI Tutor', type: 'url', source: 'data', editableBy: ['ASSIGNEE', 'OWNER', 'manageFields'], linkLabel: 'Open AI Tutor' },
    { key: 'buildUrl', label: 'Applet build', type: 'url', source: 'data', editableBy: ['ASSIGNEE', 'OWNER', 'manageFields'], linkLabel: 'Open build' },
  ],

  dataSchema: z
    .object({
      pickedUpAt: z.string().optional(),
      submittedAt: z.string().optional(),
      daysTaken: z.number().optional(),
      reviewDate: z.string().optional(),
      subtopic: z.string().optional(),
      cmsUrl: z.string().optional(),
      aiTutorUrl: z.string().optional(),
      buildUrl: z.string().optional(),
    })
    .passthrough(),

  columns: [
    { key: 'externalKey', label: 'Journey' },
    { key: 'title', label: 'Name' },
    { key: 'assignee', label: 'SME creator' },
    { key: 'owner', label: 'SME reviewer' },
    { key: 'status', label: 'Stage' },
    { key: 'dueAt', label: 'Closure due' },
  ],
  table: {
    extra: [
      { field: 'creationStage', label: 'Creation stage' },
      { field: 'pickedUpAt', label: 'Picked up' },
      { field: 'submittedAt', label: 'Submitted for review' },
      { field: 'daysTaken', label: 'Days taken' },
      { field: 'reviewState', label: 'Review state' },
      { field: 'reviewDate', label: 'Review date' },
      { field: 'finalStatus', label: 'Final status' },
    ],
  },

  sortOrder: data => Number(String(data.subtopic ?? '').replace(/\D/g, '')) * 100 + (Number(data.journeyNo) || 0),

  view: (item, mod) => {
    const part = journeyPart(mod, item.status);
    const label = mod.statuses.find(s => s.key === item.status)?.label ?? item.status;
    const created = part !== 'not_started' && part !== 'creating';
    const reviewClosed = part === 'closed' || part === 'after' || part === 'done';
    return {
      creationStage: part === 'not_started' ? 'Not started' : created ? 'Published' : label,
      reviewState: reviewClosed ? 'Closed' : created ? label : '',
      finalStatus: reviewClosed ? 'Closed' : 'In progress',
    };
  },

  compute: ({ externalKey, data }, cal) => {
    const out: Record<string, unknown> = { ...data };
    const key = parseJourneyKey(externalKey);
    if (key) {
      out.subtopic = key.subtopic;
      out.journeyNo = key.journey;
    }
    const days = workingDaysInclusive(data.pickedUpAt, data.submittedAt, cal);
    if (days == null) delete out.daysTaken;
    else out.daysTaken = days;
    return { data: out, dueAt: addWorkingDays(data.reviewDate, 1, cal) };
  },

  groupSummaryFor: chapterSummary,

  workDays: [1, 2, 3, 4, 5],
  dueEndsAt: 'approved',
  notifyOn: { submitted: true, approved: true },
  phaseLimits: { creation: { label: 'Creation (picked up → submitted)', hours: 18 } },
  stuckAfterHours: {},
};
