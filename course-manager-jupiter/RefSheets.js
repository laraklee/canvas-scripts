/**
 * RefSheets.js
 * Purpose: builders for the reference (ref_) sheets. So far: ref_CourseIDs, the list of
 *   courses where you are an active teacher (A = course ID, B = course name), and the
 *   "Refresh course list" menu item. Logs counts only.
 * Canvas endpoints called: GET /api/v1/courses?enrollment_type=teacher
 *   &enrollment_state=active&state[]=available&state[]=unpublished (via canvasGet_).
 * Canvas write operations: none.
 * Required User/Script Properties: User Properties CANVAS_BASE_URL and CANVAS_TOKEN
 *   (read by canvasGet_).
 */

const COURSE_IDS_HEADERS = Object.freeze(['Course ID', 'Course name']);
const COURSE_IDS_REFRESHED_NAME = 'CourseIDs_LastRefreshed';
// Used only the first time, to create the named range. After that, the named range
// is the source of truth, so the cell can be moved in the Sheet.
const COURSE_IDS_REFRESHED_LABEL_CELL = 'D1';
const COURSE_IDS_REFRESHED_HOME_CELL = 'E1';
const REF_TAB_COLOR = '#cc0000';

/** Adds this file's menu items. Called by onOpen. */
function addRefSheetsMenuItems_(menu) {
  menu.addItem('Refresh course list', 'refreshCourseList');
}

/**
 * Menu: Course Manager › Refresh course list.
 * Replaces ref_CourseIDs columns A:B with your active teacher courses from Canvas,
 * sorted by name, and stamps the time in CourseIDs_LastRefreshed.
 * Nothing on the sheet changes unless Canvas answers successfully.
 */
function refreshCourseList() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  try {
    const existing = ss.getSheetByName(SHEETS.COURSE_IDS);
    if (existing) checkCourseIdsLayout_(existing);

    const courses = canvasGet_('/courses', {
      enrollment_type: 'teacher',
      enrollment_state: 'active',
      'state[]': ['available', 'unpublished'],
    });
    if (!Array.isArray(courses)) throw sheetProblem_('Canvas did not return a course list.');
    const rows = courses
      .map(course => [course.id, course.name || ''])
      .sort((a, b) => String(a[1]).localeCompare(String(b[1])));

    const sheet = existing || createRefSheet_(ss, SHEETS.COURSE_IDS);
    sheet.getRange(1, 1, 1, COURSE_IDS_HEADERS.length)
      .setValues([COURSE_IDS_HEADERS.slice()]).setFontWeight('bold');
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, COURSE_IDS_HEADERS.length).clearContent();
    if (rows.length) sheet.getRange(2, 1, rows.length, COURSE_IDS_HEADERS.length).setValues(rows);
    getCourseIdsRefreshedCell_(ss, sheet).setValue(new Date());

    console.log(`Refresh course list: ${rows.length} course(s) written.`);
    ss.toast(`${rows.length} course(s) listed on ${SHEETS.COURSE_IDS}.`, 'Refresh course list', 5);
  } catch (error) {
    console.error('Refresh course list failed: ' + (error.canvasType || error.message));
    const message = error.canvasType || error.isSheetProblem ? error.message :
      'Unexpected error. See Extensions › Apps Script › Executions.';
    SpreadsheetApp.getUi().alert('Refresh course list',
      'The course list was not changed. ' + message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/** Refuses to overwrite a sheet whose row 1 is not this builder's layout (or blank). */
function checkCourseIdsLayout_(sheet) {
  const header = sheet.getRange(1, 1, 1, COURSE_IDS_HEADERS.length).getValues()[0];
  const blank = header.every(value => value === '');
  const matches = JSON.stringify(header) === JSON.stringify(COURSE_IDS_HEADERS);
  if (!blank && !matches) {
    throw sheetProblem_(`Row 1 of ${sheet.getName()} should read "Course ID" and ` +
      '"Course name". Move that content or rename the sheet before refreshing.');
  }
}

/** Finds the "last refreshed" cell by its named range, creating it the first time. */
function getCourseIdsRefreshedCell_(ss, sheet) {
  const named = ss.getRangeByName(COURSE_IDS_REFRESHED_NAME);
  if (named) return named;
  sheet.getRange(COURSE_IDS_REFRESHED_LABEL_CELL).setValue('Last refreshed').setFontWeight('bold');
  const home = sheet.getRange(COURSE_IDS_REFRESHED_HOME_CELL)
    .setNumberFormat('M/d/yyyy h:mm am/pm');
  ss.setNamedRange(COURSE_IDS_REFRESHED_NAME, home);
  return home;
}

/** New reference sheets get the red "be careful here" tab color. */
function createRefSheet_(ss, name) {
  return ss.insertSheet(name).setTabColor(REF_TAB_COLOR);
}

/** An error whose message is safe and useful to show as-is. */
function sheetProblem_(message) {
  const error = new Error(message);
  error.isSheetProblem = true;
  return error;
}
