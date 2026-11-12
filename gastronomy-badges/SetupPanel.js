/**
 * SetupPanel.js
 * Purpose: the "Setup" side panel (Lara, 2026-11-12, modelled on course-manager-jupiter's
 *   Setup & Data › Setup…): one place to see whether the sheet is ready and fix it.
 *   Replaces the old "1. Set API Key and Base URL" prompt. Three parts: Canvas
 *   connection (address, token saved or not, Test connection), set or change the token
 *   (saveCanvasCredentialsFromPanel in Credentials.js), and which course (*Config* B4 in
 *   a box to change it, Canvas's name for the course, and an Open Config link). No dry
 *   run part: this sheet never changes Canvas.
 *   - showSetupPanel (menu: Canvas Tools › Setup…): opens SetupPanelPage.html.
 *   - getSetupStatus, testSetupConnection, checkSetupCourse, saveSetupCourseId,
 *     openSetupConfig: called by the panel (google.script.run). They return plain
 *     objects or text and never throw.
 *   - canvasGetJson_: the panel's Canvas request helper (auth header,
 *     muteHttpExceptions, response code check). The older tools still make their own
 *     requests (BRIEF clean-up item 3 moves them here).
 *   The whole token is never sent to the panel: status says whether one is saved, its
 *   last 4 characters, and when it was saved. Each teacher only ever sees their own.
 * Canvas endpoints called (GET only): /api/v1/users/self (Test connection),
 *   /api/v1/courses/:course (the course's name).
 * Canvas write operations: none.
 * Required User/Script Properties: reads User Properties CANVAS_BASE_URL, CANVAS_TOKEN
 *   (whether saved, and its last 4 characters), CANVAS_TOKEN_SAVED (through
 *   Credentials.js). Reads *Config* B2 and B4; writes B4 (Save course).
 */

const SETUP_PANEL_TITLE = 'Setup';
const CONFIG_COURSE_CELL = 'B4';

/** Menu: Canvas Tools › Setup…. Opens the panel on the right. */
function showSetupPanel() {
  const html = HtmlService.createHtmlOutputFromFile('SetupPanelPage').setTitle(SETUP_PANEL_TITLE);
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Called by the panel when it opens and after each change: { baseUrl, defaultBaseUrl
 * (*Config* B2, or ''), hasToken, tokenHint (last 4 characters, or ''), tokenSavedOn
 * ('11/12/2026', or ''), courseId, courseProblem }. Never includes the whole token.
 */
function getSetupStatus() {
  const props = PropertiesService.getUserProperties();
  const status = {
    baseUrl: getCanvasBaseUrl_(), // also moves an old setup over (Credentials.js)
    defaultBaseUrl: readConfigBaseUrl_(),
    hasToken: Boolean(getCanvasToken_()),
    tokenHint: '',
    tokenSavedOn: '',
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
    status.courseId = readCourseId_();
  } catch (error) {
    status.courseProblem = error.isSheetProblem ? error.message :
      `${CONFIG_SHEET} ${CONFIG_COURSE_CELL} could not be read.`;
  }
  return status;
}

/** The course number in *Config* B4 as text. Throws a sheet problem if missing. */
function readCourseId_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG_SHEET);
  if (!sheet) throw sheetProblem_(`There is no ${CONFIG_SHEET} tab.`);
  const value = String(sheet.getRange(CONFIG_COURSE_CELL).getValue()).replace(/\.0$/, '').trim();
  if (!value) throw sheetProblem_(`No course number yet (${CONFIG_SHEET} ${CONFIG_COURSE_CELL}). Type it below.`);
  return value;
}

function sheetProblem_(message) {
  const error = new Error(message);
  error.isSheetProblem = true;
  return error;
}

/**
 * GET one Canvas API path (for example '/users/self') and return the parsed JSON.
 * Throws an Error with canvasType (NO_SETUP, BAD_TOKEN, NOT_ALLOWED, NOT_FOUND, OTHER)
 * and code. Messages never contain the token or Canvas's reply.
 */
function canvasGetJson_(path) {
  const baseUrl = getCanvasBaseUrl_();
  const token = getCanvasToken_();
  if (!baseUrl || !token) throw canvasError_('NO_SETUP', 0);
  const response = UrlFetchApp.fetch(baseUrl + '/api/v1' + path, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true,
  });
  const code = response.getResponseCode();
  if (code === 401) throw canvasError_('BAD_TOKEN', code);
  if (code === 403) throw canvasError_('NOT_ALLOWED', code);
  if (code === 404) throw canvasError_('NOT_FOUND', code);
  if (code < 200 || code >= 300) throw canvasError_('OTHER', code);
  return JSON.parse(response.getContentText());
}

function canvasError_(type, code) {
  const error = new Error('Canvas request failed: ' + type + (code ? ' (' + code + ')' : ''));
  error.canvasType = type;
  error.code = code;
  return error;
}

/** A teacher-friendly sentence for a canvasGetJson_ error. */
function describeCanvasError_(error) {
  switch (error.canvasType) {
    case 'NO_SETUP': return 'Save your Canvas address and token in part 2 first.';
    case 'BAD_TOKEN': return 'Canvas didn\'t accept the token (it may be expired or ' +
      'mistyped). Make a new one in Canvas and save it in part 2.';
    case 'NOT_ALLOWED': return 'Your Canvas account isn\'t allowed to see that.';
    case 'NOT_FOUND': return 'Canvas couldn\'t find that.';
    case 'OTHER': return `Canvas answered with an error (${error.code}). Wait a minute ` +
      'and try again, and check the Canvas address.';
    default: return 'Canvas couldn\'t be reached. Check the Canvas address in part 2.';
  }
}

/** Called by the panel: Test connection. { ok, message } (Canvas error type only). */
function testSetupConnection() {
  try {
    canvasGetJson_('/users/self');
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
    const courseId = readCourseId_();
    const course = canvasGetJson_('/courses/' + encodeURIComponent(courseId));
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
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG_SHEET);
    if (!sheet) return { ok: false, message: `There is no ${CONFIG_SHEET} tab. Nothing was changed.` };
    const cell = sheet.getRange(CONFIG_COURSE_CELL);
    if (cell.getFormula()) {
      return { ok: false, message: `${CONFIG_SHEET} ${CONFIG_COURSE_CELL} holds a formula, ` +
        `so it was left alone. Change it on the ${CONFIG_SHEET} tab.` };
    }
    const before = String(cell.getValue()).replace(/\.0$/, '').trim();
    if (before === courseId) {
      return { ok: true, message: `Already course ${courseId}. Nothing was changed.`,
        status: getSetupStatus() };
    }
    cell.setValue(Number(courseId));
    console.log('Setup panel: course number changed.');
    return { ok: true, message: `Changed to course ${courseId}` +
      (before ? ` (was ${before})` : '') + '. Next: Canvas Tools › Run FULL Data Refresh.',
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
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG_SHEET);
    if (!sheet) return `There is no ${CONFIG_SHEET} tab.`;
    if (sheet.isSheetHidden()) sheet.showSheet();
    sheet.activate();
    sheet.getRange(CONFIG_COURSE_CELL).activate();
    return '';
  } catch (error) {
    console.error('Setup panel: open Config failed: ' + error.message);
    return `Could not open the ${CONFIG_SHEET} tab.`;
  }
}
