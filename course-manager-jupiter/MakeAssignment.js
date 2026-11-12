/**
 * MakeAssignment.js
 * Purpose: the makeAssignment tabs: create one Canvas item plus its section overrides.
 *   Lara keeps several copies of the tab with different names, so every function works
 *   on the tab being viewed, never a tab name. The tab is recognized by its mini-tables,
 *   each found by its first label (MAKE_ASSIGNMENT_TABLES), so tables can sit anywhere
 *   and repeat labels like "Due Date". Columns within a table are found by label.
 *   - Item: two label rows read as one table ("canvasID" row and "Canvas URL" row); each
 *     row's values are in the row just below it.
 *   - Overrides ("OverrideID" row): one override per row below it, ending above the next
 *     table's labels or above a row whose OverrideID cell holds words (a section title).
 *   - Questions ("Question Type" row; optional, quiz copies only): one question per row
 *     below it, to the last row used; Classic (CQ) or New Quiz (NQ) (QuizQuestions.js).
 *   Labels are every non-blank cell from the first label to the right edge of that row
 *   (blank cells, e.g. a merged label's extra cells, are skipped), so don't put another
 *   table beside one; labels the code doesn't use (e.g. Schedule) are ignored.
 *   - checkMakeAssignmentLabels: checks the labels of the tab being viewed.
 *   - previewAssignment: fills Payload and Status for the item and each override row with
 *     what would be sent; never sends anything. The item is planned like a createByRow
 *     row (same request builders; Type of Submission sets submission_types for Type A).
 *     An item with a canvasID isn't created again; only overrides without an OverrideID
 *     are planned. An override row needs a numeric Section ID and a Due Date; blank rows
 *     are skipped. Blank times: Due and Lock 11:59 PM, Unlock 12:00 AM.
 *   - makeAssignmentAll (makeAll button; legacy name): asks first, then creates the item
 *     and each ready override, then (Type CQ or NQ) each ready question, writing
 *     canvasID, Canvas URL, OverrideID, QuestionID, and Status. If the item isn't created,
 *     nothing else is sent. A CQ's Instructions go in the request that creates it. Stops
 *     cleanly near the time limit. Only creates; never changes or deletes anything.
 *   - createDropdowns1 (Get Times button; legacy name): Due Time dropdowns on every
 *     override row (Period Start/End for that row's Period and Due Date from
 *     ref_simpleSchedule, plus the four cfg_Time… choices). Typed times still allowed.
 *   - clearCreationIDs (Clear IDs button; legacy name): clears canvasID, Canvas URL,
 *     OverrideIDs, QuestionIDs, and every Status and Payload cell; keeps
 *     everything else. Asks first if any ID is filled in. Sheet only; Canvas unchanged.
 *   No student data is read or written. Logs counts only.
 * Canvas endpoints called: none directly.
 * Canvas write operations (via canvasWrite_, so DRY_RUN applies):
 *   POST the item: same requests as createByRow (A, D, CQ, NQ; see PostRows.js)
 *   POST /api/v1/courses/:course/assignments/:assignment_id/overrides (one per section)
 *   POST /api/v1/courses/:course/quizzes/:quiz/questions (CQ; one per question)
 *   POST /api/quiz/v1/courses/:course/quizzes/:assignment_id/items (NQ; one per question)
 * Required User/Script Properties: User Properties CANVAS_BASE_URL and CANVAS_TOKEN;
 *   Script Property DRY_RUN. Named ranges: cfg_CourseID (cfg_CourseName for messages);
 *   cfg_TimeSchoolStart, cfg_TimeSchoolEnd, cfg_TimeAfterSchool, cfg_TimeNight (Get Times).
 *   Reads ref_simpleSchedule (Get Times).
 */

const MAKE_ASSIGNMENT_TABLES = Object.freeze([
  {
    key: 'item',
    name: 'Item (first row)',
    labels: ['canvasID', 'name', 'points_possible', 'Due Date', 'Due Time', 'Unlock At',
      'Unlock Time', 'Lock At', 'Lock Time'],
  },
  {
    key: 'itemMore',
    name: 'Item (second row)',
    labels: ['Canvas URL', 'Type of Submission', 'Type', 'Published', 'Google Link Text:',
      'Document URL:', 'Instructions:', 'Status', 'Payload'],
  },
  {
    key: 'overrides',
    name: 'Overrides',
    labels: ['OverrideID', 'Section ID', 'Period', 'Due Date', 'Due Time', 'Unlock At',
      'Unlock Time', 'Lock At', 'Lock Time', 'Status', 'Payload'],
  },
  {
    // Optional: only CQ copies of the tab have it (see QuizQuestions.js).
    key: 'questions',
    name: 'Questions',
    optional: true,
    labels: ['Question Type', 'Points', 'Question', 'Answer', 'Opt 1', 'Opt 2', 'Opt 3',
      'Opt 4', 'Opt 5', 'Status', 'Payload', 'QuestionID'],
  },
].map(table => Object.freeze(table)));

// Canvas's allowed submission_types (Type A only; D, CQ, and NQ set their own).
const MAKE_ASSIGNMENT_SUBMISSION_TYPES = Object.freeze(['online_upload', 'online_text_entry',
  'online_url', 'media_recording', 'student_annotation', 'on_paper', 'none',
  'external_tool']);

