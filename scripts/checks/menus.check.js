/**
 * scripts/checks/menus.check.js
 * Purpose: offline check of the Menus.js helpers (finding the Home tab, running refresh
 *   steps), the Refresh tables panel (RefreshPanel.js: table list, one-table refresh),
 *   and that every menu item names a function that exists in the project. Made-up
 *   data only; nothing is sent anywhere. Run with the others: npm run check-offline.
 *   Repo helper only: not part of any Apps Script project; never clasp-pushed.
 * Canvas endpoints called: none. Canvas write operations: none.
 * Required User/Script Properties: none.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PROJECT = path.join(__dirname, '..', '..', 'course-manager-jupiter');
const menusSource = fs.readFileSync(path.join(PROJECT, 'Menus.js'), 'utf8');
const context = {};
vm.createContext(context);
vm.runInContext(menusSource, context);
const c = context;

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}` +
    (ok ? '' : `\n      expected ${JSON.stringify(expected)}\n      got      ${JSON.stringify(actual)}`));
}

check('Home tab with emoji', c.findHomeSheet_(['ref_Config', '🏠 Home', 'Comments']), '🏠 Home');
check('Home tab without emoji', c.findHomeSheet_(['Home', 'Comments']), 'Home');
check('no Home tab', c.findHomeSheet_(['Homework', 'Comments']), '');

const lines = c.runRefreshSteps_([
  ['A', () => '3 thing(s)'],
  ['B', () => { throw Object.assign(new Error('Sheet B is missing.'), { isSheetProblem: true }); }],
  ['C', () => { throw new Error('secret detail'); }],
  ['D', () => '1 thing(s)'],
]);
check('one line per step; failures do not stop the rest', lines, [
  '✓ A: 3 thing(s)', '✗ B: Sheet B is missing.',
  '✗ C: unexpected error (see Extensions › Apps Script › Executions)', '✓ D: 1 thing(s)']);

const progress = [];
c.runRefreshSteps_([['A', () => '1'], ['B', () => { throw new Error('x'); }], ['C', () => '2']],
  (label, i) => progress.push(`${label} ${i + 1}`));
check('progress callback runs before every step, failures included', progress, ['A 1', 'B 2', 'C 3']);

// Refresh tables panel (RefreshPanel.js): the table list and one-table refresh, with the
// sheet writers swapped for made-up ones.
vm.runInContext(fs.readFileSync(path.join(PROJECT, 'Config.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(PROJECT, 'RefreshPanel.js'), 'utf8'), context);
context.JUPITER_CATEGORY_RANGE = 'cfg_JupiterCategories';
const shown = [];
const fakeSheet = name => ({
  hidden: true,
  isSheetHidden() { return this.hidden; },
  showSheet() { this.hidden = false; shown.push(`show ${name}`); },
  activate() { shown.push(`open ${name}`); },
});
const fakeSheets = { ref_peopleList: fakeSheet('ref_peopleList'), ref_Config: fakeSheet('ref_Config') };
context.SpreadsheetApp = { getActiveSpreadsheet: () => ({
  getSheetByName: name => fakeSheets[name] || null,
  getRangeByName: name => ({ activate: () => shown.push(`select ${name}`) }),
}) };
context.writeCourseListSheet_ = () => 4;
context.writePeopleListSheet_ = () => {
  throw Object.assign(new Error('There is no tab named ref_peopleList.'), { isSheetProblem: true });
};
context.writeJupiterCategories_ = () => ({ categories: 6, kept: 3, dropped: 1 });
let downloads = 0;
context.writeAssignmentGroupsSheet_ = () => {
  downloads++;
  return { assignments: 30, groups: 5, canvasGroups: ['made-up groups'] };
};
context.writeCourseCheck_ = (ss, groups) => ({ total: groups.length, groups });
context.courseCheckCountsText_ = result => `${result.total} possible problem(s)`;
check('panel lists every table, Course check last of All, Jupiter last',
  c.getRefreshTables().map(t => t.key),
  ['courses', 'people', 'assignmentGroups', 'sections', 'sheetIndex', 'courseCheck', 'jupiter']);
check('every table names the tab its link opens',
  c.getRefreshTables().filter(t => !t.tab).map(t => t.key), []);
check('panel refresh: Course check on its own downloads the assignments',
  [c.refreshTableFromPanel('courseCheck'), downloads],
  [{ ok: true, text: '1 possible problem(s)' }, 1]);
downloads = 0;
const shared = {};
const byKey = Object.fromEntries(c.refreshTableList_().map(t => [t.key, t]));
byKey.assignmentGroups.run({}, shared);
byKey.courseCheck.run({}, shared);
check('Refresh all: Course check reuses the assignment groups download', downloads, 1);
check('link: hidden tab is unhidden and opened', [c.showRefreshTableTab('people'), shown],
  ['', ['show ref_peopleList', 'open ref_peopleList']]);
shown.length = 0;
check('link: Jupiter opens ref_Config and selects its table', [c.showRefreshTableTab('jupiter'),
  shown], ['', ['show ref_Config', 'open ref_Config', 'select cfg_JupiterCategories']]);
check('link: missing tab gives a message', c.showRefreshTableTab('courses'),
  'There is no ref_CourseIDs tab yet. Update creates it.');
check('All covers everything except Jupiter categories',
  c.getRefreshTables().filter(t => !t.inAll).map(t => t.key), ['jupiter']);
check('panel refresh: counts on success', c.refreshTableFromPanel('courses'),
  { ok: true, text: '4 course(s)' });
check('panel refresh: sheet problem shown', c.refreshTableFromPanel('people'),
  { ok: false, text: 'There is no tab named ref_peopleList.' });
check('panel refresh: Jupiter counts', c.refreshTableFromPanel('jupiter'), { ok: true,
  text: '6 categor(ies), 3 ticked kept, 1 ticked dropped off. Check the ticks on ref_Config.' });
check('panel refresh: unknown table', c.refreshTableFromPanel('nope'),
  { ok: false, text: 'unknown table' });

// Every menu item's function must exist somewhere in the project (a typo would show
// "Script function not found" in the menu).
const allSource = fs.readdirSync(PROJECT).filter(f => f.endsWith('.js'))
  .map(f => fs.readFileSync(path.join(PROJECT, f), 'utf8')).join('\n');
const named = Array.from(menusSource.matchAll(/addItem\([^)]*?'([A-Za-z0-9_]+)'\)/gs))
  .map(m => m[1]);
const missing = named.filter(name => !new RegExp(`function ${name}\\(`).test(allSource));
check(`all ${named.length} menu functions exist`, missing, []);
check('no function name ends in _ (menus cannot call private functions)',
  named.filter(name => name.endsWith('_')), []);

if (failures) {
  console.log(`\n${failures} check(s) failed.`);
  process.exitCode = 1;
}
