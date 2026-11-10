/**
 * 07_AssignmentDates.js
 * Purpose: the bulk assignment dates tool (menu Canvas Tools › 📝 Assignment dates).
 *   "Load assignment dates from Canvas" fills the Assignment Dates sheet with every
 *   assignment in the course; edit the open, due, and lock dates/times there (date cells
 *   have a date picker), check Update?, then "Send changed dates to Canvas". Load lists
 *   assignments by due date; "Sort by selected column" re-sorts the sheet and keeps each
 *   assignment's "↳" rows under it (sheet only, no Canvas calls).
 *   Ported from course-manager/03d.AssignmentDates.js. Keep the two public function
 *   names: drawn buttons on row 1 of the sheet can call them.
 * Canvas endpoints called:
 *   GET /api/v1/courses/:course/assignments?include[]=overrides&override_assignment_dates=false
 *     (read; by fetch, and again by push to compare)
 *   PUT /api/v1/courses/:course/assignments/:id (write) for an assignment row ("Everyone
 *     else" dates). Sends only the unlock_at / due_at / lock_at that differ from Canvas.
 *   PUT /api/v1/courses/:course/assignments/:id/overrides/:override_id (write) for a
 *     section-date row ("↳"). Canvas un-sets any override date left out, so this sends
 *     every date the override already sets plus the changed ones; for a student override
 *     it re-sends the same student_ids so the same students stay on it.
 *   GET /api/v1/courses/:course/users?user_ids[]=… (read; by fetch only, and only when
 *     an assignment has student dates): the names shown on those "↳" rows.
 *   Both writes go through canvasWrite_, so DRY_RUN applies. Name, points, and
 *   submission type on the sheet are for reference only.
 * Required User/Script Properties: User Properties CANVAS_BASE_URL and CANVAS_TOKEN;
 *   Script Property DRY_RUN. Course ID comes from the *Config* sheet, cell B4.
 *
 * Section dates (overrides) appear as "↳" rows under their assignment, with the override
 * ID in the last column. A student override shows the students' names ("↳ Jane Doe"; Lara's
 * choice 11/9). Names go only on the sheet: never into logs, error messages, or alerts,
 * and student IDs never go on the sheet. A date the override doesn't set uses
 * the assignment's date: it is shown in italics with a note, and stays un-set on push
 * unless it is changed.
 */

const DATES_SHEET_NAME = 'Assignment Dates';
const DATES_HEADER_ROW = 2;
const DATES_FIRST_DATA_ROW = 3;
const DATES_HEADERS = Object.freeze(['Update?', 'ID', 'Assignment Name', 'Sub. Type(s)',
  'Points', 'Open Date', 'Open Time', 'Schedule Info', 'Due Date', 'Due Time', 'Lock Date',
  'Lock Time', 'Sync Status', 'Override ID']);
const DATES_COL = Object.freeze({ check: 1, id: 2, status: 13, override: 14 });
// Sheet column (1-based) of each date/time pair, keyed by the Canvas field it sets.
const DATES_FIELDS = Object.freeze([
  { field: 'unlock_at', label: 'open', dateCol: 6, timeCol: 7 },
  { field: 'due_at', label: 'due', dateCol: 9, timeCol: 10 },
  { field: 'lock_at', label: 'lock', dateCol: 11, timeCol: 12 },
]);
// override_assignment_dates=false: without it Canvas folds section dates into the
// assignment's own dates, so the "Everyone else" row would show a section's dates.
const DATES_FETCH_QUERY = Object.freeze({ 'include[]': 'overrides',
  override_assignment_dates: false });
const DATES_MAX_NAMES = 3; // student names shown on one "↳" row before "+ n more"
const DATES_NAME_BATCH = 50; // student IDs per users request (keeps the URL short)
const DATES_EDIT_IN_CANVAS = 'Edit in Canvas (not a section, group, or student date)';
const DATES_INHERITED_NOTE = 'Not set separately for this row: it uses the assignment\'s ' +
  '("Everyone else") date. Change it here to give this row its own date.';

