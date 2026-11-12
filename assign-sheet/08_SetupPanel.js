/**
 * 08_SetupPanel.js
 * Purpose: the "Setup" side panel (Lara, 2026-11-12, modelled on course-manager-jupiter's
 *   Setup & Data › Setup…): one place to see whether the sheet is ready and fix it.
 *   Replaces the ⚙️ Setup submenu (Set Canvas token, Test Canvas connection, Dry run:
 *   show status / switch on/off). Four parts: Canvas connection (address, token saved
 *   or not, Test connection), set or change the token (saveCanvasCredentialsFromPanel
 *   in 06_Credentials.js), which course (*Config* B4 in a box to change it, Canvas's
 *   name for the course, an Open Config link), and dry run (status, turn on/off).
 *   - showSetupPanel (menu: Canvas Tools › ⚙️ Setup…): opens SetupPanelPage.html.
 *   - getSetupStatus, testSetupConnection, checkSetupCourse, saveSetupCourseId,
 *     openSetupConfig, setDryRunFromPanel: called by the panel (google.script.run). They
 *     return plain objects or text and never throw.
 *   The whole token is never sent to the panel: status says whether one is saved, its
 *   last 4 characters, and when it was saved. Each teacher only ever sees their own.
 * Canvas endpoints called (GET, via canvasGet_): /api/v1/users/self (Test connection),
 *   /api/v1/courses/:course (the course's name).
 * Canvas write operations: none.
 * Required User/Script Properties: reads User Properties CANVAS_BASE_URL, CANVAS_TOKEN
 *   (whether saved, and its last 4 characters), CANVAS_TOKEN_SAVED; reads and writes
 *   Script Property DRY_RUN. Reads *Config* B2 (the school's Canvas address, only to
 *   fill in the address box) and B4; writes B4 (Save course).
 */

const SETUP_PANEL_TITLE = 'Setup';
const SETUP_CONFIG_SHEET = '*Config*';
// *Config* B2: the school's Canvas address. Only fills in the panel's address box; tools
// always use the teacher's saved CANVAS_BASE_URL. Kept in the sheet so the school's
// address never goes into this public code.
const SETUP_DEFAULT_URL_CELL = 'B2';
const SETUP_COURSE_CELL = 'B4';

/** Menu: Canvas Tools › ⚙️ Setup…. Opens the panel on the right. */
function showSetupPanel() {
  const html = HtmlService.createHtmlOutputFromFile('SetupPanelPage').setTitle(SETUP_PANEL_TITLE);
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Called by the panel when it opens and after each change: { baseUrl, defaultBaseUrl
 * (*Config* B2, or ''), hasToken, tokenHint (last 4 characters, or ''), tokenSavedOn
 * ('11/12/2026', or ''), dryRun, courseId, courseProblem }. Never includes the whole
 * token.
 */
function getSetupStatus() {
  const props = PropertiesService.getUserProperties();
  const status = {
    baseUrl: props.getProperty(PROP_BASE_URL) || '',
    defaultBaseUrl: readDefaultBaseUrl_(),
    hasToken: Boolean(props.getProperty(PROP_TOKEN)),
    tokenHint: '',
    tokenSavedOn: '',
    dryRun: true,
    courseId: '',
    courseProblem: '',
  };
  const token = tokenHint_(props);
  status.tokenHint = token.hint;
  if (token.savedAt) {
    try {
      status.tokenSavedOn = Utilities.formatDate(new Date(token.savedAt),
        SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'M/d/yyyy');
    } catch {
      // Unreadable date: the panel shows the hint alone.
    }
  }
  try {
    status.dryRun = isDryRun_();
  } catch (error) {
    console.error('Setup panel: dry run read failed: ' + error.message);
  }
  try {
    status.courseId = readSetupCourseId_();
  } catch (error) {
    status.courseProblem = error.isSheetProblem ? error.message :
      `${SETUP_CONFIG_SHEET} ${SETUP_COURSE_CELL} could not be read.`;
  }
  return status;
}

/**
 * The Canvas address in *Config* B2, as "https://host", or '' if the tab or cell is
 * missing, blank, or not a web address.
 */
function readDefaultBaseUrl_() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SETUP_CONFIG_SHEET);
    const text = sheet ? String(sheet.getRange(SETUP_DEFAULT_URL_CELL).getValue()).trim() : '';
    return text ? normalizeBaseUrl_(text) : '';
  } catch {
    return '';
  }
}

