/**
 * scripts/checks/reorder-and-api.check.js
 * Purpose: offline check of the reorder tool (planReorder_, numberByGroup_, sendReorder_
 *   with a pretend Canvas) and canvasApiPath_, using made-up assignments only (no real
 *   data; nothing is sent anywhere). Run with the others: npm run check-offline.
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
// CanvasApi.js first, for shared constants (CANVAS_STOP_ALL_TYPES) and canvasApiPath_.
vm.runInContext(fs.readFileSync(path.join(PROJECT, 'CanvasApi.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(PROJECT, 'ReorderTool.js'), 'utf8') +
  '\nthis.planReorder_ = planReorder_; this.numberByGroup_ = numberByGroup_;' +
  '\nthis.sendReorder_ = sendReorder_;', context);
const plan = context.planReorder_;
const numberByGroup = context.numberByGroup_;

// Build a group: ids like "A1".."A10", with the given Canvas positions.
function group(prefix, groupId, positions) {
  return positions.map((position, i) => ({
    assignmentId: `${prefix}${i + 1}`, name: `${prefix}${i + 1}`,
    groupId, groupName: `Group ${prefix}`, position,
  }));
}
// Apply moves the way Canvas does for one assignment: take it out, insert at position.
function applyMoves(order, moves) {
  const list = order.slice();
  moves.forEach(({ assignmentId, position }) => {
    list.splice(list.indexOf(assignmentId), 1);
    list.splice(position - 1, 0, assignmentId);
  });
  return list;
}
const range = (n, from = 1) => Array.from({ length: n }, (_, i) => i + from);
let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}` +
    (ok ? '' : `\n      expected ${JSON.stringify(expected)}\n      got      ${JSON.stringify(actual)}`));
}

// 1. Lara's test: rows near the bottom of a 65-assignment group typed 1-5.
{
  const ref = group('A', 'g1', range(65));
  const typed = [61, 62, 63, 64, 65].map((n, i) => ({ assignmentId: `A${n}`, newPosition: i + 1 }));
  const result = plan(typed, ref);
  const c = result.changes[0];
  const order = ref.map(r => r.assignmentId);
  const after = applyMoves(order, c.moves);
  check('1-5 typed: exactly those five at the top, rest shifted down in order',
    after.slice(0, 7), ['A61', 'A62', 'A63', 'A64', 'A65', 'A1', 'A2']);
  check('1-5 typed: the whole group ends in the expected order',
    after, ['A61', 'A62', 'A63', 'A64', 'A65', ...range(60).map(n => `A${n}`)]);
  check('1-5 typed: 5 moves, not a full renumber', [c.moves.length, c.renumberAll], [5, false]);
  check('1-5 typed: Preview shows 10 lines and the rest as "more"',
    [c.newOrder.length, c.newOrder[0], c.hiddenLines], [10, '1. A61', 55]);
}

// 2. Move one to 2.
{
  const ref = group('B', 'g2', range(5));
  const result = plan([{ assignmentId: 'B4', newPosition: 2 }], ref);
  const c = result.changes[0];
  check('move B4 to 2: order', applyMoves(ref.map(r => r.assignmentId), c.moves),
    ['B1', 'B4', 'B2', 'B3', 'B5']);
  check('move B4 to 2: 1 move', c.moves.length, 1);
}

// 3. Renumber a whole group of 4 as C, A, D, B (the legacy way).
{
  const ref = group('C', 'g3', range(4));
  const typed = [['C3', 1], ['C1', 2], ['C4', 3], ['C2', 4]]
    .map(([assignmentId, newPosition]) => ({ assignmentId, newPosition }));
  const c = plan(typed, ref).changes[0];
  check('full renumber: order', applyMoves(ref.map(r => r.assignmentId), c.moves),
    ['C3', 'C1', 'C4', 'C2']);
  check('full renumber: only 2 moves needed', c.moves.length, 2);
}

// 4. Messy numbering (two 1s), one assignment moved to the top.
{
  const ref = group('D', 'g4', [1, 1, 2, 3]);
  const c = plan([{ assignmentId: 'D4', newPosition: 1 }], ref).changes[0];
  check('messy group: renumbers all 4, 1-4 in the new order',
    c.moves, [['D4', 1], ['D1', 2], ['D2', 3], ['D3', 4]]
      .map(([assignmentId, position]) => ({ assignmentId, position })));
  check('messy group: flagged for Preview', c.renumberAll, true);
}

// 5. Messy group with nothing typed is left alone; typed numbers that keep the order too.
{
  const ref = [...group('E', 'g5', [1, 1, 2]), ...group('F', 'g6', range(3))];
  const typed = [{ assignmentId: 'F1', newPosition: 1 }, { assignmentId: 'F2', newPosition: 2 }];
  const result = plan(typed, ref);
  check('untouched messy group and same-order group: no changes, 2 unchanged',
    [result.changes.length, result.unchangedGroups], [0, 2]);
}

// 6. Problems: duplicate typed number, too large, not a whole number, stray ID.
{
  const ref = [...group('G', 'g7', range(3)), ...group('H', 'g8', range(3)),
    ...group('J', 'g9', range(3))];
  const typed = [
    { assignmentId: 'G1', newPosition: 2 }, { assignmentId: 'G3', newPosition: 2 },
    { assignmentId: 'H1', newPosition: 4 },
    { assignmentId: 'J1', newPosition: 1.5 },
    { assignmentId: 'X99', newPosition: 1 },
  ];
  const result = plan(typed, ref);
  check('problems: 4 listed, nothing would change',
    [result.problems.length, result.changes.length], [4, 0]);
  check('problems: reasons', result.problems.map(p => `${p.groupName}: ${p.reason}`), [
    'Group J: New Position must be a whole number, 1 or more',
    '(no group): 1 row(s) with a New Position are not in the latest Canvas list. Run Open reorder tool again.',
    'Group G: two rows have the same New Position',
    "Group H: a New Position is larger than the group's 3 assignment(s)",
  ]);
}

// 7. Lara's habit: whole sheet sorted by due date (groups mixed), every row numbered.
{
  // Three groups; Canvas order is by id. Two groups have messy numbering.
  const ref = [...group('K', 'gk', range(4)), ...group('L', 'gl', [1, 1, 2]),
    ...group('M', 'gm', [1, 2, 2, 5])];
  // Sheet order after sorting by due date, newest first (made up), with one hidden row.
  const sheetOrder = ['K4', 'L2', 'M4', 'K1', 'M1', 'L3', 'K3', 'M3', 'L1', 'K2', 'M2'];
  const rows = sheetOrder.map(assignmentId => ({ assignmentId, skip: false }));
  numberByGroup(rows, new Map(ref.map(r => [r.assignmentId, r.groupId])));
  check('per-group numbering: each group counts 1, 2, 3… down the sheet',
    rows.map(r => `${r.assignmentId}=${r.number}`),
    ['K4=1', 'L2=1', 'M4=1', 'K1=2', 'M1=2', 'L3=2', 'K3=3', 'M3=3', 'L1=3', 'K2=4', 'M2=4']);

  const result = plan(rows.map(r => ({ assignmentId: r.assignmentId, newPosition: r.number })), ref);
  const orderOf = groupId => {
    const c = result.changes.find(change => change.groupId === groupId);
    return applyMoves(ref.filter(r => r.groupId === groupId).map(r => r.assignmentId), c.moves);
  };
  check('due-date habit: group K in due-date order', orderOf('gk'), ['K4', 'K1', 'K3', 'K2']);
  check('due-date habit: group L in due-date order', orderOf('gl'), ['L2', 'L3', 'L1']);
  check('due-date habit: group M in due-date order', orderOf('gm'), ['M4', 'M1', 'M3', 'M2']);
  check('due-date habit: messy groups L and M fully renumbered, K minimal',
    result.changes.map(c => `${c.groupId}:${c.renumberAll}`), ['gk:false', 'gl:true', 'gm:true']);
  check('due-date habit: no problems', result.problems.length, 0);
}

// 8. Hidden (filtered) rows and unknown IDs are skipped by numbering.
{
  const ref = group('N', 'gn', range(3));
  const rows = [{ assignmentId: 'N3', skip: false }, { assignmentId: 'N1', skip: true },
    { assignmentId: 'Z9', skip: false }, { assignmentId: 'N2', skip: false }];
  numberByGroup(rows, new Map(ref.map(r => [r.assignmentId, r.groupId])));
  check('hidden and unknown rows get no number; others count 1, 2',
    rows.map(r => r.number ?? '-'), [1, '-', '-', 2]);
}

// 9. Tidy up: messy group fully numbered in its current order is renumbered 1…N.
{
  const ref = group('P', 'gp', [1, 1, 3]);
  const typed = ['P1', 'P2', 'P3'].map((assignmentId, i) => ({ assignmentId, newPosition: i + 1 }));
  const c = plan(typed, ref).changes[0];
  check('tidy: all 3 renumbered 1-3, order unchanged, no order lines',
    [c.moves.map(m => `${m.assignmentId}=${m.position}`), c.renumberAll, c.newOrder.length],
    [['P1=1', 'P2=2', 'P3=3'], true, 0]);
}

// 10. Push sending, with a pretend Canvas (nothing is contacted).
{
  const makeError = (type, message) => Object.assign(new Error(message), { canvasType: type });
  const plan2 = {
    changes: [
      { groupId: 'g1', moves: [{ assignmentId: '11', position: 1 }, { assignmentId: '12', position: 2 }] },
      { groupId: 'g2', moves: [{ assignmentId: '21', position: 1 }, { assignmentId: '22', position: 2 }] },
      { groupId: 'g3', moves: [{ assignmentId: '31', position: 1 }] },
    ],
  };
  const calls = [];
  // Canvas refuses assignment 21 (e.g. closed grading period).
  context.canvasWrite_ = (method, path, payload) => {
    calls.push(`${method} ${path} ${JSON.stringify(payload)}`);
    if (path.endsWith('/21')) throw makeError('NOT_ALLOWED', 'Not allowed (403).');
    return {};
  };
  const result = context.sendReorder_('999', plan2, Date.now());
  check('push: sends only assignment[position], one call per move, group by group', calls, [
    'PUT /courses/999/assignments/11 {"assignment":{"position":1}}',
    'PUT /courses/999/assignments/12 {"assignment":{"position":2}}',
    'PUT /courses/999/assignments/21 {"assignment":{"position":1}}',
    'PUT /courses/999/assignments/31 {"assignment":{"position":1}}',
  ]);
  check('push: a refused move stops only that group; counts are right',
    [result.count, result.refusedCount, Array.from(result.refused.entries())],
    [3, 1, [['Not allowed (403).', 1]]]);

  // A rejected token stops the whole Push.
  context.canvasWrite_ = () => { throw makeError('TOKEN_REJECTED', 'Token rejected (401).'); };
  let stopped = false;
  try { context.sendReorder_('999', plan2, Date.now()); } catch (error) { stopped = error.canvasType === 'TOKEN_REJECTED'; }
  check('push: a rejected token stops everything', stopped, true);

  // Near the time limit: no moves are sent, all groups reported as not started.
  calls.length = 0;
  context.canvasWrite_ = (method, path) => { calls.push(path); return {}; };
  const late = context.sendReorder_('999', plan2, Date.now() - 6 * 60 * 1000);
  check('push: past the time limit nothing is sent and it says so',
    [calls.length, late.timedOut, late.groupsNotStarted], [0, true, 2]);
}

// 11. API paths: v1 paths get /api/v1; New Quizzes paths are kept as-is.
check('api path: /courses/1/assignments -> /api/v1/courses/1/assignments',
  context.canvasApiPath_('/courses/1/assignments'), '/api/v1/courses/1/assignments');
check('api path: no leading slash still works',
  context.canvasApiPath_('courses/1'), '/api/v1/courses/1');
check('api path: New Quizzes path kept as-is',
  context.canvasApiPath_('/api/quiz/v1/courses/1/quizzes'), '/api/quiz/v1/courses/1/quizzes');

// Preview mode message on open (showPreviewModeToast_): unset or "true" is ON; only
// exactly "false" is OFF, with the warning title and a longer message.
const toasts = [];
const fakeSs = { toast: (message, title, seconds) => toasts.push([title, seconds]) };
[null, 'true', 'false'].forEach(value => {
  context.PropertiesService = { getScriptProperties: () => ({ getProperty: () => value }) };
  context.showPreviewModeToast_(fakeSs);
});
check('preview mode message on open: unset and "true" are ON, "false" is OFF', toasts, [
  ['Preview mode is ON', 5], ['Preview mode is ON', 5], ['⚠ Preview mode is OFF', 10]]);

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.');
process.exitCode = failures ? 1 : 0;
