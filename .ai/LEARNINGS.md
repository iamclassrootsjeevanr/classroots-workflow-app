# LEARNINGS
<!-- Curated. Gotchas, workarounds, "how it actually works here". Edit and merge; keep under ~100 lines. -->

- Tailwind v4: any class that is `@apply`'d elsewhere must be defined with `@utility`, not inside `@layer components`, or `next build` fails with "Cannot apply unknown utility class".
- Colour tokens that change per theme must go through `@theme inline` (resolves where used); plain `@theme` resolves at `:root` only, so dark mode would not apply.
- Cookies set from a server action are URL-encoded; keep cookie values free of `=`/`&` (the prefs cookie uses `.` separators) and `decodeURIComponent` defensively when parsing.
- Embedded Postgres must be running (`npm run db:start`) before `prisma migrate deploy`, otherwise P1001.
- Demo sign-in for local checks: accounts from `scripts/demo-users.ts`, password `DEMO_PASSWORD` in `.env` (git-ignored).
- Never run two `next dev` servers on the same checkout: they share `.next/` and corrupt it ("Cannot find module './vendor-chunks/…'"). Check `lsof -iTCP:3000` first; if it's corrupted, stop all servers and `rm -rf .next`. `AUTH_URL` is pinned to port 3000, so sign-in only works there.
- Wide tables: `w-full` tables never overflow (browser squeezes columns), so nothing scrolls. Use the `.sheet` grid (`width:max-content; min-width:100%`) inside `<Sheet>`; style scrollbars with `::-webkit-scrollbar` because macOS overlay scrollbars are invisible until you scroll.
- Overlays: a `position: fixed` dialog inside a sticky/positioned table cell is trapped in that cell's stacking layer and paints under sticky headers. Render dialogs with `createPortal(..., document.body)`. `.sheet-wrap` uses `isolation: isolate` so table z-indexes stay below the phone top bar (z-30), drawer (z-40) and dialogs (z-50). Avoid `data-tip` tooltips inside tables or scrolling dialogs (they open sideways and get clipped); use `title`.
- Don't run `npx prettier` on files here: there is no project config, so it reformats the whole file with default quotes.

- Speed: don't pass per-row field values or option lists for hundreds of rows into client components (Items page was 7 MB / 6 s). Page lists (`pageOf`, `capPerType`) and load edit fields on demand (`loadEditFieldsAction`). `next dev` also inflates the RSC payload; judge speed on a production build.
- After a schema change (`prisma generate`) the running `next dev` keeps the old Prisma client ("Cannot read properties of undefined"); restart the dev server.
- Adding a role to a module definition is enough: Admin → Roles (or the user form) creates it. A flow capability with no role granting it fails `tests/roles.test.ts`.
- Sheet sync: the Apps Script (apps-script/Code.gs) locates a tab by name across the owner's Google Sheets, so work types need no Spreadsheet ID. It must be redeployed (new version) after edits.
- Sheet push order matters for linked trackers: `sheet.linked` tabs (Lists → Test Cases → APK Releases) are ensured before Test Execution rows (Code.gs ensureValues / ensureRows, located via the main tab so same-named tabs elsewhere are ignored).
- Sheet gotcha: Lists!D (APK Versions) is a FILTER formula over APK Releases; typing into it collapses the spill (#REF!). Code.gs ensureValues skips formula columns. Version Summary is a fixed table (row per release + Total); ensureSummary copies the last row and widens the Total ranges.
- `next start` warns with `output: standalone`; production check = `npm run build` then `npm start` (stop dev first, `rm -rf .next` before going back to dev). Prisma interactive transactions time out after 5 s: long ones (creating a version) pass `{ timeout }`.
