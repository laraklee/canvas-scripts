/**
 * CourseCheck.js
 * Purpose: Course check, a read-only report of likely course-setup mistakes, written to
 *   the Course Check tab (one row per possible problem; Lara decides what to ignore):
 *   - Missing due date: no due date at all (main or section dates).
 *   - Unpublished: the assignment is not published.
 *   - No-school day: a due date on a weekend, a day not in ref_simpleSchedule (a break),
 *     or a day whose Schedule (column E) is H (holiday) or PD (no US classes). Only
 *     dates inside the schedule's date range are checked.
 *   - Outside the term: a due date before the term starts or after it ends (catches
 *     dates left over from last term's course copy). The term is the quarters in
 *     cfg_TermQuarters (e.g. 2, 1-2, 1-4), dated from ref_simpleSchedule column A;
 *     if that range is missing or blank, the Canvas term dates are used.
 *   - Big item on SAC review day: worth 50+ points and due on a day whose
 *     ref_simpleSchedule note (column G) contains "SAC Review Day".
 *   - After No Homework Weekend: anything due on the first school day after a No
 *     Homework Weekend (column G "No Homework Weekend" marks the last school days
 *     before it), whether or not the class meets that day.
 *   - Group not checked for Jupiter: one line per assignment group with point-earning
 *     assignments that is not checked in cfg_JupiterCategories. Skipped when no
 *     category is checked (a course that doesn't use Jupiter, e.g. AI9).
 *   Runs from its own menu item (runCourseCheck) and after Refresh assignment groups and
 *   Refresh all tables, using the assignments those refreshes already downloaded.
 *   "OK as is" checkbox: a ticked row is remembered across runs by the hidden Key column
 *   (check + assignment ID + due date, or check + group ID), listed last in gray, and
 *   counted separately. A changed due date or a different problem shows again. Only the
 *   ticks are kept; everything else on the tab is rebuilt each run.
 * Canvas endpoints called (GET, via canvasGet_): /api/v1/courses/:course?include[]=term
 *   (only when cfg_TermQuarters is blank), plus the assignment groups refresh's own
 *   request (RefSheets.js).
 * Canvas write operations: none.
 * Required: User Properties CANVAS_BASE_URL and CANVAS_TOKEN; cfg_CourseID; sheet
 *   ref_simpleSchedule. Optional: cfg_TermQuarters, cfg_JupiterCategories.
 *   Lists assignment names only (no student data); logs counts only.
 */

/** Pop-up title: the tool's Course Manager Tools menu label (2026-11-12; was "Course check"). */
const COURSE_CHECK_TITLE = 'Find possible setup mistakes';

const COURSE_CHECK_HEADERS = Object.freeze(['Check', 'Assignment', 'Group', 'Due', 'Link',
  'OK as is', 'Key']);
const COURSE_CHECK_OK_COLUMN = 6;
const COURSE_CHECK_KEY_COLUMN = 7;
const COURSE_CHECK_OK_COLOR = '#999999'; // ticked rows, listed last
const COURSE_CHECK_INFO_COLOR = '#800020'; // burgundy Info rows, so they stand out
// Optional, so it is not in CFG_NAMES (Check setup doesn't ask for it).
const TERM_QUARTERS_RANGE = 'cfg_TermQuarters';
// ref_simpleSchedule Schedule codes (column E) that mean no classes.
const NO_SCHOOL_CODES = Object.freeze(['H', 'PD']);
// ref_simpleSchedule notes (column G) the checks look for, in any case.
const SAC_NOTE = /SAC Review Day/i;
const NO_HOMEWORK_NOTE = /No Homework Weekend/i;
// "Big" items: tests and major papers shouldn't be due on SAC review days.
const BIG_ITEM_POINTS = 50;
const COURSE_CHECKS = Object.freeze({
  MISSING_DUE: 'Missing due date',
  UNPUBLISHED: 'Unpublished',
  NO_SCHOOL: 'No-school day',
  OUTSIDE_TERM: 'Outside the term',
  SAC_DAY: 'Big item on SAC review day',
  AFTER_NO_HOMEWORK: 'After No Homework Weekend',
  JUPITER: 'Group not checked for Jupiter',
  INFO: 'Info',
});

