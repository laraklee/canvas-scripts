/**
 * 07_AssignmentDates.js
 * Purpose: the bulk assignment dates tool (menu Canvas Tools › 📝 Assignment dates).
 *   "Load assignment dates from Canvas" fills the Assignment Dates sheet with every
 *   assignment in the course; edit the open, due, and lock dates/times there (date cells
 *   have a date picker), check Update?, then "Send changed dates to Canvas".
 *   Ported from course-manager/03d.AssignmentDates.js. Keep the two public function
 *   names: drawn buttons on row 1 of the sheet can call them.
 * Canvas endpoints called:
 *   GET /api/v1/courses/:course/assignments (read; by fetch, and again by push to compare)
 *   PUT /api/v1/courses/:course/assignments/:id (write, through canvasWrite_, so DRY_RUN
 *     applies). Sends only unlock_at, due_at, and lock_at, and only the ones that differ
 *     from Canvas. Name, points, and submission type on the sheet are for reference only.
 * Required User/Script Properties: User Properties CANVAS_BASE_URL and CANVAS_TOKEN;
 *   Script Property DRY_RUN. Course ID comes from the *Config* sheet, cell B4.
 *
 * Assignments with section-specific dates (has_overrides) are marked on fetch and skipped
 * on push: their section dates are not on this sheet. (Per-section editing is shelved
 * until someone needs it.)
 */

const DATES_SHEET_NAME = 'Assignment Dates';
const DATES_HEADER_ROW = 2;
const DATES_FIRST_DATA_ROW = 3;
const DATES_HEADERS = Object.freeze(['Update?', 'ID', 'Assignment Name', 'Sub. Type(s)',
  'Points', 'Open Date', 'Open Time', 'Schedule Info', 'Due Date', 'Due Time', 'Lock Date',
  'Lock Time', 'Sync Status']);
const DATES_COL = Object.freeze({ check: 1, id: 2, status: 13 });
// Sheet column (1-based) of each date/time pair, keyed by the Canvas field it sets.
const DATES_FIELDS = Object.freeze([
  { field: 'unlock_at', label: 'open', dateCol: 6, timeCol: 7 },
  { field: 'due_at', label: 'due', dateCol: 9, timeCol: 10 },
  { field: 'lock_at', label: 'lock', dateCol: 11, timeCol: 12 },
]);
const DATES_OVERRIDE_NOTE = 'Has section dates: edit in Canvas';

