# Journey workflow

This guide explains how a Journey moves through Classroots Work, who acts at each point, and what to do when work needs to go back.

## Start here

One record represents one Journey. Its key has this format:

```text
G04C05ST1J1
│  │  │   └─ Journey number
│  │  └───── Subtopic
│  └──────── Chapter
└─────────── Grade
```

Journeys are grouped by chapter. All Journey roles can see every Journey, but a person can act only where their role and assignment allow it.

## Roles

| Role | Main responsibility | Can act on |
| --- | --- | --- |
| **SME creator** | Builds the Journey with Claude, submits it, makes corrections, and does the last look after design. | Only Journeys assigned to them as SME creator. |
| **SME reviewer** | Reviews the Journey, gives feedback, verifies corrections, and closes the review. | Only Journeys assigned to them as SME reviewer. |
| **Coordinator** | Creates and allocates Journeys, maintains details, and drives the post-review steps. | Journeys in chapters they steer. Outside those chapters, they can only view. |
| **Program manager** | Watches delivery through dashboards, Journey lists, reports, and exports. | View only. |
| **Admin** | Maintains the system and resolves exceptions. | Any Journey and any stage. |

One person may hold more than one role. For example, a coordinator who is also the assigned reviewer can review a Journey outside the chapters they coordinate, but cannot otherwise edit or allocate that chapter.

## The two tracks on a Journey

Every Journey has two independent tracks:

1. **Workflow stage** shows where it is in allocation, review, production, and QA.
2. **Creation stage** shows the build progress: `3a · Spine` → `3b · Script` → `4 · Build` → `5 · Ship` → `Published`.

Do not infer one from the other. A creator may submit a Journey for review while it is still in Spine, Script, or Build, and may keep working on the creation stage while the reviewer is reviewing it.

## Full workflow

```text
Coordinator creates and assigns the Journey
                    ↓
Allocated ── Creator starts ──→ In creation
                                  │
                                  └─ Creator submits ──→ Ready for review
                                                            │
                                                    Reviewer starts review
                                                            ↓
                                                     In progress
                                                    ↙           ↘
                                      Reviewer asks for changes  Reviewer closes review
                                                ↓                         ↓
                                        Changes asked                   Closed
                                                ↓                         ↓
                                   Creator marks corrections done   Post-review steps
                                                ↓
                                   Correction verification
                                      ↙                       ↘
                         Reviewer asks again             Reviewer closes review
```

After the review closes, the Journey follows this line:

```text
Closed
  ↓ Coordinator sends to design standardization
Design standardization (currently paused)
  ↓ Coordinator marks design done
Last look after design
  ↓ Creator marks last look done
Video replacement (skipped when not needed)
  ↓ Coordinator marks videos replaced
UAT → prod migration
  ↓ Coordinator marks migrated to prod
Published on prod
  ↓ Coordinator starts user testing
User testing and QA
  ├─ Coordinator marks done → Done
  └─ Coordinator sends back for a fix → Changes asked
```

## Step-by-step instructions

### 1. Create and allocate

The **coordinator** creates a Journey in a chapter they steer. The Journey key determines the chapter, so the key must belong to that chapter. The coordinator assigns:

- an **SME creator**;
- an **SME reviewer**; and
- any details needed for delivery, including whether video replacement is needed.

The Journey begins at **Allocated**. The creator receives an assignment notification. If a Journey is submitted without a reviewer, the coordinators for that chapter receive an Inbox reminder to assign one.

### 2. Build the Journey

The assigned **SME creator** presses **Start**. This changes the workflow stage to **In creation** and starts the creation stage at **3a · Spine**.

The creator updates the creation stage as work progresses and may edit:

- Picked up date and half-day;
- Submitted for review date and half-day;
- CMS Journey link, AI Tutor link, and applet build link.

The creator can also update the creation stage from the Journey page. If the Claude relay is enabled, it can update only this field; its changes appear in the history as made by Claude.

When the Journey is ready for SME review, the creator presses **Submit for review**. The workflow stage becomes **Ready for review** and the submitted date and half-day are recorded.

### 3. Review the Journey

Only the assigned **SME reviewer** can act during review.

