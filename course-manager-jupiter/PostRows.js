/**
 * PostRows.js
 * Purpose: the createByRow tab: create Canvas items from selected rows (row 4 and below),
 *   without overrides. Ported from the legacy postRows, postSingleAssignment, and
 *   generateDescription2; the legacy convertToUTC custom function and the O–R formula
 *   columns are replaced by code (buildCanvasTime_).
 *   - postRows (same name as legacy, so the button works): for each selected row, builds
 *     the request, writes it to the Payload column, sends it through canvasWrite_, and
 *     writes CanvasID, Canvas Link, and Status.
 *   - previewRows: fills Payload and Status for the selected rows; never sends anything.
 *   - checkCreateByRowLabels: checks the row 3 labels.
 *   Columns are found by their row 3 labels (CREATE_BY_ROW_LABELS), so their order can
 *   change. Rows that already have a CanvasID are skipped (no duplicates). A blank time
 *   means 11:59 PM on that date. Times are sent with the Sheet's UTC offset
 *   (e.g. 2026-01-28T14:05:00-10:00), so the Payload is readable in Hawaii time.
 *   Built so far: Type A (assignment). D, NQ, and CQ come in later steps.
 *   No student data is read or written. Logs counts only.
 * Canvas endpoints called: none directly.
 * Canvas write operations (via canvasWrite_, so DRY_RUN applies):
 *   POST /api/v1/courses/:course/assignments (Type A)
 * Required User/Script Properties: User Properties CANVAS_BASE_URL and CANVAS_TOKEN;
 *   Script Property DRY_RUN. Named ranges: cfg_CourseID (cfg_CourseName for messages).
 */

const CREATE_BY_ROW_HEADER_ROW = 3;
const CREATE_BY_ROW_FIRST_ROW = 4;
// Exact row 3 labels the code needs. ("Schedule" may also be there; the code ignores it.)
const CREATE_BY_ROW_LABELS = Object.freeze({
  NAME: 'name',
  TYPE: 'Type',
  POINTS: 'points_possible',
  DUE_DATE: 'Due Date',
  DUE_TIME: 'Due Time',
  UNLOCK_DATE: 'Unlock Date',
  UNLOCK_TIME: 'Unlock Time',
  LOCK_DATE: 'Lock Date',
  LOCK_TIME: 'Lock Time',
  DESCRIPTION: 'Description Text',
  DOC_LINK: 'Doc Link',
  LINK_TEXT: 'Link Text',
  CANVAS_ID: 'CanvasID',
  CANVAS_LINK: 'Canvas Link',
  PAYLOAD: 'Payload',
  STATUS: 'Status',
});
const CREATE_BY_ROW_BUILT_TYPES = Object.freeze(['A']);
const CREATE_BY_ROW_KNOWN_TYPES = Object.freeze(['A', 'D', 'NQ', 'CQ']);
const CREATE_BY_ROW_BLANK_TIME = Object.freeze({ hours: 23, minutes: 59 });
const CREATE_BY_ROW_TIME_LIMIT_MS = 5 * 60 * 1000;

/** Adds this file's menu items. Called by onOpen. */
function addCreateByRowMenuItems_(menu) {
  menu.addSeparator();
  menu.addItem('Preview selected rows', 'previewRows');
  menu.addItem('Post selected rows', 'postRows');
  menu.addItem('Check createByRow labels', 'checkCreateByRowLabels');
}

/** Button / menu: Check createByRow labels. Lists any row 3 labels that are missing. */
function checkCreateByRowLabels() {
  const ui = SpreadsheetApp.getUi();
  try {
    const sheet = getCreateByRowSheet_(SpreadsheetApp.getActiveSpreadsheet());
    const { missing } = findCreateByRowColumns_(sheet);
    ui.alert('Check createByRow labels', missing.length ?
      `Row ${CREATE_BY_ROW_HEADER_ROW} is missing ${missing.length} label(s):\n• ` +
        missing.join('\n• ') + '\n\nLabels must match exactly, including capitals.' :
      `All ${Object.keys(CREATE_BY_ROW_LABELS).length} labels are in row ` +
        `${CREATE_BY_ROW_HEADER_ROW}.`, ui.ButtonSet.OK);
  } catch (error) {
    reportRefreshFailure_('Check createByRow labels', 'Nothing was changed.', error);
  }
}

/**
 * Button / menu: Preview selected rows. Fills Payload with the JSON that Post would send
 * and Status with what would happen. Never sends anything, whatever the dry-run setting.
 */