/** Menu: Load assignment dates from Canvas. Rebuilds the sheet from row 2 down. */
function fetchCanvasAssignmentDates() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  try {
    const courseId = getDatesCourseId_();
    if (!courseId) return;
    ss.toast('Fetching assignments from Canvas...', 'Assignment Dates', -1);
    const assignments = canvasGet_(`/courses/${courseId}/assignments`, DATES_FETCH_QUERY);
    const sheet = ss.getSheetByName(DATES_SHEET_NAME) || ss.insertSheet(DATES_SHEET_NAME);
    const studentNames = getOverrideStudentNames_(courseId, assignments);
    writeDatesSheet_(sheet, assignments, studentNames, ss.getSpreadsheetTimeZone());
    const overrideCount = assignments.reduce((sum, a) => sum + (a.overrides || []).length, 0);
    console.log(`Fetch assignment dates: ${assignments.length} assignment(s), ` +
      `${overrideCount} section-date row(s) loaded.`);
    ss.toast('', '', 1);
    ui.alert('Load assignment dates', assignments.length ?
      `Loaded ${assignments.length} assignment(s)` +
      (overrideCount ? ` and ${overrideCount} section-date row(s) (marked ↳).` : '.') :
      'No assignments found in this course.',
      ui.ButtonSet.OK);
  } catch (error) {
    console.error('Load assignment dates failed: ' + (error.canvasType || error.message));
    ss.toast('', '', 1);
    ui.alert('Load assignment dates', 'Could not finish. ' + describeCanvasError_(error),
      ui.ButtonSet.OK);
  }
}

/**
 * Menu: Send changed dates to Canvas. For each row with Update? checked, compares the
 * sheet's dates with Canvas right now and sends only the dates that changed. Asks first.
 */
function pushAssignmentDatesToCanvas() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  try {
    const sheet = ss.getSheetByName(DATES_SHEET_NAME);
    if (!sheet || sheet.getLastRow() < DATES_FIRST_DATA_ROW) {
      ui.alert('Send assignment dates', 'Run Canvas Tools › 📝 Assignment dates › ' +
        'Load assignment dates from Canvas first. Nothing was sent.',
        ui.ButtonSet.OK);
      return;
    }
    const courseId = getDatesCourseId_();
    if (!courseId) return;

    ss.toast('Comparing with Canvas...', 'Assignment Dates', -1);
    const live = new Map(canvasGet_(`/courses/${courseId}/assignments`, DATES_FETCH_QUERY)
      .map(item => [String(item.id), item]));
    const plan = planDateUpdates_(sheet, courseId, live, ss.getSpreadsheetTimeZone());
    ss.toast('', '', 1);

    if (plan.problems.length) {
      ui.alert('Send assignment dates', 'Fix these first. Nothing was sent.\n\n' +
        plan.problems.join('\n'), ui.ButtonSet.OK);
      return;
    }
    if (!plan.toSend.length) {
      ui.alert('Send assignment dates', 'No date changes in the checked rows.' +
        (plan.skipped ? `\n\n${plan.skipped} row(s) skipped; see Sync Status.` : ''),
        ui.ButtonSet.OK);
      return;
    }

    const dateCount = plan.toSend.reduce((sum, job) => sum + job.fields.length, 0);
    const answer = ui.alert('Send assignment dates?',
      `Course ${courseId}: ${plan.toSend.length} row(s) will change ` +
      `(${dateCount} date(s) in all). Students will see the new dates.` +
      (plan.skipped ? `\n${plan.skipped} row(s) will be skipped; see Sync Status.` : '') +
      '\n\n' + describeDryRun_(isDryRun_()) + '\n\nContinue?',
      ui.ButtonSet.YES_NO);
    if (answer !== ui.Button.YES) return;

    ss.toast(`Updating ${plan.toSend.length} row(s)...`, 'Assignment Dates', -1);
    const result = sendDateUpdates_(sheet, plan.toSend, ss.getSpreadsheetTimeZone());
    console.log(`Push assignment dates: ${result.sent} sent, ${result.failed} failed, ` +
      `${plan.skipped} skipped, dry run ${result.dryRun ? 'ON' : 'OFF'}.`);
    ss.toast('', '', 1);
    ui.alert('Send assignment dates',
      (result.dryRun ? `Dry run: ${result.sent} row(s) checked; nothing was sent to Canvas.` :
        `${result.sent} row(s) updated.`) +
      (result.failed ? `\n${result.failed} failed; see Sync Status.` : '') +
      (result.stoppedMessage ? '\n\nStopped early: ' + result.stoppedMessage : ''),
      ui.ButtonSet.OK);
  } catch (error) {
    console.error('Send assignment dates failed: ' + (error.canvasType || error.message));
    ss.toast('', '', 1);
    ui.alert('Send assignment dates', 'Could not finish. ' + describeCanvasError_(error),
      ui.ButtonSet.OK);
  }
}

