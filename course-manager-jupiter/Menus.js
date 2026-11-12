/**
 * Menus.js
 * Purpose: the project's two menus, built by onOpen (SetupCheck.js), all in one place so
 *   the layout is easy to see and change. Buttons on the Home tab are the everyday way
 *   in; the menus hold everything, including data chores (Lara, 2026-10-18; legacy also
 *   had two menus, "Canvas Tools" and "Setup & Admin"). Function names are unchanged, so
 *   every button keeps working.
 *   - Canvas Tools: doing things (create, reorder, groups, rubrics, Jupiter, grading
 *     sheet one-assignment tools, list course content and export to Google
 *     Docs, Quiz Check (course export; QuizCheck.js), seating; the two older quiz
 *     reports were taken off on 2026-11-09),
 *     and Course check (read-only report, CourseCheck.js) near the bottom, then
 *     ❓ User guide (showUserGuide, below; opens UserGuide.html in the side panel, with
 *     showUserGuideLarge for the big window).
 *   - Setup & Data: refreshing reference tables (Refresh tables… opens the checkbox side
 *     panel, RefreshPanel.js), Jupiter categories (manual, on purpose), and setup /
 *     safety checks.
 *   Also here: goToHomePage (jumps to the Home tab) and refreshAllTables (every ref_
 *   table refresh in a row, except Jupiter categories, then Course check, then one
 *   summary).
 * Canvas endpoints called: those of the refreshes it runs (all GET; see RefSheets.js).
 * Canvas write operations: none here (the menu items for write tools call their own
 *   files, which go through canvasWrite_).
 * Required User/Script Properties: none here.
 */

/** Builds both menus. Called once by onOpen. */
function buildMenus_() {
  const ui = SpreadsheetApp.getUi();

  ui.createMenu('Canvas Tools')
    .addItem('🏠 Go to Home page', 'goToHomePage')
    .addSeparator()
    .addSubMenu(ui.createMenu('Create in Canvas')
      .addItem('Preview selected rows (createByRow)', 'previewRows')
      .addItem('Post selected rows (createByRow)', 'postRows')
      .addSeparator()
      .addItem('Preview assignment (this tab)', 'previewAssignment')
      .addItem('makeAll: create assignment, overrides, questions (this tab)',
        'makeAssignmentAll')
      .addItem('Get Times: Due Time dropdowns (this tab)', 'createDropdowns1')
      .addItem('Clear IDs, Status, Payload (this tab)', 'clearCreationIDs'))
    .addSubMenu(ui.createMenu('Assignment order')
      .addItem('Open reorder tool', 'openReorderTool')
      .addItem('Number selected rows 1, 2, 3…', 'numberSelectedRows')
      .addItem('Preview reorder', 'previewReorder')
      .addItem('Push reorder', 'pushReorder'))
    .addSubMenu(ui.createMenu('Groups')
      .addItem('Create group category', 'createGroupCategory')
      .addItem('Create groups', 'createGroups')
      .addItem('Clear group data', 'clearGroupData')
      .addSeparator()
      .addItem('Pull groups into this column (set ID in row 2)', 'pullGroupsForActiveColumn')
      .addItem('Put students in groups from this column (set ID in row 2)',
        'putStudentsInGroupsFromActiveColumn')
      .addSeparator()
      .addItem('List groups and members (this tab)', 'listGroupsAndMembers'))
    .addSubMenu(ui.createMenu('Rubrics')
      .addItem('Export rubric for Canvas (this tab)', 'exportRubricToCanvasFormat'))
    .addSubMenu(ui.createMenu('Jupiter')
      .addItem('CreateRoster (grading sheet)', 'createActiveSheetRoster')
      .addItem('Update Grades → JupiterExport (grading sheet)',
        'buildJupiterExportFromRecentCanvasGrades'))
    .addSubMenu(ui.createMenu('Grading sheet')
      .addItem('Pull scores into this column (ID in row 2)', 'pullScoresForActiveColumn')
      .addItem('Post comments from this column (ID in row 2)', 'postCommentsForActiveColumn'))
    .addItem('List course content (this tab)', 'listCourseContent')
    .addItem('Export to Google Docs (this tab)', 'exportCanvasToDocs')
    // Quiz report (runQuizReport) and Quiz report from export file (showQuizExportUpload)
    // are off the menu (Lara, 2026-11-09): neither sees everything a course export shows
    // (banks, New Quizzes, other courses' pictures), so teachers would have to guess what
    // they miss. The code stays (put a line back to bring one back); the course-export
    // Quiz Check takes their place.
    .addItem('Quiz Check', 'showQuizCheck')
    .addSeparator()
    .addItem('Build seating chart', 'buildSeatingChart')
    .addSeparator()
    .addItem('Course check (possible setup mistakes)', 'runCourseCheck')
    .addSeparator()
    .addItem('❓ User guide', 'showUserGuide')
    .addToUi();

  ui.createMenu('Setup & Data')
    .addItem('Refresh tables…', 'showRefreshPanel')
    .addItem('Refresh all tables', 'refreshAllTables')
    // The one-table refreshes (refreshCourseList, refreshPeopleList,
    // refreshAssignmentGroups, refreshSectionList, refreshSheetIndex,
    // refreshJupiterCategories) left the menu on 2026-11-11 (Lara): the panel covers them.
    // The functions stay, for the Home and ref_Config buttons.
    .addSeparator()
    .addSubMenu(ui.createMenu('Setup & safety')
      .addItem('Set Canvas token', 'setCanvasCredentials')
      .addItem('Test Canvas connection', 'testCanvasConnection')
      .addItem('Dry run: show status', 'showDryRunStatus')
      .addItem('Dry run: switch on/off', 'toggleDryRun')
      .addSeparator()
      .addItem('Check setup', 'checkSetup')
      .addItem('Check createByRow labels', 'checkCreateByRowLabels')
      .addItem('Check makeAssignment labels (this tab)', 'checkMakeAssignmentLabels'))
    .addToUi();
}