/**
 * Button / menu: Check (called "Preview" until 2026-11-12, when dry run became "preview
 * mode"). Fills Payload and Status for the item, each override row, and each question row
 * with what makeAll would send. Never sends anything, whatever the preview mode.
 */
function previewAssignment() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  try {
    const job = readMakeAssignment_(ss);
    const { item, overrides, questions } = job.plan;
    if (item.request) {
      job.writeItem('Payload', JSON.stringify(item.request.payload));
      job.writeItem('Status', `Checked (${item.label}): ready, not sent`);
    } else {
      job.writeItem('Status', item.message);
    }
    const previewRows = (plans, write, target) => plans.filter(plan => {
      if (plan.payload) {
        write(plan, 'Payload', JSON.stringify(plan.payload));
        write(plan, 'Status', `Checked: ready, not sent (for ${target})`);
      } else {
        write(plan, 'Status', plan.message);
      }
      return plan.payload;
    }).length;
    const overridesReady = previewRows(overrides, job.writeOverride, item.canvasId || 'new item');
    const questionsReady = previewRows(questions, job.writeQuestion,
      item.quizId ? `quiz ${item.quizId}` : 'new quiz');
    console.log(`Check assignment: item ${item.request ? 'ready' : 'not ready'}, ` +
      `${overridesReady} of ${overrides.length} override(s) and ${questionsReady} of ` +
      `${questions.length} question(s) ready.`);
    ss.toast(`Item: ${item.request ? 'ready' : 'see Status'}. Overrides: ${overridesReady} ` +
      `ready of ${overrides.length}.` + (questions.length ? ` Questions: ${questionsReady} ` +
      `ready of ${questions.length}.` : '') + ' Nothing was sent.', 'Check assignment', 8);
  } catch (error) {
    reportRefreshFailure_('Check assignment', 'Nothing was sent.', error);
  }
}

/**
 * Button / menu: makeAll (legacy name kept, so the button works). Asks first (showing the
 * course, counts, and the dry-run state), then creates the item (unless it already has a
 * canvasID), each ready override, and (CQ or NQ) each ready question through canvasWrite_,
 * writing IDs and Status.
 */
function makeAssignmentAll() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  try {
    const started = Date.now();
    const job = readMakeAssignment_(ss);
    const { item, overrides, questions } = job.plan;
    const readyOverrides = overrides.filter(plan => plan.payload);
    const readyQuestions = questions.filter(plan => plan.payload);
    overrides.filter(plan => !plan.payload)
      .forEach(plan => job.writeOverride(plan, 'Status', plan.message));
    questions.filter(plan => !plan.payload)
      .forEach(plan => job.writeQuestion(plan, 'Status', plan.message));
    if (!item.request && !item.canvasId) {
      job.writeItem('Status', item.message);
      ui.alert('makeAll', `The item isn't ready, so nothing was sent.\n\n${item.message}`,
        ui.ButtonSet.OK);
      return;
    }
    if (item.canvasId && !readyOverrides.length && !readyQuestions.length) {
      ui.alert('makeAll', 'Nothing to send: the item already has a canvasID and no override ' +
        'or question row is ready (see Status).', ui.ButtonSet.OK);
      return;
    }

    const dryRun = isDryRun_();
    const skipped = overrides.length - readyOverrides.length +
      questions.length - readyQuestions.length;
    const parts = [`${readyOverrides.length} override(s)`]
      .concat(readyQuestions.length ? [`${readyQuestions.length} question(s)`] : []);
    const answer = ui.alert('makeAll',
      (item.request ? `Create 1 item (${item.label}), ` : 'The item already exists. Create ') +
      `${parts.join(' and ')} in ${courseLabel_()}?` +
      (skipped ? `\n${skipped} row(s) will be skipped (see Status).` : '') +
      '\n\n' + (dryRun ? 'Preview mode is ON: nothing will be sent.' :
        'Preview mode is OFF: this creates them in Canvas.'), ui.ButtonSet.YES_NO);
    if (answer !== ui.Button.YES) return;

    const result = runMakeAssignment_(job, canvasWrite_, started);
    console.log(`makeAll${dryRun ? ' (preview mode)' : ''}: item ${result.itemOutcome}, ` +
      `${result.created} override(s) sent, ${result.failed} refused, ` +
      `${result.questionsCreated} question(s) sent, ${result.questionsFailed} refused` +
      (result.timedOut ? ', stopped at time limit.' : '.'));
    ui.alert('makeAll', describeMakeAllResult_(result, dryRun, skipped), ui.ButtonSet.OK);
  } catch (error) {
    reportRefreshFailure_('makeAll', 'Anything already created has its ID filled in; see ' +
      'the Status cells.', error);
  }
}

/**
 * Sends the item (if new), then each ready override, then each ready question, with send
 * (canvasWrite_), writing results as it goes. Overrides and questions wait for the item:
 * if it isn't created, none are sent. Stops cleanly near the time limit (rows not sent
 * say so; clicking makeAll again continues, since sent rows have IDs). Returns
 * { itemOutcome: 'existing' | 'dry run' | 'created' | 'no ID' | 'refused', created,
 * failed, questionsCreated, questionsFailed, timedOut, itemMessage? }. Errors that would
 * hit every request are thrown.
 */
