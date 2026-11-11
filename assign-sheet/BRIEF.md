# assign-sheet — Project Brief

The Biology course Assignment sheet (script ID `145GSzd8oPIJ…`). Menu **Canvas Tools**.
Refreshes the data the Q1–Q4 schedule sheets read from the master calendar (it does
not create the Q sheets; they come with the workbook), and posts rows of the
**calendarEvents** sheet to Canvas as calendar events and/or announcements.

> **IN PROGRESS (2026-11-09): section dates (overrides) in Assignment Dates.**
> **Paused 11/9 evening:** steps 1, 2, 2b, sorting, and gray rows are live on **Biology
> only** (commit `2e721c2`). Gastronomy, AI9, and the template still run the 11/8
> code (`396699a`); push to them after step 3 is done and tested.
> **11/10:** step 3 (Remove) committed (`e4e4128`), pushed to **Biology**, and tested by
> Lara: works. Next: push to Gastronomy, AI9, then template.
> Lara's decisions 11/9: see, edit, add, and remove section dates; shown as "↳" rows
> under each assignment; student overrides are editable and (changed 11/9 after the first
> test) show the students' names ("↳ Jane Doe", 3 max then "+ n more"), on the sheet
> only: never in logs, errors, or alerts; student IDs never on the sheet. Lara crops or
> hides column C in screenshots she sends Claude. Group rows say "↳ Group" (no name).
> **Fixed after first test (11/9):** the assignment row showed the student's dates,
> because Canvas folds override dates into the assignment's own unless
> `override_assignment_dates=false` is sent (now in `DATES_FETCH_QUERY`).
> Three steps, each committed, guide-updated, and tested in sandbox 4573 first:
> 1. **Load + edit** (pushed to Biology and tested by Lara 11/9: works): see "Assignment
>    Dates" below.
> 2. **Add** (pushed to Biology and tested 11/9): menu item "Add section dates
>    below selected assignment" (`addSectionDatesRow`) reads the assignment's overrides
>    and the course sections, inserts a gray row under the group with a dropdown of
>    sections that have no override yet ("↳ name"), dates copied from the assignment
>    row, Update? checked, Override ID "new". Send (`planNewSectionDates_`) matches the
>    name to a section (refuses blank, unknown, duplicate names, a section that already
>    has an override, or the same section twice in one run) and sends
>    `POST …/assignments/:id/overrides` with `course_section_id` and the dates (blank
>    date omitted if the assignment has none, else null). After a real send: N gets the
>    new override ID, C loses its dropdown, status "Created". **Pushed and tested by Lara
>    11/9: works.**
> 2b. **Add student dates** (pushed to Biology, commit `2e721c2`, tested by Lara 11/9: works):
>    `addStudentDatesRow` shares `addOverrideRow_` (kinds in `DATES_NEW_KINDS`). Asks how
>    many students (`askStudentCount_`) and inserts one row per student (Lara's choice
>    11/9 after testing: comma-typing lost the dropdown; Apps Script can't make
>    multi-select dropdowns, `DataValidationBuilder` has no such option). Dropdown of
>    active/invited students without an override on this assignment (≤500, else "use
>    Canvas"), invalid values rejected. Override ID "new students". Send (`planNewStudentTarget_`) matches names (case/space-
>    insensitive) to `GET /courses/:c/users?enrollment_type[]=student`; refuses unknown
>    or shared names, or students who already have an override (or are on another new row
>    this run). Messages give counts only, never names. POST sends `student_ids` and title
>    "n student(s)" (Canvas requires a title). Editing the students on an existing
>    override stays in Canvas.
> 3. **Remove (pushed to Biology 11/10, commit `e4e4128`; tested by Lara 11/10: works):** menu item "Remove section/student
>    dates on selected rows" (`removeSelectedOverrideRows`). Uses the current selection, not
>    Update? (so a forgotten checkbox, deleted, or filtered row can never remove anything);
>    skips assignment rows, hidden rows, unsent "new" rows, and rows already removed.
>    Re-reads the assignments, skips overrides gone from Canvas or of an "other" kind, asks
>    (counts only: section / student rows with student total / group rows), then sends
>    `DELETE …/assignments/:id/overrides/:id` via `canvasWrite_`. Lara's choice 11/10: the
>    row **stays**, gray and crossed out (C–L), Update? unchecked, status "Removed (…)",
>    Override ID `removed` (`DATES_REMOVED`; never blank, since blank = assignment row and
>    Send would push its dates to the whole assignment). Send skips `removed` rows; Load
>    clears them. Dry run: status "Dry run OK (would remove)", row unchanged.

