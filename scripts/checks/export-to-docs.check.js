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
check('course home link', c.parseCanvasContentLink_(`${base}/courses/4939`),
  { type: 'front_page', courseId: '4939', itemId: '' });
check('course home link with slash, wiki, or ?', [`${base}/courses/1/`, `${base}/courses/1/wiki`,
  `${base}/courses/1?x=1`].map(link => c.parseCanvasContentLink_(link).type),
['front_page', 'front_page', 'front_page']);
check('syllabus link', c.parseCanvasContentLink_(`${base}/courses/1/assignments/syllabus`),
  { type: 'syllabus', courseId: '1', itemId: '' });
check('other course areas not taken for home', [`${base}/courses/1/modules`,
  `${base}/courses/12345x`].map(link => c.parseCanvasContentLink_(link)), [null, null]);
check('no front page: clear note', c.exportRefusedNote_('NOT_FOUND', 'front_page'),
  'Not exported: this course has no front page (its home is not set to a Page)');
check('quiz link not supported', c.parseCanvasContentLink_(`${base}/courses/11/quizzes/4`), null);
check('assignment ID must be a number',
  c.parseCanvasContentLink_(`${base}/courses/11/assignments/new`), null);
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
check('labels ignore capitals and extra spaces', [...c.findExportTable_(
  [['canvas link', ' Google  Doc ', 'Back Up?', 'CANVAS UPDATED']]).columns.entries()],
[['Canvas Link', 1], ['Google Doc', 2], ['Canvas Updated', 4], ['Back up?', 3]]);
check('confirm text: ticked rows', c.exportConfirmText_(
  { exports: [1, 2], notTicked: 96, alreadyDone: 1 }),
'Make 2 Google Doc(s)?\n\nThese are the rows ticked "Back up?" that have no Google Doc yet. ' +
'96 unticked row(s) are skipped.\n1 row(s) already have a Doc and are skipped.\n\nAbout a ' +
'few seconds per Doc; a long list stops near 5 minutes (run Export again for the rest).');
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

// ---- Pictures stored in Canvas ----
check('Canvas file picture: relative address', c.canvasImageFileId_('/courses/1/files/55/preview', base), '55');
check('Canvas file picture: full address with &amp;',
  c.canvasImageFileId_(`${base}/courses/1/files/56/download?a=1&amp;verifier=x`, base), '56');
check('picture on another site left alone',
  c.canvasImageFileId_('https://pics.example.com/files/57/cat.png', base), '');
check('protocol-relative address left alone', c.canvasImageFileId_('//evil.example/files/58', base), '');
check('Canvas address that is not a file', c.canvasImageFileId_('/images/icon.png', base), '');

const loads = [];
const embedded = c.embedCanvasImages_(
  '<p><img alt="a" src="/courses/1/files/55/preview"> <IMG src=\'https://pics.example.com/x.png\'>' +
  `<img src="${base}/courses/1/files/99/preview" width="20"></p>`, base,
  id => { loads.push(id); return id === '55' ? { type: 'image/png', base64: 'QUJD' } : null; });
check('Canvas picture put inside, other site untouched, failed one left as is', embedded.html,
  '<p><img alt="a" src="data:image/png;base64,QUJD"> <IMG src=\'https://pics.example.com/x.png\'>' +
  `<img src="${base}/courses/1/files/99/preview" width="20"></p>`);
check('picture counts', [embedded.embedded, embedded.missed], [1, 1]);
check('only Canvas pictures are looked up', loads, ['55', '99']);
check('no pictures: HTML unchanged', c.embedCanvasImages_('<p>Hi</p>', base, () => null),
  { html: '<p>Hi</p>', embedded: 0, missed: 0 });

let loaderCalls = 0;
const cached = c.cachedLoader_(id => { loaderCalls++; return id === '1' ? null : { id }; });
cached('1'); cached('1'); cached('2'); cached('2');
check('each picture looked up once, misses too', loaderCalls, 2);

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
// ---- Type subfolders ----
const listQueries = [];
const made = [];
c.Drive = { Files: {
  list: options => {
    listQueries.push(options.q);
    return { files: options.q.includes("name = 'Pages'") ? [{ id: 'pagesOld' }] : [] };
  },
  create: resource => {
    made.push([resource.name, resource.parents]);
    return { id: `new-${resource.name}` };
  },
} };
const folderFor = c.subfolderFinder_('top1');
check('each type to its folder; syllabus and home page at the top',
  ['assignments', 'assignments', 'discussion_topics', 'pages', 'syllabus', 'front_page']
    .map(folderFor),
  ['new-Assignments', 'new-Assignments', 'new-Discussions', 'pagesOld', 'top1', 'top1']);
check('existing subfolder reused, missing ones made inside the top folder', made,
  [['Assignments', ['top1']], ['Discussions', ['top1']]]);
check('each subfolder looked up once', listQueries.length, 3);
check('lookup asks for a live folder by name in the top folder', listQueries.slice(0, 1)[0],
  "'top1' in parents and name = 'Assignments' and " +
  "mimeType = 'application/vnd.google-apps.folder' and trashed = false");
throws('odd folder ID refused', () => c.subfolderFinder_("x' or '1")('pages'), /C1 looks wrong/);

throws('Drive refusal explains itself', () => c.driveStep_('making a Doc', () => {
  throw new Error('API call to drive.files.create failed with error: Access Not Configured.');
}), /^Google Drive refused making a Doc: Access Not Configured\.$/);

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.');
process.exitCode = failures ? 1 : 0;
