/**
 * QuizCheck.js
 * Purpose: "Quiz Check" (menu: Canvas Tools › Quiz Check; Lara, 2026-11-09). The
 *   teacher picks the course's export file (.imscc) in a window (QuizCheckUpload.html),
 *   which reads it on their computer and sends only the quiz, bank, and settings text
 *   plus file sizes, gzipped. receiveCourseExport unpacks that, reads every quiz with
 *   QtiReader.js, and writes the overview tab "Quiz Check": one row per quiz (all of
 *   them, published or not), red if something needs fixing, orange if there are only
 *   suggestions (so far: pictures "worth shrinking", 500 KB–1 MB), plain if fine; red
 *   first, then orange, then fine, A–Z within each. The tab is rewritten each run.
 *   Step 3a of the plan in BRIEF.md. Next (3b): a detailed report for a chosen quiz.
 *   Course content only: an export holds no student data. Logs counts and timings only.
 * Canvas endpoints called: none (reads the export the window sends).
 * Canvas write operations: none.
 * Required User/Script Properties: none.
 */

const QUIZ_CHECK_TITLE = 'Quiz Check';
const QUIZ_CHECK_TAB = 'Quiz Check';
const QUIZ_CHECK_LABEL = 'Quiz Check:';
const QUIZ_CHECK_SUGGESTION_COLOR = '#fce5cd'; // light orange: suggestions only
const QUIZ_CHECK_HEADERS = Object.freeze(['Quiz', 'Published', 'Points', 'Points found',
  'Questions', 'Pictures', 'Rows to look at', 'What to look at']);