function previewRows() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  try {
    const job = readSelectedRows_(ss);
    let ready = 0;
    job.plans.forEach(plan => {
      if (plan.request) {
        ready++;
        job.write(plan, CREATE_BY_ROW_LABELS.PAYLOAD, JSON.stringify(plan.request.payload));
        job.write(plan, CREATE_BY_ROW_LABELS.STATUS, `Preview (${plan.type}): not sent`);
      } else {
        job.write(plan, CREATE_BY_ROW_LABELS.STATUS, plan.message);
      }
    });
    console.log(`Preview rows: ${ready} ready, ${job.plans.length - ready} not.`);
    ss.toast(`${ready} row(s) ready to post; ${job.plans.length - ready} skipped or with a ` +
      'problem (see Status). Nothing was sent.', 'Preview selected rows', 8);
  } catch (error) {
    reportRefreshFailure_('Preview selected rows', 'Nothing was sent.', error);
  }
}

/**
 * Button / menu: Post selected rows. Asks first (showing counts and the dry-run state),
 * then sends each ready row through canvasWrite_ and writes the results.
 */
function postRows() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  try {
    const started = Date.now();
    const job = readSelectedRows_(ss);
    const toSend = job.plans.filter(plan => plan.request);
    const notSent = job.plans.filter(plan => !plan.request);
    notSent.forEach(plan => job.write(plan, CREATE_BY_ROW_LABELS.STATUS, plan.message));
    if (!toSend.length) {
      ui.alert('Post selected rows', 'Nothing to post: every selected row was skipped or has ' +
        'a problem. See the Status column.', ui.ButtonSet.OK);
      return;
    }

    const dryRun = isDryRun_();
    const answer = ui.alert('Post selected rows',
      `Post ${toSend.length} row(s) (${countTypes_(toSend)}) to ${courseLabel_()}?` +
      (notSent.length ? `\n${notSent.length} other row(s) will be skipped (see Status).` : '') +
      '\n\n' + (dryRun ? 'Dry run is ON: nothing will be sent.' :
        'Dry run is OFF: this creates them in Canvas.'), ui.ButtonSet.YES_NO);
    if (answer !== ui.Button.YES) return;

    let posted = 0;
    let failed = 0;
    let timedOut = false;
    for (const plan of toSend) {
      if (Date.now() - started > CREATE_BY_ROW_TIME_LIMIT_MS) {
        timedOut = true;
        break;
      }
      job.write(plan, CREATE_BY_ROW_LABELS.PAYLOAD, JSON.stringify(plan.request.payload));
      try {
        const result = canvasWrite_('POST', plan.request.path, plan.request.payload);
        if (result.dryRun) {
          job.write(plan, CREATE_BY_ROW_LABELS.STATUS, `Dry run (${plan.type}): not sent`);
        } else {
          job.write(plan, CREATE_BY_ROW_LABELS.CANVAS_ID, result.id || '');
          job.write(plan, CREATE_BY_ROW_LABELS.CANVAS_LINK, result.html_url || '');
          job.write(plan, CREATE_BY_ROW_LABELS.STATUS, `Posted (${plan.type})`);
        }
        posted++;
      } catch (error) {
        if (!error.canvasType || CANVAS_STOP_ALL_TYPES.includes(error.canvasType)) {
          job.write(plan, CREATE_BY_ROW_LABELS.STATUS, 'Stopped: ' + describeCanvasError_(error));
          throw error;
        }
        job.write(plan, CREATE_BY_ROW_LABELS.STATUS, 'Not posted: ' + error.message);
        failed++;
      }
    }

    console.log(`Post rows${dryRun ? ' (dry run)' : ''}: ${posted} sent, ${failed} refused, ` +
      `${notSent.length} skipped` + (timedOut ? ', stopped at time limit.' : '.'));
    ui.alert('Post selected rows',
      (dryRun ? `Dry run: ${posted} row(s) would have been posted. Nothing was sent.` :
        `${posted} row(s) posted.`) +
      (failed ? `\n${failed} row(s) were refused by Canvas (see Status).` : '') +
      (notSent.length ? `\n${notSent.length} row(s) skipped (see Status).` : '') +
      (timedOut ? '\n\nStopped near the time limit; select the rest and post again.' : ''),
      ui.ButtonSet.OK);
  } catch (error) {
    reportRefreshFailure_('Post selected rows', 'Rows already posted keep their CanvasID; ' +
      'see the Status column.', error);
  }
}

function getCreateByRowSheet_(ss) {
  const sheet = ss.getSheetByName(TOOL_SHEETS.CREATE_BY_ROW);
  if (!sheet) throw sheetProblem_(`There is no tab named ${TOOL_SHEETS.CREATE_BY_ROW}.`);
  return sheet;
}

/** Finds each label's column (1-based) in row 3: { columns: Map(label → column), missing }. */
function findCreateByRowColumns_(sheet) {
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const header = sheet.getRange(CREATE_BY_ROW_HEADER_ROW, 1, 1, lastColumn).getValues()[0]
    .map(value => String(value).trim());
  const columns = new Map();
  const missing = [];
  Object.values(CREATE_BY_ROW_LABELS).forEach(label => {
    const index = header.indexOf(label);
    if (index === -1) missing.push(label);
    else columns.set(label, index + 1);
  });
  return { columns, missing };
}

