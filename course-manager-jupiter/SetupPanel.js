/**
 * SetupPanel.js
 * Purpose: the "Setup" side panel (Lara, 2026-11-11): one place to see whether the
 *   workbook is ready and fix it, instead of the Setup & safety menu items. Sections:
 *   Canvas connection (address, token saved or not, Test connection), set or change the
 *   token (saved by saveCanvasCredentialsFromPanel in Credentials.js), which course
 *   (cfg_CourseID, Check course), dry run (status, turn on/off), and the setup check
 *   (missing tabs and named ranges; findSetupProblems_ in SetupCheck.js).
 *   - showSetupPanel (menu: Setup & Data › Setup…): opens SetupPanelPage.html.
 *   - getSetupStatus, testSetupConnection, checkSetupCourse, setDryRunFromPanel: called
 *     by the panel (google.script.run). They return plain objects and never throw.
 *   The token is never sent to the panel: status says only whether one is saved.
 * Canvas endpoints called (GET, via canvasGet_): /api/v1/users/self (Test connection),
 *   /api/v1/courses/:course (Check course).
 * Canvas write operations: none.
 * Required User/Script Properties: reads User Properties CANVAS_BASE_URL and
 *   CANVAS_TOKEN (whether saved; never shown); reads and writes Script Property DRY_RUN.
 *   Named ranges cfg_CourseID and cfg_CourseName (shown if filled in).
 */

const SETUP_PANEL_TITLE = 'Setup';

/** Menu: Setup & Data › Setup…. Opens the panel on the right. */
function showSetupPanel() {
  const html = HtmlService.createHtmlOutputFromFile('SetupPanelPage').setTitle(SETUP_PANEL_TITLE);
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Called by the panel when it opens and after each change: { baseUrl, hasToken, dryRun,
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
    status.courseName = String(getCfg_('CourseName'));
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
 * Called by the panel: Check course. Reads the cfg_CourseID course from Canvas and
 * returns { ok, message } with its name and code, or why it couldn't be read.
 */
function checkSetupCourse() {
  try {
    const courseId = getCourseIdForRefresh_();
    const course = canvasGet_('/courses/' + courseId);
    const name = String((course && course.name) || '').trim() || '(no name)';
    const code = String((course && course.course_code) || '').trim();
    return { ok: true, message: `Canvas has "${name}"` + (code && code !== name ? ` (${code})` : '') +
      `, course ${courseId}. If that's not the course you mean, change cfg_CourseID on ` +
      `${SHEETS.CONFIG}.` };
  } catch (error) {
    console.error('Setup panel: course check failed: ' + (error.canvasType || error.message));
    if (error.canvasType === 'NOT_FOUND' || error.canvasType === 'NOT_ALLOWED') {
      return { ok: false, message: `${describeCanvasError_(error)} Check cfg_CourseID on ` +
        `${SHEETS.CONFIG}: it should be the number in the course's Canvas address.` };
    }
    return { ok: false, message: error.isSheetProblem ? error.message :
      describeCanvasError_(error) };
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
