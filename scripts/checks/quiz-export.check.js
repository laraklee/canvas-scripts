/**
 * scripts/checks/quiz-export.check.js
 * Purpose: offline check of "Quiz report from export file": the upload window's zip
 *   reader (QuizExportUpload.html, script id="zip-reader") on a MADE-UP zip this check
 *   builds itself, and QuizExportReport.js turning QtiReader results into report rows.
 *   Nothing is sent anywhere; Canvas and Google are not called.
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
 * reader doesn't check them). zip64: sizes written as 0xffffffff with the real ones in a
 * ZIP64 extra field, the way Canvas writes its exports.
 */
function makeZip(entries) {
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
      extra = Buffer.alloc(20);
      extra.writeUInt16LE(1, 0);
      extra.writeUInt16LE(16, 2);
      extra.writeBigUInt64LE(BigInt(entry.data.length), 4);
      extra.writeBigUInt64LE(BigInt(packed.length), 12);
    }
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(entry.method, 10);
    central.writeUInt32LE(entry.zip64 ? 0xffffffff : packed.length, 20);
    central.writeUInt32LE(entry.zip64 ? 0xffffffff : entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(extra.length, 30);
    central.writeUInt32LE(offset, 42);
    locals.push(local, name, packed);
    centrals.push(central, name, extra);
    offset += 30 + name.length + packed.length;
  });
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}
const asArrayBuffer = buffer => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

// The window's zip reader, run here (Node has the same DecompressionStream, Blob, Response).
const html = fs.readFileSync(path.join(PROJECT, 'QuizExportUpload.html'), 'utf8');
const readerScript = html.match(/<script id="zip-reader">([\s\S]*?)<\/script>/)[1];
vm.runInThisContext(readerScript);
const readZip = global.readQuizExportZip || vm.runInThisContext('readQuizExportZip');

// The report side: QuizReport.js + QtiReader.js + QuizExportReport.js, Google stubbed out.
const context = {
  sheetProblem_: message => Object.assign(new Error(message), { isSheetProblem: true }),
  console: { log: () => {}, error: () => {} },
};
vm.createContext(context);
vm.runInContext(['QuizReport.js', 'QtiReader.js', 'QuizExportReport.js']
  .map(file => fs.readFileSync(path.join(PROJECT, file), 'utf8')).join('\n'), context);
const c = context;
const HEADERS = vm.runInContext('QUIZ_REPORT_HEADERS', context);
const col = name => HEADERS.indexOf(name);

// --- A made-up export ---
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const item = (id, type, stem, choices, correct, points) => `<item ident="${id}" title="Q ${id}"><itemmetadata><qtimetadata>
<qtimetadatafield><fieldlabel>question_type</fieldlabel><fieldentry>${type}</fieldentry></qtimetadatafield>
<qtimetadatafield><fieldlabel>points_possible</fieldlabel><fieldentry>${points}</fieldentry></qtimetadatafield>
</qtimetadata></itemmetadata><presentation><material><mattext texttype="text/html">${esc(stem)}</mattext></material>
<response_lid ident="r"><render_choice>${choices.map((t, i) =>
    `<response_label ident="${id}${i}"><material><mattext>${esc(t)}</mattext></material></response_label>`).join('')}
</render_choice></response_lid></presentation><resprocessing><respcondition><conditionvar>${correct.map(i =>
    `<varequal respident="r">${id}${i}</varequal>`).join('')}</conditionvar><setvar varname="SCORE">100</setvar></respcondition></resprocessing></item>`;
const group = (id, title, pick, each, bank, body) => `<section ident="${id}" title="${title}"><selection_ordering><selection>` +
  `${bank ? `<sourcebank_ref>${bank}</sourcebank_ref>` : ''}<selection_number>${pick}</selection_number>` +
  `<selection_extension><points_per_item>${each}</points_per_item></selection_extension></selection></selection_ordering>${body}</section>`;
const quizXml = `<questestinterop><assessment ident="q1" title="T"><section ident="root_section">
${group('s1', 'Cells', 1, 2, '', item('a', 'multiple_choice_question', '<p>In-quiz <img src="$IMS-CC-FILEBASE$/Uploaded%20Media/photo.jpg"></p>', ['A', 'B'], [1], 2))}
${group('s2', 'Plants', 1, 3, 'bank1', '')}
${group('s3', 'Gone', 2, 1, 'bank404', '')}
${item('z', 'multiple_choice_question', '<p>Loose</p>', ['Yes', 'No answer text provided.'], [0], 1)}
</section></assessment></questestinterop>`;
const bankXml = `<questestinterop><objectbank ident="bank1"><qtimetadata><qtimetadatafield><fieldlabel>bank_title</fieldlabel>` +
  `<fieldentry>Plant bank</fieldentry></qtimetadatafield></qtimetadata>${item('k', 'true_false_question', '<p>Bank Q</p>', ['True', 'False'], [0], '')}</objectbank></questestinterop>`;
// Groups and the loose question add up to 8 (a missing bank's points still come from the
// quiz file); the quiz says 10, to test the "not found" message.
const metaXml = '<quiz><title>Made-up New Quiz</title><points_possible>10.0</points_possible><time_limit>40</time_limit>' +
  '<require_lockdown_browser>false</require_lockdown_browser><access_code>NOPE</access_code></quiz>';
const zip = makeZip([
  { name: 'q1/', data: Buffer.alloc(0), method: 0 },
  { name: 'q1/q1.xml', data: Buffer.from(quizXml), method: 8, zip64: true },
  { name: 'q1/assessment_meta.xml', data: Buffer.from(metaXml), method: 8 },
  { name: 'non_cc_assessments/bank1.xml.qti', data: Buffer.from(bankXml), method: 0 },
  { name: 'Uploaded Media/photo.jpg', data: Buffer.alloc(650000, 7), method: 8, zip64: true },
]);

