# Classroots Work: User Manual

For everyone who uses the dashboard. Find your role, read that part, and you can start.
Live address: **[add the live URL here]**

---

## 1. Before you start

### Sign in
- **Classroots staff:** press **Sign in with Google** and use your @classrootsedu.com account. No password.
- **Everyone else:** type your email and the password your admin gave you. Tick **Remember me** to stay signed in.
- Forgot the password? Press **Forgot password?** under the form.
- Only people an admin has added can sign in. If you see "No access yet", ask your admin.

### Your screen
- **Left menu**
  - **My dashboard**: your own work, deadlines and recent activity.
  - **Work types** (Journey, APK Testing): each has tabs. Open one to see its pages.
  - **Reports**: charts and totals (only for some roles).
  - **Inbox**: the bell icon at the top shows your latest messages; **View all** (or Inbox in the phone menu) opens the full list. Open a message to jump to the item.
- **Your name**: opens **My account**: your **Profile**, **Appearance** (light, dark or system theme, saved for every device) and **Ways to sign in** (set or change your password).
- On a phone, the menu is behind the menu button at the top.

### Words used in this manual
| Word | Meaning |
|---|---|
| Journey | One learning journey. Its key looks like `G04C05ST1J1` (Grade 4, Chapter 5, Subtopic 1, Journey 1). |
| Creator | The SME creator who builds the journey with Claude. |
| Reviewer | The SME reviewer who checks it. |
| Steward | The coordinator who owns a chapter and a team. |
| Developer | Checks and fixes the design after the review. |
| Status | Where the journey is in the workflow. |
| Creation stage | How far the creator has built it: 3a · Spine, 3b · Script, 4 · Build, 5 · Ship. |
| Ticket | One feedback point with its own chat (see section 4). |

### How to change a status
Open the journey (click its key in a list). Use the **Change status** dropdown at the top. It only shows the moves **you** are allowed to make, each starting with an arrow, for example **→ Submit for review**. Pick one. If you see no arrow options, it is not your turn.

---

## 2. How a journey moves (the big picture)

```
RELAY (creation)                    DASHBOARD
1. Journey given to a creator  ──►  Allocated
2. Creator builds with Claude  ──►  In creation  (3a → 3b → 4 → 5)
                                    3. Creator: Submit for review
                                    4. Reviewer: Start review
                                         ├─ Ask for changes ──► creator fixes ──► Corrections done
                                         │                       reviewer: Close review  or  Ask for changes again
                                         └─ Close review
                                    5. Closed → Design standardization (a developer is assigned)
                                    6. Developer: Design done
                                    7. Creator: Last look  (Last look done, or Send back to design)
                                    8. Video replacement (only if needed)
                                    9. UAT → prod migration → Published on prod
                                   10. User testing and QA  (Mark done, or Send back for a fix)
                                   11. Done
```

- **Creation progress comes from RELAY by itself.** Creators do not type it in the dashboard. It updates every few minutes.
- **Review and everything after it happens in the dashboard.**
- Information flows one way: RELAY → dashboard. The dashboard never changes RELAY.

---

## 3. Guide for each role

### 3.1 SME creator

**Your job:** build journeys with Claude, submit them, fix feedback, do the last look.

**Every day**
1. Open **My dashboard** or the bell **Inbox**. Open a journey assigned to you.
2. Press **Change status → Start** when you begin. (If your pick-up date is empty, it is stamped now.)
3. Build with Claude on RELAY. The **Creation stage** (3a · Spine, 3b · Script, 4 · Build, 5 · Ship) follows RELAY automatically.
4. Add your links in **Details & links**: the CMS Journey link and the AI Tutor link. Use the pencil (Edit) next to a field, then Save.
5. When it is ready, choose **→ Submit for review**. Reaching "5 · Ship" does **not** submit it. You must submit.
6. You will get an Inbox message when the reviewer asks for changes. See **Feedback** (section 4). Fix each point, then choose **→ Corrections done**.
7. When the review is closed and the developer finishes design, you get a message: **do the last look**.
   - It is right: choose **→ Last look done**.
   - Something is wrong: open **Feedback**, raise a ticket that explains it, and press **Send back to design**. The developer fixes it and you look again.

**Useful**
- **Relay board** tab (Journey): shows your journeys by stage and how many days each has waited. Red chips are 5 days or more.
- Your journeys do not count against you once the review is closed.
- You cannot create, delete or re-assign journeys. Ask your Steward.

