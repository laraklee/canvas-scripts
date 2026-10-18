# Porting summary: legacy `course-manager` → `course-manager-jupiter`

> **Generated** from the Decision column of `legacy-function-map.md` by
> `npm run porting-summary`. Don't edit this file by hand: change the map, then rerun.

**103 legacy functions:** 31 ported · 14 planned for later · 12 left behind on purpose · 46 not yet reviewed.

## Ported (31)

| Legacy function | Legacy file | Now |
|---|---|---|
| `onOpen` | 00_Config.js | onOpen (SetupCheck.js) |
| `getConfig` | 00_Config.js | getCfg_ + cfg_ named ranges (Config.js) |
| `setUserProperties` | 00_Config.js | setCanvasCredentials (Credentials.js) |
| `convertToUTC` | 01_Utilities.js | buildCanvasTime_ + parseSheetTime_ (PostRows.js); code, no longer a custom function |
| `writeCurrentSpreadsheetIdToConfig` | 01_Utilities.js | buildSheetIndex_ writes cfg_ThisSheetID (SheetIndex.js) |
| `getNextUrl` | 02_APIRunner.js | getCanvasNextUrl_ (CanvasApi.js), the one shared paging helper |
| `postRows` | 03b_Assign_UI.js | postRows + previewRows (PostRows.js) |
| `postSingleAssignment` | 03b_Assign_UI.js | assignmentPayload_ (PostRows.js) |
| `postSingleDiscussion` | 03b_Assign_UI.js | discussionPayload_ (PostRows.js) |
| `postSingleNewQuiz` | 03b_Assign_UI.js | newQuizPayload_ (PostRows.js) |
| `postSingleClassicQuiz` | 03b_Assign_UI.js | classicQuizPayload_ (PostRows.js) |
| `generateDescription2` | 03b_Assign_UI.js | buildDescription_ (PostRows.js) |
| `getNextPageUrl_` | 03d.AssignmentDates.js | getCanvasNextUrl_ (CanvasApi.js), the one shared paging helper |
| `createPeopleList` | 06_DataSetup.js | refreshPeopleList + writePeopleListSheet_ (RefSheets.js) |
| `createAssignmentGroupsList` | 06_DataSetup.js | refreshAssignmentGroups + writeAssignmentGroupsSheet_ (RefSheets.js) |
| `createSectionLookup` | 06_DataSetup.js | refreshSectionList + writeSectionLookupSheet_ (RefSheets.js) |
| `extractPeriod` | 06_DataSetup.js | periodFromSectionName_ (RefSheets.js) |
| `getNextUrlLocal` (line 420) | 07_BatchActions.js | getCanvasNextUrl_ (CanvasApi.js), the one shared paging helper |
| `getNextUrlLocal` (line 436) | 07_BatchActions.js | getCanvasNextUrl_ (CanvasApi.js), the one shared paging helper |
| `refreshIndex` | 09_MiscTools.js | refreshSheetIndex (SheetIndex.js) |
| `clearGroupData` | 09_MiscTools.js | clearGroupData (Groups.js) |
| `createGroupCategory` | 09_MiscTools.js | createGroupCategory (Groups.js) |
| `createGroups` | 09_MiscTools.js | createGroups (Groups.js) |
| `fillSelectedRangeSequentially` | 09_MiscTools.js | numberSelectedRows (ReorderTool.js) |
| `updateAssignmentPositionsFromSelectedRows` | 09_MiscTools.js | previewReorder + pushReorder (ReorderTool.js) |
| `createStudentTextBoxes` | 09_MiscTools.js | buildSeatingChart (SeatingChart.js) |
| `getJupiterCanvasSettings_` | 10_Jupiter.gs.js | getCanvasCredentials_ + getCourseIdForRefresh_ (shared) |
| `getJupiterJsonPage_` | 10_Jupiter.gs.js | canvasGet_ (CanvasApi.js), the one shared request helper |
| `getJupiterGroupMap_` | 10_Jupiter.gs.js | folded into refreshJupiterCategories (Jupiter.js) |
| `refreshJupiterCategories` | 10_Jupiter.gs.js | refreshJupiterCategories (Jupiter.js) |
| `jupiterId_` | 10_Jupiter.gs.js | jupiterId_ (Jupiter.js) |

## Planned for later (14)

