/**
 * scripts/checks/quiz-check.check.js
 * Purpose: offline check of "Quiz Check": the window's slice-by-slice zip
 *   reader (QuizCheckUpload.html, script id="zip-slice-reader") on a MADE-UP course export
 *   this check builds itself (ZIP64 records, like Canvas's), the gzip it sends, and
 *   QuizCheck.js unpacking it and summing up each quiz. Nothing is sent anywhere; Canvas
 *   and Google are not called (Utilities is stubbed with Node's zlib).
 *   Run with the others: npm run check-offline.
 *   Repo helper only: not part of any Apps Script project; never clasp-pushed.
 * Canvas endpoints called: none. Canvas write operations: none.
 * Required User/Script Properties: none.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const zlib = require('zlib');

const PROJECT = path.join(__dirname, '..', '..', 'course-manager-jupiter');

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}` +
    (ok ? '' : `\n      expected ${JSON.stringify(expected)}\n      got      ${JSON.stringify(actual)}`));
}

/**
 * A minimal zip: entries [{ name, data (Buffer), method 0 or 8, zip64 }]; CRCs left 0 (the
 * reader doesn't check them). zip64 entries keep their sizes and offset in a ZIP64 extra
 * field; zip64End writes a ZIP64 end record and locator with 0xffff/0xffffffff in the
 * normal end record, the way Canvas writes its course exports.
 */
function makeZip(entries, zip64End) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  entries.forEach(entry => {
    const name = Buffer.from(entry.name, 'utf8');
    const packed = entry.method === 8 ? zlib.deflateRawSync(entry.data) : entry.data;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(entry.method, 8);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    let extra = Buffer.alloc(0);
    if (entry.zip64) {
      extra = Buffer.alloc(28);
      extra.writeUInt16LE(1, 0);
      extra.writeUInt16LE(24, 2);
      extra.writeBigUInt64LE(BigInt(entry.data.length), 4);
      extra.writeBigUInt64LE(BigInt(packed.length), 12);
      extra.writeBigUInt64LE(BigInt(offset), 20);
    }
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(entry.method, 10);
    central.writeUInt32LE(entry.zip64 ? 0xffffffff : packed.length, 20);
    central.writeUInt32LE(entry.zip64 ? 0xffffffff : entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(extra.length, 30);
    central.writeUInt32LE(entry.zip64 ? 0xffffffff : offset, 42);
    locals.push(local, name, packed);
    centrals.push(central, name, extra);
    offset += 30 + name.length + packed.length;
  });
  const directory = Buffer.concat(centrals);
  const tail = [];
  if (zip64End) {
    const end64 = Buffer.alloc(56);
    end64.writeUInt32LE(0x06064b50, 0);
    end64.writeBigUInt64LE(44n, 4);
    end64.writeBigUInt64LE(BigInt(entries.length), 24);
    end64.writeBigUInt64LE(BigInt(entries.length), 32);
    end64.writeBigUInt64LE(BigInt(directory.length), 40);
    end64.writeBigUInt64LE(BigInt(offset), 48);
    const locator = Buffer.alloc(20);
    locator.writeUInt32LE(0x07064b50, 0);
    locator.writeBigUInt64LE(BigInt(offset + directory.length), 8);
    locator.writeUInt32LE(1, 16);
    tail.push(end64, locator);
  }
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(zip64End ? 0xffff : entries.length, 8);
  end.writeUInt16LE(zip64End ? 0xffff : entries.length, 10);
  end.writeUInt32LE(zip64End ? 0xffffffff : directory.length, 12);
  end.writeUInt32LE(zip64End ? 0xffffffff : offset, 16);
  return Buffer.concat([...locals, directory, ...tail, end]);
}

// The window's reader, run here (Node has the same Blob, DecompressionStream, CompressionStream).
const html = fs.readFileSync(path.join(PROJECT, 'QuizCheckUpload.html'), 'utf8');
vm.runInThisContext(html.match(/<script id="zip-slice-reader">([\s\S]*?)<\/script>/)[1]);
const win = name => vm.runInThisContext(name);

