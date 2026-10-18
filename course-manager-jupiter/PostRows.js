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
 *   change. Rows that already have a CanvasID are skipped (no duplicates). A blank Due or
 *   Lock Time means 11:59 PM on that date; a blank Unlock Time means 12:00 AM (the start
 *   of that day). Times are sent with the Sheet's UTC offset
 *   (e.g. 2026-01-28T14:05:00-10:00), so the Payload is readable in Hawaii time.
 *   Optional "Published" column: blank or TRUE publishes; FALSE creates a draft.
 *   Built so far: Type A (assignment), D (graded discussion), CQ (graded Classic quiz
 *   shell; Canvas Link gets its link, which ends in the quiz ID; points come
 *   from questions, so points_possible isn't sent), NQ (New Quiz, through the New Quizzes
 *   API; needs points above 0; the description becomes its instructions; Canvas decides
 *   whether it starts published, so the Published column doesn't apply; the API returns no
 *   link, so Canvas Link is built from the quiz ID, which is also its assignment ID).
 *   No student data is read or written. Logs counts only.
 * Canvas endpoints called: none directly.
 * Canvas write operations (via canvasWrite_, so DRY_RUN applies):
 *   POST /api/v1/courses/:course/assignments (Type A)
 *   POST /api/v1/courses/:course/discussion_topics with an assignment part (Type D)
 *   POST /api/v1/courses/:course/quizzes with quiz_type assignment (Type CQ)
 *   POST /api/quiz/v1/courses/:course/quizzes (Type NQ, New Quizzes API)
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
// Labels the code uses when present, but doesn't require.
const CREATE_BY_ROW_OPTIONAL_LABELS = Object.freeze({
  PUBLISHED: 'Published',
});
const CREATE_BY_ROW_BUILT_TYPES = Object.freeze(['A', 'D', 'CQ', 'NQ']);
const CREATE_BY_ROW_KNOWN_TYPES = Object.freeze(['A', 'D', 'NQ', 'CQ']);
// A blank time cell: Due and Lock mean the end of that day; Unlock means the start of it.
const BLANK_TIME_END_OF_DAY = Object.freeze({ hours: 23, minutes: 59 });
const BLANK_TIME_START_OF_DAY = Object.freeze({ hours: 0, minutes: 0 });
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
    const { columns, missing } = findCreateByRowColumns_(sheet);
    const optional = Object.values(CREATE_BY_ROW_OPTIONAL_LABELS)
      .map(label => `• ${label}: ${columns.has(label) ? 'found' : 'not used (optional)'}`)
      .join('\n');
    ui.alert('Check createByRow labels', (missing.length ?
      `Row ${CREATE_BY_ROW_HEADER_ROW} is missing ${missing.length} label(s):\n• ` +
        missing.join('\n• ') + '\n\nLabels must match exactly, including capitals.' :
      `All ${Object.keys(CREATE_BY_ROW_LABELS).length} labels are in row ` +
        `${CREATE_BY_ROW_HEADER_ROW}.`) + `\n\nOptional:\n${optional}`, ui.ButtonSet.OK);
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
        job.write(plan, CREATE_BY_ROW_LABELS.STATUS, `Preview (${plan.label}): not sent`);
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
          job.write(plan, CREATE_BY_ROW_LABELS.STATUS, `Dry run (${plan.label}): not sent`);
        } else {
          const canvasId = plan.request.readId(result);
          job.write(plan, CREATE_BY_ROW_LABELS.CANVAS_ID, canvasId || '');
          job.write(plan, CREATE_BY_ROW_LABELS.CANVAS_LINK, plan.request.readLink(result) || '');
          job.write(plan, CREATE_BY_ROW_LABELS.STATUS, canvasId ? `Posted (${plan.label})` :
            `Posted (${plan.label}), but Canvas returned no ID; check it in Canvas`);
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

/**
 * Finds each label's column (1-based) in row 3: { columns: Map(label → column), missing }.
 * Optional labels go into columns when present and are never "missing".
 */
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
  Object.values(CREATE_BY_ROW_OPTIONAL_LABELS).forEach(label => {
    const index = header.indexOf(label);
    if (index !== -1) columns.set(label, index + 1);
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
  // A missing optional column reads as blank.
  const pick = (row, label) => (columns.has(label) ?
    row.slice(columns.get(label) - 1, columns.get(label))[0] : '');
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
  const plan = { rowNumber, type: type || '?', label: type || '?' };
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
    const time = (dateLabel, timeLabel, what, blankTime) => buildCanvasTime_(cell(dateLabel),
      text(timeLabel), timeZone, what, blankTime);
    const fields = {
      name,
      points: cell(CREATE_BY_ROW_LABELS.POINTS),
      dueAt: time(CREATE_BY_ROW_LABELS.DUE_DATE, CREATE_BY_ROW_LABELS.DUE_TIME, 'Due',
        BLANK_TIME_END_OF_DAY),
      unlockAt: time(CREATE_BY_ROW_LABELS.UNLOCK_DATE, CREATE_BY_ROW_LABELS.UNLOCK_TIME, 'Unlock',
        BLANK_TIME_START_OF_DAY),
      lockAt: time(CREATE_BY_ROW_LABELS.LOCK_DATE, CREATE_BY_ROW_LABELS.LOCK_TIME, 'Lock',
        BLANK_TIME_END_OF_DAY),
      description: buildDescription_(text(CREATE_BY_ROW_LABELS.DESCRIPTION),
        text(CREATE_BY_ROW_LABELS.DOC_LINK), text(CREATE_BY_ROW_LABELS.LINK_TEXT)),
      published: parsePublished_(cell(CREATE_BY_ROW_OPTIONAL_LABELS.PUBLISHED)),
    };
    // NQ can't be set to draft on create (Canvas decides), so say the column was ignored.
    if (!fields.published) plan.label = type === 'NQ' ? 'NQ, Published ignored' : `${type}, draft`;
    return Object.assign(plan, { request: requestForType_(type, fields, courseId) });
  } catch (error) {
    if (!error.isSheetProblem) throw error;
    return Object.assign(plan, { message: 'Not ready: ' + error.message });
  }
}

/**
 * The request for a built type: { path, payload, readId(result), readLink(result) }.
 * readId picks what goes in CanvasID (always the item's assignment ID); readLink picks
 * what goes in Canvas Link (the web address; for CQ it holds the quiz ID, which
 * makeAssignment's questions read from it with quizIdFromLink_).
 */
function requestForType_(type, fields, courseId) {
  const htmlUrl = result => result.html_url;
  if (type === 'A') {
    return { path: `/courses/${courseId}/assignments`, payload: assignmentPayload_(fields),
      readId: result => result.id, readLink: htmlUrl };
  }
  if (type === 'D') {
    return { path: `/courses/${courseId}/discussion_topics`, payload: discussionPayload_(fields),
      readId: result => result.assignment_id, readLink: htmlUrl };
  }
  if (type === 'CQ') {
    return { path: `/courses/${courseId}/quizzes`, payload: classicQuizPayload_(fields),
      readId: result => result.assignment_id, readLink: htmlUrl };
  }
  if (type === 'NQ') {
    // A New Quiz's ID is its assignment ID; the API returns no web address, so build one.
    return { path: `/api/quiz/v1/courses/${courseId}/quizzes`, payload: newQuizPayload_(fields),
      readId: result => result.id,
      readLink: result => (result.id ?
        `${getCanvasCredentials_().baseUrl}/courses/${courseId}/assignments/${result.id}` : '') };
  }
  throw sheetProblem_(`Type ${type} is not built yet`);
}

/** Blank or TRUE → publish; FALSE → draft (a checkbox works too). */
function parsePublished_(value) {
  if (isBlank_(value) || value === true) return true;
  if (value === false) return false;
  const textValue = String(value).trim().toUpperCase();
  if (textValue === 'TRUE') return true;
  if (textValue === 'FALSE') return false;
  throw sheetProblem_('Published must be TRUE, FALSE, or blank');
}

function pointsFrom_(value) {
  const points = isBlank_(value) ? 0 : Number(value);
  if (isNaN(points)) throw sheetProblem_('points_possible is not a number');
  return points;
}

/** Due/unlock/lock dates for an assignment part, leaving out blank ones. */
function addDates_(target, fields) {
  if (fields.dueAt) target.due_at = fields.dueAt;
  if (fields.unlockAt) target.unlock_at = fields.unlockAt;
  if (fields.lockAt) target.lock_at = fields.lockAt;
  return target;
}

/**
 * The Type A request body (same fields as legacy postSingleAssignment). Submission types
 * default to online_upload; makeAssignment passes its Type of Submission choices.
 */
function assignmentPayload_(fields) {
  return {
    assignment: addDates_({
      name: fields.name,
      points_possible: pointsFrom_(fields.points),
      description: fields.description,
      submission_types: fields.submissionTypes || ['online_upload'],
      published: fields.published !== false,
    }, fields),
  };
}

/**
 * The Type D request body: a graded discussion (legacy postSingleDiscussion). The
 * assignment part carries points and dates. Legacy sent is_posted, which Canvas ignores;
 * published is the documented setting.
 */
function discussionPayload_(fields) {
  return {
    title: fields.name,
    message: fields.description,
    published: fields.published !== false,
    assignment: addDates_({
      grading_type: 'points',
      points_possible: pointsFrom_(fields.points),
    }, fields),
  };
}

/**
 * The Type CQ request body: a graded Classic quiz shell (legacy postSingleClassicQuiz).
 * quiz_type "assignment" is Canvas's documented value for a graded quiz (legacy sent
 * "graded_assignment", which isn't one). No points: Canvas doesn't take points on create;
 * a Classic quiz's points come from its questions. No description, like legacy (the
 * question tool sets the instructions).
 */
function classicQuizPayload_(fields) {
  return {
    quiz: addDates_({
      title: fields.name,
      quiz_type: 'assignment',
      published: fields.published !== false,
    }, fields),
  };
}

/**
 * The Type NQ request body: a New Quiz (legacy postSingleNewQuiz), sent to the New Quizzes
 * API. Points must be above 0 there. The description becomes the instructions (Lara's
 * choice; legacy sent none). No quiz_type (not a New Quizzes setting; legacy sent one) and
 * no published (the API has none; Canvas decides).
 */
function newQuizPayload_(fields) {
  const points = pointsFrom_(fields.points);
  if (points <= 0) throw sheetProblem_('NQ needs points_possible above 0');
  return {
    quiz: addDates_({
      title: fields.name,
      points_possible: points,
      grading_type: 'points',
      instructions: fields.description,
    }, fields),
  };
}

/**
 * A Canvas date-time from a date cell and a time's displayed text, in the Sheet's time
 * zone, e.g. "2026-01-28T14:05:00-10:00". '' when the date is blank. A blank time uses
 * blankTime (11:59 PM unless given; Unlock passes 12:00 AM). Replaces the legacy
 * convertToUTC custom function.
 */
function buildCanvasTime_(dateValue, timeText, timeZone, what,
  blankTime = BLANK_TIME_END_OF_DAY) {
  if (isBlank_(dateValue)) return '';
  if (!(dateValue instanceof Date) || isNaN(dateValue.getTime())) {
    throw sheetProblem_(`${what} Date is not a date`);
  }
  const time = timeText ? parseSheetTime_(timeText) : blankTime;
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