/**
 * Reads the selected rows (row 4 and below) on createByRow and plans each one:
 * { plans: [{ rowNumber, type, request?, message? }], write(plan, label, value) }.
 * Blank rows (no name and no type) are left out.
 */
function readSelectedRows_(ss) {
  const sheet = getCreateByRowSheet_(ss);
  const { columns, missing } = findCreateByRowColumns_(sheet);
  if (missing.length) {
    throw sheetProblem_(`Row ${CREATE_BY_ROW_HEADER_ROW} of ${TOOL_SHEETS.CREATE_BY_ROW} is ` +
      `missing these labels: ${missing.join(', ')}. Use Check createByRow labels.`);
  }
  const range = SpreadsheetApp.getActiveRange();
  const firstRow = range ? Math.max(range.getRow(), CREATE_BY_ROW_FIRST_ROW) : 0;
  const lastRow = range ? range.getLastRow() : 0;
  if (!range || range.getSheet().getName() !== TOOL_SHEETS.CREATE_BY_ROW || lastRow < firstRow) {
    throw sheetProblem_(`Select the rows to use (row ${CREATE_BY_ROW_FIRST_ROW} and below) ` +
      `on ${TOOL_SHEETS.CREATE_BY_ROW}, then try again.`);
  }

  const courseId = getCourseIdForRefresh_();
  const timeZone = ss.getSpreadsheetTimeZone();
  const block = sheet.getRange(firstRow, 1, lastRow - firstRow + 1, sheet.getLastColumn());
  const values = block.getValues();
  const shown = block.getDisplayValues();
  const pick = (row, label) => row.slice(columns.get(label) - 1, columns.get(label))[0];
  const plans = values
    .map((row, i) => {
      const displayRow = shown.slice(i, i + 1)[0];
      const cell = label => pick(row, label);
      const text = label => String(pick(displayRow, label)).trim();
      return planCreateByRow_(firstRow + i, cell, text, courseId, timeZone);
    })
    .filter(Boolean);

  return {
    plans,
    write: (plan, label, value) =>
      sheet.getRange(plan.rowNumber, columns.get(label)).setValue(value),
  };
}

/**
 * Plans one row. cell(label) gives the cell's value, text(label) its displayed text.
 * Returns null for a blank row, { request } when ready, or { message } when not.
 */
function planCreateByRow_(rowNumber, cell, text, courseId, timeZone) {
  const name = text(CREATE_BY_ROW_LABELS.NAME);
  const type = text(CREATE_BY_ROW_LABELS.TYPE).toUpperCase();
  if (!name && !type) return null;
  const plan = { rowNumber, type: type || '?' };
  if (!isBlank_(cell(CREATE_BY_ROW_LABELS.CANVAS_ID))) {
    return Object.assign(plan, { message: 'Skipped: already has a CanvasID' });
  }
  if (!name) return Object.assign(plan, { message: 'Skipped: no name' });
  if (!CREATE_BY_ROW_KNOWN_TYPES.includes(type)) {
    return Object.assign(plan, { message: `Skipped: Type "${type}" is not A, D, NQ, or CQ` });
  }
  if (!CREATE_BY_ROW_BUILT_TYPES.includes(type)) {
    return Object.assign(plan, { message: `Skipped: Type ${type} is not built yet` });
  }
  try {
    const time = (dateLabel, timeLabel, what) => buildCanvasTime_(cell(dateLabel),
      text(timeLabel), timeZone, what);
    const fields = {
      name,
      points: cell(CREATE_BY_ROW_LABELS.POINTS),
      dueAt: time(CREATE_BY_ROW_LABELS.DUE_DATE, CREATE_BY_ROW_LABELS.DUE_TIME, 'Due'),
      unlockAt: time(CREATE_BY_ROW_LABELS.UNLOCK_DATE, CREATE_BY_ROW_LABELS.UNLOCK_TIME, 'Unlock'),
      lockAt: time(CREATE_BY_ROW_LABELS.LOCK_DATE, CREATE_BY_ROW_LABELS.LOCK_TIME, 'Lock'),
      description: buildDescription_(text(CREATE_BY_ROW_LABELS.DESCRIPTION),
        text(CREATE_BY_ROW_LABELS.DOC_LINK), text(CREATE_BY_ROW_LABELS.LINK_TEXT)),
    };
    return Object.assign(plan, {
      request: { path: `/courses/${courseId}/assignments`, payload: assignmentPayload_(fields) },
    });
  } catch (error) {
    if (!error.isSheetProblem) throw error;
    return Object.assign(plan, { message: 'Not ready: ' + error.message });
  }
}

