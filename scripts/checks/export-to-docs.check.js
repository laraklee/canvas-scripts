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

// ---- Addresses behind blue links ----
const rich = (cellLink, runLinks) => ({
  getLinkUrl: () => cellLink || null,
  getRuns: () => (runLinks || []).map(link => ({ getLinkUrl: () => link })),
});
check('blue link: the hidden address, not the text you see', c.cellLinks_(
  [[rich(`${base}/courses/1/assignments/9`)], [rich(null, [null, `${base}/courses/1/pages/p`])],
    [null], [rich(null, [null])]],
  [[''], [''], [`=HYPERLINK("${base}/courses/1/discussion_topics/3", "Discuss")`], ['']],
  [['Lab 3'], ['See the page'], ['Discuss'], [`${base}/courses/1/assignments/4`]]),
[[`${base}/courses/1/assignments/9`], [`${base}/courses/1/pages/p`],
  [`${base}/courses/1/discussion_topics/3`], [`${base}/courses/1/assignments/4`]]);

// ---- Folder links ----
check('folder link', c.folderIdFromLink_('https://drive.google.com/drive/folders/abc-123_X?usp=x'),
  'abc-123_X');
check('open?id= link', c.folderIdFromLink_('https://drive.google.com/open?id=Zz9'), 'Zz9');
check('not a folder link', c.folderIdFromLink_('my folder'), '');

// ---- Finding the table ----
const grid = [
  ['Folder Name:', 'Gastro pages', 'https://drive.google.com/drive/folders/abc', '', ''],
  ['', '', '', '', ''],
  ['Canvas Link', 'Name', 'Google Doc', 'Exported', 'Notes'],
];
const table = c.findExportTable_(grid);
check('label row found below the folder cells', table.headerRow, 3);
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

// ---- Drive (faked Advanced Drive service) ----
const driveCalls = [];
c.Utilities = { newBlob: (text, type, name) => ({ text, type, name }) };
c.Drive = { Files: {
  create: (resource, blob) => {
    driveCalls.push([resource, blob]);
    return { id: blob ? 'doc1' : 'fold1' };
  },
  get: id => {
    if (id === 'gone') throw new Error('API call to drive.files.get failed with error: File not found: gone');
    return { id, name: 'Old', mimeType: 'application/vnd.google-apps.folder', trashed: id === 'binned' };
  },
} };
function fakeSheet(cells) {
  return { getRange: a1 => ({
    getDisplayValue: () => cells[a1] || '',
    setValue: value => { cells[a1] = value; },
  }) };
}
const cells = { B1: 'Gastro pages' };
check('new folder: made from B1, link written to C1', c.exportFolder_(fakeSheet(cells)),
  { id: 'fold1', name: 'Gastro pages', created: true });
check('folder link in C1', cells.C1, 'https://drive.google.com/drive/folders/fold1');
check('folder request', driveCalls.slice(-1)[0],
  [{ name: 'Gastro pages', mimeType: 'application/vnd.google-apps.folder' }, null]);
check('existing folder in C1 is used, nothing made',
  [c.exportFolder_(fakeSheet({ C1: 'https://drive.google.com/drive/folders/keep' })),
    driveCalls.length], [{ id: 'keep', name: 'Old', created: false }, 1]);
throws('folder not found', () => c.exportFolder_(fakeSheet({
  C1: 'https://drive.google.com/drive/folders/gone' })), /can't use the folder in C1/);
throws('folder in the trash', () => c.exportFolder_(fakeSheet({
  C1: 'https://drive.google.com/drive/folders/binned' })), /can't use the folder in C1/);
throws('no name in B1', () => c.exportFolder_(fakeSheet({})), /name for the Docs folder in B1/);

check('Doc made from HTML in the folder', c.createDocFromHtml_('Lab', 'fold1', '<p>x</p>'),
  { id: 'doc1', webViewLink: 'https://docs.google.com/document/d/doc1/edit' });
check('Doc request converts HTML', driveCalls.slice(-1)[0], [
  { name: 'Lab', mimeType: 'application/vnd.google-apps.document', parents: ['fold1'] },
  { text: '<p>x</p>', type: 'text/html', name: 'export.html' }]);
throws('Drive refusal explains itself', () => c.driveStep_('making a Doc', () => {
  throw new Error('API call to drive.files.create failed with error: Access Not Configured.');
}), /^Google Drive refused making a Doc: Access Not Configured\.$/);

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.');
process.exitCode = failures ? 1 : 0;
