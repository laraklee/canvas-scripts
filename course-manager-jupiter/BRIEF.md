# course-manager-jupiter — Project Brief

> **Where we left off (2026-10-16)**
>
> - **Built and tested in the Sheet:** `ref_Config` with its twelve `cfg_` named ranges;
>   `ref_CourseIDs` ("Refresh course list"); `ref_peopleList` ("Refresh people list");
>   token setup ("Set Canvas token", User Properties); the read-only Canvas request
>   helper `canvasGet_()` ("Test Canvas connection"); the startup check ("Check setup").
> - **Done 2026-10-17:** `ref_simpleSchedule` and `ref_gradingScale` added to
>   `SHEETS_BUILT`, so the startup check covers them (tested: "Setup OK").
> - **Reorder plan, step 1 of 4 done (read-only report, 2026-10-17):** legacy
>   `createAssignmentGroupsList` (06_DataSetup.js) and
>   `updateAssignmentPositionsFromSelectedRows` (09_MiscTools.js) reviewed. Verified
>   call per the Canvas docs: `PUT /api/v1/courses/:course_id/assignments/:id` with
>   `assignment[position]`, one call per assignment. Canvas has no documented
>   reorder-within-group endpoint. Don't send `assignment_group_id` (the legacy code did,
>   which can move an assignment to another group) or `notify_of_update`.
> - **Reorder plan, step 2 of 4 done (2026-10-17, tested: refresh count right, "Setup OK"):**
>   `ref_assignmentGroups` ("Refresh assignment groups", stamp
>   `AssignmentGroups_LastRefreshed` in J1), legacy's 7 columns, sorted by group order
>   then position; `readAssignmentGroups_()` reads it back by header name; added to
>   `SHEETS_BUILT`.
> - **Legacy reorder workflow (keep it in step 4):** Lara sorted the rows however she
>   liked, numbered the Position cells with `fillSelectedRangeSequentially`, selected
>   the rows, and pushed. She never changed groups from the sheet.
> - **Reorder plan, step 3 of 4 done (2026-10-17, tested: status, switch off/on, DRY RUN
>   log line under Executions; left ON):**
>   `canvasWrite_(method, path, payload)` in `CanvasApi.js`; sends only when Script
>   Property `DRY_RUN` is exactly "false" (unset = dry run ON). Dry-run log shows the
>   method, the path with numbers as `:id`, and field names only. Menu items "Dry run:
>   show status", "Dry run: switch on/off" (asks first, extra warning when turning off),
>   and the temporary "Test dry-run write" (runs only while dry run is ON; remove in
>   step 4).
> - **Reorder plan, step 4a done (2026-10-17, tested: Preview works in Lara's course):** tool
>   sheet `Assignment Order` (`TOOL_SHEETS.ASSIGNMENT_ORDER`), `ReorderTool.js`. Columns:
>   Group, Assignment, Due Date, Current Position (grey, read-only), New Position
>   (yellow, typed), Assignment ID, Group ID (grey; Group ID is for Lara to see only,
>   e.g. two groups with the same name; code never reads it). Menu: "Open reorder tool"
>   (refreshes `ref_assignmentGroups` first; asks before clearing typed entries; rebuilds
>   earlier layouts in place), "Number selected rows 1, 2, 3…" (legacy
>   `fillSelectedRangeSequentially`; only in the column headed New Position; counts
>   1, 2, 3… separately per group, found by Assignment ID; skips hidden/filtered rows),
>   so Lara's habit works: sort the whole sheet by Due Date, select column E, number.
>   "Preview reorder"
>   (group names, move counts, and each changing group's new order, up to 10 lines;
>   sends nothing). `planReorder_()`: a typed New Position is the exact final slot;
>   blank rows fill the remaining slots in their current order; duplicates, non-whole
>   numbers, or numbers larger than the group skip that group; group always comes from
>   `ref_assignmentGroups` by ID. Reads the whole New Position column (not the
>   selection); groups with nothing typed are never touched. Minimal moves, except when
>   an edited group's Canvas numbering is messy (duplicates or gaps, e.g. two 1s, seen
>   in Lara's course): then every assignment in that group gets 1…N in the new order,
>   also when the whole group was numbered and the order stays the same (tidy up).
>   `writeAssignmentGroupsSheet_()` now holds the refresh work (no pop-up).
> - **First 4a test (Lara):** sheet built and Preview ran. Her question exposed a bug:
>   typed numbers were mixed in with the current positions instead of taking exact
>   slots. Fixed with the exact-slot rule above, plus Due Date column and new-order
>   Preview (Lara's requests). Then: her legacy habit (sort whole sheet by due date,
>   number every row) would have produced numbers larger than each group, so numbering
>   now counts per group, and Group ID was added for visibility. Retested: Preview OK.
> - **Reorder plan, step 4b done (2026-10-17, tested: a real Push in the test course
>   reordered assignments as Lara set them up):** "Push reorder" in
>   `ReorderTool.js`: refreshes, plans from fresh data, confirms (shows dry-run state),
>   sends per group through `canvasWrite_()` (`PUT assignments/:id`, only
>   `assignment[position]`, never `notify_of_update`). A refused move (403/404/400, e.g.
>   closed grading period) stops that group only; token/network/busy errors stop the
>   whole Push. Stops starting moves after 5 minutes. One Push at a time (document
>   lock). After a real push: refresh, report "matches your order in X of Y groups";
>   rebuild the tool sheet only if all match and nothing was skipped, otherwise keep
>   the numbers (Push again only sends what is still out of place). "Test dry-run write"
>   removed. Canvas docs: closed grading periods, moderated grading, and admin-frozen
>   attributes can block assignment edits.
> - **Test course:** Lara tests writes in last quarter's "Sequence 9, AI literacy" course
>   (has students, grades, and comments; still live in Canvas; course and grades backed
>   up; nothing bad if its order gets messed up). Point `cfg_CourseID` at it for tests,
>   then back to the real course, and leave dry run ON afterward.
> - **Grades:** Lara can never push grades (admin turned it off). Never build or try
>   grade writes.
> - **Menus:** reorganization deferred to the end of the build. Until then, each new
>   tool's items go at the bottom of Course Manager after a separator line, like the
>   reorder tool. Lara will say when the menu gets out of hand.
> - **`ref_gradingPeriods` shelved (2026-10-17):** nothing in the legacy code builds it;
>   its only reader, `fillGradesForSelectedGradingPeriodInActiveColumn`, pulled past
>   quarters' scores from the Canvas gradebook, which the Jupiter build doesn't need. If
>   it's needed later, build it from `GET /courses/:course/grading_periods` (keep A = ID,
>   B = title; preserve hand-typed columns such as "Grades Published" by ID).
> - **`ref_SectionLookup` done (2026-10-17, tested: periods right, "Setup OK"):** "Refresh section list"
>   (`RefSheets.js`, stamp `SectionLookup_LastRefreshed` in G1). One read-only
>   `GET /courses/:course/sections` instead of legacy's one request per section; lists
>   every section (legacy listed only sections with people). Same 4 columns as legacy:
>   Section ID, Section Name, Period (from "(P#)" in the name; Lara confirmed her names
>   use it), Section ID Copy. Sorted by period, then name; no-period sections last.
>   Added to `SHEETS_BUILT`. Readers in legacy: a tool-tab formula (MATCH period in C,
>   return A), `getPeriodNameFromId` (A → C), roster and seating-chart tools.
> - **Home tab / `ref_Index` done (2026-10-17, tested: built on open, Home formula gives
>   one column of clickable tab links; Lara is assigning the button):** `SheetIndex.js`,
>   `refreshSheetIndex` (menu item at the bottom after a separator; Lara assigns it to a
>   Home button herself). Ported from legacy `refreshIndex` (no helpers) and
>   `writeCurrentSpreadsheetIdToConfig`: same layout as legacy `*Index*` (title A1,
>   headers row 3 Sheet Name / Link / GID, data from row 4; Lara's tabs first, then
>   `ref_` tabs via the new `isSystemSheet_()` in `Config.js`); writes the workbook ID
>   into `cfg_ThisSheetID`. Runs silently in `onOpen` before the setup check (like
>   legacy). Home tab is hand-built by Lara; she'll replace the legacy
>   `=IMPORTRANGE(INDIRECT("'*Config*'!B6"), "'*Index*'!A1:ZZZ")` with
>   `=ARRAYFORMULA(IF(ref_Index!C4:C="", "", HYPERLINK("#gid=" & ref_Index!C4:C, ref_Index!A4:A)))`.
>   Buttons: Insert › Drawing, ⋮ › Assign script, type a public function name (no
>   trailing `_`); drawings don't work in the Sheets phone app.
> - **Next:** pick the next tool to port from Lara's Decision column in
>   `docs/legacy-function-map.md` (port / later / leave behind); Lara is adding Home
>   buttons as tools are built.
> - **Open questions:**
>   - Assignment ID vs. the ID in the Canvas URL: the reorder call needs the
>     Assignment ID (`assignment.id`). Why the old data differed is still unknown. Check
>     after step 2, using IDs and URL paths only (no names).
>   - What reads the time-dropdown values back, and in what format?
>   - Does Lara use the seating chart? What are Period Pairs for?
>   - Should reference sheets be hidden automatically when built?
>   - Limit `script.external_request` with a `urlFetchWhitelist` for the school's
>     Canvas address?

