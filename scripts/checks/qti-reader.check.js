/**
 * scripts/checks/qti-reader.check.js
 * Purpose: offline check of the QTI export reader (course-manager-jupiter/QtiReader.js),
 *   using a MADE-UP export only (a tiny quiz, a bank, and fake picture sizes; nothing is
 *   sent anywhere; Canvas is not called).
 *   Run with the others: npm run check-offline.
 *   Repo helper only: not part of any Apps Script project; never clasp-pushed.
 * Canvas endpoints called: none. Canvas write operations: none.
 * Required User/Script Properties: none.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PROJECT = path.join(__dirname, '..', '..', 'course-manager-jupiter');
const context = {};
vm.createContext(context);
vm.runInContext(['QuizReport.js', 'QtiReader.js']
  .map(file => fs.readFileSync(path.join(PROJECT, file), 'utf8')).join('\n'), context);
const c = context;

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}` +
    (ok ? '' : `\n      expected ${JSON.stringify(expected)}\n      got      ${JSON.stringify(actual)}`));
}

// --- A made-up export, written the way Canvas writes them (HTML &-escaped in mattext) ---
const esc = html => html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const meta = (type, points) => `<qtimetadata>
  <qtimetadatafield><fieldlabel>question_type</fieldlabel><fieldentry>${type}</fieldentry></qtimetadatafield>
  <qtimetadatafield><fieldlabel>points_possible</fieldlabel>${points === '' ? '<fieldentry/>' : `<fieldentry>${points}</fieldentry>`}</qtimetadatafield>
</qtimetadata>`;
const choiceItem = (id, type, points, stemHtml, choices, correct, multi) => `<item ident="${id}" title="Question">
  <itemmetadata>${meta(type, points)}</itemmetadata>
  <presentation>
    <material><mattext texttype="text/html">${esc(stemHtml)}</mattext></material>
    <response_lid ident="response1" rcardinality="${multi ? 'Multiple' : 'Single'}"><render_choice>
${choices.map((t, i) => `      <response_label ident="${id}-${i}"><material><mattext texttype="text/plain">${esc(t)}</mattext></material></response_label>`).join('\n')}
    </render_choice></response_lid>
  </presentation>
  <resprocessing>
    <outcomes><decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>
    <respcondition continue="No"><conditionvar>${multi ?
    `<and>${choices.map((t, i) => (correct.includes(i) ? `<varequal respident="response1">${id}-${i}</varequal>` :
      `<not><varequal respident="response1">${id}-${i}</varequal></not>`)).join('')}</and>` :
    correct.map(i => `<varequal respident="response1">${id}-${i}</varequal>`).join('')}</conditionvar>
      <setvar action="Set" varname="SCORE">100</setvar></respcondition>
  </resprocessing>
</item>`;
const essay = (id, stemHtml, points) => `<item ident="${id}" title="Essay">
  <itemmetadata>${meta('essay_question', points)}</itemmetadata>
  <presentation><material><mattext texttype="text/html"><![CDATA[${stemHtml}]]></mattext></material>
    <response_str ident="response1" rcardinality="Single"><render_fib><response_label ident="answer1" rshuffle="No"/></render_fib></response_str>
  </presentation>
</item>`;

const quizXml = `<?xml version="1.0"?>
<questestinterop><assessment ident="gq1" title="Made-up Test"><section ident="root_section">
${choiceItem('a1', 'multiple_choice_question', '1.0', '<p>Loose: which cell part?<img src="$IMS-CC-FILEBASE$/Uploaded%20Media/big%20photo.jpg" alt="x"></p>', ['Nucleus', 'Ribosome'], [0])}
<section ident="s1" title="In-quiz group">
  <selection_ordering><selection><selection_number>2</selection_number><selection_extension><points_per_item>2.0</points_per_item></selection_extension></selection></selection_ordering>
${choiceItem('b1', 'multiple_answers_question', '2.0', '<p>Pick all</p>', ['A', 'B', 'C'], [0, 2], true)}
${choiceItem('b2', 'multiple_choice_question', '2.0', '<p>Blank one <img src="https://www.biology-pictures.example/cell.png"></p>', ['Yes', 'No answer text provided.'], [0])}
</section>
<section ident="s2" title="From a bank">
  <selection_ordering><selection><sourcebank_ref>bank1</sourcebank_ref><selection_number>2</selection_number><selection_extension><points_per_item>3.0</points_per_item></selection_extension></selection></selection_ordering>
</section>
<section ident="s3" title="Missing bank">
  <selection_ordering><selection><sourcebank_ref>bank404</sourcebank_ref><selection_number>1</selection_number><selection_extension><points_per_item>1.0</points_per_item></selection_extension></selection></selection_ordering>
</section>
${essay('a2', '<p>Explain the graph. <img src="$IMS-CC-FILEBASE$/Uploaded%20Media/gone.png"></p>', '4.0')}
</section></assessment></questestinterop>`;

const bankXml = `<?xml version="1.0"?>
<questestinterop><objectbank ident="bank1" canvas_item_bank="true">
  <qtimetadata><qtimetadatafield><fieldlabel>bank_title</fieldlabel><fieldentry>Plants &amp; Cells (2)</fieldentry></qtimetadatafield></qtimetadata>
${choiceItem('k1', 'multiple_choice_question', '', '<p>Bank: no answer marked</p>', ['X', 'Y'], [])}
${essay('k2', '<p>Old picture <img src="/assessment_questions/5/files/9/download?verifier=abc"> and math <img src="/equation_images/x%5E2"></p>', '')}
${choiceItem('k3', 'true_false_question', '', '<p>Packed pic <img src="$IMS-CC-FILEBASE$/Uploaded%20Media/1f0e-uuid"></p>', ['True', 'False'], [1])}
</objectbank></questestinterop>`;

const files = {
  texts: {
    'gq1/gq1.xml': quizXml,
    'gq1/assessment_meta.xml': '<quiz><title>Made-up Test &amp; Review</title><points_possible>20.0</points_possible>' +
      '<require_lockdown_browser>true</require_lockdown_browser><time_limit>50</time_limit><access_code>SECRET-WORD</access_code></quiz>',
    'non_cc_assessments/bank1.xml.qti': bankXml,
    'imsmanifest.xml': '<manifest/>',
  },
  sizes: {
    'gq1/gq1.xml': 1, 'gq1/assessment_meta.xml': 1, 'non_cc_assessments/bank1.xml.qti': 1, 'imsmanifest.xml': 1,
    'Uploaded Media/big photo.jpg': 4149349,
    'Uploaded Media/1f0e-uuid': 600000,
    'Uploaded Media/unused.png': 1234,
  },
};
const result = c.qtiReadExport_(files);
const quiz = result.quizzes[0];

check('one quiz found, settings read', [result.quizzes.length, quiz.title, quiz.points, quiz.lockdown, quiz.timeLimit],
  [1, 'Made-up Test & Review', 20, true, '50']);
check('access code: only "set", never its value', [quiz.accessCode, JSON.stringify(result).includes('SECRET')],
  [true, false]);
check('entries in quiz order: loose, 3 groups, loose',
  quiz.entries.map(e => (e.kind === 'group' ? `group:${e.group.title}` : `q${e.question.number}`)),
  ['q1', 'group:In-quiz group', 'group:From a bank', 'group:Missing bank', 'q7']);
const [loose1, inQuiz, fromBank, missing, loose2] = quiz.entries;
check('in-quiz group: pick, points, its two questions',
  [inQuiz.group.pick, inQuiz.group.pointsEach, inQuiz.group.size, inQuiz.group.questions.map(q => q.number)], [2, 2, 2, [2, 3]]);
check('bank group: title (&-codes undone), questions from the bank file, points from the group',
  [fromBank.group.bankFound, fromBank.group.bankTitle, fromBank.group.size, fromBank.group.questions.map(q => q.points)],
  [true, 'Plants & Cells (2)', 3, [3, 3, 3]]);
check('missing bank: flagged, no questions', [missing.group.bankFound, missing.group.size, missing.group.problems],
  [false, 0, ['Pulls from a question bank that isn\'t in this export, so its questions and pictures weren\'t checked']]);
check('points: loose 1 + 2x2 + 2x3 + 1x1 + loose 4 = 16, not 20', [quiz.pointsFound, quiz.pointsOk, quiz.flags],
  [16, false, ['Questions add up to 16 points but the quiz says 20']]);

const q = n => c.qtiQuestions_(quiz).find(x => x.number === n);
check('multiple answers: correct choices skip the <not> ones', q(2).correct, [1, 3]);
check('text: HTML to plain, picture marked in place', q(1).text, 'Loose: which cell part? [picture]');
check('big packed picture: size and "shrink it"', [q(1).pictures[0].label, q(1).problems],
  ['big photo.jpg · 4.1 MB', ['Picture "big photo.jpg" is 4.1 MB: shrink it']]);
check('blank choice and outside site', q(3).problems, ['Blank answer choice (#2)',
  'A picture comes from an outside site (www.biology-pictures.example): it can change or disappear; save it and upload it to Canvas']);
check('bank question with no correct answer', q(4).problems, ['No correct answer marked']);
check('old bank file flagged, math image skipped', [q(5).pictures.length, q(5).problems],
  [1, ['A picture is an old question-bank file (often broken for students): upload it again into the question']]);
check('New Quiz-style picture (no extension, top-level folder)', [q(6).pictures[0].label, q(6).correct],
  ['1f0e-uuid · 600 KB', [2]]);
check('picture named but missing from the export (CDATA essay)', q(7).problems,
  ['Picture "gone.png" is named in the question but isn\'t in the export (Canvas couldn\'t copy it, so students may not see it either)']);
check('counts: questions, picture uses, files, flagged files', quiz.counts,
  { questions: 7, pictures: 5, pictureFiles: 5, flagged: 5 });
check('media no question uses', result.unusedMedia, ['Uploaded Media/unused.png']);
check('loose questions keep their own points', [loose1.question.points, loose2.question.points], [1, 4]);
const coded = c.qtiReadItem_(choiceItem('h1', 'multiple_choice_question', '1.0',
  '<p>2C2H6 + 7O2 &#x2014;&gt; 4CO2 and the plant&#x2019;s</p>', ['&#x2014;', 'B'], [0]), 1, {}, new Set());
check('New Quiz hex character codes become characters (question and choices)',
  [coded.text, coded.choices], ['2C2H6 + 7O2 —> 4CO2 and the plant’s', ['—', 'B']]);
check('no quiz in a folder without one', c.qtiReadExport_({ texts: { 'imsmanifest.xml': '' }, sizes: {} }).quizzes, []);

if (failures) {
  console.log(`\n${failures} check(s) failed.`);
  process.exitCode = 1;
}
