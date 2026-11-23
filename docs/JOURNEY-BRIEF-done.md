# Journey work type — what we need from you

For the SME / coordinator who owns the Journey process. Jeevan builds the Journey part of **Classroots Work** from your answers.
Nothing here needs technical knowledge. Where you are not sure, write **unsure**; never leave a cell blank.

---

## 0. How to use this file

1. Open Claude. Paste the prompt below, then attach or paste **this whole file** and **your own workflow notes** (the content you already wrote with Claude).
2. Answer Claude's questions one by one. Use the exact words you want to see on screen (button labels, stage names, column names).
3. When Claude says it is finished, save what it gives you as **`journey-answers.md`** (Appendix A filled in).
4. Send Jeevan `journey-answers.md` **plus every file in section 5**.

**Prompt for Claude (copy from here):**

> You are helping me fill in a requirements brief for a work-tracking app. I am attaching the brief (JOURNEY-BRIEF.md) and my own notes about how our Journey process works.
> Work through the brief **section by section, in order** (sections 2, 3A to 3M, then 5). For each question: if my notes already answer it, fill it in and show me the answer to confirm; if they do not, **ask me one question at a time**, in plain language, with an example of a good answer.
> Rules: never invent a stage, role, person, column or rule that I did not give you; keep my exact wording for anything that appears on screen; if I say "unsure", write "unsure"; flag any contradiction between my notes and my answers.
> When every table is filled, output **Appendix A** completely filled in as one Markdown document, followed by the checklist from section 5 with a tick for what I said I can send. Do not summarise or shorten the tables.

---

## 1. What the app does with a "work type" (read once)

Classroots Work already runs **APK Testing**. Journey becomes a second work type built the same way. Every work type is made of the same pieces:

| Piece | Meaning | APK Testing example |
|---|---|---|
| **Item** | One row in the list; the thing that moves through the process. | One test case run on one APK build |
| **Group** | How items are bundled; gets its own rollup table and chart. | APK version |
| **Stage** (status) | Where the item is now. Each stage has a **kind**: waiting, being worked, in review, sent back, approved, done, paused. The kind drives all dashboards. | Not Tested, In Process, Fail, Fixed, Pending Retest, Pass |
| **Move** (button) | Takes an item from one stage to another. Each move says **who** may press it. | "Fail" (tester), "Mark fixed" (app developer) |
| **Role** | What a person may do in this work type: work on items, review, assign people, add items, edit details. Plus: sees **own** items or **all**; which pages open. | Tester, App Developer, Test Lead, Viewer |
| **Field** | A piece of information on the item: text, long text, link, date, number, choice. Each field says who may fill it. | Bug / issue, Developer remarks, APK link |
| **Dates** | Expected date, delay, time in each stage. Counted in **business hours** (today Mon–Sat 10:00–19:00, India time, minus holidays). | Log date, time waiting for fix |
| **Stuck limit** | Hours an item may sit in a stage kind before it is flagged "needs attention". | 18 h in Being worked |
| **Dashboards** | Tiles and charts per work type: by stage, per person, weekly flow, per group, workload per person, needs attention. Every tile opens the matching list. | Per-version pass % chart |
| **Inbox** | Messages inside the app: you were assigned, you got feedback, something was deleted. | "Test 12 failed on 2.0.1.14" |
| **Google Sheet** | Optional two-way link to a tracker sheet, column by column. | Test Execution tab |

Everything the app records (every move, with who and when) becomes history: lead time, review rounds, first-pass approval, on-time %, workload.

---

## 2. What we have today — confirm, change or remove

This is the Journey demo built from **JC-TrackerDemo** (tabs *Chapter List*, *Dropdowns*, *Journeys in Chapters*). Fill the last column of every table: **Keep**, **Change to: …**, or **Remove**.

### 2.1 Stages

