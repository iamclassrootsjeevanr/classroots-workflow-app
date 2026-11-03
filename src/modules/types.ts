import type { z } from 'zod';
import type { Capability, DataScope, PageKey } from '@/lib/access-core';
import type { NavIcon } from '@/components/icons';

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
  /** Where the value lives: a WorkItem column, the item's `data` JSON, or (APK Testing) the shared version / test case tables. */
  source: 'core' | 'data' | 'version' | 'case';
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

/**
 * Other tabs of the same spreadsheet that the main tab depends on (dropdown lists, reference tables). Before rows are pushed to the
 * main tab, these are brought up to date in the order listed, so a new version or test case exists everywhere it is referenced.
 */
export type LinkedTab =
  /** A column of allowed values (e.g. the "Lists" tab): values from the items are appended when missing. */
  | { tab: string; kind: 'values'; column: string; from: 'group' | 'assignee' }
  /** A reference table keyed by one column: a row per distinct key. `fill` only fills empty cells, `update` keeps cells in step with the app. */
  | LinkedSummary
  | { tab: string; kind: 'rows'; key: LinkedSource; mode: 'fill' | 'update'; keyHeader: string; columns: { header: string; from: LinkedSource }[] };

/** (continued) A summary table with one formula row per entry of another tab, above a Total row: new keys get a copy of the last row. */
export type LinkedSummary = { tab: string; kind: 'summary'; keyHeader: string; totalLabel: string; from: 'group' };

export type LinkedSource = 'group' | 'title' | 'assignee' | { field: string };

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
  /** Links for this group (e.g. the APK file), shown as buttons in the group table. */
  links?: { label: string; url: string }[];
};

/** A per-group rollup shown above item lists and in reports, e.g. "per APK version" with pass %. */
export type GroupSummary = {
  label: string;
  columns: TableColumn[];
  compute: (items: GroupSummaryItem[]) => GroupSummaryRow;
  seriesColors?: Record<string, string>;
  /** Series that counts as success; drives the trend line (share of items) in the group chart. */
  /** Status keys each series stands for, so clicking a chart segment can filter the item list. */
  seriesStatuses?: Record<string, string[]>;
  successSeries?: string;
  /** Threshold lines on the trend chart, in percent (e.g. the tracker's Good / Stable cut-offs). */
  rateLines?: { label: string; at: number }[];
};

/** A role this work type's flow needs. Roles are created from these when the work type is enabled or its flow changes. */
export type RoleTemplate = {
  key: string;
  name: string;
  description: string;
  color: string;
  capabilities: Capability[];
  dataScope: DataScope;
  canEdit: boolean;
  pages: PageKey[];
};

export type WorkTypeDefinition = {
  key: string;
  name: string;
  description: string;
  /** Work types whose shared facts live in their own tables instead of every row's data (see src/server/apk/store.ts). */
  storage?: 'apk';
  /** Sidebar icon key (see NAV_ICONS). Default: a checklist. */
  icon?: NavIcon;
  /** Singular noun for one item, e.g. "journey". */
  itemNoun: string;
  /** Column / field names shown in the UI for this work type. */
  labels?: { assignee?: string; owner?: string; group?: string };
  /** What each status category is called in this work type's KPI tiles (defaults are journey words). */
  categoryLabels?: Partial<Record<StatusCategory, string>>;
  /** Role keys given to people created from the sheet / import (assignee column, owner column). */
  importRoles?: { assignee: string; owner?: string };
  /** Roles of this work type. Omit to derive them from the flow (who moves statuses, who edits fields). */
  roles?: RoleTemplate[];
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
  /** Item list columns: hide default ones, add data fields. */
  table?: { hide?: ('owner' | 'expected' | 'delay')[]; extra?: { field: string; label: string }[] };
  /** Tab names for this work type's pages (defaults: Overview, Items; a groups tab shows when there is a groupSummary). */
  pages?: { groups?: string; items?: string; cases?: string };
  /** Groups can be added in the app (an APK version = a group of tests copied from an earlier one). */
  versions?: boolean;
  /** Item pages show a time log (status changes, bug and remark edits, time per status). */
  timeLog?: boolean;
  sheet?: {
    defaultTab: string;
    /** Several 'key' columns make a composite key, joined with " | ". */
    columns: SheetColumn[];
    /** Optional column the sync job stamps with the last app write time. */
    updatedAtColumn?: string;
    /** Tabs to update first, in order (see LinkedTab). */
    linked?: LinkedTab[];
  };
  /** Hours an item may sit in a category before it is flagged as stuck (business hours). */
  stuckAfterHours?: Partial<Record<StatusCategory, number>>;
};
