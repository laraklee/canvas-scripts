/**
 * QuizCheck.js
 * Purpose: "Quiz check (course export)" (menu: Canvas Tools › Quiz check (course export);
 *   Lara, 2026-11-09). The teacher picks the course's export file (.imscc) in a window
 *   (QuizCheckUpload.html), which reads it on their computer and sends only the quiz,
 *   bank, and settings text plus file sizes, gzipped. receiveCourseExport unpacks that,
 *   reads every quiz with QtiReader.js, and returns a one-line summary per quiz.
 *   Step 2 of the plan in BRIEF.md: the summary is shown in the window only. Next: an
 *   overview tab (one row per quiz) and a detailed report for a chosen quiz.
 *   Course content only: an export holds no student data. Logs counts and timings only.
 * Canvas endpoints called: none (reads the export the window sends).
 * Canvas write operations: none.
 * Required User/Script Properties: none.
 */

const QUIZ_CHECK_TITLE = 'Quiz check (course export)';
// The gzipped upload as base64; about 1.3 MB for a 47-quiz course (7 MB of text).
const QUIZ_CHECK_MAX_GZIP_CHARS = 15 * 1000 * 1000;

/** Menu: Canvas Tools › Quiz check (course export). Opens the window. */
function showQuizCheck() {
  const html = HtmlService.createHtmlOutputFromFile('QuizCheckUpload').setWidth(480).setHeight(320);
  SpreadsheetApp.getUi().showModalDialog(html, QUIZ_CHECK_TITLE);
}

/**
 * Called from the window (google.script.run, so no trailing underscore) with { fileName,
 * gzip }: gzip is base64 of a gzipped JSON { texts, sizes }. Returns { ok, message,
 * courseExport, quizzes: [summary] } (see quizCheckSummary_); never throws to the window.
 */
function receiveCourseExport(upload) {
  const started = Date.now();
  try {
    const files = quizCheckUnpack_(upload);
    const result = qtiReadExport_(files);
    if (!result.quizzes.length) {
      throw sheetProblem_('No quizzes found in that file. Choose the course export from Canvas ' +
        '(Settings › Export Course Content › Course).');
    }
    const quizzes = result.quizzes.map(quizCheckSummary_);
    const look = quizzes.filter(q => q.look).length;
    console.log(`${QUIZ_CHECK_TITLE}: ${quizzes.length} quiz(zes), ${look} to look at, ` +
      `course export: ${result.courseExport}, ${Date.now() - started} ms.`);
    const name = String(upload.fileName || '').slice(0, 200);
    const single = result.courseExport ? '' : '\n\nThis is a single-quiz export. A course export ' +
      '(Settings › Export Course Content › Course) is the stricter check: it shows pictures ' +
      'that students can\'t open, such as ones from another course.';
    return {
      ok: true,
      courseExport: result.courseExport,
      quizzes,
      message: `Read ${quizzes.length} quiz(zes) from "${name}": ${look} have something to look at, ` +
        `${quizzes.length - look} look fine.${single}\n\n(The overview tab and detailed reports are ` +
        'still being built.)',
    };
  } catch (error) {
    // Kind of failure and the code line only: never the error text (it could quote the file).
    const where = String(error.stack || '').split('\n')[1] || '';
    console.error(`${QUIZ_CHECK_TITLE} failed after ${Date.now() - started} ms: ` +
      `${error.isSheetProblem ? 'SHEET_PROBLEM' : `UNEXPECTED ${where.trim()}`}`);
    return { ok: false, message: error.isSheetProblem ? error.message :
      'Something went wrong reading the export. Nothing was changed. See Extensions › Apps Script › Executions.' };
  }
}

/**
 * The upload as { texts, sizes }: base64 → gzip → JSON, then the same checks as a quiz
 * export upload (quizExportFiles_: plain keys, strings, numbers, size limits).
 */
function quizCheckUnpack_(upload) {
  const unreadable = () => sheetProblem_('The file couldn\'t be read. Try choosing it again.');
  if (!upload || typeof upload !== 'object' || typeof upload.gzip !== 'string' || !upload.gzip) throw unreadable();
  if (upload.gzip.length > QUIZ_CHECK_MAX_GZIP_CHARS) {
    throw sheetProblem_('That export has more quiz text than the workbook can take at once. Nothing was changed.');
  }
  let data;
  try {
    const blob = Utilities.newBlob(Utilities.base64Decode(upload.gzip), 'application/x-gzip');
    data = JSON.parse(Utilities.ungzip(blob).getDataAsString('UTF-8'));
  } catch (error) {
    throw unreadable();
  }
  return quizExportFiles_(data);
}

/**
 * One quiz as an overview line: { id, title, published (true/false/null), points,
 * pointsFound, pointsOk, questions, pictures, rows (question and group rows with
 * something in Check), look (rows, or points that don't add up) }.
 */
function quizCheckSummary_(quiz) {
  const questions = qtiQuestions_(quiz);
  const rows = questions.filter(q => q.problems.length).length +
    quiz.entries.filter(e => e.kind === 'group' && e.group.problems.length).length;
  return {
    id: quiz.id,
    title: quiz.title,
    published: quiz.published,
    points: quiz.points,
    pointsFound: quiz.pointsFound,
    pointsOk: quiz.pointsOk,
    questions: questions.length,
    pictures: quiz.counts.pictures,
    rows,
    look: rows > 0 || !quiz.pointsOk,
  };
}
