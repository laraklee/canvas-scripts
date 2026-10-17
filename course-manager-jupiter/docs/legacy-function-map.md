# Legacy function map: `course-manager`

A read-only map of every function in the legacy `course-manager` project (tag
`legacy-gradebook`), built from the code only. Nothing in the workbook was opened.

**How to use it:** fill in the **Decision** column with *port*, *later*, or *leave behind*.

**Columns**

- **Menu item**: where it appears in the `Canvas Tools` (CT) or `Setup & Admin` (SA) menu.
  "—" means it is not on a menu: it is called by other code, run from a sheet button,
  or unused (see Notes). Home buttons are not listed.
- **Sheets**: sheets the function reads or writes. "active" means whatever sheet you are on.
- **Canvas endpoints**: paths after `/api/v1`, with `:course` for the Config course ID.
- **Writes?**: **YES** if it changes data in Canvas (POST/PUT/DELETE). None of them write grades.

## 00_Config.js: menu and settings

| Function | Purpose | Menu item | Sheets | Canvas endpoints | Writes? | Notes | Decision |
|---|---|---|---|---|---|---|---|
| `onOpen` | Builds both menus; runs `refreshIndex` first | (runs on open) | `*Index*` (via refreshIndex) | — | no | | |
| `getConfig` | Reads Config cells B2–B5, D3, D5, B12 into one object | — | `*Config*` | — | no | Used by nearly every Canvas tool | |
| `setUserProperties` | Prompts for the Canvas token and saves it in User Properties (`CANVAS_API_KEY`) | SA › 1. Set API Key and Base URL | `*Config*` (B2, shown in prompt) | — | no | Shows the first 4 characters of the token | |

## 01_Utilities.js: shared helpers

| Function | Purpose | Menu item | Sheets | Canvas endpoints | Writes? | Notes | Decision |
|---|---|---|---|---|---|---|---|
| `createDropdowns1` | Builds due-time dropdowns (F7:F11) from Config B14:B17 and the day's period times | — | active, `*Config*`, `*simpleSchedule*` | — | no | Newer version; see duplicates in BRIEF | |
| `getPeriodTimesForDate` | Finds a period's start/end time for a date in `*simpleSchedule*` | — | `*simpleSchedule*` | — | no | **Shadowed** by the 09 copy; calls missing `logToSystem` | |
| `formatTime` | Formats 815 / Date as "8:15 AM" | — | — | — | no | **Shadowed** by the 09 copy | |
| `checkGlobalScriptProperties` | Logs which keys exist in Script Properties | — | — | — | no | Not called anywhere | |
| `getPeriodNameFromId` | Looks up a period name from a section ID | — | `*SectionLookup*` | — | no | Duplicate of the 03c copy (identical) | |
| `getCanvasTimestamp` | Validates a date, then calls `convertToUTC` | — | — | — | no | Not called anywhere | |
| `logResponse` | Writes an API response code and body to columns D–E of a row | — | active (`API Batch`) | — | no | Used by `performCanvasApiOperation` | |
| `getPeriodTimes` | Finds period times by schedule name | — | `*simpleSchedule*` | — | no | Not called anywhere | |
| `parseTimeValue` | Turns a time cell into a Date | — | — | — | no | Not called anywhere | |
| `convertToUTC` | Turns a sheet date + HHMM time into a Canvas UTC timestamp (Hawaii-safe) | — | — | — | no | Logs the times it builds | |
| `toggleSelectedCheckboxes` | Checks or unchecks every checkbox in the selection | SA › Email & Dev Tools › Toggle Selected Checkboxes | active | — | no | | |
| `convertRichTextToHtml` | Turns a rich-text cell into simple HTML for email | — | active | — | no | Used by `sendEmailsToSelected` | |
| `writeCurrentSpreadsheetIdToConfig` | Writes this spreadsheet's ID to Config B6 and a label to A6 | — | `*Config*` | — | no | Step 1 of Full Data Refresh | |

## 02_APIRunner.js: batch requests

