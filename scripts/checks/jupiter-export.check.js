/**
 * scripts/checks/jupiter-export.check.js
 * Purpose: offline check of the CreateRoster and Update Grades helpers in Jupiter.js,
 *   using MADE-UP students, IDs, and scores only (never real data; nothing is sent
 *   anywhere). Run with the others: npm run check-offline.
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
vm.runInContext(fs.readFileSync(path.join(PROJECT, 'Config.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(PROJECT, 'Jupiter.js'), 'utf8'), context);
const c = context;

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}` +
    (ok ? '' : `\n      expected ${JSON.stringify(expected)}\n      got      ${JSON.stringify(actual)}`));
}

// ---- CreateRoster ----
const people = [
  { 'Section ID': 11, 'User ID': 103, 'Sorted Name': 'Student, Charlie', Role: 'StudentEnrollment', Email: 'c@example.test' },
  { 'Section ID': 11, 'User ID': 900, 'Sorted Name': 'Teacher, Pat', Role: 'TeacherEnrollment', Email: 't@example.test' },
  { 'Section ID': 12, 'User ID': 101, 'Sorted Name': 'Student, Alpha', Role: 'StudentEnrollment', Email: 'a@example.test' },
  { 'Section ID': 11, 'User ID': 101, 'Sorted Name': 'Student, Alpha', Role: 'StudentEnrollment', Email: 'a@example.test' },
  { 'Section ID': 99, 'User ID': 102, 'Sorted Name': 'Student, Bravo', Role: 'StudentEnrollment', Email: 'b@example.test' },
];
const sections = [
  { 'Section ID': 11, 'Section Name': 'Made-up (P3)', Period: '3' },
  { 'Section ID': 12, 'Section Name': 'Made-up (P4)', Period: '4' },
];
check('roster: students only, once each, sorted, section looked up',
  c.buildRosterRows_(people, sections), [
    ['101', 'Student, Alpha', '4', 'Made-up (P4)', 'a@example.test'],
    ['102', 'Student, Bravo', 'N/A', 'N/A', 'b@example.test'],
    ['103', 'Student, Charlie', '3', 'Made-up (P3)', 'c@example.test'],
  ]);

// Current A–E from row 3: two old students, then an Average row, then blank.
const current = [['101', 'x', '', '', ''], ['102', 'y', '', '', ''], ['', 'Average', '', '', ''],
  ['', '', '', '', '']];
check('same size roster: nothing covered or cleared', c.rosterRowsToChange_(current, 2, 3),
  { covered: [], staleRows: [] });
check('bigger roster covers the Average row (asks first)', c.rosterRowsToChange_(current, 3, 3),
  { covered: [5], staleRows: [] });
check('smaller roster clears the old student row only',
  c.rosterRowsToChange_(current, 1, 3), { covered: [], staleRows: [4] });

let thrown = '';
try { c.checkGradingSheet_({ getName: () => 'ref_peopleList' }); } catch (e) { thrown = e.message; }
check('refuses ref_ tabs', /grading sheet/.test(thrown), true);
thrown = '';
try { c.checkGradingSheet_({ getName: () => 'JupiterExport' }); } catch (e) { thrown = e.message; }
check('refuses JupiterExport', /grading sheet/.test(thrown), true);
thrown = 'none';
try { c.checkGradingSheet_({ getName: () => 'Comments' }); } catch (e) { thrown = e.message; }
check('accepts Comments', thrown, 'none');

// ---- Update Grades ----
check('final score (after late penalty)', c.scoreForJupiter_({ score: 8, entered_score: 10 }), 8);
check('zero kept', c.scoreForJupiter_({ score: 0 }), 0);
check('excused is blank', c.scoreForJupiter_({ excused: true, score: null }), '');
check('ungraded is blank', c.scoreForJupiter_({ score: null, grade: null }), '');
check('grade when no score', c.scoreForJupiter_({ score: null, grade: 'complete' }), 'complete');

const groupNames = new Map([['1', 'Homework'], ['2', 'Tests'], ['3', 'Practice']]);
const allowed = { ids: new Set(['1', '2']), names: new Set() };
const recent = [
  { assignment_id: 501, assignment: { name: 'HW 1', assignment_group_id: 1, points_possible: 10, due_at: '2030-01-28T09:59:00Z' } },
  { assignment_id: 501, assignment: { name: 'HW 1', assignment_group_id: 1, points_possible: 10 } },
  { assignment_id: 502, assignment: { name: 'Practice', assignment_group_id: 3, points_possible: 5 } },
  { assignment_id: 503, assignment: { name: 'Test 1', assignment_group_id: 2, points_possible: 30, due_at: null } },
  { assignment_id: 504 },
];
const picked = c.pickJupiterAssignments_(recent, groupNames, allowed);
check('only checked categories, once each', picked.map(a => [a.id, a.category, a.points]),
  [['501', 'Homework', 10], ['503', 'Tests', 30]]);
check('older lists match by name', c.pickJupiterAssignments_(recent, groupNames,
  { ids: new Set(), names: new Set(['practice']) }).map(a => a.id), ['502']);

// A made-up JupiterExport grid (Jupiter's template shape), widened to 5 columns like the
// code does (2 assignments × Score/Comment + column A).
const template = [
  ['This file should be opened in a spreadsheet application.', '', '', ''],
  ['To import back into Jupiter, save this file as CSV (comma delimited).', '', '', ''],
  ['', '', '', ''],
  ['Class:', 'MADE-UP CLASS (1)', '', ''],
  ['Assignment:', 'old', 'old', ''],
  ['Date:', '', '', ''],
  ['Possible:', '', '', ''],
  ['', '', '', ''],
  ['Student, Alpha (900001)', 'old', '', ''],
  ['Student, Bravo (900002)', '', '', ''],
  ['Student, Zulu (900099)', '', '', ''],
].map(row => row.concat(['']));
picked[0].scores = new Map([['101', 9], ['102', 0]]);
picked[1].scores = new Map([['101', 27]]);
const roster = new Map([['900001', '101'], ['900002', '102']]);
const result = c.fillJupiterExport_(template, picked, roster, () => '1/28/30');
const v = result.values;
check('instruction lines and Class: row kept', [v[1][0], v[3][1]],
  ['To import back into Jupiter, save this file as CSV (comma delimited).', 'MADE-UP CLASS (1)']);
check('assignment names', [v[4][1], v[4][3]], ['HW 1', 'Test 1']);
check('dates (blank due date stays blank)', [v[5][1], v[5][3]], ['1/28/30', '']);
check('points', [v[6][1], v[6][3]], [10, 30]);
check('Score:/Comment: row', v[7], ['', 'Score:', 'Comment:', 'Score:', 'Comment:']);
check('every row keeps its width', v.every(row => row.length === 5), true);
check('Alpha scores', [v[8][1], v[8][2], v[8][3]], [9, '', 27]);
check('Bravo: zero kept; missing score blank', [v[9][1], v[9][3]], [0, '']);
check('unmatched student row stays blank', [v[10][1], v[10][3]], ['', '']);
check('match counts', [result.matched, result.unmatched], [2, 1]);
check('template not changed in place', template[4][1], 'old');

if (failures) {
  console.log(`\n${failures} check(s) failed.`);
  process.exitCode = 1;
}