| # | Stage on screen | Kind | Sheet value | Keep / Change to / Remove |
|---|---|---|---|---|
| 1 | Received from SME | waiting | (blank) | |
| 2 | YTS | waiting (assigned, not started) | YTS | |
| 3 | WIP | being worked | WIP | |
| 4 | Ready for Review | in review (waiting for reviewer) | Ready for Review | |
| 5 | In Review | in review (reviewer working) | (app only) | |
| 6 | Corrections in Progress | sent back | Corrections in Progress | |
| 7 | Reviewed | approved | Reviewed | |
| 8 | Done | done | Done | |
| 9 | On Hold | paused | (app only) | |
| 10 | Blocked | paused | (app only) | |

### 2.2 Moves

| # | From | Button | To | Who may press | Keep / Change / Remove |
|---|---|---|---|---|---|
| 1 | Received from SME | *(automatic when a developer is assigned)* | YTS | Coordinator | |
| 2 | YTS | Start | WIP | the assigned Developer | |
| 3 | WIP | Submit for review | Ready for Review | Developer | |
| 4 | WIP | Put on hold | On Hold | Developer | |
| 5 | WIP | Mark blocked | Blocked | Developer | |
| 6 | On Hold | Resume | WIP | Developer | |
| 7 | Blocked | Unblock | WIP | Developer | |
| 8 | Ready for Review | Withdraw | WIP | Developer | |
| 9 | Ready for Review | Start review | In Review | Reviewer | |
| 10 | Ready for Review | Approve | Reviewed | Reviewer | |
| 11 | Ready for Review | Request corrections | Corrections in Progress | Reviewer | |
| 12 | In Review | Approve | Reviewed | Reviewer | |
| 13 | In Review | Request corrections | Corrections in Progress | Reviewer | |
| 14 | Corrections in Progress | Re-submit | Ready for Review | Developer | |
| 15 | Reviewed | Mark done | Done | Developer or Reviewer | |
| 16 | Done | Reopen | Corrections in Progress | Reviewer | |

### 2.3 Roles

| Role | May | Sees | Pages | Keep / Change / Remove |
|---|---|---|---|---|
| Developer | work on items (start, submit, re-submit, withdraw, hold, block, mark done) | own items | Dashboard, Items | |
| SME / Reviewer | review (start review, approve, request corrections, reopen); edit item details | all items | Dashboard, Items, Reports | |
| Coordinator | add journeys, assign developers | all items | Dashboard, Items, Reports, Export | |
| Viewer | look only | all items | Dashboard, Items, Reports | |

Admins (today Jeevan and Kishor) can do everything in every work type, including setting any stage directly.

### 2.4 Columns of *Journeys in Chapters* (today's fields)

| Sheet column | In the app | Type | Who edits in the app | Keep / Change / Remove |
|---|---|---|---|---|
| GxxCxxJxx | Journey ID (unique key) | text | Coordinator when adding; fixed after | |
| GxxCxx | Chapter (the group) | text | Coordinator when adding | |
| Chapter | Chapter title | text | nobody in the app (comes from the sheet) | |
| J# | Journey number (sort order in chapter) | number | nobody in the app (comes from the sheet) | |
| Journey Name | Title | text | Coordinator when adding | |
| Applet Status | Stage | choice | by moves only | |
| Developers | Developer (assignee) | person | Coordinator | |
| Owner | SME (owner) | person | Coordinator when adding | |
| Expected Completion Date | Expected completion | date | Coordinator when adding; Reviewer later | |
| UAT CMS journey Name | UAT CMS journey name | text | Reviewer | |
| UAT CMS journey ID | UAT CMS journey (link) | link | Developer, Reviewer | |
| AI Tutor English Link | AI Tutor (English) | link | Developer, Reviewer | |
| Completion Date | Journey completion date (SME) | date | Reviewer | |
| Week of Month | Week of month | number | Reviewer | |
| Status | Journey status (SME) — the SME's own status, separate from the applet stage | text | Reviewer | |
| Aswin feedback | Reviewer notes (sheet) | long text | Reviewer | |
| *(app only)* | Applet build / preview (link) | link | Developer | |
| *(app only)* | Developer notes | long text | Developer | |
| App Updated At | stamped by the app | date | nobody | |

### 2.5 Columns of *Chapter List*

