# Porting summary: legacy `course-manager` → `course-manager-jupiter`

> **Generated** from the Decision column of `legacy-function-map.md` by
> `npm run porting-summary`. Don't edit this file by hand: change the map, then rerun.

**103 legacy functions:** 53 ported · 0 planned for later · 19 left behind on purpose · 31 not yet reviewed.

## Ported (53)

| Legacy function | Legacy file | Now |
|---|---|---|
| `onOpen` | 00_Config.js | onOpen (SetupCheck.js) + buildMenus_ (Menus.js): two menus, Canvas Tools and Setup & Data |
| `getConfig` | 00_Config.js | getCfg_ + cfg_ named ranges (Config.js) |
| `setUserProperties` | 00_Config.js | setCanvasCredentials (Credentials.js) |
| `createDropdowns1` | 01_Utilities.js | createDropdowns1 (MakeAssignment.js): Overrides Due Time only, typed times allowed |
| `convertToUTC` | 01_Utilities.js | buildCanvasTime_ + parseSheetTime_ (PostRows.js); code, no longer a custom function |
| `writeCurrentSpreadsheetIdToConfig` | 01_Utilities.js | buildSheetIndex_ writes cfg_ThisSheetID (SheetIndex.js) |
| `getNextUrl` | 02_APIRunner.js | getCanvasNextUrl_ (CanvasApi.js), the one shared paging helper |
| `makeAssignmentAll` | 03a_Assign_Core.js | makeAssignmentAll + runMakeAssignment_ (MakeAssignment.js): one button for A, D, CQ, NQ; tab found by labels |
| `postOneAssignment` | 03a_Assign_Core.js | planMakeAssignmentItem_ (MakeAssignment.js), using createByRow's request builders |
| `generateDescription` | 03a_Assign_Core.js | buildDescription_ (PostRows.js), shared with createByRow |
| `createOverrides1` | 03a_Assign_Core.js | planOverride_ + overridePath_ (MakeAssignment.js); reads Section ID, dates in code |
| `postOneNewQuiz` | 03a_Assign_Core.js | makeAssignmentAll, Type NQ (newQuizPayload_, PostRows.js) |
| `createQuizWithOverrides` | 03a_Assign_Core.js | makeAssignmentAll, Type NQ |
| `postOneNewDiscussion` | 03a_Assign_Core.js | makeAssignmentAll, Type D (discussionPayload_, PostRows.js) |
| `createDiscussionWithOverrides` | 03a_Assign_Core.js | makeAssignmentAll, Type D |
| `postOneClassicQuizWithOverrides` | 03a_Assign_Core.js | makeAssignmentAll, Type CQ (classicQuizPayload_, PostRows.js; now with instructions) |
| `addQuestionsToClassicQuiz` | 03b_Assign_UI.js | makeAssignmentAll's Questions table + planQuestion_ (QuizQuestions.js); New Quiz questions added too (new) |
| `buildQuestionPayload` | 03b_Assign_UI.js | parseQuestion_ + questionPayload_ (QuizQuestions.js); newQuizItemPayload_ for NQ |
| `postRows` | 03b_Assign_UI.js | postRows + previewRows (PostRows.js) |
| `postSingleAssignment` | 03b_Assign_UI.js | assignmentPayload_ (PostRows.js) |
| `postSingleDiscussion` | 03b_Assign_UI.js | discussionPayload_ (PostRows.js) |
| `postSingleNewQuiz` | 03b_Assign_UI.js | newQuizPayload_ (PostRows.js) |
| `postSingleClassicQuiz` | 03b_Assign_UI.js | classicQuizPayload_ (PostRows.js) |
| `generateDescription2` | 03b_Assign_UI.js | buildDescription_ (PostRows.js) |
| `clearCreationIDs` | 03c_Assign_Misc.js | clearCreationIDs (MakeAssignment.js); also clears Canvas URL, Status, Payload, QuestionIDs |
| `getNextPageUrl_` | 03d.AssignmentDates.js | getCanvasNextUrl_ (CanvasApi.js), the one shared paging helper |
| `createActiveSheetRoster` | 04_CommTools.js | createActiveSheetRoster (Jupiter.js): writes A–E only (legacy cleared A–J); reminds to check Jupiter IDs in F |
| `runFullDataRefresh` | 05_DataSync.js | refreshAllTables (Menus.js): course list, people, assignment groups, sections, sheet index; not Jupiter categories |
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
| `exportRubricToCanvasFormat` | 09_MiscTools.js | exportRubricToCanvasFormat (Rubrics.js): reads column A labels, includes rating descriptions; CSV import, no Canvas write (direct create/attach could come later) |
| `formatTime` | 09_MiscTools.js | formatTime24_ (MakeAssignment.js) |
| `getPeriodTimesForDate` | 09_MiscTools.js | readScheduleByDay_ + findPeriodTimes_ (MakeAssignment.js) |
| `fillSelectedRangeSequentially` | 09_MiscTools.js | numberSelectedRows (ReorderTool.js) |
| `updateAssignmentPositionsFromSelectedRows` | 09_MiscTools.js | previewReorder + pushReorder (ReorderTool.js) |
| `createStudentTextBoxes` | 09_MiscTools.js | buildSeatingChart (SeatingChart.js) |
| `getJupiterAllowedCategories_` | 10_Jupiter.gs.js | readJupiterAllowed_ (Jupiter.js) |
| `isJupiterGroupAllowed_` | 10_Jupiter.gs.js | folded into pickJupiterAssignments_ (Jupiter.js) |
| `getJupiterCanvasSettings_` | 10_Jupiter.gs.js | getCanvasCredentials_ + getCourseIdForRefresh_ (shared) |
| `getJupiterJsonPage_` | 10_Jupiter.gs.js | canvasGet_ (CanvasApi.js), the one shared request helper |
| `getJupiterGroupMap_` | 10_Jupiter.gs.js | folded into refreshJupiterCategories (Jupiter.js) |
| `refreshJupiterCategories` | 10_Jupiter.gs.js | refreshJupiterCategories (Jupiter.js) |
| `jupiterId_` | 10_Jupiter.gs.js | jupiterId_ (Jupiter.js) |
| `writeJupiterExport_` | 10_Jupiter.gs.js | fillJupiterExport_ (Jupiter.js); counts unmatched students |
| `buildJupiterExportFromRecentCanvasGrades` | 10_Jupiter.gs.js | buildJupiterExportFromRecentCanvasGrades (Jupiter.js): sends the final score (after any late penalty; legacy sent entered_score) |

