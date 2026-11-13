# Porting summary: legacy `course-manager` → `course-manager-jupiter`

> **Generated** from the Decision column of `legacy-function-map.md` by
> `npm run porting-summary`. Don't edit this file by hand: change the map, then rerun.

**103 legacy functions:** 61 ported · 7 planned for later · 35 left behind on purpose · 0 not yet reviewed.

## Ported (61)

| Legacy function | Legacy file | Now |
|---|---|---|
| `onOpen` | 00_Config.js | onOpen (SetupCheck.js) + buildMenus_ (Menus.js): one menu, Course Manager Tools (two menus, Canvas Tools and Setup & Data, until 2026-11-12) |
| `getConfig` | 00_Config.js | getCfg_ + cfg_ named ranges (Config.js) |
| `setUserProperties` | 00_Config.js | setCanvasCredentials (Credentials.js); since 2026-11-12 the token is saved in the Setup… panel (saveCanvasCredentialsFromPanel), and the old item is off the menu |
| `createDropdowns1` | 01_Utilities.js | createDropdowns1 (MakeAssignment.js): Overrides Due Time only, typed times allowed |
| `convertToUTC` | 01_Utilities.js | buildCanvasTime_ + parseSheetTime_ (PostRows.js); code, no longer a custom function |
| `writeCurrentSpreadsheetIdToConfig` | 01_Utilities.js | buildSheetIndex_ writes cfg_ThisSheetID (SheetIndex.js) |
| `sendCanvasRequest` | 02_APIRunner.js | canvasWrite_ (assign-sheet/05_CanvasApi.js) + sendEventJobs_ (assign-sheet/03_Content_Sync.js) |
| `processUnifiedSheetForCanvasWithLinks` | 02_APIRunner.js | processUnifiedSheetForCanvasWithLinks (assign-sheet/03_Content_Sync.js), not this workbook |
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
| `fetchCanvasAssignmentDates` | 03d.AssignmentDates.js | fetchCanvasAssignmentDates (assign-sheet/07_AssignmentDates.js), not this workbook |
| `pushAssignmentDatesToCanvas` | 03d.AssignmentDates.js | pushAssignmentDatesToCanvas (assign-sheet/07_AssignmentDates.js): sends only changed open/due/lock dates |
| `formatDisplayDateTime_` | 03d.AssignmentDates.js | formatDisplayDateTime_ (assign-sheet/07_AssignmentDates.js) |
| `mergeDateAndTimeIso_` | 03d.AssignmentDates.js | parseSheetDateTime_ (assign-sheet/07_AssignmentDates.js): also rejects bad dates and a date with no time |
| `getNextPageUrl_` | 03d.AssignmentDates.js | getCanvasNextUrl_ (CanvasApi.js), the one shared paging helper |
| `createActiveSheetRoster` | 04_CommTools.js | createActiveSheetRoster (Jupiter.js): writes A–E (legacy cleared A–J); reruns keep whole rows lined up by User ID (adds inserted, drops deleted after Yes) |
| `runFullDataRefresh` | 05_DataSync.js | refreshAllTables (Menus.js): course list, people, assignment groups, sections, sheet index; not Jupiter categories |
| `createPeopleList` | 06_DataSetup.js | refreshPeopleList + writePeopleListSheet_ (RefSheets.js) |
| `createAssignmentGroupsList` | 06_DataSetup.js | refreshAssignmentGroups + writeAssignmentGroupsSheet_ (RefSheets.js) |
| `createSectionLookup` | 06_DataSetup.js | refreshSectionList + writeSectionLookupSheet_ (RefSheets.js) |
| `extractPeriod` | 06_DataSetup.js | periodFromSectionName_ (RefSheets.js) |
| `postBatchCommentsForAssignmentActiveColumn` | 07_BatchActions.js | postCommentsForActiveColumn (AssignmentColumn.js) |
| `syncGradesAndStatusForAssignmentActiveColumn` | 07_BatchActions.js | pullScoresForActiveColumn (AssignmentColumn.js) |
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

## Planned for later (7)

| Legacy function | Legacy file | When / why |
|---|---|---|
| `toggleSelectedCheckboxes` | 01_Utilities.js | with the email tools, if anyone misses them (Lara) |
| `convertRichTextToHtml` | 01_Utilities.js | with the email tools, if anyone misses them (Lara) |
| `sendEmailsToSelected` | 04_CommTools.js | wait and see if anyone misses the email tools (Lara) |
| `generateEmailList` | 04_CommTools.js | wait and see if anyone misses the email tools (Lara) |
| `setupAssignmentFilterAndDropdown` | 09_MiscTools.js | maybe; for now a row 1 XLOOKUP formula shows the name (Lara, 2026-10-23) |
| `createAssignmentSelector` | 09_MiscTools.js | maybe; for now a row 1 XLOOKUP formula shows the name (Lara, 2026-10-23) |
| `createAssignmentSelectorBelow` | 09_MiscTools.js | maybe; for now a row 1 XLOOKUP formula shows the name (Lara, 2026-10-23) |