function runMakeAssignment_(job, send, started = Date.now()) {
  const { item, overrides, questions } = job.plan;
  const result = { itemOutcome: 'existing', created: 0, failed: 0, questionsCreated: 0,
    questionsFailed: 0, timedOut: false };
  let assignmentId = item.canvasId;
  let quizId = item.quizId;
  let dryRun = false;

  if (item.request) {
    job.writeItem('Payload', JSON.stringify(item.request.payload));
    try {
      const reply = send('POST', item.request.path, item.request.payload);
      if (reply.dryRun) {
        dryRun = true;
        result.itemOutcome = 'dry run';
        job.writeItem('Status', `Preview mode (${item.label}): not sent`);
      } else {
        assignmentId = item.request.readId(reply);
        const link = item.request.readLink(reply) || '';
        if (item.type === 'CQ') quizId = String(reply.id || quizIdFromLink_(link));
        if (item.type === 'NQ') quizId = assignmentId;
        job.writeItem('canvasID', assignmentId || '');
        job.writeItem('Canvas URL', link);
        result.itemOutcome = assignmentId ? 'created' : 'no ID';
        job.writeItem('Status', assignmentId ? `Created (${item.label})` :
          `Created (${item.label}), but Canvas returned no ID; check it in Canvas`);
      }
    } catch (error) {
      if (!error.canvasType || CANVAS_STOP_ALL_TYPES.includes(error.canvasType)) {
        job.writeItem('Status', 'Stopped: ' + describeCanvasError_(error));
        throw error;
      }
      result.itemOutcome = 'refused';
      result.itemMessage = error.message;
      job.writeItem('Status', 'Not created: ' + error.message);
    }
  }

  const readyOverrides = overrides.filter(plan => plan.payload);
  const readyQuestions = questions.filter(plan => plan.payload);
  if (!dryRun && !assignmentId) {
    readyOverrides.forEach(plan =>
      job.writeOverride(plan, 'Status', 'Not sent: the item was not created'));
    readyQuestions.forEach(plan =>
      job.writeQuestion(plan, 'Status', 'Not sent: the item was not created'));
    return result;
  }

  // One row at a time: write Payload, send, write the ID and Status.
  const sendRow = (plan, path, write, idLabel, onCreated, onFailed) => {
    if (result.timedOut || Date.now() - started > CREATE_BY_ROW_TIME_LIMIT_MS) {
      result.timedOut = true;
      write(plan, 'Status', 'Not sent: stopped near the time limit; click makeAll again');
      return;
    }
    write(plan, 'Payload', JSON.stringify(plan.payload));
    try {
      const reply = send('POST', path, plan.payload);
      if (reply.dryRun) {
        write(plan, 'Status', 'Preview mode: not sent');
      } else {
        write(plan, idLabel, reply.id || '');
        write(plan, 'Status', reply.id ? 'Created' :
          'Created, but Canvas returned no ID; check it in Canvas');
      }
      onCreated();
    } catch (error) {
      if (!error.canvasType || CANVAS_STOP_ALL_TYPES.includes(error.canvasType)) {
        write(plan, 'Status', 'Stopped: ' + describeCanvasError_(error));
        throw error;
      }
      write(plan, 'Status', 'Not created: ' + error.message);
      onFailed();
    }
  };

  // In a dry run the item has no ID yet; canvasWrite_ only logs the path.
  readyOverrides.forEach(plan => sendRow(plan, overridePath_(job.courseId, assignmentId || 'new'),
    job.writeOverride, 'OverrideID', () => result.created++, () => result.failed++));
  if (readyQuestions.length && !dryRun && !quizId) {
    readyQuestions.forEach(plan => job.writeQuestion(plan, 'Status',
      'Not sent: no quiz ID (Canvas URL should be the quiz link)'));
    return result;
  }
  const questionPath = item.type === 'NQ' ? newQuizItemsPath_(job.courseId, quizId || 'new') :
    questionsPath_(job.courseId, quizId || 'new');
  readyQuestions.forEach(plan => sendRow(plan, questionPath, job.writeQuestion, 'QuestionID',
    () => result.questionsCreated++, () => result.questionsFailed++));
  return result;
}

/** The pop-up after makeAll. */
function describeMakeAllResult_(result, dryRun, skipped) {
  const timeNote = result.timedOut ?
    '\n\nStopped near the time limit; click makeAll again to send the rest.' : '';
  if (dryRun || result.itemOutcome === 'dry run') {
    return `Preview mode: the item${result.itemOutcome === 'existing' ? ' (already created)' : ''}, ` +
      `${result.created} override(s), and ${result.questionsCreated} question(s) would have ` +
      'been sent. Nothing was sent.' + timeNote;
  }
  const itemLine = {
    existing: 'The item already existed.',
    created: 'Item created.',
    'no ID': 'Item created, but Canvas returned no ID, so no overrides or questions were ' +
      'sent. Check it in Canvas.',
    refused: 'Canvas refused the item, so no overrides or questions were sent (see Status).',
  }[result.itemOutcome];
  return itemLine +
    (result.created ? `\n${result.created} override(s) created.` : '') +
    (result.failed ? `\n${result.failed} override(s) refused by Canvas (see Status).` : '') +
    (result.questionsCreated ? `\n${result.questionsCreated} question(s) added.` : '') +
    (result.questionsFailed ? `\n${result.questionsFailed} question(s) refused by Canvas ` +
      '(see Status).' : '') +
    (skipped ? `\n${skipped} row(s) skipped (see Status).` : '') + timeNote;
}

