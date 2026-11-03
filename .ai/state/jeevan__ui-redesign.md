Updated: 2026-11-02T10:07:56Z · by: claude-code · owner: Jeevan# STATE — branch: jeevan/ui-redesign
<!-- Overwritten on every handoff. Under 80 lines. Describes NOW. -->

Updated: 2026-11-02T08:02:01Z · by: claude-code · owner: Jeevan

## Goal
Modern UI/UX pass on the Classroots Work dashboard: collapsible desktop sidebar, row-style tick controls,
per-user appearance settings (theme / text size / density), real icons, token-based light + dark palette.

## Done this stretch
- Design tokens + dark palette in `src/app/globals.css` (`@theme inline` colours, `[data-theme='dark']`,
  `[data-font]`, `[data-density]`, `.status-chip`, `.note*`, `.btn-icon`, `[data-tip]` tooltip).
- Per-user preferences: `User.prefs Json` (migration `20261030120000_user_prefs`, applied), `src/lib/prefs.ts`,
  cookie `cr_prefs` (`theme.fontSize.density`), inline no-flash `THEME_SCRIPT`, `ThemeWatcher`, `PrefsSync`,
  `savePrefsAction`, Appearance card on /account (`src/components/prefs-form.tsx`).
- Collapsible sidebar `src/components/sidebar.tsx` (cookie `cr_nav`, `[` shortcut), animated mobile drawer,
  lucide-react icons via `src/components/icons.tsx`.
- Form primitives `src/components/form.tsx` (Checkbox/Radio/Switch rows, Segmented); Roles editor,
  user access form and Sync settings rewritten on them.
- README: new "Working with AI coding tools" section (ai-continuity-kit usage, `.ai/` files), TOC + structure updated,
  Contributing branch naming aligned to `<name>/<topic>`. AGENTS.md Project section filled (stack, commands, layout, conventions).
- Item page "Details & links": `FieldsForm` rewritten as per-field rows (`FieldRow` in `src/components/controls.tsx`) with
  Edit (inline input/textarea, Enter saves, Esc cancels) and Delete (inline confirm, sets value to null) per row; each row
  calls `updateFieldsAction` on its own. New `LinkButton` (btn-ghost, `target=_blank`) used for url fields and the Links
  column / card links in `items-table.tsx`. Verified in browser (dark, 1440 and 375) on an APK test item; 56 tests pass.

- Roles editor redesigned (`src/components/role-editor.tsx`): "Can make changes? Yes / View only" segmented control,
  plain-language capability labels (`CAPABILITY_LABELS` in access-core), items-seen radios, pages; live right-hand panel
  "What this means in the flow" per work type from `src/lib/role-preview.ts` (`flowLite`, `rolePreview`; `actorMatches`
  now exported from workflow.ts). `tests/role-preview.test.ts` (5 tests, 61 total).
- Item lists: pencil "Edit" column (table) / button (cards) opens a dialog with the same field rows (`EditItemButton`);
  `editableFieldsFor` in `src/server/view.ts`; wired on /w/[workType] and all three /my tables.
- Grid restyled modern (no gridlines/row numbers; hairline rows, pinned first + Actions columns). Row Delete added:
  `deleteItem` (archives: sets `archivedAt`, FIELD_CHANGED event note "Deleted", drops pending outbox) in work-items.ts,
  `deleteItemAction`, `canDeleteItem` in lib/workflow.ts (admin or manageFields), `deletableItemsFor` in view.ts,
  `DeleteItemButton` in controls.tsx (inline confirm), also on the item page; archived item pages 404. 63 tests.
- APK version summary: `GroupSummaryCard` now shows a full-width `GroupTrendChart` (stacked result columns per build in
  release order + pass-rate line on 0-100% axis + Good 80% / Stable 90% reference lines) above the By-version table.
  New `groupTrend` / `shortLabels` in lib/groups.ts, `successSeries` / `rateLines` on `GroupSummary` (APK module sets them).
  Applies everywhere the card is used (work list, overview, my dashboard, reports). 65 tests.
