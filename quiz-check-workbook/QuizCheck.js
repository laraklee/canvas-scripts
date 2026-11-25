/**
 * QuizCheck.js (Quiz Check workbook)
 * Purpose: "Quiz Check" on its own, for teachers who don't use a Course Manager
 *   workbook (Lara, 2026-11-24). The teacher picks the course's export file (.imscc) in
 *   the side panel (QuizCheckUpload.html), which reads it on their computer and sends
 *   only the quiz, bank, and settings text plus file sizes, gzipped. receiveCourseExport
 *   unpacks that, reads every quiz with QtiReader.js, and writes the "Quiz Check" tab:
 *   one row per quiz (published or not), red if something needs fixing, orange if there
 *   are only suggestions (pictures "worth shrinking", 500 KB–1 MB), plain if fine; red
 *   first, then orange, then fine, A–Z within each. The tab is rewritten each run.
 *   Clicking a quiz in the panel sends the same upload again with that quiz's id to
 *   receiveQuizCheckDetail, which writes its detailed report on that quiz's own tab,
 *   "Detail – quiz name" (updated if the quiz is clicked again; Lara, 2026-11-24).
 *   Each check also saves the upload (already gzipped, base64) in pieces on the hidden
 *   "Quiz Check data" tab, with the quiz IDs in the overview's row order, so the menu's
 *   "Detail for selected quiz" can write a quiz's detail after the panel is closed
 *   (Lara, 2026-11-24). "Clear check results…" deletes all three tabs so a shared copy
 *   doesn't carry the teacher's quiz text.
 *   A copy of course-manager-jupiter/QuizCheck.js without the Canvas links (Jupiter
 *   links each quiz name to Canvas through the API; this workbook never calls Canvas, so
 *   it needs no token or setup). The helper functions below the two entry points are
 *   kept identical to Jupiter's (scripts/checks/quiz-check-workbook.check.js compares
 *   them; quizExportFiles_'s size message is the one intended difference).
 *   Course content only: an export holds no student data. Logs counts and timings only.
 * Canvas endpoints called: none (reads the export the teacher picks).
 * Canvas write operations: none.
 * Required User/Script Properties: none.
 */

const QUIZ_CHECK_TITLE = 'Quiz Check';
const QUIZ_CHECK_TAB = 'Quiz Check';
const QUIZ_CHECK_LABEL = 'Quiz Check:';
// Each quiz's detail gets its own tab, "Detail – quiz name" (Lara, 2026-11-24): A1 the
// label below (how Clear finds them all), B1 the file, A2/B2 the quiz ID (how a quiz's
// tab is found again, so clicking it again updates that tab).
const QUIZ_CHECK_DETAIL_PREFIX = 'Detail – ';
const QUIZ_CHECK_DETAIL_LABEL = 'Quiz Check detail:';
const QUIZ_CHECK_TAB_NAME_MAX = 100; // Google's limit on a tab name
// Hidden tab holding the last check's upload, for "Detail for selected quiz".
const QUIZ_CHECK_DATA_TAB = 'Quiz Check data';
const QUIZ_CHECK_DATA_LABEL = 'Quiz Check data:';
const QUIZ_CHECK_DATA_FIRST_ROW = 4;
const QUIZ_CHECK_PIECE_CHARS = 45000; // a Sheets cell holds at most 50,000 characters
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
// Limits on the unpacked upload (the panel checks the text limit first, too).
const QUIZ_EXPORT_MAX_CHARS = 20 * 1000 * 1000;
const QUIZ_EXPORT_MAX_FILES = 20000;

/**
 * Menu: Quiz Check › Check quizzes…. Opens the panel docked on the right, so the teacher
 * can read a report tab and pick the next quiz without closing it.
 */