/** The Type A request body (same fields as legacy postSingleAssignment). */
function assignmentPayload_(fields) {
  const points = isBlank_(fields.points) ? 0 : Number(fields.points);
  if (isNaN(points)) throw sheetProblem_('points_possible is not a number');
  const assignment = {
    name: fields.name,
    points_possible: points,
    description: fields.description,
    submission_types: ['online_upload'],
    published: true,
  };
  if (fields.dueAt) assignment.due_at = fields.dueAt;
  if (fields.unlockAt) assignment.unlock_at = fields.unlockAt;
  if (fields.lockAt) assignment.lock_at = fields.lockAt;
  return { assignment };
}

/**
 * A Canvas date-time from a date cell and a time's displayed text, in the Sheet's time
 * zone, e.g. "2026-01-28T14:05:00-10:00". '' when the date is blank. A blank time means
 * 11:59 PM. Replaces the legacy convertToUTC custom function.
 */
function buildCanvasTime_(dateValue, timeText, timeZone, what) {
  if (isBlank_(dateValue)) return '';
  if (!(dateValue instanceof Date) || isNaN(dateValue.getTime())) {
    throw sheetProblem_(`${what} Date is not a date`);
  }
  const time = timeText ? parseSheetTime_(timeText) : CREATE_BY_ROW_BLANK_TIME;
  if (!time) throw sheetProblem_(`${what} Time "${timeText}" is not a time I understand`);
  const day = Utilities.formatDate(dateValue, timeZone, 'yyyy-MM-dd');
  const offset = Utilities.formatDate(dateValue, timeZone, 'Z').replace(/(\d{2})(\d{2})$/, '$1:$2');
  const pad = number => String(number).padStart(2, '0');
  return `${day}T${pad(time.hours)}:${pad(time.minutes)}:00${offset}`;
}

/**
 * Reads a time the way the legacy column O formula did: a dropdown choice with a 24-hour
 * time in parentheses ("School start (0815)"), "8:15 AM" / "14:05", or "0815".
 * Returns { hours, minutes }, or null if it isn't a time.
 */
function parseSheetTime_(text) {
  const value = String(text).trim();
  const match = value.match(/\((\d{3,4})\)/) || value.match(/^(\d{3,4})$/);
  if (match) {
    const digits = match[1].padStart(4, '0');
    return validTime_(Number(digits.slice(0, 2)), Number(digits.slice(2)));
  }
  // "8:15" or "8:15:00", then optionally AM/PM.
  const clock = value.match(/^[\d:]+/);
  if (!clock) return null;
  const parts = clock[0].split(':');
  const [hourText, minuteText, secondText = '00'] = parts;
  if (parts.length < 2 || parts.length > 3 || !/^\d{1,2}$/.test(hourText) ||
      !/^\d{2}$/.test(minuteText) || !/^\d{2}$/.test(secondText)) {
    return null;
  }
  const meridiem = value.slice(clock[0].length).trim().toUpperCase();
  if (meridiem !== '' && meridiem !== 'AM' && meridiem !== 'PM') return null;
  let hours = Number(hourText);
  const minutes = Number(minuteText);
  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    if (meridiem === 'PM' && hours !== 12) hours += 12;
  }
  return validTime_(hours, minutes);
}

function validTime_(hours, minutes) {
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59 ? { hours, minutes } : null;
}

/**
 * The HTML description (ported from legacy generateDescription2): the text, a blank line,
 * then, if there is a Doc link, a link to it and the Doc embedded as a preview.
 */
function buildDescription_(text, link, linkText) {
  let html = text ? `<p>${text}</p>\n` : '';
  html += '<p><br></p>\n';
  if (link) {
    const label = String(linkText || link).split('\n').map(line => line.trim())
      .filter(line => line !== '').join('<br>');
    const href = link.replace(/"/g, '&quot;');
    html += `<p><a class="inline_disabled" href="${href}" target="_blank" rel="noopener">` +
      `${label}</a></p>\n`;
    html += `<p><iframe style="width: 750px; height: 750px;" title="Google Document" ` +
      `src="${href.replace('/edit', '/preview')}" allowfullscreen="allowfullscreen" ` +
      'allow="geolocation *; microphone *; camera *; midi *; encrypted-media *; autoplay *; ' +
      'clipboard-write *; display-capture *"></iframe></p>\n';
  }
  return html;
}

/** "3 A, 1 D" for the confirm pop-up. */
function countTypes_(plans) {
  const counts = new Map();
  plans.forEach(plan => counts.set(plan.type, (counts.get(plan.type) || 0) + 1));
  return Array.from(counts, ([type, n]) => `${n} ${type}`).join(', ');
}