> **Where we left off (2026-10-20)**
>
> - **Step 1 done, pushed, tested:** `05_CanvasApi.js` (`canvasGet_`, `canvasWrite_`,
>   DRY_RUN, retries/back-off) and `06_Credentials.js` (**Set Canvas token**: User
>   Properties `CANVAS_BASE_URL` and `CANVAS_TOKEN`), adapted from course-manager-jupiter.
>   Menu items Set Canvas token, Test Canvas connection, Dry run: show status / switch
>   on/off all work. The old "Set API Key" item (showed part of the token) is gone.
> - **Step 2 done, pushed, tested:** `processUnifiedSheetForCanvasWithLinks`
>   (name kept; the drawn **Post selected rows to Canvas** button calls it) now sends
>   through `canvasWrite_`. See "Post selected rows" below. Tested in sandbox course 4573
>   (dry run, real post, already-posted skip, missing date, wrong sheet: all pass);
>   Biology `*Config*` B4 set back to the real course afterward.
> - **Pushed to Gastronomy and AI9** too (see "Other sheets using this code"); token set
>   and a dry run checked in each.
> - **Dry run is OFF on all three sheets**, by Lara's choice, for everyday posting.
> - **Step 3a done, pushed to all three sheets:** Post selected rows is on the Canvas
>   Tools menu (same function as the drawn button); since step 5 it is under
>   **📅 Calendar & announcements**.
> - **Step 3b done, pushed to all three sheets, tested:** `appsscript.json` lists
>   `spreadsheets.currentonly`, `script.container.ui`, `script.external_request`. Full
>   `spreadsheets` is not needed: the master calendar comes in by `IMPORTRANGE` in the
>   sheet, and the script never opens it by ID (`MASTER_SHEET_ID` is read but unused).
>   All three sheets re-authorized; no old broad access left.
> - **Step 4 done, pushed to Biology, tested (2026-10-20):** bulk assignment dates tool in
>   `07_AssignmentDates.js` (commit `5b4a143`), ported from legacy
>   `course-manager/03d.AssignmentDates.js`. Tested in sandbox 4573: Lara reports it
>   worked. See "Assignment Dates" below. No drawn buttons: Lara uses the menu.
> - **Step 5 done, tested on Biology (2026-10-20):** Canvas Tools menu regrouped into
>   submenus (see "Menu" below), and date pickers on the Assignment Dates date cells
>   (commit `b918fff`). Lara confirmed Send with a live course assignment, then set
>   Biology `*Config*` B4 back to the real course.
> - **Steps 4 and 5 pushed to Gastronomy and AI9 and tested** (2026-10-20). All three
>   sheets match commit `b918fff`; Lara ran live tests in all three: everything fine.
> - **Docs updated:** `course-manager-jupiter/docs/still-in-legacy.md`, the function map,
>   and the porting summary record that calendar events, announcements, and assignment
>   dates now live here.
> - **User guide (in the sheet since 2026-11-08):** `UserGuide.html`, written for other
>   teachers, opened by **Canvas Tools › ❓ User guide** (`showUserGuide`) in the side
>   panel on the right; its "Open in a large window" link calls `showUserGuideLarge`
>   (side panel live in all four sheets 11/8, commit `396699a`). That file is the only master copy (Lara's decision
>   11/8: keep docs self-contained, like calendar-filter). Keep it updated in the same
>   commit as any change a teacher would see (CLAUDE.md rule). Fixed 11/8: calendarEvents
>   rows start on row 3 (the guide used to say row 4). History: first drafted 10/27 as
>   `USER-GUIDE.md` (removed 11/8; still in Git history). The old Google Doc copy
>   "Assignment Sheet — User Guide", ID `1Dq_05RfbhIUwW_0yK3RuiO0Hn9ud0Hbl6mFx1ba7vXw`, in
>   Drive folder TeacherTools, gets a one-line note pointing to the menu item; it is no
>   longer updated.
> - **Template copy (made by Lara 2026-11-08):** script ID
>   `1cbhPxZa7b7DcBOixCWN6aYCyatLujRDW_xu6RmarQJb0miacPXe13DAk`, settings file
>   `.clasp-template.json`. Claude never opens the template's sheet (Lara does the scrub
>   and the final Ctrl+F check). It is pushed **last** (Biology → Gastronomy, AI9 →
>   template). The original plan, for reference: Lara makes a copy of a
>   live Assignment sheet, scrubs the copy (never the live sheet), and keeps it in her
>   **Shared** folder in Drive for other teachers. Scrub: *Config* B2–B5, calendarEvents rows,
>   the Assignment Dates tab, Q tabs columns F–I; keep D3/D5 if the master calendar is
>   shared. Set dry run ON in the template. Share it view-only, with a `/copy` link.
>   clasp updates code only: tab or label changes go onto the template by hand. How
>   teachers' own copies get updates: later (copies are frozen when made). Shelved ideas: per-section (override) dates in Assignment
>   Dates (no overrides this year); sending name/points from Assignment Dates.
> - A new Google service in the code (e.g. `MailApp`, `openById`) needs its scope added
>   to `appsscript.json`, or that item fails with a permission error.