/** The course number in *Config* B4 as text. Throws a sheet problem if missing. */
function readSetupCourseId_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SETUP_CONFIG_SHEET);
  if (!sheet) throw setupSheetProblem_(`There is no ${SETUP_CONFIG_SHEET} tab.`);
  const value = String(sheet.getRange(SETUP_COURSE_CELL).getValue()).replace(/\.0$/, '').trim();
  if (!value) {
    throw setupSheetProblem_(`No course number yet (${SETUP_CONFIG_SHEET} ` +
      `${SETUP_COURSE_CELL}). Type it below.`);
  }
  return value;
}

function setupSheetProblem_(message) {
  const error = new Error(message);
  error.isSheetProblem = true;
  return error;
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
 * Called by the panel when the course number shown changes. Reads the *Config* B4
 * course from Canvas and returns { ok, message } with its name and code, or why not.
 */
function checkSetupCourse() {
  try {
    const courseId = readSetupCourseId_();
    const course = canvasGet_('/courses/' + encodeURIComponent(courseId));
    const name = String((course && course.name) || '').trim() || '(no name)';
    const code = String((course && course.course_code) || '').trim();
    const shownCode = code && code !== name ? ` (${code})` : '';
    return { ok: true, message: `Canvas has "${name}"${shownCode}, course ${courseId}.` };
  } catch (error) {
    console.error('Setup panel: course check failed: ' + (error.canvasType || 'sheet'));
    if (error.canvasType === 'NOT_FOUND' || error.canvasType === 'NOT_ALLOWED') {
      return { ok: false, message: `${describeCanvasError_(error)} Check the course ` +
        'number: it should be the number after /courses/ in the course\'s Canvas address.' };
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
 * Called by the panel: Save course. Writes the course number into *Config* B4 and
 * returns { ok, message, status }. Refuses if the cell holds a formula. Changes nothing
 * in Canvas.
 */
function saveSetupCourseId(text) {
  try {
    const courseId = parseCourseIdInput_(text);
    if (!courseId) {
      return { ok: false, message: 'Type the course number, or paste the course\'s Canvas ' +
        'address (it has /courses/ and the number in it). Nothing was changed.' };
    }
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SETUP_CONFIG_SHEET);
    if (!sheet) {
      return { ok: false, message: `There is no ${SETUP_CONFIG_SHEET} tab. Nothing was changed.` };
    }
    const cell = sheet.getRange(SETUP_COURSE_CELL);
    if (cell.getFormula()) {
      return { ok: false, message: `${SETUP_CONFIG_SHEET} ${SETUP_COURSE_CELL} holds a ` +
        `formula, so it was left alone. Change it on the ${SETUP_CONFIG_SHEET} tab.` };
    }
    const before = String(cell.getValue()).replace(/\.0$/, '').trim();
    if (before === courseId) {
      return { ok: true, message: `Already course ${courseId}. Nothing was changed.`,
        status: getSetupStatus() };
    }
    cell.setValue(Number(courseId));
    console.log('Setup panel: course number changed.');
    return { ok: true, message: `Changed to course ${courseId}` +
      (before ? ` (was ${before})` : '') + '. Next: load assignment dates again ' +
      '(📝 Assignment dates › Load assignment dates from Canvas).',
    status: getSetupStatus() };
  } catch (error) {
    console.error('Setup panel: course save failed: ' + error.message);
    return { ok: false, message: 'Could not change the course number. Nothing was changed.' };
  }
}

/**
 * Called by the panel's "Open Config" link: shows *Config* (unhiding it if needed) and
 * selects B4. Returns '' or a short message for the panel.
 */
function openSetupConfig() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SETUP_CONFIG_SHEET);
    if (!sheet) return `There is no ${SETUP_CONFIG_SHEET} tab.`;
    if (sheet.isSheetHidden()) sheet.showSheet();
    sheet.activate();
    sheet.getRange(SETUP_COURSE_CELL).activate();
    return '';
  } catch (error) {
    console.error('Setup panel: open Config failed: ' + error.message);
    return `Could not open the ${SETUP_CONFIG_SHEET} tab.`;
  }
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
