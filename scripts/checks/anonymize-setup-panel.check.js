/**
 * scripts/checks/anonymize-setup-panel.check.js
 * Purpose: offline check of anonymize-submissions' Setup panel (Passphrase.js): the
 *   check code is 4 characters, the same for the same passphrase, and never the
 *   passphrase; Save needs two matching boxes of 12+ characters and asks before
 *   replacing a saved passphrase; the status never includes the passphrase; Show returns
 *   only the user's own. Made-up passphrases only; nothing is sent anywhere. Run with the
 *   others: npm run check-offline. Repo helper only: never clasp-pushed.
 * Canvas endpoints called: none. Canvas write operations: none.
 * Required User/Script Properties: none (fake property store).
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PROJECT = path.join(__dirname, '..', '..', 'anonymize-submissions');
const context = { console: { log() {}, error() {} } };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(PROJECT, 'Passphrase.js'), 'utf8'), context);
const c = context;

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}` +
    (ok ? '' : `\n      expected ${JSON.stringify(expected)}\n      got      ${JSON.stringify(actual)}`));
}

// Apps Script's HMAC returns signed bytes (-128..127); the fake does the same.
c.Utilities = {
  Charset: { UTF_8: 'utf8' },
  computeHmacSha256Signature: (value, key) => Array.from(
    crypto.createHmac('sha256', Buffer.from(key, 'utf8')).update(value, 'utf8').digest(),
    (b) => (b > 127 ? b - 256 : b)),
};
let data = {};
c.PropertiesService = { getUserProperties: () => ({
  getProperty: k => (k in data ? data[k] : null), setProperty: (k, v) => { data[k] = v; } }) };

const FAKE_A = 'made up passphrase one';
const FAKE_B = 'made up passphrase two';

// Check code.
const codeA = c.passphraseCheckCode_(FAKE_A);
const expectedA = crypto.createHmac('sha256', FAKE_A).update('passphrase-check').digest('hex')
  .slice(0, 4).toUpperCase();
check('check code: 4 hex characters, from HMAC of the fixed word', [codeA, /^[0-9A-F]{4}$/.test(codeA)],
  [expectedA, true]);
check('check code: same passphrase, same code; different passphrase, different code',
  [c.passphraseCheckCode_(FAKE_A), c.passphraseCheckCode_(FAKE_B) !== codeA], [codeA, true]);

// Status with nothing saved.
check('status: nothing saved', c.getSetupStatus(),
  { ok: true, hasPassphrase: false, checkCode: '', minLength: 12 });

// Saving.
let answer = c.savePassphraseFromPanel({ passphrase: 'too short', again: 'too short' });
check('too short: nothing saved', [answer.ok, data], [false, {}]);
answer = c.savePassphraseFromPanel({ passphrase: FAKE_A, again: FAKE_B });
check('boxes differ: nothing saved, message does not repeat input',
  [answer.ok, data, answer.message.includes(FAKE_A)], [false, {}, false]);
answer = c.savePassphraseFromPanel({ passphrase: ` ${FAKE_A} `, again: FAKE_A });
check('first save: saved trimmed, status has check code', [answer.ok, data.ANON_PASSPHRASE,
  answer.status.checkCode], [true, FAKE_A, codeA]);
check('save message and status never contain the passphrase',
  JSON.stringify(answer).includes(FAKE_A), false);
answer = c.savePassphraseFromPanel({ passphrase: FAKE_B, again: FAKE_B });
check('replacing without the confirm step: asks, nothing changed',
  [answer.ok, answer.needsReplace, data.ANON_PASSPHRASE], [false, true, FAKE_A]);
answer = c.savePassphraseFromPanel({ passphrase: FAKE_B, again: FAKE_B, replace: 'yes' });
check('replace must be exactly true', [answer.needsReplace, data.ANON_PASSPHRASE],
  [true, FAKE_A]);
answer = c.savePassphraseFromPanel({ passphrase: FAKE_A, again: FAKE_A });
check('same passphrase again: nothing changed, no replace step',
  [answer.ok, answer.needsReplace, data.ANON_PASSPHRASE], [true, undefined, FAKE_A]);
answer = c.savePassphraseFromPanel({ passphrase: FAKE_B, again: FAKE_B, replace: true });
check('replace confirmed: saved, says codes are new', [answer.ok, data.ANON_PASSPHRASE,
  answer.message.includes('new')], [true, FAKE_B, true]);

// Status and Show.
const status = c.getSetupStatus();
check('status never includes the passphrase',
  [status.hasPassphrase, JSON.stringify(status).includes(FAKE_B)], [true, false]);
check('show: returns the user\'s own passphrase', c.revealPassphraseForPanel(),
  { ok: true, passphrase: FAKE_B });
data = {};
check('show with nothing saved: says so', c.revealPassphraseForPanel().ok, false);

if (failures) {
  console.log(`\n${failures} check(s) failed.`);
  process.exitCode = 1;
}
