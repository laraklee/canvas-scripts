/**
 * scripts/checks/quiz-check.check.js
 * Purpose: offline check of "Quiz check (course export)": the window's slice-by-slice zip
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

// The workbook side: QuizReport.js + QtiReader.js + QuizExportReport.js + QuizCheck.js.
const context = {
  sheetProblem_: message => Object.assign(new Error(message), { isSheetProblem: true }),
  console: { log: () => {}, error: () => {} },
  Utilities: {
    base64Decode: text => Buffer.from(text, 'base64'),
    newBlob: bytes => ({ bytes }),
    ungzip: blob => ({ getDataAsString: () => zlib.gunzipSync(blob.bytes).toString('utf8') }),
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
  { name: 'ga/assessment_meta.xml', data: Buffer.from('<quiz><title>Quiz A</title><points_possible>5.0</points_possible><workflow_state>published</workflow_state></quiz>'), method: 8 },
  { name: 'ga/assessment_qti.xml', data: Buffer.from('<questestinterop/>'), method: 8 },
  { name: 'gb/assessment_meta.xml', data: Buffer.from('<quiz><title>Quiz B</title><points_possible>9.0</points_possible><workflow_state>unpublished</workflow_state></quiz>'), method: 0 },
  { name: 'non_cc_assessments/ga.xml.qti', data: Buffer.from(quizA), method: 8, zip64: true },
  { name: 'non_cc_assessments/gb.xml.qti', data: Buffer.from(quizB), method: 8 },
  { name: 'non_cc_assessments/gbank.xml.qti', data: Buffer.from(bank), method: 8 },
  { name: 'course_settings/context.xml', data: Buffer.from('<context_info><course_id>4791</course_id></context_info>'), method: 8 },
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
  check('workbook: Quiz A summary (bank picture from another course → look)', result.quizzes[0], {
    id: 'ga', title: 'Quiz A', published: true, points: 5, pointsFound: 5, pointsOk: true, questions: 2, pictures: 2, rows: 1, look: true });
  check('workbook: Quiz B summary (points 4 vs 9 → look, unpublished)',
    [result.quizzes[1].published, result.quizzes[1].pointsOk, result.quizzes[1].rows, result.quizzes[1].look], [false, false, 0, true]);
  check('workbook: message', result.message, 'Read 2 quiz(zes) from "biology-export.imscc": 2 have something to look at, ' +
    '0 look fine.\n\n(The overview tab and detailed reports are still being built.)');
  const solo = c.receiveCourseExport({ fileName: 'solo.zip',
    gzip: await win('quizCheckGzipBase64')(JSON.stringify({ texts: single.texts, sizes: single.sizes })) });
  check('workbook: single-quiz export says the course export is stricter', [solo.ok, solo.message.includes('single-quiz export')], [true, true]);
  check('workbook: garbage → clear message, ok false', c.receiveCourseExport({ fileName: 'x', gzip: 'bm90IGd6aXA=' }),
    { ok: false, message: 'The file couldn\'t be read. Try choosing it again.' });
  check('workbook: no upload → clear message', c.receiveCourseExport(null).message, 'The file couldn\'t be read. Try choosing it again.');
  const empty = await win('quizCheckGzipBase64')(JSON.stringify({ texts: { 'imsmanifest.xml': '<m/>' }, sizes: {} }));
  check('workbook: no quizzes → says which export to choose', c.receiveCourseExport({ fileName: 'x', gzip: empty }).message,
    'No quizzes found in that file. Choose the course export from Canvas (Settings › Export Course Content › Course).');

  if (failures) {
    console.log(`\n${failures} check(s) failed.`);
    process.exitCode = 1;
  }
})();