/**
 * Button / menu: Get Times (legacy name kept). Puts a Due Time dropdown on every override
 * row: that row's Period Start/End on its Due Date (from ref_simpleSchedule), then School
 * Start, School End, After School, Night (from the cfg_Time… ranges). Choices read like
 * "Night (2200)". Typed times are still allowed (Sheets shows a warning only). The Item's
 * Due Time gets no dropdown (Lara's choice). Changes dropdown rules only, never values.
 */
function createDropdowns1() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  try {
    const sheet = ss.getActiveSheet();
    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();
    if (!lastRow || !lastColumn) throw sheetProblem_('This tab is empty.');
    const range = sheet.getRange(1, 1, lastRow, lastColumn);
    const layout = findMakeAssignmentLayout_(range.getDisplayValues()
      .map(row => row.map(value => String(value).trim())));
    if (layout.problemCount) {
      throw sheetProblem_(`This tab's labels have ${layout.problemCount} problem(s). Use ` +
        'Course Manager › Check makeAssignment labels (this tab).');
    }
    const standard = readStandardTimes_();
    const timeZone = ss.getSpreadsheetTimeZone();
    const schedule = readScheduleByDay_(ss, timeZone);
    const { overrides } = layout.tables;
    const column = label => overrides.columns.get(label);
    const values = range.getValues();

    let withPeriod = 0;
    const missing = [];
    for (let row = overrides.firstDataRow; row <= overrides.lastDataRow; row++) {
      const rowValues = values.slice(row - 1, row)[0];
      const period = String(rowValues.slice(column('Period') - 1, column('Period'))[0]).trim();
      const date = rowValues.slice(column('Due Date') - 1, column('Due Date'))[0];
      let times = null;
      if (period && date instanceof Date) {
        times = findPeriodTimes_(schedule, Utilities.formatDate(date, timeZone, 'yyyy-MM-dd'),
          period);
        if (times) withPeriod++;
        else missing.push(row);
      }
      const rule = SpreadsheetApp.newDataValidation()
        .requireValueInList(dueTimeChoices_(times, standard))
        .setAllowInvalid(true)
        .build();
      sheet.getRange(row, column('Due Time')).setDataValidation(rule);
    }

    const rows = overrides.lastDataRow - overrides.firstDataRow + 1;
    console.log(`Get Times: ${rows} row(s), ${withPeriod} with period times, ` +
      `${missing.length} period/date not in the schedule.`);
    ss.toast(`Due Time dropdowns set on ${rows} override row(s); ${withPeriod} include ` +
      'Period Start/End.' + (missing.length ? ` No schedule found for the Period and Due ` +
      `Date in row(s) ${missing.join(', ')} (check ref_simpleSchedule).` : ''), 'Get Times', 8);
  } catch (error) {
    reportRefreshFailure_('Get Times', 'No dropdowns were changed.', error);
  }
}

/**
 * Button / menu: Clear IDs (legacy name kept). Clears the item's canvasID, Canvas URL,
 * Status, and Payload, and each override row's OverrideID, Status, and Payload, so the
 * tab is ready for the next assignment. Everything else (name, dates, the copy's
 * defaults and formulas) stays. Asks first if any ID is filled in. Nothing in Canvas
 * changes.
 */
function clearCreationIDs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  try {
    const sheet = ss.getActiveSheet();
    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();
    if (!lastRow || !lastColumn) throw sheetProblem_('This tab is empty.');
    const shown = sheet.getRange(1, 1, lastRow, lastColumn).getDisplayValues()
      .map(row => row.map(value => String(value).trim()));
    const layout = findMakeAssignmentLayout_(shown);
    if (layout.problemCount) {
      throw sheetProblem_(`This tab's labels have ${layout.problemCount} problem(s). Use ` +
        'Course Manager › Check makeAssignment labels (this tab).');
    }
    const cells = clearCreationCells_(layout);
    const ids = cells.filter(cell => cell.isId &&
      shown.slice(cell.row - 1, cell.row)[0].slice(cell.column - 1, cell.column)[0]).length;
    if (ids) {
      const answer = ui.alert('Clear IDs', `Clear ${ids} Canvas ID(s), plus the Canvas URL, ` +
        'Status, and Payload cells, on this tab?\n\nThis only clears the sheet. Anything ' +
        'already created stays in Canvas.', ui.ButtonSet.YES_NO);
      if (answer !== ui.Button.YES) return;
    }
    cells.forEach(cell => sheet.getRange(cell.row, cell.column).clearContent());
    console.log(`Clear IDs: ${cells.length} cell(s) cleared, ${ids} of them IDs.`);
    ss.toast('IDs, Canvas URL, Status, and Payload cleared. Ready for the next assignment.',
      'Clear IDs', 5);
  } catch (error) {
    reportRefreshFailure_('Clear IDs', 'Nothing was cleared.', error);
  }
}

