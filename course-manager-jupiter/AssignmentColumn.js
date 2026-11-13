/**
 * AssignmentColumn.js
 * Purpose: one-assignment tools for the grading sheet (e.g. Comments), working on the
 *   column you click in. Row 2 of that column holds the Canvas assignment ID; students
 *   start on row 3 with their Canvas User ID in column A (same layout as CreateRoster).
 *   - pullScoresForActiveColumn (menu: Canvas Tools › Grading sheet): reads every
 *     student's score for that assignment into the column. Ported from legacy
 *     syncGradesAndStatusForAssignmentActiveColumn, with one request for the whole class
 *     instead of one per student, and the same score as Update Grades (final score; blank
 *     if excused or not graded). Only rows with a User ID are written, so Average rows and
 *     formulas below the students are never touched. Asks before replacing filled cells.
 *   - postCommentsForActiveColumn (menu: Canvas Tools › Grading sheet): posts each
 *     student's comment in that column to their submission. Each comment cell gets a note
 *     with its result (refused cells turn light red), and the row 1 cell gets a summary
 *     note; notes never change the cells' text or formulas. Ported from legacy
 *     postBatchCommentsForAssignmentActiveColumn (which wrote a Status column instead),
 *     plus: dry run, a confirm pop-up, cells whose note starts with "Commented" are skipped
 *     (no double posts; delete the note to resend), a 5-minute stop, and one run at a
 *     time. Comments only, never grades.
 *   Student names, IDs, scores, and comment text stay in the sheet: never logged or shown
 *   in messages (counts, row numbers, and the assignment's name only).
 * Canvas endpoints called (GET via canvasGet_):
 *   /api/v1/courses/:course/assignments/:assignment
 *   /api/v1/courses/:course/assignments/:assignment/submissions
 * Canvas write operations (via canvasWrite_, so dry run applies):
 *   PUT /api/v1/courses/:course/assignments/:assignment/submissions/:user with only
 *   comment[text_comment] and comment[attempt] (Post comments; the attempt is the
 *   student's latest, so resubmitters see it). Canvas notifies the student per their
 *   settings.
 * Required: User Properties CANVAS_BASE_URL and CANVAS_TOKEN; named range cfg_CourseID;
 *   Script Property DRY_RUN (unset means dry run is ON).
 */

// Row 2 holds the assignment ID (the grading sheet's label row, ROSTER_HEADER_ROW in
// Jupiter.js; a literal here because this file loads before Jupiter.js).
const ASSIGNMENT_ID_ROW = 2;
const COMMENT_SUMMARY_ROW = 1;
const COMMENTED_PREFIX = 'Commented';
const COMMENT_REFUSED_COLOR = '#f4cccc'; // light red
const COMMENT_DRY_RUN_STATUS = 'Preview mode (not sent)';
const COMMENTS_TIME_LIMIT_MS = 5 * 60 * 1000;

/**
 * Menu: Canvas Tools › Grading sheet › Pull scores into this column.
 * Nothing on the sheet changes unless Canvas answers and (if cells are filled) you say Yes.
 */
