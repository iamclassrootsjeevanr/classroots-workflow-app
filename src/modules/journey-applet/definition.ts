import { z } from 'zod';
import { addWorkingDays, CREATION_STAGES, daysTaken, parseJourneyKey } from '@/lib/journey';
import { HALF_DAYS } from '@/lib/time';
import type { GroupSummary, StatusDef, WorkTypeDefinition } from '../types';

/**
 * Journey – one row per journey (GxxCxxSTnJn). The SME creator builds it with Claude (Creation stage: Spine → Script → Build →
 * Ship → Published), the journey's SME reviewer reviews it (with a correction loop) and closes the review, then the after-steps
 * take it to prod. Creation stage is its own field, not a stage of the line: a journey can be submitted for review before it
 * reaches 5 · Ship and keeps being built during review (SME, 5 Nov 2026).
 * From the SME / coordinator's answers (docs/JOURNEY-BRIEF.md, docs/JOURNEY-FOLLOW-UP.md); mirrors the Slack "Journey tracker".
 * Stages can be renamed, paused, skipped and added in Admin → Work types → Stages (src/lib/stages.ts).
 */

const CREATOR = ['ASSIGNEE'] as const;
const REVIEWER = ['OWNER'] as const;
const COORDINATOR = ['assign'] as const;
const DEVELOPER = ['DEVELOPER', 'assign'] as const;