### 3.2 SME reviewer

**Your job:** review the journeys where you are the reviewer.

1. Open **My dashboard → Waiting for my review**, or a message in your Inbox.
2. At **Ready for review**, choose **→ Start review**.
3. Check the journey. Then either:
   - **It is good:** choose **→ Close review**.
   - **It needs changes:** open **Feedback**, press **New ticket**, write a short title and a clear description, set severity, then press **Ask for changes** (the red button). The creator is told.
4. When the creator presses **Corrections done**, check the fixes. Then **→ Close review**, or **→ Ask for changes again** with a new ticket.
5. Close each ticket yourself once its point is fixed (section 4).

**Tips**
- Write one ticket per problem. It keeps the chat clear.
- Review targets are short: stuck alerts start after half a working day.

### 3.3 Steward (coordinator)

**Your job:** run a chapter and a team: add journeys, give them to creators, pick reviewers, push the after-review steps. You can also build your own journeys: follow the SME creator steps (3.1) for any journey given to you, in any chapter.

Your chapters come from RELAY: the chapter's owner on RELAY is its steward here, updated at each relay sync. To hand a chapter to another steward, press **Change steward** on its row in the **Chapters** tab. Journeys reassigned on RELAY move to the new creator at the next sync, and creators join the team RELAY lists them under. A reassignment you make here after RELAY's stays.

**Set up**
1. **Chapters** tab: add a chapter with **+ New chapter**. You can remove one only when it has no journeys.
2. Add journeys in your chapter and choose the **creator**. If RELAY already allocated them, they appear by themselves.
3. Set the **pick-up date** (and "Picked up in" morning or afternoon) on each journey.
4. **Teams** tab: keep your team, its default SME reviewer and each person's **peer reviewer** (buddy) up to date.
5. Make sure every submitted journey has an **SME reviewer**. You get a message if one has none.

**Moving journeys after the review**
| Status | What you do |
|---|---|
| Closed | Moves to design on its own. If it is stuck, choose **→ Send to design standardization**. |
| Design standardization | Developer works. You or the creator can change the developer in the Developer dropdown. |
| Video replacement | Set **Needs video replacement** to Yes or No early. If Yes, choose **→ Videos replaced** when done. |
| UAT → prod migration | After engineering migrates it, choose **→ Migrated to prod**. |
| Published on prod | Choose **→ Start user testing**. |
| User testing and QA | **→ Mark done**, or raise a ticket and press **Send back for a fix**. The journey returns to Changes asked. |

**Watch**
- **Relay board** tab: every creator in your scope, each stage, days waiting, and `r` (up for review) / `c` (corrections) marks from RELAY.
- **Reports** and **My dashboard** for overdue, stuck and workload.
- Your **Inbox** for stuck and overdue alerts.

### 3.4 Developer

**Your job:** check and fix the design after the review closes.

1. A journey is assigned to you automatically (the developer with the fewest waiting journeys). You get a message.
2. Find it under **My dashboard** (journeys you hold as developer) or the Journeys list. Its status is **Design standardization**.
3. Check and fix the design. When done, choose **→ Design done**. It goes to the creator for the last look.
4. If the creator sends it back, you get a message with a ticket. Read it, fix it, answer in the ticket chat, and choose **→ Design done** again.

### 3.5 Program manager

**Your job:** watch delivery. You can look at everything in your scope but cannot change anything.

- **My dashboard** and **Reports**: status, weekly flow, work per person, delays.
- **Journeys** list: filter by chapter, creator, status. Every tile and chart opens the matching list.
- **Relay board** tab: who holds what, and for how long.
- Export (CSV or Excel) where your role allows it.

### 3.6 Admin

**Your job:** keep the system and people in order.

Open **Admin** (top of the left menu).
- **People & access:** add a person, give a role in each work type, send the invite email, deactivate or remove someone. Check their email matches RELAY so their journeys land on them.
- **Roles:** see and edit what each role can do. **Reset to default** returns a role to the standard.
- **Work types:** pause, archive, or edit the stages of a work type (rename, skip, add).
- **Sheet sync:** connect Google Sheets. The **Journey relay** card has **Dry run** (report only) and **Sync RELAY now**.
- **View as:** pick a person to see the app exactly as they see it. Use it to answer "I cannot see my journey".
- You can act on any journey at any stage, and you can close or reopen any ticket.

