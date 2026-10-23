/**
 * scripts/checks/create-by-row.check.js
 * Purpose: offline check of the createByRow helpers in PostRows.js (time reading, dates,
 *   payloads for A/D/CQ/NQ, descriptions, the Published column, row planning), using
 *   made-up rows only (no real data; nothing is sent anywhere). Google pieces are
 *   replaced by small stand-ins. Run with the others: npm run check-offline.
 *   Repo helper only: not part of any Apps Script project; never clasp-pushed.
 * Canvas endpoints called: none. Canvas write operations: none.
 * Required User/Script Properties: none.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PROJECT = path.join(__dirname, '..', '..', 'course-manager-jupiter');

// Stand-ins for the Google pieces the helpers use.
const context = {
  isBlank_: value => value === '' || value === null || value === undefined,
  sheetProblem_: message => Object.assign(new Error(message), { isSheetProblem: true }),
  Utilities: {
    formatDate(date, timeZone, pattern) {
      if (pattern === 'yyyy-MM-dd') {
        return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit',
          day: '2-digit' }).format(date);
      }
      if (pattern === 'Z') {
        const name = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
          .formatToParts(date).find(p => p.type === 'timeZoneName').value; // "GMT-10:00"
        return name.replace('GMT', '').replace(':', '') || '+0000';
      }
      throw new Error('unexpected pattern ' + pattern);
    },
  },
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(PROJECT, 'PostRows.js'), 'utf8') +
  '\nthis.parseSheetTime_ = parseSheetTime_; this.buildCanvasTime_ = buildCanvasTime_;' +
  '\nthis.assignmentPayload_ = assignmentPayload_; this.buildDescription_ = buildDescription_;' +
  '\nthis.planCreateByRow_ = planCreateByRow_; this.LABELS = CREATE_BY_ROW_LABELS;' +
  '\nthis.OPTIONAL = CREATE_BY_ROW_OPTIONAL_LABELS; this.discussionPayload_ = discussionPayload_;' +
  '\nthis.parsePublished_ = parsePublished_;', context);
const c = context;

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}` +
    (ok ? '' : `\n      expected ${JSON.stringify(expected)}\n      got      ${JSON.stringify(actual)}`));
}
const throwsMessage = fn => { try { fn(); return 'no error'; } catch (e) { return e.message; } };
const HST = 'Pacific/Honolulu';
// A date cell for Jan 28, 2026 is midnight in Hawaii = 10:00 UTC. Made inside the sandbox,
// so the code under test sees it as a real Date (as it would from a sheet cell).
const jan28 = vm.runInContext("new Date('2026-01-28T10:00:00Z')", context);

// Times: everything column O used to handle.
const times = {
  'School start (0815)': [8, 15], 'After school (1530)': [15, 30], '8:15 AM': [8, 15],
  '2:05 PM': [14, 5], '12:00 AM': [0, 0], '12:30 PM': [12, 30], '14:05': [14, 5],
  '0815': [8, 15], '815': [8, 15], '8:15:00 AM': [8, 15],
};
Object.entries(times).forEach(([text, [h, m]]) =>
  check(`time "${text}"`, c.parseSheetTime_(text), { hours: h, minutes: m }));
['noon', '25:00', '13:00 PM', '8:75'].forEach(text =>
  check(`time "${text}" is not a time`, c.parseSheetTime_(text), null));

// Dates: Hawaii offset, blank time = 11:59 PM, no day shift.
check('due 2:05 PM Jan 28', c.buildCanvasTime_(jan28, '2:05 PM', HST, 'Due'),
  '2026-01-28T14:05:00-10:00');
check('blank time = 11:59 PM same day', c.buildCanvasTime_(jan28, '', HST, 'Due'),
  '2026-01-28T23:59:00-10:00');
check('dropdown (0815) at 8:15 AM', c.buildCanvasTime_(jan28, 'School start (0815)', HST, 'Due'),
  '2026-01-28T08:15:00-10:00');
check('blank date = nothing sent', c.buildCanvasTime_('', '8:15 AM', HST, 'Due'), '');
check('text instead of a date is refused',
  throwsMessage(() => c.buildCanvasTime_('Jan 28', '8:15 AM', HST, 'Due')), 'Due Date is not a date');
check('a bad time is refused',
  throwsMessage(() => c.buildCanvasTime_(jan28, 'noon', HST, 'Lock')),
  'Lock Time "noon" is not a time I understand');

// Payload.
const payload = c.assignmentPayload_({ name: 'Lab 1', points: '', description: '<p>x</p>',
  dueAt: '2026-01-28T23:59:00-10:00', unlockAt: '', lockAt: '' });
check('payload: legacy fields, blank points = 0, blank dates left out', payload, {
  assignment: { name: 'Lab 1', points_possible: 0, description: '<p>x</p>',
    submission_types: ['online_upload'], published: true, due_at: '2026-01-28T23:59:00-10:00' },
});
check('payload: bad points refused',
  throwsMessage(() => c.assignmentPayload_({ name: 'X', points: 'ten' })),
  'points_possible is not a number');

// Description (green-button style).
const bold = text => '<div style="margin-bottom: 20px; font-weight: bold; color: #333; ' +
  `font-size: 1.1em;">${text}</div>\n`;
const html = c.buildDescription_('Read this.\nThen answer.',
  'https://docs.google.com/document/d/abc/edit', 'Line one\n\nLine two');
check('description: bold directions (line breaks kept), green button, /preview embed',
  [html.startsWith(bold('Read this.<br>Then answer.')),
    html.includes('<a class="btn" href="https://docs.google.com/document/d/abc/edit"'),
    html.includes('background-color: #5d783e;'), html.includes('>🚀 Line one<br>Line two</a>'),
    html.includes('src="https://docs.google.com/document/d/abc/preview"'),
    html.includes('width: 100%;')], [true, true, true, true, true, true]);
check('description: Drive /view link previews too',
  c.buildDescription_('', 'https://drive.google.com/file/d/xyz/view', 'PDF')
    .includes('src="https://drive.google.com/file/d/xyz/preview"'), true);
const site = c.buildDescription_('', 'https://example.test/sim', '');
check('description: other site = button only (default label), no preview',
  [site.includes('>🚀 Open Resource</a>'), site.includes('<iframe')], [true, false]);
check('description: no link = bold directions only', c.buildDescription_('Hi', '', ''), bold('Hi'));
check('description: nothing typed = blank', c.buildDescription_('', '', ''), '');

// Planning one row.
const L = c.LABELS;
const plan = (values, display) => c.planCreateByRow_(5,
  label => (label in values ? values[label] : ''),
  label => (label in display ? display[label] : ''), '999', HST);
check('blank row is left out', plan({}, {}), null);
check('row with CanvasID is skipped',
  plan({ [L.CANVAS_ID]: 123 }, { [L.NAME]: 'Lab', [L.TYPE]: 'A' }).message,
  'Skipped: already has a CanvasID');
check('unknown type', plan({}, { [L.NAME]: 'X', [L.TYPE]: 'Q' }).message,
  'Skipped: Type "Q" is not A, D, NQ, or CQ');
check('bad due time = not ready, with reason',
  plan({ [L.DUE_DATE]: jan28 }, { [L.NAME]: 'Lab', [L.TYPE]: 'A', [L.DUE_TIME]: 'soon' }).message,
  'Not ready: Due Time "soon" is not a time I understand');
const ready = plan({ [L.DUE_DATE]: jan28, [L.POINTS]: 10 },
  { [L.NAME]: 'Lab 2', [L.TYPE]: 'A', [L.DUE_TIME]: 'After school (1530)' });
check('ready A row: path and due time', [ready.request.path, ready.request.payload.assignment.due_at,
  ready.request.payload.assignment.points_possible],
  ['/courses/999/assignments', '2026-01-28T15:30:00-10:00', 10]);

// Type D (graded discussion).
check('D payload: title, message, published, assignment part with points and dates',
  c.discussionPayload_({ name: 'Talk 1', points: 5, description: '<p>x</p>', published: true,
    dueAt: '2026-01-28T23:59:00-10:00', unlockAt: '2026-01-26T08:15:00-10:00', lockAt: '' }), {
    title: 'Talk 1', message: '<p>x</p>', published: true,
    assignment: { grading_type: 'points', points_possible: 5,
      due_at: '2026-01-28T23:59:00-10:00', unlock_at: '2026-01-26T08:15:00-10:00' },
  });
const readyD = plan({ [L.DUE_DATE]: jan28 }, { [L.NAME]: 'Talk', [L.TYPE]: 'D' });
check('ready D row: discussion path; CanvasID is the assignment ID',
  [readyD.request.path, readyD.request.readId({ id: 1, assignment_id: 77 }), readyD.label],
  ['/courses/999/discussion_topics', 77, 'D, draft']);

// Published column (optional).
const P = c.OPTIONAL.PUBLISHED;
check('published: TRUE, true, checkbox ticked = publish',
  ['TRUE', 'true', true].map(v => c.parsePublished_(v)), [true, true, true]);
check('published: FALSE, unticked checkbox, or blank = draft',
  ['FALSE', false, ''].map(v => c.parsePublished_(v)), [false, false, false]);
check('published: anything else is refused',
  throwsMessage(() => c.parsePublished_('maybe')), 'Published must be TRUE, FALSE, or blank');
const draftA = plan({ [P]: false }, { [L.NAME]: 'Lab 3', [L.TYPE]: 'A' });
check('draft A row: published false, label says draft',
  [draftA.request.payload.assignment.published, draftA.label], [false, 'A, draft']);
const draftD = plan({ [P]: 'FALSE' }, { [L.NAME]: 'Talk 2', [L.TYPE]: 'D' });
check('draft D row: topic unpublished', draftD.request.payload.published, false);
check('no Published column = draft (changed 2026-10-23; was publish)',
  plan({}, { [L.NAME]: 'Lab 4', [L.TYPE]: 'A' }).request.payload.assignment.published, false);
const tickedA = plan({ [P]: true }, { [L.NAME]: 'Lab 5', [L.TYPE]: 'A' });
check('ticked A row: published, plain label',
  [tickedA.request.payload.assignment.published, tickedA.label], [true, 'A']);

// Type CQ (graded Classic quiz shell).
const readyCQ = plan({ [L.DUE_DATE]: jan28, [L.POINTS]: 20 },
  { [L.NAME]: 'Quiz 1', [L.TYPE]: 'cq', [L.DUE_TIME]: '8:15 AM' });
check('CQ payload: graded quiz type, title, published, due; no points', readyCQ.request.payload, {
  quiz: { title: 'Quiz 1', quiz_type: 'assignment', published: false,
    due_at: '2026-01-28T08:15:00-10:00' },
});
check('CQ row: quizzes path; CanvasID = assignment ID; Canvas Link = the quiz link',
  [readyCQ.request.path, readyCQ.request.readId({ id: 55, assignment_id: 88, html_url: 'u' }),
    readyCQ.request.readLink({ id: 55, assignment_id: 88, html_url: 'u' })],
  ['/courses/999/quizzes', 88, 'u']);
const draftCQ = plan({ [P]: false }, { [L.NAME]: 'Quiz 2', [L.TYPE]: 'CQ' });
check('draft CQ row: unpublished, label says draft',
  [draftCQ.request.payload.quiz.published, draftCQ.label], [false, 'CQ, draft']);
check('A and D still put the web address in Canvas Link',
  [ready.request.readLink({ id: 1, html_url: 'https://a' }),
    readyD.request.readLink({ assignment_id: 2, html_url: 'https://d' })],
  ['https://a', 'https://d']);

// Type NQ (New Quiz, New Quizzes API).
context.getCanvasCredentials_ = () => ({ baseUrl: 'https://canvas.example' });
const readyNQ = plan({ [L.DUE_DATE]: jan28, [L.POINTS]: 12 },
  { [L.NAME]: 'NQ 1', [L.TYPE]: 'nq', [L.DUE_TIME]: '8:15 AM', [L.DESCRIPTION]: 'Do this.' });
check('NQ payload: title, points, grading type, instructions, due; no quiz_type/published',
  readyNQ.request.payload, {
    quiz: { title: 'NQ 1', points_possible: 12, grading_type: 'points',
      instructions: bold('Do this.'), due_at: '2026-01-28T08:15:00-10:00' },
  });
check('NQ row: New Quizzes API path; CanvasID = quiz ID; link built from it',
  [readyNQ.request.path, readyNQ.request.readId({ id: 321 }), readyNQ.request.readLink({ id: 321 })],
  ['/api/quiz/v1/courses/999/quizzes', 321, 'https://canvas.example/courses/999/assignments/321']);
check('NQ with blank points = not ready',
  plan({}, { [L.NAME]: 'NQ 2', [L.TYPE]: 'NQ' }).message,
  'Not ready: NQ needs points_possible above 0');
const nqLabel = published => {
  const p = plan({ [P]: published, [L.POINTS]: 5 }, { [L.NAME]: 'NQ 3', [L.TYPE]: 'NQ' });
  return [p.label, 'published' in p.request.payload.quiz];
};
check('NQ unticked: label says draft (Canvas starts New Quizzes as drafts); nothing sent',
  nqLabel(false), ['NQ, draft', false]);
check('NQ ticked: still a draft, label says Published ignored; nothing sent',
  nqLabel(true), ['NQ, draft (Published ignored)', false]);

// Blank times: Unlock = start of the day; Due and Lock = end of the day.
const jan26 = vm.runInContext("new Date('2026-01-26T10:00:00Z')", context);
const blankTimes = plan({ [L.UNLOCK_DATE]: jan26, [L.DUE_DATE]: jan28, [L.LOCK_DATE]: jan28 },
  { [L.NAME]: 'Lab 5', [L.TYPE]: 'A' }).request.payload.assignment;
check('blank Unlock Time = 12:00 AM that day; blank Due and Lock = 11:59 PM',
  [blankTimes.unlock_at, blankTimes.due_at, blankTimes.lock_at],
  ['2026-01-26T00:00:00-10:00', '2026-01-28T23:59:00-10:00', '2026-01-28T23:59:00-10:00']);
check('a typed Unlock Time still wins over the blank default',
  plan({ [L.UNLOCK_DATE]: jan26 }, { [L.NAME]: 'Lab 6', [L.TYPE]: 'A',
    [L.UNLOCK_TIME]: 'School start (0815)' }).request.payload.assignment.unlock_at,
  '2026-01-26T08:15:00-10:00');

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.');
process.exitCode = failures ? 1 : 0;
