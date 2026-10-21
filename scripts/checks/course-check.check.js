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
  'No-school day': 4, 'Outside the term': 3, 'Group not checked for Jupiter': 1 });
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
check('every row has 5 columns', result.rows.every(row => row.length === 5), true);
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