function showQuizCheck() {
  const html = HtmlService.createHtmlOutputFromFile('QuizCheckUpload').setTitle(QUIZ_CHECK_TITLE);
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Called from the panel (google.script.run, so no trailing underscore) with { fileName,
 * gzip }: gzip is base64 of a gzipped JSON { texts, sizes }. Writes the "Quiz Check" tab
 * and returns { ok, message, courseExport, quizzes: [summary] } (see quizCheckSummary_;
 * in the tab's order); never throws to the panel.
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
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = quizCheckSheet_(ss);
    writeQuizCheckOverview_(sheet, quizCheckOverview_(quizzes, name, new Date()));
    let later = '\n\nTo see a quiz\'s details later (with this panel closed), click its row on the ' +
      `"${sheet.getName()}" tab and choose Quiz Check › Detail for selected quiz.`;
    try {
      quizCheckSaveUpload_(ss, name, upload.gzip, quizzes);
    } catch (error) {
      // The check itself worked; only the menu item won't. Drop stale saved data.
      console.error(`${QUIZ_CHECK_TITLE}: couldn't save the upload (${error.isSheetProblem ? 'SHEET_PROBLEM' : 'UNEXPECTED'}).`);
      quizCheckDropData_(ss);
      later = '\n\nQuiz Check › Detail for selected quiz won\'t work for this check (the workbook ' +
        `couldn't save the file; if you have your own tab named "${QUIZ_CHECK_DATA_TAB}", rename it). ` +
        'Click quizzes in this panel instead.';
    }
    sheet.activate();
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
        `${quizCheckCountLine_(quizzes)}.${single}${later}`,
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
 * Called from the panel (google.script.run) when a quiz in its list is clicked, with
 * { fileName, gzip, quizId }: the same upload as receiveCourseExport and the quiz's id.
 * Writes that quiz's detailed report on its own "Detail – quiz name" tab and returns
 * { ok, message }; never throws to the panel.
 */
function receiveQuizCheckDetail(upload) {
  const started = Date.now();
  try {
    return { ok: true, message: quizCheckWriteDetail_(upload, started) };
  } catch (error) {
    return { ok: false, message: quizCheckDetailFailure_(error, started) };
  }
}

/**
 * Menu: Quiz Check › Detail for selected quiz. Writes the detail for the quiz whose row
 * is selected on the Quiz Check tab, from the upload the last check saved (hidden "Quiz
 * Check data" tab), so the panel needn't be open. Shows the result in a message box.
 */
function showQuizCheckDetailForSelection() {
  const started = Date.now();
  const ui = SpreadsheetApp.getUi();
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getActiveSheet();
    const howTo = `On the "${QUIZ_CHECK_TAB}" tab, click a quiz's row, then choose Quiz Check › Detail for selected quiz.`;
    if (sheet.getName() !== QUIZ_CHECK_TAB) throw sheetProblem_(howTo);
    const row = sheet.getActiveRange().getRow();
    const saved = quizCheckLoadUpload_(ss);
    const index = row - QUIZ_CHECK_HEADER_ROW - 1;
    if (index < 0 || index >= saved.quizzes.length) throw sheetProblem_(howTo);
    const [quizId, title] = saved.quizzes[index];
    // The saved list follows the tab's rows as written; sorting or editing the tab breaks that.
    if (String(sheet.getRange(row, 1).getDisplayValue()) !== title) {
      throw sheetProblem_(`The "${QUIZ_CHECK_TAB}" tab has changed since the check (rows sorted, moved, or ` +
        'edited). Run Quiz Check › Check quizzes… again.');
    }
    const message = quizCheckWriteDetail_({ fileName: saved.fileName, gzip: saved.gzip, quizId }, started);
    ui.alert(QUIZ_CHECK_TITLE, message, ui.ButtonSet.OK);
  } catch (error) {
    ui.alert(QUIZ_CHECK_TITLE, quizCheckDetailFailure_(error, started), ui.ButtonSet.OK);
  }
}

/**
 * Menu: Quiz Check › Clear check results…. After a yes, deletes every tab of ours (A1 is
 * one of our labels: the Quiz Check tab, every quiz's detail tab, the hidden Quiz Check
 * data tab), so a copy of the workbook doesn't carry the teacher's quiz text. Tabs of the
 * teacher's are never touched, whatever their names. The data tab goes first (so a
 * hidden tab is never the last one left); if one of ours is the workbook's last tab, it's
 * emptied instead (a workbook needs one tab).
 */
function clearQuizCheckResults() {
  const ui = SpreadsheetApp.getUi();
  const answer = ui.alert('Clear check results', `This deletes the "${QUIZ_CHECK_TAB}" tab, every ` +
    `"${QUIZ_CHECK_DETAIL_PREFIX}…" tab, and the saved copy of your quizzes, so a copy of this workbook ` +
    'won\'t carry your quiz text. Your other tabs stay. Nothing in Canvas changes, and you can check ' +
    'again any time.\n\nClear them?', ui.ButtonSet.YES_NO);
  if (answer !== ui.Button.YES) return;
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const labels = [QUIZ_CHECK_DATA_LABEL, QUIZ_CHECK_LABEL, QUIZ_CHECK_DETAIL_LABEL];
    const ours = ss.getSheets().filter(sheet => labels.some(label => quizCheckIsOurs_(sheet, label)))
      .sort((a, b) => Number(quizCheckIsOurs_(b, QUIZ_CHECK_DATA_LABEL)) - Number(quizCheckIsOurs_(a, QUIZ_CHECK_DATA_LABEL)));
    ours.forEach(sheet => {
      if (ss.getSheets().length > 1) ss.deleteSheet(sheet);
      else sheet.clear();
    });
    console.log(`${QUIZ_CHECK_TITLE}: cleared ${ours.length} tab(s).`);
    ui.alert('Clear check results', ours.length ? `Check results cleared (${ours.length} tab(s)).` :
      'There were no check results to clear.', ui.ButtonSet.OK);
  } catch (error) {
    const where = String(error.stack || '').split('\n')[1] || '';
    console.error(`${QUIZ_CHECK_TITLE}: clear failed: UNEXPECTED ${where.trim()}`);
    ui.alert('Clear check results', 'Something went wrong clearing the results. See Extensions › Apps Script › Executions.',
      ui.ButtonSet.OK);
  }
}

