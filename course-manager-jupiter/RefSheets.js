/**
 * RefSheets.js
 * Purpose: builders for the reference (ref_) sheets and their menu items. Logs counts only;
 *   no student data in logs, alerts, or error messages.
 *   - ref_CourseIDs ("Refresh course list"): courses where you are an active teacher
 *     (A = course ID, B = course name).
 *   - ref_peopleList ("Refresh people list"): every active or invited enrollment in the
 *     cfg_CourseID course, all enrollment types, same nine columns as the legacy tab.
 * Canvas endpoints called (all GET, via canvasGet_):
 *   /api/v1/courses?enrollment_type=teacher&enrollment_state=active
 *     &state[]=available&state[]=unpublished
 *   /api/v1/courses/:course
 *   /api/v1/courses/:course/enrollments?state[]=active&state[]=invited
 * Canvas write operations: none.
 * Required User/Script Properties: User Properties CANVAS_BASE_URL and CANVAS_TOKEN
 *   (read by canvasGet_).
 */

const REF_TAB_COLOR = '#cc0000';
const REFRESHED_NUMBER_FORMAT = 'M/d/yyyy h:mm am/pm';

// "Last refreshed" stamps. The cells are used only the first time, to create each named
// range. After that the named range is the source of truth, so the cell can be moved.
const COURSE_IDS_REFRESHED = Object.freeze({ name: 'CourseIDs_LastRefreshed', label: 'D1', home: 'E1' });
const PEOPLE_LIST_REFRESHED = Object.freeze({ name: 'PeopleList_LastRefreshed', label: 'K1', home: 'L1' });

const COURSE_IDS_HEADERS = Object.freeze(['Course ID', 'Course name']);
const PEOPLE_LIST_HEADERS = Object.freeze(['Course ID', 'Course Name', 'Section ID', 'User ID',
  'Sorted Name', 'Role', 'Email', 'Last Name', 'First Name']);
const PEOPLE_LIST_HEADER_COLOR = '#d0e8d2';
// Same formulas as the legacy tab: split "Last, First" in column E.
const PEOPLE_LIST_LAST_NAME_FORMULA = '=IFERROR(LEFT(E2, FIND(",", E2) - 1), E2)';
const PEOPLE_LIST_FIRST_NAME_FORMULA = '=IFERROR(TRIM(RIGHT(E2, LEN(E2) - FIND(",", E2))), "")';

/** Adds this file's menu items. Called by onOpen. */
function addRefSheetsMenuItems_(menu) {
  menu.addItem('Refresh course list', 'refreshCourseList');
  menu.addItem('Refresh people list', 'refreshPeopleList');
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
    if (existing) checkHeaderLayout_(existing, COURSE_IDS_HEADERS);

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
    replaceDataRows_(sheet, rows, COURSE_IDS_HEADERS.length);
    getRefreshedCell_(ss, sheet, COURSE_IDS_REFRESHED).setValue(new Date());

    console.log(`Refresh course list: ${rows.length} course(s) written.`);
    ss.toast(`${rows.length} course(s) listed on ${SHEETS.COURSE_IDS}.`, 'Refresh course list', 5);
  } catch (error) {
    reportRefreshFailure_('Refresh course list', 'The course list was not changed.', error);
  }
}

/**
 * Menu: Course Manager › Refresh people list.
 * Replaces ref_peopleList columns A:I with one row per enrollment (all types, active
 * or invited) in the cfg_CourseID course, sorted by Sorted Name, with the legacy
 * Last Name / First Name formulas in H:I. Stamps PeopleList_LastRefreshed.
 * Nothing on the sheet changes unless both Canvas requests succeed.
 */
