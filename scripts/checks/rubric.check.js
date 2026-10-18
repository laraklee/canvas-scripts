/**
 * scripts/checks/rubric.check.js
 * Purpose: offline check of the rubric export builder in Rubrics.js, using a made-up rubric
 *   shaped like Lara's template tab (nothing is sent anywhere). Run with the others:
 *   npm run check-offline.
 *   Repo helper only: not part of any Apps Script project; never clasp-pushed.
 * Canvas endpoints called: none. Canvas write operations: none.
 * Required User/Script Properties: none.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PROJECT = path.join(__dirname, '..', '..', 'course-manager-jupiter');
const context = {};
vm.createContext(context);
// cellName_ lives in MakeAssignment.js; Rubrics.js uses it for cell names in messages.
vm.runInContext(fs.readFileSync(path.join(PROJECT, 'MakeAssignment.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(PROJECT, 'Rubrics.js'), 'utf8'), context);
const c = context;

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}` +
    (ok ? '' : `\n      expected ${JSON.stringify(expected)}\n      got      ${JSON.stringify(actual)}`));
}

// Lara's template shape: A1 label, A2 title, row 3 criterion names, row 4 descriptions,
// rows 5–16 Rating 1–4 Name/Description/Points. Columns A–F. Made-up content.
function rubricTab(edit) {
  const grid = [
    ['Rubric Title', '', '', '', '', ''],
    ['Made-up Lab Rubric', '', '', '', '', ''],
    ['', 'Claim', 'Variables', 'Data Table', 'Graph', 'Criterion 5'],
    ['Criterion Description', 'States a claim', 'Names the variables', 'All data shown',
      'Graph is labeled', ''],
  ];
  [1, 2, 3, 4].forEach(n => ['Name', 'Description', 'Points'].forEach(part =>
    grid.push([`Rating ${n} ${part}`, '', '', '', '', ''])));
  // Rating 1 for four criteria; Rating 2 for Claim only (with a description).
  [['Well done', 5], ['Complete', 10], ['Outstanding', 25], ['Well done', 10]]
    .forEach(([name, points], i) => { grid[4][i + 1] = name; grid[6][i + 1] = points; });
  grid[7][1] = 'Partly'; grid[8][1] = 'Claim is unclear'; grid[9][1] = 2;
  if (edit) edit(grid);
  return { cells: grid, shown: grid.map(row => row.map(v => String(v).trim())) };
}
const run = edit => {
  const tab = rubricTab(edit);
  return c.buildRubricExport_(tab.cells, tab.shown);
};

let r = run();
check('no problems', r.problems, []);
check('title from the cell under "Rubric Title"', r.title, 'Made-up Lab Rubric');
check('header: 4 fixed + 2 rating groups', r.rows[0], ['Rubric Name', 'Criteria Name',
  'Criteria Description', 'Criteria Enable Range', 'Rating Name', 'Rating Description',
  'Rating Points', 'Rating Name', 'Rating Description', 'Rating Points']);
check('Claim row: two ratings, with description', r.rows[1], ['Made-up Lab Rubric', 'Claim',
  'States a claim', 'FALSE', 'Well done', '', 5, 'Partly', 'Claim is unclear', 2]);
check('one-rating row padded to full width', r.rows[2], ['Made-up Lab Rubric', 'Variables',
  'Names the variables', 'FALSE', 'Complete', '', 10, '', '', '']);
check('placeholder "Criterion 5" skipped silently', [r.rows.length - 1, r.skipped], [4, 1]);

r = run(g => { g[6][3] = ''; });
check('name without points', r.problems, ['D7: Rating 1 ("Outstanding") has no points.']);
r = run(g => { g[4][3] = ''; });
check('points without name', r.problems, ['D5: Rating 1 has points or a description but no name.']);
r = run(g => { g[6][2] = 'ten'; });
check('points not a number', r.problems, ['C7: Rating 1 points must be a number.']);
r = run(g => { g[2][1] = ''; });
check('ratings but no criterion name', r.problems, ['B3: this criterion has ratings but no name.']);
r = run(g => { g[1][0] = ''; });
check('blank title', r.problems, ['the title (A2) is blank.']);
r = run(g => { g[0][0] = 'Title'; });
check('missing Rubric Title label', r.problems, ['column A has no "Rubric Title" label.']);
r = run(g => { g[15][0] = 'Rating 4 Pts'; });
check('missing a rating label', r.problems, ['column A has no "Rating 4 Points" label.']);
r = run(g => { [4, 6, 7, 8, 9].forEach(row => g[row].fill('', 1)); });
check('no ratings at all', r.problems, ['no criterion has any ratings.']);

// Rows can move: insert a blank row at the top and a note row in the middle.
r = run(g => {
  g.unshift(['', '', '', '', '', '']);
  g.splice(5, 0, ['note', '', '', '', '', '']);
});
check('rows moved: same export', [r.problems, r.rows.length, r.rows[1][1], r.rows[1][9]],
  [[], 5, 'Claim', 2]);

if (failures) {
  console.log(`\n${failures} check(s) failed.`);
  process.exitCode = 1;
}
