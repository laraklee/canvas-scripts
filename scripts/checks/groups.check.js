/**
 * scripts/checks/groups.check.js
 * Purpose: offline check of the Pull groups helpers in Groups.js (who is in which group,
 *   group names for the dropdown, duplicate names), using MADE-UP IDs and group names only
 *   (never real data; nothing is sent anywhere). Run with the others: npm run check-offline.
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
vm.runInContext(['AssignmentColumn.js', 'CanvasApi.js', 'Config.js', 'Groups.js', 'Jupiter.js']
  .map(file => fs.readFileSync(path.join(PROJECT, file), 'utf8')).join('\n'), context);
const c = context;

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}` +
    (ok ? '' : `\n      expected ${JSON.stringify(expected)}\n      got      ${JSON.stringify(actual)}`));
}

// ---- Who is in which group ----
const groups = [{ id: 11, name: 'Red' }, { id: 12, name: ' Blue ' }, { id: 13, name: 'Green' }];
const members = [[{ id: 101 }, { id: 102 }], [{ id: 103 }], []];
const m = c.groupMembership_(groups, members);
check('each member mapped to their group (IDs as text, names trimmed)',
  [...m.groupOf.entries()], [['101', 'Red'], ['102', 'Red'], ['103', 'Blue']]);
check('dropdown names in Canvas order, including an empty group', m.names,
  ['Red', 'Blue', 'Green']);
check('no duplicates', m.duplicates, []);

const empty = c.groupMembership_(groups, [[], [], []]);
check('no one in a group yet: names still listed', [empty.groupOf.size, empty.names],
  [0, ['Red', 'Blue', 'Green']]);
check('no groups at all', JSON.stringify(c.groupMembership_([], [])),
  JSON.stringify({ groupOf: {}, names: [], duplicates: [] }));

const twice = c.groupMembership_([{ id: 1, name: 'A' }, { id: 2, name: 'A' }, { id: 3, name: 'A' }],
  [[{ id: 5 }], [{ id: 6 }], []]);
check('a repeated name listed once in the dropdown and once as a duplicate',
  [twice.names, twice.duplicates], [['A'], ['A']]);

// ---- Rows written (shared planner from Pull scores) ----
// From row 3: two grouped students, one in no group, a blank row, an Average row.
const userIds = [['101'], [103], ['104'], [''], ['Average']];
const current = [['old'], [''], [''], [''], ['=COUNTA(G3:G5)']];
const plan = c.planScorePull_(userIds, current, m.groupOf, 3);
check('only student rows written; group or blank', plan.writes,
  [{ row: 3, value: 'Red' }, { row: 4, value: 'Blue' }, { row: 5, value: '' }]);
check('counts: filled, in a group, in none', [plan.filled, plan.scored, plan.missing], [1, 2, 1]);

if (failures) {
  console.log(`\n${failures} check(s) failed.`);
  process.exitCode = 1;
}