/**
 * Menu: Sort by selected column. Sorts assignments (earliest / A to Z first, blanks last)
 * by their own row's value in the column of the selected cell; each assignment's "↳"
 * rows move with it and stay right below it. Sheet only: nothing goes to Canvas.
 * A date column also sorts by its time column. Uses the sheet's own sort, on a temporary
 * key column, so checkboxes, links, notes, and date pickers move with their rows.
 */
function sortAssignmentDatesBySelectedColumn() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSheet();
  const title = 'Sort assignment dates';
  if (sheet.getName() !== DATES_SHEET_NAME) {
    ui.alert(title, `Go to the ${DATES_SHEET_NAME} tab, click a cell in the column to sort ` +
      'by, and run this again.', ui.ButtonSet.OK);
    return;
  }
  const col = sheet.getActiveCell().getColumn();
  const count = sheet.getLastRow() - DATES_FIRST_DATA_ROW + 1;
  if (col > DATES_HEADERS.length || count < 2) {
    ui.alert(title, 'Click a cell in one of the table\'s columns (A to N) and run this ' +
      'again. Nothing was changed.', ui.ButtonSet.OK);
    return;
  }
  const filter = sheet.getFilter();
  if (filter && DATES_HEADERS.some((_, i) => filter.getColumnFilterCriteria(i + 1))) {
    ui.alert(title, 'The filter is hiding some rows. Clear the filter (show all rows) and ' +
      'run this again. Nothing was changed.', ui.ButtonSet.OK);
    return;
  }

  const width = Math.max(sheet.getLastColumn(), DATES_HEADERS.length);
  const table = sheet.getRange(DATES_FIRST_DATA_ROW, 1, count, DATES_HEADERS.length);
  const order = groupedSortOrder_(table.getValues(), table.getDisplayValues(), col);
  // Temporary key column just right of everything, so every column moves together.
  const keyRange = sheet.getRange(DATES_FIRST_DATA_ROW, width + 1, count, 1);
  keyRange.setValues(order.map(n => [n]));
  sheet.getRange(DATES_FIRST_DATA_ROW, 1, count, width + 1).sort({ column: width + 1 });
  keyRange.clearContent();
  // Rewrite Schedule Info so each row's formula reads its own due date after the move.
  sheet.getRange(DATES_FIRST_DATA_ROW, 8, count, 1)
    .setFormulas(order.map((_, i) => [datesScheduleFormula_(DATES_FIRST_DATA_ROW + i)]));
  SpreadsheetApp.getActiveSpreadsheet().toast(`Sorted by ${DATES_HEADERS[col - 1]}.`,
    'Assignment Dates', 3);
}

/**
 * For each sheet row (in current order), its new position after a sort that keeps each
 * assignment's rows together: groups (by assignment ID) are sorted by their assignment
 * row's value in column col; inside a group the assignment row comes first, then its "↳"
 * rows in their current order. Rows with no ID stay groups of their own.
 */
