/**
 * Menus.js
 * Purpose: the project's one menu, "Course Manager Tools", built by onOpen
 *   (SetupCheck.js), all in one place so the layout is easy to see and change. Buttons on
 *   the Home tab are the everyday way in; the menu holds everything.
 *   Since 2026-11-12 (Lara): one menu instead of two ("Canvas Tools" and "Setup & Data"),
 *   grouped by teacher task with plain labels, because many teachers find spreadsheets
 *   intimidating. Function names are unchanged, so every button keeps working. The items
 *   the Setup… panel covers (Set Canvas token, Test Canvas connection, Preview mode
 *   show/switch, Check setup) left the menu; their functions stay for any old buttons.
 *   Order: Home and User guide; creating in Canvas (a list of items, one item with
 *   dates); grading (Jupiter, one assignment's scores and comments); groups; assignment
 *   order; checking and backing up the course (Course check, Quiz Check, content list,
 *   Google Docs export); classroom (seating chart, rubric); then Setup…, 📥 Bring over
 *   from my old copy… (BringOver.js, 2026-11-13), Refresh tables… (RefreshPanel.js),
 *   and Advanced (Refresh all tables, the two label checks).
 *   The two older quiz reports were taken off on 2026-11-09 (see below).
 *   Also here: goToHomePage (jumps to the Home tab), showUserGuide / showUserGuideLarge,
 *   and refreshAllTables (every ref_ table refresh in a row, except Jupiter categories,
 *   then Course check, then one summary).
 * Canvas endpoints called: those of the refreshes it runs (all GET; see RefSheets.js).
 * Canvas write operations: none here (the menu items for write tools call their own
 *   files, which go through canvasWrite_).
 * Required User/Script Properties: none here.
 */

/** The menu's name, also used in messages that point to a menu item. */
const MENU_NAME = 'Course Manager Tools';

/** Builds the menu. Called once by onOpen. */
function buildMenus_() {
  const ui = SpreadsheetApp.getUi();

  ui.createMenu(MENU_NAME)
    .addItem('🏠 Go to Home tab', 'goToHomePage')
    .addItem('❓ User guide', 'showUserGuide')
    .addSeparator()
    .addSubMenu(ui.createMenu('Add a list of items (createByRow)')
      .addItem('Check selected rows', 'previewRows')
      .addItem('Send selected rows to Canvas', 'postRows'))
    .addSubMenu(ui.createMenu('Add one item with dates (makeAssignment)')
      .addItem('Check this tab', 'previewAssignment')
      .addItem('Send this tab to Canvas (item, section dates, questions)',
        'makeAssignmentAll')
      .addItem('Set up due-time choices', 'createDropdowns1')
      .addItem('Start over: clear IDs and statuses', 'clearCreationIDs'))
    .addSeparator()
    .addSubMenu(ui.createMenu('Grades & Jupiter')
      .addItem('Build class list on this tab', 'createActiveSheetRoster')
      .addItem('Get latest grades for Jupiter', 'buildJupiterExportFromRecentCanvasGrades')
      .addSeparator()
      .addItem('Get scores into this column (assignment ID in row 2)',
        'pullScoresForActiveColumn')
      .addItem('Send comments from this column (assignment ID in row 2)',
        'postCommentsForActiveColumn'))
    .addSubMenu(ui.createMenu('Groups')
      .addItem('Make a group set', 'createGroupCategory')
      .addItem('Make the groups', 'createGroups')
      .addItem('Clear group info on this tab', 'clearGroupData')
      .addSeparator()
      .addItem('Get groups into this column (group set ID in row 2)',
        'pullGroupsForActiveColumn')
      .addItem('Put students in groups from this column (group set ID in row 2)',
        'putStudentsInGroupsFromActiveColumn')
      .addSeparator()
      .addItem('List groups and members on this tab', 'listGroupsAndMembers'))
    .addSubMenu(ui.createMenu('Assignment order')
      .addItem('Open reorder tool', 'openReorderTool')
      .addItem('Number selected rows 1, 2, 3…', 'numberSelectedRows')
      .addItem('Check the new order', 'previewReorder')
      .addItem('Send the new order to Canvas', 'pushReorder'))
    // Quiz report (runQuizReport) and Quiz report from export file (showQuizExportUpload)
    // are off the menu (Lara, 2026-11-09): neither sees everything a course export shows
    // (banks, New Quizzes, other courses' pictures), so teachers would have to guess what
    // they miss. The code stays (put a line back to bring one back); the course-export
    // Quiz Check takes their place.
    .addSubMenu(ui.createMenu('Check & back up course')
      .addItem('Find possible setup mistakes', 'runCourseCheck')
      .addItem('Check a quiz before giving it', 'showQuizCheck')
      .addSeparator()
      .addItem('List everything in the course on this tab', 'listCourseContent')
      .addItem('Back up course to Google Docs', 'exportCanvasToDocs'))
    .addSubMenu(ui.createMenu('Classroom')
      .addItem('Build seating chart', 'buildSeatingChart')
      .addItem("Turn this tab's rubric into a Canvas file", 'exportRubricToCanvasFormat'))
    .addSeparator()
    .addItem('Setup…', 'showSetupPanel')
    .addItem('📥 Bring over from my old copy…', 'showBringOverPanel')
    .addItem('Refresh tables…', 'showRefreshPanel')
    .addSubMenu(ui.createMenu('Advanced')
      .addItem('Refresh all tables', 'refreshAllTables')
      .addItem('Check createByRow labels', 'checkCreateByRowLabels')
      .addItem('Check makeAssignment labels (this tab)', 'checkMakeAssignmentLabels'))
    .addToUi();
}

/** Menu: Course Manager Tools › Go to Home tab. Finds the tab named Home (any emoji). */
function goToHomePage() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const home = findHomeSheet_(ss.getSheets().map(sheet => sheet.getName()));
  if (!home) {
    SpreadsheetApp.getUi().alert('Go to Home tab', 'There is no tab named "Home" (with or ' +
      'without an emoji).', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }
  ss.getSheetByName(home).activate();
}

/**
 * Menu: Course Manager Tools › ❓ User guide. Opens UserGuide.html in the side panel, docked on
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
 * Menu: Course Manager Tools › Advanced › Refresh all tables. Runs each reference-table refresh in turn
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
