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
| **SME reviewer** | Reviews the Journey, gives feedback, verifies corrections, and closes the review. By default this is the coordinator of the creator's team. | Only Journeys assigned to them as SME reviewer. |
| **Steward** | Coordinator of their chapters and owner of their team's Journeys: adds chapters and Journeys, allocates, sets pick-up dates, maintains details, and drives the post-review steps. | Journeys in chapters they steer, and every Journey of their team's creators in any chapter. Elsewhere they can only view. |
| **Program manager** | Watches delivery through dashboards, Journey lists, reports, and exports. | View only. |
| **Admin** | Maintains the system and resolves exceptions. | Any Journey and any stage. |

One person may hold more than one role. For example, a coordinator who is also the assigned reviewer can review a Journey outside the chapters they coordinate, but cannot otherwise edit or allocate that chapter.

## Teams and ownership

Ownership has two levels:

1. **Chapter**: each chapter has a **steward**, the coordinator responsible for completing all its Journeys. The **Chapters** tab lists every chapter with its steward; **My chapters** shows only yours. A coordinator adds a chapter with **+ New chapter** and can remove one that has no Journeys.
2. **Journey**: a Journey belongs to the coordinator of its creator's team, whoever allocated it and in whichever chapter. If Devjyoti allocates a Journey in her chapter to a creator from Team Arjun, Arjun owns its completion. The list and the Journey page show this person as **Steward**.

| Team | Steward (default SME reviewer) | Peer review buddies |
| --- | --- | --- |
| Team Arjun | Arjun | Kapil ↔ Animesh, Preethi ↔ Supriya |
| Team Devjyoti | Devjyoti | Vaishali ↔ Divyanshu, Krishna ↔ Manasa |

When a Journey is allocated, its **SME reviewer** is set to the default reviewer of the creator's team and its **Peer reviewer** to the creator's buddy. A coordinator can change either on one Journey.

The **Teams** tab holds the settings. A team's coordinator can:

- add or remove members (any SME creator who is not in a team yet);
- change the **Default SME reviewer**, for example while they are away;
- change a member's **Peer reviewer**.

Changing a default also updates the team's open Journeys (review not closed) that have no reviewer or still have the old default. A reviewer picked by hand on a Journey is kept. **Fill missing reviewers** fills the empty ones. An admin adds teams and changes their coordinator.

On the Journeys list, filter by **Team**, or choose **Show → My team**.

## The two tracks on a Journey

Every Journey has two independent tracks:

1. **Workflow stage** shows where it is in allocation, review, production, and QA.
2. **Creation stage** shows the build progress: `3a · Spine` → `3b · Script` → `4 · Build` → `5 · Ship` → `Published`.

Do not infer one from the other. A creator may submit a Journey for review while it is still in Spine, Script, or Build, and may keep working on the creation stage while the reviewer is reviewing it.

## Full workflow

```text
Steward creates and assigns the Journey
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
  ↓ automatically, when the review closes: a developer is assigned
Design standardization (the developer checks it)
  ↓ Developer fixes and marks design done
Last look after design
  ├─ Creator sends back with feedback → Design standardization (developer fixes, marks design done again)
  ↓ Creator marks last look done
Video replacement (skipped when not needed)
  ↓ Steward marks videos replaced
UAT → prod migration
  ↓ Steward marks migrated to prod
Published on prod
  ↓ Steward starts user testing
User testing and QA
  ├─ Steward marks done → Done
  └─ Steward sends back for a fix → Changes asked
```

## Step-by-step instructions

### 1. Create and allocate

The **coordinator** creates a Journey in a chapter they steer. The Journey key determines the chapter, so the key must belong to that chapter. The coordinator assigns:

