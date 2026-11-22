/**
 * scripts/checks/assign-error-messages.check.js
 * Purpose: offline check of assign-sheet's clearer error messages: the date-order check
 *   that runs before Send (datesOrderProblem_, 07_AssignmentDates.js) and the plain-words
 *   reason shown when Canvas refuses a change (canvasRefusalReason_, 05_CanvasApi.js),
 *   including that reasons with digits or @ are never shown. Made-up data only; nothing
 *   is sent anywhere. Run with the others: npm run check-offline. Repo helper only:
 *   never clasp-pushed.
 * Canvas endpoints called: none. Canvas write operations: none.
 * Required User/Script Properties: none.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PROJECT = path.join(__dirname, '..', '..', 'assign-sheet');
const context = { console: { log() {}, error() {} } };
vm.createContext(context);
// Just enough of Utilities for parseSheetDateTime_ (time zone ignored: UTC throughout).
context.Utilities = {
  parseDate: s => new Date(s.replace(' ', 'T') + 'Z'),
  formatDate: d => `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`,
};
['05_CanvasApi.js', '07_AssignmentDates.js'].forEach(file =>
  vm.runInContext(fs.readFileSync(path.join(PROJECT, file), 'utf8'), context));
const c = context;

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}` +
    (ok ? '' : `\n      expected ${JSON.stringify(expected)}\n      got      ${JSON.stringify(actual)}`));
}

// A sheet row as display text: columns A–N, with open F/G, due I/J, lock K/L.
function row(open, due, lock) {
  const r = ['', '1', 'Lab', 'online_upload', '10', '', '', 'F1r', '', '', '', '', '', ''];
  [[open, 5], [due, 8], [lock, 10]].forEach(([pair, col]) => {
    if (pair) { r[col] = pair[0]; r[col + 1] = pair[1]; }
  });
  return r;
}
const short = r => (c.datesOrderProblem_(r, 'UTC') || {}).short || null;

// Date order before Send.
check('in order', short(row(['11/20/26', '8:00 am'], ['11/25/26', '9:55 am'],
  ['11/30/26', '11:59 pm'])), null);
check('lock before due (the 11/22 case, open blank)',
  short(row(null, ['11/25/26', '9:55 AM'], ['11/23/26', '10:00 AM'])),
  'lock date is before the due date');
check('due before open', short(row(['11/25/26', '9:55 am'], ['11/23/26', '10:00 am'], null)),
  'due date is before the open date');
check('lock before open, no due', short(row(['11/25/26', '9:55 am'], null,
  ['11/23/26', '10:00 am'])), 'lock date is before the open date');
check('same time is fine', short(row(['11/25/26', '9:55 am'], ['11/25/26', '9:55 am'],
  ['11/25/26', '9:55 am'])), null);
check('all blank is fine', short(row(null, null, null)), null);
check('mistyped date left to the date checks', short(row(['11/25', '9:55 am'],
  ['11/23/26', '10:00 am'], null)), null);
const fix = c.datesOrderProblem_(row(null, ['11/25/26', '9:55 AM'], ['11/23/26', '10:00 AM']),
  'UTC').fix;
check('fix names both dates and what to do', fix,
  'the lock date (11/23/26 10:00 AM) is before the due date (11/25/26 9:55 AM). ' +
  'Move the lock date to the due date or later, or clear it so it never locks.');

// Canvas refusals.
const reason = body => {
  const r = c.canvasRefusalReason_(JSON.stringify(body));
  return r ? [r.text, r.dates] : null;
};
check('field errors', reason({ errors: { due_at: [{ attribute: 'due_at', type: 'invalid',
  message: 'must be between availability dates' }] } }),
['the due date ("must be between availability dates")', true]);
check('list of errors', reason({ errors: [{ message: 'Title is too long.' }] }),
  ['it ("Title is too long")', false]);
check('plain message', reason({ message: 'Invalid section' }), ['it ("Invalid section")', false]);
check('nested override errors', reason({ errors: { assignment_override: { lock_at:
  [{ message: 'must be after due date' }] } } }),
['the lock date ("must be after due date")', true]);
check('at most two reasons', reason({ errors: { due_at: ['a'], lock_at: ['b'], unlock_at: ['c'] } }),
  ['the due date ("a") and the lock date ("b")', true]);
check('digits never shown', reason({ errors: { student_ids: ['Student 12345 not found'] } }), null);
check('emails never shown', reason({ message: 'jane at doe@example.com' }), null);
check('not JSON', c.canvasRefusalReason_('<html>oops</html>'), null);

// The message a row's status shows.
const thrown = (code, body) => {
  try {
    c.checkCanvasResponse_(code, false, { getContentText: () => JSON.stringify(body) });
  } catch (e) { return e.message; }
  return 'no error';
};
check('400 with a reason', thrown(400, { errors: { lock_at: ['must be after due date'] } }),
  'Canvas refused the lock date ("must be after due date"). Check the dates on this row, ' +
  'and the course\'s term and section dates in Canvas.');
check('400 without a reason', thrown(400, {}),
  'Canvas refused this change (HTTP 400) without saying why. Check the dates and other ' +
  'values on this row.');
check('500 unchanged', thrown(500, {}), 'Canvas returned an error (HTTP 500).');

if (failures) {
  console.log(`\n${failures} check(s) failed.`);
  process.exitCode = 1;
}
