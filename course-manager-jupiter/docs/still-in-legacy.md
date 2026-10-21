# What's still only in the legacy code

The new workbook (`course-manager-jupiter/`) ported what Lara uses day to day. Everything
below exists **only** in the legacy project: the `course-manager/` folder (never edit it)
and the Git tag `legacy-gradebook`. For function-by-function detail, see
`legacy-function-map.md`; for counts, `porting-summary.md`.

Last updated 2026-10-20.

## Moved to assign-sheet

These were ported into the **assign-sheet** project (the Assignment sheets for Biology,
Gastronomy, and AI9), not into this workbook. Lara decided they belong there. Use them
from each Assignment sheet's **Canvas Tools** menu; see `assign-sheet/BRIEF.md`.

| Area | Legacy functions | Now in assign-sheet |
|---|---|---|
| Calendar events and announcements | `processUnifiedSheetForCanvasWithLinks` (and its helper `sendCanvasRequest`) | **📅 Calendar & announcements › Post selected calendarEvents rows to Canvas** (`03_Content_Sync.js`). Sends through `canvasWrite_`, so dry run applies. |
| Bulk assignment dates | `fetchCanvasAssignmentDates`, `pushAssignmentDatesToCanvas` (and helpers) | **📝 Assignment dates › Load assignment dates from Canvas / Send changed dates to Canvas** (`07_AssignmentDates.js`). Sends only the open/due/lock dates that changed; name, points, and submission type are no longer sent. |

## Left behind on purpose

These were reviewed and deliberately not ported. Each has a reason.

| Area | What legacy did | Why it was left behind |
|---|---|---|
| Edit existing assignments | Load an assignment and its overrides into the editor, change them, send updates back (`fetchAssignment`, `updateAssignmentInCanvas`, and helpers) | makeAssignment is **creation only** (Lara). Edit in Canvas. Could return later as a separate tool. |
| Classic quiz instructions update | A second request that replaced a quiz's description (`updateQuizInstructions`) | Instructions now go in the request that **creates** the quiz, so no update is needed. |
| Classic quiz ID lookup | Looked up a quiz's ID into O3 (`getCanvasQuizId`) | The quiz's Canvas URL now holds its link, which ends in the ID. |
| Rubric template setup | Cleared a sheet and laid out a rubric template (`setupRubricUI`) | It never ran (bug). Lara copies a rubric template tab instead. |
| Jupiter "highlighted columns" export | Exported score columns selected on the grading sheet (`mapMultipleCanvasAssignmentsToJupiterExport`) | Not in Lara's workflow; she uses CreateRoster + Update Grades. |
| Grading-period scores | Read past-quarter course scores into a column (`fillGradesForSelectedGradingPeriodInActiveColumn`) | Not needed for Jupiter (Lara). |
| Old/duplicate helpers | An older due-time dropdown, shadowed duplicates, a one-call-per-section lookup, editor formula reset | Replaced by newer code or not needed. |
| Student grade PDFs | Filled a report sheet per student and saved PDFs (`batchExportAllStudentGrades`) | Jupiter's reports do this now (Lara). Also broken in legacy (missing helper functions). |
| API Batch runner | Sent any request typed into the `API Batch` sheet; turned JSON replies into tables (`performCanvasApiOperation`, `parseJsonToSheet`, and helpers) | Sent anything, writes included, with no dry run. A call that's needed gets built as its own tool instead (Lara, 2026-10-20). |
| Unused helpers and placeholders | Functions nothing calls, a period-name lookup, and two placeholders that did nothing (`runFullScheduleUpdate`, `updateMasterConnection`) | Not needed. |

**Rubrics:** creating a rubric directly in Canvas (and attaching it to an assignment) was
discussed and set aside; the CSV import is used instead. It could be added later.

## Later, if needed

Reviewed 2026-10-20 and not ported for now. Each comes back only if the condition is met.
Items marked **writes to Canvas** would need dry run and a test-course check when ported.

| Area | What legacy does | Comes back if |
|---|---|---|
| Email tools | Build an email list; send one Gmail message BCC to selected people; toggle checkboxes; rich text to HTML (`generateEmailList`, `sendEmailsToSelected`, …) | Someone misses them (Lara: wait and see). Sends **Gmail**, not Canvas; would need a Gmail permission. Involves student emails. |
| Assignment comments | Post the comments in a column to each student's submission; post one message to every student (`postBatchCommentsForAssignmentActiveColumn`, `promptAndConfirmBatchCommentToAllStudents`) | Commenting moves into Canvas (see the Jupiter comments open item in `BRIEF.md`). **Writes to Canvas** (comments only). Involves student data. |
| Read scores into a column | Read each student's score for one assignment into the active column (`syncGradesAndStatusForAssignmentActiveColumn`) | Same as comments. Read-only. Update Grades already reads scores by assignment for Jupiter. |
| Assignment selector dropdowns | Searchable assignment-name dropdowns and ID lookups in a cell (`setupAssignmentFilterAndDropdown`, `createAssignmentSelector`, …) | The score pull into a column comes back (they pick its assignment). Sheet only. |

Nothing is left unreviewed: every legacy function has a decision in `legacy-function-map.md`.

## How to bring one over

Follow the "Definition of done for a port" in `BRIEF.md`: read the legacy code, plan
(with Canvas's docs for any write), build with offline checks, test with dry run, then
in the test course. Update the Decision column in `legacy-function-map.md`, run
`npm run porting-summary`, and update this file.