/**
 * Menu / button: Course check. Refreshes ref_assignmentGroups (refresh before use), fills
 * the Course Check tab, opens it, and shows counts.
 */
function runCourseCheck() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  try {
    ss.toast('Checking the course…', COURSE_CHECK_TITLE, -1);
    const result = writeCourseCheck_(ss, writeAssignmentGroupsSheet_(ss).canvasGroups);
    ss.getSheetByName(TOOL_SHEETS.COURSE_CHECK).activate();
    ss.toast('Done.', COURSE_CHECK_TITLE, 2);
    ui.alert(COURSE_CHECK_TITLE, courseCheckCountsText_(result) + '\n\n' + result.termNote +
      (result.jupiterNote ? '\n' + result.jupiterNote : '') +
      '\n\nDetails are on the Course Check tab. These are possible problems: tick "OK as ' +
      'is" for any that are on purpose, and they stay at the bottom next time.',
    ui.ButtonSet.OK);
  } catch (error) {
    reportRefreshFailure_(COURSE_CHECK_TITLE, 'The Course Check tab was not changed.', error);
  }
}

/**
 * Builds the Course Check tab from the assignment groups Canvas just returned (with
 * assignments and all_dates), keeping the "OK as is" ticks. Returns { counts, total,
 * okCount, termNote, jupiterNote }. Throws (tab unchanged) if the tab's row 1 isn't
 * this report's layout.
 */
function writeCourseCheck_(ss, groups) {
  const existing = ss.getSheetByName(TOOL_SHEETS.COURSE_CHECK);
  if (existing) checkCourseCheckLayout_(existing);
  const okKeys = existing ? readOkKeys_(existing) : new Set();

  const timeZone = ss.getSpreadsheetTimeZone();
  const dayOf = iso => Utilities.formatDate(new Date(iso), timeZone, 'yyyy-MM-dd');
  const showDue = iso => Utilities.formatDate(new Date(iso), timeZone, 'EEE M/d/yy h:mm a');
  const schedule = readScheduleDays_(ss, timeZone);
  const term = findTerm_(ss, schedule, dayOf);
  let allowed = null;
  try {
    allowed = readJupiterAllowed_(ss);
  } catch (error) {
    if (!error.isSheetProblem) throw error; // none checked or no table: skip that check
  }

  const result = buildCourseCheck_(groups, schedule, term, allowed, dayOf, showDue, okKeys);
  const sheet = existing || ss.insertSheet(TOOL_SHEETS.COURSE_CHECK);
  const width = COURSE_CHECK_HEADERS.length;
  const dataRows = Math.max(sheet.getMaxRows() - 1, 1);
  sheet.getRange(1, 1, 1, width).setValues([COURSE_CHECK_HEADERS.slice()]).setFontWeight('bold');
  sheet.getRange(2, 4, dataRows, 1).setNumberFormat('@');
  sheet.getRange(2, 1, dataRows, width).setFontColor(null);
  sheet.getRange(2, COURSE_CHECK_OK_COLUMN, dataRows, 1).clearDataValidations();
  // Checkboxes go in before the values, since adding them unticks every box.
  const firstProblem = 2 + result.infoCount;
  const problems = result.rows.length - result.infoCount;
  if (problems) sheet.getRange(firstProblem, COURSE_CHECK_OK_COLUMN, problems, 1).insertCheckboxes();
  replaceDataRows_(sheet, result.rows, width);
  sheet.getRange(2, 1, result.infoCount, width).setFontColor(COURSE_CHECK_INFO_COLOR);
  if (result.okCount) {
    sheet.getRange(firstProblem + problems - result.okCount, 1, result.okCount, width)
      .setFontColor(COURSE_CHECK_OK_COLOR);
  }
  sheet.hideColumns(COURSE_CHECK_KEY_COLUMN);
  sheet.setFrozenRows(1);

  console.log(`Course check: ${result.total} possible problem(s), ${result.okCount} OK as is; ` +
    Object.entries(result.counts).map(([check, n]) => `${check} ${n}`).join(', ') + '.');
  return result;
}