/**
 * The cells Clear IDs empties: [{ row, column, isId }]. Item: canvasID, Canvas URL,
 * Status, Payload. Each override row: OverrideID, Status, Payload. Each question row (if
 * the tab has a Questions table): QuestionID, Status, Payload.
 */
function clearCreationCells_(layout) {
  const { item, itemMore, overrides, questions } = layout.tables;
  const cells = [
    { row: item.headerRow + 1, column: item.columns.get('canvasID'), isId: true },
  ].concat(['Canvas URL', 'Status', 'Payload'].map(label =>
    ({ row: itemMore.headerRow + 1, column: itemMore.columns.get(label), isId: false })));
  for (let row = overrides.firstDataRow; row <= overrides.lastDataRow; row++) {
    cells.push({ row, column: overrides.columns.get('OverrideID'), isId: true });
    ['Status', 'Payload'].forEach(label =>
      cells.push({ row, column: overrides.columns.get(label), isId: false }));
  }
  for (let row = questions.firstDataRow; questions.headerRow && row <= questions.lastDataRow;
    row++) {
    cells.push({ row, column: questions.columns.get('QuestionID'), isId: true });
    ['Status', 'Payload'].forEach(label =>
      cells.push({ row, column: questions.columns.get(label), isId: false }));
  }
  return cells;
}

/** The four cfg_Time… values as 4-digit 24-hour text, e.g. { schoolStart: '0815', … }. */
function readStandardTimes_() {
  const read = name => {
    let value;
    try {
      value = getCfg_(name);
    } catch (error) {
      throw sheetProblem_(error.message);
    }
    const text = formatTime24_(value);
    if (!text) throw sheetProblem_(`cfg_${name} is not a time like 815 or 2200.`);
    return text;
  };
  return { schoolStart: read('TimeSchoolStart'), schoolEnd: read('TimeSchoolEnd'),
    afterSchool: read('TimeAfterSchool'), night: read('TimeNight') };
}

/**
 * ref_simpleSchedule as a Map from 'yyyy-MM-dd' to that day's period list (column C is
 * the date; column I is JSON like [{"period":"1","start":815,"end":925}, …]). Days whose
 * JSON can't be read are left out.
 */
function readScheduleByDay_(ss, timeZone) {
  const sheet = ss.getSheetByName(SHEETS.SIMPLE_SCHEDULE);
  if (!sheet) throw sheetProblem_(`There is no ${SHEETS.SIMPLE_SCHEDULE} tab.`);
  const byDay = new Map();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return byDay;
  let unreadable = 0;
  sheet.getRange(2, 3, lastRow - 1, 7).getValues().forEach(row => {
    const date = row.slice(0, 1)[0];
    const json = row.slice(6, 7)[0];
    if (!(date instanceof Date) || !json) return;
    try {
      const periods = JSON.parse(json);
      if (Array.isArray(periods)) byDay.set(Utilities.formatDate(date, timeZone, 'yyyy-MM-dd'), periods);
    } catch {
      unreadable++;
    }
  });
  if (unreadable) console.log(`Get Times: ${unreadable} schedule row(s) had unreadable JSON.`);
  return byDay;
}

/** { start: '0815', end: '0925' } for one period on one day, or null if not found. */
function findPeriodTimes_(schedule, dayKey, period) {
  const periods = schedule.get(dayKey);
  if (!periods) return null;
  const match = periods.find(entry => entry && String(entry.period).trim() === String(period).trim());
  if (!match) return null;
  const start = formatTime24_(match.start);
  const end = formatTime24_(match.end);
  return start && end ? { start, end } : null;
}

/** The dropdown choices for one row, period times first (legacy order and wording). */
function dueTimeChoices_(periodTimes, standard) {
  const choices = periodTimes ?
    [`Period Start (${periodTimes.start})`, `Period End (${periodTimes.end})`] : [];
  return choices.concat([`School Start (${standard.schoolStart})`,
    `School End (${standard.schoolEnd})`, `After School (${standard.afterSchool})`,
    `Night (${standard.night})`]);
}

/**
 * 815, "815", "0815", or a time-formatted cell → "0815" (the legacy 09 formatTime, padded
 * to 4 digits so parseSheetTime_ reads it). '' if it isn't a valid time.
 */
function formatTime24_(value) {
  let digits;
  if (value instanceof Date) {
    digits = Utilities.formatDate(value, SpreadsheetApp.getActiveSpreadsheet()
      .getSpreadsheetTimeZone(), 'HHmm');
  } else {
    digits = String(value === null || value === undefined ? '' : value).trim();
    if (!/^\d{3,4}$/.test(digits)) return '';
    digits = digits.padStart(4, '0');
  }
  return parseSheetTime_(digits) ? digits : '';
}

/**
 * Reads the tab being viewed and plans the item, its overrides, and its questions:
 * { plan: { item, overrides, questions }, courseId, writeItem(label, value),
 * writeOverride(plan, label, value), writeQuestion(plan, label, value) }.
 */