function groupedSortOrder_(values, shown, col) {
  const groups = [];
  const byId = new Map();
  values.forEach((row, i) => {
    const id = String(row[DATES_COL.id - 1]).trim();
    const isOverride = String(row[DATES_COL.override - 1]).trim() !== '';
    let group = id ? byId.get(id) : null;
    if (!group) {
      group = { rows: [], keyRow: i, start: groups.length };
      groups.push(group);
      if (id) byId.set(id, group);
    }
    if (isOverride) {
      group.rows.push(i);
    } else {
      group.rows.unshift(i); // assignment row first
      group.keyRow = i;
    }
  });

  const dateField = DATES_FIELDS.find(f => f.dateCol === col);
  const keyOf = i => {
    const v = values[i][col - 1];
    if (v === '' || v === null) return null;
    if (v instanceof Date) {
      const minutes = dateField ? timeTextMinutes_(shown[i][dateField.timeCol - 1]) : 0;
      return v.getTime() + minutes * 60000;
    }
    if (typeof v === 'number' || typeof v === 'boolean') return Number(v);
    return String(shown[i][col - 1]).replace(/^↳\s*/, '').toLowerCase();
  };
  const keyed = groups.map(g => ({ g, key: keyOf(g.keyRow) }));
  keyed.sort((a, b) => {
    if (a.key === null || b.key === null) {
      return a.key === b.key ? a.g.start - b.g.start : a.key === null ? 1 : -1;
    }
    if (typeof a.key === 'number' && typeof b.key === 'number') {
      return a.key - b.key || a.g.start - b.g.start;
    }
    return String(a.key).localeCompare(String(b.key), undefined, { numeric: true }) ||
      a.g.start - b.g.start;
  });

  const order = new Array(values.length);
  let next = 0;
  keyed.forEach(({ g }) => g.rows.forEach(i => { order[i] = next++; }));
  return order;
}

/** '4:00 pm' -> 960 (minutes after midnight); blank or unreadable -> 0. */
function timeTextMinutes_(text) {
  const t = String(text).trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/i);
  if (!t) return 0;
  let hour = Number(t[1]);
  const ampm = (t[3] || '').toLowerCase();
  if (ampm === 'pm' && hour < 12) hour += 12;
  if (ampm === 'am' && hour === 12) hour = 0;
  return hour * 60 + Number(t[2]);
}

/** Course ID from *Config* B4, or null after telling the user it is missing. */
function getDatesCourseId_() {
  const courseId = String(getConfig().COURSE_ID).trim();
  if (/^\d+$/.test(courseId)) return courseId;
  const ui = SpreadsheetApp.getUi();
  ui.alert('Assignment Dates', 'The Course ID in *Config* B4 is missing or not a number. ' +
    'Nothing was done.', ui.ButtonSet.OK);
  return null;
}

/** Schedule Info formula for sheet row r: the school schedule on that row's due date. */
function datesScheduleFormula_(r) {
  const lookup = col => `VLOOKUP(I${r}, '*simpleSchedule*'!C:F, ${col}, FALSE)`;
  return `=IF(I${r}<>"", IFERROR(${lookup(3)} & " : " & ${lookup(4)}, "No Match"), "")`;
}

/** A copy of the assignments, earliest due first; no due date last; ties keep Canvas order. */
function sortByDueDate_(assignments) {
  const due = a => (a.due_at ? new Date(a.due_at).getTime() : Infinity);
  return [...assignments].sort((a, b) => {
    const da = due(a);
    const db = due(b);
    return da === db ? 0 : da < db ? -1 : 1;
  });
}

