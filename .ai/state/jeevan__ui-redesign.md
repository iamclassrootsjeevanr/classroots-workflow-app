# STATE — branch: jeevan/ui-redesign
<!-- Overwritten on every handoff. Under 80 lines. Describes NOW. -->

Updated: 2026-10-30T13:12:20Z · by: claude-code · owner: Jeevan

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
- Design sweep: ui.tsx, items-table, charts (CSS-var colours), heatmap, filter-bar, sign-in, admin pages.
- Tests: `tests/prefs.test.ts` (56 total passing); typecheck and `next build` clean. README section added.
- All of the above is committed (ce8ab8e on main); this branch starts from main with no code diff.

## In progress
Nothing mid-edit. Code is not broken.

## Next steps
1. Open a PR from `jeevan/ui-redesign` only if further UI changes land here; otherwise the work is already on main.
2. Optional polish: verify charts in dark mode on /reports with real data (screenshot caught them pre-measure once).
3. Optional: add a "Reset to defaults" button to the Appearance card (`prefs-form.tsx`).

## Blockers / open questions
- None.

## Key files
- `src/app/globals.css` — all colour/size/density tokens; add new colours here, never raw Tailwind palette classes.
- `src/lib/prefs.ts`, `src/app/layout.tsx` — preference model and first-paint theme attributes.
- `src/components/sidebar.tsx`, `src/app/(app)/layout.tsx` — shell and nav groups.
- `src/components/form.tsx`, `src/components/ui.tsx` — shared primitives.
- `README.md` § "Appearance: theme, text size, density, sidebar".