function readMakeAssignment_(ss) {
  const sheet = ss.getActiveSheet();
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (!lastRow || !lastColumn) throw sheetProblem_('This tab is empty.');
  const range = sheet.getRange(1, 1, lastRow, lastColumn);
  const values = range.getValues();
  const shown = range.getDisplayValues().map(row => row.map(value => String(value).trim()));
  const layout = findMakeAssignmentLayout_(shown);
  if (layout.problemCount) {
    throw sheetProblem_(`This tab's labels have ${layout.problemCount} problem(s). Use ` +
      'Course Manager › Check makeAssignment labels (this tab).');
  }
  const courseId = getCourseIdForRefresh_();
  const plan = planMakeAssignment_(layout, values, shown, courseId,
    ss.getSpreadsheetTimeZone());
  const { item, itemMore, overrides, questions } = layout.tables;
  return {
    plan,
    courseId,
    // canvasID is in the first item row; Canvas URL, Status, Payload in the second.
    writeItem: (label, value) => {
      const table = item.columns.has(label) ? item : itemMore;
      sheet.getRange(table.headerRow + 1, table.columns.get(label)).setValue(value);
    },
    writeOverride: (overridePlan, label, value) => sheet.getRange(overridePlan.rowNumber,
      overrides.columns.get(label)).setValue(value),
    writeQuestion: (questionPlan, label, value) => sheet.getRange(questionPlan.rowNumber,
      questions.columns.get(label)).setValue(value),
  };
}

/**
 * Plans the item, every override row, and every question row from the tab's values
 * (cells) and displayed text (shown), both full-tab grids. Returns
 * { item, overrides, questions }:
 * - item: { type, label, request? (createByRow's request for its type), canvasId? and
 *   quizId? (when already created; quizId for CQ, from Canvas URL), message? }.
 * - overrides: [{ rowNumber, sectionId, payload?, message? }], blank rows left out.
 *   Each override is sent to overridePath_(courseId, the item's canvasID).
 * - questions: [{ rowNumber, payload?, message? }], rows with no Question left out;
 *   only sent for Type CQ (questionsPath_) or NQ (newQuizItemsPath_).
 */
function planMakeAssignment_(layout, values, shown, courseId, timeZone) {
  const { item, itemMore, overrides, questions } = layout.tables;
  const at = (grid, row, column) => grid.slice(row - 1, row)[0].slice(column - 1, column)[0];
  const itemTable = label => (item.columns.has(label) ? item : itemMore);
  const itemCell = label => {
    const table = itemTable(label);
    return at(values, table.headerRow + 1, table.columns.get(label));
  };
  const itemText = label => {
    const table = itemTable(label);
    return at(shown, table.headerRow + 1, table.columns.get(label));
  };

  const overridePlans = [];
  const seenSections = new Map();
  for (let row = overrides.firstDataRow; row <= overrides.lastDataRow; row++) {
    const cell = label => at(values, row, overrides.columns.get(label));
    const text = label => at(shown, row, overrides.columns.get(label));
    const plan = planOverride_(row, cell, text, timeZone, seenSections);
    if (plan) overridePlans.push(plan);
  }
  const itemPlan = planMakeAssignmentItem_(itemCell, itemText, courseId, timeZone);

  const questionPlans = [];
  for (let row = questions.firstDataRow; questions.headerRow && row <= questions.lastDataRow;
    row++) {
    const cell = label => at(values, row, questions.columns.get(label));
    const text = label => at(shown, row, questions.columns.get(label));
    const plan = planQuestion_(row, cell, text, itemPlan.type);
    if (!plan) continue;
    if (plan.payload && itemPlan.type !== 'CQ' && itemPlan.type !== 'NQ') {
      delete plan.payload;
      plan.message = 'Not sent: questions are only for Type CQ or NQ';
    } else if (plan.payload && itemPlan.canvasId && !itemPlan.quizId) {
      delete plan.payload;
      plan.message = 'Not ready: no quiz ID (Canvas URL should be the quiz link)';
    }
    questionPlans.push(plan);
  }
  return { item: itemPlan, overrides: overridePlans, questions: questionPlans };
}

/** Plans the item, the same way as a createByRow row, plus Type of Submission for A. */
function planMakeAssignmentItem_(cell, text, courseId, timeZone) {
  const name = text('name');
  const type = text('Type').toUpperCase();
  const plan = { type: type || '?', label: type || '?' };
  const canvasId = text('canvasID');
  if (canvasId) {
    // A New Quiz's ID is its canvasID; a Classic quiz's is in its link.
    return Object.assign(plan, { canvasId,
      quizId: type === 'NQ' ? canvasId : quizIdFromLink_(text('Canvas URL')),
      message: 'Already created; only rows without an ID will be made' });
  }
  if (!name) return Object.assign(plan, { message: 'Not ready: no name' });
  if (!CREATE_BY_ROW_KNOWN_TYPES.includes(type)) {
    return Object.assign(plan, { message: type ?
      `Not ready: Type "${type}" is not A, D, NQ, or CQ` : 'Not ready: no Type' });
  }
  try {
    const time = (dateLabel, timeLabel, what, blankTime) => buildCanvasTime_(cell(dateLabel),
      text(timeLabel), timeZone, what, blankTime);
    const fields = {
      name,
      points: cell('points_possible'),
      dueAt: time('Due Date', 'Due Time', 'Due', BLANK_TIME_END_OF_DAY),
      unlockAt: time('Unlock At', 'Unlock Time', 'Unlock', BLANK_TIME_START_OF_DAY),
      lockAt: time('Lock At', 'Lock Time', 'Lock', BLANK_TIME_END_OF_DAY),
      description: buildDescription_(text('Instructions:'), text('Document URL:'),
        text('Google Link Text:')),
      published: parsePublished_(cell('Published')),
    };
    if (type === 'A') fields.submissionTypes = parseSubmissionTypes_(text('Type of Submission'));
    plan.label = publishLabel_(type, fields.published) || plan.label;
    const request = requestForType_(type, fields, courseId);
    // CQ: the instructions go in the create request (legacy sent a second update).
    if (type === 'CQ') request.payload.quiz.description = fields.description;
    return Object.assign(plan, { request });
  } catch (error) {
    if (!error.isSheetProblem) throw error;
    return Object.assign(plan, { message: 'Not ready: ' + error.message });
  }
}