/** Menu: Canvas Tools › Go to Home page. Finds the tab named Home (any emoji). */
function goToHomePage() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const home = findHomeSheet_(ss.getSheets().map(sheet => sheet.getName()));
  if (!home) {
    SpreadsheetApp.getUi().alert('Go to Home page', 'There is no tab named "Home" (with or ' +
      'without an emoji).', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }
  ss.getSheetByName(home).activate();
}

/**
 * Menu: Canvas Tools › ❓ User guide. Opens UserGuide.html in the side panel, docked on
 * the right, so teachers can follow the steps while they work (Lara, 2026-11-08). The
 * panel has a link to showUserGuideLarge. No Canvas calls; the page holds only the guide
 * text. A Home-tab button can call showUserGuide too.
 */
function showUserGuide() {
  const html = HtmlService.createHtmlOutputFromFile('UserGuide')
    .setTitle('Course Manager (Jupiter edition) — User Guide');
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Called from the side panel's "Open in a large window" link (google.script.run), so it
 * has no trailing underscore. Opens the same guide in a big window over the sheet.
 */
function showUserGuideLarge() {
  const html = HtmlService.createHtmlOutputFromFile('UserGuide')
    .setWidth(900)
    .setHeight(650);
  SpreadsheetApp.getUi().showModelessDialog(html,
    'Course Manager (Jupiter edition) — User Guide');
}

/** The name of the Home tab: "Home" once emoji, symbols, and spaces are ignored. */
function findHomeSheet_(names) {
  return names.find(name => name.replace(/[^A-Za-z]/g, '').toLowerCase() === 'home') || '';
}

/**
 * Menu: Setup & Data › Refresh all tables. Runs each reference-table refresh in turn
 * (course list, people list, assignment groups, section list, sheet index), then Course
 * check on the assignments just downloaded (one step of its own since 2026-11-11); one that
 * fails doesn't stop the others. Jupiter categories are left out on purpose (Lara
 * refreshes them by hand while looking at ref_Config). Reads Canvas only. One summary
 * at the end, counts only.
 */
function refreshAllTables() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // The table list is shared with the Refresh tables panel (RefreshPanel.js). shared
  // passes the assignment groups download on to Course check (fetched once).
  const shared = {};
  const steps = refreshTableList_().filter(table => table.inAll)
    .map(table => [table.label, () => table.run(ss, shared)]);
  const lines = runRefreshSteps_(steps, (label, i) => ss.toast(
    `Refreshing ${label.toLowerCase()}… (${i + 1} of ${steps.length})`, 'Refresh all tables', -1));
  const failed = lines.filter(line => line.startsWith('✗')).length;
  console.log(`Refresh all tables: ${steps.length - failed} done, ${failed} failed.`);
  ss.toast(failed ? `${failed} refresh(es) failed.` : 'All tables refreshed.',
    'Refresh all tables', 3);
  SpreadsheetApp.getUi().alert('Refresh all tables', lines.join('\n') +
    (failed ? '\n\nTables that failed were not changed.' : ''),
  SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Runs [label, work] steps in order; work returns a short count summary. Returns one
 * line per step: "✓ label: summary" or "✗ label: why". A step's failure never stops the
 * next one. Messages are shown only if safe (sheet problems and Canvas error types).
 * onStep(label, index), if given, runs before each step (for a progress message).
 */
function runRefreshSteps_(steps, onStep) {
  return steps.map(([label, work], i) => {
    if (onStep) onStep(label, i);
    try {
      return `✓ ${label}: ${work()}`;
    } catch (error) {
      console.error(`Refresh all tables: ${label} failed: ${error.canvasType || error.message}`);
      const why = error.canvasType || error.isSheetProblem ? error.message :
        'unexpected error (see Extensions › Apps Script › Executions)';
      return `✗ ${label}: ${why}`;
    }
  });
}
