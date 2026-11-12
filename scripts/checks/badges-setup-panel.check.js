/**
 * scripts/checks/badges-setup-panel.check.js
 * Purpose: offline check of gastronomy-badges' Setup panel (SetupPanel.js) and its
 *   credentials (Credentials.js): the old CANVAS_API_KEY token moves to CANVAS_TOKEN by
 *   itself, the *Config* B2 address is saved when none is, blank boxes keep what's saved,
 *   bad input saves nothing, the token never comes back in a status or a message, and
 *   Save course writes *Config* B4. Made-up data and a fake token only; nothing is sent
 *   anywhere. Run with the others: npm run check-offline. Repo helper only: never
 *   clasp-pushed.
 * Canvas endpoints called: none. Canvas write operations: none.
 * Required User/Script Properties: none (fake property stores).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PROJECT = path.join(__dirname, '..', '..', 'gastronomy-badges');
const context = { console: { log() {}, error() {} } };
vm.createContext(context);
['Credentials.js', 'SetupPanel.js'].forEach(file =>
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
    setProperty: (k, v) => { data[k] = v; }, deleteProperty: k => { delete data[k]; } };
}
let user = store({});
c.PropertiesService = { getUserProperties: () => user };

// A fake *Config* tab: B2 the school's address, B4 the course number.
const cells = { B2: 'https://school.example.edu/', B4: 12345 };
const formulas = {};
const shown = [];
const configSheet = {
  hidden: true,
  getRange: a1 => ({
    getValue: () => (a1 in cells ? cells[a1] : ''),
    getFormula: () => formulas[a1] || '',
    setValue: v => { cells[a1] = v; },
    activate: () => shown.push('select ' + a1),
  }),
  isSheetHidden() { return this.hidden; },
  showSheet() { this.hidden = false; shown.push('show'); },
  activate: () => shown.push('open Config'),
};
let hasConfig = true;
c.SpreadsheetApp = { getActiveSpreadsheet: () => ({
  getSheetByName: name => (hasConfig && name === '*Config*' ? configSheet : null),
  getSpreadsheetTimeZone: () => 'UTC',
}) };
c.Utilities = { formatDate: (date, zone, pattern) =>
  `${date.getUTCMonth() + 1}/${date.getUTCDate()}/${date.getUTCFullYear()} (${zone}, ${pattern})` };

// Moving an old setup over.
user = store({ CANVAS_API_KEY: FAKE_TOKEN });
check('old token moves to CANVAS_TOKEN, old one deleted, B2 address saved',
  [c.getCanvasToken_(), user.data],
  [FAKE_TOKEN, { CANVAS_TOKEN: FAKE_TOKEN, CANVAS_BASE_URL: 'https://school.example.edu' }]);
user = store({ CANVAS_API_KEY: 'old~token~should~stay~put', CANVAS_TOKEN: FAKE_TOKEN,
  CANVAS_BASE_URL: 'https://mine.example.edu' });
check('a new token and address are never overwritten',
  [c.getCanvasToken_(), c.getCanvasBaseUrl_()], [FAKE_TOKEN, 'https://mine.example.edu']);
user = store({});
cells.B2 = 'not an address';
check('nothing saved and B2 not an address: nothing saved', [c.getCanvasBaseUrl_(),
  c.getCanvasToken_(), user.data], ['', '', {}]);
cells.B2 = 'https://school.example.edu/';
check('missing-setup message points to Setup…', c.missingSetupMessage_().includes('Setup…'),
  true);

// Saving from the panel.
user = store({});
hasConfig = false; // no B2 to fall back on
let answer = c.saveCanvasCredentialsFromPanel({ baseUrl: '', token: FAKE_TOKEN });
check('no address saved and none typed: nothing saved', [answer.ok, user.data], [false, {}]);
answer = c.saveCanvasCredentialsFromPanel({ baseUrl: 'canvas.example.edu', token: '' });
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
check('good save: records when the token was saved', /^\d{4}-\d\d-\d\dT/.test(savedAt || ''),
  true);
check('save message never contains the token', answer.message.includes(FAKE_TOKEN), false);
user.data.CANVAS_TOKEN_SAVED = '2026-11-12T20:00:00.000Z';
answer = c.saveCanvasCredentialsFromPanel({ baseUrl: '', token: '' });
check('both boxes blank: keeps what is saved', [answer.ok, user.data.CANVAS_TOKEN,
  answer.message.includes('unchanged')], [true, FAKE_TOKEN, true]);
hasConfig = true;

// Status sent to the panel.
const status = c.getSetupStatus();
check('status never includes the whole token',
  [status.hasToken, JSON.stringify(status).includes(FAKE_TOKEN), 'token' in status],
  [true, false, false]);
check('status: last 4, date saved, address, B2 default, course',
  [status.tokenHint, status.tokenSavedOn, status.baseUrl, status.defaultBaseUrl, status.courseId],
  [FAKE_TOKEN.slice(-4), '11/12/2026 (UTC, M/d/yyyy)', 'https://canvas.example.edu',
    'https://school.example.edu', '12345']);
user.data.CANVAS_TOKEN = 'short~token';
check('a token under 20 characters gets no hint', c.getSetupStatus().tokenHint, '');
user.data.CANVAS_TOKEN = FAKE_TOKEN;
delete user.data.CANVAS_TOKEN_SAVED;
check('a moved-over token: hint, no date',
  [c.getSetupStatus().tokenHint.length, c.getSetupStatus().tokenSavedOn], [4, '']);
cells.B4 = '';
check('blank B4: course problem says so', c.getSetupStatus().courseProblem.includes('B4'), true);
hasConfig = false;
check('no Config tab: course problem says so',
  c.getSetupStatus().courseProblem.includes('no *Config* tab'), true);
hasConfig = true;
cells.B4 = 12345;

// Canvas requests (fake UrlFetchApp: answers with the code set here).
let fetchCode = 200;
let fetchBody = '{}';
const fetched = [];
c.UrlFetchApp = { fetch: (url, options) => {
  fetched.push([url, options.headers.Authorization === 'Bearer ' + FAKE_TOKEN,
    options.muteHttpExceptions]);
  return { getResponseCode: () => fetchCode, getContentText: () => fetchBody };
} };
check('test connection: connected', c.testSetupConnection(), { ok: true, message: 'Connected.' });
check('request: right address, token header, muted exceptions', fetched[0],
  ['https://canvas.example.edu/api/v1/users/self', true, true]);
fetchCode = 401;
answer = c.testSetupConnection();
check('test connection 401: says the token, never shows it', [answer.ok,
  answer.message.includes('token'), answer.message.includes(FAKE_TOKEN)], [false, true, false]);
fetchCode = 200;
fetchBody = JSON.stringify({ name: 'Gastronomy', course_code: 'GAST-1' });
check('check course: shows Canvas name and code', c.checkSetupCourse().message,
  'Canvas has "Gastronomy" (GAST-1), course 12345.');
fetchCode = 404;
answer = c.checkSetupCourse();
check('check course: not found points to the course number',
  [answer.ok, answer.message.includes('course number')], [false, true]);
user.data = {};
user = store({});
hasConfig = false;
check('no setup: asks for part 2', c.testSetupConnection().message.includes('part 2'), true);
hasConfig = true;

// Change course and Open Config.
check('course input: digits', c.parseCourseIdInput_(' 4321 '), '4321');
check('course input: pasted Canvas address',
  c.parseCourseIdInput_('https://canvas.example.edu/courses/4321/assignments?x=1'), '4321');
check('course input: not a course', [c.parseCourseIdInput_('Gastronomy'),
  c.parseCourseIdInput_('https://canvas.example.edu/courses/abc')], ['', '']);
answer = c.saveSetupCourseId('nope');
check('save course: bad input changes nothing', [answer.ok, cells.B4], [false, 12345]);
answer = c.saveSetupCourseId('https://canvas.example.edu/courses/4321');
check('save course: writes B4, says what it was', [answer.ok, cells.B4, answer.message],
  [true, 4321, 'Changed to course 4321 (was 12345). Next: Canvas Tools › Run FULL Data Refresh.']);
check('save course: returns the new status', Boolean(answer.status), true);
answer = c.saveSetupCourseId('4321');
check('save course: same number, nothing changed', [answer.ok,
  answer.message.startsWith('Already')], [true, true]);
formulas.B4 = '=A1';
answer = c.saveSetupCourseId('999');
check('save course: formula cell left alone', [answer.ok, cells.B4], [false, 4321]);
check('open Config: unhides, opens, selects B4', [c.openSetupConfig(), shown],
  ['', ['show', 'open Config', 'select B4']]);

if (failures) {
  console.log(`\n${failures} check(s) failed.`);
  process.exitCode = 1;
}
