# STATE — branch: start-here
<!-- Overwritten on every handoff. Under 80 lines. Describes NOW. -->

Updated: 2026-11-16T07:30:00Z · by: claude-code · owner: Jeevan

## Goal
Journey: relay-fed creation progress, a Relay board for creators/stewards/admin, feedback as tickets with chat. Then roll out to Render (`development`).

## Done this stretch
- **PR #19 merged into `development`** (merge commit 5c889a1): RELAY pull sync, Relay board, feedback tickets, confirm dialogs. `start-here` is fast-forwarded to it.
- **Relay board** tab (Journey): creators x creation stage, chips with days in stage (tone fresh ≤2 / amber / old ≥5), `r`/`c` marks from the relay publish status, not-started grouped by grade. `src/lib/relay-board.ts` (+test), `src/server/services/relay-board.ts`, `.../(tabs)/board/page.tsx`. Gated on the `reports` page; scope via `scopeWhere`. Flag `relayBoard` on the module, tab hidden without reports.
- **Feedback tickets**: `Feedback` gained `ticketNo` (TICK-00012), `title`, `toId`, `closedById`; `FeedbackMessage` is the chat. Anyone working on the item raises and chats; only the author (or admin) closes/reopens; closed tickets block replies. Page `/w/<type>/<item>/feedback`, item page shows a summary. Inbox: new ticket (`item.feedback`), `feedback.reply`, `feedback.closed`, `feedback.reopened`, sent to the other side only. `src/lib/feedback.ts` (+test), `src/components/feedback-tickets.tsx`, service fns `addFeedback` / `replyFeedback` / `resolveFeedback` in `work-items.ts`. Migration `20261116090000_feedback_tickets`.
- **Confirm dialogs**: `src/components/confirm.tsx` (`ConfirmDialog`, `useConfirm`) replaces every inline "Delete?" row and `window.confirm`.
- **Relay token works** (read-only service token in `.env`, local only). Dry run then apply on the LOCAL db: 69 allocated, 8 stage changes, 105 events, 0 errors.
- `npm run typecheck` clean, `npm test` 215 passing. Signed-in pages (board, feedback page, dialogs) NOT yet viewed in a browser (agents cannot sign in).
- Tried and removed: a general "Your turn" notification (too noisy); inbox stays assignment + feedback + existing review/overdue messages.

## In progress
Nothing mid-edit. Code is not broken.

## Next steps
1. Jeevan: restart the local app (`start.command`), sign in in the Browser pane, then check Relay board, feedback page (raise, reply, close as raiser, reopen), dialogs; light + dark, 375px + desktop.
2. Render: confirm it deployed `development` (migration `20261116090000_feedback_tickets` ran). Add `RELAY_URL`, `RELAY_CF_CLIENT_ID`, `RELAY_CF_CLIENT_SECRET` to the web service, then Admin → Sheet sync → Journey relay: Dry run, review, Sync RELAY now.
3. Render/staging DB catch-up (scripts with `--apply`): `npm run apk:versions -- --apply --close-old`, `npm run journey:developers -- --people "Jeevan,Swathi" --apply`, `npm run notifications:fix-links -- --apply`; change Krishna's email in Admin → People.
4. Decide the relay report items: 5 journeys whose relay holder differs from the tracker creator (G05C02ST5J1/J2, G06C07ST1J1/J2/J3), 3 Published here but at 5 on the relay (G04C05ST2J1, ST3J1, ST5J1), 5 not on the relay (G05C02ST1J1, ST2J1, ST3J1, ST6J1, ST6J2); whether the relay publish status should ever drive a dashboard status.
5. Later: redesign more screens one flow at a time (only confirmations done); media/screenshot attachments on tickets; more workflow stages; round counter in the design loop; count developer-held journeys in load; promote development → staging → main by merge-commit PRs.

## Blockers / open questions
- Journey: 5 Team Devjyoti journeys still have Arjun as SME reviewer; peer reviewer meaning; QA fix routing.
- Railway/Render account details for staging/production.

## Key files
- `src/lib/relay-board.ts`, `src/server/services/relay-board.ts`, `src/app/(app)/w/[workType]/(tabs)/board/page.tsx`
- `src/lib/feedback.ts`, `src/components/feedback-tickets.tsx`, `src/app/(app)/w/[workType]/[itemId]/feedback/page.tsx`, `src/server/services/work-items.ts` (feedback section)
- `src/components/confirm.tsx`, `src/server/services/relay-sync.ts`, `src/modules/journey-applet/definition.ts`