**Risky actions** (delete, remove, pause, archive, reset) always ask first in a box in the middle of the screen. Read it, then confirm or Cancel.

---

## 4. Feedback tickets (everyone who works on a journey)

Each problem is a **ticket** with its own chat, like `TICK-00012`.

**Open the page:** on a journey, press **Open feedback** in the Feedback card. Or open the message in your Inbox.

**Raise a ticket**
1. Press **New ticket**.
2. Write a short **Title** and a clear **Description** (where it is, what is wrong, what it should be).
3. Pick the **Severity** (Low, Medium, High) and a category if you want.
4. Press **Raise ticket**. The other person is told.
5. Reviewers (and the creator at last look, and the steward at QA) also see a red button, for example **Ask for changes**. It raises the ticket **and** sends the journey back in one step.

**Chat**
- Open a ticket (click its row). Both sides write messages in the box and press **Send** (or Ctrl or Cmd + Enter).
- The other person gets an Inbox message for every reply.

**Close**
- **Only the person who raised the ticket can close it** (an admin can too). Press **Close ticket** and confirm.
- A closed ticket cannot take new messages. The one who raised it can press **Reopen ticket**.
- The filter at the top shows **Open**, **Closed** or **All**. Open tickets show first.

**Who gets the ticket**
- Raised by the reviewer, steward or admin: goes to the creator.
- Raised by the creator: goes to the developer (or the reviewer if there is no developer).
- Raised by the developer: goes to the creator.

---

## 5. Inbox messages

You get a message when:
- a journey is **assigned to you** (or allocated by RELAY);
- a journey is **submitted for review** (the reviewer), or has no reviewer (the steward);
- your journey is **closed** after review;
- a journey reaches the **last look** (creator) or is **sent back to design** (developer);
- someone **raises a ticket**, **replies**, **closes** or **reopens** one with you;
- something becomes **overdue** or **stuck**;
- a journey or version you deleted can be **undone** (Undo is offered for 30 minutes).

You never get a message for your own actions. Open a message to jump to the item; opening it marks it read.

---

## 6. APK Testing (testers, app developers, test leads)

A **version** (for example v1.4) is the work. Its test cases are listed inside it.

**Tabs:** Overview · Results by version · APK versions · Test cases.

### Tester
1. Open **Results by version**, then your version. Each row is one test.
2. Set each test with the **Change status** dropdown: **Start testing**, **Pass**, **Fail** or **Not reported**.
3. When a test fails, add the bug note and remark in the item's details.
4. Later, **retest** fixed tests: **Retested – pass** or **Retested – still fails**.

### App developer
1. Look at tests with status **Fail**.
2. When you have fixed one, choose **→ Mark fixed (developer)** and add a remark. Or choose **→ Send for retest**.
3. You can also add versions and test cases.

### Test lead
- Add a version with **New APK version** (it can copy tests from an earlier version). Tests start as **Not Tested**.
- Assign testers, edit test details and the APK file link.
- Close a version when its tests are done. Deleting a version asks first and can be undone for 30 minutes from the Inbox.

---

## 7. Quick answers

| Question | Answer |
|---|---|
| I cannot see my journey. | It is allocated to someone else, or your email on RELAY differs from the one here. Tell your Steward or Admin. |
| There is no arrow option in the status dropdown. | It is not your turn, or you are not allowed to make that move. |
| Where do I update my creation stage? | On RELAY, with Claude. It reaches the dashboard in a few minutes. |
| I reached "5 · Ship" but the reviewer has nothing. | You must choose **→ Submit for review**. |
| The reviewer wants a change. Where? | Inbox message → **Open feedback** → the ticket. |
| Who can close a ticket? | The person who raised it, or an admin. |
| I deleted something by mistake. | Open the Inbox message. Press **Undo** within 30 minutes. |
| The page looks wrong or stale. | Refresh the page. If it stays wrong, tell your admin what you clicked. |

---

## 8. Good habits
- Submit as soon as the journey is ready. Do not wait.
- One problem, one ticket. Short title, clear description.
- Answer tickets in the chat, not elsewhere. Everything stays in one place.
- Check your Inbox at the start and end of the day.
- Keep your CMS and AI Tutor links filled in.