Grade + Chapter (code GxxCxx) · Grade · Book · Part · Chapter No · Chapter · Ideal teaching months · NCERT PDF URL · Creator · Expected Completion.

Keep / Change / Remove: ______

### 2.6 Stuck limits (business hours; one business day = 9 h)

| Stage kind | Flag after | Keep / Change to |
|---|---|---|
| waiting (Received, YTS) | 27 h (3 days) | |
| being worked (WIP) | 45 h (5 days) | |
| in review | 18 h (2 days) | |
| sent back (Corrections) | 27 h (3 days) | |
| paused (On Hold, Blocked) | 45 h (5 days) | |

---

## 3. Questions

Each block says why we ask. Answer in the tables of Appendix A (Claude will fill them for you).

### 3A. The journey itself

*Why: this decides what one row is and how rows are grouped; everything else hangs off it.*

1. What is **one item**: one journey, one applet, one journey per language, one journey per platform? If a journey has several deliverables (applet, AI Tutor, translation), is each its own row or one row with several fields?
2. How is a journey **identified**? Explain the ID format (today GxxCxxJxx = Grade, Chapter, Journey number). Is it unique forever? Who gives it?
3. How are journeys **grouped** for reporting: by chapter, by grade, by book, by month, by developer team? Pick the one main grouping; list others as filters.
4. **Volumes**: how many journeys per chapter, per month, in total now, expected in a year.
5. How does a **new journey enter** the list: who creates it, from where (CMS, sheet, message, meeting), with what information at that moment.
6. What does **done** mean: approved by SME, live in CMS, live in the app, taught in class? Can a done journey come back?
7. Are there **different kinds** of journeys with different flows (e.g. new build vs. correction of a live one, English vs. Indonesian)? If yes, describe each.

### 3B. Every stage from start to live

*Why: each stage becomes a status with a kind; the kind drives every chart.*

8. List **every stage** a journey passes through, from the first idea to live, including the SME content stages before the developer gets it and anything after approval (upload, QA, publish). For each: name on screen · what it means · who does the work in it · typical duration · kind (waiting / being worked / in review / sent back / approved / done / paused) · value in the sheet.
9. Are there **parallel tracks** (SME writes content while developer builds; AI Tutor done by someone else)? Do they need separate work types, or separate fields on one row?
10. Which stages are **mandatory** and which can be skipped? Who may skip?
11. Should the SME's own status (today the "Status" column) be a **second stage track** on the same row, or merged into one list of stages?

### 3C. Moves and buttons

*Why: every button is a move with a name and a permission; what must be filled when pressing it becomes a required field.*

12. For each move: from stage · button label · to stage · who may press · what must be filled in when pressing (feedback text, build link, reason, date).
13. **Backward moves**: withdraw a submission, reopen a done journey, send back from approved. Who, and does it need a reason?
14. **Hold and Blocked**: who may pause, must they say why, who may resume, is there a list of standard reasons?
15. Can a reviewer **approve and mark done in one press**, or are they always two steps? Who marks done?

### 3D. Roles and people

*Why: a role is the set of buttons and fields a person gets; own-vs-all decides what they see.*

16. For each role: name · may work / review / assign / add / edit details (tick any) · sees own items or all · pages (Dashboard, Items, Reports, Export).
17. For each **person** on the Journey team: name · email · office (@classrootsedu.com) or other · roles · how many journeys they comfortably carry at once (capacity, default 3). Also list people who appear in the sheet but no longer work here.
18. Can a journey have **more than one developer** or **more than one SME**? If yes, who is "the" assignee for workload and buttons?
19. Who **assigns** developers? Who may re-assign mid-way? Does the developer pick from a queue instead?
20. Is there a **lead / manager** role that sees everything but should not get work buttons? Any **client or external viewer**?

### 3E. Fields on a journey

*Why: every column becomes a field with a type and an owner; "required at stage" becomes a check when pressing the button.*

