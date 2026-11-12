/**
 * scripts/checks/setup-panel.check.js
 * Purpose: offline check of the Setup panel's server side (SetupPanel.js) and its token
 *   save (saveCanvasCredentialsFromPanel, Credentials.js): blank boxes keep what's saved,
 *   bad input saves nothing, and the token never comes back in a status or a message.
 *   Made-up data and a fake token only; nothing is sent anywhere. Run with the others:
 *   npm run check-offline. Repo helper only: never clasp-pushed.
 * Canvas endpoints called: none. Canvas write operations: none.
 * Required User/Script Properties: none (fake property stores).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PROJECT = path.join(__dirname, '..', '..', 'course-manager-jupiter');
const context = { console: { log() {}, error() {} } };
vm.createContext(context);
['Config.js', 'Credentials.js', 'SetupPanel.js'].forEach(file =>
  vm.runInContext(fs.readFileSync(path.join(PROJECT, file), 'utf8'), context));
const c = context;

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}` +
    (ok ? '' : `\n      expected ${JSON.stringify(expected)}\n      got      ${JSON.stringify(actual)}`));
}

const FAKE_TOKEN = 'fake~token~for~offline~check';
function store(initial) {
  const data = Object.assign({}, initial);
  return { data, getProperty: k => (k in data ? data[k] : null),
    setProperty: (k, v) => { data[k] = v; } };
}
let user = store({});
let script = store({});
c.PropertiesService = { getUserProperties: () => user, getScriptProperties: () => script };
c.PROP_DRY_RUN = 'DRY_RUN';
c.isDryRun_ = () => String(script.getProperty('DRY_RUN')).trim().toLowerCase() !== 'false';
c.getCourseIdForRefresh_ = () => '12345';
c.getCfg_ = name => { if (name === 'CourseName') return 'Biology (P3)'; throw new Error('x'); };
c.findSetupProblems_ = () => ({ missingSheets: [], missingRanges: ['cfg_TermQuarters'], count: 1 });
c.describeCanvasError_ = error => error.canvasType ? error.message : 'Unexpected error.';
let canvasAnswer = null;
c.canvasGet_ = () => {
  if (canvasAnswer instanceof Error) throw canvasAnswer;
  return canvasAnswer;
};
const canvasError = (type, message) => Object.assign(new Error(message), { canvasType: type });

// Saving the token from the panel.
let answer = c.saveCanvasCredentialsFromPanel({ baseUrl: '', token: FAKE_TOKEN });
check('no address saved and none typed: nothing saved', [answer.ok, user.data], [false, {}]);
answer = c.saveCanvasCredentialsFromPanel({ baseUrl: 'canvas.example.edu/courses/1', token: '' });
check('no token saved and none typed: nothing saved', [answer.ok, user.data], [false, {}]);
answer = c.saveCanvasCredentialsFromPanel({ baseUrl: 'not a web address', token: FAKE_TOKEN });
check('bad address: nothing saved, message does not repeat input',
  [answer.ok, user.data, answer.message.includes('not a web address')], [false, {}, false]);
answer = c.saveCanvasCredentialsFromPanel({ baseUrl: 'x.example.edu', token: 'two words' });
check('token with a space: nothing saved', [answer.ok, user.data], [false, {}]);
answer = c.saveCanvasCredentialsFromPanel({ baseUrl: 'https://canvas.example.edu/courses/1',
  token: ` ${FAKE_TOKEN} ` });
const savedAt = user.data.CANVAS_TOKEN_SAVED;
delete user.data.CANVAS_TOKEN_SAVED;
check('good save: address trimmed to the site, token stored trimmed', [answer.ok, user.data],
  [true, { CANVAS_BASE_URL: 'https://canvas.example.edu', CANVAS_TOKEN: FAKE_TOKEN }]);
check('good save: records when the token was saved',
  /^\d{4}-\d\d-\d\dT/.test(savedAt || ''), true);
user.data.CANVAS_TOKEN_SAVED = '2026-11-11T20:00:00.000Z';
check('save message never contains the token', answer.message.includes(FAKE_TOKEN), false);
answer = c.saveCanvasCredentialsFromPanel({ baseUrl: '', token: '' });
check('both boxes blank: keeps what is saved', [answer.ok, user.data.CANVAS_TOKEN,
  answer.message.includes('unchanged')], [true, FAKE_TOKEN, true]);

// Status sent to the panel.
c.Utilities = { formatDate: (date, zone, pattern) =>
  `${date.getUTCMonth() + 1}/${date.getUTCDate()}/${date.getUTCFullYear()} (${zone}, ${pattern})` };
c.SpreadsheetApp = { getActiveSpreadsheet: () => ({ getSpreadsheetTimeZone: () => 'UTC',
  getSheetByName: () => null }) };
const status = c.getSetupStatus();
check('status never includes the whole token',
  [status.hasToken, JSON.stringify(status).includes(FAKE_TOKEN), 'token' in status],
  [true, false, false]);
check('status: last 4 characters and the date it was saved',
  [status.tokenHint, status.tokenSavedOn], [FAKE_TOKEN.slice(-4), '11/11/2026 (UTC, M/d/yyyy)']);
const longToken = user.data.CANVAS_TOKEN;
user.data.CANVAS_TOKEN = 'short~token';
check('a token under 20 characters gets no hint', c.getSetupStatus().tokenHint, '');
user.data.CANVAS_TOKEN = longToken;
delete user.data.CANVAS_TOKEN_SAVED;
check('a token saved before dates were kept: hint, no date',
  [c.getSetupStatus().tokenHint.length, c.getSetupStatus().tokenSavedOn], [4, '']);
check('status: address, course, dry run (unset = ON), setup problems',
  [status.baseUrl, status.courseId, status.courseName, status.dryRun, status.setupProblems.count],
  ['https://canvas.example.edu', '12345', 'Biology (P3)', true, 1]);

// Test connection and Check course.
canvasAnswer = { id: 1 };
check('test connection: connected', c.testSetupConnection(), { ok: true, message: 'Connected.' });
canvasAnswer = canvasError('TOKEN_REJECTED', 'Canvas did not accept your token (401).');
check('test connection: error type message only', c.testSetupConnection(),
  { ok: false, message: 'Not connected. Canvas did not accept your token (401).' });
canvasAnswer = { name: 'Biology', course_code: 'BIO-P3' };
check('check course: shows Canvas name and code', c.checkSetupCourse().message,
  'Canvas has "Biology" (BIO-P3), course 12345.');
canvasAnswer = canvasError('NOT_FOUND', 'Canvas could not find what was asked for (404).');
const notFound = c.checkSetupCourse();
check('check course: not found points to cfg_CourseID',
  [notFound.ok, notFound.message.includes('cfg_CourseID')], [false, true]);

// Change course and Open ref_Config.
check('course input: digits', c.parseCourseIdInput_(' 4321 '), '4321');
check('course input: pasted Canvas address',
  c.parseCourseIdInput_('https://canvas.example.edu/courses/4321/assignments?x=1'), '4321');
check('course input: not a course', [c.parseCourseIdInput_('Biology'),
  c.parseCourseIdInput_('https://canvas.example.edu/courses/abc')], ['', '']);
const cell = { value: 12345, formula: '', getValue() { return this.value; },
  getFormula() { return this.formula; }, setValue(v) { this.value = v; } };
const shownTabs = [];
const configSheet = { hidden: true, isSheetHidden() { return this.hidden; },
  showSheet() { this.hidden = false; shownTabs.push('show'); },
  activate() { shownTabs.push('open ref_Config'); } };
c.SpreadsheetApp = {
  flush() {},
  getActiveSpreadsheet: () => ({
    getRangeByName: name => name === 'cfg_CourseID' ? { getCell: () => cell,
      activate: () => shownTabs.push('select cfg_CourseID') } : null,
    getSheetByName: name => name === 'ref_Config' ? configSheet : null,
  }),
};
answer = c.saveSetupCourseId('nope');
check('save course: bad input changes nothing', [answer.ok, cell.value], [false, 12345]);
answer = c.saveSetupCourseId('https://canvas.example.edu/courses/4321');
check('save course: writes the number, says what it was', [answer.ok, cell.value,
  answer.message], [true, 4321,
  'Changed to course 4321 (was 12345). Next: refresh the tables (Refresh tables…, All).']);
check('save course: returns the new status', Boolean(answer.status), true);
answer = c.saveSetupCourseId('4321');
check('save course: same number, nothing changed', [answer.ok,
  answer.message.startsWith('Already')], [true, true]);
cell.formula = '=A1';
answer = c.saveSetupCourseId('999');
check('save course: formula cell left alone', [answer.ok, cell.value], [false, 4321]);
check('open ref_Config: unhides, opens, selects the course cell', [c.openSetupConfig(),
  shownTabs], ['', ['show', 'open ref_Config', 'select cfg_CourseID']]);
c.getCfg_ = name => { if (name === 'CourseName') return '#N/A'; throw new Error('x'); };
check('course name #N/A (not in the course list) is hidden', c.getSetupStatus().courseName, '');

// Default Canvas address from ref_Config B2 (read only).
let b2 = 'https://school.example.edu/';
c.SpreadsheetApp.getActiveSpreadsheet = () => ({
  getSheetByName: name => name === 'ref_Config' ? { getRange: a1 => ({
    getValue: () => (a1 === 'B2' ? b2 : '') }) } : null,
  getRangeByName: () => null,
});
check('B2 address is tidied and offered as the default', c.getSetupStatus().defaultBaseUrl,
  'https://school.example.edu');
b2 = 'not an address';
check('B2 that is not an address is ignored', c.getSetupStatus().defaultBaseUrl, '');
b2 = '';
check('blank B2: no default', c.getSetupStatus().defaultBaseUrl, '');

// Dry run switch.
check('turn dry run off', [c.setDryRunFromPanel(false).dryRun, script.data.DRY_RUN], [false, 'false']);
check('turn dry run on', [c.setDryRunFromPanel(true).dryRun, script.data.DRY_RUN], [true, 'true']);

if (failures) {
  console.log(`\n${failures} check(s) failed.`);
  process.exitCode = 1;
}
