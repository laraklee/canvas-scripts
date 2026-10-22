/**
 * scripts/checks/menus.check.js
 * Purpose: offline check of the Menus.js helpers (finding the Home tab, running refresh
 *   steps) and that every menu item names a function that exists in the project. Made-up
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