## Other sheets using this code

**Rule:** all three sheets always have identical code. Test every change on Biology
first, then push to Gastronomy and AI9.

Gastronomy and AI9 Assignment sheets run the same code (pushed from commit `b918fff`
on 2026-10-20), and so does the template copy (from 2026-11-08). Settings files:
`.clasp-gastronomy.json`, `.clasp-ai9.json`, `.clasp-template.json` (template last).
Push from `assign-sheet/` after pushing Biology:
`clasp push -P 'C:\Users\lalee\Code\canvas-scripts\assign-sheet\.clasp-gastronomy.json'`
(same for `-ai9`, then `-template`). On Windows, clasp 3.4.1 needs the full backslash path (relative paths
and `/` fail its security check). On the Mac, use the full path. After the first push to
each sheet: reload, **Set Canvas token**, check dry run is ON, one dry run.
If `appsscript.json` changed, clasp says "Skipping push": that's its manifest question
answered no. Confirm the change is intended, then add `--force`.

## Post selected rows (03_Content_Sync.js)

calendarEvents sheet: header row 2, data from row 3. Columns: A Calendar ☐, B
Announcement ☐, C Title, D Body, E Calendar Date, F Delayed Post, G Replies? ☐,
H event link, I announcement link.

- Runs only if C2 = "Title" and D2 = "Body". Course ID from `*Config*` B4 (must be digits).
  Canvas address comes from Set Canvas token, not `*Config*` B2.
- Canvas writes (both via `canvasWrite_`, so DRY_RUN applies):
  `POST /api/v1/calendar_events` (all-day) and
  `POST /api/v1/courses/:course/discussion_topics` with `is_announcement`.
- Skips a part whose H/I cell already has a link or "View …" text (no duplicates; clear
  the cell to post again). Leaves unchecked status cells alone. Refuses if Calendar is
  checked with no date. Asks before sending; dry run writes "Dry run OK".
- Replies? sends `lock_comment: true` when unchecked. (The old code sent
  `allow_student_to_reply`, which Canvas ignores.)

## Menu (00_Config.js onOpen)

Grouped by what each item works on; "Load from" / "Send to" says which way data moves.