21. For every column of your live tracker: column name · type (text / long text / link / date / number / choice / person) · who fills it · at which stage it is filled · required? · show in the list table? · keep in the sheet?
22. For every **choice** column: the full list of allowed values, in order, and whether new values may be added from the app.
23. Which columns are **formulas** in the sheet (calculated, never typed)? We will calculate those in the app and not write them back.
24. Links: which links does a journey carry (CMS, AI Tutor, build, Figma, Drive, video)? Which are per journey and which per chapter?
25. Is there anything you note **outside the sheet** today (chat, email, a second sheet) that should be a field?

### 3F. Feedback and review rounds

*Why: feedback drives the Corrections stage, inbox messages and the review-round analytics.*

26. How is feedback given today: one text box, a numbered list, a separate document, comments in the CMS? Should the app store feedback **per round** (round 1, round 2 …)?
27. Who may give feedback: only the owning SME, any SME, a lead? Is there a **final approver** different from the reviewer?
28. Is there a **severity** or checklist (must-fix / nice-to-have, content / design / bug)?
29. How many review rounds are normal, and how many are too many (so we can flag it)?
30. Should the developer be able to **reply** to feedback in the app (today: Developer notes)?

### 3G. Dates and time

*Why: expected dates give the delay column; business hours give lead time and stuck flags.*

31. How is the **expected completion date** set: by the coordinator, by a rule (e.g. 5 working days from assignment), by the teaching calendar (ideal teaching months)? May the developer change it?
32. **Business hours and days**: today Mon–Sat 10:00–19:00 India time. Correct? Which holidays?
33. What counts as **delayed**: past expected date, or past expected date by more than N days? Is there a separate "at risk" warning (due in next 2 days)?
34. **Stuck limits** per stage kind (section 2.6): confirm or change.
35. What is **Week of Month** used for, and should the app calculate it from the completion date?
36. Which dates do you need recorded: received, assigned, started, submitted, reviewed, approved, done, published? (The app stamps these automatically on the move; tell us if any is typed by hand.)

### 3H. Dashboards and reports

*Why: every tile and chart must answer a real question; we build only what someone will look at.*

37. Who looks at the dashboard, how often, and what **three questions** must it answer for each of them (coordinator, SME lead, management, developer)?
38. The **per-group rollup** (like the APK per-version table): which group (chapter?) and which columns: total journeys, done, in review, with developer, waiting, delayed, % done, average days? Which single number is the "success" figure for the chart line?
39. Definitions: **on time** = ? · **first-pass approval** = approved without a Corrections round? · **cycle time** = from which stage to which?
40. Any **targets** (journeys per week per developer, % done per month, max review time)? Lines on charts at those targets?
41. Which **reports** do you make by hand today (weekly mail, monthly summary, per-developer sheet)? Attach an example of each.
42. Should developers see **only their own numbers** compared to a team average (as APK testers do), or everyone's?

### 3I. Notifications

*Why: inbox messages are cheap; email needs setting up and gets ignored if overused.*

43. Who should be told when: a journey is assigned · submitted for review · feedback given · approved · marked done · overdue · stuck · put on hold? For each: in-app inbox, email, or both.
44. Any **daily or weekly digest** (e.g. Monday morning list of overdue journeys to the coordinator)?

### 3J. Google Sheet

*Why: two-way sync is the most fragile part; the fewer columns and directions, the safer.*

45. After the app is live, do you **keep the sheet**, keep it read-only as a mirror, or retire it?
46. If kept: direction — sheet → app, app → sheet, or both? Who still types into the sheet and which columns?
47. Which **tabs** must stay in step (Journeys in Chapters, Chapter List, Dropdowns, summary tabs)? Which contain formulas or dropdown validations we must not overwrite?
48. Link to the **live** tracker (not the demo) and who owns it.

### 3K. Existing data

*Why: the first import sets the history; wrong mapping is hard to undo.*

49. Which tracker(s) to import, and from which date (all history, this academic year only)?
50. **Old value → new stage** mapping for every value that appears in the Applet Status and Status columns today, including typos and blanks.
51. People named in the sheet **without emails** or who have left: map each to a real person or mark "former".
52. Rows to **skip** (test rows, cancelled journeys) and how to recognise them.
53. Are there journeys already **done** whose dates you want kept (completion date in the sheet) so history is right?

