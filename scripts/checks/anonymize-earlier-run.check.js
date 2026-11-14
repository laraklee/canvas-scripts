/**
 * scripts/checks/anonymize-earlier-run.check.js
 * Purpose: offline check of Anonymize's safety check (anonymizedElsewhere_ in
 *   anonymize-submissions/Anonymize.js; Lara, 2026-11-13): it stops when the
 *   "anonymized" folder already has files but this workbook's Key tab has no rows for the
 *   assignment (anonymized in another workbook), and lets a normal first run or a re-run
 *   in the same workbook go ahead. Made-up folders and IDs only; nothing is sent
 *   anywhere. Run with the others: npm run check-offline. Repo helper only: never
 *   clasp-pushed.
 * Canvas endpoints called: none. Canvas write operations: none.
 * Required User/Script Properties: none.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PROJECT = path.join(__dirname, '..', '..', 'anonymize-submissions');
const context = {};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(PROJECT, 'Anonymize.js'), 'utf8'), context);
const c = context;

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}` +
    (ok ? '' : `\n      expected ${JSON.stringify(expected)}\n      got      ${JSON.stringify(actual)}`));
}

const iter = (items) => { let i = 0; return { hasNext: () => i < items.length, next: () => items[i++] }; };
let created = 0;
const folder = (anonFiles) => ({
  getFoldersByName: (name) => iter(name === 'anonymized' && anonFiles !== null
    ? [{ getFiles: () => iter(Array(anonFiles).fill({})) }] : []),
  createFolder: () => { created++; },
});
// Key rows: Name, Canvas user ID, Assignment ID, Code, Original filename, Late, Anonymized filename
const keyTab = (rows) => ({
  getLastRow: () => rows.length + 1,
  getRange: () => ({ getDisplayValues: () => rows }),
});
const row = (assignmentId) => ['Student', '101', assignmentId, 'S-AAAAAA', 'essay.pdf', 'FALSE', 'S-AAAAAA.pdf'];

check('no anonymized folder yet: go ahead', c.anonymizedElsewhere_(folder(null), null, '555'), false);
check('empty anonymized folder: go ahead', c.anonymizedElsewhere_(folder(0), null, '555'), false);
check('files, no Key tab here: stop', c.anonymizedElsewhere_(folder(3), null, '555'), true);
check('files, Key tab with no rows: stop', c.anonymizedElsewhere_(folder(3), keyTab([]), '555'), true);
check('files, Key rows only for another assignment: stop',
  c.anonymizedElsewhere_(folder(3), keyTab([row('777')]), '555'), true);
check('files, Key rows for this assignment (a re-run here): go ahead',
  c.anonymizedElsewhere_(folder(3), keyTab([row('555')]), '555'), false);
check('the check never creates a folder', created, 0);

if (failures) process.exitCode = 1;
