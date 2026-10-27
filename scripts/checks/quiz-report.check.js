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
const brief = report.rows.map(r => [r[0], r[1], r[2], r[3], r[6], r[8], r[12], r[13]]);
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
  [bankOnly.rows[0][5], bankOnly.rows[0][13], bankOnly.pointsOk], ['Bank 900', '', true]);

if (failures) {
  console.log(`\n${failures} check(s) failed.`);
  process.exitCode = 1;
}