## Left behind on purpose (35)

| Legacy function | Legacy file | Reason |
|---|---|---|
| `getPeriodTimesForDate` | 01_Utilities.js | shadowed copy (the 09 copy was ported) |
| `formatTime` | 01_Utilities.js | shadowed copy (the 09 copy was ported) |
| `checkGlobalScriptProperties` | 01_Utilities.js | not called anywhere |
| `getPeriodNameFromId` | 01_Utilities.js | ported tools get the period from ref_SectionLookup (periodFromSectionName_) |
| `getCanvasTimestamp` | 01_Utilities.js | not called anywhere; dates are built by buildCanvasTime_ |
| `logResponse` | 01_Utilities.js | only used by the API Batch runner (left behind) |
| `getPeriodTimes` | 01_Utilities.js | not called anywhere |
| `parseTimeValue` | 01_Utilities.js | not called anywhere |
| `performCanvasApiOperation` | 02_APIRunner.js | sends any request with no dry run; a call that's needed gets built as its own tool (Lara) |
| `parseCombinedJsonToSheet` | 02_APIRunner.js | only used by the API Batch runner (left behind) |
| `getCanvasQuizId` | 03b_Assign_UI.js | CQ's Canvas URL is now the quiz link; quizIdFromLink_ (QuizQuestions.js) reads the ID from it |
| `updateQuizInstructions` | 03b_Assign_UI.js | instructions now go in the create request, so no update write (Lara) |
| `fetchAssignment` | 03c_Assign_Misc.js | makeAssignment is creation only; no load/edit/update (Lara) |
| `updateAssignmentInCanvas` | 03c_Assign_Misc.js | makeAssignment is creation only; no load/edit/update (Lara) |
| `resetAssignmentEditor` | 03c_Assign_Misc.js | copies keep their own defaults and formulas; Clear IDs never touches them |
| `injectInfrastructureFormulas` | 03c_Assign_Misc.js | makeAssignment is creation only; no load/edit/update (Lara) |
| `updateCanvasEntity` | 03c_Assign_Misc.js | makeAssignment is creation only; no load/edit/update (Lara) |
| `updateOverridesFromColO` | 03c_Assign_Misc.js | makeAssignment is creation only; no load/edit/update (Lara) |
| `populateEditSheetWithAssignmentData` | 03c_Assign_Misc.js | makeAssignment is creation only; no load/edit/update (Lara) |
| `getPeriodNameFromId` | 03c_Assign_Misc.js | ported tools get the period from ref_SectionLookup (periodFromSectionName_) |
| `fetchAssignmentFromCanvas` | 03c_Assign_Misc.js | makeAssignment is creation only; no load/edit/update (Lara) |
| `fetchAssignmentOverrides` | 03c_Assign_Misc.js | makeAssignment is creation only; no load/edit/update (Lara) |
| `parseSubmissionTypesArray_` | 03d.AssignmentDates.js | assign-sheet no longer sends submission types (dates only) |
| `extractNameFromCell_` | 03d.AssignmentDates.js | assign-sheet no longer sends assignment names (dates only) |
| `runFullScheduleUpdate` | 05_DataSync.js | placeholder that does nothing |
| `updateMasterConnection` | 05_DataSync.js | placeholder that does nothing |
| `getUniqueSectionIds` | 06_DataSetup.js | refreshSectionList gets every section in one request |
| `fetchSectionNames` | 06_DataSetup.js | refreshSectionList gets every section in one request |
| `promptAndConfirmBatchCommentToAllStudents` | 07_BatchActions.js | same text in every comment cell, then Post comments (Lara, 2026-10-23) |
| `fillGradesForSelectedGradingPeriodInActiveColumn` | 07_BatchActions.js | past-quarter gradebook scores not needed for Jupiter (Lara) |
| `batchExportAllStudentGrades` | 07_BatchActions.js | Jupiter's reports replace it (Lara); broken in legacy |
| `setupRubricUI` | 09_MiscTools.js | Lara copies a rubric template tab instead |
| `createDropdowns` | 09_MiscTools.js | older copy; clashes with Config cells (port createDropdowns1 instead) |
| `parseJsonToSheet` | 09_MiscTools.js | goes with the API Batch runner (left behind) |
| `mapMultipleCanvasAssignmentsToJupiterExport` | 10_Jupiter.gs.js | not in Lara's workflow (she uses CreateRoster + Update Grades) |

## Not yet reviewed (0)

_None._
