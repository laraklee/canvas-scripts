/**
 * scripts/checks/anonymize-quiz-csv.check.js
 * Purpose: offline check of the New and Classic Quiz report readers (anonymize-submissions/QuizCsv.js),
 *   using a MADE-UP report only: fake students, IDs, and answers (nothing is sent anywhere;
 *   Canvas and Google are not called). Run with the others: npm run check-offline.
 *   Repo helper only: not part of any Apps Script project; never clasp-pushed.
 * Canvas endpoints called: none. Canvas write operations: none.
 * Required User/Script Properties: none.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PROJECT = path.join(__dirname, '..', '..', 'anonymize-submissions');
const context = {};
vm.createContext(context);
vm.runInContext(['MatchResults.js', 'QuizCsv.js']
  .map((file) => fs.readFileSync(path.join(PROJECT, file), 'utf8')).join('\n'), context);
const c = context;

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}` +
    (ok ? '' : `\n      expected ${JSON.stringify(expected)}\n      got      ${JSON.stringify(actual)}`));
}

const item = (id, type, answer, points, status) => [id, type, answer, points, status];
const header = ['Name', 'ID', 'SISID', 'SectionIDs', 'SectionNames', 'SectionSISIDs',
  'Submitted', 'ElapsedTime', 'Attempt',
  ...item('ItemID', 'ItemType', 'What is the independent variable?', 'EarnedPoints', 'Status'),
  ...item('ItemID', 'ItemType', 'Explain soda lime, in detail.', 'EarnedPoints', 'Status'),
  ...item('ItemID', 'ItemType', 'Convert x mm to mL.', 'EarnedPoints', 'Status'),
  'NumberOfCorrect', 'NumberOfIncorrect', 'NoResponse', 'PointsPossible', 'OverallScore'];
const student = (name, id, attempt, items) =>
  [name, id, 'sis', '1', 'Bio', 's', '2026-01-01', '0:10:00', attempt, ...items.flat(), 0, 0, 0, 10, 0];
const quote = (cell) => '"' + String(cell).replace(/"/g, '""') + '"';
const csv = [
  header,
  header.map(() => ''),
  student('Test, Ann', '101', 1, [
    item('1', 'essay', '<p>Type of organism.</p>', '', 'Not Graded'),
    item('2', 'essay', '', '', 'Not Attempted'),
    item('3', 'formula', 'x=>5,0.03', '2', 'Graded')]),
  student('Test, Ben', '102', 1, [
    item('1', 'essay', '', '', 'Not Attempted'),
    item('2', 'essay', '<p>It absorbs CO<sub>2</sub>, "mostly".</p>\n<p>So&nbsp;only O2 &amp; …</p>', '3', 'Graded'),
    item('3', 'formula', 'x=>5,0.03', '2', 'Graded')]),
  student('Test, Cat', '103', 1, [
    item('1', 'essay', '', '', 'Not Attempted'),
    item('2', 'essay', '', '', 'Not Attempted'),
    item('3', 'formula', 'x=>5,0.03', '0', 'Graded')]),
  student('Test, Ben', '102', 2, [
    item('1', 'essay', '<ol><li>Organism</li><li>Mass</li></ol>', '', 'Not Graded'),
    item('2', 'essay', '<p>Second try.</p>', '', 'Not Graded'),
    item('3', 'formula', 'x=>5,0.03', '2', 'Graded')]),
  student('Test, Nobody', '', 1, []),
].map((row) => row.map(quote).join(',')).join('\r\n');

check('CSV: quoted commas, "" quotes, line breaks',
  c.parseCsv_('a,"b, c","say ""hi""","line1\nline2"\r\nd,e'),
  [['a', 'b, c', 'say "hi"', 'line1\nline2'], ['d', 'e']]);
check('tab-separated text (copied from a sheet)', c.parseCsv_('Name\tID\nX\t1'),
  [['Name', 'ID'], ['X', '1']]);

const report = c.parseQuizReport_('﻿' + csv);
check('students: blank row skipped, no-ID row skipped, Ben listed once',
  report.students.map((s) => [s.userId, s.attempt]), [['101', 1], ['102', 2], ['103', 1]]);
check('problems reported without names', report.problems,
  ['Rows 4 and 6 are the same student; used the higher attempt', 'Row 7: no Canvas ID; left out']);
check('Ann: only the essay she got; formula left out', report.students[0].answers,
  [{ number: 1, question: 'What is the independent variable?', text: 'Type of organism.' }]);
check('Ben: higher attempt kept, list items on lines', report.students[1].answers.map((a) => a.text),
  ['- Organism\n- Mass', 'Second try.']);
check('Cat: no essay answers', report.students[2].answers, []);

check('HTML to text: tags, entities, paragraphs',
  c.quizText_('<p>It absorbs CO<sub>2</sub>, "mostly".</p>\n<p>So&nbsp;only O2 &amp; &#8230;</p>'),
  'It absorbs CO2, "mostly".\nSo only O2 & …');
check('Windows-garbled dash and space repaired',
  c.quizText_('sprouts (autotroph)â€”or mealworms.Â '),
  'sprouts (autotroph)—or mealworms.');

check('not a quiz report', c.parseQuizReport_('Name,Score\nX,1').error,
  'Not a quiz Student Analysis report (no name, ID, and question columns)');
check('New Quiz report: no essay list (types come from ItemType)', report.essayNumbers, []);

// --- Classic Quiz report (same layout as a real header, made-up questions and students) ---
const classicHeader = ['name', 'id', 'sis_id', 'section', 'section_id', 'section_sis_id',
  'submitted', 'attempt', '9001: In your own words, what is the purpose?', '2.0',
  '9002: Which is the acid?', '1.0', '9003: Name the dependent variable.', '1.0',
  '9004: Write a Claim, with "reasoning", for this experiment.', '3.0',
  'n correct', 'n incorrect', 'score'];
const classicRow = (name, id, attempt, answers) =>
  [name, id, 's', 'Bio', '1', 's1', '2026-01-01', attempt, ...answers.flatMap((a) => [a, '']), 1, 0, 1];
const classicCsv = [
  classicHeader,
  classicRow('Ann Test', '201', 1, ['<p>To test buffers.</p>', 'HCl', 'pH change', '<p>Liver is best &amp; why.</p>']),
  classicRow('Ben Test', '202', 1, ['', 'NaOH', 'pH', '<p>Potato.</p><p>Little change.</p>']),
  classicRow('Cat Test', '203', 1, ['', 'HCl', '', '']),
  classicRow('Ann Test', '201', 2, ['<p>Second try.</p>', 'HCl', 'pH', '']),
].map((row) => row.map(quote).join(',')).join('\n');
const classic = c.parseQuizReport_(classicCsv);
check('Classic: recognized, essays = questions with formatted answers', [classic.classic, classic.essayNumbers],
  [true, [1, 4]]);
check('Classic: higher attempt kept; blank and plain-text answers left out',
  classic.students.map((s) => [s.userId, s.answers.map((a) => a.number + ':' + a.text)]),
  [['201', ['1:Second try.']], ['202', ['4:Potato.\nLittle change.']], ['203', []]]);
check('Classic: question text without the Canvas question ID', classic.students[1].answers[0].question,
  'Write a Claim, with "reasoning", for this experiment.');
check('Classic: same student twice reported', classic.problems,
  ['Rows 2 and 5 are the same student; used the higher attempt']);
check('Classic: tab-separated header (pasted from a sheet) works too',
  c.parseQuizReport_(classicCsv.split('\n').map((line) => c.parseCsv_(line)[0].join('\t')).join('\n')).essayNumbers,
  [1, 4]);
check('Classic with no formatted answers is refused, not guessed',
  c.parseQuizReport_(classicHeader.map(quote).join(',') + '\n' +
    classicRow('Ann Test', '201', 1, ['plain', 'HCl', 'pH', 'plain']).map(quote).join(',')).error,
  'Classic Quiz report: no essay answers found (essays are recognized by their formatting, and no answer had any)');
check('Classic question with no points column is refused',
  Boolean(c.parseQuizReport_('name,id,attempt,9001: Q?,n correct\nA,1,1,x,0').error), true);
check('columns in a different order are refused',
  Boolean(c.parseQuizReport_('Name,ID,ItemID,Status,Q,EarnedPoints,ItemType\n').error), true);

check('output CSV: quoted, formula-looking text defused',
  c.toCsv_([['Code', 'Answer'], ['S-ABC123', '=IMPORTXML("x")'], ['S-ABC124', 'a "b"']]),
  '"Code","Answer"\n"S-ABC123","\'=IMPORTXML(""x"")"\n"S-ABC124","a ""b"""');

// --- Match: AI results for quiz answers (made-up codes) ---
check('question numbers', ['Q6', 'q 12', 'Q3. Soda lime…', 'Soda lime'].map(c.questionNumber_),
  [6, 12, 3, 0]);
const answersFile = c.toCsv_([['Code', 'Question', 'Answer'],
  ['S-AAAAAA', 'Q1. Independent variable?', 'x'], ['S-BBBBBB', 'Q1. Independent variable?', 'y'],
  ['S-AAAAAA', 'Q2. Soda lime?', 'z']]);
const expected = c.expectedAnswers_(answersFile);
check('answers file → questions per code',
  [...expected.byCode].map(([code, numbers]) => [code, [...numbers]]),
  [['S-AAAAAA', [1, 2]], ['S-BBBBBB', [1]]]);
check('answers file → question text', [...expected.questions],
  [[1, 'Independent variable?'], [2, 'Soda lime?']]);
check('question label: short text kept whole', c.questionLabel_(2, expected.questions),
  'Q2 · Soda lime?');
check('question label: long text cut at a word, line breaks flattened',
  c.questionLabel_(7, new Map([[7, 'An enzyme called aldolase catalyzes the transformation\nof glucose 6 phosphate into pyruvate.']])),
  'Q7 · An enzyme called aldolase catalyzes the transformation of…');
check('question label without the answers file', c.questionLabel_(3, null), 'Q3');

const pasted = c.parseResultsTable_([
  ['Gemini summary text above the table', '', '', '', ''],
  ['Code', 'Question', 'Group', 'Why', 'Notes'],
  ['S-AAAAAA', 'Q1', 'Strong', 'Names the organism type.', ''],
  ['S-AAAAAA', 'Q1. Independent variable?', 'OK', 'Again.', ''],
  ['s-bbbbbb', 'Q1', 'Weak', 'Confuses IV and DV.', ''],
  ['S-BBBBBB', 'Q2', 'OK', 'Not this student.', ''],
  ['S-CCCCCC', 'Q1', 'OK', 'Unknown student.', ''],
]);
check('pasted table read as quiz results', [pasted.quiz, pasted.rows.length, pasted.rows[0].Group],
  [true, 5, 'Strong']);
check('old score table is not quiz', c.parseResultsTable_([['Code', 'Score'], ['S-AAAAAA', '8']]).quiz,
  false);

const students = new Map([['S-AAAAAA', 'Test, Ann'], ['S-BBBBBB', 'Test, Ben']]);
const quizReview = c.buildQuizReview_(pasted.rows, students, expected);
check('quiz review: problems on top, then by name and question',
  quizReview.rows.map((r) => [r.name, r.question, r.group, r.problem]), [
    ['', 'Q1 · Independent variable?', 'OK', 'Code not in the Key for this assignment'],
    ['Test, Ann', 'Q1 · Independent variable?', 'OK', 'Answer listed more than once'],
    ['Test, Ann', 'Q2 · Soda lime?', '', 'Missing from AI results'],
    ['Test, Ben', 'Q2 · Soda lime?', 'OK', 'This student did not answer this question'],
    ['Test, Ann', 'Q1 · Independent variable?', 'Strong', ''],
    ['Test, Ben', 'Q1 · Independent variable?', 'Weak', ''],
  ]);
check('quiz review counts', [quizReview.matched, quizReview.problems], [2, 4]);
check('without the answers file, only missing students are flagged',
  c.buildQuizReview_([{ Code: 'S-AAAAAA', Question: 'Q1', Group: 'OK' }], students, null)
    .rows.map((r) => [r.name, r.problem]),
  [['Test, Ben', 'Missing from AI results'], ['Test, Ann', '']]);
check('last-name order, either name form',
  ['Zed Adams', 'Amy Brown', 'Cole, Ben', 'Bo Adams', 'Cher'].sort(c.compareNames_),
  ['Bo Adams', 'Zed Adams', 'Amy Brown', 'Cher', 'Cole, Ben']);
check('quiz review sorts by last name, then question',
  c.buildQuizReview_([
    { Code: 'S-AAAAAA', Question: 'Q2', Group: 'OK' },
    { Code: 'S-BBBBBB', Question: 'Q1', Group: 'OK' },
    { Code: 'S-AAAAAA', Question: 'Q1', Group: 'OK' },
  ], new Map([['S-AAAAAA', 'Ann Young'], ['S-BBBBBB', 'Zoe Baker']]), null)
    .rows.map((r) => r.name + ' ' + r.question),
  ['Zoe Baker Q1', 'Ann Young Q1', 'Ann Young Q2']);
const sortRows = [
  { name: 'Ann Young', number: 10, problem: '' },
  { name: 'Zoe Baker', number: 2, problem: '' },
  { name: 'Ann Young', number: 2, problem: '' },
  { name: 'Zoe Baker', number: 10, problem: '' },
  { name: 'Ann Young', number: 3, problem: 'Missing from AI results' },
];
const order = (by) => [...sortRows].sort((a, b) => c.compareQuizRows_(a, b, by))
  .map((r) => r.name.split(' ')[1] + ' Q' + r.number);
check('sort by question: problems first, then Q2 before Q10, last names within',
  order('question'), ['Young Q3', 'Baker Q2', 'Young Q2', 'Baker Q10', 'Young Q10']);
check('sort by student: problems first, then last name, then question',
  order('student'), ['Young Q3', 'Baker Q2', 'Baker Q10', 'Young Q2', 'Young Q10']);
check('question number read from a Review label',
  c.questionNumber_('Q10 · An enzyme called aldolase…'), 10);
check('review tabs keep Reviewed in the same column',
  vm.runInContext('[QUIZ_REVIEW_HEADERS.length, QUIZ_REVIEW_HEADERS.at(-1)]', context),
  [vm.runInContext('REVIEW_HEADERS.length', context), 'Reviewed']);

process.exitCode = failures ? 1 : 0;
