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
 *   Student names, IDs, and scores stay in the sheet: never logged or shown in messages
 *   (counts and the assignment's name only).
 * Canvas endpoints called (all GET, via canvasGet_):
 *   /api/v1/courses/:course/assignments/:assignment
 *   /api/v1/courses/:course/assignments/:assignment/submissions
 * Canvas write operations: none.
 * Required: User Properties CANVAS_BASE_URL and CANVAS_TOKEN; named range cfg_CourseID.
 */

// Row 2 holds the assignment ID (the grading sheet's label row, ROSTER_HEADER_ROW in
// Jupiter.js; a literal here because this file loads before Jupiter.js).
const ASSIGNMENT_ID_ROW = 2;

/**
 * Menu: Canvas Tools › Grading sheet › Pull scores into this column.
 * Nothing on the sheet changes unless Canvas answers and (if cells are filled) you say Yes.
 */
function pullScoresForActiveColumn() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const title = 'Pull scores';
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
        'Run CreateRoster first.');
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