### 3L. Chapters and other master lists

*Why: chapters are the groups; master lists feed dropdowns.*

54. Chapter List: confirm the columns (section 2.5). Who adds a new chapter, and when? Is Grade + Book + Part + Chapter No the full identity?
55. Do **teaching months** or **expected completion per chapter** drive journey deadlines?
56. Other master lists: SME list, developer list, journey types, platforms, languages, subjects. Who maintains each?

### 3M. Pain points, must-haves, out of scope

57. The **five biggest problems** with the sheet today, in order.
58. **Must-have on day one** vs. **nice-to-have later**.
59. What should the app **not** do (things that stay in the CMS, in chat, in the sheet)?
60. Anything in your Claude notes that none of the questions above covered.

---

## 4. Checks before you send

- Every stage in 3B has a kind and appears in at least one move in 3C.
- Every button in 3C names who may press it, and that role exists in 3D.
- Every column in 3E has a type and an owner.
- Every person in 3D has an email or is marked "former".
- Every old sheet value in 3K maps to a new stage.
- Nothing is blank; "unsure" is fine.

---

## 5. Files and data to send back

Tick what you are sending. Send everything in one folder or Drive link.

- [ ] **`journey-answers.md`** — Appendix A filled in by Claude with you.
- [ ] **Live Journey tracker as `.xlsx`** (File → Download → Microsoft Excel), with **every tab**. Also the view link to the Google Sheet.
- [ ] **Dropdowns / Lists tab** with every allowed value, if it is a separate sheet.
- [ ] **Chapter List** (if separate) for every grade you track.
- [ ] **10–20 real journeys** that show the full range: a new one, one in review, one with two correction rounds, one done, one on hold, one with messy data. Point out which rows they are.
- [ ] **People list**: name · email · office or other · roles · capacity · active or former.
- [ ] Any **process document / SOP / flow chart** you already have (your Claude notes count).
- [ ] **Screenshots** of the sheet tabs as they look today (headers visible), and of any colour coding you use.
- [ ] **Three real feedback examples** as written to a developer (copy the text).
- [ ] **One example of each report** you make by hand (weekly mail, monthly summary).
- [ ] Links to one **CMS journey**, one **AI Tutor** and one **applet build** so we can see what the link fields point at.
- [ ] If the sheet has **formulas or summary tabs** you want kept: tell us which, and send a copy where they are visible.

---

## Appendix A — answer template

Claude fills these from your answers. Add rows as needed. Order matters: it is the order we build in.

### A1. One journey (3A)

| Question | Answer |
|---|---|
| One item is | |
| ID format and who gives it | |
| Main grouping · other filters | |
| Volumes (per chapter / month / total / next year) | |
| How a new journey enters | |
| "Done" means | |
| Kinds of journeys with different flows | |

### A2. Stages (3B)

| # | Stage on screen | Meaning | Who works in it | Typical duration | Kind | Sheet value | Mandatory? |
|---|---|---|---|---|---|---|---|
| 1 | | | | | | | |

Parallel tracks: ______ · Second stage track for SME status: yes / no: ______

### A3. Moves (3C)

| # | From | Button label | To | Who may press | Must fill when pressing | Reason required? |
|---|---|---|---|---|---|---|
| 1 | | | | | | |

Hold / Blocked standard reasons: ______ · Approve and done in one press: yes / no · Who marks done: ______

### A4. Roles (3D)

| Role | Work | Review | Assign | Add | Edit details | Sees own / all | Pages |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

### A5. People (3D)

| Name | Email | Office / other | Roles | Capacity | Active / former | Name as written in the sheet |
|---|---|---|---|---|---|---|
| | | | | | | |

Several developers per journey: yes / no · Several SMEs: yes / no · Who assigns / re-assigns: ______

### A6. Fields (3E)

| Column in sheet | Name on screen | Type | Who fills | Filled at stage | Required? | In list table? | Keep in sheet? | Formula? |
|---|---|---|---|---|---|---|---|---|
| | | | | | | | | |

### A7. Choice lists (3E, 3L)