/** Menu: Load assignment dates from Canvas. Rebuilds the sheet from row 2 down. */
function fetchCanvasAssignmentDates() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  try {
    const courseId = getDatesCourseId_();
    if (!courseId) return;
    ss.toast('Fetching assignments from Canvas...', 'Assignment Dates', -1);
    const assignments = canvasGet_(`/courses/${courseId}/assignments`);
    const sheet = ss.getSheetByName(DATES_SHEET_NAME) || ss.insertSheet(DATES_SHEET_NAME);
    writeDatesSheet_(sheet, assignments, ss.getSpreadsheetTimeZone());
    console.log(`Fetch assignment dates: ${assignments.length} assignment(s) loaded.`);
    ss.toast('', '', 1);
    ui.alert('Load assignment dates', assignments.length ?
      `Loaded ${assignments.length} assignment(s).` : 'No assignments found in this course.',
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
    const live = new Map(canvasGet_(`/courses/${courseId}/assignments`)
      .map(item => [String(item.id), item]));
    const plan = planDateUpdates_(sheet, live, ss.getSpreadsheetTimeZone());
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
      `Course ${courseId}: ${plan.toSend.length} assignment(s) will change ` +
      `(${dateCount} date(s) in all). Students will see the new dates.` +
      (plan.skipped ? `\n${plan.skipped} row(s) will be skipped; see Sync Status.` : '') +
      '\n\n' + describeDryRun_(isDryRun_()) + '\n\nContinue?',
      ui.ButtonSet.YES_NO);
    if (answer !== ui.Button.YES) return;

    ss.toast(`Updating ${plan.toSend.length} assignment(s)...`, 'Assignment Dates', -1);
    const result = sendDateUpdates_(sheet, courseId, plan.toSend, ss.getSpreadsheetTimeZone());
    console.log(`Push assignment dates: ${result.sent} sent, ${result.failed} failed, ` +
      `${plan.skipped} skipped, dry run ${result.dryRun ? 'ON' : 'OFF'}.`);
    ss.toast('', '', 1);
    ui.alert('Send assignment dates',
      (result.dryRun ? `Dry run: ${result.sent} assignment(s) checked; nothing was sent to Canvas.` :
        `${result.sent} assignment(s) updated.`) +
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

/** Course ID from *Config* B4, or null after telling the user it is missing. */
function getDatesCourseId_() {
  const courseId = String(getConfig().COURSE_ID).trim();
  if (/^\d+$/.test(courseId)) return courseId;
  const ui = SpreadsheetApp.getUi();
  ui.alert('Assignment Dates', 'The Course ID in *Config* B4 is missing or not a number. ' +
    'Nothing was done.', ui.ButtonSet.OK);
  return null;
}

/** Clears row 2 down (row 1 keeps any drawn buttons) and writes the assignment table. */
function writeDatesSheet_(sheet, assignments, tz) {
  const filter = sheet.getFilter();
  if (filter) filter.remove();
  if (sheet.getLastRow() >= DATES_HEADER_ROW) {
    sheet.getRange(DATES_HEADER_ROW, 1, sheet.getLastRow() - DATES_HEADER_ROW + 1,
      Math.max(sheet.getLastColumn(), DATES_HEADERS.length)).clear().clearDataValidations();
  }
  sheet.getRange(DATES_HEADER_ROW, 1, 1, DATES_HEADERS.length)
    .setValues([DATES_HEADERS]).setFontWeight('bold').setBackground('#f3f3f3');
  sheet.setFrozenRows(DATES_HEADER_ROW);
  if (!assignments.length) return;

  const loaded = 'Loaded (' + Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm') + ')';
  const rows = assignments.map((item, i) => {
    const r = DATES_FIRST_DATA_ROW + i;
    const name = String(item.name || 'Untitled').replace(/"/g, '""');
    const url = String(item.html_url || '').replace(/"/g, '');
    const lookup = col => `VLOOKUP(I${r}, '*simpleSchedule*'!C:F, ${col}, FALSE)`;
    const open = formatDisplayDateTime_(item.unlock_at, tz);
    const due = formatDisplayDateTime_(item.due_at, tz);
    const lock = formatDisplayDateTime_(item.lock_at, tz);
    return [
      false,
      item.id,
      `=HYPERLINK("${url}", "${name}")`,
      (item.submission_types || []).join(', '),
      item.points_possible ?? '',
      open.date, open.time,
      `=IF(I${r}<>"", IFERROR(${lookup(3)} & " : " & ${lookup(4)}, "No Match"), "")`,
      due.date, due.time,
      lock.date, lock.time,
      item.has_overrides ? DATES_OVERRIDE_NOTE : loaded,
    ];
  });

  const count = rows.length;
  const first = DATES_FIRST_DATA_ROW;
  sheet.getRange(first, 1, count, DATES_HEADERS.length).setValues(rows);
  sheet.getRange(first, 1, count, 1).insertCheckboxes();
  sheet.getRange(first, 2, count, 4).setFontColor('#666666'); // reference only, not pushed
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
 * Each job: { row, id, fields, payload }. Skipped rows get a reason in Sync Status.
 */
function planDateUpdates_(sheet, live, tz) {
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
    const assignment = live.get(id);
    if (!assignment) return skip('Not found in Canvas: fetch again');
    if (assignment.has_overrides) return skip(DATES_OVERRIDE_NOTE);

    const payload = {};
    const fields = [];
    for (const f of DATES_FIELDS) {
      const parsed = parseSheetDateTime_(shown[i][f.dateCol - 1], shown[i][f.timeCol - 1], tz);
      if (parsed.error) {
        plan.problems.push(`Row ${sheetRow}: ${f.label} ${parsed.error}`);
        return;
      }
      if (!sameMinute_(parsed.date, assignment[f.field])) {
        payload[f.field] = parsed.date ? parsed.date.toISOString() : null;
        fields.push(f.field);
      }
    }
    if (!fields.length) return skip('No changes');
    plan.toSend.push({ row: sheetRow, id, fields, payload: { assignment: payload } });
  });
  return plan;
}

/** Sends each job through canvasWrite_. Stops early on errors that would hit every row. */
function sendDateUpdates_(sheet, courseId, jobs, tz) {
  const result = { sent: 0, failed: 0, dryRun: isDryRun_(), stoppedMessage: '' };
  for (const job of jobs) {
    const status = sheet.getRange(job.row, DATES_COL.status);
    try {
      canvasWrite_('PUT', `/courses/${courseId}/assignments/${job.id}`, job.payload);
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