/**
 * Writes one quiz's detailed report on its own tab (quizCheckDetailSheet_) from an upload
 * ({ fileName, gzip, quizId }) and returns the message to show. Throws on failure.
 */
function quizCheckWriteDetail_(upload, started) {
  const files = quizCheckUnpack_(upload);
  const quiz = qtiReadExport_(files).quizzes.find(q => q.id === String(upload.quizId || ''));
  if (!quiz) throw sheetProblem_('That quiz isn\'t in this export. Run the check again and pick it from the new list.');
  const report = qtiQuizReport_(quiz, 1);
  const sheet = quizCheckDetailSheet_(SpreadsheetApp.getActiveSpreadsheet(), quiz);
  sheet.getRange(1, 1, 2, 1).setValues([[QUIZ_CHECK_DETAIL_LABEL], ['Quiz ID']]).setFontWeight('bold');
  sheet.getRange(1, 2, 2, 1).setNumberFormat('@')
    .setValues([[quizCellText_(String(upload.fileName || '').slice(0, 200))], [String(quiz.id)]]);
  const headerRow = writeQuizReport_(sheet, report, new Date());
  const orange = quizCheckOrangeRows_(sheet, report, headerRow);
  sheet.activate();
  const n = report.counts;
  console.log(`${QUIZ_CHECK_TITLE} detail: ${n.groups} group(s), ${n.questions} question(s), ` +
    `${n.checks} check(s), ${orange} orange, ${Date.now() - started} ms.`);
  const shaded = n.checks - orange;
  return `"${quiz.title}": ${n.groups} group(s) and ${n.questions} question(s) on the ` +
    `"${sheet.getName()}" tab.\n\nPoints: ${report.pointsMessage}\n\nPictures: ${report.picturesMessage}` +
    (shaded ? `\n\n${shaded} row(s) need fixing (red).` : '') +
    (orange ? `\n\n${orange} row(s) have suggestions only (orange).` : '');
}

/**
 * The quiz's own detail tab: the one of ours (A1 label) whose B2 is this quiz's ID, else a
 * new tab at the end named "Detail – quiz name" (cut to Google's 100-character limit),
 * with " (2)", " (3)"… added if any tab (ours or the teacher's) already has that name.
 */