function refreshPeopleList() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  try {
    const courseId = getCourseIdForRefresh_();
    const existing = ss.getSheetByName(SHEETS.PEOPLE_LIST);
    if (existing) checkHeaderLayout_(existing, PEOPLE_LIST_HEADERS);

    const course = canvasStep_('course request', () => canvasGet_('/courses/' + courseId));
    const enrollments = canvasStep_('roster request', () =>
      canvasGet_('/courses/' + courseId + '/enrollments', { 'state[]': ['active', 'invited'] }));
    if (!Array.isArray(enrollments)) {
      throw sheetProblem_('Canvas did not return a roster list for the roster request.');
    }

    const courseName = (course && course.name) || 'N/A';
    const rows = enrollments
      .filter(enrollment => enrollment.user && enrollment.user.id)
      .map(enrollment => [
        enrollment.course_id || Number(courseId),
        courseName,
        enrollment.course_section_id || '',
        enrollment.user.id,
        enrollment.user.sortable_name || '',
        enrollment.type || '',
        enrollment.user.login_id || '',
        '',
        '',
      ])
      .sort((a, b) => String(a[4]).localeCompare(String(b[4])));

    const sheet = existing || createRefSheet_(ss, SHEETS.PEOPLE_LIST);
    const existingFilter = sheet.getFilter();
    if (existingFilter) existingFilter.remove();
    sheet.getRange(1, 1, 1, PEOPLE_LIST_HEADERS.length)
      .setValues([PEOPLE_LIST_HEADERS.slice()])
      .setFontWeight('bold')
      .setBackground(PEOPLE_LIST_HEADER_COLOR);
    replaceDataRows_(sheet, rows, PEOPLE_LIST_HEADERS.length);
    if (rows.length) {
      sheet.getRange(2, 8, rows.length, 1).setFormula(PEOPLE_LIST_LAST_NAME_FORMULA);
      sheet.getRange(2, 9, rows.length, 1).setFormula(PEOPLE_LIST_FIRST_NAME_FORMULA);
      sheet.getRange(1, 1, rows.length + 1, PEOPLE_LIST_HEADERS.length).createFilter();
    }
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, PEOPLE_LIST_HEADERS.length);
    getRefreshedCell_(ss, sheet, PEOPLE_LIST_REFRESHED).setValue(new Date());

    console.log(`Refresh people list: ${rows.length} enrollment row(s) written.`);
    ss.toast(`${rows.length} enrollment row(s) listed on ${SHEETS.PEOPLE_LIST}.`,
      'Refresh people list', 5);
  } catch (error) {
    reportRefreshFailure_('Refresh people list', 'The people list was not changed.', error);
  }
}

/** Reads cfg_CourseID and checks it is a Canvas course number. */
function getCourseIdForRefresh_() {
  let value;
  try {
    value = getCfg_('CourseID');
  } catch (error) {
    throw sheetProblem_(error.message); // getCfg_ messages name the range only.
  }
  const courseId = String(value).replace(/\.0$/, '').trim();
  if (!/^\d+$/.test(courseId)) {
    throw sheetProblem_('cfg_CourseID must be a Canvas course number.');
  }
  return courseId;
}

/** Runs one Canvas request; on failure, says which request failed. */
function canvasStep_(label, request) {
  try {
    return request();
  } catch (error) {
    if (!error.canvasType) throw error;
    throw sheetProblem_(`Canvas returned an error for the ${label}. ${error.message}`);
  }
}

/** Clears old data rows below the header in the builder's columns, then writes new ones. */
function replaceDataRows_(sheet, rows, columnCount) {
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, columnCount).clearContent();
  if (rows.length) sheet.getRange(2, 1, rows.length, columnCount).setValues(rows);
}

/** Refuses to overwrite a sheet whose row 1 is not this builder's layout (or blank). */
function checkHeaderLayout_(sheet, headers) {
  const header = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const blank = header.every(value => value === '');
  const matches = JSON.stringify(header) === JSON.stringify(headers);
  if (!blank && !matches) {
    throw sheetProblem_(`Row 1 of ${sheet.getName()} should read ` +
      headers.map(h => `"${h}"`).join(', ') +
      '. Move that content or rename the sheet before refreshing.');
  }
}

/** Finds a "last refreshed" cell by its named range, creating it the first time. */
function getRefreshedCell_(ss, sheet, stamp) {
  const named = ss.getRangeByName(stamp.name);
  if (named) return named;
  sheet.getRange(stamp.label).setValue('Last refreshed').setFontWeight('bold');
  const home = sheet.getRange(stamp.home).setNumberFormat(REFRESHED_NUMBER_FORMAT);
  ss.setNamedRange(stamp.name, home);
  return home;
}

/** Logs the failure type and shows a safe message. Never includes Canvas data. */
function reportRefreshFailure_(title, unchangedNote, error) {
  console.error(title + ' failed: ' + (error.canvasType || error.message));
  const message = error.canvasType || error.isSheetProblem ? error.message :
    'Unexpected error. See Extensions › Apps Script › Executions.';
  SpreadsheetApp.getUi().alert(title, unchangedNote + ' ' + message,
    SpreadsheetApp.getUi().ButtonSet.OK);
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
