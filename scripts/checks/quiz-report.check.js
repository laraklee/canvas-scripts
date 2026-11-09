/**
 * scripts/checks/quiz-report.check.js
 * Purpose: offline check of the Quiz report (QuizReport.js), using a MADE-UP quiz, groups,
 *   and questions only (nothing is sent anywhere; Canvas is not called).
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
vm.runInContext(['CanvasApi.js', 'ExportToDocs.js', 'QuizReport.js']
  .map(file => fs.readFileSync(path.join(PROJECT, file), 'utf8')).join('\n'), context);
const c = context;

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}` +
    (ok ? '' : `\n      expected ${JSON.stringify(expected)}\n      got      ${JSON.stringify(actual)}`));
}

check('quiz link', c.parseQuizLink_('https://canvas.example.edu/courses/7/quizzes/42/edit#tab'),
  { courseId: '7', quizId: '42' });
check('assignment link is not a quiz link',
  c.parseQuizLink_('https://canvas.example.edu/courses/7/assignments/42'), null);

check('HTML to text: breaks, pictures, &-codes, extra spaces',
  c.quizHtmlText_('<p>Which  cell&nbsp;part?</p><p><img src="/files/1/preview" alt="x">' +
    '</p><div>A &lt; B &amp; C&#39;s</div>'),
  'Which cell part?\n[picture]\nA < B & C\'s');
check('formula-looking text gets an apostrophe', c.quizCellText_('=2+2'), '\'=2+2');
check('long text is cut', c.quizCellText_('x'.repeat(5003)).length, 5000 + ' …(cut)'.length);

check('answers: choices and correct numbers', c.quizAnswerCells_({
  question_type: 'multiple_answers_question',
  answers: [{ text: 'Mitochondria', weight: 100 }, { html: '<b>Ribosome</b>', weight: 0 },
    { text: 'Nucleus', weight: 100 }],
}), { choices: '1) Mitochondria\n2) Ribosome\n3) Nucleus', correct: '1, 3' });
check('matching shows pairs, no correct column', c.quizAnswerCells_({
  question_type: 'matching_question',
  answers: [{ left: 'ATP', right: 'energy', weight: 100 }],
}), { choices: '1) ATP → energy', correct: '' });
check('matching pair wins over text (Canvas repeats the left side in text)',
  c.quizAnswerText_({ text: 'Stomach', left: 'Stomach', right: 'Acid digestion' }),
  'Stomach → Acid digestion');
check('numerical answer with margin',
  c.quizAnswerText_({ exact: 7.4, margin: 0.2 }), '7.4 ± 0.2');

check('group IDs once each, in order first seen',
  c.quizGroupIds_([{ quiz_group_id: 5 }, {}, { quiz_group_id: 9 }, { quiz_group_id: 5 }]),
  [5, 9]);

// A made-up quiz: one loose question, a "pick 2 of 3" group, a group that picks more than
// it has, and a group Canvas wouldn't return. Canvas says 12 points; 7 are found here.
const mc = (id, position, group, text, weights) => ({
  id, position, quiz_group_id: group, question_type: 'multiple_choice_question',
  question_name: 'Question', question_text: text, points_possible: 1,
  answers: weights.map((w, i) => ({ text: `Choice ${i + 1}`, weight: w })),
});
const questions = [
  mc(101, 1, null, '<p>Loose one</p>', [0, 100]),
  mc(103, 3, 50, '<p>G1 b</p>', [100, 0]),
  mc(102, 2, 50, '<p>G1 a</p>', [100, 0]),
  mc(104, 4, 50, '<p>G1 c</p>', [0, 0]),
  mc(105, 6, 60, '<p>G2 only</p>', [100]),
  mc(106, 8, 70, '', [100]),
];
const groups = new Map([
  [50, { id: 50, name: 'Cells', pick_count: 2, question_points: 2, position: 2 }],
  [60, { id: 60, name: 'Enzymes', pick_count: 2, question_points: 1, position: 5 }],
  [70, { failed: 'NOT_FOUND' }],
]);
const report = c.buildQuizReport_(
  { title: 'Made-up quiz', published: false, points_possible: 12 }, questions, groups);
const HEADERS = vm.runInContext('QUIZ_REPORT_HEADERS', context); // a const, not on context
const CHECK = HEADERS.indexOf('Check');
const PICTURES = HEADERS.indexOf('Pictures');
check('every row is as wide as the headers',
  report.rows.every(r => r.length === HEADERS.length), true);
const brief = report.rows.map(r => [r[0], r[1], r[2], r[3], r[6], r[8], r[12], r[CHECK]]);
check('rows in quiz order: groups first, questions sorted inside', brief, [
  ['Question', '', '', '', 1, 1, '2', ''],
  ['Group', 'Cells', 2, 3, '', 4, '', ''],
  ['Question', 'Cells', '', '', 2, 2, '1', ''],
  ['Question', 'Cells', '', '', 3, 2, '1', ''],
  ['Question', 'Cells', '', '', 4, 2, '', 'No correct answer marked'],
  ['Group', 'Enzymes', 2, 1, '', 2, '', 'Picks 2 but has only 1 question(s)'],
  ['Question', 'Enzymes', '', '', 5, 1, '1', ''],
  ['Group', '(couldn\'t read)', '', 1, '', '', '', 'Couldn\'t read this group (NOT_FOUND)'],
  ['Question', '', '', '', 6, '', '1', 'No question text'],
]);
check('group rows marked', report.groupRows, [1, 5, 7]);
check('counts', report.counts, { groups: 3, questions: 6, checks: 4 });
check('points: missing points explained',
  [report.pointsOk, report.summary.slice(2, 4)],
  [false, [['Points in Canvas', 12], ['Points found here', 7]]]);
check('points message mentions banks', report.pointsMessage.startsWith('5 point(s) not found'),
  true);

const bankOnly = c.buildQuizReport_({ title: 'Q', points_possible: 3 },
  [mc(1, 1, 80, '<p>x</p>', [100])],
  new Map([[80, { name: 'From bank', pick_count: 3, question_points: 1, position: 1,
    assessment_question_bank_id: 900 }]]));
check('bank group: source shown, no "picks more" check, points match',
  [bankOnly.rows[0][5], bankOnly.rows[0][CHECK], bankOnly.pointsOk], ['Bank 900', '', true]);
check('no picture checker: summary says not checked', report.picturesMessage, 'Not checked');

// --- Pictures (all MADE-UP files, folders, and courses; the quiz is in course 7) ---
const BASE = 'https://canvas.example.edu';
check('source: course file (full address)',
  c.quizPictureSource_(`${BASE}/courses/7/files/11/preview?verifier=x`, BASE),
  { kind: 'file', fileId: '11', courseId: '7', userFiles: false });
check('source: personal file', c.quizPictureSource_('/users/3/files/12/preview', BASE).userFiles, true);
check('source: other instructure address counts as Canvas',
  c.quizPictureSource_('https://school.instructure.com/courses/7/files/13/download', BASE).kind, 'file');
check('source: old bank file',
  c.quizPictureSource_('/assessment_questions/5/files/14/download?verifier=y', BASE).kind, 'bank');
check('source: outside site',
  c.quizPictureSource_('https://www.learn-biology.example/cell.png', BASE),
  { kind: 'outside', site: 'www.learn-biology.example' });
check('source: math image skipped', c.quizPictureSource_('/equation_images/x%5E2', BASE).kind, 'equation');
check('source: picture inside the HTML',
  c.quizPictureSource_('data:image/png;base64,' + 'A'.repeat(800), BASE), { kind: 'embedded', bytes: 600 });
check('tags: src and data-api-endpoint', c.quizPictureTags_(
  '<p><img alt="a" src="/courses/7/files/11/preview" data-api-endpoint="https://x/api/v1/courses/184/files/9"></p>'),
  [{ src: '/courses/7/files/11/preview', endpoint: 'https://x/api/v1/courses/184/files/9' }]);
check('sizes', [c.quizPictureSize_(4149349), c.quizPictureSize_(253760), c.quizPictureSize_(null)],
  ['4.1 MB', '254 KB', 'size unknown']);
check('date range', [c.quizDateRange_('2026-11-20T12:00:00Z', ''), c.quizDateRange_('', ''),
  c.quizDateRange_('2026-11-20T12:00:00Z', '2026-11-22T12:00:00Z')], ['from 11/20', '', '11/20 to 11/22']);

const folders = {
  1: { id: 1, name: 'course files', context_type: 'Course', context_id: 7, parent_folder_id: null },
  2: { id: 2, name: 'Uploaded Media', context_type: 'Course', context_id: 7, parent_folder_id: 1, hidden: true },
  3: { id: 3, name: 'Unit 9 secrets', context_type: 'Course', context_id: 7, parent_folder_id: 1, locked: true },
  4: { id: 4, name: 'course files', context_type: 'Course', context_id: 184, parent_folder_id: null },
};
const files = {
  21: { display_name: 'cell.png', size: 120000, hidden: true, folder_id: 2 },
  22: { display_name: 'big.jpg', size: 4149349, folder_id: 2 },
  23: { display_name: 'graph.png', size: 600000, locked: true, folder_id: 2 },
  24: { display_name: 'key.png', size: 50000, folder_id: 3 },
  25: { display_name: 'old.png', size: 50000, folder_id: 4 },
  26: { display_name: 'dated.png', size: 50000, folder_id: 2, unlock_at: '2026-11-20T12:00:00Z' },
};
const lookups = [];
const load = (kind, id) => {
  lookups.push(`${kind}/${id}`);
  const found = (kind === 'files' ? files : folders)[id];
  return found || { failed: 'NOT_FOUND' };
};
const checker = c.makeQuizPictureChecker_({ courseId: '7', baseUrl: BASE, load });
const img = (src, extra = '') => `<img src="${src}"${extra}>`;
const picQuiz = c.buildQuizReport_({ title: 'Pictures', points_possible: 8 }, [
  mc(1, 1, null, `<p>Fine ${img('/courses/7/files/21/preview',
    ' data-api-endpoint="https://x/api/v1/courses/184/files/9"')}</p>`, [100]),
  mc(2, 2, null, `<p>${img('/courses/7/files/22/preview')} ${img('/courses/7/files/22/preview')}</p>`, [100]),
  mc(3, 3, null, `<p>${img('/courses/7/files/23/preview')}</p>`, [100]),
  mc(4, 4, null, `<p>${img('/courses/7/files/24/preview')}</p>`, [100]),
  mc(5, 5, null, `<p>${img('/courses/184/files/25/preview')}</p>`, [100]),
  mc(6, 6, null, `<p>${img('/assessment_questions/5/files/14/download')}` +
    `${img('https://www.learn-biology.example/x.png')}${img('/equation_images/x')}</p>`, [100]),
  mc(7, 7, null, `<p>${img('/users/3/files/27/preview')}${img('/courses/7/files/26/preview')}</p>`, [100]),
  Object.assign(mc(8, 8, null, '<p>Choice pictures</p>', [100]),
    { answers: [{ html: img('/courses/7/files/21/preview'), weight: 100 }] }),
], new Map(), checker);
const pic = picQuiz.rows.map(r => [r[PICTURES], r[CHECK]]);
check('fine picture (link only) with an old tag: note, no problem', pic[0],
  ['cell.png · 120 KB · Link only (old tag: course 184)', '']);
check('big picture used twice: two lines, one problem', pic[1],
  ['big.jpg · 4.1 MB · Published\nbig.jpg · 4.1 MB · Published', 'Picture "big.jpg" is 4.1 MB: shrink it']);
check('unpublished and worth shrinking', pic[2], ['graph.png · 600 KB · Unpublished',
  'Picture "graph.png" is 600 KB: worth shrinking\nPicture "graph.png" is unpublished']);
check('unpublished folder', pic[3][1], 'Picture "key.png": its folder "Unit 9 secrets" is unpublished');
check('another course\'s files', pic[4][1], 'Picture "old.png" is in course 184\'s files');
check('bank file and outside site flagged; math image skipped', pic[5], [
  'old question-bank file\noutside site: www.learn-biology.example',
  'A picture is an old question-bank file (often broken for students): upload it again into the question\n' +
  'A picture comes from an outside site (www.learn-biology.example): it can change or disappear; save it and upload it to Canvas']);
check('personal file that can\'t be opened, and availability dates', pic[6][1],
  'A picture is in someone\'s personal files (students can\'t see it)\n' +
  'Picture "dated.png" has availability dates (from 11/20): make sure test day is inside them');
check('pictures in answer choices are checked', pic[7][0], 'cell.png · 120 KB · Link only');
check('summary counts uses, files, and flagged files',
  [picQuiz.picturesOk, picQuiz.picturesMessage],
  [false, '11 in the questions (9 file(s)). 8 to look at: see the Check column.']);
check('rows with picture problems are counted as checks', picQuiz.counts.checks, 6);
check('the checker asked about each picture file', lookups.includes('files/26'), true);

// The live loader: a stand-in for canvasGet_ counts requests (nothing is sent anywhere).
const asked = [];
context.canvasGet_ = apiPath => {
  asked.push(apiPath);
  if (apiPath === '/files/31') throw Object.assign(new Error('x'), { canvasType: 'TOKEN_REJECTED' });
  return { id: apiPath };
};
const live = c.quizPictureLoader_();
const answers = [live('files', 30), live('files', 30), live('folders', 2), live('files', 31),
  live('files', '9; drop'), live('users', 5)];
check('live loader: each file/folder asked once; 401 = not allowed; odd IDs never sent',
  [asked, answers.map(a => a.failed || 'ok')],
  [['/files/30', '/folders/2', '/files/31'], ['ok', 'ok', 'ok', 'NOT_ALLOWED', 'BAD_ID', 'BAD_ID']]);

// Writing the report: a stand-in sheet records calls in order (no Google calls).
const calls = [];
const fakeRange = (row, col, rows, cols) => {
  const range = {};
  ['setValues', 'setNumberFormat', 'setVerticalAlignment', 'setBackground', 'setFontWeight',
    'setWrap', 'clear', 'clearNote'].forEach(name => {
    range[name] = arg => {
      calls.push({ name, row, col, rows, cols, arg });
      return range;
    };
  });
  return range;
};
const fakeSheet = {
  getMaxColumns: () => 30, getMaxRows: () => 100, insertColumnsAfter: () => {},
  getRange: (row, col, rows = 1, cols = 1) => fakeRange(row, col, rows, cols),
  setColumnWidth: () => {},
};
const multi = c.buildQuizReport_({ title: 'T', points_possible: 1 }, [{
  id: 1, position: 1, question_type: 'multiple_answers_question', question_text: '<p>Pick</p>',
  points_possible: 1, answers: [1, 2, 3].map(n => ({ text: `c${n}`, weight: 100 })),
}], new Map());
check('multiple answers: correct is the text "1, 2, 3"', multi.rows[0][12], '1, 2, 3');
c.writeQuizReport_(fakeSheet, multi, new Date(2026, 10, 8));
const correctCol = HEADERS.indexOf('Correct') + 1;
const tableAt = calls.findIndex(x => x.name === 'setValues' && x.cols === HEADERS.length && x.rows === 1 &&
  Array.isArray(x.arg[0]) && x.arg[0][0] === 'Question');
const textAt = calls.findIndex(x => x.name === 'setNumberFormat' && x.arg === '@' && x.col === correctCol);
check('Correct column set to plain text before the rows are written',
  [textAt >= 0, tableAt >= 0, textAt < tableAt], [true, true, true]);
check('text columns: Group, Question Name, Question, Choices, Correct, Pictures, Check',
  calls.filter(x => x.name === 'setNumberFormat' && x.arg === '@').map(x => HEADERS[x.col - 1]),
  ['Group', 'Question Name', 'Question', 'Choices', 'Correct', 'Pictures', 'Check']);

check('401 on one picture means "not allowed", not "bad token"',
  c.quizPictureFailure_({ canvasType: 'TOKEN_REJECTED' }), 'NOT_ALLOWED');
let stopped = '';
try { c.quizPictureFailure_({ canvasType: 'RATE_LIMITED' }); } catch (e) { stopped = e.canvasType; }
check('busy Canvas still stops the run', stopped, 'RATE_LIMITED');

if (failures) {
  console.log(`\n${failures} check(s) failed.`);
  process.exitCode = 1;
}