## Planned for later (0)

_None._

## Left behind on purpose (19)

| Legacy function | Legacy file | Reason |
|---|---|---|
| `getPeriodTimesForDate` | 01_Utilities.js | shadowed copy (the 09 copy was ported) |
| `formatTime` | 01_Utilities.js | shadowed copy (the 09 copy was ported) |
| `getCanvasQuizId` | 03b_Assign_UI.js | CQ's Canvas URL is now the quiz link; quizIdFromLink_ (QuizQuestions.js) reads the ID from it |
| `updateQuizInstructions` | 03b_Assign_UI.js | instructions now go in the create request, so no update write (Lara) |
| `fetchAssignment` | 03c_Assign_Misc.js | makeAssignment is creation only; no load/edit/update (Lara) |
| `updateAssignmentInCanvas` | 03c_Assign_Misc.js | makeAssignment is creation only; no load/edit/update (Lara) |
| `resetAssignmentEditor` | 03c_Assign_Misc.js | copies keep their own defaults and formulas; Clear IDs never touches them |
| `injectInfrastructureFormulas` | 03c_Assign_Misc.js | makeAssignment is creation only; no load/edit/update (Lara) |
| `updateCanvasEntity` | 03c_Assign_Misc.js | makeAssignment is creation only; no load/edit/update (Lara) |
| `updateOverridesFromColO` | 03c_Assign_Misc.js | makeAssignment is creation only; no load/edit/update (Lara) |
| `populateEditSheetWithAssignmentData` | 03c_Assign_Misc.js | makeAssignment is creation only; no load/edit/update (Lara) |
| `fetchAssignmentFromCanvas` | 03c_Assign_Misc.js | makeAssignment is creation only; no load/edit/update (Lara) |
| `fetchAssignmentOverrides` | 03c_Assign_Misc.js | makeAssignment is creation only; no load/edit/update (Lara) |
| `getUniqueSectionIds` | 06_DataSetup.js | refreshSectionList gets every section in one request |
| `fetchSectionNames` | 06_DataSetup.js | refreshSectionList gets every section in one request |
| `fillGradesForSelectedGradingPeriodInActiveColumn` | 07_BatchActions.js | past-quarter gradebook scores not needed for Jupiter (Lara) |
| `setupRubricUI` | 09_MiscTools.js | Lara copies a rubric template tab instead |
| `createDropdowns` | 09_MiscTools.js | older copy; clashes with Config cells (port createDropdowns1 instead) |
| `mapMultipleCanvasAssignmentsToJupiterExport` | 10_Jupiter.gs.js | not in Lara's workflow (she uses CreateRoster + Update Grades) |

## Not yet reviewed (31)

| Legacy function | Legacy file | What it does |
|---|---|---|
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
| `getPeriodNameFromId` | 03c_Assign_Misc.js | Looks up a period name from a section ID |
| `fetchCanvasAssignmentDates` | 03d.AssignmentDates.js | Lists every assignment with its dates, times, and schedule info |
| `pushAssignmentDatesToCanvas` | 03d.AssignmentDates.js | Sends edited dates and details back for each row |
| `formatDisplayDateTime_` | 03d.AssignmentDates.js | Splits a Canvas timestamp into a date and a time |
| `mergeDateAndTimeIso_` | 03d.AssignmentDates.js | Combines a date and a time into a Canvas timestamp |
| `parseSubmissionTypesArray_` | 03d.AssignmentDates.js | Turns "online_upload, …" into a list |
| `extractNameFromCell_` | 03d.AssignmentDates.js | Gets the title out of a `HYPERLINK` cell |
| `sendEmailsToSelected` | 04_CommTools.js | Sends one Gmail message, BCC to the selected people |
| `generateEmailList` | 04_CommTools.js | Writes an email list table at the active cell |
| `runFullScheduleUpdate` | 05_DataSync.js | Placeholder: only shows toasts |
| `updateMasterConnection` | 05_DataSync.js | Placeholder: only shows a toast |
| `postBatchCommentsForAssignmentActiveColumn` | 07_BatchActions.js | Posts the comments in the active column to each student's submission |
| `promptAndConfirmBatchCommentToAllStudents` | 07_BatchActions.js | Posts one typed comment to every student's submission |
| `syncGradesAndStatusForAssignmentActiveColumn` | 07_BatchActions.js | Reads each student's score for the assignment into the active column |
| `batchExportAllStudentGrades` | 07_BatchActions.js | For each student, fills a report sheet and saves a PDF |
| `setupAssignmentFilterAndDropdown` | 09_MiscTools.js | Adds a search box and filtered assignment dropdown |
| `createAssignmentSelector` | 09_MiscTools.js | Adds an assignment-name dropdown to the active cell |
| `createAssignmentSelectorBelow` | 09_MiscTools.js | Same, plus an ID lookup formula in the cell below |
| `parseJsonToSheet` | 09_MiscTools.js | Turns JSON in the selected rows into a table on the sheet named in column F |
