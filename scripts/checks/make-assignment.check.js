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
// Stand-ins for the Google pieces the helpers use (same as create-by-row.check.js).
const context = {
  isBlank_: value => value === '' || value === null || value === undefined,
  sheetProblem_: message => Object.assign(new Error(message), { isSheetProblem: true }),
  Utilities: {
    formatDate(date, timeZone, pattern) {
      if (pattern === 'yyyy-MM-dd') {
        return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit',
          day: '2-digit' }).format(date);
      }
      if (pattern === 'Z') {
        const name = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
          .formatToParts(date).find(p => p.type === 'timeZoneName').value;
        return name.replace('GMT', '').replace(':', '') || '+0000';
      }
      throw new Error('unexpected pattern ' + pattern);
    },
  },
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(PROJECT, 'PostRows.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(PROJECT, 'MakeAssignment.js'), 'utf8') +
  '\nthis.findMakeAssignmentLayout_ = findMakeAssignmentLayout_;' +
  '\nthis.describeMakeAssignmentLayout_ = describeMakeAssignmentLayout_;' +
  '\nthis.planMakeAssignment_ = planMakeAssignment_; this.overridePath_ = overridePath_;' +
  '\nthis.assignmentPayload_ = assignmentPayload_;' +
  '\nthis.cellName_ = cellName_;', context);
const c = context;
const HST = 'Pacific/Honolulu';
// A date cell is midnight in Hawaii (10:00 UTC), made inside the sandbox so it's a real Date.
const day = iso => vm.runInContext(`new Date('${iso}T10:00:00Z')`, context);

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

// ---- Planning (Preview). Made-up values; "shown" is the displayed text. ----
// Item row 4: A..J = canvasID, name, points, Due Date, Schedule, Due Time, Unlock At,
// Unlock Time, Lock At, Lock Time. Row 7: A..L = Canvas URL, Type of Submission, Type,
// Published, Google Link Text:, Document URL:, Instructions:, (merged), (merged), (merged),
// Status, Payload. Overrides from row 12, same order as row 11.
function filledTab(changes = {}) {
  const shown = labGrid();
  const values = shown.map(row => row.slice());
  const set = (row, column, value, text = String(value)) => {
    values[row - 1][column - 1] = value;
    shown[row - 1][column - 1] = text;
  };
  set(4, 1, ''); set(4, 2, 'Sample lab'); set(4, 3, 20);
  set(4, 4, day('2030-01-28'), '1/28/2030'); set(4, 6, 'School Start (815)');
  set(4, 7, day('2030-01-21'), '1/21/2030'); set(4, 9, day('2030-02-04'), '2/4/2030');
  set(7, 2, 'online_text_entry'); set(7, 3, 'A'); set(7, 4, false, 'FALSE');
  set(7, 7, 'Read and answer.');
  set(12, 2, '1001'); set(12, 3, 3); set(12, 4, day('2030-01-28'), '1/28/2030');
  set(12, 6, 'Night (2200)'); set(12, 7, day('2030-01-25'), '1/25/2030');
  set(12, 9, day('2030-02-04'), '2/4/2030'); set(12, 10, '11:59 PM');
  set(13, 2, '1002'); set(13, 3, 4); set(13, 4, day('2030-01-30'), '1/30/2030');
  Object.entries(changes).forEach(([cell, value]) => {
    const [, letter, row] = cell.match(/^([A-Z])(\d+)$/);
    if (value instanceof Array) set(Number(row), letter.charCodeAt(0) - 64, value[0], value[1]);
    else set(Number(row), letter.charCodeAt(0) - 64, value);
  });
  return { values, shown, layout: c.findMakeAssignmentLayout_(shown) };
}
const plan = changes => {
  const tab = filledTab(changes);
  return c.planMakeAssignment_(tab.layout, tab.values, tab.shown, '5000', HST);
};

let p = plan();
check('item ready', [p.item.label, p.item.request.path], ['A, draft', '/courses/5000/assignments']);
check('item payload', p.item.request.payload.assignment, {
  name: 'Sample lab', points_possible: 20,
  description: '<p>Read and answer.</p>\n<p><br></p>\n',
  submission_types: ['online_text_entry'], published: false,
  due_at: '2030-01-28T08:15:00-10:00', unlock_at: '2030-01-21T00:00:00-10:00',
  lock_at: '2030-02-04T23:59:00-10:00',
});
check('two overrides planned (blank rows 14–17 left out)',
  p.overrides.map(o => o.rowNumber), [12, 13]);
check('override 1 payload', p.overrides[0].payload, { assignment_override: {
  course_section_id: 1001, due_at: '2030-01-28T22:00:00-10:00',
  unlock_at: '2030-01-25T00:00:00-10:00', lock_at: '2030-02-04T23:59:00-10:00' } });
check('override 2: only a due date, 11:59 PM', p.overrides[1].payload, { assignment_override: {
  course_section_id: 1002, due_at: '2030-01-30T23:59:00-10:00' } });
check('override path', c.overridePath_('5000', '777'), '/courses/5000/assignments/777/overrides');

p = plan({ B7: 'online_upload, online_url' });
check('two submission types', p.item.request.payload.assignment.submission_types,
  ['online_upload', 'online_url']);
p = plan({ B7: '' });
check('blank Type of Submission → online_upload',
  p.item.request.payload.assignment.submission_types, ['online_upload']);
check('createByRow default unchanged', c.assignmentPayload_({ name: 'x', points: 1 })
  .assignment.submission_types, ['online_upload']);
p = plan({ B7: 'online_essay' });
check('bad submission type', p.item.message,
  'Not ready: Type of Submission "online_essay" is not a Canvas submission type');
p = plan({ C7: 'D', B7: 'online_essay' });
check('Type of Submission ignored for D', p.item.request.path, '/courses/5000/discussion_topics');
p = plan({ D7: [true, 'TRUE'] });
check('Published ticked', [p.item.label, p.item.request.payload.assignment.published], ['A', true]);
p = plan({ C7: '' });
check('no Type', p.item.message, 'Not ready: no Type');
p = plan({ C7: 'Q' });
check('bad Type', p.item.message, 'Not ready: Type "Q" is not A, D, NQ, or CQ');
p = plan({ B4: '' });
check('no name', p.item.message, 'Not ready: no name');
p = plan({ F4: 'lunch' });
check('bad time', p.item.message, 'Not ready: Due Time "lunch" is not a time I understand');
p = plan({ A4: '123456' });
check('existing item: not created again, overrides still planned',
  [p.item.canvasId, Boolean(p.item.request), p.overrides.length], ['123456', false, 2]);

p = plan({ A12: '999' });
check('override with OverrideID skipped', p.overrides[0].message,
  'Skipped: already has an OverrideID');
p = plan({ B13: '1001' });
check('same section twice', p.overrides[1].message, 'Not ready: same Section ID as row 12');
p = plan({ B13: '' });
check('due date but no section', p.overrides[1].message, 'Not ready: no Section ID');
p = plan({ B13: '#N/A' });
check('section not a number', p.overrides[1].message, 'Not ready: Section ID must be a number');
p = plan({ D13: '' });
check('section but no due date', p.overrides[1].message, 'Not ready: no Due Date');

if (failures) {
  console.log(`\n${failures} check(s) failed.`);
  process.exitCode = 1;
}
