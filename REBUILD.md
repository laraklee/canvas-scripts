# Rebuilding from Scratch

How to recreate every project in this repo if all you have is **this repo and a
brand-new Google account**. Last checked against the code on 2026-11-14.

This file holds no IDs, tokens, property values, or personal details. Where a value is
needed, it says where to get it. File and line references (`Code.js:102`) point at the
code that reads or writes each thing.

**Contents**

1. [Read this first](#1-read-this-first)
2. [Lives only in Google: save before you lose access](#2-lives-only-in-google-save-before-you-lose-access)
3. [General steps for any project](#3-general-steps-for-any-project)
4. [Rebuild order](#4-rebuild-order)
5. Projects: [master-calendar](#master-calendar) ·
   [assign-sheet](#assign-sheet) · [course-manager-jupiter](#course-manager-jupiter) ·
   [anonymize-submissions](#anonymize-submissions) · [gastronomy-badges](#gastronomy-badges) ·
   [calendar-filter](#calendar-filter) · [calendar-builder](#calendar-builder) ·
   [course-manager (legacy)](#course-manager-legacy-do-not-rebuild) · [gems](#gems-not-apps-script)
6. [Quick reference tables](#6-quick-reference-tables)

---

## 1. Read this first

- **The code is all here. Most of the Sheets are not.** Every project except
  `calendar-builder` is bound to a Google Sheet, and many tabs, formulas, and drawn
  buttons were built by hand in Google. The code cannot recreate them. Section 2 lists
  what to save while you still have access.
- **Every ID in the repo stops working on a new account.** That includes every
  `scriptId` in the `.clasp*.json` files and every Sheet, Doc, folder, and script ID
  written in a BRIEF. Treat them as history, not settings.
- **A personal Gmail account is not a school Workspace account.** Things that depend on
  the school domain will not carry over as they are:
  - `calendar-builder` is shared with `access: DOMAIN`, so only people in the same
    Workspace domain can open it.
  - The school calendars (bell schedule, faculty calendar) belong to the school.
  - Canvas tokens are tied to a Canvas account at a school.
- **Student data must not move to a personal account (FERPA).** Copy *templates*, never
  live workbooks with rosters, Key tabs, or grades. Templates already exist for
  `assign-sheet`, `course-manager-jupiter`, `anonymize-submissions`, and
  `calendar-filter`.
- **Some values live in the private notes repo** (`private/`, its own GitHub repo), not
  here. Today that's the calendar IDs and links for `calendar-builder` and
  `master-calendar`. Clone it too if you can; otherwise, find the values again with the
  steps in each project section.

---

## 2. Lives only in Google: save before you lose access

These exist only in the Google account (or in Canvas) and are **not** in this repo.

### Whole files with no copy in the repo

| What | Project | Why it matters |
|---|---|---|
| **MasterCalendar.LKL** Sheet: every year tab, `*schedule*`, `*Data Sched-Per*`, `*Data Drills*`, `*Config*` | master-calendar | No template exists, and the code builds only new year tabs. The schedule codes and period times were typed by hand from the school's PDF calendar. **No student data, so it's safe to copy.** |
| Template workbooks (scrubbed, view-only, `/copy` link) | assign-sheet, course-manager-jupiter, anonymize-submissions, calendar-filter | The quickest way to get every hand-built tab back. Make a copy in the new account, or download as `.xlsx` **outside this folder**. |
| Gastronomy Badges workbook | gastronomy-badges | No template. It holds student IDs, so don't copy it as-is. Write down the `*Config*` layout and the roster tab's layout (row 2 and column G; see the project section). |
| Q1–Q4 tabs and their A4/B2 formulas | assign-sheet | Not in the repo at all. The template has them. |
| `ref_simpleSchedule` IMPORTRANGE formula | course-manager-jupiter | The exact formula is not in the repo. The template has it. |
| `ref_Config` cell layout and named ranges, including `cfg_TermQuarters` | course-manager-jupiter | `cfg_TermQuarters`'s cell is not recorded anywhere in the repo. |
| `JupiterExport` tab (Jupiter's own import template) | course-manager-jupiter | Copied by hand from a Jupiter export. |
| Seating-chart Slides deck | course-manager-jupiter | Its ID goes in `cfg_SeatingDeckID`. |
| "Start Here" tab | anonymize-submissions | Typed by hand in each workbook. |

### Things inside Sheets that copies or the code don't bring back

- **Drawn buttons** (Insert › Drawing › Assign script). Copying a whole file keeps them,
  but "Bring over from my old copy" and the code can't. The function names they call are
  listed under each project.
- **Script and User Property values.** Copying a Sheet does **not** copy them. Each one
  must be entered again (see [Properties](#properties-all-projects)).
- **Installable triggers.** Only `calendar-filter` has one (nightly sync). Triggers
  belong to a person, not the file.
- **Web app deployments.** `calendar-builder`'s "Beta 1" deployment and its `/exec`
  link. A new account means a new script and a new link (link details are in the private
  notes repo).
- **Sharing settings, IMPORTRANGE permissions, and OAuth approvals.**

### Outside Google Sheets

- **Gemini `@grading` skill** and old Gems: the text is in `gems/`, but the live copies
  are in Gemini on the school account. The Flint activity also lives only in Flint.
- **Canvas setup** that `gastronomy-badges` relies on: an assignment group named exactly
  **"Etoilles in Canvas"** and grading periods with the quarter number in their titles.
- **The anonymize passphrase** (`ANON_PASSPHRASE`). If it's lost, new runs make
  different student codes. Old codes can still be matched only through existing Key
  tabs. Keep it in your password manager, never in this repo.
- **Retired items** you can ignore: the old Google Doc user guides and the
  "TeacherTools" Drive folder (replaced by the in-sheet `UserGuide.html` guides), the
  `faculty_master.ics` Drive file, and the legacy course-manager workbooks.

---

## 3. General steps for any project

### On the computer

1. Follow [SETUP.md](SETUP.md) (git, Node, gitleaks, `npm install`, hooks).
2. Install clasp: `npm install -g @google/clasp`.
3. Sign clasp into the **new** Google account: `clasp login`. This writes
   `~/.clasprc.json`. Never commit it or open it.
4. Turn on the Apps Script API for the new account:
   <https://script.google.com/home/usersettings>.

### For a Sheet-bound project (every project except calendar-builder)

1. **Get the Sheet.** Best: make a copy of the template (File › Make a copy keeps the
   bound script). Otherwise, make a new Sheet and build the tabs listed in the project
   section.
2. **Open the script:** Extensions › Apps Script. If you started from a blank Sheet,
   this creates a new bound script.
3. **Copy the Script ID:** in the script editor, Project Settings › IDs › Script ID.
4. **Point clasp at it:** put that ID in the project's `.clasp.json` (or the matching
   `.clasp-<name>.json`) as `"scriptId"`. Keep `"rootDir": ""`.
5. **Push the code:** from the project folder, `clasp push --force`. `--force` is needed
   the first time because the manifest (`appsscript.json`) changes. For a second copy,
   use `clasp push -P <full path to .clasp-<name>.json>`.
6. **Reload the Sheet**, run any menu item, and approve the permissions.
7. **Open Setup…** in the project's menu and enter the settings it asks for.

> Avoid `clasp create` for a Sheet-bound project. It replaces `appsscript.json` with a
> default one that has no `oauthScopes`. If you do use it, restore `appsscript.json` from
> Git (`git checkout -- appsscript.json`) before you push.

### Canvas token (every project that calls Canvas)

Canvas › Account › Settings › Approved Integrations › **+ New Access Token**. Paste it
into the project's **Setup…** panel. It's saved in that teacher's User Properties, never
in the Sheet or the code. When you leave a school, revoke the old tokens on the same
Canvas page.

---

## 4. Rebuild order

Some projects read others, so build in this order:

1. **master-calendar**. assign-sheet and course-manager-jupiter read its Sheet through
   IMPORTRANGE.
2. **assign-sheet** and **course-manager-jupiter**. Put the new master calendar's Sheet ID
   in each workbook's `*Config*` / `ref_Config`.
3. **anonymize-submissions**, **gastronomy-badges**, **calendar-filter**,
   **calendar-builder**. These don't depend on the others.

For projects with several copies (Biology, Gastronomy, AI9, template), set up Biology
first, test it, then the others, and the template last.

---

## 5. Projects

### master-calendar

**What it is:** the script bound to the **MasterCalendar.LKL** Sheet: one tab per school
year, one row per school day. It provides the custom function `GET_SCHEDULE_JSON` and
builds new year tabs from the school's public calendars. Other workbooks read this Sheet.

**Copies:** 1 (`.clasp.json`).

#### Sheet structure

The code builds only `Test` and new year tabs. **Everything else must already exist.**

| Tab | Built by code? | Layout |
|---|---|---|
| Year tab, named `YYYY.YYYY` (e.g. `2026.2027`) | By **Build year tab from calendars…** (`BuildYear.js:19-64`); it never overwrites one | Row 1 header, frozen. A Q (quarter), B Wk, C Date (`m" /"d"/ "yy`), D Day `=LEFT(TEXT(Cn,"ddd"),2)`, E Schedule code, F Periods `=IFERROR(VLOOKUP(En,'*Data Sched-Per*'!A:B,2,FALSE),"---")`, G *Data Drills* notes, H *AP Schedule*, I *JSON*: only I2 holds `=GET_SCHEDULE_JSON(E2:E, F2:F, '*schedule*'!A:D)`. Must stay within columns A–I. Rows that need review get a yellow fill and a note on E. |
| `*schedule*` | **No** | Row 1 header. A code, B period, C start, D end. Times are plain numbers like `940`, not time values. |
| `*Data Sched-Per*` (hidden) | **No** | Row 1 header. A code, B comma-separated periods. |
| `*Data Drills*` (hidden), `*Config*`, `*Calendar_Import*` | **No** | Not read by the current code; keep them for the other workbooks' shared layout. |
| `Test` | Yes, by **Preview a year (Test tab)…** | Columns A–I like a year tab, plus J Review and K "Differs from `<year>`". |

**Time zones:** the Sheet is set to Los Angeles time, and the script to
`Pacific/Honolulu`. `readYearTab_` depends on this pairing (see BRIEF). Keep it, or
retest column K.

#### Properties

| Store | Name | How to get the value |
|---|---|---|
| Script | `BELL_PERIODS_ICS_URL` | Google Calendar › "Bell Schedule with Periods" › Settings › **Public address in iCal format**. Set in **Master Calendar › Setup…** |
| Script | `FACULTY_ICS_URL` | Same steps, for the Faculty Calendar. Set in **Setup…** |

Both are school calendars. The current values are in the private notes repo
(`notes/master-calendar.md`).

#### Triggers, IDs, manifest, web app

- **Triggers:** simple `onOpen` (menu: Setup…, Build year tab…, Preview a year…, User
  guide). No installable triggers.
- **Hardcoded IDs:** none in code. The BRIEF lists the old Sheet and script IDs (dead on
  a new account). **Other workbooks store this Sheet's ID:** assign-sheet `*Config*` D3,
  and course-manager-jupiter `cfg_MasterCalendarDocID` (`ref_Config` D3). Update both.
- **appsscript.json:** `Pacific/Honolulu`, V8, `STACKDRIVER`. Scopes:
  `spreadsheets.currentonly`, `script.container.ui`, `script.external_request`. No
  advanced services.
- **Web app:** none. **External calls:** GET of the two ICS links only; no writes outside
  the Sheet.

#### Rebuild steps

1. Copy the old Sheet if you can. If not, build `*schedule*` and `*Data Sched-Per*` by
   hand using `UserGuide.html` sections 5–6.
2. Bind and push the script (Section 3). Set the Sheet's time zone (File › Settings).
3. **Setup…**: paste both iCal links, then Test links.
4. **Preview a year**, check the Test tab, then **Build year tab**. The next year must
   already be in the bell schedule calendar.
5. Put the new Sheet ID into the dependent workbooks' Config tabs.

`RefreshSchedule.js` is dead code (it needs a Drive scope the manifest no longer has).

---

### assign-sheet

**What it is:** the course "Assignment sheet" workbook. **Canvas Tools** menu: refreshes
the helper tabs that the Q1–Q4 tabs read from the master calendar, posts calendarEvents
rows to Canvas as calendar events or announcements, loads and sends assignment and
override dates, and has Setup… and "Bring over from my old copy".

**Copies:** 4 with identical code: Biology (`.clasp.json`), Gastronomy
(`.clasp-gastronomy.json`), AI9 (`.clasp-ai9.json`), template (`.clasp-template.json`).
Push in that order, template last.

#### Sheet structure

| Tab | Built by code? | Layout |
|---|---|---|
| `*Config*` | **No.** `getConfig()` stops if it's missing (`00_Config.js:76-80`) | B2 school Canvas address (only pre-fills Setup). B3 Canvas user ID. **B4 course ID** (digits; Setup writes it, refuses a formula). B5 CC email. **D3 master calendar Sheet ID. D5 school-year tab name** (e.g. `2026.2027`). E2:F5: E checkbox, F period-pair label (`1,2` `3,4` `5,6` `7,8`); none checked means all four. Same layout as every other workbook, so keep unused cells. |
| `Q1`–`Q4` | **No. Only in Google** | The code only re-sets the formulas in **A4 and B2** (`01_Utilities.js:99,127`), and those formulas exist only in the Sheet. Row 1 free; A–E filled from the master (don't type there); F–G lesson content; H check-off; I notes; J on free. Never insert rows, or columns in A–I. |
| `calendarEvents` | **No** | Header in **row 2**, data from row 3. A Calendar ☐, B Announcement ☐, C Title, D Body, E Calendar Date, F Delayed Post, G Replies? ☐, H event link, I announcement link. **C2 must be "Title" and D2 "Body"** or the tool won't run. Checkboxes are hand-made. |
| `*simpleSchedule*` | Yes, by **🔗 Reset Master connection** | A1: `=IMPORTRANGE('*Config*'!D3, '*Config*'!D5 & "!A:M")`. **Click A1 › Allow access** by hand once. |
| `*scheduleLookup*` | Yes | A–K: Quarter, Date, Week, Schedule, Periods, Times, 1,2, 3,4, 5,6, 7,8, Drills. G2:J2 use the custom function `getScheduleCount`. |
| `AssignmentMaster` | Yes | Quarter, Date, Day, ScheduleName, PeriodsString, then Key_/Text_ per period pair. |
| `AssignmentLookupFinal` | Yes | UniqueKey_DayCode, then "Period x,y" columns (ARRAYFORMULA VLOOKUP). |
| `Assignment Dates` | Yes, by **Load assignment dates** | Row 1 kept for drawn buttons; row 2 headers A–N (Update?, ID, Assignment Name, Sub. Type(s), Points, Open date/time, Schedule Info, Due date/time, Lock date/time, Sync Status, Override ID). Everything from row 2 down is rebuilt each time. |

Custom functions available to Sheet formulas: `getScheduleCount`, `getDayCodesByQuarter`,
`getAssignmentContent` (reads `*Data<pair>*` tabs), `getPeriodTimes` (reads a
`*schedule*` tab). Which hand-made formulas use them is recorded only in the Sheet.

**Drawn buttons** must call these exact function names:
`processUnifiedSheetForCanvasWithLinks` (calendarEvents), `fetchCanvasAssignmentDates`,
`pushAssignmentDatesToCanvas` (Assignment Dates row 1).

#### Properties

| Store | Name | How to get the value |
|---|---|---|
| User | `CANVAS_TOKEN` | Canvas token (Section 3). **Setup…** |
| User | `CANVAS_BASE_URL` | The start of your Canvas address bar, e.g. `https://yourschool.instructure.com`. **Setup…** (pre-filled from `*Config*` B2) |
| User | `CANVAS_TOKEN_SAVED` | Written automatically when the token is saved |
| Script | `DRY_RUN` | Preview mode. **Unset means ON**; only exactly `false` sends to Canvas. Set in Setup… part 4. ON in the template. |

#### Triggers, IDs, manifest, web app

- **Triggers:** simple `onOpen` only. Nothing to recreate.
- **Hardcoded IDs:** none in code. Replace in the Sheet: `*Config*` D3 (master calendar),
  B4 (course). The BRIEF's script and Doc IDs and the sandbox course number are history.
- **appsscript.json:** `Pacific/Honolulu`, V8, `STACKDRIVER`. Scopes:
  `spreadsheets.currentonly`, `script.container.ui`, `script.external_request`,
  `spreadsheets.readonly` (Bring over). Advanced service: **Sheets v4** (`Sheets`).
- **Web app:** none.
- **Canvas writes** (all through `canvasWrite_`, so preview mode applies):
  `POST /calendar_events`, `POST /courses/:c/discussion_topics` (announcements),
  `PUT /courses/:c/assignments/:id`, `POST`/`PUT`/`DELETE` on
  `/courses/:c/assignments/:id/overrides`.

#### Rebuild steps

1. Copy the template. If none, build `*Config*`, Q1–Q4 and calendarEvents by hand
   (the Q tabs' formulas can't be recovered from the repo).
2. Bind and push (Section 3).
3. **🔗 Reset Master connection**, click A1 › Allow access, then **🔄 Update schedule
   from Master**.
4. **Setup…**: address, token, course in B4; choose preview mode.
5. Redraw buttons and assign their function names.

Bring over can't copy charts, pivot tables, protected ranges, filter views, alternating
colors, drawn buttons, or pictures.

---

### course-manager-jupiter

**What it is:** the main Canvas course workbook for schools that grade in Jupiter
Grades. Creates assignments, quizzes and discussions (by row or with section dates),
reorders assignments, manages groups, pulls scores and posts comments, fills Jupiter's
grade template, runs course and quiz checks, backs up to Google Docs, builds a seating
chart and rubric CSV, and brings work over from an old copy.

**Copies:** 4: Biology (`.clasp.json`), AI9 (`.clasp-ai9.json`), Gastronomy
(`.clasp-gastronomy.json`), template (`.clasp-template.json`). Push Biology first, the
template last. No libraries (the school blocks them), so each copy carries its own code.
`09_TabRebuild.js` must stay identical to assign-sheet's; an offline check enforces it.

#### Sheet structure: reference tabs

Never rename these. On every open, a check warns until all 8 required tabs and all 12
`cfg_` named ranges exist.

| Tab | Built by code? | Layout |
|---|---|---|
| `ref_Config` | **No** | See named ranges below. |
| `ref_CourseIDs` | Yes | Course ID, Course name; stamp in E1 (`CourseIDs_LastRefreshed`). |
| `ref_peopleList` | Yes | A–I: Course ID, Course Name, Section ID, User ID, Sorted Name, Role, Email, Last Name, First Name (H, I formulas). Stamp L1. |
| `ref_assignmentGroups` | Yes | A–G: Assignment ID, Name, Group ID, Group Name, Position, Due Date (ISO), Canvas URL. Stamp J1. |
| `ref_SectionLookup` | Yes | A–D: Section ID, Section Name, Period (from "(P#)" in the name), Section ID Copy. Stamp G1. |
| `ref_Index` | Yes, on every open | Title A1, headers row 3 (Sheet Name / Link / GID). Also writes `cfg_ThisSheetID`. |
| `ref_simpleSchedule` | **No. Formula only in Google** | A hand-typed IMPORTRANGE from the master calendar using `cfg_MasterCalendarDocID` and `cfg_SchoolYearTab`. Code reads A quarter, C date, E schedule code (H/PD = no school), G note, I periods JSON. Approve the IMPORTRANGE link once. |
| `ref_gradingScale` | **No** | Copied from legacy; nothing reads it, but it must exist. |

`ref_` tabs are red; the Canvas-built ones are hidden after each refresh. A builder stops
with an error rather than overwrite a tab whose header row doesn't match.

**`ref_Config` named ranges** (cells from the BRIEF; 12 required):

| Named range | Cell | Holds |
|---|---|---|
| `cfg_UserID` | B3 | Canvas user ID |
| `cfg_CourseID` | B4 | Course ID (Setup writes it) |
| `cfg_CcEmail` | B5 | CC email (not read by code) |
| `cfg_ThisSheetID` | B6 | Written automatically |
| `cfg_CourseName` | C4 | Formula looking the course up in `ref_CourseIDs` |
| `cfg_MasterCalendarDocID` | D3 | **master-calendar Sheet ID** |
| `cfg_SchoolYearTab` | D5 | Year tab name, e.g. `2026.2027` |
| `cfg_TimeSchoolStart` / `End` / `AfterSchool` / `Night` | B14–B17 | Due-time choices, 24-hour |
| `cfg_JupiterCategories` | G:I (whole columns) | Header `Canvas category \| Export to Jupiter? \| Canvas group ID`; rows rebuilt by code; H checkboxes ticked by hand |

Optional: `cfg_SeatingDeckID` (B7, Slides deck ID), `cfg_SeatingPeriods` (A8:C11: period,
color, slide), `cfg_TermQuarters` (e.g. `2`, `1-2`, `1-4`; **cell not recorded in the
repo**). Unnamed B2 holds the school's Canvas address (pre-fills Setup only).

#### Sheet structure: tool tabs

- **Built by code:** `Assignment Order`, `Course Check`, `Quiz Check`, `Quiz Check
  detail`, `Quiz report`, `Quiz export report`, `rubricCanvasExport`.
- **Hand-made, never built by code:**
  - `createByRow` (exact name): labels in row 3, data from row 4; columns found by label.
  - `makeAssignment` copies (any name): label-defined mini-tables Item, Item second row,
    Overrides, optional Questions.
  - `createGroups` (exact name): A2 `=cfg_CourseID`, C2 category name; row 4 headers
    `GroupID`, `Group Names`; data from row 5.
  - A grading sheet (e.g. "Comments"): A1 `Last Jupiter Sync:`, row 2 labels User
    ID/Name/Period/Section Name/Email in A–E, F = Jupiter ID typed by hand, students from
    row 3; row 2 of a score column holds the assignment ID.
  - `JupiterExport`: **Jupiter's own import template, pasted in.** The code refuses to
    run without it.
  - Export-to-Docs tab, list-groups tab, rubric template tab (labels in column A).
  - **Home** tab with a formula over `ref_Index` and **drawn buttons**.

**Drawn buttons** call these exact names: `postRows`, `makeAssignmentAll`,
`createDropdowns1`, `clearCreationIDs`, `createActiveSheetRoster`,
`buildJupiterExportFromRecentCanvasGrades`, `refreshAllTables`, `refreshSheetIndex`,
`refreshJupiterCategories`.

#### Properties

| Store | Name | How to get the value |
|---|---|---|
| User | `CANVAS_TOKEN` | Canvas token (Section 3). **Setup…** |
| User | `CANVAS_BASE_URL` | Your Canvas address. **Setup…** (pre-filled from `ref_Config` B2) |
| User | `CANVAS_TOKEN_SAVED` | Automatic |
| Script | `DRY_RUN` | Preview mode. **Unset means ON**; only exactly `false` sends. Setup… part 4. Shared by everyone using that workbook. |

#### Triggers, IDs, manifest, web app

- **Triggers:** simple `onOpen` only (menu, preview-mode notice, rebuild `ref_Index`,
  setup check). No installable triggers, by decision.
- **Hardcoded IDs:** none in code. Replace in the Sheet: `cfg_MasterCalendarDocID`,
  `cfg_SeatingDeckID`, `cfg_CourseID`, `cfg_UserID`, `cfg_CcEmail`, B2. Hand-typed links on
  the Home tab may point at the old workbook's address.
- **appsscript.json:** `Pacific/Honolulu`, V8, `STACKDRIVER`. Scopes:
  `spreadsheets.currentonly`, `script.container.ui`, `script.external_request`,
  `presentations` (seating chart), `drive.file` (Docs export), `spreadsheets.readonly`
  (Bring over). Advanced services: **Drive v3** (`Drive`), **Sheets v4** (`Sheets`). If a
  call fails with `accessNotConfigured`, turn the service on in the editor (Services +).
- **Web app:** none.
- **Canvas writes** (all through `canvasWrite_`, preview mode applies): create
  assignments, discussions, Classic and New Quizzes and their questions/items, assignment
  overrides; `PUT` assignment position only; create group categories and groups, add and
  remove group members; `PUT` submission **comments only**. No grade writes.

#### Rebuild steps

1. master-calendar first.
2. Copy the template. Otherwise build `ref_Config` with exact cells and all named ranges
   (G:I as whole columns), `ref_simpleSchedule`, `ref_gradingScale`, and the hand-made
   tool tabs.
3. Bind and push with `--force` (Section 3). Authorize.
4. **Setup…**: token, address, course. Then **Refresh tables › All**.
5. Refresh Jupiter categories separately (not part of "All") and tick the checkboxes.
6. Paste Jupiter's import template into `JupiterExport`. Redraw buttons.
7. Each copy needs its own authorization, token, `cfg_CourseID`, and `cfg_TermQuarters`.

---

### anonymize-submissions

**What it is:** renames a Canvas "Download Submissions" set (or a quiz Student Analysis
CSV) already in Drive to coded names (`S-XXXXXX`), keeps a Key tab that maps codes back
to students, and later matches pasted AI grading results to students. **Does not call
Canvas.**

**Copies:** 4: AI9 (`.clasp.json`, the original), Biology (`.clasp-biology.json`),
Gastronomy (`.clasp-gastronomy.json`), template (`.clasp-template.json`, pushed last).

#### Sheet structure

| Tab | Built by code? | Layout |
|---|---|---|
| `Index` | Yes, if missing | A1 "Course folder link:", **B1 = link to the course's AI-grading Drive folder**. Row 3 headers (frozen), data from row 4: A Folder, B Short name, C Quiz/Assignment ID (typed), D Anonymized, E Matched, F Folder ID. |
| `<short name> Key` | Yes | Name, Canvas user ID, Assignment ID, Code, Original filename, Late, Anonymized filename. **The only way back from code to student.** |
| `<short name> AI` | Yes | Code, Score, Feedback, Confidence, Notes (quizzes: Code, Question, Group, Why, Notes). |
| `<short name> Flagged` | Yes, when needed | Assignment ID, File, Reason. |
| `<short name> Review` | Yes, on every Match | Name, Code, Score/Question, Feedback/Group, Confidence/Why, Notes, Problem, Reviewed (checkboxes). Quiz Reviews get a band rule the code adds. |
| `Start Here` | **No** | Hand-made instructions. |

Drawn buttons (if any) call `refreshFolderList`, `anonymizeSelectedRow`,
`matchSelectedRow`. In Drive, Anonymize creates an `anonymized` subfolder in each
assignment folder.

#### Properties

| Store | Name | How to get the value |
|---|---|---|
| User | `ANON_PASSPHRASE` | **You make it up** (12+ characters) in **Anonymize › ⚙️ Setup…**. Keep it in your password manager. The same passphrase gives the same codes; the 4-character check code in Setup confirms a match. |
| Document | `ASSIGNMENT_NAME_<assignmentId>` | Written automatically, used only to spot renames. Losing it is harmless. |

#### Triggers, IDs, manifest, web app

- **Triggers:** simple `onOpen` only.
- **Hardcoded IDs:** none in code. The BRIEF lists old template and script IDs (dead).
- **appsscript.json:** `Pacific/Honolulu`, V8, `STACKDRIVER`. Scopes:
  `spreadsheets.currentonly`, `script.container.ui`, and full **`drive`**. `drive` is a
  deliberate exception: `drive.file` can't read a pasted folder link. No
  `script.external_request` (it fetches nothing).
- **Web app / Canvas:** none.

#### Rebuild steps

1. Copy the template. Bind and push (Section 3). Approve the `drive` permission.
2. **Setup…**: enter the passphrase in each copy.
3. Paste the course folder link in Index B1, **Refresh folder list**, type the IDs.
4. Recreate the Start Here tab by hand.

Codes depend on whose account runs the script and on the passphrase. An old folder whose
`anonymized` subfolder has files but no Key rows in this workbook will be refused.

---

### gastronomy-badges

**What it is:** pulls Gastronomy assignment scores and quarterly "Etoilles" (star badge)
totals from Canvas into a roster tab. Read-only.

**Copies:** 1 (`.clasp.json`). **No template.**

#### Sheet structure

| Tab | Built by code? | Layout |
|---|---|---|
| `*Config*` | **No.** `getConfig` stops if it's missing | B2 school Canvas address (pre-fills Setup only). **B4 course ID.** A6/B6 this Sheet's ID (written by the full refresh). Keep B3, B5, D3, D5, B12 for the shared layout (read but unused). Usually hidden. |
| `*peopleList*` | Yes | A–I like jupiter's `ref_peopleList`. Holds student data. |
| `*assignmentGroups*` | Yes | A–G like jupiter's `ref_assignmentGroups`. |
| Roster tab (any other name) | **No** | B1 last-run time. **Row 2, C–F = Canvas assignment IDs. G2 = quarter** (`2` or `Q2`). **Column B from row 3 = Canvas user IDs.** C–F from row 3 = scores (written). G from row 3 = Etoilles total (written). A and H on are yours (names etc.). |

**Canvas must have:** an assignment group named exactly **"Etoilles in Canvas"**, and
grading periods whose titles include the quarter number.

#### Properties

| Store | Name | How to get the value |
|---|---|---|
| User | `CANVAS_TOKEN` | Canvas token. **Canvas Tools › Setup…** |
| User | `CANVAS_BASE_URL` | Your Canvas address. **Setup…** (pre-filled from `*Config*` B2) |
| User | `CANVAS_TOKEN_SAVED` | Automatic |
| User | `CANVAS_API_KEY` | Legacy name; moved to `CANVAS_TOKEN` and deleted automatically. Nothing to set. |

No `DRY_RUN` (no writes).

#### Triggers, IDs, manifest, web app

- **Triggers:** simple `onOpen` only. "Update Etoilles" runs from the menu (maybe a
  drawn button too).
- **Hardcoded:** no IDs. The group name "Etoilles in Canvas" is hardcoded and must
  match Canvas. The BRIEF's script, Doc, and folder IDs are dead.
- **appsscript.json:** `Pacific/Honolulu`, V8, `STACKDRIVER`. Scopes:
  `spreadsheets.currentonly`, `script.container.ui`, `script.external_request`.
- **Web app:** none. **Canvas:** GET only.

#### Rebuild steps

1. New Sheet. Build `*Config*` by hand with the shared layout (B2, B4).
2. Bind and push (Section 3). Authorize. **Setup…**.
3. **Run FULL Data Refresh** (writes B6 and builds `*peopleList*` and
   `*assignmentGroups*`, which give you the user and assignment IDs).
4. Build the roster tab: B from row 3, C2:F2, G2. Then **Update Etoilles**.

---

### calendar-filter

**What it is:** **School Calendar** menu in a Sheet. Reads the faculty calendar into
tabs, lets you pick titles and keep/hide words, then syncs the kept events into a
separate Google Calendar of your own. (CLAUDE.md's description, "exports a new ICS", is
out of date.) Doesn't call Canvas.

**Copies:** 2: your own Sheet (`.clasp.json`) and a template (`.clasp-template.json`).

#### Sheet structure

**Every tab is built by code.** **Set up / repair tabs** runs by itself when Start Here is
missing.

| Tab | Layout |
|---|---|
| `Start Here` | Settings in rows 4–8 (A label, B value, C help): B4 Copy FROM (calendar ID or ICS link), B5 Copy TO (calendar name; default "Faculty Calendar (filtered)"), B6 on or after, B7 on or before, **B8 Preview only** (checkbox, default on). |
| `Pick Titles` | A Pick ☐, B Title, C Events, D Next date, E Example location, F Status. Picks kept on refresh. |
| `Keep & Hide Words` | A keep words, B hide words. |
| `Events` | A Override (Keep/Hide), B Will sync, C Why, D Title, E Start, F End, G Location, H Description, I All day, J UID (I, J hidden). Overrides kept by UID. |
| `Sync Preview` | Action, Title, Start, End, Location, "Now in your calendar as". |
| `My Calendars` | Calendar name, Calendar ID, Mine?, Shown? |

#### Properties

None. All settings are on the Start Here tab.

#### Triggers, IDs, manifest, web app

- **Triggers:** simple `onOpen`. **Installable:** `nightlyRefreshAndSync`, daily about
  3 a.m. Created by **Turn on nightly refresh + sync**, removed by **Turn off…**. Each
  person turns it on again after a rebuild.
- **Hardcoded ID: `DEFAULT_SOURCE` (`Code.js:16`)** is the school faculty calendar's ID
  (an `@import.calendar.google.com` subscription), and `Code.js:19` is its old ICS link
  (used only to migrate old settings). On a new account, type your own source in
  Start Here B4, or change `DEFAULT_SOURCE`.
- **appsscript.json:** `Pacific/Honolulu`, V8, `STACKDRIVER`. Scopes:
  `spreadsheets.currentonly`, `script.container.ui`, `script.external_request`,
  `script.scriptapp` (the nightly trigger), full `calendar`.
- **Web app:** none. The web version moved to calendar-builder.
- **Calendar writes:** creates the Copy TO calendar if missing; creates, deletes, and tags
  events (`schoolCalendarUid`, `schoolCalendarHash`). "Preview only" (B8) is the dry run.

#### Rebuild steps

1. New Sheet (or copy the template). Bind and push. Reload: tabs build themselves.
2. Subscribe to the faculty calendar in Google Calendar. Put its ID or ICS link in B4.
3. Refresh, pick titles, Preview, then uncheck Preview and Sync.
4. Turn on the nightly sync if wanted.

The school calendar keeps only about a month of past events. Its ICS link has returned
HTTP 429 (too many requests) to Apps Script before.

---

### calendar-builder

**What it is:** "Faculty Calendar Builder (pilot)", a **standalone web app**. A teacher
picks bell-schedule periods (and can rename them) and faculty-calendar events, then
syncs them into their own Google Calendar or downloads an .ics file. **A colleague also
edits this script in Google**, so `clasp pull` and `git diff` first (see its BRIEF).

**Copies:** 1 (`.clasp.json`). No Sheet.

#### Properties

| Store | Name | How to get the value |
|---|---|---|
| Script | `BELL_SCHEDULE_ID` | Google Calendar › the bell schedule calendar › Settings › Integrate calendar › **Calendar ID**. The calendar must be **public** (the code builds its public ICS link). Set by hand in the editor (Project Settings › Script Properties). **Paste** the name; a typed one failed once. |
| Script | `FACULTY_CALENDAR_ID` | Same steps, for the faculty calendar. Each user must have it in their own calendar list. An `@import…` ID may not open for anyone else. |
| User | `BUILDER_CHOICES` | Written by the app (each teacher's picks). Nothing to set. |
| User | `BUILDER_LAST_CALENDARS` | Written by the app. Nothing to set. |

Current values are in the private notes repo.

#### Triggers, IDs, manifest, web app

- **Triggers:** `doGet` only. Syncing is manual by decision.
- **Hardcoded:** no calendar IDs in code. Calendar names "My Classes" and "School
  Events". **The default date range is hardcoded to 2026-08-01 – 2027-06-30**
  (`Settings.js:29-30` and `Page.html:269,273`), and `SYSTEM_REVISION_DATE` (`Code.js:23`) is edited by hand.
- **appsscript.json:** `Pacific/Honolulu`, V8, `STACKDRIVER`. Scopes:
  `script.external_request`, full `calendar`. **`webapp`: `executeAs: USER_ACCESSING`,
  `access: DOMAIN`.**
- **Web app deployments:** "Beta 1" (made with `clasp deploy`, used by colleague
  testers) and a test deployment (`@HEAD`). The `/exec` link and deployment ID are in the
  private notes repo. To update the beta, redeploy the **same** deployment ID with a new
  version; don't make a new deployment.
- **Calendar writes:** after a preview and Confirm only: creates "My Classes" / "School
  Events" if missing; creates, deletes, and tags events. No `DRY_RUN`; the preview is the
  safeguard.

#### Rebuild steps

1. Make a new standalone script (script.google.com › New project). Put its ID in
   `.clasp.json`. `clasp push --force`.
2. Set the two Script Properties.
3. Deploy › New deployment › Web app (or `clasp deploy`). Send testers the **new**
   `/exec` link.
4. On a personal Gmail account, `access: DOMAIN` won't let colleagues in. Decide on
   `MYSELF` or a new domain before sharing. (CLAUDE.md: never `ANYONE` without deciding
   on purpose.)

---

### course-manager (legacy): do not rebuild

The retired original workbook script, kept only as history (Git tag `legacy-gradebook`).
Everything still needed was moved to `assign-sheet` and `course-manager-jupiter`; see
`course-manager-jupiter/docs/legacy-function-map.md`. It breaks today's rules (no
`DRY_RUN`, no `oauthScopes`, scattered Canvas writes, address read from the Sheet), so
don't push it to a new account.

---

### gems (not Apps Script)

`gems/` holds the text of Gemini Gems and the `@grading` skill (`gems/grading/SKILL.md`),
plus `MIGRATION.md`. To rebuild: make a new Gemini skill and paste in `SKILL.md`. The
Flint activity has to be rebuilt in Flint by hand (draft in `MIGRATION.md`).

---

## 6. Quick reference tables

### Properties (all projects)

Names only. Never put values in this repo.

| Project | User Properties | Script Properties | Document Properties |
|---|---|---|---|
| master-calendar | — | `BELL_PERIODS_ICS_URL`, `FACULTY_ICS_URL` | — |
| assign-sheet | `CANVAS_TOKEN`, `CANVAS_BASE_URL`, `CANVAS_TOKEN_SAVED` | `DRY_RUN` | — |
| course-manager-jupiter | `CANVAS_TOKEN`, `CANVAS_BASE_URL`, `CANVAS_TOKEN_SAVED` | `DRY_RUN` | — |
| anonymize-submissions | `ANON_PASSPHRASE` | — | `ASSIGNMENT_NAME_<id>` (automatic) |
| gastronomy-badges | `CANVAS_TOKEN`, `CANVAS_BASE_URL`, `CANVAS_TOKEN_SAVED` | — | — |
| calendar-filter | — | — | — |
| calendar-builder | `BUILDER_CHOICES`, `BUILDER_LAST_CALENDARS` (automatic) | `BELL_SCHEDULE_ID`, `FACULTY_CALENDAR_ID` | — |

### Scopes and manifest settings

All scopes start with `https://www.googleapis.com/auth/`. Every manifest uses
`timeZone: Pacific/Honolulu`, `runtimeVersion: V8`, `exceptionLogging: STACKDRIVER`.

| Project | oauthScopes | Advanced services | Web app |
|---|---|---|---|
| master-calendar | `spreadsheets.currentonly`, `script.container.ui`, `script.external_request` | — | — |
| assign-sheet | `spreadsheets.currentonly`, `script.container.ui`, `script.external_request`, `spreadsheets.readonly` | Sheets v4 | — |
| course-manager-jupiter | `spreadsheets.currentonly`, `script.container.ui`, `script.external_request`, `presentations`, `drive.file`, `spreadsheets.readonly` | Drive v3, Sheets v4 | — |
| anonymize-submissions | `spreadsheets.currentonly`, `script.container.ui`, `drive` | — | — |
| gastronomy-badges | `spreadsheets.currentonly`, `script.container.ui`, `script.external_request` | — | — |
| calendar-filter | `spreadsheets.currentonly`, `script.container.ui`, `script.external_request`, `script.scriptapp`, `calendar` | — | — |
| calendar-builder | `script.external_request`, `calendar` | — | `USER_ACCESSING`, `DOMAIN` |

### Triggers

| Project | Simple | Installable (recreate by hand) |
|---|---|---|
| calendar-filter | `onOpen` | `nightlyRefreshAndSync`, daily ~3 a.m., via menu **Turn on nightly refresh + sync** |
| calendar-builder | `doGet` | — |
| All others | `onOpen` | — |

### Values to replace after a rebuild

| Where | What |
|---|---|
| Every `.clasp*.json` | `scriptId` of the new script |
| assign-sheet `*Config*` D3, D5 | New master-calendar Sheet ID; year tab name |
| course-manager-jupiter `cfg_MasterCalendarDocID`, `cfg_SchoolYearTab` | Same |
| course-manager-jupiter `cfg_SeatingDeckID` | New Slides deck ID |
| `*Config*` / `ref_Config` B2, B4 (all Canvas workbooks) | School Canvas address; course ID |
| calendar-filter `Code.js:16` `DEFAULT_SOURCE` (or Start Here B4) | Source calendar |
| calendar-builder `Settings.js:29-30`, `Page.html:269,273` | Default date range (school year) |
| calendar-builder testers | New `/exec` link |