| Function | Purpose | Menu item | Sheets | Canvas endpoints | Writes? | Notes | Decision |
|---|---|---|---|---|---|---|---|
| `sendCanvasRequest` | Sends one POST and puts a link or error in a status cell | — | active | (whatever URL it is given) | **YES** | Helper for the function below | |
| `processUnifiedSheetForCanvasWithLinks` | For selected rows, creates calendar events and/or announcements | CT › 4. Rubric Layouts › Batch Calendar/Announce (Selected Rows) | active | `POST /calendar_events`, `POST /courses/:course/discussion_topics` (announcement) | **YES** | | |
| `performCanvasApiOperation` | Runs any GET/POST/PUT/DELETE typed in the sheet, follows paging, can write results to a named sheet | — | `API Batch`, sheet named in column F (created if missing) | any endpoint typed in the row | **YES** (any) | Must be run on `API Batch`; sends whatever is typed | |
| `parseCombinedJsonToSheet` | Turns JSON pages into a table on a sheet | — | target sheet | — | no | | |
| `getNextUrl` | Reads the next-page URL from the `Link` header | — | — | — | no | A third copy of the paging helper | |

## 03a_Assign_Core.js: create assignments, quizzes, discussions

All of these read the assignment builder layout on the active sheet (row 3 = item, rows 7–11 = section overrides).

| Function | Purpose | Menu item | Sheets | Canvas endpoints | Writes? | Notes | Decision |
|---|---|---|---|---|---|---|---|
| `makeAssignmentAll` | Runs `postOneAssignment`, then `createOverrides1` | CT › 3. Content Creation › A. Create All | active | (see below) | **YES** | | |
| `postOneAssignment` | Creates one assignment from row 3; writes its ID and link back | — | active | `POST /courses/:course/assignments` | **YES** | | |
| `generateDescription` | Builds the HTML description from link cells and H4:H6 | — | active | — | no | | |
| `createOverrides1` | Creates section date overrides from column O (rows 7–11) | — | active | `POST /courses/:course/assignments/:id/overrides` | **YES** | | |
| `postOneNewQuiz` | Creates a New Quiz shell from row 3 | — | active | `POST /api/quiz/v1/courses/:course/quizzes` | **YES** | Calls `convertToUTC` with one argument (no time) | |
| `createQuizWithOverrides` | Runs `postOneNewQuiz`, then `createOverrides1` | CT › 3. Content Creation › Create New Quiz | active | (see above) | **YES** | | |
| `postOneNewDiscussion` | Creates a graded discussion from row 3 | — | active | `POST /courses/:course/discussion_topics` | **YES** | Uses `config.CourseID` (alias) | |
| `createDiscussionWithOverrides` | Runs `postOneNewDiscussion`, then `createOverrides1` | CT › 3. Content Creation › Create Graded Discussion | active | (see above) | **YES** | | |
| `postOneClassicQuizWithOverrides` | Creates a Classic Quiz shell, then runs `createOverrides1` | CT › 3. Content Creation › Create Classic Quiz | active | `POST /courses/:course/quizzes` | **YES** | | |

## 03b_Assign_UI.js: quiz questions and row-by-row posting

| Function | Purpose | Menu item | Sheets | Canvas endpoints | Writes? | Notes | Decision |
|---|---|---|---|---|---|---|---|
| `getCanvasQuizId` | Looks up the Classic Quiz ID for the assignment in A3; writes it to O3 | — | active | `GET /courses/:course/assignments/:id` | no | Not on a menu (button?) | |
| `addQuestionsToClassicQuiz` | Posts questions from A15:J to the quiz in O3; updates instructions | CT › 3. Content Creation › Add Questions to Classic Quiz | active | `POST /courses/:course/quizzes/:quiz/questions` | **YES** | | |
| `updateQuizInstructions` | Replaces a Classic Quiz's description | — | — | `PUT /courses/:course/quizzes/:quiz` | **YES** | | |
| `buildQuestionPayload` | Builds the JSON for one quiz question | — | — | — | no | | |
| `postRows` | For each selected row, creates the type in column B (A, D, NQ, CQ) | — | active | (via the four below) | **YES** | Not on a menu (button?) | |
| `postSingleAssignment` | Creates one assignment from a row | — | active | `POST /courses/:course/assignments` | **YES** | | |
| `postSingleDiscussion` | Creates one discussion from a row | — | active | `POST /courses/:course/discussion_topics` | **YES** | | |
| `postSingleNewQuiz` | Creates one New Quiz from a row | — | active | `POST /api/quiz/v1/courses/:course/quizzes` | **YES** | | |
| `postSingleClassicQuiz` | Creates one Classic Quiz shell from a row | — | active | `POST /courses/:course/quizzes` | **YES** | | |
| `generateDescription2` | Builds the HTML description from a row | — | — | — | no | | |

## 03c_Assign_Misc.js: load and edit an existing assignment