/**
 * A pretend workbook: tabs are { name, cells: { 'r,c': value }, colors: { 'r,c': color },
 * frozen: [rows, cols], active }. Only the calls QuizCheck.js makes are here; ranges are
 * chainable and record values, backgrounds, and A1.
 */
function makeWorkbook() {
  const tabs = [];
  const makeTab = name => {
    const tab = { name, cells: {}, colors: {}, links: {}, frozen: [0, 0], maxRows: 1000, maxCols: 26, active: false };
    const range = (row, col, rows = 1, cols = 1) => {
      const each = fn => { for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) fn(`${row + i},${col + j}`); };
      const r = {
        setValues: values => { values.forEach((line, i) => line.forEach((v, j) => { tab.cells[`${row + i},${col + j}`] = v; })); return r; },
        setValue: v => { tab.cells[`${row},${col}`] = v; return r; },
        setBackground: color => { each(key => { tab.colors[key] = color; }); return r; },
        setRichTextValue: v => { tab.cells[`${row},${col}`] = v.text; tab.links[`${row},${col}`] = v.url; return r; },
        clear: () => { each(key => { delete tab.cells[key]; delete tab.colors[key]; delete tab.links[key]; }); return r; },
        setBackgrounds: colors => { colors.forEach((line, i) => line.forEach((v, j) => { tab.colors[`${row + i},${col + j}`] = v; })); return r; },
        getDisplayValue: () => String(tab.cells[`${row},${col}`] ?? ''),
        setRichTextValues: values => { values.forEach((line, i) => line.forEach((v, j) => {
          tab.cells[`${row + i},${col + j}`] = v.text;
          tab.links[`${row + i},${col + j}`] = v.url;
        })); return r; },
      };
      ['setNumberFormat', 'setFontWeight', 'setWrap', 'setVerticalAlignment', 'setHorizontalAlignment', 'clearNote']
        .forEach(fn => { r[fn] = () => r; });
      return r;
    };
    tab.sheet = {
      getName: () => tab.name,
      getRange: (a, ...rest) => (a === 'A1' ? range(1, 1) : range(a, ...rest)),
      clear: () => { tab.cells = {}; tab.colors = {}; tab.links = {}; },
      setFrozenRows: n => { tab.frozen[0] = n; },
      setFrozenColumns: n => { tab.frozen[1] = n; },
      getMaxRows: () => tab.maxRows,
      getMaxColumns: () => tab.maxCols,
      insertRowsAfter: (at, n) => { tab.maxRows += n; },
      insertColumnsAfter: (at, n) => { tab.maxCols += n; },
      setColumnWidth: () => {},
      hideColumns: () => {},
      activate: () => { tabs.forEach(t => { t.active = t === tab; }); },
    };
    tabs.push(tab);
    return tab;
  };
  return {
    tabs,
    makeTab,
    app: { getActiveSpreadsheet: () => ({
      getSheetByName: name => (tabs.find(t => t.name === name) || {}).sheet || null,
      insertSheet: name => makeTab(name).sheet,
    }) },
  };
}
let workbook = makeWorkbook();

/**
 * Pretend course setup for links (RefSheets.js isn't loaded here): the workbook's course,
 * the assignment list the refresh would write, and whether the refresh fails. Real pairs
 * from Lara's 11/9 Biology export (identifiers and numbers only): Classic quiz "PreLab
 * 1.5D" names assignment g6f7ff8… = 251474; New Quiz "CK12 1.4-1.5" is ga182b8… = 270391.
 */
const REAL_CLASSIC_ASSIGNMENT = 'g6f7ff847b3a8e0ee6ae31cc24e2ae8dc';
const REAL_NEW_QUIZ = 'ga182b825ffcd39b95c6746afae537002';
const ROOT_ACCOUNT = '157500000000000001';
const URL_251474 = 'https://canvas.example.edu/courses/4791/assignments/251474';
let setup = {};
const resetSetup = () => {
  setup = {
    courseId: '4791',
    refreshFails: false,
    refreshed: 0,
    list: [{ assignmentId: '251474', url: URL_251474 }, { assignmentId: '999', url: 'https://canvas.example.edu/x/999' }],
  };
};
resetSetup();