/**
 * Accepts this report's row 1, the first version's (five columns, before "OK as is"),
 * or a blank row; anything else stops with checkHeaderLayout_'s message.
 */
function checkCourseCheckLayout_(sheet) {
  const header = sheet.getRange(1, 1, 1, COURSE_CHECK_HEADERS.length).getValues()[0];
  const firstVersion = COURSE_CHECK_HEADERS.slice(0, 5).concat(['', '']);
  if (JSON.stringify(header) === JSON.stringify(firstVersion)) return;
  checkHeaderLayout_(sheet, COURSE_CHECK_HEADERS);
}

/** The Key of every row ticked "OK as is" on the tab now. */
function readOkKeys_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return new Set();
  return new Set(sheet.getRange(2, COURSE_CHECK_OK_COLUMN, lastRow - 1, 2).getValues()
    .filter(([ok, key]) => ok === true && key !== '')
    .map(([, key]) => String(key)));
}

/** "3 possible problem(s) (2 marked OK as is): Unpublished 2, …" or "No problems found." */
function courseCheckCountsText_(result) {
  const ok = result.okCount ? ` (${result.okCount} marked OK as is)` : '';
  if (!result.total) return `No problems found${ok}.`;
  return `${result.total} possible problem(s)${ok}: ` + Object.entries(result.counts)
    .filter(([, n]) => n).map(([check, n]) => `${check} ${n}`).join(', ') + '.';
}

/**
 * The report rows and counts. groups: Canvas assignment groups with assignments;
 * schedule: [{ day: 'yyyy-MM-dd', quarter, code }]; term: { start, end, note } or
 * { note } when unknown; allowed: checked Jupiter categories ({ ids, names }) or null
 * to skip that check; dayOf / showDue turn a Canvas date into a day key / display text;
 * okKeys: Keys ticked "OK as is" on the last run.
 * Rows (Check, Assignment, Group, Due, Link, OK as is, Key): Info rows first (term,
 * skipped checks), then one row per open problem in check order (assignments in Canvas
 * order), then the problems ticked OK as is, in the same order. counts and total cover
 * open problems only; okCount the ticked ones; infoCount the Info rows.
 */
