/**
 * scripts/checks/content-list.check.js
 * Purpose: offline check of List course content (CourseContentList.js), using MADE-UP
 *   courses, items, and links only (nothing is sent anywhere; Canvas is not called).
 *   Run with the others: npm run check-offline.
 *   Repo helper only: not part of any Apps Script project; never clasp-pushed.
 * Canvas endpoints called: none. Canvas write operations: none.
 * Required User/Script Properties: none.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PROJECT = path.join(__dirname, '..', '..', 'course-manager-jupiter');
const context = {
  sheetProblem_: message => Object.assign(new Error(message), { isSheetProblem: true }),
};
vm.createContext(context);
// Same order Google loads them (by file name).
vm.runInContext(['CanvasApi.js', 'CourseContentList.js', 'ExportToDocs.js', 'QuizQuestions.js']
  .map(file => fs.readFileSync(path.join(PROJECT, file), 'utf8')).join('\n'), context);
const c = context;

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}` +
    (ok ? '' : `\n      expected ${JSON.stringify(expected)}\n      got      ${JSON.stringify(actual)}`));
}

const base = 'https://canvas.example.edu';
const root = `${base}/courses/7`;
const items = c.contentItems_('7', base, { syllabus_body: '<p>Rules</p>' },
  [
    { id: 1, name: 'Lab 1', published: true, updated_at: '2026-10-01T10:00:00Z',
      html_url: `${root}/assignments/1`, submission_types: ['online_upload'] },
    { id: 2, name: 'Graded talk', published: true, submission_types: ['discussion_topic'] },
    { id: 3, name: 'Quiz 1', published: false, submission_types: ['online_quiz'] },
    { id: 4, name: ' No URL ', published: false },
  ],
  [{ id: 20, title: 'Graded talk', published: true, html_url: `${root}/discussion_topics/20` }],
  [
    { url: 'welcome', title: 'Welcome', published: true, front_page: true,
      updated_at: '2026-09-01T00:00:00Z', html_url: `${root}/pages/welcome` },
    { url: 'lab-safety', title: 'Lab Safety', published: false },
  ]);
check('order and types: syllabus, home, assignments (no discussion/quiz copies), ' +
  'discussions, pages', items.map(i => [i.typeName, i.name]), [
  ['Syllabus', 'Syllabus'], ['Home page', 'Welcome'], ['Assignment', 'Lab 1'],
  ['Assignment', 'No URL'], ['Discussion', 'Graded talk'], ['Page', 'Lab Safety']]);
check('links (built when Canvas gives none)', items.map(i => i.link), [
  `${root}/assignments/syllabus`, `${root}/pages/welcome`, `${root}/assignments/1`,
  `${root}/assignments/4`, `${root}/discussion_topics/20`, `${root}/pages/lab-safety`]);
check('published and updated', items.map(i => [i.published, i.updated]), [
  ['', ''], ['Yes', '2026-09-01T00:00:00Z'], ['Yes', '2026-10-01T10:00:00Z'], ['No', ''],
  ['Yes', ''], ['No', '']]);
check('home page matches its page link and the course home link',
  items.slice(1, 2)[0].keys, ['pages:7:welcome', 'front_page:7:']);
check('no syllabus row when the syllabus is empty',
  c.contentItems_('7', base, { syllabus_body: '  ' }, [], [], []).length, 0);

// Rows on the tab: the course home link (from the first export), an assignment pasted as a
// blue link, a blank row, another course's page, a deleted page, a typed page link with
// different capitals.
const links = [`${root}`, `${root}/assignments/1`, '', `${base}/courses/99/pages/x`,
  `${root}/pages/old-page`, `${root}/pages/LAB-SAFETY`, ''];
const plan = c.planContentList_(items, links, '7');
check('matches by link (home link, capitals ignored)', [...plan.matches.entries()]
  .map(([i, item]) => [i, item.name]), [[0, 'Welcome'], [1, 'Lab 1'], [5, 'Lab Safety']]);
check('new items: everything not already on the tab', plan.newItems.map(i => i.name),
  ['Syllabus', 'No URL', 'Graded talk']);
check('rows for this course no longer in Canvas', plan.gone, 1);
check('new rows go after the last row with a link', plan.lastLinkIndex, 5);
check('empty tab', (({ newItems, lastLinkIndex }) => [newItems.length, lastLinkIndex])(
  c.planContentList_(items, [], '7')), [6, -1]);

const columns = new Map([['Canvas Link', 1], ['Type', 4], ['Name', 2], ['Canvas Updated', 6]]);
const info = c.contentInfoColumns_(columns);
check('info columns only where labeled', info.map(col => col.column), [2, 4, 6]);
check('info values', info.map(col => col.value(items.slice(2, 3)[0])).map(v =>
  (v instanceof Date || (v && v.toISOString) ? v.toISOString() : v)),
['Lab 1', 'Assignment', '2026-10-01T10:00:00.000Z']);
check('no date → blank', info.slice(2, 3)[0].value(items.slice(0, 1)[0]), '');

// ---- Step 3: changed since export ----
const updated = when => ({ updated: when });
const flagMatches = new Map([
  [0, updated('2026-10-20T10:00:00Z')], // edited after export → mark
  [1, updated('2026-10-01T10:00:00Z')], // not edited since → no mark
  [2, updated('')], // discussion: no Canvas date → no mark
  [3, updated('2026-10-20T10:00:00Z')], // no Doc yet → not looked at
  [4, updated('2026-10-20T10:00:00Z')], // no Exported date → no mark
]);
const flags = c.planChangeFlags_(flagMatches,
  [['doc'], ['doc'], ['doc'], [''], ['doc']],
  [[new Date('2026-10-10T00:00:00Z')], [new Date('2026-10-10T00:00:00Z')],
    [new Date('2026-10-10T00:00:00Z')], [''], ['']]);
check('changed only when Canvas date is after Exported', [...flags.entries()],
  [[0, true], [1, false], [2, false], [4, false]]);
const marks = c.applyChangeFlags_(flags,
  [['#ffffff'], ['#FFF2CC'], ['#d9ead3'], ['#fff2cc'], ['#fff2cc']],
  [[''], ['Changed in Canvas since export'], ['my note'], ['x'], ['']]);
check('marks: changed row yellow + note; old marks removed; other colors and notes kept',
  [marks.backgrounds, marks.notes, marks.changed, marks.touched], [
    [['#fff2cc'], [null], ['#d9ead3'], ['#fff2cc'], [null]],
    [['Changed in Canvas since export'], [''], ['my note'], ['x'], ['']], 1, true]);
check('nothing to change: nothing written', c.applyChangeFlags_(new Map([[0, false]]),
  [['#ffffff']], [['']]).touched, false);
check('Canvas date text and sheet dates both read', [c.sheetDate_('2026-10-20T10:00:00Z')
  .toISOString(), c.sheetDate_(''), c.sheetDate_('soon')], ['2026-10-20T10:00:00.000Z', null, null]);

// ---- Export with a Back up? column: only ticked rows ----
const exp = c.planExports_([[`${root}/assignments/1`], [`${root}/pages/a`], [`${root}/pages/b`],
  ['']], [[''], [''], ['https://docs.google.com/document/d/x/edit'], ['']], 4,
[[true], [false], [true], [true]]);
check('ticked rows only; Doc rows still count as done', [exp.exports.map(e => e.row),
  exp.notTicked, exp.alreadyDone], [[4], 1, 1]);
check('no Back up? column: every row as before', c.planExports_([[`${root}/pages/a`]], [['']],
  4).exports.length, 1);

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.');
process.exitCode = failures ? 1 : 0;
