# course-manager-jupiter — Project Brief

> **Where we left off (2026-10-16)**
>
> - **Built and tested in the Sheet:** `ref_Config` with its twelve `cfg_` named ranges;
>   `ref_CourseIDs` ("Refresh course list"); `ref_peopleList` ("Refresh people list");
>   token setup ("Set Canvas token", User Properties); the read-only Canvas request
>   helper `canvasGet_()` ("Test Canvas connection"); the startup check ("Check setup").
> - **Done 2026-10-17:** `ref_simpleSchedule` and `ref_gradingScale` added to
>   `SHEETS_BUILT`, so the startup check covers them (not yet tested in the Sheet).
> - **Next:**
>   1. Build `ref_gradingPeriods`.
>   2. `ref_SectionLookup`.
>   3. The assignment reorder tool, with `canvasWrite_()` and `DRY_RUN` built first.
> - **Open questions:**
>   - Assignment ID vs. the ID in the Canvas URL in the old `assignmentGroups` data:
>     which one does the reorder call need? (Answer before the reorder tool.)
>   - What reads the time-dropdown values back, and in what format?
>   - Does Lara use the seating chart? What are Period Pairs for?
>   - The "Design rules for reference sheets" section is not in this brief yet.
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
  - to do: `canvasWrite_()` with `DRY_RUN`.
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
  - to do: `ref_gradingPeriods`, `ref_SectionLookup`, `ref_assignmentGroups`.
- **Step 5 (assignment reorder):** not started.

## Open questions to resolve before or during the steps above

- In the old `assignmentGroups` data, the "Assignment ID" column did not match the ID in
  the Canvas URL on the same row. Find out which one the reorder call needs before
  step 5, and why they differ.
- What consumes the time-dropdown values (see duplicates above)?
- Does Lara use the seating-chart tool? What are Period Pairs for?
