/**
 * scripts/checks/assignment-column.check.js
 * Purpose: offline check of the grading-sheet one-assignment helpers in
 *   AssignmentColumn.js (Pull scores), using MADE-UP IDs and scores only (never real data;
 *   nothing is sent anywhere). Run with the others: npm run check-offline.
 *   Repo helper only: not part of any Apps Script project; never clasp-pushed.
 * Canvas endpoints called: none. Canvas write operations: none.
 * Required User/Script Properties: none.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PROJECT = path.join(__dirname, '..', '..', 'course-manager-jupiter');
const context = {
  isBlank_: value => value === '' || value === null || value === undefined,
  sheetProblem_: message => Object.assign(new Error(message), { isSheetProblem: true }),
};
vm.createContext(context);
// Same order Google loads them (by file name).
vm.runInContext(['AssignmentColumn.js', 'Config.js', 'Jupiter.js']
  .map(file => fs.readFileSync(path.join(PROJECT, file), 'utf8')).join('\n'), context);
const c = context;

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}` +
    (ok ? '' : `\n      expected ${JSON.stringify(expected)}\n      got      ${JSON.stringify(actual)}`));
}

check('assignment ID row matches the grading sheet label row',
  vm.runInContext('ASSIGNMENT_ID_ROW', context), vm.runInContext('ROSTER_HEADER_ROW', context));

// ---- Pull scores: which cells get written ----
// From row 3: four students (one as a number like Sheets returns), a blank row, an
// Average row, and a student Canvas doesn't list.
const userIds = [['101'], [102], ['103'], ['104'], [''], ['Average'], ['105']];
const current = [[''], [7], ['old'], [''], [''], ['=AVERAGE(G3:G6)'], ['']];
const scores = new Map([['101', 9], ['102', 0], ['103', ''], ['104', 'complete']]);
const plan = c.planScorePull_(userIds, current, scores, 3);
check('only student rows written; blank and Average rows left alone',
  plan.writes.map(w => w.row), [3, 4, 5, 6, 9]);
check('scores: zero kept, ungraded blank, grade text kept, unlisted blank',
  plan.writes.map(w => w.value), [9, 0, '', 'complete', '']);
check('counts: filled student cells, scored, missing', [plan.filled, plan.scored, plan.missing],
  [2, 3, 1]);
check('an empty column asks nothing',
  c.planScorePull_([['101']], [['']], new Map([['101', 5]]), 3).filled, 0);

check('back-to-back rows written together; a gap starts a new write',
  c.scoreRuns_(plan.writes), [
    { row: 3, values: [[9], [0], [''], ['complete']] },
    { row: 9, values: [['']] },
  ]);
check('nothing to write', c.scoreRuns_([]), []);

// ---- The clicked column ----
function fakeSheet(column, rowTwo) {
  const letters = ' ABCDEFGHIJ';
  return {
    getActiveCell: () => ({ getColumn: () => column }),
    getRange: (row, col) => ({
      getA1Notation: () => letters[col] + row,
      getValue: () => (row === 2 ? rowTwo : ''),
    }),
    getLastRow: () => 12,
  };
}
check('reads the ID from row 2 (number from Sheets)', c.readAssignmentColumn_(fakeSheet(8, 5551.0)),
  { column: 8, letter: 'H', assignmentId: '5551', lastRow: 12 });
let thrown = '';
try { c.readAssignmentColumn_(fakeSheet(6, 5551)); } catch (e) { thrown = e.message; }
check('refuses roster / Jupiter ID columns A–F', /G or later/.test(thrown), true);
thrown = '';
try { c.readAssignmentColumn_(fakeSheet(7, 'Lab 3')); } catch (e) { thrown = e.message; }
check('refuses a row 2 that is not an ID', /Row 2 of column G/.test(thrown), true);

if (failures) {
  console.log(`\n${failures} check(s) failed.`);
  process.exitCode = 1;
}
