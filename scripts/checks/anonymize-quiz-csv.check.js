/**
 * scripts/checks/anonymize-quiz-csv.check.js
 * Purpose: offline check of the New Quiz report reader (anonymize-submissions/QuizCsv.js),
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
vm.runInContext(fs.readFileSync(path.join(PROJECT, 'QuizCsv.js'), 'utf8'), context);
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
  'Not a New Quiz Student Analysis report (no Name, ID, and ItemID columns)');
check('columns in a different order are refused',
  Boolean(c.parseQuizReport_('Name,ID,ItemID,Status,Q,EarnedPoints,ItemType\n').error), true);

check('output CSV: quoted, formula-looking text defused',
  c.toCsv_([['Code', 'Answer'], ['S-ABC123', '=IMPORTXML("x")'], ['S-ABC124', 'a "b"']]),
  '"Code","Answer"\n"S-ABC123","\'=IMPORTXML(""x"")"\n"S-ABC124","a ""b"""');

process.exitCode = failures ? 1 : 0;
