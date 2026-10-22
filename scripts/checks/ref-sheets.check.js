/**
 * scripts/checks/ref-sheets.check.js
 * Purpose: offline check of the reference-tab helpers in RefSheets.js: a refreshed tab is
 *   hidden unless it's the one being viewed, and creating a tab doesn't move you away.
 *   Pretend sheets only; nothing is sent anywhere. Run with the others:
 *   npm run check-offline.
 *   Repo helper only: not part of any Apps Script project; never clasp-pushed.
 * Canvas endpoints called: none. Canvas write operations: none.
 * Required User/Script Properties: none.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PROJECT = path.join(__dirname, '..', '..', 'course-manager-jupiter');
const context = {};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(PROJECT, 'Config.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(PROJECT, 'RefSheets.js'), 'utf8'), context);
const c = context;

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}` +
    (ok ? '' : `\n      expected ${JSON.stringify(expected)}\n      got      ${JSON.stringify(actual)}`));
}

// A pretend workbook: tabs with an ID and a hidden flag; one is active.
function fakeWorkbook() {
  const book = { tabs: [], active: null };
  const tab = (id, name) => {
    const t = { id, name, hidden: false, color: '',
      getSheetId: () => id, isSheetHidden: () => t.hidden, hideSheet: () => { t.hidden = true; },
      activate: () => { book.active = t; }, setTabColor: color => { t.color = color; return t; } };
    book.tabs.push(t);
    return t;
  };
  book.ss = {
    getActiveSheet: () => book.active,
    insertSheet: name => { const t = tab(book.tabs.length + 1, name); book.active = t; return t; },
  };
  book.tab = tab;
  return book;
}

const book = fakeWorkbook();
const comments = book.tab(1, 'Comments');
const people = book.tab(2, 'ref_peopleList');
comments.activate();
c.hideRefSheet_(book.ss, people);
check('refreshed tab is hidden while you are on another tab', people.hidden, true);

const book2 = fakeWorkbook();
const sections = book2.tab(3, 'ref_SectionLookup');
sections.activate();
c.hideRefSheet_(book2.ss, sections);
check('the tab you are looking at stays visible', sections.hidden, false);

const book3 = fakeWorkbook();
const home = book3.tab(1, 'Home');
home.activate();
const created = c.createRefSheet_(book3.ss, 'ref_CourseIDs');
check('creating a tab keeps you where you were, with the red tab color',
  [book3.active.name, created.color], ['Home', '#cc0000']);
c.hideRefSheet_(book3.ss, created);
check('and a newly created tab gets hidden', created.hidden, true);

if (failures) {
  console.log(`\n${failures} check(s) failed.`);
  process.exitCode = 1;
}
