# One chapter, start to finish (RELAY + Dashboard)

A simple walkthrough for anyone new. It follows one example chapter, **G04C05** (Grade 4, Chapter 5), and one journey in it, **G04C05ST1J1** (Grade 4, Chapter 5, Subtopic 1, Journey 1). People are named by role, never by name.

## The two systems in one minute

| | **RELAY** | **Dashboard** |
|---|---|---|
| What it is | Where journeys are **created** with Claude | Where journeys are **tracked, reviewed and finished** |
| Used by | SME creators, Stewards | Everyone: creators, reviewers, developers, Stewards |
| Holds | Who has which journey, the creator's progress, approvals | Review, feedback, design check, QA, all later steps |

**Information flows one way: RELAY → Dashboard.** The Dashboard never changes RELAY.

## The people (roles)

- **Allocator**: a few senior people who hand out chapters and journeys on RELAY.
- **Steward**: owns a chapter and a team. Adds journeys, picks reviewers, moves the after-review steps.
- **SME creator**: builds the journey with Claude.
- **SME reviewer**: reviews the journey.
- **Peer reviewer**: the creator's review buddy.
- **Developer**: checks and fixes the design after the review.

## The whole journey at a glance

```text
RELAY                              DASHBOARD
-----                              ---------
1. Chapter given to a Steward
2. Journeys given to creators ───► Allocated
3. Creator builds with Claude:
   3a Spine ─────────────────────► Creating  (stage 3a · Spine)
   3b Script ────────────────────►           (3b · Script)
   4  Build  ────────────────────►           (4 · Build)
   5  Ship   ────────────────────►           (5 · Ship)
                                   4. Creator presses Submit ─► Ready for review
                                   5. Review loop (below)
                                   6. Review Closed
                                   7. Developer checks and fixes design
                                   8. Creator does the last look (loop with Developer)
                                   9. Video replacement (only if needed)
                                  10. Move to prod, Published on prod
                                  11. User testing and QA
                                  12. Done
```

## Step by step

### Part 1: Setting up the chapter (RELAY)

1. An **Allocator** gives chapter G04C05 to a **Steward** on RELAY.
2. The chapter is planned into subtopics and journeys (G04C05ST1J1, ST1J2, and so on).
3. The Allocator or Steward gives each journey to an **SME creator**.
4. Within a few minutes the Dashboard copies this: G04C05ST1J1 appears with status **Allocated** and its creator.

### Part 2: Creating the journey (RELAY → Dashboard)

The **SME creator** works with Claude. RELAY records each step, and the Dashboard copies the stage:

| What the creator finishes | Dashboard shows |
|---|---|
| The outline of the story is approved | Creation stage **3a · Spine**, status **Creating** |
| The script is written | **3b · Script** |
| The journey is built | **4 · Build** |
| It is ready to send | **5 · Ship** |

The creator does not have to type anything into the Dashboard for this.

### Part 3: Review (Dashboard only)

1. The **SME creator presses Submit for review.** Reaching "5 · Ship" does not do this automatically.
2. The **SME reviewer** starts the review.
3. The reviewer writes **feedback** and presses **Ask for changes**.
4. The creator fixes the points and presses **Corrections done**.
5. The reviewer checks the fixes. Either they ask for changes again (go back to step 3), or they press **Close review**.
6. Status is now **Closed**. The review loop can repeat as many times as needed.

### Part 4: Design check (Dashboard only)

1. When the review closes, a **Developer** is assigned automatically (the one with the fewest journeys waiting). The Steward or the creator can change the Developer while the journey is in **Design standardization**.
2. The **Developer checks and fixes the design**, then presses **Design done**.
3. The **SME creator** does the **last look**.
   - If something is wrong, the creator writes feedback and presses **Send back to design**. The Developer fixes it and presses **Design done** again. This repeats until the creator is happy.
   - If it is right, the creator presses **Last look done**.

### Part 5: Going live (Dashboard only)

1. **Video replacement**: only if the journey needs it, otherwise skipped. Moved by the Steward.
2. **UAT → prod migration**: engineering moves it, the Steward marks it.
3. **Published on prod**: the Steward starts user testing.
4. **User testing and QA**: if QA finds a problem, the Steward writes feedback and presses **Send back for a fix**. The journey goes back to **Changes asked** and the creator and reviewer run the review loop again.
5. **Done.**

## Quick answers

- **Where do I update my creation progress?** On RELAY, with Claude. Don't edit it by hand in the Dashboard.
- **Where do I give review feedback?** In the Dashboard, on the journey page (Feedback card).
- **Does the Dashboard change RELAY?** No. RELAY changes the Dashboard, never the other way.
- **How fast does RELAY show up in the Dashboard?** Every few minutes, once the connection is switched on.
- **Why is a journey not in my dashboard?** Check that the creator email on RELAY matches the person in the Dashboard People list.

## Next steps (to switch the live link on)

1. **Ask the Cloudflare admin for a service token** for the Dashboard. It lets the live app read RELAY without anyone's personal login.
2. **Put three settings on the live server:** `RELAY_URL`, `RELAY_CF_CLIENT_ID`, `RELAY_CF_CLIENT_SECRET` (see `.env.example`).
3. **Update the live database** with `npm run db:deploy`.
4. **Do a dry run first:** `npm run relay:sync -- --dry-run`. Read the report (journeys to add, stage changes, people not found).
5. **Fix anything in the report**, for example a creator whose email is not in People.
6. **Apply for real:** `npm run relay:sync`, or press **Sync RELAY now** in Admin → Sheet sync.
7. **Check a few journeys** in the Dashboard (the RELAY card on the journey page lists what RELAY recorded).
8. **Leave it running.** The scheduler pulls RELAY every few minutes from then on.
9. **Later:** add more steps to the workflow (for example a round counter in the design loop).