const QUIZ_CHECK_WIDTHS = Object.freeze([300, 75, 55, 65, 75, 65, 75, 420]);
const QUIZ_CHECK_HEADER_ROW = 4;
// Short names for the overview's "What to look at", matched against a problem's wording
// (QtiReader.js). First match wins; anything unmatched is counted as "other".
const QUIZ_CHECK_KINDS = Object.freeze([
  [/: shrink it$/, 'picture to shrink'],
  [/: worth shrinking$/, 'picture worth shrinking'],
  [/files, not this course's/, 'picture from another course'],
  [/outside site/, 'picture from an outside site'],
  [/old question-bank file/, 'old question-bank picture'],
  [/personal files/, 'picture in personal files'],
  [/unpublished/, 'unpublished picture'],
  [/availability dates/, 'picture with availability dates'],
  [/isn't in the export|wasn't in the export|wasn't packed/, 'picture not in export'],
  [/^No question text/, 'no question text'],
  [/^No correct answer/, 'no correct answer'],
  [/^Blank answer choice/, 'blank answer choice'],
  [/question bank that isn't in this export/, 'bank not in export'],
  [/^Picks 0/, 'group picks 0'],
  [/^Picks \d+ but has only/, 'group picks more than it has'],
]);
// The gzipped upload as base64; about 1.3 MB for a 47-quiz course (7 MB of text).
const QUIZ_CHECK_MAX_GZIP_CHARS = 15 * 1000 * 1000;

/** Menu: Canvas Tools › Quiz Check. Opens the window. */
function showQuizCheck() {
  const html = HtmlService.createHtmlOutputFromFile('QuizCheckUpload').setWidth(480).setHeight(320);
  SpreadsheetApp.getUi().showModalDialog(html, QUIZ_CHECK_TITLE);
}

/**
 * Called from the window (google.script.run, so no trailing underscore) with { fileName,
 * gzip }: gzip is base64 of a gzipped JSON { texts, sizes }. Writes the "Quiz Check" tab
 * and returns { ok, message, courseExport, quizzes: [summary] } (see quizCheckSummary_;
 * in the tab's order); never throws to the window.
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
    const quizzes = quizCheckSort_(result.quizzes.map(quizCheckSummary_));
    const name = String(upload.fileName || '').slice(0, 200);
    const sheet = quizCheckSheet_(SpreadsheetApp.getActiveSpreadsheet());
    writeQuizCheckOverview_(sheet, quizCheckOverview_(quizzes, name, new Date()));
    const red = quizzes.filter(q => q.level === 'problem').length;
    const orange = quizzes.filter(q => q.level === 'suggestion').length;
    console.log(`${QUIZ_CHECK_TITLE}: ${quizzes.length} quiz(zes), ${red} red, ${orange} orange, ` +
      `course export: ${result.courseExport}, ${Date.now() - started} ms.`);
    const single = result.courseExport ? '' : '\n\nThis is a single-quiz export. A course export ' +
      '(Settings › Export Course Content › Course) is the stricter check: it shows pictures ' +
      'that students can\'t open, such as ones from another course.';
    return {
      ok: true,
      courseExport: result.courseExport,
      quizzes,
      message: `Checked ${quizzes.length} quiz(zes) from "${name}". See the "${sheet.getName()}" tab: ` +
        `${quizCheckCountLine_(quizzes)}.${single}\n\n(Detailed reports for each quiz are still being built.)`,
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
 * something in Check), level ('problem' red, 'suggestion' orange, or '' fine), kinds
 * ([[short name, rows]] in QUIZ_CHECK_KINDS order; a points mismatch comes first, with 0) }.
 */
function quizCheckSummary_(quiz) {
  const questions = qtiQuestions_(quiz);
  const lists = questions.map(q => q.problems).concat(quiz.entries
    .filter(e => e.kind === 'group').map(e => e.group.problems)).filter(list => list.length);
  const counts = new Map();
  lists.forEach(list => new Set(list.map(quizCheckKind_)).forEach(kind =>
    counts.set(kind, (counts.get(kind) || 0) + 1)));
  const order = QUIZ_CHECK_KINDS.map(k => k[1]).concat(['other']);
  const kinds = order.filter(kind => counts.has(kind)).map(kind => [kind, counts.get(kind)]);
  if (!quiz.pointsOk) kinds.unshift([`points add up to ${quiz.pointsFound}, not ${quiz.points}`, 0]);
  const red = !quiz.pointsOk || lists.some(list => list.some(p => !quizCheckIsSuggestion_(p)));
  return {
    id: quiz.id,
    title: quiz.title,
    published: quiz.published,
    points: quiz.points,
    pointsFound: quiz.pointsFound,
    pointsOk: quiz.pointsOk,
    questions: questions.length,
    pictures: quiz.counts.pictures,
    rows: lists.length,
    level: red ? 'problem' : (lists.length ? 'suggestion' : ''),
    kinds,
  };
}

/** A problem's short name for the overview (QUIZ_CHECK_KINDS), or "other". */
function quizCheckKind_(problem) {
  const match = QUIZ_CHECK_KINDS.find(k => k[0].test(problem));
  return match ? match[1] : 'other';
}

/** True for a problem that's only a suggestion (orange): so far, "worth shrinking". */
function quizCheckIsSuggestion_(problem) {
  return /: worth shrinking$/.test(problem);
}

/** Red first, then orange, then fine; A–Z within each (numbers in order: 2 before 10). */
function quizCheckSort_(quizzes) {
  const rank = { problem: 0, suggestion: 1, '': 2 };
  return quizzes.slice().sort((a, b) => rank[a.level] - rank[b.level] ||
    String(a.title).localeCompare(String(b.title), 'en', { numeric: true, sensitivity: 'base' }));
}

/** "3 need fixing (red), 2 have suggestions (orange), 42 look fine". */
function quizCheckCountLine_(quizzes) {
  const red = quizzes.filter(q => q.level === 'problem').length;
  const orange = quizzes.filter(q => q.level === 'suggestion').length;
  return `${red} need fixing (red), ${orange} have suggestions (orange), ` +
    `${quizzes.length - red - orange} look fine`;
}

/**
 * The overview as cell values: { top (rows 1–3, two columns), rows (one per quiz, in
 * QUIZ_CHECK_HEADERS order), colors (one background per quiz row, null when fine) }.
 */
function quizCheckOverview_(quizzes, fileName, now) {
  const yesNo = value => (value === true ? 'Yes' : (value === false ? 'No' : ''));
  const rows = quizzes.map(q => [
    quizCellText_(q.title),
    yesNo(q.published),
    q.points,
    q.pointsFound,
    q.questions,
    q.pictures,
    q.rows,
    q.kinds.map(([kind, n]) => (n ? `${kind} (${n})` : kind)).join(' · '),
  ]);
  const colors = quizzes.map(q => (q.level === 'problem' ? QUIZ_REPORT_CHECK_COLOR :
    (q.level === 'suggestion' ? QUIZ_CHECK_SUGGESTION_COLOR : null)));
  return {
    top: [
      [QUIZ_CHECK_LABEL, quizCellText_(fileName)],
      ['Checked', now],
      ['Quizzes', `${quizzes.length}: ${quizCheckCountLine_(quizzes)}`],
    ],
    rows,
    colors,
  };
}

/**
 * The "Quiz Check" tab (made if missing). A tab by that name that isn't one of ours (A1
 * says something other than "Quiz Check:") is left alone: the teacher is asked to rename it.
 */
function quizCheckSheet_(ss) {
  const sheet = ss.getSheetByName(QUIZ_CHECK_TAB);
  if (!sheet) return ss.insertSheet(QUIZ_CHECK_TAB);
  const a1 = String(sheet.getRange('A1').getDisplayValue()).trim().toLowerCase();
  if (a1 && a1 !== QUIZ_CHECK_LABEL.toLowerCase()) {
    throw sheetProblem_(`There's already a "${QUIZ_CHECK_TAB}" tab used for something else. ` +
      'Rename that tab and try again. Nothing was changed.');
  }
  return sheet;
}

/** Rewrites the whole tab from the overview (quizCheckOverview_) and shows it. */
function writeQuizCheckOverview_(sheet, overview) {
  const width = QUIZ_CHECK_HEADERS.length;
  const first = QUIZ_CHECK_HEADER_ROW + 1;
  const count = overview.rows.length;
  sheet.clear();
  sheet.setFrozenRows(0);
  sheet.setFrozenColumns(0);
  if (sheet.getMaxColumns() < width) sheet.insertColumnsAfter(sheet.getMaxColumns(), width - sheet.getMaxColumns());
  if (sheet.getMaxRows() < first + count) sheet.insertRowsAfter(sheet.getMaxRows(), first + count - sheet.getMaxRows());
  sheet.getRange(1, 2).setNumberFormat('@');
  sheet.getRange(1, 1, overview.top.length, 2).setValues(overview.top);
  sheet.getRange(1, 1, overview.top.length, 1).setFontWeight('bold');
  sheet.getRange(2, 2).setNumberFormat('M/d/yyyy h:mm am/pm').setHorizontalAlignment('left');
  sheet.getRange(QUIZ_CHECK_HEADER_ROW, 1, 1, width).setValues([QUIZ_CHECK_HEADERS.slice()])
    .setFontWeight('bold').setWrap(true).setVerticalAlignment('bottom');
  if (count) {
    // Quiz names and notes stay plain text, so Sheets can't turn "11/20" into a date.
    sheet.getRange(first, 1, count, 1).setNumberFormat('@');
    sheet.getRange(first, width, count, 1).setNumberFormat('@');
    sheet.getRange(first, 1, count, width).setValues(overview.rows).setVerticalAlignment('top')
      .setBackgrounds(overview.colors.map(color => new Array(width).fill(color)));
    sheet.getRange(first, width, count, 1).setWrap(true);
  }
  QUIZ_CHECK_WIDTHS.forEach((pixels, i) => sheet.setColumnWidth(i + 1, pixels));
  sheet.setFrozenRows(QUIZ_CHECK_HEADER_ROW);
  sheet.setFrozenColumns(1);
  sheet.activate();
}