function pullScoresForActiveColumn() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const title = 'Get scores into this column'; // its menu label (2026-11-12)
  try {
    const sheet = ss.getActiveSheet();
    checkGradingSheet_(sheet);
    const target = readAssignmentColumn_(sheet);
    const courseId = getCourseIdForRefresh_();

    ss.toast('Reading scores from Canvas…', title, -1);
    const assignment = canvasStep_('assignment request', () =>
      canvasGet_(`/courses/${courseId}/assignments/${target.assignmentId}`));
    const submissions = canvasStep_('scores request', () =>
      canvasGet_(`/courses/${courseId}/assignments/${target.assignmentId}/submissions`));
    const scores = new Map((Array.isArray(submissions) ? submissions : [])
      .map(submission => [jupiterId_(submission.user_id), scoreForJupiter_(submission)]));

    const rows = target.lastRow - ROSTER_FIRST_ROW + 1;
    if (rows < 1) throw sheetProblem_('There are no student rows (from row 3) on this sheet.');
    const userIds = sheet.getRange(ROSTER_FIRST_ROW, 1, rows, 1).getValues();
    const current = sheet.getRange(ROSTER_FIRST_ROW, target.column, rows, 1).getValues();
    const plan = planScorePull_(userIds, current, scores, ROSTER_FIRST_ROW);
    if (!plan.writes.length) {
      throw sheetProblem_('No row from 3 down has a Canvas User ID in column A. ' +
        'Run Build class list (CreateRoster) first.');
    }

    const name = String(assignment.name || '').trim() || 'this assignment';
    ss.toast('', title, 1);
    if (plan.filled) {
      const answer = ui.alert(title, `"${name}" (course ${courseId})\n\n${plan.filled} ` +
        `student cell(s) in column ${target.letter} already have something in them. ` +
        'Replace them with the scores from Canvas?', ui.ButtonSet.YES_NO);
      if (answer !== ui.Button.YES) {
        ui.alert(title, 'Nothing was changed.', ui.ButtonSet.OK);
        return;
      }
    }

    scoreRuns_(plan.writes).forEach(run => {
      sheet.getRange(run.row, target.column, run.values.length, 1).setValues(run.values);
    });

    console.log(`Pull scores: ${plan.writes.length} student row(s), ${plan.scored} with a ` +
      `score, ${plan.missing} not in Canvas's list.`);
    ui.alert(title, `"${name}": scores written to column ${target.letter} for ` +
      `${plan.writes.length} student(s); ${plan.scored} have a score (the rest are blank: ` +
      'not graded yet, or excused).' + (plan.missing ? `\n\n${plan.missing} student row(s) ` +
      'have no submission for this assignment in Canvas (for example, dropped or not ' +
      'assigned), so they were left blank.' : ''), ui.ButtonSet.OK);
  } catch (error) {
    reportRefreshFailure_(title, 'The sheet was not changed.', error);
  }
}

/**
 * The clicked column on a grading sheet: { column, letter, assignmentId, lastRow }.
 * Refuses the roster and Jupiter ID columns (A–F) and a row 2 that isn't an ID number.
 */
function readAssignmentColumn_(sheet) {
  const column = sheet.getActiveCell().getColumn();
  const letter = sheet.getRange(1, column).getA1Notation().replace(/\d+/g, '');
  if (column <= ROSTER_JUPITER_ID_COLUMN) {
    throw sheetProblem_('Click a cell in an assignment column first (G or later). ' +
      'Columns A–F hold the roster and Jupiter IDs.');
  }
  const assignmentId = jupiterId_(sheet.getRange(ASSIGNMENT_ID_ROW, column).getValue());
  if (!/^\d+$/.test(assignmentId)) {
    throw sheetProblem_(`Row 2 of column ${letter} should hold the Canvas assignment ID ` +
      '(the number at the end of the assignment\'s Canvas address).');
  }
  return { column, letter, assignmentId, lastRow: sheet.getLastRow() };
}

/**
 * Which cells to write. userIds and current are one-column value grids starting at
 * firstRow; scores maps User ID → score. Rows with no User ID are left alone.
 * Returns { writes: [{ row, value }], filled, scored, missing } where filled counts student
 * cells that already hold something and missing counts students Canvas didn't list.
 */
function planScorePull_(userIds, current, scores, firstRow) {
  const plan = { writes: [], filled: 0, scored: 0, missing: 0 };
  userIds.forEach((cells, i) => {
    const userId = jupiterId_(cells.slice(0, 1)[0]);
    if (!/^\d+$/.test(userId)) return;
    if (!isBlank_(current.slice(i, i + 1)[0].slice(0, 1)[0])) plan.filled++;
    let value = '';
    if (scores.has(userId)) {
      value = scores.get(userId);
      if (value !== '') plan.scored++;
    } else {
      plan.missing++;
    }
    plan.writes.push({ row: firstRow + i, value });
  });
  return plan;
}

/** Groups writes on back-to-back rows: [{ row, values: [[v], …] }], one setValues each. */
function scoreRuns_(writes) {
  const runs = [];
  writes.forEach(write => {
    const last = runs.slice(-1)[0];
    if (last && last.row + last.values.length === write.row) {
      last.values.push([write.value]);
    } else {
      runs.push({ row: write.row, values: [[write.value]] });
    }
  });
  return runs;
}

// ---- Post comments ----

/**
 * Menu: Canvas Tools › Grading sheet › Post comments from this column.
 * Click a cell in the comment column (row 2 = assignment ID). Asks first. Each comment
 * cell's note is written as soon as that row is done, so a stop part-way leaves an
 * accurate record and a rerun posts only the rest.
 */
