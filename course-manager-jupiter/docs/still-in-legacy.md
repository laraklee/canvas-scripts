# What's still only in the legacy code

The new workbook (`course-manager-jupiter/`) ported what Lara uses day to day. Everything
below exists **only** in the legacy project: the `course-manager/` folder (never edit it)
and the Git tag `legacy-gradebook`. For function-by-function detail, see
`legacy-function-map.md`; for counts, `porting-summary.md`.

Last updated 2026-10-18.

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

**Rubrics:** creating a rubric directly in Canvas (and attaching it to an assignment) was
discussed and set aside; the CSV import is used instead. It could be added later.

## Not reviewed yet (still only in legacy)

Nobody has decided about these yet. If you need one, it's a candidate to port next.
Items marked **writes to Canvas** would need dry run and a test-course check when ported.

| Area | What legacy does | Notes |
|---|---|---|
| Assignment comments | Post the comments in a column to each student's submission; post one message to every student (`postBatchCommentsForAssignmentActiveColumn`, `promptAndConfirmBatchCommentToAllStudents`) | **Writes to Canvas** (comments only). Involves student data. |
| Read scores into a column | Read each student's score for one assignment into the active column (`syncGradesAndStatusForAssignmentActiveColumn`) | Read-only; one request per student. Involves student data. |
| Student grade PDFs | Fill a report sheet per student and save PDFs (`batchExportAllStudentGrades`) | **Broken in legacy** (missing helper functions). |
| Email tools | Build an email list; send one Gmail message BCC to selected people; toggle checkboxes; rich text to HTML (`generateEmailList`, `sendEmailsToSelected`, …) | Sends **Gmail**, not Canvas. Involves student emails. Would need a Gmail permission. |
| Calendar events and announcements | For selected rows, create calendar events and/or announcements (`processUnifiedSheetForCanvasWithLinks`) | **Writes to Canvas.** |
| Bulk assignment dates | List every assignment's dates on a sheet, edit them, push changes back (`fetchCanvasAssignmentDates`, `pushAssignmentDatesToCanvas`) | **Writes to Canvas** (updates existing assignments). |
| API Batch runner | Send any request typed into the `API Batch` sheet; turn JSON replies into tables (`performCanvasApiOperation`, `parseJsonToSheet`, …) | **Writes to Canvas** (anything typed). A developer tool; risky to port as-is. |
| Assignment selector dropdowns | Searchable assignment-name dropdowns and ID lookups in a cell (`setupAssignmentFilterAndDropdown`, `createAssignmentSelector`, …) | Sheet only. |
| Unused helpers and placeholders | Functions nothing calls, and two placeholders that did nothing (`runFullScheduleUpdate`, `updateMasterConnection`) | Probably leave behind; listed for completeness. |

## How to bring one over

Follow the "Definition of done for a port" in `BRIEF.md`: read the legacy code, plan
(with Canvas's docs for any write), build with offline checks, test with dry run, then
in the test course. Update the Decision column in `legacy-function-map.md`, run
`npm run porting-summary`, and update this file.