/**
 * "online_upload, online_text_entry" (a multi-choice dropdown's text) → a list; blank →
 * undefined, so the assignment builder uses its default (online_upload).
 */
function parseSubmissionTypes_(textValue) {
  const chosen = String(textValue).split(',').map(part => part.trim()).filter(Boolean);
  if (!chosen.length) return undefined;
  const unknown = chosen.filter(choice => !MAKE_ASSIGNMENT_SUBMISSION_TYPES.includes(choice));
  if (unknown.length) {
    throw sheetProblem_(`Type of Submission "${unknown.join(', ')}" is not a Canvas ` +
      'submission type');
  }
  return chosen;
}

/**
 * Plans one override row. Returns null for a blank row (no Section ID and no Due Date),
 * { payload } when ready, or { message } when not. seenSections catches a section used
 * twice (Canvas allows one override per section).
 */
function planOverride_(rowNumber, cell, text, timeZone, seenSections) {
  const sectionId = text('Section ID');
  const dueDate = cell('Due Date');
  if (!sectionId && isBlank_(dueDate)) return null;
  const plan = { rowNumber, sectionId };
  if (text('OverrideID')) return Object.assign(plan, { message: 'Skipped: already has an OverrideID' });
  if (!/^\d+$/.test(sectionId)) {
    return Object.assign(plan, { message: sectionId ?
      'Not ready: Section ID must be a number' : 'Not ready: no Section ID' });
  }
  if (seenSections.has(sectionId)) {
    return Object.assign(plan, {
      message: `Not ready: same Section ID as row ${seenSections.get(sectionId)}` });
  }
  seenSections.set(sectionId, rowNumber);
  if (isBlank_(dueDate)) return Object.assign(plan, { message: 'Not ready: no Due Date' });
  try {
    const time = (dateLabel, timeLabel, what, blankTime) => buildCanvasTime_(cell(dateLabel),
      text(timeLabel), timeZone, what, blankTime);
    const dates = {
      dueAt: time('Due Date', 'Due Time', 'Due', BLANK_TIME_END_OF_DAY),
      unlockAt: time('Unlock At', 'Unlock Time', 'Unlock', BLANK_TIME_START_OF_DAY),
      lockAt: time('Lock At', 'Lock Time', 'Lock', BLANK_TIME_END_OF_DAY),
    };
    return Object.assign(plan, {
      payload: { assignment_override: addDates_({ course_section_id: Number(sectionId) }, dates) },
    });
  } catch (error) {
    if (!error.isSheetProblem) throw error;
    return Object.assign(plan, { message: 'Not ready: ' + error.message });
  }
}

/** Where an override is sent: the item's assignment (for D, CQ, NQ too: their assignment ID). */
function overridePath_(courseId, assignmentId) {
  return `/courses/${courseId}/assignments/${assignmentId}/overrides`;
}

/** Button / menu: checks the labels of the makeAssignment tab being viewed. */
function checkMakeAssignmentLabels() {
  const ui = SpreadsheetApp.getUi();
  try {
    const sheet = SpreadsheetApp.getActiveSheet();
    const layout = findMakeAssignmentLayout_(readLabelGrid_(sheet));
    console.log(`Check makeAssignment labels: ${layout.problemCount} problem(s).`);
    ui.alert('Check makeAssignment labels', `Tab: ${sheet.getName()}\n\n` +
      describeMakeAssignmentLayout_(layout), ui.ButtonSet.OK);
  } catch (error) {
    reportRefreshFailure_('Check makeAssignment labels', 'Nothing was changed.', error);
  }
}

/** The displayed text of every used cell on the tab, as a grid of trimmed strings. */
function readLabelGrid_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (!lastRow || !lastColumn) return [];
  return sheet.getRange(1, 1, lastRow, lastColumn).getDisplayValues()
    .map(row => row.map(value => String(value).trim()));
}

/**
 * Finds each table in the grid. Returns { tables: { key → table }, problemCount }, where
 * each table is { name, firstLabel, headerRow, columns: Map(label → column), missing,
 * duplicates, ignored, problems } (rows and columns 1-based; headerRow 0 if not found).
 * Overrides also get firstDataRow and lastDataRow.
 */
