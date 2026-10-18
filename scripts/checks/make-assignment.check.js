/**
 * scripts/checks/make-assignment.check.js
 * Purpose: offline check of the makeAssignment label finder in MakeAssignment.js, using a
 *   made-up grid shaped like Lara's tab (labels only, made-up values; nothing is sent
 *   anywhere). Run with the others: npm run check-offline.
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
vm.runInContext(fs.readFileSync(path.join(PROJECT, 'MakeAssignment.js'), 'utf8') +
  '\nthis.findMakeAssignmentLayout_ = findMakeAssignmentLayout_;' +
  '\nthis.describeMakeAssignmentLayout_ = describeMakeAssignmentLayout_;' +
  '\nthis.cellName_ = cellName_;', context);
const c = context;

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}` +
    (ok ? '' : `\n      expected ${JSON.stringify(expected)}\n      got      ${JSON.stringify(actual)}`));
}

// A grid shaped like Lara's tab (17 rows × 12 columns), made-up values. "Instructions:"
// is merged across G6:J6, so H6–J6 read as blank.
function labGrid() {
  const grid = Array.from({ length: 17 }, () => Array(12).fill(''));
  const put = (row, labels) => labels.forEach((label, i) => { grid[row - 1][i] = label; });
  put(1, ['1234', 'Made-up course', '', '', '', '', '', 'Clear IDs, fill in red cells']);
  put(3, ['canvasID', 'name', 'points_possible', 'Due Date', 'Schedule', 'Due Time',
    'Unlock At', 'Unlock Time', 'Lock At', 'Lock Time']);
  put(4, ['', 'Sample', '20', '1/2/2030']);
  put(6, ['Canvas URL', 'Type of Submission', 'Type', 'Published', 'Google Link Text:',
    'Document URL:', 'Instructions:', '', '', '', 'Status', 'Payload']);
  put(10, ['Overrides']);
  put(11, ['OverrideID', 'Section ID', 'Period', 'Due Date', 'Schedule', 'Due Time',
    'Unlock At', 'Unlock Time', 'Lock At', 'Lock Time', 'Status', 'Payload']);
  put(12, ['', '1001', '3', '1/2/2030']);
  return grid;
}

let layout = c.findMakeAssignmentLayout_(labGrid());
check('Lara\'s layout: no problems', layout.problemCount, 0);
check('item header row', layout.tables.item.headerRow, 3);
check('item second row', layout.tables.itemMore.headerRow, 6);
check('overrides header row', layout.tables.overrides.headerRow, 11);
check('override rows 12–17', [layout.tables.overrides.firstDataRow,
  layout.tables.overrides.lastDataRow], [12, 17]);
check('Status found past merged Instructions', layout.tables.itemMore.columns.get('Status'), 11);
check('Due Time column in item', layout.tables.item.columns.get('Due Time'), 6);
check('Due Time column in overrides', layout.tables.overrides.columns.get('Due Time'), 6);
check('Schedule is ignored', layout.tables.item.ignored, ['Schedule']);
check('summary says ready',
  /ready for makeAssignment/.test(c.describeMakeAssignmentLayout_(layout)), true);

// Duplicate Status/Payload (Lara's earlier draft of row 6).
const dup = labGrid();
dup[5] = ['Canvas URL', 'Type of Submission', 'Type', 'Published', 'Google Link Text:',
  'Document URL:', 'Instructions:', '', 'Payload', 'Status', 'Status', 'Payload'];
layout = c.findMakeAssignmentLayout_(dup);
check('duplicates found', layout.tables.itemMore.duplicates, ['Status', 'Payload']);
check('duplicates count as one problem', layout.problemCount, 1);

// Misspelled label.
const typo = labGrid();
typo[5][11] = 'Paylload';
layout = c.findMakeAssignmentLayout_(typo);
check('typo: Payload missing', layout.tables.itemMore.missing, ['Payload']);
check('typo: shown as not used', layout.tables.itemMore.ignored, ['Paylload']);

// Not a makeAssignment tab.
layout = c.findMakeAssignmentLayout_([['name', 'Type'], ['a', 'b']]);
check('other tab: three problems', layout.problemCount, 3);
check('other tab: summary names canvasID',
  /no cell says "canvasID"/.test(c.describeMakeAssignmentLayout_(layout)), true);

// First label twice.
const twice = labGrid();
twice[15][0] = 'OverrideID';
layout = c.findMakeAssignmentLayout_(twice);
check('OverrideID twice',
  /appears 2 times \(A11, A16\)/.test(layout.tables.overrides.problems[0]), true);

// Tables anywhere: shift everything right two columns and down one row.
const shifted = [Array(14).fill('')].concat(labGrid().map(row => ['', ''].concat(row)));
layout = c.findMakeAssignmentLayout_(shifted);
check('shifted: no problems', layout.problemCount, 0);
check('shifted: Due Time column', layout.tables.overrides.columns.get('Due Time'), 8);
check('shifted: override rows', [layout.tables.overrides.firstDataRow,
  layout.tables.overrides.lastDataRow], [13, 18]);

// Overrides labels on the last row: no rows for overrides.
const noRows = labGrid().slice(0, 11);
check('no override rows is a problem', c.findMakeAssignmentLayout_(noRows).problemCount, 1);

// Empty tab.
check('empty tab: three problems', c.findMakeAssignmentLayout_([]).problemCount, 3);

check('cell names', [c.cellName_(1, 1), c.cellName_(11, 26), c.cellName_(2, 27),
  c.cellName_(3, 52)], ['A1', 'Z11', 'AA2', 'AZ3']);

if (failures) {
  console.log(`\n${failures} check(s) failed.`);
  process.exitCode = 1;
}