- an **SME creator**;
- an **SME reviewer** (leave it on **Team default** to use the creator's team reviewer); and
- any details needed for delivery, including the pick-up date and whether video replacement is needed.

The Journey begins at **Allocated**. The creator receives an assignment notification. If a Journey is submitted without a reviewer, the coordinators for that chapter receive an Inbox reminder to assign one.

### 2. Build the Journey

The assigned **SME creator** presses **Start**. This changes the workflow stage to **In creation** and starts the creation stage at **3a · Spine**.

The creator updates the creation stage as work progresses and may edit the CMS Journey link and the AI Tutor link.

The creator does not type dates. **Picked up** and **Picked up in** are set by the coordinator; if they are still empty when the creator presses **Start**, they are stamped then. **Submitted for review** and **Submitted in** are stamped automatically by **Submit for review**.

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
| Closed | (automatic) | Moves on to design standardization at once and a developer is assigned. A coordinator can still press **Send to design standardization** if one is stuck here. |
| Design standardization | Developer (or Steward) | The developer checks and fixes the design, then presses **Design done**. |
| Last look after design | SME creator | **Last look done**. If something is wrong, write feedback and **Send back to design**: the developer gets the feedback, fixes it and presses **Design done** again. Repeats until the creator is happy. |
| Video replacement | Steward | **Videos replaced**. This stage is skipped automatically when `Needs video replacement` is `No`. |
| UAT → prod migration | Steward | Advance after Engineering has migrated it. |
| Published on prod | Steward | Start user testing. |
| User testing and QA | Steward | **Mark done**, or use feedback and **Send back for a fix**. |

**Developer:** when a review closes, the journey moves to Design standardization and goes to the developer with the fewest journeys waiting there (Jeevan and Swathi today). The Developer role is given in Admin → People; the coordinator or the journey's own SME creator can change the developer on the journey page (the list shows how many journeys each developer is checking) and in the Developer column of the Journeys list. The developer can be set or changed only while the journey is in Design standardization. If that stage is paused in Admin → Work types → Stages, journeys wait there with no developer; assign one once the stage is active again. The developer sees it in My work.

If QA finds a defect, the coordinator must write feedback and use **Send back for a fix**. The Journey returns to **Changes asked**, so the creator and reviewer use the normal correction and verification loop again.

## Dates, workload, and alerts

- **Days taken** is calculated automatically from Picked up to Submitted for review, using Monday–Friday.
- A Picked up date in the second half counts as half a day; a Submitted date in the first half counts as half a day.
- **Closure due** is one working day after the review date. A Friday review is due on Monday.
- Holidays and leave exceptions are handled by the coordinator correcting the pick-up date when needed. The submitted date is the automatic stamp; only an admin can correct it.
- Creation has a two-working-day target from pick-up to submission.
- Review stages have short stuck-item alerts: review stages are monitored after half a working day, and correction verification after a quarter working day.
- After the review is closed, the creator is no longer counted as carrying open workload for that Journey.

## What each role can edit

| Role | Editable information |
| --- | --- |
| SME creator | Their own creation stage and Journey links (CMS, AI Tutor). |
| SME reviewer | The assigned Journey's review date and Journey links. |
| Steward | In their chapters and on their team's Journeys: creator, SME reviewer, peer reviewer, pick-up date and half, creation stage, review date, links and `Needs video replacement`. Not the submitted date. |
| Program manager | Nothing. |

Stewards can add and delete Journeys in their own chapters. Creators and reviewers cannot create, allocate, or delete Journeys.

## Everyday checklist

### SME creator

1. Open assigned Journeys from Inbox or the Journey list.
2. Press **Start** and maintain the Creation stage while you build.
3. Fill the CMS and AI Tutor links.
4. Press **Submit for review** when ready, even if the creation stage is still progressing.
5. When feedback arrives, fix it and press **Corrections done**.
6. After design, complete **Last look done** or send it back to design if necessary.

### SME reviewer

1. Open Journeys marked **Ready for review** that are assigned to you.
2. Press **Start review**.
3. Close the review, or leave clear feedback and press **Ask for changes**.
4. Verify corrections and either close the review or request another change round.

### Steward

1. Create each Journey in the correct chapter, assign its creator, and set its pick-up date.
1. Keep your team, its default SME reviewer and the peer reviewers up to date on the **Teams** tab.
2. Ensure a submitted Journey has an SME reviewer.
3. Keep `Needs video replacement` accurate before post-review delivery.
4. Move closed Journeys through design, migration, publishing, and QA.
5. If QA fails, leave feedback and use **Send back for a fix**.
6. Monitor Inbox alerts and overdue review closure due dates for your chapters.

## Related documentation

- [Journey requirements](JOURNEY-BRIEF.md)
- [Journey follow-up decisions](JOURNEY-FOLLOW-UP.md)
- [Deployment and relay-key setup](DEPLOY.md)