function findMakeAssignmentLayout_(grid) {
  const tables = {};
  let problemCount = 0;
  MAKE_ASSIGNMENT_TABLES.forEach(spec => {
    const table = findLabelRow_(grid, spec);
    problemCount += table.problems.length;
    tables[spec.key] = table;
  });

  // Overrides end at the row above the next table's labels, or above a row whose
  // OverrideID cell holds words (e.g. a "Questions" title), whichever comes first.
  const overrides = tables.overrides;
  if (overrides.headerRow) {
    overrides.firstDataRow = overrides.headerRow + 1;
    const below = Object.values(tables).map(table => table.headerRow)
      .filter(row => row > overrides.headerRow);
    let last = below.length ? Math.min(...below) - 1 : grid.length;
    const idColumn = overrides.columns.get('OverrideID');
    for (let row = overrides.firstDataRow; idColumn && row <= last; row++) {
      const idText = grid.slice(row - 1, row)[0].slice(idColumn - 1, idColumn)[0];
      if (idText && !/^\d+$/.test(idText)) last = row - 1;
    }
    overrides.lastDataRow = last;
    if (overrides.lastDataRow < overrides.firstDataRow) {
      overrides.problems.push('there are no rows below the Overrides labels.');
      problemCount++;
    }
  }
  // Questions run from below their labels to the last row used.
  const questions = tables.questions;
  if (questions.headerRow) {
    questions.firstDataRow = questions.headerRow + 1;
    questions.lastDataRow = grid.length;
  }
  [tables.item, tables.itemMore].forEach(table => {
    if (table.headerRow && table.headerRow >= grid.length) {
      table.problems.push(`there is no row below row ${table.headerRow} for its values.`);
      problemCount++;
    }
  });
  return { tables, problemCount };
}

/** Finds one table's label row by its first label and checks its labels. */
function findLabelRow_(grid, spec) {
  const firstLabel = spec.labels[0];
  const table = { name: spec.name, firstLabel, headerRow: 0, columns: new Map(),
    missing: [], duplicates: [], ignored: [], problems: [] };

  const hits = [];
  grid.forEach((row, r) => row.forEach((value, c) => {
    if (value === firstLabel) hits.push({ row: r, column: c });
  }));
  if (!hits.length) {
    if (!spec.optional) table.problems.push(`no cell says "${firstLabel}".`);
    return table;
  }
  if (hits.length > 1) {
    table.problems.push(`"${firstLabel}" appears ${hits.length} times ` +
      `(${hits.map(hit => cellName_(hit.row + 1, hit.column + 1)).join(', ')}); ` +
      'it must appear once.');
    return table;
  }

  const { row, column } = hits[0];
  table.headerRow = row + 1;
  const labelRow = grid.slice(row, row + 1)[0];
  const seen = new Set();
  for (let c = column; c < labelRow.length; c++) {
    const label = labelRow.slice(c, c + 1)[0];
    if (!label) continue; // e.g. the extra cells of a merged "Instructions:" label
    if (seen.has(label)) {
      if (!table.duplicates.includes(label)) table.duplicates.push(label);
      continue;
    }
    seen.add(label);
    if (spec.labels.includes(label)) table.columns.set(label, c + 1);
    else table.ignored.push(label);
  }
  table.missing = spec.labels.filter(label => !table.columns.has(label));
  if (table.missing.length) {
    table.problems.push(`missing ${table.missing.map(label => `"${label}"`).join(', ')}.`);
  }
  if (table.duplicates.length) {
    table.problems.push(`appears twice: ${table.duplicates.map(l => `"${l}"`).join(', ')}.`);
  }
  return table;
}

/** A plain-language summary of the layout for the alert. */
function describeMakeAssignmentLayout_(layout) {
  const lines = MAKE_ASSIGNMENT_TABLES.map(spec => {
    const table = layout.tables[spec.key];
    if (spec.optional && !table.headerRow && !table.problems.length) {
      return `– ${table.name}: not on this tab (optional; add a "${table.firstLabel}" table ` +
        'for Classic quiz questions).';
    }
    if (table.problems.length && !table.headerRow) {
      return `✗ ${table.name}: ${table.problems.join(' ')}`;
    }
    let line = `${table.problems.length ? '✗' : '✓'} ${table.name}: labels in row ` +
      `${table.headerRow}`;
    if (table.problems.length) line += `; ${table.problems.join(' ')}`;
    else line += `, all ${spec.labels.length} found.`;
    if (table.firstDataRow && table.lastDataRow >= table.firstDataRow) {
      line += `\n   ${spec.key === 'questions' ? 'Question' : 'Override'} rows: ` +
        `${table.firstDataRow}–${table.lastDataRow}.`;
    }
    if (table.ignored.length) line += `\n   Not used by the code: ${table.ignored.join(', ')}.`;
    return line;
  });
  return lines.join('\n\n') + (layout.problemCount ?
    '\n\nLabels must match exactly, including capitals and colons.' :
    '\n\nThis tab is ready for makeAssignment.');
}

/** "C12" from a 1-based row and column. */
function cellName_(row, column) {
  let letters = '';
  for (let n = column; n > 0; n = Math.floor((n - 1) / 26)) {
    letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
  }
  return letters + row;
}
