/**
 * QuizExportReport.js
 * Purpose: "Quiz report from export file" (menu: Canvas Tools › Quiz report from export
 *   file; Lara, 2026-11-08). For New Quizzes and quizzes that pull from banks, which the
 *   Canvas API can't show: a teacher picks the quiz's QTI export (.zip) in a small window
 *   (QuizExportUpload.html). The window reads the zip in the browser and sends only the
 *   .xml/.qti text and every file's size (never the pictures) to receiveQuizExport, which
 *   reads it with QtiReader.js and writes the same layout as Quiz report (QuizReport.js's
 *   writeQuizReport_: red rows, frozen header and question columns, Pictures and Check).
 *   Tab: the one being viewed if its A1 says "Quiz export:", else "Quiz export report"
 *   (made if missing). B1 gets the zip's file name; row 3 down is replaced each run.
 *   An export holds quiz content only, no student data; the access code is never read.
 * Canvas endpoints called: none (reads the uploaded export).
 * Canvas write operations: none.
 * Required User/Script Properties: none.
 */

const QUIZ_EXPORT_TAB = 'Quiz export report';
const QUIZ_EXPORT_LABEL = 'Quiz export:';
const QUIZ_EXPORT_TITLE = 'Quiz report from export file';
// Limits on what one upload may carry (the window checks them first, too).
const QUIZ_EXPORT_MAX_CHARS = 20 * 1000 * 1000;
const QUIZ_EXPORT_MAX_FILES = 20000;

/**
 * Was Menu: Canvas Tools › Quiz report from export file; off the menu since 2026-11-09
 * (Lara): a single-quiz export can hide other courses' pictures. Opens the upload window
 * (sheet only; adding the menu line back in Menus.js brings it back).
 */
function showQuizExportUpload() {
  const html = HtmlService.createHtmlOutputFromFile('QuizExportUpload').setWidth(460).setHeight(300);
  SpreadsheetApp.getUi().showModalDialog(html, QUIZ_EXPORT_TITLE);
}

/**
 * Called from the upload window (google.script.run, so no trailing underscore) with
 * { fileName, texts: { path: text }, sizes: { path: bytes } }. Writes the report and
 * returns { ok, message } for the window to show; never throws to the window.
 */
function receiveQuizExport(upload) {
  try {
    const files = quizExportFiles_(upload);
    const result = qtiReadExport_(files);
    if (!result.quizzes.length) {
      throw sheetProblem_('That file doesn\'t look like a Canvas quiz export. In Canvas, ' +
        'export the quiz (New Quizzes: the quiz\'s ⋮ menu › Export) and choose that .zip.');
    }
    const report = qtiQuizReport_(result.quizzes[0], result.quizzes.length);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = quizExportSheet_(ss);
    sheet.getRange('B1').setNumberFormat('@').setValue(quizCellText_(String(upload.fileName || '').slice(0, 200)));
    writeQuizReport_(sheet, report, new Date());
    const n = report.counts;
    console.log(`Quiz export report: ${n.groups} group(s), ${n.questions} question(s), ` +
      `${n.checks} check(s), points ${report.pointsOk ? 'match' : 'differ'}.`);
    return { ok: true, message: `${n.groups} group(s) and ${n.questions} question(s) listed on the ` +
      `"${sheet.getName()}" tab.\n\nPoints: ${report.pointsMessage}\n\nPictures: ${report.picturesMessage}` +
      (n.checks ? `\n\n${n.checks} row(s) are shaded red: see the Check column.` : '') };
  } catch (error) {
    // Kind of failure and the code line only: never the error text (it could quote the file).
    const where = String(error.stack || '').split('\n')[1] || '';
    console.error(`${QUIZ_EXPORT_TITLE} failed: ${error.isSheetProblem ? 'SHEET_PROBLEM' : `UNEXPECTED ${where.trim()}`}`);
    return { ok: false, message: error.isSheetProblem ? error.message :
      'Something went wrong reading the export. Nothing was changed. See Extensions › Apps Script › Executions.' };
  }
}

/**
 * The upload as { texts, sizes }, checked: plain path keys only (no "__proto__" and the
 * like), text values as strings, sizes as numbers, and within the size limits.
 */