function buildCourseCheck_(groups, schedule, term, allowed, dayOf, showDue, okKeys = new Set()) {
  const scheduleByDay = new Map(schedule.map(entry => [entry.day, entry]));
  const days = schedule.map(entry => entry.day).sort();
  const first = days[0];
  const last = days[days.length - 1];
  const sacDays = new Set(schedule.filter(entry => SAC_NOTE.test(entry.note || ''))
    .map(entry => entry.day));
  const afterNoHomework = daysAfterNoHomework_(schedule);
  const found = Object.fromEntries([COURSE_CHECKS.MISSING_DUE, COURSE_CHECKS.UNPUBLISHED, COURSE_CHECKS.NO_SCHOOL,
    COURSE_CHECKS.OUTSIDE_TERM, COURSE_CHECKS.SAC_DAY, COURSE_CHECKS.AFTER_NO_HOMEWORK,
    COURSE_CHECKS.JUPITER].map(check => [check, []]));

  groups.forEach(group => (group.assignments || []).forEach(assignment => {
    const row = (check, due) => [check, assignment.name || '', group.name || '',
      due ? showDue(due) : '', assignment.html_url || '', false,
      `${check}|${assignment.id}|${due || ''}`];
    const dues = [...new Set([assignment.due_at].concat((assignment.all_dates || [])
      .map(date => date.due_at)).filter(Boolean))];
    if (!dues.length) found[COURSE_CHECKS.MISSING_DUE].push(row(COURSE_CHECKS.MISSING_DUE));
    if (assignment.published === false) found[COURSE_CHECKS.UNPUBLISHED].push(row(COURSE_CHECKS.UNPUBLISHED));
    dues.forEach(due => {
      const day = dayOf(due);
      const why = first && day >= first && day <= last ? noSchoolReason_(day, scheduleByDay) : '';
      if (why) found[COURSE_CHECKS.NO_SCHOOL].push(row(`${COURSE_CHECKS.NO_SCHOOL}: ${why}`, due));
      if (term.start && (day < term.start || day > term.end)) {
        found[COURSE_CHECKS.OUTSIDE_TERM].push(row(COURSE_CHECKS.OUTSIDE_TERM, due));
      }
      if (sacDays.has(day) && Number(assignment.points_possible) >= BIG_ITEM_POINTS) {
        found[COURSE_CHECKS.SAC_DAY].push(row(COURSE_CHECKS.SAC_DAY, due));
      }
      if (afterNoHomework.has(day)) {
        found[COURSE_CHECKS.AFTER_NO_HOMEWORK].push(row(COURSE_CHECKS.AFTER_NO_HOMEWORK, due));
      }
    });
  }));

  if (allowed) {
    groups.forEach(group => {
      const id = String(group.id || '');
      const name = String(group.name || '').trim();
      if (allowed.ids.has(id) || allowed.names.has(name.toLowerCase())) return;
      const scored = (group.assignments || []).filter(a => Number(a.points_possible) > 0).length;
      if (scored) {
        found[COURSE_CHECKS.JUPITER].push([COURSE_CHECKS.JUPITER, `${scored} assignment(s) worth points`,
          name, '', '', false, `${COURSE_CHECKS.JUPITER}|group:${id}`]);
      }
    });
  }

  const isOk = row => okKeys.has(row.slice(-1)[0]);
  const counts = Object.fromEntries(Object.entries(found).map(([check, list]) =>
    [check, list.filter(row => !isOk(row)).length]));
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const all = [].concat(...Object.values(found));
  const ticked = all.filter(isOk).map(row => row.slice(0, 5).concat([true], row.slice(-1)));
  const jupiterNote = allowed ? '' : 'Jupiter check skipped: no categories are checked in ' +
    'cfg_JupiterCategories.';
  const infoRow = text => [COURSE_CHECKS.INFO, text, '', '', '', '', ''];
  const info = [infoRow(term.note)]
    .concat(jupiterNote ? [infoRow(jupiterNote)] : [])
    .concat(total ? [] : [infoRow('No problems found.')]);
  return { rows: info.concat(all.filter(row => !isOk(row)), ticked), counts, total,
    okCount: ticked.length, infoCount: info.length, termNote: term.note, jupiterNote };
}

/** Why a day (inside the schedule's range) has no school, or '' if it's a school day. */
function noSchoolReason_(day, scheduleByDay) {
  const weekday = new Date(day + 'T12:00:00Z').getUTCDay();
  if (weekday === 0 || weekday === 6) return 'weekend';
  const entry = scheduleByDay.get(day);
  if (!entry) return 'not in the schedule (break?)';
  return NO_SCHOOL_CODES.includes(entry.code) ? `Schedule ${entry.code}` : '';
}

/**
 * The first school day after each No Homework Weekend: for every day noted "No Homework
 * Weekend", the next schedule day that is a school day (not a weekend, H, or PD) and
 * isn't itself noted. Returns a Set of day keys.
 */
function daysAfterNoHomework_(schedule) {
  const byDay = new Map(schedule.map(entry => [entry.day, entry]));
  const noted = entry => NO_HOMEWORK_NOTE.test(entry.note || '');
  const schoolDays = schedule.filter(entry => !noted(entry) && !noSchoolReason_(entry.day, byDay))
    .map(entry => entry.day).sort();
  const days = new Set();
  schedule.filter(noted).forEach(entry => {
    const next = schoolDays.find(day => day > entry.day);
    if (next) days.add(next);
  });
  return days;
}

