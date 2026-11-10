/**
 * qti-check.js: read-only checker for a Canvas quiz QTI export (Classic or New Quizzes) or a
 * whole-course export (.imscc). A thin wrapper: the reading is done by Course Manager's
 * course-manager-jupiter/QtiReader.js (with QuizReport.js's picture helpers), the same
 * code the workbook's quiz check uses.
 * Prints the quiz settings, groups (with bank questions when the bank is in the export),
 * loose questions, every picture by question with its size, and a FLAGS list. Optionally
 * writes every question's plain text (bank questions included) for the vocab cross-check.
 * A course export prints one line per quiz unless --quiz picks some by title.
 * Canvas endpoints: none (reads local files only). Write calls: none.
 * Properties: none. Never prints the quiz access code (the reader only notes if one is set).
 *
 * Usage: node qti-check.js <unzipped-export-folder | export.zip | course.imscc>
 *          [--quiz "<part of a title>"] [question-text-output-file]
 * A .zip or .imscc is read in place (nothing is unpacked to disk) by the same reader the
 * workbook's Quiz check window uses (QuizCheckUpload.html, script id="zip-slice-reader"):
 * sizes from its table of contents, text only from the files the quiz reader needs. (Not
 * the `unzip` tool: on a Mac it garbles non-ASCII names, such as the narrow space before
 * "AM" in screenshot names, and pictures then look missing.) Needs Node 20+ (openAsBlob).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const args = process.argv.slice(2);
const quizAt = args.indexOf('--quiz');
const quizFilter = quizAt >= 0 ? String(args.splice(quizAt, 2)[1] || '').toLowerCase() : '';
const root = args[0];
const textOut = args[1];
if (!root || !fs.existsSync(root)) {
  console.error('Usage: node qti-check.js <unzipped-export-folder | export.zip | course.imscc> [--quiz "<title part>"] [question-text-output-file]');
  process.exit(1);
}

// Load the shared reader the way the offline checks do (Apps Script files, no Google calls).
const PROJECT = path.join(__dirname, '..', '..', '..', 'course-manager-jupiter');
const context = {};
vm.createContext(context);
vm.runInContext(['QuizReport.js', 'QtiReader.js']
  .map(file => fs.readFileSync(path.join(PROJECT, file), 'utf8')).join('\n'), context);

// The export as the reader wants it: text of the files it reads, size of every file.
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}
const files = { texts: {}, sizes: {} };
if (fs.statSync(root).isDirectory()) {
  walk(root).forEach(full => {
    const rel = path.relative(root, full).split(path.sep).join('/');
    files.sizes[rel] = fs.statSync(full).size;
    if (/\.(xml|qti)$/i.test(rel)) files.texts[rel] = fs.readFileSync(full, 'utf8');
  });
}

(async () => {
if (!fs.statSync(root).isDirectory()) {
  const page = fs.readFileSync(path.join(PROJECT, 'QuizCheckUpload.html'), 'utf8');
  vm.runInThisContext(page.match(/<script id="zip-slice-reader">([\s\S]*?)<\/script>/)[1]);
  const blob = fs.openAsBlob ? await fs.openAsBlob(root) : new Blob([fs.readFileSync(root)]);
  const read = await vm.runInThisContext('readQuizCheckFile')(blob);
  Object.assign(files.texts, read.texts);
  Object.assign(files.sizes, read.sizes);
}

const result = context.qtiReadExport_(files);
if (!result.quizzes.length) {
  console.error('No quiz found (expected <id>/<id>.xml or non_cc_assessments/<id>.xml.qti next to <id>/assessment_meta.xml).');
  process.exit(1);
}
const picked = quizFilter ? result.quizzes.filter(q => q.title.toLowerCase().includes(quizFilter)) : result.quizzes;
if (quizFilter && !picked.length) {
  console.error(`No quiz title contains "${quizFilter}".`);
  process.exit(1);
}
const state = q => (q.published === null ? '' : (q.published ? 'published' : 'UNPUBLISHED'));
if (result.courseExport && !quizFilter) {
  // Whole course: one line per quiz; --quiz "<title part>" shows the details.
  console.log(`COURSE EXPORT (course ${result.courseId || '?'}): ${result.quizzes.length} quizzes. Use --quiz "<title part>" for details.`);
  result.quizzes.forEach(q => {
    const all = context.qtiQuestions_(q);
    const rows = all.filter(x => x.problems.length).length +
      q.entries.filter(e => e.kind === 'group' && e.group.problems.length).length;
    const red = rows || !q.pointsOk;
    console.log(`${red ? 'LOOK' : 'ok  '} ${state(q).padEnd(11)} pts ${q.points}${q.pointsOk ? '' : ` (found ${q.pointsFound})`}` +
      ` | ${all.length} q | ${q.counts.pictures} pics | ${rows} flagged | ${q.title}`);
  });
  process.exit(0);
}

const textLines = [];
// Q numbers won't match Canvas's, and New Quiz picture names are random, so each line
// also starts the question's wording to find it by.
const snippet = q => {
  const text = q.text.replace(/\[picture\]/g, '').replace(/\s+/g, ' ').trim();
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
};
const where = (q, group) => `Q${q.number} "${snippet(q)}" (${group ? group.title : 'not in a group: every student'})`;
picked.forEach(quiz => {
  console.log('==================================================================');
  console.log(`QUIZ: ${quiz.title}${state(quiz) ? ` (${state(quiz)})` : ''}`);
  console.log(`Points: ${quiz.points} | LockDown Browser: ${quiz.lockdown} | time limit: ` +
    `${quiz.timeLimit || 'none'} | access code: ${quiz.accessCode ? 'set (not shown)' : 'none'}`);
  textLines.push(`QUIZ: ${quiz.title}`);

  const groups = quiz.entries.filter(e => e.kind === 'group').map(e => e.group);
  const loose = quiz.entries.filter(e => e.kind === 'question').map(e => e.question);
  console.log(`\nGROUPS (${groups.length}), ${quiz.counts.questions} questions in all:`);
  groups.forEach(g => {
    const bank = !g.bankRef ? '' : (g.bankFound ? ` | bank "${g.bankTitle}"` : ' | BANK NOT IN EXPORT');
    console.log(`  ${g.title}: pick ${g.pick} of ${g.bankRef && !g.bankFound ? '?' : g.size}, ${g.pointsEach} pts each${bank}`);
  });
  if (loose.length) {
    console.log(`  Not in a group (every student gets these): ${loose.length} question(s), ` +
      `${loose.reduce((sum, q) => sum + q.points, 0)} pts`);
  }
  console.log(`  Points found: ${quiz.pointsFound} | quiz settings say: ${quiz.points}`);

  const flags = quiz.flags.slice();
  const pictureLines = [];
  const visit = (q, group) => {
    textLines.push(`Q${q.number} [${q.type}] ${q.text.replace(/\s+/g, ' ')}`);
    if (q.choices.length) textLines.push(`   choices: ${q.choices.join(' | ')}`);
    if (q.correct.length) textLines.push(`   correct: ${q.correct.join(', ')}`);
    q.pictures.forEach(p => pictureLines.push(`  ${where(q, group)}: ${p.label}`));
    q.problems.forEach(problem => flags.push(`${where(q, group)}: ${problem}`));
  };
  quiz.entries.forEach(e => {
    if (e.kind === 'question') {
      if (textLines[textLines.length - 1] !== '\n=== (not in a group: every student gets these)') {
        textLines.push('\n=== (not in a group: every student gets these)');
      }
      visit(e.question, null);
      return;
    }
    const g = e.group;
    textLines.push(`\n=== ${g.title}${g.bankTitle ? ` (bank: ${g.bankTitle})` : ''} | pick ${g.pick}`);
    g.problems.forEach(problem => flags.push(`Group "${g.title}": ${problem}`));
    g.questions.forEach(q => visit(q, g));
  });

  console.log(`\nPICTURES (${quiz.counts.pictures} uses, ${quiz.counts.pictureFiles} files):`);
  pictureLines.forEach(line => console.log(line));
  console.log(`\nFLAGS (${flags.length}):`);
  if (!flags.length) console.log('  none');
  flags.forEach(f => console.log(`  - ${f}`));
});

if (result.unusedMedia.length) {
  console.log(`\nFiles in the export no question uses (${result.unusedMedia.length}): ${result.unusedMedia.join(', ')}`);
}
if (textOut) {
  fs.writeFileSync(textOut, textLines.join('\n') + '\n');
  console.log(`\nQuestion text written to ${textOut}`);
}
})().catch(error => {
  console.error(error.message || String(error));
  process.exit(1);
});
