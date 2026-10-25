/**
 * scripts/checks/export-to-docs.check.js
 * Purpose: offline check of the Export to Google Docs helpers in ExportToDocs.js, using
 *   MADE-UP links, IDs, and content only (nothing is sent anywhere; Canvas and Drive are
 *   faked). Run with the others: npm run check-offline.
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
// Same order Google loads them (by file name). QuizQuestions.js supplies escapeHtml_.
vm.runInContext(['CanvasApi.js', 'ExportToDocs.js', 'QuizQuestions.js']
  .map(file => fs.readFileSync(path.join(PROJECT, file), 'utf8')).join('\n'), context);
const c = context;

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}` +
    (ok ? '' : `\n      expected ${JSON.stringify(expected)}\n      got      ${JSON.stringify(actual)}`));
}
function throws(label, work, pattern) {
  let message = '';
  try { work(); } catch (error) { message = error.message; }
  check(label, pattern.test(message), true);
}

// ---- Canvas links ----
const base = 'https://canvas.example.edu';
check('assignment link', c.parseCanvasContentLink_(`${base}/courses/11/assignments/22`),
  { type: 'assignments', courseId: '11', itemId: '22' });
check('discussion link with extra bits after it',
  c.parseCanvasContentLink_(`${base}/courses/11/discussion_topics/33?module_item_id=5#top`),
  { type: 'discussion_topics', courseId: '11', itemId: '33' });
check('page link keeps its URL name (decoded)',
  c.parseCanvasContentLink_(`${base}/courses/11/pages/lab-safety%20rules/edit`),
  { type: 'pages', courseId: '11', itemId: 'lab-safety rules' });
check('quiz link not supported', c.parseCanvasContentLink_(`${base}/courses/11/quizzes/4`), null);
check('assignment ID must be a number',
  c.parseCanvasContentLink_(`${base}/courses/11/assignments/syllabus`), null);
check('a bare ID is not a link', c.parseCanvasContentLink_('22'), null);
check('broken %-code in a page name', c.parseCanvasContentLink_(`${base}/courses/1/pages/a%zz`),
  null);

// ---- Folder links ----
check('folder link', c.folderIdFromLink_('https://drive.google.com/drive/folders/abc-123_X?usp=x'),
  'abc-123_X');
check('open?id= link', c.folderIdFromLink_('https://drive.google.com/open?id=Zz9'), 'Zz9');
check('not a folder link', c.folderIdFromLink_('my folder'), '');

// ---- Finding the table ----
const grid = [
  ['Export', '', '', '', ''],
  ['Folder name', 'Gastro pages', '', '', ''],
  ['Folder link', '', '', '', ''],
  ['', '', '', '', ''],
  ['Canvas Link', 'Name', 'Google Doc', 'Exported', 'Notes'],
];
const table = c.findExportTable_(grid);
check('label row found below the folder cells', table.headerRow, 5);
check('columns by label', [...table.columns.entries()],
  [['Canvas Link', 1], ['Google Doc', 3], ['Name', 2], ['Exported', 4]]);
check('Name and Exported are optional',
  [...c.findExportTable_([['Google Doc', 'Canvas Link']]).columns.entries()],
  [['Canvas Link', 2], ['Google Doc', 1]]);
throws('no Canvas Link label', () => c.findExportTable_([['Name']]), /no "Canvas Link"/);
throws('no Google Doc label', () => c.findExportTable_([['Canvas Link']]), /needs a "Google Doc"/);
throws('a label twice', () => c.findExportTable_([['Canvas Link', 'Google Doc', 'Name', 'Name']]),
  /more than once/);

// ---- Which rows ----
const links = [[`${base}/courses/1/pages/p1`], [''], [`${base}/courses/1/assignments/9`],
  ['not a link'], [`${base}/courses/1/discussion_topics/7`]];
const docs = [[''], [''], ['https://docs.google.com/document/d/x/edit'], [''], ['']];
const plan = c.planExports_(links, docs, 6);
check('rows to export: skips blank and already-done rows', plan.exports.map(e => e.row), [6, 10]);
check('export items carry type and IDs', plan.exports.map(e => [e.type, e.itemId]),
  [['pages', 'p1'], ['discussion_topics', '7']]);
check('bad links listed by row', plan.badLinks, [9]);
check('already done counted', plan.alreadyDone, 1);

// ---- Running the exports ----
function fakeRun(items, readResults, times) {
  const log = [];
  let clock = 0;
  const result = c.runExports_(items,
    item => {
      const r = readResults[item.row];
      if (r instanceof Error) throw r;
      return r;
    },
    item => ({ webViewLink: `doc-${item.row}` }),
    (item, content, doc) => log.push(['done', item.row, content.title, doc.webViewLink]),
    (item, error) => log.push(['refused', item.row, c.exportRefusedNote_(error.canvasType)]),
    { started: 0, now: () => (times ? times[clock++] : 0) });
  return { result, log };
}
const err = type => Object.assign(new Error('x'), { canvasType: type });
const items = [{ row: 6 }, { row: 7 }, { row: 8 }];
const run = fakeRun(items, { 6: { title: 'A' }, 7: err('NOT_FOUND'), 8: { title: 'C' } });
check('a 404 row is refused, the others still go', run.log, [
  ['done', 6, 'A', 'doc-6'],
  ['refused', 7, 'Not exported: not found in Canvas (404)'],
  ['done', 8, 'C', 'doc-8'],
]);
check('counts', run.result, { made: 2, refusedRows: [7], notStarted: 0 });
throws('a token problem stops everything',
  () => fakeRun(items, { 6: err('TOKEN_REJECTED') }), /x/);
const late = fakeRun(items, { 6: { title: 'A' } }, [0, 6 * 60 * 1000]);
check('stops near the time limit', late.result, { made: 1, refusedRows: [], notStarted: 2 });
check('refused note for other HTTP errors', c.exportRefusedNote_('HTTP_500'),
  'Not exported: Canvas error (HTTP 500)');

// ---- The Doc's HTML ----
const html = c.buildExportHtml_({ title: 'Lab <1> & "safety"', html: '<p>Hi</p>',
  url: `${base}/courses/1/pages/p1?a="b"` }, 'pasted');
check('title escaped, link back to Canvas, content kept', html,
  '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Lab &lt;1&gt; &amp; "safety"' +
  '</title></head><body><h1>Lab &lt;1&gt; &amp; "safety"</h1><p><a href="' +
  `${base}/courses/1/pages/p1?a=&quot;b&quot;">Open in Canvas</a></p><p>Hi</p></body></html>`);
check('empty content says so, falls back to pasted link',
  c.buildExportHtml_({ title: '', html: '  ', url: '' }, 'pasted').includes(
    '<h1>Untitled (from Canvas)</h1><p><a href="pasted">Open in Canvas</a></p>' +
    '<p>(No content in Canvas.)</p>'), true);

// ---- Drive upload body ----
check('upload body: settings then HTML',
  c.multipartBody_('B', { name: 'N', parents: ['f'] }, '<p>x</p>'),
  '--B\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{"name":"N","parents":["f"]}' +
  '\r\n--B\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n<p>x</p>\r\n--B--');

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.');
process.exitCode = failures ? 1 : 0;