(async () => {
  const read = await readZip(asArrayBuffer(zip));
  check('zip: every file\'s size from the table of contents (folders skipped; ZIP64 entries read)', { ...read.sizes }, {
    'q1/q1.xml': Buffer.byteLength(quizXml), 'q1/assessment_meta.xml': Buffer.byteLength(metaXml),
    'non_cc_assessments/bank1.xml.qti': Buffer.byteLength(bankXml), 'Uploaded Media/photo.jpg': 650000,
  });
  check('zip: only .xml/.qti unpacked (deflated and stored both work)',
    [Object.keys(read.texts).sort(), read.texts['q1/q1.xml'] === quizXml, read.texts['non_cc_assessments/bank1.xml.qti'] === bankXml],
    [['non_cc_assessments/bank1.xml.qti', 'q1/assessment_meta.xml', 'q1/q1.xml'], true, true]);
  let message = '';
  try { await readZip(asArrayBuffer(Buffer.from('not a zip at all, just text'))); } catch (e) { message = e.message; }
  check('zip: a non-zip file gets a teacher-friendly message', message.startsWith('That file isn\'t a .zip'), true);

  // Upload checks (what receiveQuizExport accepts).
  const files = c.quizExportFiles_({ fileName: 'x.zip', texts: { ...read.texts }, sizes: { ...read.sizes } });
  check('upload: texts and sizes kept', [Object.keys(files.texts).length, files.sizes['Uploaded Media/photo.jpg']], [3, 650000]);
  const sneaky = JSON.parse('{"texts":{"__proto__":"x","a.xml":"<x/>","b.xml":5},"sizes":{"__proto__":1,"a.xml":"4","c":-1}}');
  const cleaned = c.quizExportFiles_(sneaky);
  check('upload: "__proto__" keys, non-text texts, and bad sizes dropped',
    [Object.keys(cleaned.texts), Object.keys(cleaned.sizes), cleaned.sizes['a.xml']], [['a.xml'], ['a.xml'], 4]);
  let tooBig = '';
  try { c.quizExportFiles_({ texts: { 'a.xml': 'x'.repeat(20 * 1000 * 1000 + 1) }, sizes: {} }); } catch (e) { tooBig = e.message; }
  check('upload: too much text is refused with a clear message', tooBig.startsWith('That export is too large'), true);
  check('upload: not a quiz export → ok false, nothing written',
    c.receiveQuizExport({ fileName: 'x.zip', texts: { 'imsmanifest.xml': '<m/>' }, sizes: {} }),
    { ok: false, message: 'That file doesn\'t look like a Canvas quiz export. In Canvas, export the quiz (New Quizzes: the quiz\'s ⋮ menu › Export) and choose that .zip.' });

  // Rows.
  const quiz = c.qtiReadExport_(files).quizzes[0];
  const report = c.qtiQuizReport_(quiz, 1);
  check('rows: every row as wide as the headers', report.rows.every(r => r.length === HEADERS.length), true);
  check('rows: kinds, groups, sources, pick/of in order',
    report.rows.map(r => [r[col('Kind')], r[col('Group')], r[col('Source')], r[col('Pick')], r[col('Of')]]), [
      ['Group', 'Cells', 'In quiz', 1, 1],
      ['Question', 'Cells', '', '', ''],
      ['Group', 'Plants', 'Bank: Plant bank', 1, 1],
      ['Question', 'Plants', '', '', ''],
      ['Group', 'Gone', 'Bank not in export', 2, '?'],
      ['Question', '', '', '', ''],
    ]);
  check('rows: group rows marked', report.groupRows, [0, 2, 4]);
  check('rows: question details (type, points, choices, correct, pictures)',
    [1, 3].map(i => [report.rows[i][col('Question Type')], report.rows[i][col('Points')], report.rows[i][col('Choices')],
      report.rows[i][col('Correct')], report.rows[i][col('Pictures')], report.rows[i][col('Check')]]), [
      ['Multiple choice', 2, '1) A\n2) B', '2', 'photo.jpg · 650 KB', 'Picture "photo.jpg" is 650 KB: worth shrinking'],
      ['True/false', 3, '1) True\n2) False', '1', '', ''],
    ]);
  check('rows: missing bank and blank choice in Check',
    [report.rows[4][col('Check')], report.rows[5][col('Check')]],
    ['Pulls from a question bank that isn\'t in this export, so its questions and pictures weren\'t checked',
      'Blank answer choice (#2)']);
  check('summary: same order as Quiz report (points check 5th, pictures 6th)',
    report.summary.map(r => r[0]), ['Quiz', 'Settings', 'Points in quiz', 'Points found here', 'Points check', 'Pictures']);
  check('summary: settings, points mismatch, pictures',
    [report.summary[1][1], report.pointsMessage, report.picturesMessage, report.picturesOk],
    ['LockDown Browser: No · Time limit: 40 min', 'Questions add up to 8 points, but the quiz says 10.',
      '1 in the questions (1 file(s)). 1 to look at: see the Check column.', false]);
  check('counts', report.counts, { groups: 3, questions: 3, checks: 3 });
  check('several quizzes: says it shows the first', c.qtiQuizReport_(quiz, 2).summary[0][1],
    'Made-up New Quiz (first of 2 quizzes in this export)');
  check('access code never in the report', JSON.stringify(report).includes('NOPE'), false);

  if (failures) {
    console.log(`\n${failures} check(s) failed.`);
    process.exitCode = 1;
  }
})();