| Function | Purpose | Menu item | Sheets | Canvas endpoints | Writes? | Notes | Decision |
|---|---|---|---|---|---|---|---|
| `fetchAssignment` | Loads the assignment in A3 (and its overrides) into the editor | CT › 3. Content Creation › B. Load Assignment for Editing | active | (via the fetch helpers below) | no | | |
| `updateAssignmentInCanvas` | Sends the edited assignment and overrides back (reads column O formulas) | CT › 3. Content Creation › C. Update Existing Assignment | active | (via the two update helpers below) | **YES** | | |
| `resetAssignmentEditor` | Clears the editor and restores its formulas | — | active | — | no | Not on a menu (button?) | |
| `injectInfrastructureFormulas` | Writes lookup formulas into A3, E3, and rows 7–11 | — | active | — | no | Formulas point at `*assignmentGroups*`, `*SectionLookup*`, `*simpleSchedule*` | |
| `updateCanvasEntity` | Updates one assignment | — | — | `PUT /courses/:course/assignments/:id` | **YES** | | |
| `updateOverridesFromColO` | Creates or updates overrides from column O | — | active | `POST` or `PUT /courses/:course/assignments/:id/overrides[/:override]` | **YES** | | |
| `populateEditSheetWithAssignmentData` | Writes a loaded assignment and its overrides into the editor | — | active, `*SectionLookup*` | (via `fetchAssignmentOverrides`) | no | | |
| `getPeriodNameFromId` | Looks up a period name from a section ID | — | `*SectionLookup*` | — | no | The copy that runs (identical to 01) | |
| `fetchAssignmentFromCanvas` | Gets one assignment | — | — | `GET /courses/:course/assignments/:id` | no | | |
| `fetchAssignmentOverrides` | Gets an assignment's overrides | — | — | `GET /courses/:course/assignments/:id/overrides` | no | | |
| `clearCreationIDs` | Clears A3 and the override IDs in A7:A11 | — | active | — | no | Not on a menu (button?) | |

## 03d.AssignmentDates.js: bulk date editing

| Function | Purpose | Menu item | Sheets | Canvas endpoints | Writes? | Notes | Decision |
|---|---|---|---|---|---|---|---|
| `fetchCanvasAssignmentDates` | Lists every assignment with its dates, times, and schedule info | — | `Assignment Dates` (created if missing) | `GET /courses/:course/assignments` | no | Not on a menu (button?) | |
| `pushAssignmentDatesToCanvas` | Sends edited dates and details back for each row | — | `Assignment Dates` | `PUT /courses/:course/assignments/:id` | **YES** | Not on a menu (button?) | |
| `formatDisplayDateTime_` | Splits a Canvas timestamp into a date and a time | — | — | — | no | | |
| `mergeDateAndTimeIso_` | Combines a date and a time into a Canvas timestamp | — | — | — | no | | |
| `parseSubmissionTypesArray_` | Turns "online_upload, …" into a list | — | — | — | no | | |
| `extractNameFromCell_` | Gets the title out of a `HYPERLINK` cell | — | — | — | no | | |
| `getNextPageUrl_` | Reads the next-page URL from the `Link` header | — | — | — | no | A fourth copy of the paging helper | |

## 04_CommTools.js: roster and email

| Function | Purpose | Menu item | Sheets | Canvas endpoints | Writes? | Notes | Decision |
|---|---|---|---|---|---|---|---|
| `createActiveSheetRoster` | Writes a student roster table onto the active sheet | CT › 1. Roster & Data Sync › Create Roster Table | active, `*peopleList*`, `*SectionLookup*` | — | no | | |
| `sendEmailsToSelected` | Sends one Gmail message, BCC to the selected people | SA › Email & Dev Tools › Send Emails (BCC Selected) | active | — | no | **Sends email** (Gmail, not Canvas) | |
| `generateEmailList` | Writes an email list table at the active cell | SA › Email & Dev Tools › Generate Email List | active, `*peopleList*`, `*SectionLookup*` | — | no | | |

## 05_DataSync.js: full refresh

| Function | Purpose | Menu item | Sheets | Canvas endpoints | Writes? | Notes | Decision |
|---|---|---|---|---|---|---|---|
| `runFullDataRefresh` | Runs the ID write, roster, assignment groups, sections, and schedule steps in order | SA › 2. Run FULL Data Refresh | (via the steps) | (via the steps) | no | | |
| `runFullScheduleUpdate` | Placeholder: only shows toasts | — | — | — | no | Does nothing; its real call is commented out | |
| `updateMasterConnection` | Placeholder: only shows a toast | — | — | — | no | Does nothing | |

## 06_DataSetup.js: reference sheets

