/**
 * SetupPanel.js
 * Purpose: the "Setup" side panel (Lara, 2026-11-11): one place to see whether the
 *   workbook is ready and fix it, instead of the Setup & safety menu items. Sections:
 *   Canvas connection (address, token saved or not, Test connection), set or change the
 *   token (saved by saveCanvasCredentialsFromPanel in Credentials.js), which course
 *   (one box filled in from cfg_CourseID to change it, Canvas's name for the course
 *   fetched by itself, and a link to ref_Config; Lara, 2026-11-11), dry run (status,
 *   turn on/off), and the setup check (missing tabs and named ranges;
 *   findSetupProblems_ in SetupCheck.js).
 *   - showSetupPanel (menu: Setup & Data › Setup…): opens SetupPanelPage.html.
 *   - getSetupStatus, testSetupConnection, checkSetupCourse, saveSetupCourseId,
 *     openSetupConfig, setDryRunFromPanel: called by the panel (google.script.run). They
 *     return plain objects or text and never throw (openSetupConfig aside).
 *   The token is never sent to the panel: status says only whether one is saved.
 * Canvas endpoints called (GET, via canvasGet_): /api/v1/users/self (Test connection),
 *   /api/v1/courses/:course (the course's name, when the panel opens and after a save).
 * Canvas write operations: none.
 * Required User/Script Properties: reads User Properties CANVAS_BASE_URL and
 *   CANVAS_TOKEN (whether saved; never shown); reads and writes Script Property DRY_RUN.
 *   Named ranges cfg_CourseID (read, and written by Save course) and cfg_CourseName
 *   (shown if filled in); ref_Config B2 (the school's Canvas address, read only, to
 *   fill in the address box).
 */

const SETUP_PANEL_TITLE = 'Setup';
// ref_Config B2: the school's Canvas address (its legacy spot; Lara, 2026-11-11). Only
// fills in the panel's address box; tools always use the teacher's saved CANVAS_BASE_URL.
// Kept in the sheet so the school's address never goes into this public code.
const SETUP_DEFAULT_URL_CELL = 'B2';

/** Menu: Setup & Data › Setup…. Opens the panel on the right. */
function showSetupPanel() {
  const html = HtmlService.createHtmlOutputFromFile('SetupPanelPage').setTitle(SETUP_PANEL_TITLE);
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Called by the panel when it opens and after each change: { baseUrl, defaultBaseUrl
 * (ref_Config B2, or ''), hasToken, dryRun,
 * courseId, courseName, courseProblem, setupProblems: { missingSheets, missingRanges,
 * count } or null, setupError }. Never includes the token.
 */
function getSetupStatus() {
  const props = PropertiesService.getUserProperties();
  const status = {
    baseUrl: props.getProperty(PROP_BASE_URL) || '',
    hasToken: Boolean(props.getProperty(PROP_TOKEN)),
    dryRun: true,
    courseId: '',
    courseName: '',
    courseProblem: '',
    setupProblems: null,
    setupError: '',
  };
  status.defaultBaseUrl = readDefaultBaseUrl_();
  try {
    status.dryRun = isDryRun_();
  } catch (error) {
    console.error('Setup panel: dry run read failed: ' + error.message);
  }
  try {
    status.courseId = getCourseIdForRefresh_();
  } catch (error) {
    status.courseProblem = error.isSheetProblem ? error.message : 'cfg_CourseID could not be read.';
  }
  try {
    const name = String(getCfg_('CourseName')).trim();
    // "#N/A" and the like: the course isn't on ref_CourseIDs yet.
    if (!name.startsWith('#')) status.courseName = name;
  } catch {
    // Optional: the panel shows the course number alone.
  }
  try {
    status.setupProblems = findSetupProblems_();
  } catch (error) {
    console.error('Setup panel: setup check failed: ' + error.message);
    status.setupError = 'The setup check could not run.';
  }
  return status;
}

/**
 * The Canvas address in ref_Config B2, as "https://host", or '' if the tab or cell is
 * missing, blank, or not a web address.
 */
function readDefaultBaseUrl_() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.CONFIG);
    const text = sheet ? String(sheet.getRange(SETUP_DEFAULT_URL_CELL).getValue()).trim() : '';
    return text ? normalizeBaseUrl_(text) : '';
  } catch {
    return '';
  }
}

