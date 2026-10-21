# assign-sheet — Project Brief

The Biology course Assignment sheet (script ID `145GSzd8oPIJ…`). Menu **Canvas Tools**.
Builds the Q1–Q4 schedule sheets from the master calendar, and posts rows of the
**calendarEvents** sheet to Canvas as calendar events and/or announcements.

> **Where we left off (2026-10-19)**
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
> - **Step 3a done, pushed to all three sheets:** **📤 Post selected rows to Canvas** is
>   the first item in the Canvas Tools menu (same function as the drawn button).
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
> - **Next:** update `course-manager-jupiter/docs/still-in-legacy.md`: calendar events,
>   announcements, and assignment dates now live in assign-sheet.
> - A new Google service in the code (e.g. `MailApp`, `openById`) needs its scope added
>   to `appsscript.json`, or that item fails with a permission error.

## Other sheets using this code

**Rule:** all three sheets always have identical code. Test every change on Biology
first, then push to Gastronomy and AI9.

Gastronomy and AI9 Assignment sheets run the same code (pushed from commit `b918fff`
on 2026-10-20). Settings files: `.clasp-gastronomy.json`, `.clasp-ai9.json`.
Push from `assign-sheet/` after pushing Biology:
`clasp push -P 'C:\Users\lalee\Code\canvas-scripts\assign-sheet\.clasp-gastronomy.json'`
(same for `-ai9`). On Windows, clasp 3.4.1 needs the full backslash path (relative paths
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
- 🔄 Update schedule from Master · 🔗 Reset Master connection · ☑️ Toggle checkboxes
- **⚙️ Setup ›** Set Canvas token · Test Canvas connection · Dry run: show status /
  switch on/off

Labels can change freely. Function names must not change (drawn buttons call them).
Messages that name a menu path (e.g. "Run Canvas Tools › ⚙️ Setup › Set Canvas token")
must be updated with the labels.

## Assignment Dates (07_AssignmentDates.js)

Menu **📝 Assignment dates ›** Load assignment dates from Canvas (`fetchCanvasAssignmentDates`)
and Send changed dates to Canvas (`pushAssignmentDatesToCanvas`). Sheet "Assignment Dates":
header row 2, data from row 3. Columns: A Update? ☐, B ID, C Name (link), D Sub. Type(s),
E Points, F/G Open date/time, H Schedule Info (VLOOKUP on `*simpleSchedule*` C:F by due
date), I/J Due, K/L Lock, M Sync Status.

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
- Section-specific dates (`has_overrides`) are marked and skipped. Per-section editing is
  shelved: Lara has no overrides this year.

## Code notes

- The rest of the project's older code still uses `var`; it works, so update it only
  when a file is being changed anyway.