| Function | Purpose | Menu item | Sheets | Canvas endpoints | Writes? | Notes | Decision |
|---|---|---|---|---|---|---|---|
| `createPeopleList` | Downloads the course roster | — | `*peopleList*` (created if missing) | `GET /courses/:course`, `GET /courses/:course/enrollments` | no | Step of Full Data Refresh | |
| `createAssignmentGroupsList` | Downloads groups with their assignments and positions | SA › Roster & Utility Tools › Refresh Assignment Groups | `*assignmentGroups*` (created if missing) | `GET /courses/:course/assignment_groups?include[]=assignments&include[]=all_dates` | no | | |
| `createSectionLookup` | Builds the section ID → period table | — | `*peopleList*`, `*SectionLookup*` (created if missing) | (via `fetchSectionNames`) | no | Step of Full Data Refresh | |
| `getUniqueSectionIds` | Lists the distinct section IDs in a sheet | — | `*peopleList*` | — | no | | |
| `fetchSectionNames` | Gets each section's name | — | — | `GET /courses/:course/sections/:section` | no | One call per section | |
| `extractPeriod` | Gets the period number from a name like "Course (P3)" | — | — | — | no | | |

## 07_BatchActions.js: comments and grades

| Function | Purpose | Menu item | Sheets | Canvas endpoints | Writes? | Notes | Decision |
|---|---|---|---|---|---|---|---|
| `postBatchCommentsForAssignmentActiveColumn` | Posts the comments in the active column to each student's submission | CT › 2. Batch Text Comments › Post Comments to Canvas Portals | active | `PUT /courses/:course/assignments/:id/submissions/:user` | **YES** (comment only) | | |
| `promptAndConfirmBatchCommentToAllStudents` | Posts one typed comment to every student's submission | CT › 2. Batch Text Comments › Post Single Message Comment to ALL | active | `PUT /courses/:course/assignments/:id/submissions/:user` | **YES** (comment only) | | |
| `syncGradesAndStatusForAssignmentActiveColumn` | Reads each student's score for the assignment into the active column | — | active | `GET /courses/:course/assignments/:id/submissions/:user` | no | Not on a menu; one call per student | |
| `fillGradesForSelectedGradingPeriodInActiveColumn` | Reads grading-period course scores into the active column | — | active, `*gradingPeriods*` | `GET /courses/:course/enrollments?type[]=StudentEnrollment&grading_period_id=…` | no | Not on a menu; nothing refreshes `*gradingPeriods*` any more | |
| `getNextUrlLocal` (line 420) | Reads the next-page URL from the `Link` header | — | — | — | no | Identical copy, replaced by line 436 | |
| `getNextUrlLocal` (line 436) | Same | — | — | — | no | The copy that runs; also used by 10_Jupiter | |
| `batchExportAllStudentGrades` | For each student, fills a report sheet and saves a PDF | — | active, report sheet named in B2, roster sheet named in B4 | — | no | **Broken:** calls `getStudentGradesLocal` and `exportSheetAsPDF`, which don't exist | |

## 09_MiscTools.js: miscellaneous tools

| Function | Purpose | Menu item | Sheets | Canvas endpoints | Writes? | Notes | Decision |
|---|---|---|---|---|---|---|---|
| `refreshIndex` | Builds a linked list of every sheet | SA › Roster & Utility Tools › Refresh Sheet Index (also runs on open) | `*Index*` (created if missing), all sheet names | — | no | | |
| `clearGroupData` | Clears group IDs from the group tool sheet | SA › Group Management › 1. Clear Group Data | active | — | no | | |
| `createGroupCategory` | Creates a group set | SA › Group Management › 2. Create Group Category | active (A2, C2) | `POST /courses/:course/group_categories` | **YES** | | |
| `createGroups` | Creates groups in that set from the listed names | SA › Group Management › 3. Create Groups List | active | `POST /group_categories/:category/groups` | **YES** | | |
| `setupRubricUI` | Lays out a rubric template on the active sheet | CT › 4. Rubric Layouts › Setup Rubric Template | active | — | no | | |
| `exportRubricToCanvasFormat` | Converts the rubric into Canvas's import layout | CT › 4. Rubric Layouts › Export for Canvas | active, `rubricCanvasExport` (created if missing) | — | no | | |
| `setupAssignmentFilterAndDropdown` | Adds a search box and filtered assignment dropdown | — | active, `*assignmentGroups*` | — | no | Not on a menu (button?) | |
| `createAssignmentSelector` | Adds an assignment-name dropdown to the active cell | — | active, `*assignmentGroups*` | — | no | Not on a menu (button?) | |
| `createAssignmentSelectorBelow` | Same, plus an ID lookup formula in the cell below | — | active, `*assignmentGroups*` | — | no | Not on a menu (button?) | |
| `formatTime` | Pads 815 to "0815" | — | — | — | no | **The copy that runs** (replaces 01) | |
| `getPeriodTimesForDate` | Finds a period's times for a date | — | `*simpleSchedule*` | — | no | **The copy that runs** (replaces 01) | |
| `createDropdowns` | Older due-time dropdowns using Config B6:B9 | — | active, `*Config*`, `*simpleSchedule*` | — | no | Do not port (Config cell clash; see BRIEF) | |
| `parseJsonToSheet` | Turns JSON in the selected rows into a table on the sheet named in column F | SA › Email & Dev Tools › Parse JSON Response to Sheet | active, named target (created if missing) | — | no | | |
| `fillSelectedRangeSequentially` | Fills the selection with 1, 2, 3, … | SA › Roster & Utility Tools › A. Fill Selected Cells Sequentially | active | — | no | | |
| `updateAssignmentPositionsFromSelectedRows` | Sends each selected row's group and position (reorders assignments) | SA › Roster & Utility Tools › B. Push Position to Canvas | active | `PUT /courses/:course/assignments/:id` | **YES** (order only) | Brief step 5 replaces this | |
| `createStudentTextBoxes` | Builds seating-chart text boxes in a Slides deck | SA › Roster & Utility Tools › Create Seating Chart Slides | `*Config*` (B7, A8:C11), `*peopleList*`, `*SectionLookup*` | — | no | Opens a Slides deck by ID (needs a Slides permission) | |

