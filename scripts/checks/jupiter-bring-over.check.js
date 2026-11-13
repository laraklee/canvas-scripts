/**
 * scripts/checks/jupiter-bring-over.check.js
 * Purpose: offline check of course-manager-jupiter's "Bring over from my old copy"
 *   (BringOver.js) and its copy engine (09_TabRebuild.js, which must stay the same file as
 *   assign-sheet's): the plan gives each kind of tab the right action, a cell already
 *   filled differently in the new copy stops everything BEFORE any change (a cell with
 *   the same formula doesn't), ref_Config copies only non-blank cells of the named
 *   settings, by name, and never cfg_ThisSheetID. Made-up data only; nothing is sent
 *   anywhere. Run with the others: npm run check-offline. Repo helper only: never
 *   clasp-pushed.
 * Canvas endpoints called: none. Canvas write operations: none.
 * Required User/Script Properties: none.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const PROJECT = path.join(ROOT, 'course-manager-jupiter');
const context = { console: { log() {}, error() {} } };
vm.createContext(context);
// Name order, as Apps Script loads them (BringOver.js before Config.js).
['09_TabRebuild.js', 'BringOver.js', 'Config.js', 'Menus.js'].forEach(file =>
  vm.runInContext(fs.readFileSync(path.join(PROJECT, file), 'utf8'), context));
const c = context;
const G = name => vm.runInContext(name, context);

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}` +
    (ok ? '' : `\n      expected ${JSON.stringify(expected)}\n      got      ${JSON.stringify(actual)}`));
}

// --- The engine is shared: same file in both projects
check('09_TabRebuild.js is the same as assign-sheet\'s',
  fs.readFileSync(path.join(PROJECT, '09_TabRebuild.js'), 'utf8') ===
  fs.readFileSync(path.join(ROOT, 'assign-sheet', '09_TabRebuild.js'), 'utf8'), true);
const tool = vm.runInContext('TOOL_SHEETS', context);
check('built-tab names match TOOL_SHEETS', [tool.COURSE_CHECK, tool.ASSIGNMENT_ORDER,
  tool.RUBRIC_EXPORT, tool.JUPITER_EXPORT].every(n => G("BRING_OVER_BUILT_TABS").includes(n)), true);
const cfgNames = vm.runInContext('CFG_NAMES', context);
check('settings never include this sheet\'s ID or the course-name formula',
  G("BRING_OVER_CONFIG_NAMES").filter(n => ['cfg_ThisSheetID', 'cfg_CourseName'].includes(n)), []);
check('settings include every other cfg_ name in Config.js', cfgNames.filter(n =>
  !['cfg_ThisSheetID', 'cfg_CourseName'].includes(n) && !G("BRING_OVER_CONFIG_NAMES").includes(n)), []);

// --- The plan
const newTabs = ['ref_Config', 'ref_peopleList', '🏠 Home', 'createByRow', 'makeAssignment',
  'Comments', 'Course Check', 'JupiterExport'];
const fakeSs = { getSheetByName: n => (newTabs.includes(n) ? {} : null) };
const plan = name => c.planRowFor_(fakeSs, { title: name, isGrid: true });
check('ref_Config brings settings in', plan('ref_Config').action, 'config');
check('other ref_ tabs are skipped, no choice', [plan('ref_peopleList').action,
  plan('ref_peopleList').options.length, plan('ref_Index').action], ['skip', 1, 'skip']);
check('tool-built tabs are skipped, no choice', [plan('Course Check').action,
  plan('Quiz report').options.length, plan('JupiterExport').action], ['skip', 1, 'skip']);
check('same-name tab: bring cells in first; or copy as (old), or skip',
  [plan('createByRow').action, plan('createByRow').options.map(o => o.value)],
  ['data', ['data', 'copyOld', 'skip']]);
check('Home starts on Skip, same choices', [plan('🏠 Home').action,
  plan('🏠 Home').options.length], ['skip', 3]);
check('teacher\'s own tab is copied', plan('makeAssignment Lab').action, 'copy');
check('chart tab is skipped', c.planRowFor_(fakeSs, { title: 'Chart1', isGrid: false }).action, 'skip');

// --- Cells in the way (same formula is fine)
const src = rows => ({ data: [{ rowData: rows.map(row => ({ values: row })) }] });
const fv = v => ({ formattedValue: v, userEnteredValue: { stringValue: v } });
const fx = (f, shown) => ({ formattedValue: shown, userEnteredValue: { formulaValue: f } });
const way = (values, shown, formulas) => ({ getMaxRows: () => 50, getMaxColumns: () => 10,
  getRange: () => ({ getValues: () => values, getDisplayValues: () => shown,
    getFormulas: () => formulas }) });
const oldTab = src([[fv('Title'), fx('=cfg_CourseName', 'Biology')], [fv('row'), {}]]);
check('same formula showing something else for now is not in the way', c.bringFindInTheWay_(
  way([['Title', '#N/A'], ['row', '']], [['Title', '#N/A'], ['row', '']],
    [['', '=cfg_CourseName'], ['', '']]), oldTab), { count: 0, first: '' });
check('a new cell where the old one is blank is in the way', c.bringFindInTheWay_(
  way([['Title', ''], ['row', 'new tip']], [['Title', ''], ['row', 'new tip']],
    [['', ''], ['', '']]), oldTab), { count: 1, first: 'B2' });
check('a different formula is in the way', c.bringFindInTheWay_(
  way([['Title', 'x']], [['Title', 'Biology']], [['', '=OTHER()']]), oldTab), { count: 1, first: 'B1' });

// --- A failed check changes nothing
let changed = 0;
const realSs = { getSheetByName: n => (n === 'createByRow' ? {} : null),
  insertSheet: () => { changed++; return {}; }, getNamedRanges: () => [], getNumSheets: () => 1 };
c.SpreadsheetApp = { getActiveSpreadsheet: () => realSs };
c.buildBringOverPlan_ = () => ({ sourceId: 'x', outline: { sheets: [] }, rows: [
  { name: 'createByRow', action: 'data', options: [{ value: 'data' }, { value: 'skip' }] },
  { name: 'Mine', action: 'copy', options: [{ value: 'copy' }, { value: 'skip' }] }] });
c.rebuildReadTabs_ = () => ({ namedRanges: [], sheets: new Map([['createByRow', oldTab],
  ['Mine', { properties: { title: 'Mine' }, data: [] }]]) });
const realFind = c.bringFindInTheWay_;
c.bringFindInTheWay_ = () => ({ count: 2, first: 'C3' });
const stopped = c.doBringOver_('link', {});
check('a cell in the way stops everything', [stopped.ok, stopped.problems.length, changed], [false, 1, 0]);
check('all Skip: nothing to do', [c.doBringOver_('link', { createByRow: 'skip', Mine: 'skip' }).ok,
  changed], [false, 0]);
c.bringFindInTheWay_ = realFind;

// --- ref_Config: named settings, non-blank only, found by name
const written = {};
const configSheet = { getName: () => 'ref_Config',
  getRange: (r, col) => ({ setValue: v => { written[c.rebuildA1_(r, col)] = v; } }) };
const rangeHere = (row, col, rows, cols) => ({ getSheet: () => configSheet, getRow: () => row,
  getColumn: () => col, getNumRows: () => rows, getNumColumns: () => cols });
const here = { cfg_CourseID: rangeHere(4, 2, 1, 1), cfg_UserID: rangeHere(3, 2, 1, 1),
  cfg_CcEmail: rangeHere(5, 2, 1, 1), cfg_JupiterCategories: rangeHere(1, 7, 1000, 3) };
const cfgSs = { getRangeByName: n => here[n] || null };
const u = v => ({ userEnteredValue: v });
const cfgSrc = { properties: { sheetId: 7 }, data: [{ rowData: [
  { values: [{}, {}, {}, {}, {}, {}, u({ stringValue: 'Canvas category' }), u({ stringValue: 'Jupiter?' })] },
  { values: [{}, {}, {}, {}, {}, {}, u({ stringValue: 'Labs' }), u({ boolValue: true }), u({ numberValue: 55 })] },
  { values: [{}, u({ numberValue: 1234 })] },
  { values: [{}, u({ numberValue: 4573 })] },
  { values: [{}, {}] },
  { values: [{}, u({ stringValue: 'old-sheet-id' })] },
] }] };
const named = [
  { name: 'cfg_CourseID', range: { sheetId: 7, startRowIndex: 3, endRowIndex: 4, startColumnIndex: 1, endColumnIndex: 2 } },
  { name: 'cfg_UserID', range: { sheetId: 7, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 1, endColumnIndex: 2 } },
  { name: 'cfg_CcEmail', range: { sheetId: 7, startRowIndex: 4, endRowIndex: 5, startColumnIndex: 1, endColumnIndex: 2 } },
  { name: 'cfg_ThisSheetID', range: { sheetId: 7, startRowIndex: 5, endRowIndex: 6, startColumnIndex: 1, endColumnIndex: 2 } },
  { name: 'cfg_JupiterCategories', range: { sheetId: 7, startColumnIndex: 6, endColumnIndex: 9 } },
];
const cfgResult = c.bringConfigNames_(cfgSs, cfgSrc, named, c.rebuildNewReport_());
check('ref_Config: non-blank named cells only, never this sheet\'s ID',
  Object.keys(written).sort(), ['B3', 'B4', 'G1', 'G2', 'H1', 'H2', 'I2']);
check('ref_Config: course number stays a number, ticks stay ticks', [written.B4, written.H2], [4573, true]);
check('ref_Config: counts, and names missing in either copy', cfgResult,
  { cells: 7, missing: G("BRING_OVER_CONFIG_NAMES").length - 4 });

if (failures) process.exitCode = 1;