const statuses: StatusDef[] = [
  // Creation (the SME creator, with Claude). Two working days from picked up to submitted.
  { key: 'allocated', label: 'Allocated', color: '#90a4ae', category: 'queue', marks: ['assigned'], phase: 'creation', next: { label: 'Start', by: [...CREATOR], stamp: ['pickedUpAt'], set: { creationStage: CREATION_STAGES[0] } } },
  { key: 'creating', label: 'In creation', color: '#fb8c00', category: 'active', marks: ['started'], phase: 'creation', next: { label: 'Submit for review', by: [...CREATOR], stamp: ['submittedAt'] } },
  // Review (the journey's SME reviewer). Review date = the day the review is done (feedback sent or review closed).
  { key: 'ready_for_review', label: 'Ready for review', color: '#7e57c2', category: 'review', marks: ['submitted'], stuckHours: 4.5, next: { label: 'Start review', by: [...REVIEWER] } },
  { key: 'review_in_progress', label: 'In progress', color: '#5c6bc0', category: 'review', marks: ['review'], stuckHours: 4.5, locked: true, next: { label: 'Close review', by: [...REVIEWER], stamp: ['reviewDate'] } },
  { key: 'changes_asked', label: 'Changes asked', color: '#e53935', category: 'feedback', marks: ['feedback'], stuckHours: 4.5, line: 'side' },
  { key: 'correction_verification', label: 'Correction verification', color: '#8e24aa', category: 'review', marks: ['submitted', 'review'], stuckHours: 2.25, line: 'side' },
  { key: 'closed', label: 'Closed', color: '#43a047', category: 'approved', marks: ['approved'], locked: true, next: { label: 'Send to design standardization', by: [...COORDINATOR] } },
  // After-steps (SME's first version, 5 Nov 2026; may change once they begin).
  // A developer is assigned when the review closes and checks the design standardization (developerHandoff).
  { key: 'design_standardization', label: 'Design standardization', color: '#26a69a', category: 'active', marks: ['started'], next: { label: 'Design done', by: [...DEVELOPER] } },
  { key: 'last_look', label: 'Last look after design', color: '#00897b', category: 'review', stuckHours: 4.5, next: { label: 'Last look done', by: [...CREATOR] } },
  { key: 'video_replacement', label: 'Video replacement', color: '#00796b', category: 'active', skipWhen: { field: 'needsVideoReplacement', equals: 'No' }, next: { label: 'Videos replaced', by: [...COORDINATOR] } },
  // Engineering migrates; the coordinator moves it on.
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
  pages: { groups: 'Chapters', items: 'Journeys', teams: 'Teams' },
  teams: true,
  itemNoun: 'journey',
  labels: { assignee: 'SME creator', owner: 'SME reviewer', group: 'Chapter', due: 'Closure due', peer: 'Peer reviewer', accountable: 'Steward' },
  categoryLabels: { queue: 'Not started', active: 'Being worked', review: 'In review', feedback: 'Changes asked', approved: 'Review closed', done: 'Done', hold: 'Paused' },
  importRoles: { assignee: 'sme-creator', owner: 'sme-reviewer' },
  developerHandoff: { after: 'closed', role: 'developer', label: 'Developer' },

  roles: [
    { key: 'sme-creator', name: 'SME creator', description: 'Builds journeys with Claude: sets the Creation stage (Spine, Script, Build, Ship, Published), submits them (the submitted date is stamped), makes the corrections, does the last look after design (and sends it back to the developer with feedback until it is right). Pick-up dates are set by the coordinator.', color: '#ef6c00', capabilities: ['work'], dataScope: 'ALL', canEdit: true, pages: ['dashboard', 'items', 'reports'] },
    { key: 'sme-reviewer', name: 'SME reviewer', description: 'Reviews the journeys where they are the reviewer: starts the review, asks for changes, verifies corrections, closes the review.', color: '#7e57c2', capabilities: ['review'], dataScope: 'ALL', canEdit: true, pages: ['dashboard', 'items', 'reports'] },
    { key: 'coordinator', name: 'Steward', description: 'Coordinator of a team and chapters:  adds chapters and journeys, allocates creators, reviewers and peer reviewers, sets pick-up dates, edits details, moves journeys through the after-steps and sends them back from QA for a fix. Acts in their own chapters and on every journey of their team.', color: '#00897b', capabilities: ['assign', 'create', 'manageFields'], dataScope: 'ALL', canEdit: true, pages: ['dashboard', 'items', 'reports', 'export'] },
    { key: 'developer', name: 'Developer', description: 'Checks and fixes design standardization once a journey’s review is closed: the journey is assigned to them automatically (least busy developer first). Marks Design done, which sends it to the creator’s last look. If the creator sends it back with feedback, they fix it and mark Design done again.', color: '#26a69a', capabilities: [], dataScope: 'ALL', canEdit: true, pages: ['dashboard', 'items', 'reports'] },
    { key: 'program-manager', name: 'Program manager', description: 'Watches the dashboards and reports; cannot change journeys.', color: '#546e7a', capabilities: [], dataScope: 'ALL', canEdit: false, pages: ['dashboard', 'items', 'reports', 'export'] },
  ],
  statuses,
  initialStatus: 'allocated',
  assignedStatus: 'allocated',

  transitions: [
    { from: 'review_in_progress', to: 'changes_asked', by: [...REVIEWER], label: 'Ask for changes', requires: 'feedback', stamp: ['reviewDate'] },
    { from: 'changes_asked', to: 'correction_verification', by: [...CREATOR], label: 'Corrections done' },
    { from: 'correction_verification', to: 'changes_asked', by: [...REVIEWER], label: 'Ask for changes again', requires: 'feedback' },
    { from: 'correction_verification', to: '@next:review_in_progress', by: [...REVIEWER], label: 'Close review', stamp: ['reviewDate'] },
    { from: 'last_look', to: 'design_standardization', by: [...CREATOR], label: 'Send back to design', requires: 'feedback' },
    { from: 'user_testing_qa', to: 'changes_asked', by: [...COORDINATOR], label: 'Send back for a fix', requires: 'feedback' },
  ],

  fieldMoves: [{ field: 'creationStage', from: 'allocated', to: 'creating' }],
  headerFields: ['creationStage'],
  keyExample: 'G04C05ST1J1',
  groupFromKey: key => parseJourneyKey(key)?.chapter ?? null,

  fields: [
    { key: 'creationStage', label: 'Creation stage', type: 'select', options: CREATION_STAGES, source: 'data', editableBy: ['ASSIGNEE', 'manageFields'] },
    // Pick-up is the coordinator's to set (Start stamps it when it is still empty). Submitted is stamped by "Submit for review"; only an admin corrects it.
    { key: 'pickedUpAt', label: 'Picked up', type: 'date', source: 'data', editableBy: ['manageFields'] },
    { key: 'pickedUpHalf', label: 'Picked up in', type: 'select', options: HALF_DAYS, halfOf: 'pickedUpAt', source: 'data', editableBy: ['manageFields'] },
    { key: 'submittedAt', label: 'Submitted for review', type: 'date', source: 'data', editableBy: [] },
    { key: 'submittedHalf', label: 'Submitted in', type: 'select', options: HALF_DAYS, halfOf: 'submittedAt', source: 'data', editableBy: [] },
    { key: 'daysTaken', label: 'Days taken', type: 'number', source: 'data', editableBy: [], computed: true },
    { key: 'reviewDate', label: 'Review date', type: 'date', source: 'data', editableBy: ['OWNER', 'manageFields'] },
    { key: 'dueAt', label: 'Closure due', type: 'date', source: 'core', editableBy: [], computed: true },
    { key: 'needsVideoReplacement', label: 'Needs video replacement', type: 'select', options: ['Yes', 'No'], source: 'data', editableBy: ['manageFields'] },
    { key: 'subtopic', label: 'Subtopic', type: 'text', source: 'data', editableBy: [], computed: true },
    { key: 'cmsUrl', label: 'UAT CMS journey', type: 'url', source: 'data', editableBy: ['ASSIGNEE', 'OWNER', 'manageFields'], linkLabel: 'Open CMS' },
    { key: 'aiTutorUrl', label: 'AI Tutor', type: 'url', source: 'data', editableBy: ['ASSIGNEE', 'OWNER', 'manageFields'], linkLabel: 'Open AI Tutor' },
  ],

  dataSchema: z
    .object({
      creationStage: z.enum(CREATION_STAGES).optional(),
      pickedUpAt: z.string().optional(),
      pickedUpHalf: z.enum(HALF_DAYS).optional(),
      submittedAt: z.string().optional(),
      submittedHalf: z.enum(HALF_DAYS).optional(),
      daysTaken: z.number().optional(),
      reviewDate: z.string().optional(),
      needsVideoReplacement: z.enum(['Yes', 'No']).optional(),
      subtopic: z.string().optional(),
      cmsUrl: z.string().optional(),
      aiTutorUrl: z.string().optional(),
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
      { field: 'peerReviewer', label: 'Peer reviewer' },
      { field: 'teamOwner', label: 'Steward' },
      { field: 'developer', label: 'Developer' },
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
    const submitted = part !== 'not_started' && part !== 'creating';
    const reviewClosed = part === 'closed' || part === 'after' || part === 'done';
    return {
      creationStage: typeof item.data.creationStage === 'string' ? item.data.creationStage : 'Not started',
      reviewState: reviewClosed ? 'Closed' : submitted ? label : '',
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
    const days = daysTaken(data.pickedUpAt, data.submittedAt, { pickedUp: data.pickedUpHalf, submitted: data.submittedHalf }, cal);
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