## 10_Jupiter.gs.js: Jupiter export

| Function | Purpose | Menu item | Sheets | Canvas endpoints | Writes? | Notes | Decision |
|---|---|---|---|---|---|---|---|
| `getJupiterAllowedCategories_` | Reads which categories are checked for export | — | `*Config*` (G:I) | — | no | | |
| `isJupiterGroupAllowed_` | Checks a group against that list | — | — | — | no | | |
| `getJupiterCanvasSettings_` | Gets the token, base URL, and course ID; builds request options | — | `*Config*` (via getConfig) | — | no | | |
| `getJupiterJsonPage_` | Sends one GET, checks the code, returns data and next page | — | — | (any GET) | no | Closest thing to a shared request helper | |
| `getJupiterGroupMap_` | Gets all assignment group IDs and names | — | — | `GET /courses/:course/assignment_groups` | no | | |
| `refreshJupiterCategories` | Rebuilds Config G:I from Canvas, keeping your checkmarks | — | `*Config*` (G1:I) | (via `getJupiterGroupMap_`) | no | Run from a button on Config | |
| `jupiterId_` | Cleans up an ID value | — | — | — | no | | |
| `writeJupiterExport_` | Writes the score matrix to `JupiterExport` | — | active, `JupiterExport` | — | no | | |
| `buildJupiterExportFromRecentCanvasGrades` | Finds recently graded work and exports its scores | — | active (B1 = last sync), `JupiterExport` | `GET /courses/:course/students/submissions?graded_since=…`, `GET /courses/:course/assignments/:id/submissions` | no | Not on a menu (button?) | |
| `mapMultipleCanvasAssignmentsToJupiterExport` | Exports the highlighted score columns | CT › 1. Roster & Data Sync › Map Multi-Column Range to Jupiter Export | active, `JupiterExport` | `GET /courses/:course/assignments/:id` | no | Scores come from the sheet, not Canvas | |

## Things the map turned up

- **Every Canvas write** is a POST or PUT for assignments, quizzes, discussions,
  announcements, calendar events, overrides, comments, groups, or ordering. **None writes
  grades.** `performCanvasApiOperation` can send any request typed into `API Batch`.
- **No legacy write uses `DRY_RUN`.** Every write that's ported must go through `canvasWrite_()`.
- **Paging helper copies:** `getNextUrl` (02), `getNextPageUrl_` (03d), and `getNextUrlLocal`
  (07, twice). These become one helper in the Foundation step.
- **Not called anywhere:** `checkGlobalScriptProperties`, `getCanvasTimestamp`,
  `getPeriodTimes`, `parseTimeValue`.
- **Broken:** `batchExportAllStudentGrades` (missing helper functions).
- **Placeholders that do nothing:** `runFullScheduleUpdate`, `updateMasterConnection`.
  Nothing in the code fills `*simpleSchedule*` or `*gradingPeriods*`.
- **Not on any menu** (probably run from sheet buttons): marked "button?" above. You
  know which of these you click.
