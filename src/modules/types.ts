import type { z } from 'zod';
import type { Capability } from '@/lib/access-core';

/** What a status means for analytics and workload, independent of its label. */
export type StatusCategory =
  | 'queue' // waiting to be picked up (received, assigned/YTS)
  | 'active' // being worked on
  | 'review' // waiting for / in review
  | 'feedback' // corrections requested, back with the developer
  | 'approved' // reviewed / accepted
  | 'done'
  | 'hold'; // paused or blocked

/** Stage timestamps a status sets on the item when entered. */
export type StageMark = 'assigned' | 'started' | 'submitted' | 'review' | 'feedback' | 'approved' | 'completed';

export type StatusDef = {
  key: string;
  label: string;
  color: string;
  category: StatusCategory;
  marks?: StageMark[];
  /** Value written to / read from the sheet. null = app-only status (not pushed). */
  sheetValue?: string | null;
};

/**
 * Who may move an item or edit a field: a capability from the person's roles in this work type.
 * 'ASSIGNEE' = has the "work" capability and the item is assigned to them. Admins may do anything.
 */
export type Actor = Capability | 'ASSIGNEE';

export type Transition = { from: string; to: string; by: Actor[]; label?: string };

export type FieldType = 'text' | 'longtext' | 'url' | 'date' | 'number';

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  /** Where the value lives: a WorkItem column or the item's `data` JSON. */
  source: 'core' | 'data';
  editableBy: Actor[];
  /** Short label for link columns in tables (e.g. "Open CMS"). */
  linkLabel?: string;
};

/** How one sheet column maps to the app. */
export type SheetColumn =
  | { column: string; kind: 'key' }
  | { column: string; kind: 'title' }
  | { column: string; kind: 'status' }
  | { column: string; kind: 'assignee' }
  | { column: string; kind: 'owner' }
  | { column: string; kind: 'group' }
  | { column: string; kind: 'dueAt' }
  | { column: string; kind: 'data'; field: string; type: FieldType };

export type TableColumn = {
  key: string;
  label: string;
};

/** One item as seen by a group summary (pure; no DB types). */
export type GroupSummaryItem = { status: string; category: StatusCategory; data: Record<string, unknown>; assigneeId: string | null };

export type GroupSummaryRow = {
  cells: Record<string, string | number>;
  result?: { label: string; tone: 'ok' | 'warn' | 'bad' | 'muted' };
  /** Stacked-bar segments for this group (label → count). */
  series?: Record<string, number>;
};

/** A per-group rollup shown above item lists and in reports, e.g. "per APK version" with pass %. */
export type GroupSummary = {
  label: string;
  columns: TableColumn[];
  compute: (items: GroupSummaryItem[]) => GroupSummaryRow;
  seriesColors?: Record<string, string>;
};

export type WorkTypeDefinition = {
  key: string;
  name: string;
  description: string;
  /** Singular noun for one item, e.g. "journey". */
  itemNoun: string;
  /** Column / field names shown in the UI for this work type. */
  labels?: { assignee?: string; owner?: string; group?: string };
  /** What each status category is called in this work type's KPI tiles (defaults are journey words). */
  categoryLabels?: Partial<Record<StatusCategory, string>>;
  /** Role keys given to people created from the sheet / import (assignee column, owner column). */
  importRoles?: { assignee: string; owner?: string };
  statuses: StatusDef[];
  initialStatus: string;
  /** Status given when an item is first assigned (if it is still in a queue status). */
  assignedStatus: string;
  transitions: Transition[];
  fields: FieldDef[];
  dataSchema: z.ZodTypeAny;
  /** Columns of list tables (core keys: externalKey, title, status, assignee, owner, dueAt, group; or field keys). */
  columns: TableColumn[];
  /** How much one open item weighs in workload (1 = a journey; e.g. 0.05 when 20 small tests ≈ one piece of work). */
  workloadWeight?: number;
  /** Order of items inside a group (e.g. journey number, test-case number). */
  sortOrder?: (data: Record<string, unknown>) => number;
  groupSummary?: GroupSummary;
  sheet?: {
    defaultTab: string;
    /** Several 'key' columns make a composite key, joined with " | ". */
    columns: SheetColumn[];
    /** Optional column the sync job stamps with the last app write time. */
    updatedAtColumn?: string;
  };
  /** Hours an item may sit in a category before it is flagged as stuck (business hours). */
  stuckAfterHours?: Partial<Record<StatusCategory, number>>;
};
