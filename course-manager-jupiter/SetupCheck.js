/**
 * SetupCheck.js
 * Purpose: the project's onOpen (builds the Course Manager menu, rebuilds ref_Index
 *   silently) and the setup check, run silently on open and on demand from "Check
 *   setup". Confirms the reference sheets built so far (SHEETS_BUILT) and the cfg_ named
 *   ranges (CFG_NAMES) exist. Reports names and counts only, never cell values.
 * Canvas endpoints called: none.
 * Canvas write operations: none.
 * Required User/Script Properties: none.
 */

/**
 * This is the project's only onOpen. Other files add their menu items through
 * helper functions that onOpen calls; never add a second onOpen.
 * Runs automatically when the spreadsheet opens. Silent when setup is complete.
 */
function onOpen() {
  const menu = SpreadsheetApp.getUi().createMenu('Course Manager');
  addSetupMenuItems_(menu);
  addCredentialsMenuItems_(menu);
  addCanvasApiMenuItems_(menu);
  addRefSheetsMenuItems_(menu);
  addReorderToolMenuItems_(menu);
  addSheetIndexMenuItems_(menu);
  addSeatingChartMenuItems_(menu);
  addJupiterMenuItems_(menu);
  addGroupsMenuItems_(menu);
  menu.addToUi();

  // Rebuild ref_Index first (silently), so a new one exists before the setup check.
  try {
    buildSheetIndex_(SpreadsheetApp.getActiveSpreadsheet());
  } catch (error) {
    console.error('Sheet index refresh on open failed: ' + error.message);
  }

  try {
    const problems = findSetupProblems_();
    if (problems.count > 0) {
      SpreadsheetApp.getUi().alert('Setup check', formatSetupProblems_(problems),
        SpreadsheetApp.getUi().ButtonSet.OK);
    }
  } catch (error) {
    console.error('Startup check failed: ' + error.message);
    try {
      SpreadsheetApp.getUi().alert('The setup check could not run: ' + error.message);
    } catch (alertError) {
      console.error('Could not show the setup alert: ' + alertError.message);
    }
  }
}

/** Adds this file's menu items. onOpen calls one helper like this per file. */
function addSetupMenuItems_(menu) {
  menu.addItem('Check setup', 'checkSetup');
}

/** Menu: Course Manager › Check setup. Says "Setup OK" when nothing is missing. */
function checkSetup() {
  const ui = SpreadsheetApp.getUi();
  try {
    const problems = findSetupProblems_();
    ui.alert('Setup check',
      problems.count ? formatSetupProblems_(problems) : 'Setup OK', ui.ButtonSet.OK);
  } catch (error) {
    console.error('Setup check failed: ' + error.message);
    ui.alert('The setup check could not run: ' + error.message);
  }
}

/** Lists missing sheets and named ranges by name. */
function findSetupProblems_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const missingSheets = SHEETS_BUILT.filter(name => !ss.getSheetByName(name));
  const missingRanges = CFG_NAMES.filter(name => !ss.getRangeByName(name));
  return { missingSheets, missingRanges, count: missingSheets.length + missingRanges.length };
}

/** Builds the alert text: counts and names only. */
function formatSetupProblems_(problems) {
  const parts = [];
  if (problems.missingSheets.length) {
    parts.push(`Missing sheets (${problems.missingSheets.length}):\n• ` +
      problems.missingSheets.join('\n• '));
  }
  if (problems.missingRanges.length) {
    parts.push(`Missing named ranges (${problems.missingRanges.length}):\n• ` +
      problems.missingRanges.join('\n• '));
  }
  return parts.join('\n\n');
}
