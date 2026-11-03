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
  JSON.stringify({ groupOf: {}, groupIdOf: {}, idByName: {}, names: [], duplicates: [] }));
check('group IDs by member and by name (as text)',
  [[...m.groupIdOf.entries()], [...m.idByName.entries()]],
  [[['101', '11'], ['102', '11'], ['103', '12']], [['Red', '11'], ['Blue', '12'], ['Green', '13']]]);

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

// ---- Put students in groups: which students change ----
// Canvas now: 101 Red, 102 Red, 103 Blue; 104 in none. 999 is in Red but not on the sheet.
const now = c.groupMembership_(groups, [[{ id: 101 }, { id: 102 }, { id: 999 }], [{ id: 103 }], []]);
// From row 3: 101 stays, 102 moves to Green, 103 removed, 104 added, a blank row,
// an Average row, and a cell with extra spaces.
const changes = c.planGroupChanges_(
  [['101'], [102], ['103'], ['104'], [''], ['Average'], ['105']],
  [['Red'], ['Green'], [''], ['Blue'], ['Red'], ['3'], ['  Green ']], now, 3);
check('only differences change; 999 (not on sheet) never listed', changes.changes, [
  { row: 4, userId: '102', from: '11', to: '13' },
  { row: 5, userId: '103', from: '12', to: '' },
  { row: 6, userId: '104', from: '', to: '12' },
  { row: 9, userId: '105', from: '', to: '13' },
]);
check('counts and affected groups (each once)',
  [changes.adds, changes.moves, changes.removes, changes.groupNames],
  [2, 1, 1, ['Red', 'Green', 'Blue']]);
check('summary line', c.groupChangeCounts_(changes), '2 to add, 1 to move, 1 to remove');
check('summary line leaves out kinds with none',
  c.groupChangeCounts_({ adds: 0, moves: 3, removes: 0 }), '3 to move');

const typo = c.planGroupChanges_([['101'], ['102'], ['103']], [['Red'], ['Grene'], ['red']], now, 3);
check('names not in the set are reported by row (exact match)', typo.unknownRows, [4, 5]);
check('already matching: nothing to change',
  c.planGroupChanges_([['101'], ['103']], [['Red'], ['Blue']], now, 3).changes, []);

// ---- Put students in groups: sending ----
const sendRun = (send, options) => {
  const records = [];
  try {
    const result = c.sendGroupChanges_(changes.changes, send,
      (row, refused) => records.push([row, refused]), Object.assign({ started: 0, now: () => 0 }, options));
    return { result, records };
  } catch (error) {
    return { error: error.message, records };
  }
};
const ok = sendRun(() => {});
check('all sent and recorded', [ok.result, ok.records],
  [{ done: 4, refusedRows: [], notStarted: 0 }, [[4, ''], [5, ''], [6, ''], [9, '']]]);
const refused = sendRun(change => {
  if (change.userId === '103') throw Object.assign(new Error('x'), { canvasType: 'NOT_ALLOWED' });
});
check('one refusal recorded; the rest still go', [refused.result.done, refused.result.refusedRows,
  refused.records.slice(1, 2)], [3, [5], [[5, 'NOT_ALLOWED']]]);
const stopAll = vm.runInContext('CANVAS_STOP_ALL_TYPES', context).slice(0, 1)[0];
check('token/network-type errors stop the run', sendRun(() => {
  throw Object.assign(new Error('stop'), { canvasType: stopAll });
}).error, 'stop');
check('unexpected errors stop the run', sendRun(() => { throw new Error('boom'); }).error, 'boom');
let clock = 0;
const slow = sendRun(() => { clock += 3 * 60 * 1000; }, { now: () => clock });
check('time limit: stops starting new changes', [slow.result.done, slow.result.notStarted], [2, 2]);

// ---- List groups and members (made-up names) ----
const list = c.groupListRows_(
  [{ id: 22, name: 'Group 10' }, { id: 21, name: 'Group 2' }, { id: 23, name: 'Empty' }],
  [[{ name: 'Zed Ant', sortable_name: 'Ant, Zed' }],
    [{ name: 'Bo Cat', sortable_name: 'Cat, Bo' }, { name: 'Al Bee', sortable_name: 'Bee, Al' }],
    []],
  [{ name: 'Cy Dog', sortable_name: 'Dog, Cy' }]);
check('group list: groups by name (2 before 10), members by last name, then no-group block',
  JSON.parse(JSON.stringify(list.rows)), [
    ['Empty', '0 members', 'Group ID 23'], ['', '', ''],
    ['Group 2', '2 members', 'Group ID 21'], ['', 'Al Bee', ''], ['', 'Bo Cat', ''], ['', '', ''],
    ['Group 10', '1 member', 'Group ID 22'], ['', 'Zed Ant', ''], ['', '', ''],
    ['Not in any group', '1 student', ''], ['', 'Cy Dog', ''],
  ]);
check('group list: header rows marked for color',
  JSON.parse(JSON.stringify(list.blocks)), [{ index: 0, kind: 'group' },
    { index: 2, kind: 'group' }, { index: 6, kind: 'group' }, { index: 9, kind: 'none' }]);
check('group list: counts', [list.groupCount, list.placed, list.unassigned], [3, 3, 1]);
const noGroups = c.groupListRows_([], [], []);
check('group list: no groups, no one left out', JSON.parse(JSON.stringify(noGroups.rows)),
  [['Not in any group', '0 students', '']]);
check('group set list: sorted by name, IDs as text, missing count blank',
  JSON.parse(JSON.stringify(c.groupSetRows_([{ id: 9.0, name: 'Lab 2', groups_count: 6 },
    { id: 8, name: 'Lab 1' }]))), [['Lab 1', '8', ''], ['Lab 2', '9', 6]]);

if (failures) {
  console.log(`\n${failures} check(s) failed.`);
  process.exitCode = 1;
}
