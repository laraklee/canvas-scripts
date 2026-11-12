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
check('good save: address trimmed to the site, token stored trimmed', [answer.ok, user.data],
  [true, { CANVAS_BASE_URL: 'https://canvas.example.edu', CANVAS_TOKEN: FAKE_TOKEN }]);
check('save message never contains the token', answer.message.includes(FAKE_TOKEN), false);
answer = c.saveCanvasCredentialsFromPanel({ baseUrl: '', token: '' });
check('both boxes blank: keeps what is saved', [answer.ok, user.data.CANVAS_TOKEN,
  answer.message.includes('unchanged')], [true, FAKE_TOKEN, true]);

// Status sent to the panel.
const status = c.getSetupStatus();
check('status says a token is saved, never the token itself',
  [status.hasToken, JSON.stringify(status).includes(FAKE_TOKEN), 'token' in status],
  [true, false, false]);
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
  'Canvas has "Biology" (BIO-P3), course 12345. If that\'s not the course you mean, ' +
  'change cfg_CourseID on ref_Config.');
canvasAnswer = canvasError('NOT_FOUND', 'Canvas could not find what was asked for (404).');
const notFound = c.checkSetupCourse();
check('check course: not found points to cfg_CourseID',
  [notFound.ok, notFound.message.includes('cfg_CourseID')], [false, true]);

// Dry run switch.
check('turn dry run off', [c.setDryRunFromPanel(false).dryRun, script.data.DRY_RUN], [false, 'false']);
check('turn dry run on', [c.setDryRunFromPanel(true).dryRun, script.data.DRY_RUN], [true, 'true']);

if (failures) {
  console.log(`\n${failures} check(s) failed.`);
  process.exitCode = 1;
}