// The workbook side: QuizReport.js + QtiReader.js + QuizExportReport.js + QuizCheck.js.
const context = {
  SpreadsheetApp: {
    getActiveSpreadsheet: () => workbook.app.getActiveSpreadsheet(),
    newRichTextValue: () => {
      const v = { text: '', url: '' };
      const b = { setText: t => { v.text = t; return b; }, setLinkUrl: u => { v.url = u; return b; }, build: () => ({ ...v }) };
      return b;
    },
  },
  sheetProblem_: message => Object.assign(new Error(message), { isSheetProblem: true }),
  describeCanvasError_: error => error.message,
  getCourseIdForRefresh_: () => {
    if (!setup.courseId) throw context.sheetProblem_('cfg_CourseID must be a Canvas course number.');
    return setup.courseId;
  },
  writeAssignmentGroupsSheet_: () => {
    if (setup.refreshFails) throw context.sheetProblem_('Canvas returned an error for the assignment groups request. Not authorized.');
    setup.refreshed++;
    return {};
  },
  readAssignmentGroups_: () => setup.list,
  console: { log: () => {}, error: () => {} },
  Utilities: {
    base64Decode: text => Buffer.from(text, 'base64'),
    newBlob: bytes => ({ bytes }),
    ungzip: blob => ({ getDataAsString: () => zlib.gunzipSync(blob.bytes).toString('utf8') }),
    // Apps Script returns signed bytes; so does this.
    computeDigest: (algorithm, text) => [...require('crypto').createHash(algorithm).update(text, 'utf8').digest()]
      .map(b => (b > 127 ? b - 256 : b)),
    DigestAlgorithm: { MD5: 'md5' },
    Charset: { UTF_8: 'utf8' },
  },
};
vm.createContext(context);
vm.runInContext(['QuizReport.js', 'QtiReader.js', 'QuizExportReport.js', 'QuizCheck.js']
  .map(file => fs.readFileSync(path.join(PROJECT, file), 'utf8')).join('\n'), context);
const c = context;

// --- A made-up course export: two quizzes, a bank, settings, pictures, a page ---
const item = (id, stem, points) => `<item ident="${id}" title="Question"><itemmetadata><qtimetadata>
<qtimetadatafield><fieldlabel>question_type</fieldlabel><fieldentry>multiple_choice_question</fieldentry></qtimetadatafield>
<qtimetadatafield><fieldlabel>points_possible</fieldlabel><fieldentry>${points}</fieldentry></qtimetadatafield>
</qtimetadata></itemmetadata><presentation><material><mattext texttype="text/html">${stem.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')}</mattext></material>
<response_lid ident="r"><render_choice><response_label ident="${id}0"><material><mattext>A</mattext></material></response_label>
<response_label ident="${id}1"><material><mattext>B</mattext></material></response_label></render_choice></response_lid></presentation>
<resprocessing><respcondition><conditionvar><varequal respident="r">${id}0</varequal></conditionvar><setvar varname="SCORE">100</setvar></respcondition></resprocessing></item>`;
const quizA = `<questestinterop><assessment ident="ga" title="A"><section ident="root_section">
${item('a1', '<p>Fine <img src="$IMS-CC-FILEBASE$/Quiz%20Pics/ok.png"></p>', 2)}
<section ident="s" title="From bank"><selection_ordering><selection><sourcebank_ref>gbank</sourcebank_ref><selection_number>1</selection_number>
<selection_extension><points_per_item>3.0</points_per_item></selection_extension></selection></selection_ordering></section>
</section></assessment></questestinterop>`;
const quizB = `<questestinterop><assessment ident="gb" title="B"><section ident="root_section">
${item('b1', '<p>Fine</p>', 4)}
</section></assessment></questestinterop>`;
const bank = `<questestinterop><objectbank ident="gbank"><qtimetadata><qtimetadatafield><fieldlabel>bank_title</fieldlabel>
<fieldentry>Bank</fieldentry></qtimetadatafield></qtimetadata>${item('k1', '<p>Last year <img src="/courses/4230/files/5/preview"></p>', '')}</objectbank></questestinterop>`;
const entries = [
  { name: 'ga/', data: Buffer.alloc(0), method: 0 },
  { name: 'ga/assessment_meta.xml', data: Buffer.from(`<quiz identifier="ga"><title>Quiz A</title><points_possible>5.0</points_possible><assignment identifier="${REAL_CLASSIC_ASSIGNMENT}"><title>Quiz A</title><workflow_state>published</workflow_state></assignment></quiz>`), method: 8 },
  { name: 'ga/assessment_qti.xml', data: Buffer.from('<questestinterop/>'), method: 8 },
  { name: 'gb/assessment_meta.xml', data: Buffer.from('<quiz><title>Quiz B</title><points_possible>9.0</points_possible><workflow_state>unpublished</workflow_state></quiz>'), method: 0 },
  { name: 'non_cc_assessments/ga.xml.qti', data: Buffer.from(quizA), method: 8, zip64: true },
  { name: 'non_cc_assessments/gb.xml.qti', data: Buffer.from(quizB), method: 8 },
  { name: 'non_cc_assessments/gbank.xml.qti', data: Buffer.from(bank), method: 8 },
  { name: 'course_settings/context.xml', data: Buffer.from(`<context_info><course_id>4791</course_id><root_account_id>${ROOT_ACCOUNT}</root_account_id></context_info>`), method: 8 },
  { name: 'course_settings/files_meta.xml', data: Buffer.from('<fileMeta><folders/><files/></fileMeta>'), method: 8 },
  { name: 'course_settings/rubrics.xml', data: Buffer.from('<rubrics/>'), method: 8 },
  { name: 'imsmanifest.xml', data: Buffer.from('<manifest><resource identifier="f1" href="web_resources/Quiz Pics/ok.png"/></manifest>'), method: 8 },
  { name: 'wiki_content/page.html', data: Buffer.from('<p>page</p>'), method: 8 },
  { name: 'web_resources/Quiz Pics/ok.png', data: Buffer.alloc(3000, 1), method: 0, zip64: true },
];
const courseZip = new Blob([makeZip(entries, true)]);