| Field | Allowed values (in order) | New values from the app? | Who maintains |
|---|---|---|---|
| | | | |

### A8. Feedback (3F)

| Question | Answer |
|---|---|
| How feedback is written today | |
| Store per round? | |
| Who may give feedback · final approver | |
| Severity / checklist | |
| Normal rounds · too many rounds | |
| Developer may reply in app? | |

### A9. Dates and limits (3G)

| Question | Answer |
|---|---|
| How expected date is set · may developer change it | |
| Business days and hours · holidays | |
| Delayed = · at risk = | |
| Stuck limits: waiting / being worked / in review / sent back / paused | |
| Week of Month meaning · calculate automatically? | |
| Dates typed by hand (not stamped by a move) | |

### A10. Dashboards and reports (3H)

| Who | How often | Three questions it must answer |
|---|---|---|
| | | |

Per-group rollup: group = ______ · columns = ______ · success figure = ______
On time = ______ · First-pass approval = ______ · Cycle time from ______ to ______
Targets and chart lines: ______ · Reports made by hand (attached): ______ · Developers see own vs team only: yes / no

### A11. Notifications (3I)

| Event | Who is told | Inbox / email / both |
|---|---|---|
| Assigned | | |
| Submitted for review | | |
| Feedback given | | |
| Approved | | |
| Marked done | | |
| Overdue | | |
| Stuck | | |
| Put on hold | | |

Digest: ______

### A12. Google Sheet (3J)

| Question | Answer |
|---|---|
| Keep / mirror / retire | |
| Direction | |
| Who still types in the sheet · which columns | |
| Tabs to keep in step · formulas and validations to protect | |
| Live tracker link · owner | |

### A13. Existing data (3K)

| Old value in sheet (column) | New stage | Notes |
|---|---|---|
| | | |

Import from date: ______ · Rows to skip and how to recognise them: ______ · Keep completion dates of done journeys: yes / no

| Name in sheet without email / former | Real person or "former" |
|---|---|
| | |

### A14. Chapters and master lists (3L)

| List | Columns | Who maintains | Drives deadlines? |
|---|---|---|---|
| Chapter List | | | |
| | | | |

### A15. Pain points and scope (3M)

| Top 5 problems today | Must-have day one | Nice-to-have later | Out of scope |
|---|---|---|---|
| | | | |

Anything not covered: ______

---

## Appendix B — how your answers become the app (for Jeevan)

| You give us | It becomes | Where |
|---|---|---|
| A stage (A2) | a status with `category` and optional `sheetValue` | `statuses` in the module definition |
| A button (A3) | a transition `from → to` with `by` (ASSIGNEE or a capability) | `transitions` |
| "Must fill when pressing" (A3) | a required field check on the transition | server action + a field in `fields` |
| A role (A4) | a role template: capabilities, `dataScope`, `pages` | `roles` |
| A column (A6) | a field with `type`, `source` and `editableBy`; list table column | `fields`, `columns`, `table.extra` |
| A choice list (A7) | an allowed-values list on the field | field type + validation |
| The main grouping (A1) | `groupKey` and the per-group rollup table and chart | `groupSummary`, `labels.group` |
| Rollup columns and success figure (A10) | `groupSummary.columns`, `series`, `successSeries`, `rateLines` | module definition |
| Stuck limits (A9) | `stuckAfterHours` per category | module definition |
| Business hours and holidays (A9) | calendar setting and Holiday rows | Admin → Settings |
| Sheet columns and direction (A12) | `sheet.columns`, `sheet.linked`, push-only or two-way | module definition, Admin → Sheet sync |
| Old value → new stage (A13) | status mapping in the importer and a data migration for demo rows | `scripts/import-xlsx.ts`, `prisma/migrations/` |
| People (A5) | users with roles in the Journey work type | Admin → People & access |
| Notifications (A11) | `notify()` calls on the matching events | work-item service |
| Chapter List (A14) | Chapter rows (group master data) | `Chapter` table, importer |

Module file today: `src/modules/journey-applet/definition.ts`. Build pattern: README "APK Testing data model" and NEXT-STEPS § 8.1.