| Legacy function | Legacy file | When / why |
|---|---|---|
| `makeAssignmentAll` | 03a_Assign_Core.js | makeAssignment redesign, step 2 (create item + overrides) |
| `postOneAssignment` | 03a_Assign_Core.js | makeAssignment redesign, step 2 (create item + overrides) |
| `generateDescription` | 03a_Assign_Core.js | makeAssignment redesign, step 2 (create item + overrides) |
| `createOverrides1` | 03a_Assign_Core.js | makeAssignment redesign, step 2 (create item + overrides) |
| `postOneNewQuiz` | 03a_Assign_Core.js | makeAssignment redesign, step 2 (create item + overrides) |
| `createQuizWithOverrides` | 03a_Assign_Core.js | makeAssignment redesign, step 2 (create item + overrides) |
| `postOneNewDiscussion` | 03a_Assign_Core.js | makeAssignment redesign, step 2 (create item + overrides) |
| `createDiscussionWithOverrides` | 03a_Assign_Core.js | makeAssignment redesign, step 2 (create item + overrides) |
| `postOneClassicQuizWithOverrides` | 03a_Assign_Core.js | makeAssignment redesign, step 2 (create item + overrides) |
| `addQuestionsToClassicQuiz` | 03b_Assign_UI.js | makeAssignment redesign, step 3 (CQ questions) |
| `updateQuizInstructions` | 03b_Assign_UI.js | makeAssignment redesign, step 3 (CQ questions) |
| `buildQuestionPayload` | 03b_Assign_UI.js | makeAssignment redesign, step 3 (CQ questions) |
| `resetAssignmentEditor` | 03c_Assign_Misc.js | makeAssignment redesign, step 4 (Clear/reset) |
| `clearCreationIDs` | 03c_Assign_Misc.js | makeAssignment redesign, step 4 (Clear/reset) |

## Left behind on purpose (12)

| Legacy function | Legacy file | Reason |
|---|---|---|
| `fetchAssignment` | 03c_Assign_Misc.js | makeAssignment is creation only; no load/edit/update (Lara) |
| `updateAssignmentInCanvas` | 03c_Assign_Misc.js | makeAssignment is creation only; no load/edit/update (Lara) |
| `injectInfrastructureFormulas` | 03c_Assign_Misc.js | makeAssignment is creation only; no load/edit/update (Lara) |
| `updateCanvasEntity` | 03c_Assign_Misc.js | makeAssignment is creation only; no load/edit/update (Lara) |
| `updateOverridesFromColO` | 03c_Assign_Misc.js | makeAssignment is creation only; no load/edit/update (Lara) |
| `populateEditSheetWithAssignmentData` | 03c_Assign_Misc.js | makeAssignment is creation only; no load/edit/update (Lara) |
| `fetchAssignmentFromCanvas` | 03c_Assign_Misc.js | makeAssignment is creation only; no load/edit/update (Lara) |
| `fetchAssignmentOverrides` | 03c_Assign_Misc.js | makeAssignment is creation only; no load/edit/update (Lara) |
| `getUniqueSectionIds` | 06_DataSetup.js | refreshSectionList gets every section in one request |
| `fetchSectionNames` | 06_DataSetup.js | refreshSectionList gets every section in one request |
| `fillGradesForSelectedGradingPeriodInActiveColumn` | 07_BatchActions.js | past-quarter gradebook scores not needed for Jupiter (Lara) |
| `createDropdowns` | 09_MiscTools.js | older copy; clashes with Config cells (port createDropdowns1 instead) |

## Not yet reviewed (46)