Read this at the start of every session, together with the repo-level `CLAUDE.md`
(which always wins if the two disagree). Lara is new to the command line: explain each
command in plain language before running it, and prefer small, reviewable steps.

## What this project is

A trimmed-down rebuild of the legacy `course-manager` Apps Script project, for use with
Jupiter Grades. Only the tools Lara actually uses are ported, one at a time.

- The legacy project stays intact, untouched: the `course-manager/` folder and the Git
  tag `legacy-gradebook`. Someone may still want it for the Canvas Gradebook. **Never edit
  anything under `course-manager/`.**
- The new code lives in `course-manager-jupiter/`, with its own new Google Sheet and its
  own Apps Script project (connected later with `clasp clone`, never guessed).
- Don't open the workbook or read any data from student-roster sheets. Work from the code.

## Rules specific to this project

1. **Names are exact.** Once a name appears in the table, it never changes: sheet names
   and named ranges are never renamed, shortened, or re-punctuated. Reference sheets only through one constant, e.g. `SHEETS.CONFIG`.
   (The legacy names used `*asterisks*`, which AI tools kept stripping as markdown. They
   are replaced by a `ref_` prefix.)
2. **System sheets are identified by the `ref_` prefix** through one helper
   (e.g. `isSystemSheet_()`), replacing the legacy "name starts with `*`" check.