(async () => {
  const read = await win('readQuizCheckFile')(courseZip);
  check('course export found (ZIP64 end record and entries read)', read.courseExport, true);
  check('only the files the reader needs were unpacked', Object.keys(read.texts).sort(), [
    'course_settings/context.xml', 'course_settings/files_meta.xml', 'ga/assessment_meta.xml', 'gb/assessment_meta.xml',
    'imsmanifest.xml', 'non_cc_assessments/ga.xml.qti', 'non_cc_assessments/gb.xml.qti', 'non_cc_assessments/gbank.xml.qti']);
  check('texts read whole (deflated, stored, ZIP64)', [read.texts['non_cc_assessments/ga.xml.qti'] === quizA,
    read.texts['gb/assessment_meta.xml'].includes('Quiz B')], [true, true]);
  check('every file\'s size, folders skipped', [Object.keys(read.sizes).length, read.sizes['web_resources/Quiz Pics/ok.png']], [12, 3000]);
  const names = entries.map(e => e.name).concat(['x/y/assessment_meta.xml', 'non_cc_assessments/sub/z.xml.qti']);
  check('window and reader agree on which files are needed',
    names.map(win('quizCheckWantsText')), names.map(c.qtiCourseExportText_));

  let message = '';
  try { await win('readQuizCheckFile')(new Blob(['not a zip at all, just text'])); } catch (e) { message = e.message; }
  check('a non-zip file gets a teacher-friendly message', message.startsWith('That file isn\'t a Canvas export'), true);

  // A single-quiz export (no non_cc quiz files): every .xml/.qti is read, as before.
  const single = await win('readQuizCheckFile')(new Blob([makeZip([
    { name: 'gq/gq.xml', data: Buffer.from(quizB), method: 8 },
    { name: 'gq/assessment_meta.xml', data: Buffer.from('<quiz><title>Solo</title><points_possible>4</points_possible></quiz>'), method: 8 },
    { name: 'non_cc_assessments/gbank.xml.qti', data: Buffer.from(bank), method: 8 },
  ], false)]));
  check('single-quiz export: not a course export, all quiz files read', [single.courseExport, Object.keys(single.texts).length], [false, 3]);

  // What the window sends, and what the workbook does with it.
  const gzip = await win('quizCheckGzipBase64')(JSON.stringify({ texts: read.texts, sizes: read.sizes }));
  check('gzip round trip', JSON.parse(zlib.gunzipSync(Buffer.from(gzip, 'base64')).toString('utf8')).texts['imsmanifest.xml'],
    read.texts['imsmanifest.xml']);
  const result = c.receiveCourseExport({ fileName: 'biology-export.imscc', gzip });
  check('workbook: ok, course export, quizzes in order', [result.ok, result.courseExport, result.quizzes.map(q => q.title)],
    [true, true, ['Quiz A', 'Quiz B']]);
  check('workbook: Quiz A summary (bank picture from another course → red)', result.quizzes[0], {
    id: 'ga', title: 'Quiz A', published: true, points: 5, pointsFound: 5, pointsOk: true, questions: 2, pictures: 2,
    rows: 1, level: 'problem', kinds: [['picture from another course', 1]], url: URL_251474 });
  check('workbook: Quiz B summary (points 4 vs 9 → red, unpublished)',
    [result.quizzes[1].published, result.quizzes[1].pointsOk, result.quizzes[1].rows, result.quizzes[1].level,
      result.quizzes[1].kinds], [false, false, 0, 'problem', [['points add up to 4, not 9', 0]]]);
  check('workbook: message', result.message, 'Checked 2 quiz(zes) from "biology-export.imscc". See the "Quiz Check" tab: ' +
    '2 need fixing (red), 0 have suggestions (orange), 0 look fine.\n\n1 of 2 quiz names link to their page in Canvas. ' +
    '1 aren\'t linked: ungraded quizzes (such as practice quizzes) aren\'t Canvas assignments.');
  check('links: assignment list refreshed once, before linking', setup.refreshed, 1);

  // The overview tab.
  const tab = workbook.tabs.find(t => t.name === 'Quiz Check');
  check('tab: made, shown, header and quiz column frozen', [Boolean(tab), tab && tab.active, tab && tab.frozen], [true, true, [4, 1]]);
  check('tab: top rows', [tab.cells['1,1'], tab.cells['1,2'], tab.cells['2,1'], tab.cells['3,2']],
    ['Quiz Check:', 'biology-export.imscc', 'Checked', '2: 2 need fixing (red), 0 have suggestions (orange), 0 look fine']);
  check('tab: headers', [1, 2, 3, 4, 5, 6, 7, 8].map(col => tab.cells[`4,${col}`]),
    ['Quiz', 'Published', 'Points', 'Points found', 'Questions', 'Pictures', 'Rows to look at', 'What to look at']);
  check('tab: one row per quiz', [1, 2, 3, 4, 5, 6, 7, 8].map(col => tab.cells[`5,${col}`]),
    ['Quiz A', 'Yes', 5, 5, 2, 2, 1, 'picture from another course (1)']);
  check('tab: unpublished, points line', [tab.cells['6,2'], tab.cells['6,8']], ['No', 'points add up to 4, not 9']);
  check('tab: red rows, whole width', [tab.colors['5,1'], tab.colors['5,8'], tab.colors['6,8']], ['#f4cccc', '#f4cccc', '#f4cccc']);
  check('tab: Quiz A\'s name links to Canvas, Quiz B\'s is plain text', [tab.cells['5,1'], tab.links['5,1'], tab.cells['6,1'], tab.links['6,1']],
    ['Quiz A', URL_251474, 'Quiz B', '']);

  // Links: the real identifier pairs, and what happens when something's off.
  const md5 = c.quizCheckMd5Hex_;
  check('links: MD5 from Apps Script\'s signed bytes', md5('abc'), '900150983cd24fb0d6963f7d28e17f72');
  check('links: real Classic quiz assignment (251474) and New Quiz (270391) identifiers',
    [c.quizCheckAssignmentKeys_('251474', ROOT_ACCOUNT, md5)[0], c.quizCheckAssignmentKeys_('270391', ROOT_ACCOUNT, md5)[0]],
    [REAL_CLASSIC_ASSIGNMENT, REAL_NEW_QUIZ]);
  const nqUrl = 'https://canvas.example.edu/courses/4791/assignments/270391';
  check('links: a New Quiz matches by its own id; non-https and bad ids are skipped', [...c.quizCheckLinks_(
    [{ id: REAL_NEW_QUIZ, assignmentRef: '' }, { id: 'gother', assignmentRef: REAL_CLASSIC_ASSIGNMENT }],
    [{ assignmentId: '270391', url: nqUrl }, { assignmentId: '251474', url: 'javascript:alert(1)' }, { assignmentId: 'x', url: nqUrl }],
    ROOT_ACCOUNT, md5)], [[REAL_NEW_QUIZ, nqUrl]]);

  setup.refreshFails = true;
  const stale = c.receiveCourseExport({ fileName: 'b.imscc', gzip });
  check('links: refresh fails → list as it was still used, window says so',
    [stale.ok, stale.quizzes[0].url, stale.message.includes('The assignment list couldn\'t be refreshed from Canvas (Canvas returned an error'),
      stale.message.includes('quizzes made since the list was last refreshed')], [true, URL_251474, true, true]);
  resetSetup();
  setup.courseId = '5000';
  const other = c.receiveCourseExport({ fileName: 'b.imscc', gzip });
  check('links: export from another course → no refresh, no links, window says why',
    [other.ok, setup.refreshed, other.quizzes.every(q => !q.url), other.message.includes('this export is from course 4791, ' +
      'but this workbook is set up for course 5000')], [true, 0, true, true]);
  resetSetup();
  setup.courseId = '';
  const noCourse = c.receiveCourseExport({ fileName: 'b.imscc', gzip });
  check('links: no course set → check still works, window says why', [noCourse.ok,
    noCourse.message.includes('Quiz names aren\'t linked to Canvas: cfg_CourseID')], [true, true]);
  resetSetup();
  setup.list = [{ assignmentId: '251474', url: URL_251474 }, { assignmentId: '1', url: 'https://canvas.example.edu/1' }];
  check('links: nothing linked from a single-quiz export (no Canvas call)', [(await (async () => {
    setup.refreshed = 0;
    const r = c.receiveCourseExport({ fileName: 'solo.zip',
      gzip: await win('quizCheckGzipBase64')(JSON.stringify({ texts: single.texts, sizes: single.sizes })) });
    return [r.quizzes[0].url, r.message.includes('link')];
  })()), setup.refreshed], [['', false], 0]);
  resetSetup();

  // A second run replaces the tab; a "Quiz Check" tab used for something else is left alone.
  c.receiveCourseExport({ fileName: 'again.imscc', gzip });
  check('tab: rewritten, not duplicated', [workbook.tabs.filter(t => t.name === 'Quiz Check').length, tab.cells['1,2']],
    [1, 'again.imscc']);
  workbook = makeWorkbook();
  const theirs = workbook.makeTab('Quiz Check');
  theirs.cells['1,1'] = 'My quiz notes';
  const blocked = c.receiveCourseExport({ fileName: 'x.imscc', gzip });
  check('tab: someone else\'s "Quiz Check" tab → asked to rename, untouched',
    [blocked.ok, blocked.message.startsWith('There\'s already a "Quiz Check" tab'), theirs.cells['1,1']], [false, true, 'My quiz notes']);
  workbook = makeWorkbook();

  // Red, orange, fine; the order; a short name for each kind of problem.
  const made = (title, problems, pointsOk = true) => ({ id: title, title, published: true, points: 1, pointsFound: pointsOk ? 1 : 2,
    pointsOk, counts: { pictures: 0 }, entries: [{ kind: 'question', question: { problems } }] });
  const levels = [
    made('Shrink', ['Picture "a.png" is 1.2 MB: shrink it']),
    made('Worth', ['Picture "a.png" is 600 KB: worth shrinking']),
    made('Both', ['Picture "a.png" is 600 KB: worth shrinking', 'No correct answer marked']),
    made('Fine', []),
    made('Points', [], false),
  ].map(c.quizCheckSummary_);
  check('levels: shrink it red, worth shrinking orange, mixed red, fine plain, points red',
    levels.map(q => q.level), ['problem', 'suggestion', 'problem', '', 'problem']);
  check('order: red, orange, fine; A–Z with numbers in order', c.quizCheckSort_([
    { title: 'Unit 10', level: '' }, { title: 'unit 2', level: '' }, { title: 'Z', level: 'suggestion' },
    { title: 'B', level: 'problem' }, { title: 'a', level: 'problem' }]).map(q => q.title), ['a', 'B', 'Z', 'unit 2', 'Unit 10']);
  check('orange row colour', c.quizCheckOverview_([levels[1]], 'f', new Date(0)).colors, ['#fce5cd']);
  check('fine row: no colour', c.quizCheckOverview_([levels[3]], 'f', new Date(0)).colors, [null]);
  check('short names for every problem the reader writes', [
    'Picture "a b.png" is named in the question but isn\'t in the export (Canvas couldn\'t copy it, so students may not see it either)',
    'A picture is an old question-bank file (often broken for students): upload it again into the question',
    'A picture comes from an outside site (example.com): it can change or disappear; save it and upload it to Canvas',
    'A picture inside the question is 1.4 MB: shrink it',
    'A picture is in someone\'s personal files (students can\'t see it)',
    'A picture is in course 4230\'s files, not this course\'s, so students here can\'t see it: save it and upload it again into the question',
    'A picture links to a file in this course that wasn\'t in the export (deleted or moved?): check it in Canvas',
    'A picture links to Canvas files and wasn\'t packed into the export: check it in Canvas',
    'Picture "a.png" is unpublished in Files, so students can\'t see it: publish it, or set it to "Only available to students with link"',
    'Picture "a.png" is in an unpublished folder (Pics), so students can\'t see it: publish the folder, or set it to "Only available to students with link"',
    'Picture "a.png" has availability dates in Files (from 2026-11-01): make sure test day is inside them',
    'No question text', 'No correct answer marked', 'Blank answer choices (#2, #3)',
    'Pulls from a question bank that isn\'t in this export, so its questions and pictures weren\'t checked',
    'Picks 0: students get no question from this group', 'Picks 5 but has only 3 question(s)', 'Something new',
  ].map(c.quizCheckKind_), ['picture not in export', 'old question-bank picture', 'picture from an outside site',
    'picture to shrink', 'picture in personal files', 'picture from another course', 'picture not in export',
    'picture not in export', 'unpublished picture', 'unpublished picture', 'picture with availability dates',
    'no question text', 'no correct answer', 'blank answer choice', 'bank not in export', 'group picks 0',
    'group picks more than it has', 'other']);
  check('a question counts once per kind; kinds in a fixed order', c.quizCheckSummary_({
    ...made('Many', []), entries: [
      { kind: 'question', question: { problems: ['No correct answer marked', 'Picture "a" is 2.0 MB: shrink it', 'Picture "b" is 3.0 MB: shrink it'] } },
      { kind: 'group', group: { questions: [{ problems: ['Picture "c" is 1.1 MB: shrink it'] }], problems: ['Picks 0: students get no question from this group'] } },
    ] }).kinds, [['picture to shrink', 2], ['no correct answer', 1], ['group picks 0', 1]]);
  const solo = c.receiveCourseExport({ fileName: 'solo.zip',
    gzip: await win('quizCheckGzipBase64')(JSON.stringify({ texts: single.texts, sizes: single.sizes })) });
  check('workbook: single-quiz export says the course export is stricter', [solo.ok, solo.message.includes('single-quiz export')], [true, true]);
  check('workbook: garbage → clear message, ok false', c.receiveCourseExport({ fileName: 'x', gzip: 'bm90IGd6aXA=' }),
    { ok: false, message: 'The file couldn\'t be read. Try choosing it again.' });
  check('workbook: no upload → clear message', c.receiveCourseExport(null).message, 'The file couldn\'t be read. Try choosing it again.');
  const empty = await win('quizCheckGzipBase64')(JSON.stringify({ texts: { 'imsmanifest.xml': '<m/>' }, sizes: {} }));
  check('workbook: no quizzes → says which export to choose', c.receiveCourseExport({ fileName: 'x', gzip: empty }).message,
    'No quizzes found in that file. Choose the course export from Canvas (Settings › Export Course Content › Course).');

  // Step 3b: a chosen quiz's detailed report on the "Quiz Check detail" tab.
  workbook = makeWorkbook();
  const detail = c.receiveQuizCheckDetail({ fileName: 'biology-export.imscc', gzip, quizId: 'ga', url: URL_251474 });
  const dtab = workbook.tabs.find(t => t.name === 'Quiz Check detail');
  check('detail: ok, tab made and shown', [detail.ok, Boolean(dtab), dtab && dtab.active], [true, true, true]);
  check('detail: label, file name, quiz name linked to Canvas',
    [dtab.cells['1,1'], dtab.cells['1,2'], dtab.cells['3,1'], dtab.cells['3,2'], dtab.links['3,2']],
    ['Quiz Check detail:', 'biology-export.imscc', 'Quiz', 'Quiz A', URL_251474]);
  check('detail: header on row 11, question then group then bank question',
    [dtab.cells['11,1'], dtab.cells['12,1'], dtab.cells['13,1'], dtab.cells['14,1']], ['Kind', 'Question', 'Group', 'Question']);
  check('detail: the other-course bank question is red', [dtab.colors['14,1'], dtab.colors['12,1']], ['#f4cccc', undefined]);
  check('detail: message names the quiz and the red row', [detail.message.startsWith('"Quiz A": 1 group(s) and 2 question(s) on the "Quiz Check detail" tab.'),
    detail.message.includes('1 row(s) need fixing (red).'), detail.message.includes('orange')], [true, true, false]);
  const plain = c.receiveQuizCheckDetail({ fileName: 'b.imscc', gzip, quizId: 'gb', url: 'javascript:alert(1)' });
  check('detail: next click replaces the tab; a non-https link is ignored',
    [plain.ok, workbook.tabs.filter(t => t.name === 'Quiz Check detail').length, dtab.cells['1,2'], dtab.cells['3,2'],
      dtab.links['3,2'], dtab.cells['14,1'], dtab.colors['14,1']], [true, 1, 'b.imscc', 'Quiz B', undefined, undefined, undefined]);
  check('detail: unknown quiz → asks to check again', c.receiveQuizCheckDetail({ fileName: 'b', gzip, quizId: 'nope' }),
    { ok: false, message: 'That quiz isn\'t in this export. Run the check again and pick it from the new list.' });
  check('detail: garbage → clear message', c.receiveQuizCheckDetail({ fileName: 'x', gzip: 'bm90IGd6aXA=', quizId: 'ga' }).message,
    'The file couldn\'t be read. Try choosing it again.');
  const mine = workbook.makeTab('Quiz Check detail');
  workbook.tabs.splice(workbook.tabs.indexOf(dtab), 1);
  mine.cells['1,1'] = 'Notes';
  check('detail: someone else\'s "Quiz Check detail" tab is left alone',
    [c.receiveQuizCheckDetail({ fileName: 'b', gzip, quizId: 'ga' }).ok, mine.cells['1,1']], [false, 'Notes']);
  // Orange: rows whose Check is only "worth shrinking"; mixed rows stay red.
  const shaded = makeWorkbook().makeTab('t');
  const row = check => { const r = new Array(17).fill(''); r[14] = check; return r; };
  const orangeCount = c.quizCheckOrangeRows_(shaded.sheet, { rows: [row('Picture "a" is 600 KB: worth shrinking'),
    row('Picture "a" is 600 KB: worth shrinking\nNo correct answer marked'), row('')] }, 10);
  check('detail: only suggestion rows turn orange', [orangeCount, shaded.colors['11,1'], shaded.colors['11,17'], shaded.colors['12,1'],
    shaded.colors['13,1']], [1, '#fce5cd', '#fce5cd', undefined, undefined]);

  if (failures) {
    console.log(`\n${failures} check(s) failed.`);
    process.exitCode = 1;
  }
})();