function quizCheckDetailSheet_(ss, quiz) {
  const sheets = ss.getSheets();
  const mine = sheets.find(sheet => quizCheckIsOurs_(sheet, QUIZ_CHECK_DETAIL_LABEL) &&
    String(sheet.getRange(2, 2).getDisplayValue()) === String(quiz.id));
  if (mine) return mine;
  const taken = new Set(sheets.map(sheet => sheet.getName().toLowerCase()));
  const base = (QUIZ_CHECK_DETAIL_PREFIX + String(quiz.title || 'Untitled quiz').replace(/[\u0000-\u001f]+/g, ' ')).trim();
  let name = base.slice(0, QUIZ_CHECK_TAB_NAME_MAX);
  for (let n = 2; taken.has(name.toLowerCase()); n++) {
    const suffix = ` (${n})`;
    name = base.slice(0, QUIZ_CHECK_TAB_NAME_MAX - suffix.length) + suffix;
  }
  return ss.insertSheet(name, sheets.length);
}

/** Logs a failed detail (kind and code line only) and returns the message to show. */
function quizCheckDetailFailure_(error, started) {
  const where = String(error.stack || '').split('\n')[1] || '';
  console.error(`${QUIZ_CHECK_TITLE} detail failed after ${Date.now() - started} ms: ` +
    `${error.isSheetProblem ? 'SHEET_PROBLEM' : `UNEXPECTED ${where.trim()}`}`);
  return error.isSheetProblem ? error.message :
    'Something went wrong writing the report. See Extensions › Apps Script › Executions.';
}

/**
 * Saves the upload on the hidden "Quiz Check data" tab: row 1 label and file name, row 2
 * piece and quiz counts, row 3 headings, then from row 4 one quiz per row (ID, name as on
 * the Quiz Check tab, in its row order) beside the upload in pieces of up to 45,000
 * characters, each with "p" in front. Course content only (an export holds no student data).
 */
function quizCheckSaveUpload_(ss, fileName, gzip, quizzes) {
  const sheet = quizCheckSheet_(ss, QUIZ_CHECK_DATA_TAB, QUIZ_CHECK_DATA_LABEL);
  const pieces = [];
  for (let at = 0; at < gzip.length; at += QUIZ_CHECK_PIECE_CHARS) pieces.push(gzip.slice(at, at + QUIZ_CHECK_PIECE_CHARS));
  const count = Math.max(pieces.length, quizzes.length);
  const first = QUIZ_CHECK_DATA_FIRST_ROW;
  sheet.clear();
  if (sheet.getMaxRows() < first + count) sheet.insertRowsAfter(sheet.getMaxRows(), first + count - sheet.getMaxRows());
  sheet.getRange(1, 1, 1, 2).setNumberFormat('@').setValues([[QUIZ_CHECK_DATA_LABEL, quizCellText_(fileName)]]);
  sheet.getRange(2, 1, 1, 3).setValues([['Pieces, quizzes', pieces.length, quizzes.length]]);
  sheet.getRange(3, 1, 1, 3).setValues([['Quiz ID', 'Quiz', 'Upload (gzipped, base64)']]);
  sheet.getRange(first, 1, count, 3).setNumberFormat('@').setValues(Array.from({ length: count }, (_, i) => [
    // "p" in front: a piece can start with "=" (base64 padding), which Sheets reads as a formula.
    quizzes[i] ? String(quizzes[i].id) : '', quizzes[i] ? quizCellText_(quizzes[i].title) : '', pieces[i] ? `p${pieces[i]}` : '']));
  if (!sheet.isSheetHidden()) sheet.hideSheet();
}

/** The saved upload as { fileName, gzip, quizzes: [[id, name]] }; throws if there's none. */
function quizCheckLoadUpload_(ss) {
  const none = () => sheetProblem_('There\'s no saved check to read. Run Quiz Check › Check quizzes… first, ' +
    `then click a quiz's row on the "${QUIZ_CHECK_TAB}" tab.`);
  const sheet = ss.getSheetByName(QUIZ_CHECK_DATA_TAB);
  if (!sheet || !quizCheckIsOurs_(sheet, QUIZ_CHECK_DATA_LABEL)) throw none();
  const [, pieces, quizCount] = sheet.getRange(2, 1, 1, 3).getValues()[0].map(Number);
  if (!(pieces > 0) || !(quizCount > 0)) throw none();
  const values = sheet.getRange(QUIZ_CHECK_DATA_FIRST_ROW, 1, Math.max(pieces, quizCount), 3).getValues();
  return {
    fileName: String(sheet.getRange(1, 2).getDisplayValue()),
    gzip: values.slice(0, pieces).map(row => String(row[2]).slice(1)).join(''),
    quizzes: values.slice(0, quizCount).map(row => [String(row[0]), String(row[1])]),
  };
}