function postCommentsForActiveColumn() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const title = 'Send comments from this column'; // its menu label (2026-11-12)
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(1000)) {
    ui.alert(title, 'Comments are already being posted. Wait for that run to finish.',
      ui.ButtonSet.OK);
    return;
  }
  try {
    const started = Date.now();
    const sheet = ss.getActiveSheet();
    checkGradingSheet_(sheet);
    const target = readAssignmentColumn_(sheet);
    const courseId = getCourseIdForRefresh_();

    const rows = target.lastRow - ROSTER_FIRST_ROW + 1;
    if (rows < 1) throw sheetProblem_('There are no student rows (from row 3) on this sheet.');
    const commentCells = sheet.getRange(ROSTER_FIRST_ROW, target.column, rows, 1);
    const plan = planComments_(
      sheet.getRange(ROSTER_FIRST_ROW, 1, rows, 1).getValues(),
      commentCells.getDisplayValues(), commentCells.getNotes(), ROSTER_FIRST_ROW);
    if (!plan.posts.length) {
      ui.alert(title, `No comments to post from column ${target.letter}.` +
        (plan.alreadyCommented ? ` ${plan.alreadyCommented} cell(s) already have a ` +
          `"${COMMENTED_PREFIX}" note (delete a cell's note to resend it).` :
          ' Type comments in the rows of students who have a User ID in column A.'),
        ui.ButtonSet.OK);
      return;
    }

    // Also confirms the ID is an assignment in this course before anything is sent.
    const assignment = canvasStep_('assignment request', () =>
      canvasGet_(`/courses/${courseId}/assignments/${target.assignmentId}`));
    // Without an attempt number Canvas files the comment on attempt 1, where a student
    // who resubmitted won't see it; so each comment goes on the latest attempt.
    const attempts = latestAttempts_(canvasStep_('submissions request', () =>
      canvasGet_(`/courses/${courseId}/assignments/${target.assignmentId}/submissions`)));
    const name = String(assignment.name || '').trim() || 'this assignment';
    const dryRun = isDryRun_();
    const answer = ui.alert(dryRun ? `${title} (preview mode)` : title,
      `"${name}" (course ${courseId})\n\n${plan.posts.length} comment(s) from column ` +
      `${target.letter} to post; each cell gets a note with its result.` +
      (plan.alreadyCommented ? `\n${plan.alreadyCommented} cell(s) already commented will ` +
        'be skipped.' : '') + '\n\n' + (dryRun ?
        'Preview mode is ON: nothing will be sent. The notes will say "' + COMMENT_DRY_RUN_STATUS +
          '".' :
        'Preview mode is OFF: these comments WILL be posted, and Canvas will notify the ' +
          'students.') + '\n\nContinue?',
      ui.ButtonSet.YES_NO);
    if (answer !== ui.Button.YES) {
      ui.alert(title, 'Cancelled. Nothing was sent.', ui.ButtonSet.OK);
      return;
    }

    const stamp = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'M/d h:mm a');
    ss.toast(`Posting ${plan.posts.length} comment(s)…`, title, -1);
    const result = sendComments_(plan.posts, post => canvasWrite_('PUT',
      `/courses/${courseId}/assignments/${target.assignmentId}/submissions/${post.userId}`,
      { comment: commentFields_(post.text, attempts.get(post.userId)) }),
    (row, status, refused) => {
      const cell = sheet.getRange(row, target.column).setNote(status);
      // Only this tool's red comes off, so colors you set yourself stay.
      if (refused) cell.setBackground(COMMENT_REFUSED_COLOR);
      else if (String(cell.getBackground()).toLowerCase() === COMMENT_REFUSED_COLOR) {
        cell.setBackground(null);
      }
    },
    { dryRun, stamp, started });
    sheet.getRange(COMMENT_SUMMARY_ROW, target.column)
      .setNote(commentSummary_(stamp, result, plan.alreadyCommented, dryRun));
    ss.toast('', title, 1);

    console.log(`Post comments${dryRun ? ' (preview mode)' : ''}: ${result.sent} sent, ` +
      `${result.refusedRows.length} refused, ${result.notStarted} not started, ` +
      `${plan.alreadyCommented} already commented.`);
    ui.alert(dryRun ? `${title} (preview mode)` : title, (dryRun ?
      `Preview mode: ${result.sent} comment(s) would have been posted. Nothing was sent.` :
      `${result.sent} comment(s) posted to "${name}".`) +
      (result.refusedRows.length ? `\n\nCanvas refused row(s) ${result.refusedRows.join(', ')}` +
        ' (light red; the cell\'s note says why). The other rows still went.' : '') +
      (result.notStarted ? `\n\nStopped near the time limit with ${result.notStarted} ` +
        'comment(s) not sent yet. Run Send comments from this column again to send the ' +
        'rest.' : '') +
      (dryRun ? '\n\nSee Extensions › Apps Script › Executions for the "PREVIEW MODE" lines.' : ''),
    ui.ButtonSet.OK);
  } catch (error) {
    reportRefreshFailure_(title, 'Posting stopped. Cells whose note says "Commented" ' +
      'were sent; running Send comments from this column again sends only the rest.', error);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Which comments to post. userIds, comments, and notes are one-column grids starting at
 * firstRow (notes = the comment cells' notes). A row posts when it has a numeric User
 * ID, a non-blank comment, and a note that doesn't start with "Commented".
 * Returns { posts: [{ row, userId, text }], alreadyCommented }.
 */
function planComments_(userIds, comments, notes, firstRow) {
  const plan = { posts: [], alreadyCommented: 0 };
  userIds.forEach((cells, i) => {
    const userId = jupiterId_(cells.slice(0, 1)[0]);
    const text = String(comments.slice(i, i + 1)[0].slice(0, 1)[0]).trim();
    if (!/^\d+$/.test(userId) || !text) return;
    const note = String(notes.slice(i, i + 1)[0].slice(0, 1)[0]).trim().toLowerCase();
    if (note.startsWith(COMMENTED_PREFIX.toLowerCase())) {
      plan.alreadyCommented++;
      return;
    }
    plan.posts.push({ row: firstRow + i, userId, text });
  });
  return plan;
}

/**
 * User ID → latest attempt number, from the class's submissions list. Students with no
 * attempt yet (not submitted) are left out, so their comment goes without one.
 */
function latestAttempts_(submissions) {
  const attempts = new Map();
  (Array.isArray(submissions) ? submissions : []).forEach(submission => {
    const attempt = Number(submission.attempt);
    if (Number.isInteger(attempt) && attempt > 0) {
      attempts.set(jupiterId_(submission.user_id), attempt);
    }
  });
  return attempts;
}

/** The comment fields to send: the text, plus the attempt to file it on when known. */
function commentFields_(text, attempt) {
  return attempt ? { text_comment: text, attempt } : { text_comment: text };
}

/**
 * Sends each post with send(post) and records each row's result right away with
 * record(row, status, refused). A refusal for one student (e.g. 404) is recorded and the
 * rest still go; errors that would hit every request (token, network, busy) are thrown.
 * Stops starting new posts after the time limit. options: { dryRun, stamp, started, now }.
 * Returns { sent, refusedRows, notStarted }.
 */
function sendComments_(posts, send, record, options) {
  const now = options.now || (() => Date.now());
  const result = { sent: 0, refusedRows: [], notStarted: 0 };
  for (let i = 0; i < posts.length; i++) {
    if (now() - options.started > COMMENTS_TIME_LIMIT_MS) {
      result.notStarted = posts.length - i;
      break;
    }
    const post = posts.slice(i, i + 1)[0];
    try {
      send(post);
      record(post.row, options.dryRun ? COMMENT_DRY_RUN_STATUS :
        `${COMMENTED_PREFIX} ${options.stamp}`, false);
      result.sent++;
    } catch (error) {
      if (!error.canvasType || CANVAS_STOP_ALL_TYPES.includes(error.canvasType)) throw error;
      record(post.row, commentRefusedStatus_(error.canvasType), true);
      result.refusedRows.push(post.row);
    }
  }
  return result;
}

/** The row 1 summary note, e.g. "10/23 8:15 AM: 15 posted, 0 refused, 3 already commented". */
function commentSummary_(stamp, result, alreadyCommented, dryRun) {
  return `${stamp}: ` + (dryRun ? `preview mode, ${result.sent} not sent` :
    `${result.sent} posted`) + `, ${result.refusedRows.length} refused, ` +
    `${alreadyCommented} already commented` +
    (result.notStarted ? `, ${result.notStarted} not started (time limit)` : '');
}

/** Short note text for a refused comment, from the error type only. */
function commentRefusedStatus_(type) {
  if (type === 'NOT_FOUND') return 'Not sent: not found (404)';
  if (type === 'NOT_ALLOWED') return 'Not sent: not allowed (403)';
  const code = String(type).match(/^HTTP_(\d+)$/);
  return code ? `Not sent: Canvas error (HTTP ${code[1]})` : 'Not sent: Canvas error';
}