/** Called by the panel: Test connection. { ok, message } (Canvas error type only). */
function testSetupConnection() {
  try {
    canvasGet_('/users/self');
    return { ok: true, message: 'Connected.' };
  } catch (error) {
    console.error('Setup panel: connection test failed: ' + (error.canvasType || 'UNEXPECTED'));
    return { ok: false, message: 'Not connected. ' + describeCanvasError_(error) };
  }
}

/**
 * Called by the panel when it opens and after a save. Reads the cfg_CourseID course from
 * Canvas and returns { ok, message } with its name and code, or why it couldn't be read.
 */
function checkSetupCourse() {
  try {
    const courseId = getCourseIdForRefresh_();
    const course = canvasGet_('/courses/' + courseId);
    const name = String((course && course.name) || '').trim() || '(no name)';
    const code = String((course && course.course_code) || '').trim();
    const shownCode = code && code !== name ? ` (${code})` : '';
    return { ok: true, message: `Canvas has "${name}"${shownCode}, course ${courseId}.` };
  } catch (error) {
    console.error('Setup panel: course check failed: ' + (error.canvasType || error.message));
    if (error.canvasType === 'NOT_FOUND' || error.canvasType === 'NOT_ALLOWED') {
      return { ok: false, message: `${describeCanvasError_(error)} Check the course number ` +
        '(cfg_CourseID): it should be the number in the course\'s Canvas address. Change ' +
        'it above.' };
    }
    return { ok: false, message: error.isSheetProblem ? error.message :
      describeCanvasError_(error) };
  }
}

/**
 * The course number from what was typed: digits, or a Canvas course address
 * (".../courses/12345/..."). '' if neither.
 */
function parseCourseIdInput_(text) {
  const value = String(text || '').trim();
  if (/^\d+$/.test(value)) return value;
  const match = value.match(/\/courses\/(\d+)(?:[/?#]|$)/);
  return match ? match[1] : '';
}

/**
 * Called by the panel: Save course. Writes the course number into cfg_CourseID (ref_Config)
 * and returns { ok, message, status }. Refuses if the cell holds a formula. The sheet's
 * cfg_CourseName formula follows by itself (it looks the number up in ref_CourseIDs).
 * Changes nothing in Canvas.
 */
function saveSetupCourseId(text) {
  try {
    const courseId = parseCourseIdInput_(text);
    if (!courseId) {
      return { ok: false, message: 'Type the course number, or paste the course\'s Canvas ' +
        'address (it has /courses/ and the number in it). Nothing was changed.' };
    }
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const range = ss.getRangeByName('cfg_CourseID');
    if (!range) {
      return { ok: false, message: 'The named range cfg_CourseID is missing (Data › Named ' +
        'ranges). Nothing was changed.' };
    }
    const cell = range.getCell(1, 1);
    if (cell.getFormula()) {
      return { ok: false, message: 'cfg_CourseID holds a formula, so it was left alone. ' +
        'Change it on ref_Config.' };
    }
    const before = String(cell.getValue()).replace(/\.0$/, '').trim();
    if (before === courseId) {
      return { ok: true, message: `Already course ${courseId}. Nothing was changed.`,
        status: getSetupStatus() };
    }
    cell.setValue(Number(courseId));
    SpreadsheetApp.flush(); // so cfg_CourseName's formula catches up before the status
    console.log('Setup panel: cfg_CourseID changed.');
    return { ok: true, message: `Changed to course ${courseId}` +
      (before ? ` (was ${before})` : '') + '. Next: refresh the tables (Refresh tables…, All).',
    status: getSetupStatus() };
  } catch (error) {
    console.error('Setup panel: course save failed: ' + error.message);
    return { ok: false, message: 'Could not change cfg_CourseID. Nothing was changed.' };
  }
}

/**
 * Called by the panel's "Open ref_Config" link: shows ref_Config (unhiding it if needed)
 * and selects cfg_CourseID. Returns '' or a short message for the panel.
 */
function openSetupConfig() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.CONFIG);
  if (!sheet) return `There is no ${SHEETS.CONFIG} tab.`;
  if (sheet.isSheetHidden()) sheet.showSheet();
  sheet.activate();
  const range = ss.getRangeByName('cfg_CourseID');
  if (range) range.activate();
  return '';
}

/**
 * Called by the panel after its own "are you sure" step: turns dry run on (true) or off
 * (false). Returns the new status (getSetupStatus).
 */
function setDryRunFromPanel(on) {
  PropertiesService.getScriptProperties().setProperty(PROP_DRY_RUN, on ? 'true' : 'false');
  console.log('Dry run switched ' + (on ? 'ON' : 'OFF') + ' (Setup panel).');
  return getSetupStatus();
}