| Legacy function | Legacy file | What it does |
|---|---|---|
| `createDropdowns1` | 01_Utilities.js | Builds due-time dropdowns (F7:F11) from Config B14:B17 and the day's period times |
| `getPeriodTimesForDate` | 01_Utilities.js | Finds a period's start/end time for a date in `*simpleSchedule*` |
| `formatTime` | 01_Utilities.js | Formats 815 / Date as "8:15 AM" |
| `checkGlobalScriptProperties` | 01_Utilities.js | Logs which keys exist in Script Properties |
| `getPeriodNameFromId` | 01_Utilities.js | Looks up a period name from a section ID |
| `getCanvasTimestamp` | 01_Utilities.js | Validates a date, then calls `convertToUTC` |
| `logResponse` | 01_Utilities.js | Writes an API response code and body to columns D–E of a row |
| `getPeriodTimes` | 01_Utilities.js | Finds period times by schedule name |
| `parseTimeValue` | 01_Utilities.js | Turns a time cell into a Date |
| `toggleSelectedCheckboxes` | 01_Utilities.js | Checks or unchecks every checkbox in the selection |
| `convertRichTextToHtml` | 01_Utilities.js | Turns a rich-text cell into simple HTML for email |
| `sendCanvasRequest` | 02_APIRunner.js | Sends one POST and puts a link or error in a status cell |
| `processUnifiedSheetForCanvasWithLinks` | 02_APIRunner.js | For selected rows, creates calendar events and/or announcements |
| `performCanvasApiOperation` | 02_APIRunner.js | Runs any GET/POST/PUT/DELETE typed in the sheet, follows paging, can write results to a named sheet |
| `parseCombinedJsonToSheet` | 02_APIRunner.js | Turns JSON pages into a table on a sheet |
| `getCanvasQuizId` | 03b_Assign_UI.js | Looks up the Classic Quiz ID for the assignment in A3; writes it to O3 |
| `getPeriodNameFromId` | 03c_Assign_Misc.js | Looks up a period name from a section ID |
| `fetchCanvasAssignmentDates` | 03d.AssignmentDates.js | Lists every assignment with its dates, times, and schedule info |
| `pushAssignmentDatesToCanvas` | 03d.AssignmentDates.js | Sends edited dates and details back for each row |
| `formatDisplayDateTime_` | 03d.AssignmentDates.js | Splits a Canvas timestamp into a date and a time |
| `mergeDateAndTimeIso_` | 03d.AssignmentDates.js | Combines a date and a time into a Canvas timestamp |
| `parseSubmissionTypesArray_` | 03d.AssignmentDates.js | Turns "online_upload, …" into a list |
| `extractNameFromCell_` | 03d.AssignmentDates.js | Gets the title out of a `HYPERLINK` cell |
| `createActiveSheetRoster` | 04_CommTools.js | Writes a student roster table onto the active sheet |
| `sendEmailsToSelected` | 04_CommTools.js | Sends one Gmail message, BCC to the selected people |
| `generateEmailList` | 04_CommTools.js | Writes an email list table at the active cell |
| `runFullDataRefresh` | 05_DataSync.js | Runs the ID write, roster, assignment groups, sections, and schedule steps in order |
| `runFullScheduleUpdate` | 05_DataSync.js | Placeholder: only shows toasts |
| `updateMasterConnection` | 05_DataSync.js | Placeholder: only shows a toast |
| `postBatchCommentsForAssignmentActiveColumn` | 07_BatchActions.js | Posts the comments in the active column to each student's submission |
| `promptAndConfirmBatchCommentToAllStudents` | 07_BatchActions.js | Posts one typed comment to every student's submission |
| `syncGradesAndStatusForAssignmentActiveColumn` | 07_BatchActions.js | Reads each student's score for the assignment into the active column |
| `batchExportAllStudentGrades` | 07_BatchActions.js | For each student, fills a report sheet and saves a PDF |
| `setupRubricUI` | 09_MiscTools.js | Lays out a rubric template on the active sheet |
| `exportRubricToCanvasFormat` | 09_MiscTools.js | Converts the rubric into Canvas's import layout |
| `setupAssignmentFilterAndDropdown` | 09_MiscTools.js | Adds a search box and filtered assignment dropdown |
| `createAssignmentSelector` | 09_MiscTools.js | Adds an assignment-name dropdown to the active cell |
| `createAssignmentSelectorBelow` | 09_MiscTools.js | Same, plus an ID lookup formula in the cell below |
| `formatTime` | 09_MiscTools.js | Pads 815 to "0815" |
| `getPeriodTimesForDate` | 09_MiscTools.js | Finds a period's times for a date |
| `parseJsonToSheet` | 09_MiscTools.js | Turns JSON in the selected rows into a table on the sheet named in column F |
| `getJupiterAllowedCategories_` | 10_Jupiter.gs.js | Reads which categories are checked for export |
| `isJupiterGroupAllowed_` | 10_Jupiter.gs.js | Checks a group against that list |
| `writeJupiterExport_` | 10_Jupiter.gs.js | Writes the score matrix to `JupiterExport` |
| `buildJupiterExportFromRecentCanvasGrades` | 10_Jupiter.gs.js | Finds recently graded work and exports its scores |
| `mapMultipleCanvasAssignmentsToJupiterExport` | 10_Jupiter.gs.js | Exports the highlighted score columns |