/** Clears row 2 down (row 1 keeps any drawn buttons) and writes the assignment table. */
function writeDatesSheet_(sheet, assignments, studentNames, tz) {
  const filter = sheet.getFilter();
  if (filter) filter.remove();
  if (sheet.getLastRow() >= DATES_HEADER_ROW) {
    sheet.getRange(DATES_HEADER_ROW, 1, sheet.getLastRow() - DATES_HEADER_ROW + 1,
      Math.max(sheet.getLastColumn(), DATES_HEADERS.length))
      .clear().clearDataValidations().clearNote();
  }
  sheet.getRange(DATES_HEADER_ROW, 1, 1, DATES_HEADERS.length)
    .setValues([DATES_HEADERS]).setFontWeight('bold').setBackground('#f3f3f3');
  sheet.setFrozenRows(DATES_HEADER_ROW);
  if (!assignments.length) return;

  const loaded = 'Loaded (' + Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm') + ')';
  const rows = [];
  // Notes and italics for date/time columns F–L, row by row (italic = uses the assignment's date).
  const notes = [];
  const styles = [];
  const addRow = (item, dates, nameCell, status, overrideId, inheritedFields) => {
    const r = DATES_FIRST_DATA_ROW + rows.length;
    const open = formatDisplayDateTime_(dates.unlock_at, tz);
    const due = formatDisplayDateTime_(dates.due_at, tz);
    const lock = formatDisplayDateTime_(dates.lock_at, tz);
    rows.push([
      false,
      item.id,
      nameCell,
      overrideId ? '' : (item.submission_types || []).join(', '),
      overrideId ? '' : (item.points_possible ?? ''),
      open.date, open.time,
      datesScheduleFormula_(r),
      due.date, due.time,
      lock.date, lock.time,
      status,
      overrideId,
    ]);
    const noteRow = ['', '', '', '', '', '', ''];
    const styleRow = noteRow.map(() => 'normal');
    DATES_FIELDS.filter(f => inheritedFields.includes(f.field)).forEach(f => {
      [f.dateCol, f.timeCol].forEach(col => {
        noteRow[col - 6] = DATES_INHERITED_NOTE;
        styleRow[col - 6] = 'italic';
      });
    });
    notes.push(noteRow);
    styles.push(styleRow);
  };

  sortByDueDate_(assignments).forEach(item => {
    const name = String(item.name || 'Untitled').replace(/"/g, '""');
    const url = String(item.html_url || '').replace(/"/g, '');
    addRow(item, item, `=HYPERLINK("${url}", "${name}")`, loaded, '', []);
    (item.overrides || []).forEach(override => {
      const dates = {};
      const inherited = [];
      DATES_FIELDS.forEach(f => {
        dates[f.field] = overrideDate_(override, item, f.field);
        if (!(f.field in override)) inherited.push(f.field);
      });
      addRow(item, dates, overrideLabel_(override, studentNames),
        overrideKind_(override) ? loaded : DATES_EDIT_IN_CANVAS, override.id, inherited);
    });
  });

  const count = rows.length;
  const first = DATES_FIRST_DATA_ROW;
  sheet.getRange(first, 1, count, DATES_HEADERS.length).setValues(rows);
  sheet.getRange(first, 6, count, 7).setNotes(notes).setFontStyles(styles);
  sheet.getRange(first, 1, count, 1).insertCheckboxes();
  sheet.getRange(first, 2, count, 4).setFontColor('#666666'); // reference only, not pushed
  sheet.getRange(first, DATES_COL.override, count, 1).setFontColor('#666666');
  sheet.getRange(first, 5, count, 1).setNumberFormat('0.##');
  // A date rule gives each date cell a calendar picker (double-click) and rejects typos.
  const dateRule = SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(false)
    .setHelpText('Double-click for a calendar, or type a date like 8/12/26.').build();
  [6, 9, 11].forEach(col => sheet.getRange(first, col, count, 1)
    .setNumberFormat('m/d/yy').setDataValidation(dateRule));
  [7, 10, 12].forEach(col => sheet.getRange(first, col, count, 1).setNumberFormat('h:mm am/pm'));
  sheet.getRange(first, 6, count, 2).setFontColor('#0d522c').setBackground('#e6f4ea'); // open
  sheet.getRange(first, 8, count, 1).setFontColor('#4a148c').setBackground('#f3e5f5'); // schedule
  sheet.getRange(first, 9, count, 2).setFontColor('#1a73e8').setBackground('#e8f0fe'); // due
  sheet.getRange(first, 11, count, 2).setFontColor('#9c0006').setBackground('#fce8e6'); // lock
  sheet.getRange(DATES_HEADER_ROW, 1, count + 1, DATES_HEADERS.length).createFilter();
}

/**
 * Reads checked rows and compares each with Canvas. Returns { toSend, skipped, problems }.
 * Each job: { row, path, fields, payload }. Skipped rows get a reason in Sync Status.
 * A row with an Override ID is a section-date row; the rest are assignment rows.
 */
function planDateUpdates_(sheet, courseId, live, tz) {
  const count = sheet.getLastRow() - DATES_FIRST_DATA_ROW + 1;
  const values = sheet.getRange(DATES_FIRST_DATA_ROW, 1, count, DATES_HEADERS.length).getValues();
  // Display text, so dates and times are read exactly as shown on the sheet.
  const shown = sheet.getRange(DATES_FIRST_DATA_ROW, 1, count, DATES_HEADERS.length)
    .getDisplayValues();
  const plan = { toSend: [], skipped: 0, problems: [] };

  values.forEach((row, i) => {
    if (row[DATES_COL.check - 1] !== true) return;
    const sheetRow = DATES_FIRST_DATA_ROW + i;
    const id = String(row[DATES_COL.id - 1]).trim();
    const skip = reason => {
      sheet.getRange(sheetRow, DATES_COL.status).setValue(reason);
      plan.skipped++;
    };
    const overrideId = String(row[DATES_COL.override - 1]).trim();
    const assignment = live.get(id);
    if (!assignment) return skip('Not found in Canvas: fetch again');
    let override = null;
    if (overrideId) {
      override = (assignment.overrides || []).find(o => String(o.id) === overrideId);
      if (!override) return skip('Section dates not found in Canvas: fetch again');
      if (!overrideKind_(override)) return skip(DATES_EDIT_IN_CANVAS);
    }

    const changed = {};
    const fields = [];
    for (const f of DATES_FIELDS) {
      const parsed = parseSheetDateTime_(shown[i][f.dateCol - 1], shown[i][f.timeCol - 1], tz);
      if (parsed.error) {
        plan.problems.push(`Row ${sheetRow}: ${f.label} ${parsed.error}`);
        return;
      }
      const current = override ? overrideDate_(override, assignment, f.field) :
        assignment[f.field];
      if (!sameMinute_(parsed.date, current)) {
        changed[f.field] = parsed.date ? parsed.date.toISOString() : null;
        fields.push(f.field);
      }
    }
    if (!fields.length) return skip('No changes');

    const assignmentPath = `/courses/${courseId}/assignments/${id}`;
    if (!override) {
      plan.toSend.push({ row: sheetRow, path: assignmentPath, fields,
        payload: { assignment: changed } });
      return;
    }
    // Canvas un-sets any override date left out of the PUT, so keep the ones it already sets.
    const body = {};
    DATES_FIELDS.forEach(f => {
      if (f.field in changed) body[f.field] = changed[f.field];
      else if (f.field in override) body[f.field] = override[f.field];
    });
    // Same students as now (held in memory only; never written to the sheet or logged).
    if (overrideKind_(override) === 'students') body.student_ids = override.student_ids;
    plan.toSend.push({ row: sheetRow, path: `${assignmentPath}/overrides/${overrideId}`, fields,
      payload: { assignment_override: body } });
  });
  return plan;
}

/** Sends each job through canvasWrite_. Stops early on errors that would hit every row. */
function sendDateUpdates_(sheet, jobs, tz) {
  const result = { sent: 0, failed: 0, dryRun: isDryRun_(), stoppedMessage: '' };
  for (const job of jobs) {
    const status = sheet.getRange(job.row, DATES_COL.status);
    try {
      canvasWrite_('PUT', job.path, job.payload);
      if (result.dryRun) {
        status.setValue(`Dry run OK (${job.fields.length} date(s))`);
      } else {
        status.setValue('Updated (' + Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm') + ')');
        sheet.getRange(job.row, DATES_COL.check).setValue(false);
      }
      result.sent++;
    } catch (error) {
      result.failed++;
      status.setValue('Failed: ' + describeCanvasError_(error));
      if (EVENTS_STOP_ALL_TYPES.includes(error.canvasType)) { // 03_Content_Sync.js
        result.stoppedMessage = describeCanvasError_(error);
        break;
      }
    }
  }
  return result;
}

/**
 * Map of student ID -> name for every student on a student-date override, read from the
 * course's users in batches. Empty when no assignment has student dates. Names are only
 * for the sheet: never log them.
 */
function getOverrideStudentNames_(courseId, assignments) {
  const ids = [...new Set(assignments.flatMap(a => (a.overrides || [])
    .flatMap(o => o.student_ids || []).map(String)))];
  const names = new Map();
  for (let i = 0; i < ids.length; i += DATES_NAME_BATCH) {
    canvasGet_(`/courses/${courseId}/users`, {
      'user_ids[]': ids.slice(i, i + DATES_NAME_BATCH),
      'enrollment_state[]': ['active', 'invited', 'inactive', 'completed'],
    }).forEach(user => names.set(String(user.id), user.name));
  }
  return names;
}

/** Who a section-date override is for: 'section', 'students', 'group', or null (other). */
function overrideKind_(override) {
  if (override.course_section_id) return 'section';
  if (Array.isArray(override.student_ids)) return 'students';
  if (override.group_id) return 'group';
  return null;
}

/**
 * Name-column text for a section-date row. Students show their names from studentNames
 * (a Map of ID -> name), up to DATES_MAX_NAMES then "+ n more"; a student Canvas didn't
 * return is counted as "student". Groups show no name. The "↳" also stops a name that
 * starts with "=" from turning into a formula.
 */
function overrideLabel_(override, studentNames) {
  const kind = overrideKind_(override);
  if (kind === 'section') return '↳ ' + (override.title || 'Section');
  if (kind === 'students') {
    const names = override.student_ids.map(id => studentNames.get(String(id)) || 'student');
    if (!names.length) return '↳ 0 students';
    const shown = names.slice(0, DATES_MAX_NAMES).join(', ');
    const more = names.length - DATES_MAX_NAMES;
    return '↳ ' + shown + (more > 0 ? ` + ${more} more` : '');
  }
  if (kind === 'group') return '↳ Group';
  return '↳ Other (see Canvas)';
}

/**
 * The date an override row actually uses for one field: the override's own date when it
 * sets that field (Canvas sends the key only then, possibly as null), else the assignment's.
 */
function overrideDate_(override, assignment, field) {
  return field in override ? override[field] : assignment[field];
}

/** ISO date from Canvas -> { date: '8/12/26', time: '4:00 pm' } in the sheet's time zone. */
function formatDisplayDateTime_(isoString, tz) {
  if (!isoString) return { date: '', time: '' };
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return { date: '', time: '' };
  return {
    date: Utilities.formatDate(d, tz, 'M/d/yy'),
    time: Utilities.formatDate(d, tz, 'h:mm a').toLowerCase(),
  };
}

/**
 * Sheet text like '8/12/26' and '4:00 pm' -> { date } (a Date, or null when both are
 * blank) or { error }. A date needs a time, so nothing lands at midnight by accident.
 * 11:59 pm is sent as 11:59:59 pm, which is what Canvas uses for end of day.
 */
function parseSheetDateTime_(dateText, timeText, tz) {
  const dateStr = String(dateText).trim();
  const timeStr = String(timeText).trim();
  if (!dateStr && !timeStr) return { date: null };
  if (!dateStr) return { error: 'time has no date (clear both to remove the date).' };
  if (!timeStr) return { error: 'date needs a time, for example 11:59 pm.' };

  const d = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!d) return { error: `date "${dateStr}" should look like 8/12/26.` };
  const t = timeStr.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/i);
  if (!t) return { error: `time "${timeStr}" should look like 4:00 pm.` };

  const month = Number(d[1]);
  const day = Number(d[2]);
  const year = d[3].length === 2 ? 2000 + Number(d[3]) : Number(d[3]);
  let hour = Number(t[1]);
  const minute = Number(t[2]);
  const ampm = (t[3] || '').toLowerCase();
  if (ampm === 'pm' && hour < 12) hour += 12;
  if (ampm === 'am' && hour === 12) hour = 0;
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) {
    return { error: `"${dateStr} ${timeStr}" is not a real date and time.` };
  }
  const pad = n => String(n).padStart(2, '0');
  const seconds = hour === 23 && minute === 59 ? '59' : '00';
  const parsed = Utilities.parseDate(
    `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${seconds}`,
    tz, 'yyyy-MM-dd HH:mm:ss');
  // parseDate rolls 2/31 over to 3/3; reject that instead of sending a different day.
  if (Utilities.formatDate(parsed, tz, 'M/d/yyyy') !== `${month}/${day}/${year}`) {
    return { error: `"${dateStr}" is not a real date.` };
  }
  return { date: parsed };
}

/** True when a sheet Date (or null) and a Canvas ISO string (or null) match to the minute. */
function sameMinute_(sheetDate, canvasIso) {
  if (!sheetDate || !canvasIso) return !sheetDate && !canvasIso;
  const minute = ms => Math.floor(ms / 60000);
  return minute(sheetDate.getTime()) === minute(new Date(canvasIso).getTime());
}
