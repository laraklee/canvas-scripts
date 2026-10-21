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
check('roster: students only, once each, sorted by Period then name, section looked up',
  c.buildRosterRows_(people, sections), [
    ['103', 'Student, Charlie', '3', 'Made-up (P3)', 'c@example.test'],
    ['101', 'Student, Alpha', '4', 'Made-up (P4)', 'a@example.test'],
    ['102', 'Student, Bravo', 'N/A', 'N/A', 'b@example.test'],
  ]);
check('period 10 sorts after period 3', [['1', 'B', '10'], ['2', 'A', '3']].sort(c.compareRosterRows_)
  .map(row => row[0]), ['2', '1']);

// Current A–E from row 3: two old students, then an Average row, then blank.
const current = [['101', 'x', '', '', ''], ['102', 'y', '', '', ''], ['', 'Average', '', '', ''],
  ['', '', '', '', '']];
check('same size roster: nothing covered or cleared', c.rosterRowsToChange_(current, 2, 3),
  { covered: [], staleRows: [] });
check('bigger roster covers the Average row (asks first)', c.rosterRowsToChange_(current, 3, 3),
  { covered: [5], staleRows: [] });
check('smaller roster clears the old student row only',
  c.rosterRowsToChange_(current, 1, 3), { covered: [], staleRows: [4] });

// ---- CreateRoster on a sheet that already has students (rows stay lined up) ----
const st = (id, name, period) => [id, `Student, ${name}`, period, `Made-up (P${period})`,
  `${id}@example.test`];
const alpha = st('201', 'Alpha', '3');
const delta = st('202', 'Delta', '3');
const golf = st('203', 'Golf', '3');
const bravo = st('204', 'Bravo', '4');
const echo = st('205', 'Echo', '4');
const zulu = st('206', 'Zulu', '4');
const charlie = st('209', 'Charlie', '3');
const blankRow = ['', '', '', '', ''];
const averageRow = ['', 'Average', '', '', ''];

// A pretend sheet: each row is A–E plus F (a made-up Jupiter ID), and a background color.
function fakeSheet(rowsAE, answer) {
  const cells = [['Last Jupiter Sync:', ''], ['labels']].concat(rowsAE.map((row, i) =>
    row.concat([row[0] ? `J${row[0]}` : `extra${i}`])));
  const colors = cells.map(() => 'white');
  const alerts = [];
  const sheet = {
    cells, colors, alerts,
    getLastColumn: () => 6,
    getRange: (row, col, numRows = 1, numCols = 1) => ({
      setValues: values => values.forEach((v, i) => v.forEach((value, j) => {
        cells[row - 1 + i] = cells[row - 1 + i] || [];
        cells[row - 1 + i][col - 1 + j] = value;
      })),
      getBackgrounds: () => [[colors[row - 1]]],
      setBackground: color => { colors[row - 1] = color; },
      setBackgrounds: values => { colors[row - 1] = values[0][0]; },
      numRows, numCols,
    }),
    setActiveRange: () => {},
    deleteRow: row => { cells.splice(row - 1, 1); colors.splice(row - 1, 1); },
    insertRowsAfter: (row, n) => {
      cells.splice(row, 0, ...Array.from({ length: n }, () => []));
      colors.splice(row, 0, ...Array(n).fill('white'));
    },
    insertRowsBefore: (row, n) => sheet.insertRowsAfter(row - 1, n),
  };
  context.SpreadsheetApp = {
    flush: () => {},
    getUi: () => ({
      Button: { YES: 'YES', NO: 'NO' }, ButtonSet: { OK: 'OK', YES_NO: 'YES_NO' },
      alert: (title, message, buttons) => {
        alerts.push({ message, colors: colors.slice() });
        return buttons === 'YES_NO' ? answer : 'OK';
      },
    }),
  };
  return sheet;
}
const idsAndJupiter = sheet => sheet.cells.slice(2).map(row => `${row[0] || row[1] || ''}|${row[5] || ''}`);
context.console = { log: () => {} };

// Sorted sheet: Charlie dropped; Delta (P3) and Zulu (P4, last) added; Alpha's email changed.
const sortedNow = [alpha.slice(0, 4).concat(['old@example.test']), charlie, golf, bravo, echo,
  averageRow, blankRow];
