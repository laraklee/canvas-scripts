/**
 * scripts/checks/qti-reader.check.js
 * Purpose: offline check of the QTI export reader (course-manager-jupiter/QtiReader.js),
 *   using MADE-UP exports only (a tiny quiz, a bank, and fake picture sizes; plus a tiny
 *   whole-course export with file settings; nothing is sent anywhere; Canvas is not called).
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
  '<p>2C2H6 + 7O2 &#x2014;&gt; 4CO2 and the plant&#x2019;s</p>', ['&#x2014;', 'B'], [0]), 1, { sizes: {}, used: new Set() });
check('New Quiz hex character codes become characters (question and choices)',
  [coded.text, coded.choices], ['2C2H6 + 7O2 —> 4CO2 and the plant’s', ['—', 'B']]);
check('no quiz in a folder without one', c.qtiReadExport_({ texts: { 'imsmanifest.xml': '' }, sizes: {} }).quizzes, []);
check('a quiz export is not a course export', [result.courseExport, quiz.published], [false, null]);

// --- A made-up whole-course export (.imscc layout, 2026-11-09) ---
const pic = file => `<img src="$IMS-CC-FILEBASE$/${file}">`;
const courseQuizXml = `<?xml version="1.0"?>
<questestinterop><assessment ident="gc1" title="Course Test"><section ident="root_section">
${choiceItem('c1', 'multiple_choice_question', '1.0', `<p>Published ${pic('Quiz%20Pics/ok.png')}</p>`, ['A', 'B'], [0])}
${choiceItem('c2', 'multiple_choice_question', '1.0', `<p>Link only ${pic('Uploaded%20Media%202/hid.png')}</p>`, ['A', 'B'], [0])}
${choiceItem('c3', 'multiple_choice_question', '1.0', `<p>Unpublished file ${pic('Quiz%20Pics/off.png')}</p>`, ['A', 'B'], [0])}
${choiceItem('c4', 'multiple_choice_question', '1.0', `<p>Unpublished folder ${pic('Drafts/Sub/d.png')}</p>`, ['A', 'B'], [0])}
${choiceItem('c5', 'multiple_choice_question', '1.0', `<p>Dates ${pic('Quiz%20Pics/dated.png')}</p>`, ['A', 'B'], [0])}
${choiceItem('c6', 'multiple_choice_question', '1.0', '<p>Last year <img src="/courses/4230/files/77/preview"></p>', ['A', 'B'], [0])}
${choiceItem('c7', 'multiple_choice_question', '1.0', '<p>Here but lost <img src="/courses/4791/files/88/download"></p>', ['A', 'B'], [0])}
<section ident="cs1" title="Bank group">
  <selection_ordering><selection><sourcebank_ref>cbank</sourcebank_ref><selection_number>1</selection_number><selection_extension><points_per_item>2.0</points_per_item></selection_extension></selection></selection_ordering>
</section>
</section></assessment></questestinterop>`;
const courseBankXml = `<?xml version="1.0"?>
<questestinterop><objectbank ident="cbank" canvas_item_bank="true">
  <qtimetadata><qtimetadatafield><fieldlabel>bank_title</fieldlabel><fieldentry>Course bank</fieldentry></qtimetadatafield></qtimetadata>
${choiceItem('cb1', 'multiple_choice_question', '', '<p>Bank Q <img src="/courses/4230/files/99/preview"></p>', ['X', 'Y'], [0])}
</objectbank></questestinterop>`;
const res = (id, href) => `<resource identifier="${id}" type="webcontent" href="${href}"><file href="${href}"/></resource>`;
const courseFiles = {
  texts: {
    'non_cc_assessments/gc1.xml.qti': courseQuizXml,
    'gc1/assessment_meta.xml': '<quiz><title>Course Test</title><points_possible>9.0</points_possible><workflow_state>unpublished</workflow_state></quiz>',
    'gc1/assessment_qti.xml': '<questestinterop/>',
    'non_cc_assessments/cbank.xml.qti': courseBankXml,
    'course_settings/context.xml': '<context_info><course_id>4791</course_id></context_info>',
    'imsmanifest.xml': `<manifest><resources>${res('f1', 'web_resources/Quiz Pics/ok.png')}${res('f2', 'web_resources/Uploaded Media 2/hid.png')}` +
      `${res('f3', 'web_resources/Quiz Pics/off.png')}${res('f4', 'web_resources/Drafts/Sub/d.png')}${res('f5', 'web_resources/Quiz Pics/dated.png')}</resources></manifest>`,
    'course_settings/files_meta.xml': '<fileMeta><folders><folder path="Uploaded Media 2"><hidden>true</hidden></folder>' +
      '<folder path="Drafts"><locked>true</locked></folder></folders><files>' +
      '<file identifier="f1"><display_name>ok.png</display_name></file>' +
      '<file identifier="f3"><display_name>off.png</display_name><locked>true</locked></file>' +
      '<file identifier="f5"><display_name>dated.png</display_name><unlock_at>2026-11-12T08:00:00-10:00</unlock_at></file></files></fileMeta>',
  },
  sizes: {
    'web_resources/Quiz Pics/ok.png': 1000, 'web_resources/Uploaded Media 2/hid.png': 1000,
    'web_resources/Quiz Pics/off.png': 1000, 'web_resources/Drafts/Sub/d.png': 1000,
    'web_resources/Quiz Pics/dated.png': 1000, 'web_resources/Unused/page-photo.png': 5,
  },
};
const course = c.qtiReadExport_(courseFiles);
const cq = course.quizzes[0];
const cp = n => c.qtiQuestions_(cq).find(x => x.number === n);
check('course export: one quiz (not the assessment_qti.xml copy), course number, published state',
  [course.courseExport, course.courseId, course.quizzes.length, cq.id, cq.title, cq.published], [true, '4791', 1, 'gc1', 'Course Test', false]);
check('course export: bank beside the quizzes is found', [cq.entries[7].group.bankFound, cq.entries[7].group.bankTitle], [true, 'Course bank']);
check('course export: published and link-only pictures are fine',
  [cp(1).pictures[0].label, cp(1).problems, cp(2).pictures[0].label, cp(2).problems],
  ['ok.png · 1 KB · published', [], 'hid.png · 1 KB · link only', []]);
check('course export: unpublished file', [cp(3).pictures[0].label, cp(3).problems], ['off.png · 1 KB · unpublished',
  ['Picture "off.png" is unpublished in Files, so students can\'t see it: publish it, or set it to "Only available to students with link"']]);
check('course export: folder above it unpublished', cp(4).problems,
  ['Picture "d.png" is in an unpublished folder ("Drafts"), so students can\'t see it: publish the folder, or set it to "Only available to students with link"']);
check('course export: availability dates', cp(5).problems,
  ['Picture "dated.png" has availability dates in Files (from 2026-11-12T08:00:00-10:00): make sure test day is inside them']);
check('course export: another course\'s file (quiz and bank)', [cp(6).problems, cp(8).problems].map(p => p[0]), [
  'A picture is in course 4230\'s files, not this course\'s, so students here can\'t see it: save it and upload it again into the question',
  'A picture is in course 4230\'s files, not this course\'s, so students here can\'t see it: save it and upload it again into the question']);
check('course export: this course\'s file left unpacked', cp(7).problems,
  ['A picture links to a file in this course that wasn\'t in the export (deleted or moved?): check it in Canvas']);
check('course export: no "unused media" list (other files belong to pages)', course.unusedMedia, []);
check('course export: only the files the reader needs are text',
  ['non_cc_assessments/gc1.xml.qti', 'gc1/assessment_meta.xml', 'gc1/assessment_qti.xml', 'course_settings/context.xml',
    'course_settings/files_meta.xml', 'imsmanifest.xml', 'wiki_content/page.html', 'course_settings/rubrics.xml'].map(c.qtiCourseExportText_),
  [true, true, false, true, true, true, false, false]);

if (failures) {
  console.log(`\n${failures} check(s) failed.`);
  process.exitCode = 1;
}
