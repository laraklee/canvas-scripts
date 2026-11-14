/**
 * scripts/checks/assign-bring-over.check.js
 * Purpose: offline check of assign-sheet's "Bring over from my old copy"
 *   (10_BringOver.js) and its copy engine (09_TabRebuild.js): links are read right, text
 *   that looks like a number stays text, the plan gives each kind of tab the right
 *   action, Q tabs must match in columns A–E, cells already filled in the new copy stop
 *   everything BEFORE any change (formula cells compared by formula), *Config* copies only non-blank cells, and columns hidden in
 *   the new copy stay hidden. Made-up data
 *   only; nothing is sent anywhere. Run with the others: npm run check-offline. Repo
 *   helper only: never clasp-pushed.
 * Canvas endpoints called: none. Canvas write operations: none.
 * Required User/Script Properties: none.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PROJECT = path.join(__dirname, '..', '..', 'assign-sheet');
const context = { console: { log() {}, error() {} } };
vm.createContext(context);
['09_TabRebuild.js', '10_BringOver.js'].forEach(file =>
  vm.runInContext(fs.readFileSync(path.join(PROJECT, file), 'utf8'), context));
const c = context;

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}` +
    (ok ? '' : `\n      expected ${JSON.stringify(expected)}\n      got      ${JSON.stringify(actual)}`));
}

// --- Links, text, addresses, colors
const ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789';
check('link with /edit', c.rebuildExtractId_('https://docs.google.com/spreadsheets/d/' + ID + '/edit#gid=0'), ID);
check('bare ID', c.rebuildExtractId_('  ' + ID + ' '), ID);
check('not a link', c.rebuildExtractId_('my old sheet'), null);
check('text that would turn into numbers, dates, formulas',
  ['007', '1/2', '=x', 'TRUE', '12:30', '-5', '$4.00'].map(c.rebuildLooksLikeNonText_),
  [true, true, true, true, true, true, true]);
check('ordinary text stays as is', ['Homework', 'Lab 3 notes', ''].map(c.rebuildLooksLikeNonText_),
  [false, false, false]);
check('A1 addresses', [c.rebuildA1_(1, 1), c.rebuildA1_(3, 27), c.rebuildA1_(10, 702)], ['A1', 'AA3', 'ZZ10']);
const rep = c.rebuildNewReport_();
check('colors', [c.rebuildColor_({ red: 1 }, rep), c.rebuildColor_({ rgbColor: { green: 1, blue: 1 } }, rep),
  c.rebuildColor_({ themeColor: 'ACCENT1' }, rep), rep.themeColors], ['#ff0000', '#00ffff', null, 1]);
check('values', [{ userEnteredValue: { stringValue: '007' } }, { userEnteredValue: { numberValue: 3 } },
  { userEnteredValue: { formulaValue: '=A1' } }, {}].map(cell => c.rebuildCellValue_(cell, rep)),
['\'007', 3, '=A1', '']);

// --- The plan
const newTabs = ['*Config*', 'Q1', 'Q2', 'Q3', 'Q4', 'calendarEvents', 'Assignment Dates',
  'AssignmentMaster', 'Instructions'];
const fakeSs = { getSheetByName: n => (newTabs.includes(n) ? {} : null) };
const plan = name => c.planRowFor_(fakeSs, { title: name, isGrid: true });
check('Config brings settings in', plan('*Config*').action, 'config');
check('Q tabs bring columns F on', plan('Q3').action, 'quarter');
check('calendarEvents brings rows', plan('calendarEvents').action, 'data');
check('Assignment Dates is skipped (reload)', [plan('Assignment Dates').action,
  plan('Assignment Dates').options.length], ['skip', 1]);
check('helper tab is skipped', plan('AssignmentMaster').action, 'skip');
check('teacher\'s own tab is copied', plan('Q1 (my clone)').action, 'copy');
check('same-name tab: skip, or copy as (old)', [plan('Instructions').action,
  plan('Instructions').options.map(o => o.value)], ['skip', ['skip', 'copyOld']]);
check('chart tab is skipped', c.planRowFor_(fakeSs, { title: 'Chart1', isGrid: false }).action, 'skip');
check('(old) name avoids clashes', c.oldCopyName_({ getSheetByName: n => (n === 'X (old)' ? {} : null) }, 'X'),
  'X (old 2)');

// --- Q tabs: A–E row by row
const oldRows = vals => vals.map(row => ({ values: row.map(v => ({ formattedValue: v })) }));
const qSheet = shown => ({ getMaxRows: () => 100,
  getRange: () => ({ getDisplayValues: () => shown }) });
const src = rows => ({ data: [{ rowData: oldRows(rows) }] });
const qOld = src([['Q1', '', '', '', ''], ['8/20', 'Thu', '1,2', 'A', ''], ['8/21', 'Fri', '1,2', 'B', '']]);
check('Q tab matches', c.checkQuarterRows_(qSheet([['Q1', '', '', '', ''],
  ['8/20', 'Thu', '1,2', 'A', ''], ['8/21', 'Fri', '1,2', 'B', '']]), qOld), '');
check('Q tab: one row differs', c.checkQuarterRows_(qSheet([['Q1', '', '', '', ''],
  ['8/20', 'Thu', '1,2', 'A', ''], ['8/24', 'Mon', '1,2', 'B', '']]), qOld)
  .startsWith('1 row(s) in columns A–E don\'t match'), true);
check('Q tab: not filled in yet', c.checkQuarterRows_(qSheet([['', '', '', '', ''], ['', '', '', '', ''],
  ['', '', '', '', '']]), qOld).includes('Update schedule from Master first'), true);

// --- Cells in the way
const wayOld = src([['Lesson', 'Notes'], ['Cells', ''], ['', 'quiz']]);
const waySheet = (values, shown) => ({ getMaxRows: () => 50, getMaxColumns: () => 10,
  getRange: () => ({ getValues: () => values, getDisplayValues: () => shown }) });
check('blank, unticked, and same-as-old cells are not in the way', c.rebuildFindInTheWay_(
  waySheet([['Lesson', ''], ['', false], ['', '']], [['Lesson', ''], ['', 'FALSE'], ['', '']]), wayOld, 0),
{ count: 0, first: '' });
check('a different value is in the way', c.rebuildFindInTheWay_(
  waySheet([['Lesson', ''], ['', ''], ['x', '']], [['Lesson', ''], ['', ''], ['x', '']]), wayOld, 0),
{ count: 1, first: 'A3' });

// --- Formula cells compare by formula (11/13, from Course Manager's version)
const fx = (f, shown) => ({ formattedValue: shown, userEnteredValue: { formulaValue: f } });
const fOld = src([['', '', '', '', '', 'Lesson', ''], ['', '', '', '', '', 'Cells', '']]);
fOld.data[0].rowData[0].values[6] = fx('=SUM(A1)', '3');
const fSheet = (values, shown, formulas) => ({ getMaxRows: () => 50, getMaxColumns: () => 10,
  getRange: () => ({ getValues: () => values, getDisplayValues: () => shown, getFormulas: () => formulas }) });
check('same formula showing something else for now: not in the way', c.bringFindInTheWay_(
  fSheet([['Lesson', 9], ['Cells', '']], [['Lesson', '9'], ['Cells', '']], [['', '=SUM(A1)'], ['', '']]),
  fOld, 5), { count: 0, first: '' });
check('a different formula showing the same thing: in the way', c.bringFindInTheWay_(
  fSheet([['Lesson', 3], ['Cells', '']], [['Lesson', '3'], ['Cells', '']], [['', '=3'], ['', '']]),
  fOld, 5), { count: 1, first: 'G1' });
check('a typed value is still compared by what it shows', c.bringFindInTheWay_(
  fSheet([['Lesson', ''], ['Labs', '']], [['Lesson', ''], ['Labs', '']], [['', ''], ['', '']]),
  fOld, 5), { count: 1, first: 'F2' });

// --- A failed check changes nothing
let changed = 0;
const qTab = { getMaxRows: () => 100, getMaxColumns: () => 10,
  getRange: () => ({ getDisplayValues: () => [['Q1', '', '', '', ''], ['8/20', 'Thu', '1,2', 'A', ''],
    ['8/21', 'Fri', '1,2', 'B', '']], getValues: () => [['x']] }) };
const realSs = { getSheetByName: n => (n === 'Q1' ? qTab : null),
  insertSheet: () => { changed++; return {}; }, getNamedRanges: () => [], getNumSheets: () => 1 };
c.SpreadsheetApp = { getActiveSpreadsheet: () => realSs };
c.buildBringOverPlan_ = () => ({ sourceId: ID, outline: { sheets: [] }, rows: [
  { name: 'Q1', action: 'quarter', options: [{ value: 'quarter' }, { value: 'skip' }] },
  { name: 'Mine', action: 'copy', options: [{ value: 'copy' }, { value: 'skip' }] }] });
const qOldWithLesson = src([['Q1', '', '', '', '', 'Lesson'], ['8/20', 'Thu', '1,2', 'A', '', 'Cells'],
  ['8/21', 'Fri', '1,2', 'B', '', '']]);
c.rebuildReadTabs_ = () => ({ namedRanges: [], sheets: new Map([['Q1', qOldWithLesson],
  ['Mine', { properties: { title: 'Mine' }, data: [] }]]) });
c.bringFindInTheWay_ = () => ({ count: 2, first: 'F3' });
const stopped = c.doBringOver_('link', {});
check('a cell in the way stops everything', [stopped.ok, stopped.problems.length, changed], [false, 1, 0]);
const allSkip = c.doBringOver_('link', { Q1: 'skip', Mine: 'skip' });
check('all Skip: nothing to do', [allSkip.ok, changed], [false, 0]);
const notAllowed = c.doBringOver_('link', { Q1: 'copy' });
check('a choice the plan doesn\'t offer falls back to the plan', notAllowed.problems.length, 1);

// --- *Config*: only non-blank cells
const written = {};
const configSheet = { getRange: (a, b) => {
  if (typeof a === 'number') return { setValue: v => { written[c.rebuildA1_(a, b)] = v; } };
  const m = String(a).match(/^([A-Z])(\d)(?::([A-Z])(\d))?$/);
  const col = m[1].charCodeAt(0) - 64;
  const row = Number(m[2]);
  const rows = m[3] ? Number(m[4]) - row + 1 : 1;
  const cols = m[3] ? m[3].charCodeAt(0) - 64 - col + 1 : 1;
  return { getRow: () => row, getColumn: () => col, getNumRows: () => rows, getNumColumns: () => cols };
} };
const cfg = { data: [{ rowData: [
  { values: [] },
  { values: [{}, { userEnteredValue: { stringValue: 'https://school.example.edu' } }, {},
    {}, { userEnteredValue: { boolValue: true } }, { userEnteredValue: { stringValue: '1,2' } }] },
  { values: [{}, {}, {}, { userEnteredValue: { stringValue: 'sheet-id-here' } }] },
  { values: [{}, { userEnteredValue: { numberValue: 4573 } }] },
] }] };
const n = c.bringConfigCells_(configSheet, cfg, c.rebuildNewReport_());
check('Config copies only non-blank cells', [n, Object.keys(written).sort()], [5, ['B2', 'B4', 'D3', 'E2', 'F2']]);
check('Config course number stays a number', written.B4, 4573);

// --- Column widths never show a column hidden in the new copy (Lara's test, 11/13)
const colCalls = [];
const colSheet = { isColumnHiddenByUser: col => col === 7,
  setColumnWidth: col => colCalls.push('width ' + col), hideColumns: col => colCalls.push('hide ' + col) };
c.rebuildWriteCells_(colSheet, { data: [{ columnMetadata: [{ pixelSize: 50 }, {}, {}, {}, {}, {},
  { pixelSize: 200 }, { pixelSize: 200 }, { pixelSize: 200, hiddenByUser: true }] }] },
5, c.rebuildNewReport_(), 'Q1', false);
check('hidden column in the new copy stays hidden; A–E untouched', colCalls,
  ['width 8', 'width 9', 'hide 9']);

if (failures) process.exitCode = 1;
