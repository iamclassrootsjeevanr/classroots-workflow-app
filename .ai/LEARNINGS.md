# LEARNINGS
<!-- Curated. Gotchas, workarounds, "how it actually works here". Edit and merge; keep under ~100 lines. -->

- Tailwind v4: any class that is `@apply`'d elsewhere must be defined with `@utility`, not inside `@layer components`, or `next build` fails with "Cannot apply unknown utility class".
- Colour tokens that change per theme must go through `@theme inline` (resolves where used); plain `@theme` resolves at `:root` only, so dark mode would not apply.
- Cookies set from a server action are URL-encoded; keep cookie values free of `=`/`&` (the prefs cookie uses `.` separators) and `decodeURIComponent` defensively when parsing.
- Embedded Postgres must be running (`npm run db:start`) before `prisma migrate deploy`, otherwise P1001.
- Demo sign-in for local checks: accounts from `scripts/demo-users.ts`, password `DEMO_PASSWORD` in `.env` (git-ignored).
