/**
 * scripts/checks/course-check.check.js
 * Purpose: offline check of the Course check logic in CourseCheck.js, using a MADE-UP
 *   schedule, assignment groups, and assignments only (no real course data; nothing is
 *   sent anywhere). Run with the others: npm run check-offline.
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
vm.runInContext(fs.readFileSync(path.join(PROJECT, 'Config.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(PROJECT, 'CourseCheck.js'), 'utf8'), context);
const c = context;

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}` +
    (ok ? '' : `\n      expected ${JSON.stringify(expected)}\n      got      ${JSON.stringify(actual)}`));
}
function throwsLike(label, fn, pattern) {
  let message = '';
  try { fn(); } catch (e) { message = e.message; }
  check(label, pattern.test(message), true);
}

// ---- Quarters setting ----
check('quarters: 2', c.parseQuarters_('2'), ['2']);
check('quarters: number 2 from the cell', c.parseQuarters_(2), ['2']);
check('quarters: 1-2', c.parseQuarters_('1-2'), ['1', '2']);
check('quarters: Q1-Q4', c.parseQuarters_('Q1-Q4'), ['1', '2', '3', '4']);
check('quarters: 1, 3', c.parseQuarters_('1, 3'), ['1', '3']);
throwsLike('quarters: words refused', () => c.parseQuarters_('fall'), /quarter numbers/);

// ---- Made-up schedule (weekdays only, like ref_simpleSchedule; fall break missing) ----
const schedule = [
  { day: '2026-10-09', quarter: '1', code: 'CH' },
  { day: '2026-10-19', quarter: '2', code: 'PSAT' },
  { day: '2026-10-20', quarter: '2', code: 'Er' },
  { day: '2026-11-11', quarter: '2', code: 'H' },
  { day: '2026-11-12', quarter: '2', code: 'A' },
  { day: '2026-12-18', quarter: '2', code: 'EX2' },
  { day: '2027-01-11', quarter: '3', code: 'E' },
  { day: '2027-02-12', quarter: '3', code: 'PD' },
  { day: '2027-06-05', quarter: '', code: 'GRAD' },
];
const term = c.termFromSchedule_(['2'], schedule, '2');
check('term from quarter 2', [term.start, term.end, term.note],
  ['2026-10-19', '2026-12-18', 'Term: Q2, 10/19/26 – 12/18/26 (cfg_TermQuarters and ref_simpleSchedule).']);
check('semester 1-2 spans both quarters', [c.termFromSchedule_(['1', '2'], schedule, '1-2').start,
  c.termFromSchedule_(['1', '2'], schedule, '1-2').end], ['2026-10-09', '2026-12-18']);
throwsLike('quarter not in the schedule stops', () => c.termFromSchedule_(['5'], schedule, '5'),
  /no days for quarter/);

const byDay = new Map(schedule.map(entry => [entry.day, entry]));
check('no-school reasons', ['2026-10-24', '2026-10-14', '2026-11-11', '2027-02-12', '2026-10-19',
  '2026-12-18'].map(day => c.noSchoolReason_(day, byDay)),
['weekend', 'not in the schedule (break?)', 'Schedule H', 'Schedule PD', '', '']);

// ---- Made-up course ----
const a = (id, name, due, extra = {}) => Object.assign({ id, name, due_at: due, published: true,
  points_possible: 10, html_url: `https://canvas.example.test/a/${id}` }, extra);
const groups = [
  { id: 1, name: 'Homework', assignments: [
    a(1, 'HW 1', '2026-10-20T23:59'),
    a(2, 'HW 2', '2026-10-24T23:59'), // Saturday
    a(3, 'HW 3', null, { published: false }),
    a(4, 'HW old', '2026-10-14T23:59'), // fall break, and last quarter
    a(5, 'HW 5', null, { all_dates: [{ due_at: '2026-11-11T23:59' }, { due_at: '2026-11-12T23:59' }] }),
  ] },
  { id: 2, name: 'Labs', assignments: [a(6, 'Lab 1', '2026-11-12T23:59', { points_possible: 20 }),
    a(7, 'Lab 2', '2026-11-12T23:59', { points_possible: 0 })] },
  { id: 3, name: 'Practice', assignments: [a(8, 'Practice 1', '2026-11-12T23:59', { points_possible: 0 })] },
  { id: 4, name: 'Tests', assignments: [a(9, 'Test 1', '2027-02-12T08:00'),
    a(10, 'Test far', '2027-08-01T08:00')] },
];
const allowed = { ids: new Set(['1']), names: new Set(['tests']) };
const dayOf = iso => iso.slice(0, 10);
const showDue = iso => iso.replace('T', ' ');
const result = c.buildCourseCheck_(groups, schedule, term, allowed, dayOf, showDue);
check('counts per check', result.counts, { 'Missing due date': 1, Unpublished: 1,
  'No-school day': 4, 'Outside the term': 3, 'Big item on SAC review day': 0,
  'After No Homework Weekend': 0, 'Group not checked for Jupiter': 1 });
check('total', result.total, 10);
check('rows: Info first, then each check in order (assignment, group, due)',
  result.rows.map(row => row.slice(0, 4)), [
    ['Info', term.note, '', ''],
    ['Missing due date', 'HW 3', 'Homework', ''],
    ['Unpublished', 'HW 3', 'Homework', ''],
    ['No-school day: weekend', 'HW 2', 'Homework', '2026-10-24 23:59'],
    ['No-school day: not in the schedule (break?)', 'HW old', 'Homework', '2026-10-14 23:59'],
    ['No-school day: Schedule H', 'HW 5', 'Homework', '2026-11-11 23:59'],
    ['No-school day: Schedule PD', 'Test 1', 'Tests', '2027-02-12 08:00'],
    ['Outside the term', 'HW old', 'Homework', '2026-10-14 23:59'],
    ['Outside the term', 'Test 1', 'Tests', '2027-02-12 08:00'],
    ['Outside the term', 'Test far', 'Tests', '2027-08-01 08:00'],
    ['Group not checked for Jupiter', '1 assignment(s) worth points', 'Labs', ''],
  ]);
check('link column filled for assignments', result.rows[1][4], 'https://canvas.example.test/a/3');
check('every row has 7 columns', result.rows.every(row => row.length === 7), true);
check('problem rows unticked with a key; Info rows have neither',
  [result.rows[0].slice(5), result.rows[3].slice(5), result.rows[10].slice(5)],
  [['', ''], [false, 'No-school day: weekend|2|2026-10-24T23:59'],
    [false, 'Group not checked for Jupiter|group:2']]);

// ---- OK as is ----
const okKeys = new Set(['No-school day: weekend|2|2026-10-24T23:59',
  'Group not checked for Jupiter|group:2', 'Unpublished|999|']); // the last one is stale
const okRun = c.buildCourseCheck_(groups, schedule, term, allowed, dayOf, showDue, okKeys);
check('ticked problems leave the counts; stale ticks ignored',
  [okRun.total, okRun.okCount, okRun.counts['No-school day'], okRun.counts['Group not checked for Jupiter']],
  [8, 2, 3, 0]);
check('ticked rows last, still ticked, in check order',
  okRun.rows.slice(-2).map(row => [row[0], row[1], row[5]]),
  [['No-school day: weekend', 'HW 2', true], ['Group not checked for Jupiter', '1 assignment(s) worth points', true]]);
check('open rows come before them, unticked', okRun.rows.slice(1, -2).every(row => row[5] === false), true);
check('counts text mentions OK as is', c.courseCheckCountsText_(okRun).startsWith(
  '8 possible problem(s) (2 marked OK as is): '), true);
const moved = groups.map(g => Object.assign({}, g, { assignments: g.assignments.map(x =>
  (x.id === 2 ? Object.assign({}, x, { due_at: '2026-10-25T23:59' }) : x)) }));
const movedRun = c.buildCourseCheck_(moved, schedule, term, allowed, dayOf, showDue, okKeys);
check('a changed due date shows again', movedRun.rows.some(row => row[1] === 'HW 2' && row[5] === false), true);
check('all ticked: no problems found, with the OK count', c.courseCheckCountsText_({ total: 0, okCount: 3,
  counts: {} }), 'No problems found (3 marked OK as is).');

// Reading ticks from the tab, and accepting the first version's tab.
const tab = rows => ({ getLastRow: () => rows.length + 1,
  getRange: () => ({ getValues: () => rows }) });
check('reads ticked keys only', [...c.readOkKeys_(tab([[true, 'k1'], [false, 'k2'], [true, ''], ['', '']]))],
  ['k1']);
let layoutChecked = false;
c.checkHeaderLayout_ = () => { layoutChecked = true; };
const headerTab = header => ({ getRange: () => ({ getValues: () => [header] }) });
c.checkCourseCheckLayout_(headerTab(['Check', 'Assignment', 'Group', 'Due', 'Link', '', '']));
check('first-version tab (5 columns) accepted as is', layoutChecked, false);
c.checkCourseCheckLayout_(headerTab(['Name', '', '', '', '', '', '']));
check('anything else goes to the usual header check', layoutChecked, true);
check('counts text', c.courseCheckCountsText_(result), '10 possible problem(s): Missing due ' +
  'date 1, Unpublished 1, No-school day 4, Outside the term 3, Group not checked for Jupiter 1.');

// No Jupiter categories checked (e.g. AI9) and no term: those checks are skipped, said so.
const quiet = c.buildCourseCheck_([{ id: 2, name: 'Labs', assignments: [a(1, 'Lab', '2026-10-20T23:59')] }],
  schedule, { note: 'Term check skipped.' }, null, dayOf, showDue);
check('skipped checks: Info rows explain, no problems',
  [quiet.total, quiet.rows.map(row => row.slice(0, 2))],
  [0, [['Info', 'Term check skipped.'], ['Info', 'Jupiter check skipped: no categories are ' +
    'checked in cfg_JupiterCategories.'], ['Info', 'No problems found.']]]);
check('counts text with no problems', c.courseCheckCountsText_(quiet), 'No problems found.');

// ---- SAC review day and No Homework Weekend (made-up notes in column G) ----
const notedSchedule = [
  { day: '2026-11-23', quarter: '2', code: 'D', note: '' },
  { day: '2026-11-24', quarter: '2', code: 'Er', note: 'No Chapel\nNo Homework Weekend' },
  { day: '2026-11-25', quarter: '2', code: 'F1r', note: 'no homework weekend' },
  { day: '2026-11-26', quarter: '2', code: 'H', note: 'Thanksgiving' },
  { day: '2026-11-27', quarter: '2', code: 'H', note: 'Black Friday' },
  { day: '2026-11-30', quarter: '2', code: 'A', note: '' },
  { day: '2026-12-01', quarter: '2', code: 'B', note: '' },
  { day: '2026-12-15', quarter: '2', code: 'Fr', note: 'SAC Review Day' },
  { day: '2027-02-11', quarter: '3', code: 'F1', note: 'MQ3\nNo Homework Weekend' },
  { day: '2027-02-12', quarter: '3', code: 'PD', note: 'No US Classes' },
  { day: '2027-02-15', quarter: '3', code: 'H', note: "President's Day" },
  { day: '2027-02-16', quarter: '3', code: 'A', note: '' },
];
check('first school day after each No Homework Weekend (skips holidays, PD, weekends)',
  [...c.daysAfterNoHomework_(notedSchedule)], ['2026-11-30', '2027-02-16']);
const notedRun = c.buildCourseCheck_([{ id: 5, name: 'Units', assignments: [
  a(21, 'HW after break', '2026-11-30T08:00', { points_possible: 5 }),
  a(22, 'Unit test', '2026-12-15T08:00', { points_possible: 50 }),
  a(23, 'Small quiz', '2026-12-15T08:00', { points_possible: 20 }),
  a(24, 'Lab', '2026-12-01T08:00'),
  a(25, 'HW after Presidents Day', '2027-02-16T23:59', { points_possible: 0 }),
] }], notedSchedule, { note: 'Term check skipped.' }, null, dayOf, showDue);
check('SAC: 50+ points only; No Homework Weekend: anything',
  notedRun.rows.filter(row => row[0] !== 'Info').map(row => [row[0], row[1]]), [
    ['Big item on SAC review day', 'Unit test'],
    ['After No Homework Weekend', 'HW after break'],
    ['After No Homework Weekend', 'HW after Presidents Day'],
  ]);

// Blank cfg_TermQuarters: falls back to the Canvas term dates.
c.getCourseIdForRefresh_ = () => '123';
c.canvasStep_ = (label, request) => request();
c.canvasGet_ = () => ({ start_at: null, term: { start_at: '2026-08-10T10:00:00Z',
  end_at: '2026-12-31T10:00:00Z' } });
const ss = { getRangeByName: () => ({ getValue: () => '' }) };
const canvasTerm = c.findTerm_(ss, schedule, dayOf);
check('blank setting: Canvas term dates', [canvasTerm.start, canvasTerm.end],
  ['2026-08-10', '2026-12-31']);
c.canvasGet_ = () => ({ term: {} });
check('no dates anywhere: term check skipped', /skipped/.test(c.findTerm_(ss, schedule, dayOf).note), true);
const set = { getRangeByName: () => ({ getValue: () => 2 }) };
check('setting wins over Canvas', c.findTerm_(set, schedule, dayOf).start, '2026-10-19');

if (failures) {
  console.log(`\n${failures} check(s) failed.`);
  process.exitCode = 1;
}