1. At **Ready for review**, press **Start review**.
2. At **In progress**, either:
   - press **Close review** when it is acceptable; or
   - use the Feedback card, write actionable feedback, and press **Ask for changes**.

Feedback is required before a Journey can be sent to **Changes asked**. Only the assigned reviewer may write or resolve feedback for that Journey.

When feedback is sent, the reviewer records the review date and the creator is notified. The workflow stage becomes **Changes asked**.

### 4. Correct and verify

The assigned **SME creator** fixes the issues and presses **Corrections done**. The workflow stage becomes **Correction verification**.

The reviewer then chooses one of two outcomes:

- **Close review**: the Journey becomes **Closed**.
- **Ask for changes again**: it returns to **Changes asked** for another correction round.

Continue this loop until the reviewer closes the review.

### 5. Complete post-review delivery

Once a Journey is **Closed**, the coordinator moves it through the delivery steps.

| Stage | Person who advances it | Action / outcome |
| --- | --- | --- |
| Closed | Coordinator | **Send to design standardization**. |
| Design standardization | Coordinator | **Design done** when this currently paused step is enabled. |
| Last look after design | SME creator | **Last look done**. If design introduced a problem, **Send back to design**. |
| Video replacement | Coordinator | **Videos replaced**. This stage is skipped automatically when `Needs video replacement` is `No`. |
| UAT → prod migration | Coordinator | Advance after Engineering has migrated it. |
| Published on prod | Coordinator | Start user testing. |
| User testing and QA | Coordinator | **Mark done**, or use feedback and **Send back for a fix**. |

**Design standardization is paused** until its process/design document is ready. A Journey sent there waits until an admin or coordinator with the relevant stage settings enables it.

If QA finds a defect, the coordinator must write feedback and use **Send back for a fix**. The Journey returns to **Changes asked**, so the creator and reviewer use the normal correction and verification loop again.

## Dates, workload, and alerts

- **Days taken** is calculated automatically from Picked up to Submitted for review, using Monday–Friday.
- A Picked up date in the second half counts as half a day; a Submitted date in the first half counts as half a day.
- **Closure due** is one working day after the review date. A Friday review is due on Monday.
- Holidays and leave exceptions are handled by the coordinator correcting dates when needed.
- Creation has a two-working-day target from pick-up to submission.
- Review stages have short stuck-item alerts: review stages are monitored after half a working day, and correction verification after a quarter working day.
- After the review is closed, the creator is no longer counted as carrying open workload for that Journey.

## What each role can edit

| Role | Editable information |
| --- | --- |
| SME creator | Their own creation stage, pick-up/submission dates and halves, and Journey links. |
| SME reviewer | The assigned Journey's pick-up/submission dates and halves, review date, and Journey links. |
| Coordinator | All Journey details in their chapter, including assignments and `Needs video replacement`. |
| Program manager | Nothing. |

Coordinators can add and delete Journeys in their own chapters. Creators and reviewers cannot create, allocate, or delete Journeys.

## Everyday checklist

### SME creator

1. Open assigned Journeys from Inbox or the Journey list.
2. Press **Start** and maintain the Creation stage while you build.
3. Fill the links and pick-up/submission timing accurately.
4. Press **Submit for review** when ready, even if the creation stage is still progressing.
5. When feedback arrives, fix it and press **Corrections done**.
6. After design, complete **Last look done** or send it back to design if necessary.

### SME reviewer

1. Open Journeys marked **Ready for review** that are assigned to you.
2. Press **Start review**.
3. Close the review, or leave clear feedback and press **Ask for changes**.
4. Verify corrections and either close the review or request another change round.

### Coordinator

1. Create each Journey in the correct chapter and assign its creator and reviewer.
2. Ensure a submitted Journey has an SME reviewer.
3. Keep `Needs video replacement` accurate before post-review delivery.
4. Move closed Journeys through design, migration, publishing, and QA.
5. If QA fails, leave feedback and use **Send back for a fix**.
6. Monitor Inbox alerts and overdue review closure due dates for your chapters.

## Related documentation

- [Journey requirements](JOURNEY-BRIEF.md)
- [Journey follow-up decisions](JOURNEY-FOLLOW-UP.md)
- [Deployment and relay-key setup](DEPLOY.md)