/**
 * ref_simpleSchedule rows as [{ day: 'yyyy-MM-dd', quarter: '2', code: 'A', note }]:
 * column A quarter, C date, E Schedule code, G note. Rows without a date are left out.
 */
function readScheduleDays_(ss, timeZone) {
  const sheet = ss.getSheetByName(SHEETS.SIMPLE_SCHEDULE);
  if (!sheet) throw sheetProblem_(`There is no ${SHEETS.SIMPLE_SCHEDULE} tab.`);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, 7).getValues()
    .filter(row => row.slice(2, 3)[0] instanceof Date)
    .map(row => ({
      day: Utilities.formatDate(row.slice(2, 3)[0], timeZone, 'yyyy-MM-dd'),
      quarter: String(row.slice(0, 1)[0]).trim(),
      code: String(row.slice(4, 5)[0]).trim(),
      note: String(row.slice(6, 7)[0]).trim(),
    }));
}

/**
 * The term as { start, end, note } (day keys), from cfg_TermQuarters and the schedule,
 * or else from Canvas's term dates; { note } alone if neither gives dates.
 */
function findTerm_(ss, schedule, dayOf) {
  const range = ss.getRangeByName(TERM_QUARTERS_RANGE);
  const setting = range ? String(range.getValue()).trim() : '';
  if (setting) return termFromSchedule_(parseQuarters_(setting), schedule, setting);

  const course = canvasStep_('course request', () =>
    canvasGet_('/courses/' + getCourseIdForRefresh_(), { 'include[]': ['term'] }));
  const termDates = course && course.term && course.term.start_at && course.term.end_at ?
    course.term : course;
  if (!termDates || !termDates.start_at || !termDates.end_at) {
    return { note: `Term check skipped: ${TERM_QUARTERS_RANGE} is blank and the Canvas course ` +
      'has no term dates.' };
  }
  const start = dayOf(termDates.start_at);
  const end = dayOf(termDates.end_at);
  return { start, end, note: `Term: ${showDay_(start)} – ${showDay_(end)} (Canvas term dates; ` +
    `set ${TERM_QUARTERS_RANGE} on ${SHEETS.CONFIG} for a quarter course).` };
}

/** '2', '1-2', '1,2', 'Q2', 'Q1-Q2' (or the number 2) → ['2'] / ['1', '2']. */
function parseQuarters_(setting) {
  const text = String(setting).toUpperCase().replace(/Q/g, '').replace(/\s/g, '');
  const quarters = [];
  text.split(',').forEach(part => {
    const match = part.match(/^(\d)(?:-(\d))?$/);
    if (!match) {
      throw sheetProblem_(`${TERM_QUARTERS_RANGE} should be quarter numbers like 2, 1-2, or ` +
        '1-4.');
    }
    const from = Number(match[1]);
    const to = Number(match[2] || match[1]);
    for (let q = Math.min(from, to); q <= Math.max(from, to); q++) quarters.push(String(q));
  });
  return quarters;
}

/** { start, end, note }: first and last schedule day of those quarters. */
function termFromSchedule_(quarters, schedule, setting) {
  const days = schedule.filter(entry => quarters.includes(entry.quarter))
    .map(entry => entry.day).sort();
  if (!days.length) {
    throw sheetProblem_(`${SHEETS.SIMPLE_SCHEDULE} has no days for quarter(s) ${setting} ` +
      `(${TERM_QUARTERS_RANGE}).`);
  }
  const start = days[0];
  const end = days[days.length - 1];
  return { start, end, note: `Term: Q${setting}, ${showDay_(start)} – ${showDay_(end)} ` +
    `(${TERM_QUARTERS_RANGE} and ${SHEETS.SIMPLE_SCHEDULE}).` };
}

/** 'yyyy-MM-dd' → 'M/d/yy'. */
function showDay_(day) {
  const [year, month, date] = day.split('-');
  return `${Number(month)}/${Number(date)}/${year.slice(2)}`;
}
