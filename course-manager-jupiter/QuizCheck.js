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
 *   Links (Lara, 2026-11-09): when a course export is from this workbook's course
 *   (cfg_CourseID), the assignment list (ref_assignmentGroups) is refreshed from Canvas
 *   first (writeAssignmentGroupsSheet_, the same read-only refresh the reorder tool uses;
 *   Course check is not run), and each quiz name links to its assignment's Canvas page
 *   (a Classic quiz's assignment page opens the quiz). An export doesn't carry Canvas
 *   numbers, only identifiers that Canvas makes from them (quizCheckAssignmentKeys_), so
 *   each listed assignment's identifier is worked out and matched. Ungraded quizzes
 *   aren't assignments and stay unlinked. If the refresh fails, the list already on the
 *   tab is used; the check itself never depends on Canvas.
 *   Detailed report (step 3b; Lara, 2026-11-09): the window is a side panel, so the
 *   sheet stays usable. After the check it lists the quizzes; clicking one sends the same
 *   upload again with that quiz's id to receiveQuizCheckDetail, which writes the Quiz
 *   report layout (writeQuizReport_) on one shared "Quiz Check detail" tab, replaced each
 *   click. Rows whose Check holds only suggestions are orange there too.
 *   Course content only: an export holds no student data. Logs counts and timings only.
 * Canvas endpoints called (GET, via writeAssignmentGroupsSheet_ in RefSheets.js):
 *   /api/v1/courses/:course/assignment_groups?include[]=assignments&include[]=all_dates
 * Canvas write operations: none.
 * Required: User Properties CANVAS_BASE_URL and CANVAS_TOKEN (links only; the check runs
 *   without them); named range cfg_CourseID.
 */

const QUIZ_CHECK_TITLE = 'Quiz Check';
const QUIZ_CHECK_TAB = 'Quiz Check';
const QUIZ_CHECK_LABEL = 'Quiz Check:';
const QUIZ_CHECK_DETAIL_TAB = 'Quiz Check detail';
const QUIZ_CHECK_DETAIL_LABEL = 'Quiz Check detail:';
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

/**
 * Menu: Canvas Tools › Quiz Check. Opens the window in the side panel (Lara, 2026-11-09),
 * so the teacher can read a report tab and pick the next quiz without closing it.
 */
function showQuizCheck() {
  const html = HtmlService.createHtmlOutputFromFile('QuizCheckUpload').setTitle(QUIZ_CHECK_TITLE);
  SpreadsheetApp.getUi().showSidebar(html);
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
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = quizCheckSheet_(ss); // before Canvas: a tab-name clash changes nothing
    const linkNote = result.courseExport ? quizCheckLinkQuizzes_(ss, result, quizzes) : '';
    writeQuizCheckOverview_(sheet, quizCheckOverview_(quizzes, name, new Date()));
    const red = quizzes.filter(q => q.level === 'problem').length;
    const orange = quizzes.filter(q => q.level === 'suggestion').length;
    const linked = quizzes.filter(q => q.url).length;
    console.log(`${QUIZ_CHECK_TITLE}: ${quizzes.length} quiz(zes), ${red} red, ${orange} orange, ` +
      `${linked} linked, course export: ${result.courseExport}, ${Date.now() - started} ms.`);
    const single = result.courseExport ? '' : '\n\nThis is a single-quiz export. A course export ' +
      '(Settings › Export Course Content › Course) is the stricter check: it shows pictures ' +
      'that students can\'t open, such as ones from another course.';
    return {
      ok: true,
      courseExport: result.courseExport,
      quizzes,
      message: `Checked ${quizzes.length} quiz(zes) from "${name}". See the "${sheet.getName()}" tab: ` +
        `${quizCheckCountLine_(quizzes)}.${linkNote ? `\n\n${linkNote}` : ''}${single}`,
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
 * Called from the window (google.script.run) when a quiz in its list is clicked, with
 * { fileName, gzip, quizId, url }: the same upload as receiveCourseExport, the quiz's id,
 * and its Canvas link from the check ('' if none). Writes that quiz's detailed report on
 * the "Quiz Check detail" tab and returns { ok, message }; never throws to the window.
 */
function receiveQuizCheckDetail(upload) {
  const started = Date.now();
  try {
    const files = quizCheckUnpack_(upload);
    const quiz = qtiReadExport_(files).quizzes.find(q => q.id === String(upload.quizId || ''));
    if (!quiz) throw sheetProblem_('That quiz isn\'t in this export. Run the check again and pick it from the new list.');
    const report = qtiQuizReport_(quiz, 1);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = quizCheckSheet_(ss, QUIZ_CHECK_DETAIL_TAB, QUIZ_CHECK_DETAIL_LABEL);
    sheet.getRange(1, 1).setValue(QUIZ_CHECK_DETAIL_LABEL).setFontWeight('bold');
    sheet.getRange(1, 2).setNumberFormat('@').setValue(quizCellText_(String(upload.fileName || '').slice(0, 200)));
    const headerRow = writeQuizReport_(sheet, report, new Date());
    const orange = quizCheckOrangeRows_(sheet, report, headerRow);
    // The quiz's name (summary row "Quiz") links to Canvas, like on the overview.
    const url = String(upload.url || '');
    if (/^https:\/\//i.test(url)) {
      sheet.getRange(QUIZ_REPORT_FIRST_ROW, 2).setRichTextValue(SpreadsheetApp.newRichTextValue()
        .setText(String(report.summary[0][1])).setLinkUrl(url).build());
    }
    sheet.activate();
    const n = report.counts;
    console.log(`${QUIZ_CHECK_TITLE} detail: ${n.groups} group(s), ${n.questions} question(s), ` +
      `${n.checks} check(s), ${orange} orange, ${Date.now() - started} ms.`);
    const shaded = n.checks - orange;
    return { ok: true, message: `"${quiz.title}": ${n.groups} group(s) and ${n.questions} question(s) on the ` +
      `"${sheet.getName()}" tab.\n\nPoints: ${report.pointsMessage}\n\nPictures: ${report.picturesMessage}` +
      (shaded ? `\n\n${shaded} row(s) need fixing (red).` : '') +
      (orange ? `\n\n${orange} row(s) have suggestions only (orange).` : '') };
  } catch (error) {
    const where = String(error.stack || '').split('\n')[1] || '';
    console.error(`${QUIZ_CHECK_TITLE} detail failed after ${Date.now() - started} ms: ` +
      `${error.isSheetProblem ? 'SHEET_PROBLEM' : `UNEXPECTED ${where.trim()}`}`);
    return { ok: false, message: error.isSheetProblem ? error.message :
      'Something went wrong writing the report. See Extensions › Apps Script › Executions.' };
  }
}

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
 * Links each quiz to its assignment's Canvas page: sets url on the matching summaries
 * (quizzes) and returns one line for the window ('' when there's nothing to say). Only for
 * a course export from this workbook's course. Refreshes the assignment list first; if
 * that fails, uses the list already on the tab. Never throws: links are a convenience.
 */
function quizCheckLinkQuizzes_(ss, result, quizzes) {
  let courseId;
  try {
    courseId = getCourseIdForRefresh_();
  } catch (error) {
    return `Quiz names aren't linked to Canvas: ${quizCheckReason_(error)}`;
  }
  if (result.courseId && result.courseId !== courseId) {
    return `Quiz names aren't linked to Canvas: this export is from course ${result.courseId}, ` +
      `but this workbook is set up for course ${courseId}.`;
  }
  let refreshNote = '';
  try {
    writeAssignmentGroupsSheet_(ss);
  } catch (error) {
    console.error(`${QUIZ_CHECK_TITLE}: assignment list refresh failed (${error.canvasType || 'SHEET_PROBLEM'}).`);
    refreshNote = `The assignment list couldn't be refreshed from Canvas (${quizCheckReason_(error)}), ` +
      'so links come from the list as it was. ';
  }
  let assignments;
  try {
    assignments = readAssignmentGroups_();
  } catch (error) {
    return `${refreshNote}Quiz names aren't linked to Canvas: ${quizCheckReason_(error)}`;
  }
  const urls = quizCheckLinks_(result.quizzes, assignments, result.rootAccountId, quizCheckMd5Hex_);
  quizzes.forEach(q => { q.url = urls.get(q.id) || ''; });
  const missing = quizzes.filter(q => !q.url).length;
  if (!missing) return `${refreshNote}Every quiz name links to its page in Canvas.`.trim();
  return `${refreshNote}${quizzes.length - missing} of ${quizzes.length} quiz names link to their page ` +
    `in Canvas. ${missing} aren't linked: ungraded quizzes (such as practice quizzes) aren't ` +
    `Canvas assignments${refreshNote ? ', and quizzes made since the list was last refreshed aren\'t on it' : ''}.`;
}

/** An error as a short reason for the window: a sheet problem's own words, else a general one. */
function quizCheckReason_(error) {
  if (error && error.isSheetProblem) return error.message;
  if (error && error.canvasType) return describeCanvasError_(error);
  return 'something went wrong';
}

/**
 * Map quiz id → Canvas URL. quizzes: QtiReader quizzes (id, assignmentRef). assignments:
 * [{ assignmentId, url }] (readAssignmentGroups_). A Classic quiz's export names its
 * assignment (assignmentRef); a New Quiz's own id is its assignment's. Only https links.
 */
function quizCheckLinks_(quizzes, assignments, rootAccountId, md5Hex) {
  const byKey = new Map();
  assignments.forEach(a => {
    if (!/^\d+$/.test(String(a.assignmentId)) || !/^https:\/\//i.test(String(a.url || ''))) return;
    quizCheckAssignmentKeys_(String(a.assignmentId), rootAccountId, md5Hex).forEach(key => byKey.set(key, a.url));
  });
  const urls = new Map();
  quizzes.forEach(quiz => {
    const url = [quiz.assignmentRef, quiz.id].filter(Boolean).map(ref => byKey.get(ref)).find(Boolean);
    if (url) urls.set(quiz.id, url);
  });
  return urls;
}

/**
 * The identifiers a course export could use for assignment number id: "g" + MD5 of
 * "assignment_<global id>", where the global id puts the school's server number (the
 * root account number's digits above the last 13) in front of the 13-digit number
 * (checked on Lara's 11/9 Biology export: all 45 graded quizzes matched). The plain
 * "assignment_<id>" form is included for a Canvas without server numbers.
 */
function quizCheckAssignmentKeys_(id, rootAccountId, md5Hex) {
  const keys = [`assignment_${id}`];
  const root = String(rootAccountId || '');
  if (/^\d{14,}$/.test(root) && id.length <= 13) {
    keys.unshift(`assignment_${root.slice(0, -13)}${id.padStart(13, '0')}`);
  }
  return keys.map(key => `g${md5Hex(key)}`);
}

/** MD5 of some text as 32 lowercase hex digits (Apps Script's digest bytes are signed). */
function quizCheckMd5Hex_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, text, Utilities.Charset.UTF_8)
    .map(b => ((b + 256) % 256).toString(16).padStart(2, '0')).join('');
}