/** Deletes the hidden data tab if it's ours (after a failed save, so it can't be stale). */
function quizCheckDropData_(ss) {
  try {
    const sheet = ss.getSheetByName(QUIZ_CHECK_DATA_TAB);
    if (sheet && quizCheckIsOurs_(sheet, QUIZ_CHECK_DATA_LABEL) && ss.getSheets().length > 1) ss.deleteSheet(sheet);
  } catch {
    console.error(`${QUIZ_CHECK_TITLE}: couldn't remove old saved data.`);
  }
}

/** True when a tab's A1 shows it's one of ours (its label). */
function quizCheckIsOurs_(sheet, label) {
  return String(sheet.getRange('A1').getDisplayValue()).trim().toLowerCase() === label.toLowerCase();
}

/** An error whose message is safe and useful to show as-is. */
function sheetProblem_(message) {
  const error = new Error(message);
  error.isSheetProblem = true;
  return error;
}

// ---- Below: kept identical to course-manager-jupiter (QuizCheck.js, QuizExportReport.js) ----

/**
 * Turns the report's suggestion-only rows (every Check line "worth shrinking") orange;
 * writeQuizReport_ shades every row with a Check red. Returns how many it changed.
 */
function quizCheckOrangeRows_(sheet, report, headerRow) {
  const checkIndex = QUIZ_REPORT_HEADERS.indexOf('Check');
  let count = 0;
  report.rows.forEach((row, i) => {
    const lines = String(row[checkIndex]).split('\n').filter(line => line.trim());
    if (lines.length && lines.every(quizCheckIsSuggestion_)) {
      sheet.getRange(headerRow + 1 + i, 1, 1, QUIZ_REPORT_HEADERS.length).setBackground(QUIZ_CHECK_SUGGESTION_COLOR);
      count++;
    }
  });
  return count;
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
    url: '', // set by quizCheckLinkQuizzes_ when the quiz is matched to its assignment
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
 * QUIZ_CHECK_HEADERS order), colors (one background per quiz row, null when fine),
 * names ([quiz name, Canvas URL or ''] per quiz row, for the links in column A) }.
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
    names: quizzes.map(q => [quizCellText_(q.title), q.url || '']),
  };
}

/**
 * The "Quiz Check" tab, or another of ours (the detail tab), made if missing. A tab by
 * that name that isn't one of ours (A1 says something other than its label) is left
 * alone: the teacher is asked to rename it.
 */
function quizCheckSheet_(ss, name = QUIZ_CHECK_TAB, label = QUIZ_CHECK_LABEL) {
  const sheet = ss.getSheetByName(name);
  if (!sheet) return ss.insertSheet(name);
  const a1 = String(sheet.getRange('A1').getDisplayValue()).trim().toLowerCase();
  if (a1 && a1 !== label.toLowerCase()) {
    throw sheetProblem_(`There's already a "${name}" tab used for something else. ` +
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
    // Quiz names that were matched to Canvas become links (the text stays the same).
    if (overview.names.some(([, url]) => url)) {
      sheet.getRange(first, 1, count, 1).setRichTextValues(overview.names.map(([name, url]) => {
        const text = SpreadsheetApp.newRichTextValue().setText(name);
        return [url ? text.setLinkUrl(url).build() : text.build()];
      }));
    }
  }
  QUIZ_CHECK_WIDTHS.forEach((pixels, i) => sheet.setColumnWidth(i + 1, pixels));
  sheet.setFrozenRows(QUIZ_CHECK_HEADER_ROW);
  sheet.setFrozenColumns(1);
  sheet.activate();
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
    throw sheetProblem_('That export has more quiz text than the workbook can take at once. Nothing was changed.');
  }
  return { texts, sizes };
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