- Overlap fixes: edit dialog now portaled to body (was trapped under sticky table header), `.sheet-wrap` isolated,
  row tooltips switched to `title`, phone card selects `min-w-0` (status no longer under assignee), item-page Delete moved
  after the controls. Swept all main pages at 375px: no page-level overflow.
- Data tables spreadsheet behaviour: `src/components/sheet.tsx` (`<Sheet>`: visible scrollbars, right fade, pinned-column
  shadow, click + arrow-key cell nav, Ctrl/Cmd+C copy) and `.sheet*` CSS; applied to items-table, group-summary, reports.
  Root cause of "can't scroll": tables were `w-full` so columns squeezed instead of overflowing, and macOS hid scrollbars.
  Not converted: admin users, sync, admin overview tables (wrapping content), stage timeline.
- APK Testing for testers/developers: "New APK version" dialog (link, date, notes, copy cases from an earlier version, extras) and
  "Add test case" (`src/components/new-apk-version.tsx`, `src/lib/apk-versions.ts`, `src/server/services/apk-versions.ts`, actions
  `createApkVersionAction` / `updateApkVersionAction`); Tester role now has capCreate (migration 20261102120000, applied locally).
  Edit-version pencil + APK link in the By-version table. APK list drops Owner/Expected/Delay (`mod.table`), adds Priority, Bug,
  Developer remarks, Last update. Item page: Tester bug card, Developer remarks card, Time log (`src/lib/time-log.ts`,
  `src/components/time-log.tsx`, `mod.timeLog`). 75 tests. Verified in browser (admin, 1440 + 375, dark). Not done: prompt for bug
  text when marking Fail (bug is edited in its card), light theme check, testing as a real Tester login.
- Dashboard (/my) lists with several work types now render one table per work type (`ItemsTables` in items-table.tsx), each with its own
  columns/labels (APK: no SME/Expected/Delay).
- Work type pages split into tabs (Overview, APK versions, Test execution, Test cases; Journey: Overview + Items) under `w/[workType]/(tabs)/`,
  `src/server/work-type-page.ts`, `PathTabs`, `src/lib/test-cases.ts`, `CasesTable`. /my renders all analytics before item tables. 79 tests.
- Overview/dashboards: clickable analytics (`itemsUrl`), order cards > graphs > tables > items, own-data 'You vs team', sidebar icons + dropdown pages.
- Speed + undo: Items page paged (50), /my capped per type, Edit dialog loads fields on open, optimistic status/assign selects (Items page 7 MB/6 s -> 1.4 MB/1.2 s in dev).
  Delete is undoable for 30 min (toast + Recently deleted card, `restoreItem`). 89 tests.
- Inbox: Notification model (migration 20261102180000), `notify()`, sidebar Inbox popover + /inbox page, delete toast 5 s then Undo in Inbox for 30 min,
  assignment/feedback notices; account is one box (name + My account). 92 tests.
- Sheet push order: Lists (not the formula column), Test Cases, APK Releases, Version Summary row, then Test Execution (`sheet.linked`, `linkedPayloads`, Code.gs ensureValues/ensureRows, cells keep dropdown but allow new values). 101 tests.
- BRANCH jeevan/apk-database: APK relational tables (ApkVersion/ApkTestCase/ApkTest, migrations 20261103090000 + 20261103091000), `src/server/apk/store.ts`,
  `src/lib/apk-data.ts`, DB-side items filter/paging, lite loaders, /api/health, railway.json, README Railway + data model. App Developer can add versions/cases. 105 tests.

## In progress
Nothing mid-edit. Code is not broken.

## Next steps
1. PR #3 (jeevan/ui-redesign → main) carries field-row edit/delete, list-row edit dialog and the roles redesign; review and merge it.

## Blockers / open questions
- None.

## Key files