3. **No fixed cell addresses in code.** Config values are read through named ranges
   (`cfg_...`). Formulas on sheets should use the names too.
4. **Startup check.** On open, verify that every sheet in `SHEETS` exists and every
   `cfg_` named range exists, and show a clear alert if not. Report counts, never data.
5. **Reference tabs get a red tab color** as the "be careful here" signal.
6. **Everything in `CLAUDE.md` applies**: dry-run writes, explicit `oauthScopes`,
   no student data in logs, header comment on every file, `clasp push` only after asking.

## Design rules for reference sheets

Decided with Lara on 2026-10-17. The aim: no tool depends on someone remembering to
refresh.

1. **Script-built snapshots.** Each `ref_` sheet is rebuilt by code (from Canvas, or from
   the workbook for `ref_Index`). Nobody types into them, except columns a builder is
   written to keep across refreshes (e.g. Jupiter category checkmarks).
2. **Refresh before use.** Every script tool that reads a Canvas-built `ref_` sheet
   refreshes it first. It may skip that when the sheet's `*_LastRefreshed` stamp is only a
   few minutes old, so back-to-back tools don't re-download the same list. (The reorder
   tool already refreshes on open and before Push.)
3. **Formulas that read `ref_` data** don't trigger refreshes. Put them on tool tabs whose
   tool refreshes what they need, or decide case by case when porting.
4. **Refresh on open only without Canvas.** The automatic `onOpen` can't contact Canvas
   (Google requires an installable trigger for that), so only `ref_Index` rebuilds on open.
   An installable trigger is Lara's call if one is ever needed.
5. **Manual "Refresh …" menu items stay** as a backup. They don't need Home buttons.
6. **Safe rebuilds.** Each builder checks the header row before overwriting, changes
   nothing unless Canvas answers, stamps a `*_LastRefreshed` named range, and logs counts
   only.

## Sheet names: legacy → new

Reference sheets (hidden, mostly script-built):

| Legacy | New |
|---|---|
| `*Config*` | `ref_Config` |
| `*simpleSchedule*` | `ref_simpleSchedule` |
| `*SectionLookup*` | `ref_SectionLookup` |
| `*peopleList*` | `ref_peopleList` |
| `*assignmentGroups*` | `ref_assignmentGroups` |
| `*gradingPeriods*` | `ref_gradingPeriods` |
| `*gradingScale*` | `ref_gradingScale` |
| `*Index*` | `ref_Index` |
| `CourseIDs` | `ref_CourseIDs` |

