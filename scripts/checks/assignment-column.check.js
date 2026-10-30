/**
 * scripts/checks/assignment-column.check.js
 * Purpose: offline check of the grading-sheet one-assignment helpers in
 *   AssignmentColumn.js (Pull scores, Post comments), using MADE-UP IDs, scores, and
 *   comments only (never real data; nothing is sent anywhere; Canvas is faked). Run with
 *   the others: npm run check-offline.
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
vm.runInContext(['AssignmentColumn.js', 'CanvasApi.js', 'Config.js', 'Jupiter.js']
  .map(file => fs.readFileSync(path.join(PROJECT, file), 'utf8')).join('\n'), context);
const c = context;

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}` +
    (ok ? '' : `\n      expected ${JSON.stringify(expected)}\n      got      ${JSON.stringify(actual)}`));
}

check('assignment ID row matches the grading sheet label row',
  vm.runInContext('ASSIGNMENT_ID_ROW', context), vm.runInContext('ROSTER_HEADER_ROW', context));

// ---- Pull scores: which cells get written ----
// From row 3: four students (one as a number like Sheets returns), a blank row, an
// Average row, and a student Canvas doesn't list.
const userIds = [['101'], [102], ['103'], ['104'], [''], ['Average'], ['105']];
const current = [[''], [7], ['old'], [''], [''], ['=AVERAGE(G3:G6)'], ['']];
const scores = new Map([['101', 9], ['102', 0], ['103', ''], ['104', 'complete']]);
const plan = c.planScorePull_(userIds, current, scores, 3);
check('only student rows written; blank and Average rows left alone',
  plan.writes.map(w => w.row), [3, 4, 5, 6, 9]);
check('scores: zero kept, ungraded blank, grade text kept, unlisted blank',
  plan.writes.map(w => w.value), [9, 0, '', 'complete', '']);
check('counts: filled student cells, scored, missing', [plan.filled, plan.scored, plan.missing],
  [2, 3, 1]);
check('an empty column asks nothing',
  c.planScorePull_([['101']], [['']], new Map([['101', 5]]), 3).filled, 0);

check('back-to-back rows written together; a gap starts a new write',
  c.scoreRuns_(plan.writes), [
    { row: 3, values: [[9], [0], [''], ['complete']] },
    { row: 9, values: [['']] },
  ]);
check('nothing to write', c.scoreRuns_([]), []);

// ---- The clicked column ----
function fakeSheet(column, rowTwo) {
  const letters = ' ABCDEFGHIJ';
  return {
    getActiveCell: () => ({ getColumn: () => column }),
    getRange: (row, col) => ({
      getA1Notation: () => letters[col] + row,
      getValue: () => (row === 2 ? rowTwo : ''),
    }),
    getLastRow: () => 12,
  };
}
check('reads the ID from row 2 (number from Sheets)', c.readAssignmentColumn_(fakeSheet(8, 5551.0)),
  { column: 8, letter: 'H', assignmentId: '5551', lastRow: 12 });
let thrown = '';
try { c.readAssignmentColumn_(fakeSheet(6, 5551)); } catch (e) { thrown = e.message; }
check('refuses roster / Jupiter ID columns A–F', /G or later/.test(thrown), true);
thrown = '';
try { c.readAssignmentColumn_(fakeSheet(7, 'Lab 3')); } catch (e) { thrown = e.message; }
check('refuses a row 2 that is not an ID', /Row 2 of column G/.test(thrown), true);

// ---- Post comments: which rows post ----
// From row 3 (the third grid is the comment cells' notes): a comment to post; already
// commented (any capitals); no comment; no User ID; a refused earlier try (posts again);
// a dry-run note (posts again).
const cUserIds = [['101'], [102], ['103'], ['104'], [''], ['106'], ['107']];
const cComments = [['  Nice work, see link  '], ['Good'], ['Redo part 2'], [''], ['Orphan'],
  ['Try again'], ['Check units']];
const cNotes = [[''], ['Commented 10/23 8:15 AM'], ['commented'], [''], [''],
  ['Not sent: not found (404)'], ['Dry run (not sent)']];
const cPlan = c.planComments_(cUserIds, cComments, cNotes, 3);
check('posts: trimmed text; skips commented, blank comment, no User ID',
  cPlan.posts, [{ row: 3, userId: '101', text: 'Nice work, see link' },
    { row: 8, userId: '106', text: 'Try again' }, { row: 9, userId: '107', text: 'Check units' }]);
check('already commented counted (any capitals)', cPlan.alreadyCommented, 2);

// ---- Post comments: sending ----
const canvasErr = type => Object.assign(new Error('x'), { canvasType: type });
const posts = [{ row: 3, userId: '1', text: 'a' }, { row: 4, userId: '2', text: 'b' },
  { row: 5, userId: '3', text: 'c' }];
function run(send, options) {
  const recorded = [];
  let error = null;
  let result = null;
  try {
    result = c.sendComments_(posts, send,
      (row, status, refused) => recorded.push(refused ? [row, status, 'red'] : [row, status]),
      Object.assign({ dryRun: false, stamp: '10/23 9:00 AM', started: 0, now: () => 0 }, options));
  } catch (e) { error = e.canvasType || e.message; }
  return { recorded, result, error };
}
const ok = run(() => {});
check('real run: every row Commented with the time', [ok.recorded, ok.result],
  [[[3, 'Commented 10/23 9:00 AM'], [4, 'Commented 10/23 9:00 AM'], [5, 'Commented 10/23 9:00 AM']],
    { sent: 3, refusedRows: [], notStarted: 0 }]);
check('dry run: Status says not sent', run(() => {}, { dryRun: true }).recorded[0],
  [3, 'Dry run (not sent)']);
const one404 = run(post => { if (post.userId === '2') throw canvasErr('NOT_FOUND'); });
check('one student refused: noted and marked red, the others still go',
  [one404.recorded, one404.result.refusedRows],
  [[[3, 'Commented 10/23 9:00 AM'], [4, 'Not sent: not found (404)', 'red'],
    [5, 'Commented 10/23 9:00 AM']], [4]]);
const badToken = run(post => { if (post.userId === '2') throw canvasErr('TOKEN_REJECTED'); });
check('token rejected: stops; rows done so far keep their Status',
  [badToken.error, badToken.recorded], ['TOKEN_REJECTED', [[3, 'Commented 10/23 9:00 AM']]]);
check('unexpected error stops too', run(() => { throw new Error('boom'); }).error, 'boom');
let clock = 0;
const slow = run(() => { clock += 4 * 60 * 1000; }, { now: () => clock });
check('time limit: stops starting new posts', [slow.result.sent, slow.result.notStarted], [2, 1]);
check('refused status text', [c.commentRefusedStatus_('NOT_ALLOWED'),
  c.commentRefusedStatus_('HTTP_400'), c.commentRefusedStatus_('ODD')],
['Not sent: not allowed (403)', 'Not sent: Canvas error (HTTP 400)', 'Not sent: Canvas error']);

// ---- Post comments: which attempt ----
const attempts = c.latestAttempts_([{ user_id: 101, attempt: 3 }, { user_id: 102, attempt: 1 },
  { user_id: 103, attempt: null }, { user_id: 104 }]);
check('latest attempt per student; not-submitted left out',
  [...attempts.entries()], [['101', 3], ['102', 1]]);
check('not a list: no attempts', c.latestAttempts_(null).size, 0);
check('comment goes on the latest attempt', c.commentFields_('Good', attempts.get('101')),
  { text_comment: 'Good', attempt: 3 });
check('no attempt yet: text only', c.commentFields_('Good', attempts.get('103')),
  { text_comment: 'Good' });

// ---- Post comments: row 1 summary note ----
check('summary: real run', c.commentSummary_('10/23 9:00 AM',
  { sent: 15, refusedRows: [7], notStarted: 0 }, 3, false),
'10/23 9:00 AM: 15 posted, 1 refused, 3 already commented');
check('summary: dry run and time limit', c.commentSummary_('10/23 9:00 AM',
  { sent: 2, refusedRows: [], notStarted: 4 }, 0, true),
'10/23 9:00 AM: dry run, 2 not sent, 0 refused, 0 already commented, 4 not started (time limit)');

if (failures) {
  console.log(`\n${failures} check(s) failed.`);
  process.exitCode = 1;
}