- **📅 Calendar & announcements ›** Post selected calendarEvents rows to Canvas
- **📝 Assignment dates ›** Load assignment dates from Canvas · Send changed dates to Canvas
  · Add section dates below selected assignment · Add student dates below selected
  assignment · Remove section/student dates on selected rows · Sort by selected column
  (keeps ↳ rows together)
- 🔄 Update schedule from Master · 🔗 Reset Master connection · ☑️ Toggle checkboxes
- **⚙️ Setup ›** Set Canvas token · Test Canvas connection · Dry run: show status /
  switch on/off
- ❓ User guide (`showUserGuide`): opens `UserGuide.html` in a window over the sheet.

Labels can change freely. Function names must not change (drawn buttons call them).
Messages that name a menu path (e.g. "Run Canvas Tools › ⚙️ Setup › Set Canvas token")
must be updated with the labels.

## Assignment Dates (07_AssignmentDates.js)

Menu **📝 Assignment dates ›** Load assignment dates from Canvas (`fetchCanvasAssignmentDates`)
and Send changed dates to Canvas (`pushAssignmentDatesToCanvas`). Sheet "Assignment Dates":
header row 2, data from row 3. Columns: A Update? ☐, B ID, C Name (link), D Sub. Type(s),
E Points, F/G Open date/time, H Schedule Info (VLOOKUP on `*simpleSchedule*` C:F by due
date), I/J Due, K/L Lock, M Sync Status, N Override ID (blank on assignment rows).

- **Sorting (11/9):** Load lists assignments by due date (none last; ties keep Canvas
  order). Menu "Sort by selected column" (`sortAssignmentDatesBySelectedColumn`) sorts
  groups (assignment row + its ↳ rows, by assignment ID) on the assignment row's value in
  the selected cell's column (date columns also by their time), using the sheet's own
  `Range.sort` on a temporary key column so formats, notes, checkboxes, and validation
  move with rows; then rewrites Schedule Info formulas. Refuses if the filter hides rows.
- Load rebuilds row 2 down (row 1 is left empty). Read-only. Open/Due/Lock date cells get
  a "must be a date" rule, which gives a calendar picker on double-click and rejects
  typos. Sheets has no time picker; times are typed (e.g. 4:00 pm).
- Send: **dates and times only** (the safe default chosen 2026-10-20; Lara has not asked
  for more; name and points could be added later). Name, points, and submission type
  are gray reference columns and are never sent. Push re-reads Canvas, then sends
  `PUT /courses/:course/assignments/:id` via `canvasWrite_` with only the `unlock_at` /
  `due_at` / `lock_at` that differ (to the minute). Asks before sending.
- A date needs a time (no accidental midnight). Clear both to remove a date. 11:59 pm is
  sent as 11:59:59 pm.
- **Section dates (step 1, 11/9):** fetch and push use `include[]=overrides` and
  `override_assignment_dates=false`. Student names come from
  `GET /courses/:c/users?user_ids[]=…` (fetch only, batches of 50). Each
  override is a "↳" row under its assignment (same date columns; N = override ID),
  tinted (Lara's choice 11/9: gray #e8eaed in C–E only; yellow was too bright; other
  columns as on assignment rows; `DATES_COLORS`; backgrounds move with rows when
  sorting). The
  assignment row is "Everyone else" and is now sent even when the assignment has
  overrides (an assignment PUT without `assignment_overrides` leaves them alone). An
  override row sends `PUT …/assignments/:id/overrides/:override_id`. Canvas un-sets any
  override date left out of that PUT, so the payload carries every date the override
  already sets plus the changed ones; student overrides re-send their `student_ids`
  (memory only). A date the override doesn't set (key absent in Canvas's reply) shows
  the assignment's date in italics with a note, and stays un-set unless changed.
  Overrides that aren't section/student/group (e.g. noop) are marked "Edit in Canvas".
  **To check in testing:** that Canvas really omits un-set override dates (vs. sending
  null), and that the student override keeps its students after a PUT.

## Code notes

- The rest of the project's older code still uses `var`; it works, so update it only
  when a file is being changed anyway.
