# Journey — follow-up questions for Arjun (4 Nov 2026) — with answers

Classroots Work now runs the Journey flow from your `journey-answers.md`, with the 35 journeys from your tracker export.
The points below are still open. Each one says what the app does **until you answer**, so the team can start now.
Please reply in this file (write under each question) and send it back to me.

---

## 1. Tracker rows that don't add up

The import took the furthest stage the row shows. Please confirm or correct each one.

| Journey | What the tracker says | In the app now | Correct? If not, what is right |
|---|---|---|---|
| G04C05ST1J1 | Submitted for review 1 Nov, but Creation stage still 4 · Build | Ready for review | **Review state yes, stage no.** The tracker's Creation stage was out of date: the build is at **5 · Ship**. It was submitted on 1 Nov and the review has not started yet, so Review state **Ready for review** is right, with Review date empty. |
| G05C02ST3J1 | Submitted for review 1 Nov, but Creation stage still 4 · Build | Ready for review | **Not quite.** Both are true: it was submitted on 1 Nov while the build was still going on, and the build is still at 4 · Build now. So: Creation stage **4 · Build**, Review state **Ready for review**, Review date empty. |
| G05C02ST4J2 | Submitted for review 1 Nov, but Creation stage still 3a · Spine | Ready for review | **Not quite.** Both are true: it was submitted with its sister journey G05C02ST4J1 while still at 3a · Spine, and it is still at 3a · Spine now. So: Creation stage **3a · Spine**, Review state **Ready for review**, Review date empty. |
| G05C02ST1J1 | Creation stage Published, but no Submitted for review date | 5 · Ship | **Not quite.** It was published in UAT on 26 Oct, before the review step began, so it was never submitted for review. Creation stage **Published**, with Submitted for review left empty. |
| G05C02ST5J1 | Days taken 1, but no Submitted for review date | 4 · Build, Days taken empty | **Yes, the app is right.** It is still at 4 · Build and has not been submitted for review. The "1" was typed by mistake. |
| G04C05ST5J1 | Review state Changes asked, but no Review date | Changes asked, no Closure due | **Add the date.** Review date **3 Nov** (the review was done and its feedback went to the creator that day). Closure due is then **4 Nov**. |

**One rule for the app:** Creation stage and Review state are separate. A creator can submit for review before the build reaches 5 · Ship, as G05C02ST3J1 and G05C02ST4J2 did. So please don't work out one from the other.

**The other journeys sent for review:**

| Journey | Review state | Review date | Closure due |
|---|---|---|---|
| G04C05ST2J1 | Changes asked | 4 Nov (review done today) | 5 Nov |
| G05C02ST2J1 | Review in progress (started 2 Nov, not done yet) | empty until the review is done | – |
| G04C05ST3J1, G04C05ST4J1, G05C02ST4J1 | Ready for review | empty | – |

## 2. Days taken and half days

Five G04C05 journeys (ST1J1, ST2J1, ST3J1, ST4J1, ST5J1) show **2.5** days from Wed 28 Oct to Sun 1 Nov. Counting Mon–Fri with both days included gives **3** (Wed, Thu, Fri).

**Until you answer:** the app calculates Days taken itself (Mon–Fri, both days counted), so these five show 3.

- How is a half day decided? (For example: picked up after lunch, or submitted before lunch?)

  **2.5 is right.** These five were picked up on Wed 28 Oct in the **second half** of the day, so Wed counts 0.5. Then Thu 1 and Fri 1 give 2.5 in all. Sat and Sun don't count.
  The rule: a working day runs 10:00–19:00. A day counts **0.5** if the journey was picked up after lunch (second half) or submitted before lunch (first half). Otherwise it counts **1**.
  For this, the app needs to know which half of the day: either a time, or a "first half / second half" choice next to the Picked up and Submitted for review dates.

- Should the app keep calculating Days taken, or should the creator type it?

  **The app keeps calculating it.** The creator only picks the half of the day.

## 3. Closure due

**Until you answer:** Closure due = Review date + **1 working day**. A review on Friday is due on Monday.

- Is that right, or should it be + 1 calendar day?

  **Yes: + 1 working day** (Mon–Fri). A review on Friday is due on Monday.

## 4. The after-steps

**Until you answer:** the coordinator moves each after-step on, except Last look after design, which the creator moves. No time limits are set, and nothing sends a journey back. Design standardization is **paused**: journeys wait there until it is switched on.

| Stage | Who moves it on | Normal duration | Can it send the journey back? To which stage? |
|---|---|---|---|
| Design standardization | Coordinator | not set yet | No |
| Last look after design | SME creator | 0.5 day | Yes, back to Design standardization, if the design broke something |
| Video replacement | Coordinator | not set yet | No |
| UAT → prod migration | Engineering, then the coordinator moves it on | not set yet | No |
| Published on prod | Coordinator | not set yet | No |
| User testing and QA | Coordinator | not set yet | Yes, back to Changes asked, for any fix |

_This table is our best first version. Nothing is fixed yet, so it may change once the after-steps begin._

- When will the design document be ready, so Design standardization can be switched on?

  **Not known yet.** Hitheshwar owns this action item. Please keep the step paused until then.

- Is any after-step not needed for some journeys (for example, Video replacement only where there are placeholder videos)?

  **Yes.** Video replacement is needed only where a journey has placeholder videos. The coordinator marks each journey "needs video replacement: yes / no". With "no", the journey skips that step.

## 5. Coordinators per chapter

You steer G04C05, Devjyoti G05C02 and Vinay G06C07.

**Until you answer:** every coordinator can allocate creators and reviewers in every chapter.

- Should each coordinator be limited to their own chapter?

  Arjun (G04C05), Devjyoti (G05C02) and Vinay (G06C07) are the coordinators. **Aswin is the admin** for all three chapters, so he can change anything a coordinator has done. Please add Aswin to the admins (with Kishor and Jeevan).

## 6. Holidays and chapter names

**Until you answer:** no holidays are counted. Chapters show their code, or the name already in the system.

- The holiday list for this academic year (dates).

  **No holiday list is needed in the app.** Holidays come from the leave policy, and leaves come in as they are marked. These are handled by hand, with no automation. So the app keeps counting Mon–Fri only, and the coordinator corrects a date by hand when a leave or holiday falls in it.

- The full chapter names for G04C05, G05C02 and G06C07.

  | Code | Chapter name | Book |
  |---|---|---|
  | G04C05 | Sharing and Measuring | CBSE Grade 4, chapter 5 |
  | G05C02 | Fractions | CBSE Grade 5, chapter 2 |
  | G06C07 | Fractions | CBSE Grade 6, chapter 7 |

## 7. Still to send (brief, section 5)

- Screenshots of the Slack tracker.
- Three real feedback examples, as you sent them to a creator.
- One link each to a CMS journey, an AI Tutor and an applet build.

  **Not needed.** We won't send these.

## 8. Claude moving the creation stage

You asked for Claude to update the creation stage from the relay in real time. That needs a small connection with an access key.

**Until you answer:** creators move their own stages in the app.

- Do you want this? Which tool runs the relay?

  **Yes, we want it.**
  The relay is **buildjourneyrelay** (https://buildjourneyrelay.classrootsedu.in). It is an MCP server, and we work on it from Claude Desktop (the Code tab).
  The relay already stores each journey's stage (3a Spine, 3b Script, 4 Build, 5 Ship) and the time it changed. Claude can read the stage there and set the same stage in the app.
  Two asks:
  (1) A key that can change **only** the Creation stage, nothing else.
  (2) Every change Claude makes shows "by Claude" in the history.

Thanks,
Jeevan