const sortedRoster = [alpha, delta, golf, bravo, echo, zulu];
const sortedPlan = c.planRosterUpdate_(sortedNow, sortedRoster, 3);
check('sorted: drop, inserts, and in-place update planned',
  [sortedPlan.drops, sortedPlan.inserts.map(i => [i.values[0], i.before]),
    sortedPlan.updates.map(u => u.row), sortedPlan.keptCount],
  [[4], [['202', 5], ['206', 8]], [3], 4]);
check('sorted: new rows reported where they end up', sortedPlan.addedRows, [4, 8]);
const sortedSheet = fakeSheet(sortedNow, 'YES');
c.applyRosterPlan_(sortedSheet, sortedPlan);
check('sorted: every Jupiter ID stays with its student; new rows blank in F; Average after',
  idsAndJupiter(sortedSheet), ['201|J201', '202|', '203|J203', '204|J204', '205|J205', '206|',
    'Average|extra5', '|extra6']);
check('sorted: email refreshed in place', sortedSheet.cells[2][4], '201@example.test');
check('sorted: dropped row highlighted while asking (no names in the message)',
  [sortedSheet.alerts[0].colors[3], /Charlie/.test(sortedSheet.alerts[0].message),
    /row\(s\) 4\./.test(sortedSheet.alerts[0].message)], ['#f4cccc', false, true]);
check('sorted: final message has row numbers, no names',
  [/rows?\(s\): 4, 8/.test(sortedSheet.alerts[1].message), /Student,/.test(sortedSheet.alerts[1].message)],
  [true, false]);

// Same sheet, but Lara answers No: nothing changes and the highlight comes off.
const noSheet = fakeSheet(sortedNow, 'NO');
const before = JSON.stringify(noSheet.cells);
c.applyRosterPlan_(noSheet, c.planRosterUpdate_(sortedNow, sortedRoster, 3));
check('answer No: sheet unchanged, colors restored',
  [JSON.stringify(noSheet.cells) === before, noSheet.colors.every(color => color === 'white')],
  [true, true]);

// Name-only order (multi-section): Echo moved to P3 in Canvas; Delta (P3) and Foxtrot (new
// P5) added. Not in Period order, so Delta goes after the last P3 student, Foxtrot at the end.
const foxtrot = st('207', 'Foxtrot', '5');
const echoP3 = st('205', 'Echo', '3');
const mixedNow = [alpha, bravo, echo, golf];
const mixedPlan = c.planRosterUpdate_(mixedNow, [alpha, delta, echoP3, golf, bravo, foxtrot], 3);
check('not in order: after last same-period student, else at the end',
  mixedPlan.inserts.map(i => [i.values[0], i.before]), [['202', 7], ['207', 7]]);
check('not in order: added rows and period-change notice',
  [mixedPlan.addedRows, mixedPlan.periodChangedRows, mixedPlan.drops], [[7, 8], [5], []]);
const mixedSheet = fakeSheet(mixedNow, 'YES');
c.applyRosterPlan_(mixedSheet, mixedPlan);
check('not in order: rows stay lined up; no delete question asked',
  [idsAndJupiter(mixedSheet), mixedSheet.alerts.length],
  [['201|J201', '204|J204', '205|J205', '203|J203', '202|', '207|'], 1]);

// Drop and add at the same spot (Charlie's row replaced by Delta, right before Golf).
const swapPlan = c.planRosterUpdate_([alpha, charlie, golf], [alpha, delta, golf], 3);
const swapSheet = fakeSheet([alpha, charlie, golf], 'YES');
c.applyRosterPlan_(swapSheet, swapPlan);
check('drop and add at the same row', [idsAndJupiter(swapSheet), swapPlan.addedRows],
  [['201|J201', '202|', '203|J203'], [4]]);

check('first run: no students on the sheet', c.planRosterUpdate_([averageRow, blankRow],
  sortedRoster, 3), null);
let stopped = '';
try { c.planRosterUpdate_([alpha, charlie, golf], [alpha, delta], 3); } catch (e) { stopped = e.message; }
check('safety stop: more than half would be deleted', /more than half/.test(stopped), true);
stopped = '';
try { c.planRosterUpdate_([alpha, golf, alpha], sortedRoster, 3); } catch (e) { stopped = e.message; }
check('same User ID twice stops', /Rows 3 and 5 have the same User ID/.test(stopped), true);

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
