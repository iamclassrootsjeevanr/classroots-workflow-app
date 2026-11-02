# DECISIONS
Append-only. One entry per lasting decision, newest at bottom. Supersede, don't delete. Format:

    ## YYYY-MM-DD — Title
    Decision: what was chosen.
    Why: the reason, including what was rejected.
    By: claude-code | codex | cursor

## 2026-10-30 — Semantic colour tokens instead of raw Tailwind palette classes
Decision: all UI colour comes from CSS variables on `:root` / `[data-theme='dark']` mapped via `@theme inline` (`bg-surface`, `text-muted`, `bg-ok-soft`, …). Raw classes like `bg-white`, `text-emerald-700` are banned in `src/`.
Why: one place to tune light and dark; module status hex colours still work through `.status-chip` with `color-mix`. Rejected: duplicating every class with `dark:` variants.
By: claude-code

## 2026-10-30 — User preferences stored in `User.prefs` JSON plus a mirror cookie
Decision: theme / text size / density live in `User.prefs` (authoritative) and are mirrored to cookie `cr_prefs` (`theme.fontSize.density`) so the sign-in page and first paint are right before any DB read; sidebar state is cookie-only (`cr_nav`).
Why: prefs must follow the person across devices, but the root layout must render the correct `<html data-theme>` without a flash. Rejected: localStorage only (flash, not cross-device) and a separate Prefs table (overkill for three fields).
By: claude-code

## 2026-11-02 — "Delete" on an item archives it
Decision: deleting a row sets `WorkItem.archivedAt` (hidden from lists, reports, item page) and logs a FIELD_CHANGED event; nothing is hard-deleted. Allowed for admins and roles with "Edit item details" (`manageFields`).
Why: history, analytics and the Google Sheet sync key off the item; a hard delete would let the next sync re-create the row and lose the audit trail. Sheet rows are never deleted by the app.
By: claude-code

## 2026-11-02 — Testers can add APK versions; a version is a group of tests copied from an earlier one
Decision: the Tester role gets "Add new items" (migration `20261102120000_tester_can_add_versions` plus the seed). A new APK version creates one WorkItem per test case (key `<version> | <case id>`, groupKey = version, version link/date/notes in `data`), copying case definitions only. The time log is derived from existing events and stage intervals; no manual time entries.
Why: testers had to ask for an import to start a build. Reusing items keeps reports, sheet sync and permissions unchanged. Rejected: a separate Version table (duplicates grouping that already exists).
By: claude-code