`ref_CourseIDs` is built from Canvas by **Refresh course list** (A = course ID, B = course
name; your active teacher courses). The time of the last refresh is in the named range
`CourseIDs_LastRefreshed`. The `cfg_CourseName` formula (C4) must look up `ref_CourseIDs`.

User-facing tool sheets keep their names. Known so far: `JupiterExport`,
`Assignment Dates`, `rubricCanvasExport`, `API Batch` (a function checks the active
sheet's name, so keep it exactly).

## Config contents

**Keep every cell in its legacy position at first**, because sheet formulas point at
them. Add named ranges now; Lara will rearrange the layout only after everything is ported.

These twelve names match the Sheet's Named ranges panel exactly. All are on `ref_Config`.

| Name | Cell | Notes |
|---|---|---|
| `cfg_UserID` | B3 | Keep. Lara uses it in batch email and API-by-row |
| `cfg_CourseID` | B4 | Used by nearly every tool and by formulas on about 7 tool tabs |
| `cfg_CcEmail` | B5 | Keep. Same tools as `cfg_UserID` |
| `cfg_ThisSheetID` | B6 | Auto-written by the full data refresh; the Home index formula reads it |
| `cfg_MasterCalendarDocID` | D3 | Read by the `ref_simpleSchedule` formula (IMPORTRANGE) |
| `cfg_SchoolYearTab` | D5 | Same formula |
| `cfg_TimeSchoolStart` | B14 | Due-time dropdown choice, 24-hour value |
| `cfg_TimeSchoolEnd` | B15 | Due-time dropdown choice, 24-hour value |
| `cfg_TimeAfterSchool` | B16 | Due-time dropdown choice, 24-hour value |
| `cfg_TimeNight` | B17 | Due-time dropdown choice, 24-hour value |
| `cfg_JupiterCategories` | G:I | Whole columns, including the header row (G = Canvas category, H = export checkbox, I = Canvas group ID) |
| `cfg_CourseName` | C4 | Formula (lookup in `CourseIDs`), shown on tool tabs |

Other items:

- **Base URL** (legacy B2) moves to User Properties (`CANVAS_BASE_URL`), per `CLAUDE.md`.
- **Canvas token** moves to User Properties (`CANVAS_TOKEN`), per `CLAUDE.md`. The legacy
  code kept it in User Properties as `CANVAS_API_KEY`. Never in Config, never in Script
  Properties.
- **Jupiter categories** stay on `ref_Config` as `cfg_JupiterCategories` (G:I; H = Lara's
  checkboxes, I = group IDs; rebuilt from Canvas by `refreshJupiterCategories`, which
  preserves the checkmarks).
- **Seating chart** (legacy B7 and A8:C11). Port only if Lara confirms she uses it; B7 is
  empty in the current workbook.
- **Period Pairs** (legacy F2:F5). No reader found in code or formulas. Ask Lara.
- **Dropped:** Encyclopedia ID (B12) unless a Find for `Config` across the Sheet shows a
  formula using it; the column E checkboxes (nothing reads them).
- **Do not carry over** the legacy meanings of B6:B9 used by `createDropdowns()` (see below).

## Decisions on duplicated legacy functions

Legacy file load order is by file name, later copy wins (assumed from an empty
`filePushOrder`; Lara is verifying against the Apps Script editor sidebar).

- `getNextUrlLocal`: the copies are identical. Build one into the shared Canvas request
  helper's paging.
- `getPeriodNameFromId`: identical. Port the 01 copy into the shared helpers.
- `formatTime`, `getPeriodTimesForDate`: **not decided.** The older 09 copies are the ones
  that actually ran; the 01 copies are probably the intended ones. Decide when the
  time-dropdown tool is ported, after answering: what reads the dropdown values back, and
  what format do they expect? Port `createDropdowns1()` (01), not `createDropdowns()` (09).
  The 01 `getPeriodTimesForDate` calls a `logToSystem()` that doesn't exist; fix on port.

## Build order

Do one step at a time. For each: say what you plan, make a small change, run the scan,
show a review summary, wait for approval, commit.

1. **Folder and tag** (if not already done): tag `legacy-gradebook`; this folder with a
   README. No code yet.
2. **Read-only function map** saved as `course-manager-jupiter/docs/legacy-function-map.md`:
   for every legacy function, the file, a one-line purpose, which menu item calls it (menu
   items only; Home buttons are not listed), which sheets it touches, which Canvas endpoints it calls, and whether it writes to Canvas.
   Lara marks each row *port*, *later*, or *leave behind*.
3. **Foundation**, with no features yet:
   - config accessors by named range, and the startup check;
   - a one-time menu item, **"Set my Canvas token"**, that prompts for the token and stores
     it in User Properties (`CANVAS_TOKEN`) without displaying or logging it;
   - one Canvas request helper: auth header from User Properties, `muteHttpExceptions`,
     response-code check, `per_page=100`, paging by the `Link` header, back-off on low
     `X-Rate-Limit-Remaining`;
   - `canvasWrite_()` honoring a `DRY_RUN` Script Property that defaults to `true`;
   - `appsscript.json` with explicit, narrowest-possible `oauthScopes`.
4. **Reference sheets**, one at a time, each tested on its own:
   `ref_gradingScale` (copy as is), `ref_gradingPeriods` (the old copy is stale: still
   2025-26 dates and no "Grades Published" values, so this is the first real refresh test),
   `ref_SectionLookup`, `ref_peopleList`, `ref_assignmentGroups`.
5. **Assignment reorder** as its own *visible* tool sheet. `ref_assignmentGroups` stays a
   read-only snapshot; the tool sheet shows current order, lets Lara set a new order,
   previews the changes (dry run, counts only), and then pushes through `canvasWrite_()`.
   Verify the Canvas reorder endpoint in the official API docs before writing it. Test in a
   sandbox course first. This changes ordering only, never grades.

## Status

Update this list as each piece lands. "Tested" means Lara confirmed it in the Sheet.

- **Step 1 (folder and tag):** done.
- **Step 2 (function map):** done; Lara is filling in the Decision column.
- **Step 3 (foundation):**
  - done: explicit `oauthScopes`; `SHEETS`, `SHEETS_BUILT`, `CFG_NAMES`, `getCfg_()`
    (`Config.js`); startup check and "Check setup" (`SetupCheck.js`, tested);
    "Set Canvas token" (`Credentials.js`); `canvasGet_()` and "Test Canvas connection"
    (`CanvasApi.js`).
  - `canvasWrite_()` with `DRY_RUN`, plus "Dry run: show status" and "Dry run: switch
    on/off" (`CanvasApi.js`): built and tested (dry-run path only). Nothing calls it
    for real yet; the send path is first tested with the reorder tool, in a sandbox
    course.
  - The startup check covers the sheets in `SHEETS_BUILT`, not every name in `SHEETS`,
    so unbuilt sheets don't raise alerts.
- **Step 4 (reference sheets)**, all in `RefSheets.js`:
  - `ref_CourseIDs` ("Refresh course list"; stamp `CourseIDs_LastRefreshed`): built.
  - `ref_peopleList` ("Refresh people list"; stamp `PeopleList_LastRefreshed`): built.
    Ported from legacy `createPeopleList`; same nine columns and name formulas; all
    enrollment types; `state[]=active&invited`; now follows every page (legacy read
    only the first 100).
  - `ref_simpleSchedule` (IMPORTRANGE formula) and `ref_gradingScale` (copied as is):
    in the Sheet and in `SHEETS_BUILT`; no script builds them.
  - `ref_assignmentGroups` ("Refresh assignment groups"; stamp
    `AssignmentGroups_LastRefreshed`): built and tested. Same seven columns as
    legacy `createAssignmentGroupsList`, sorted by group order then position (legacy
    sorted by name); blank section due dates are skipped when finding the latest.
  - `ref_SectionLookup` ("Refresh section list"; stamp `SectionLookup_LastRefreshed`):
    built and tested.
  - `ref_Index` ("Refresh sheet index", also on open; `SheetIndex.js`): built and tested.
  - Design rules for reference sheets: recorded (see that section).
  - Shelved: `ref_gradingPeriods` (not needed for Jupiter).
- **Step 5 (assignment reorder):** 4a (tool sheet, numbering, Preview) built and
  tested; 4b (Push) built and tested (real Push in the test course).

## Open questions to resolve before or during the steps above

- In the old `assignmentGroups` data, the "Assignment ID" column did not match the ID in
  the Canvas URL on the same row. Find out which one the reorder call needs before
  step 5, and why they differ.
- What consumes the time-dropdown values (see duplicates above)?
- Does Lara use the seating-chart tool? What are Period Pairs for?