function quizExportFiles_(upload) {
  if (!upload || typeof upload !== 'object' || typeof upload.texts !== 'object' || typeof upload.sizes !== 'object') {
    throw sheetProblem_('The file couldn\'t be read. Try choosing it again.');
  }
  const okKey = key => typeof key === 'string' && key.length < 1000 &&
    !['__proto__', 'constructor', 'prototype'].includes(key);
  const texts = Object.create(null); // plain lookup tables: no built-in keys
  const sizes = Object.create(null);
  let chars = 0;
  Object.keys(upload.sizes).filter(okKey).forEach(key => {
    const size = Number(upload.sizes[key]);
    if (Number.isFinite(size) && size >= 0) sizes[key] = size;
  });
  Object.keys(upload.texts).filter(okKey).forEach(key => {
    const text = upload.texts[key];
    if (typeof text !== 'string') return;
    chars += text.length;
    texts[key] = text;
  });
  if (chars > QUIZ_EXPORT_MAX_CHARS || Object.keys(sizes).length > QUIZ_EXPORT_MAX_FILES) {
    throw sheetProblem_('That export is too large to check here (a whole-course export?). ' +
      'Export just the quiz and try again.');
  }
  return { texts, sizes };
}

/** The tab to write: the one being viewed if its A1 says "Quiz export:", else "Quiz export report". */
function quizExportSheet_(ss) {
  const active = ss.getActiveSheet();
  if (exportLabelText_(active.getRange('A1').getDisplayValue()) === exportLabelText_(QUIZ_EXPORT_LABEL)) {
    return active;
  }
  const sheet = ss.getSheetByName(QUIZ_EXPORT_TAB) || ss.insertSheet(QUIZ_EXPORT_TAB);
  sheet.getRange('A1').setValue(QUIZ_EXPORT_LABEL).setFontWeight('bold');
  sheet.activate();
  return sheet;
}

/**
 * QtiReader's quiz as a Quiz report (the shape writeQuizReport_ takes). Summary rows keep
 * Quiz report's order, so row 5 is the points check and row 6 the pictures line (both
 * turn yellow when something's off). quizCount > 1: the export held several quizzes and
 * this is the first.
 */
function qtiQuizReport_(quiz, quizCount) {
  const rows = [];
  const groupRows = [];
  const counts = { groups: 0, questions: 0, checks: 0 };
  const questionRow = (q, groupTitle) => {
    counts.questions++;
    const check = q.problems.join('\n');
    if (check) counts.checks++;
    rows.push(['Question', groupTitle, '', '', '', '', q.number,
      QUIZ_TYPE_NAMES[q.type] || q.type, q.points, q.title, quizCellText_(q.text),
      quizCellText_(q.choices.map((choice, i) => `${i + 1}) ${choice}`).join('\n')),
      q.correct.join(', '), quizCellText_(q.pictures.map(p => p.label).join('\n')), check, '', '']);
  };
  quiz.entries.forEach(entry => {
    if (entry.kind === 'question') {
      questionRow(entry.question, '');
      return;
    }
    const g = entry.group;
    counts.groups++;
    groupRows.push(rows.length);
    const unknown = g.bankRef && !g.bankFound;
    const source = !g.bankRef ? 'In quiz' : (g.bankFound ? `Bank: ${g.bankTitle}` : 'Bank not in export');
    const check = g.problems.join('\n');
    if (check) counts.checks++;
    rows.push(['Group', g.title, g.pick, unknown ? '?' : g.size, g.pointsEach, quizCellText_(source), '', '',
      g.pick * g.pointsEach, '', '', '', '', '', check, '', '']);
    g.questions.forEach(q => questionRow(q, g.title));
  });

  // A missing bank's points still come from the quiz file (pick × points each), so they
  // don't explain a mismatch; the missing bank is flagged on its own group row instead.
  const pointsMessage = quiz.pointsOk ? 'OK: every point is accounted for.' :
    `Questions add up to ${quiz.pointsFound} points, but the quiz says ${quiz.points}.`;
  const pics = quiz.counts;
  const picturesOk = !pics.flagged;
  const picturesMessage = !pics.pictures ? 'None in these questions.' :
    `${pics.pictures} in the questions (${pics.pictureFiles} file(s)). ` +
    (pics.flagged ? `${pics.flagged} to look at: see the Check column.` : 'No problems found.');
  const settings = `LockDown Browser: ${quiz.lockdown ? 'Yes' : 'No'} · Time limit: ` +
    (quiz.timeLimit ? `${quiz.timeLimit} min` : 'none');
  const summary = [
    ['Quiz', quizCellText_(quiz.title + (quizCount > 1 ? ` (first of ${quizCount} quizzes in this export)` : ''))],
    ['Settings', settings],
    ['Points in quiz', quiz.points],
    ['Points found here', quiz.pointsFound],
    ['Points check', pointsMessage],
    ['Pictures', picturesMessage],
  ];
  return { summary, rows, groupRows, counts, pointsOk: quiz.pointsOk, pointsMessage, picturesOk,
    picturesMessage };
}
