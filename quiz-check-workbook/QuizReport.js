/**
 * QuizReport.js (Quiz Check workbook)
 * Purpose: the picture helpers and the detailed-report writer that QtiReader.js and
 *   QuizCheck.js use. A trimmed copy of course-manager-jupiter/QuizReport.js: only the
 *   parts that work from an export file, not the old live Canvas report. Every function
 *   here is kept identical to Jupiter's (scripts/checks/quiz-check-workbook.check.js
 *   compares them), so a fix made in one project must be copied to the other.
 *   Quiz content only: never student answers, submissions, or quiz statistics.
 * Canvas endpoints called: none.
 * Canvas write operations: none.
 * Required User/Script Properties: none.
 */

const QUIZ_REPORT_FIRST_ROW = 3;
const QUIZ_REPORT_MAX_TEXT = 5000; // a Sheets cell holds 50,000 characters at most
const QUIZ_REPORT_GROUP_COLOR = '#eeeeee';
const QUIZ_REPORT_CHECK_COLOR = '#f4cccc'; // light red: a row with something in Check
const QUIZ_REPORT_HEADERS = Object.freeze(['Kind', 'Group', 'Pick', 'Of', 'Points each',
  'Source', '#', 'Question Type', 'Points', 'Question Name', 'Question', 'Choices',
  'Correct', 'Pictures', 'Check', 'Group ID', 'Question ID']);
// Pixel widths; Kind through Question (minus the hidden Question Name) are frozen.
const QUIZ_REPORT_WIDTHS = Object.freeze({ Kind: 70, Group: 160, Pick: 45, Of: 40,
  'Points each': 55, Source: 70, '#': 35, 'Question Type': 110, Points: 50, Question: 300,
  Choices: 250, Correct: 70, Pictures: 300, Check: 300 });
const QUIZ_REPORT_TEXT_COLUMNS = Object.freeze(['Group', 'Question Name', 'Question',
  'Choices', 'Correct', 'Pictures', 'Check']);
const QUIZ_PICTURE_BIG = 1000 * 1000;  // "shrink it"
const QUIZ_PICTURE_LARGE = 500 * 1000; // "worth shrinking"
const QUIZ_TYPE_NAMES = Object.freeze({
  multiple_choice_question: 'Multiple choice',
  true_false_question: 'True/false',
  multiple_answers_question: 'Multiple answers',
  short_answer_question: 'Fill in the blank',
  fill_in_multiple_blanks_question: 'Fill in multiple blanks',
  multiple_dropdowns_question: 'Multiple dropdowns',
  matching_question: 'Matching',
  numerical_question: 'Numerical',
  calculated_question: 'Formula',
  essay_question: 'Essay',
  file_upload_question: 'File upload',
  text_only_question: 'Text (no question)',
});

/** Each <img> in some HTML as { src, endpoint } (endpoint = its data-api-endpoint, if any). */
function quizPictureTags_(html) {
  return (String(html || '').match(/<img\b[^>]*>/gi) || []).map(tag => ({
    src: (tag.match(/\ssrc\s*=\s*(["'])([^"']*)\1/i) || [])[2] || '',
    endpoint: (tag.match(/\sdata-api-endpoint\s*=\s*(["'])([^"']*)\1/i) || [])[2] || '',
  }));
}

/**
 * Where a picture address points: { kind: 'file', fileId, courseId, userFiles } for a
 * Canvas file; 'bank' (old question-bank file); 'outside' with site; 'embedded' with
 * bytes (a data: picture); 'equation' (Canvas's math images, not checked); or 'other'.
 */
function quizPictureSource_(src, baseUrl) {
  const address = String(src || '').replace(/&amp;/g, '&').trim();
  if (/^data:/i.test(address)) {
    return { kind: 'embedded', bytes: Math.round((address.length - address.indexOf(',') - 1) * 3 / 4) };
  }
  const base = String(baseUrl || '').toLowerCase();
  const host = ((address.match(/^(?:https?:)?\/\/([^/?#]+)/i) || [])[1] || '').toLowerCase();
  let path = '';
  if (address.startsWith('/') && !address.startsWith('//')) {
    path = address;
  } else if (base && address.toLowerCase().startsWith(base + '/')) {
    path = address.slice(base.length);
  } else if (host.endsWith('.instructure.com')) {
    path = address.replace(/^(?:https?:)?\/\/[^/?#]+/i, '');
  } else {
    return host ? { kind: 'outside', site: host } : { kind: 'other' };
  }
  if (/^\/equation_images\//i.test(path)) return { kind: 'equation' };
  if (/^\/assessment_questions\//i.test(path)) return { kind: 'bank' };
  const fileId = (path.match(/\/files\/(\d+)(?:[/?#]|$)/) || [])[1];
  if (!fileId) return { kind: 'other' };
  return { kind: 'file', fileId, courseId: (path.match(/^\/courses\/(\d+)\//) || [])[1] || '',
    userFiles: /^\/users\/\d+\//.test(path) };
}

/** Size problems for a picture: 1 MB and up "shrink it", 500 KB and up "worth shrinking". */
function quizPictureSizeProblems_(what, bytes) {
  const n = Number(bytes);
  if (n >= QUIZ_PICTURE_BIG) return [`${what} is ${quizPictureSize_(n)}: shrink it`];
  if (n >= QUIZ_PICTURE_LARGE) return [`${what} is ${quizPictureSize_(n)}: worth shrinking`];
  return [];
}

/** "4.1 MB", "254 KB", or "size unknown". */
function quizPictureSize_(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || bytes === null || bytes === undefined || bytes === '') return 'size unknown';
  return n >= QUIZ_PICTURE_BIG ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`;
}

/**
 * Question HTML as readable plain text: line breaks kept, pictures shown as [picture],
 * other tags removed, common &-codes turned back into characters.
 */
function quizHtmlText_(html) {
  const named = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'' };
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<img\b[^>]*>/gi, ' [picture] ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(nbsp|amp|lt|gt|quot|apos);/g, (all, name) => named[name])
    // Character codes, decimal (&#8217;) or hex (&#x2019;, which New Quizzes writes).
    .replace(/&#(\d+);/g, (all, code) => quizCodePoint_(Number(code), all))
    .replace(/&#x([0-9a-f]+);/gi, (all, code) => quizCodePoint_(parseInt(code, 16), all))
    .split('\n').map(line => line.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n');
}

/** The character for a code number, or the original text if it isn't a valid character. */
function quizCodePoint_(code, original) {
  return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : original;
}

/**
 * Text as it should land in a cell: cut to QUIZ_REPORT_MAX_TEXT characters, and a
 * leading = or + gets an apostrophe so Sheets shows it instead of reading a formula.
 */
function quizCellText_(text) {
  const value = String(text || '');
  const cut = value.length > QUIZ_REPORT_MAX_TEXT ?
    value.slice(0, QUIZ_REPORT_MAX_TEXT) + ' …(cut)' : value;
  return /^[=+]/.test(cut) ? `'${cut}` : cut;
}

/**
 * Replaces everything from row 3 down with the report. Rows 1–2 are left alone. Returns
 * the header row's number (the table starts on the row below it).
 */
function writeQuizReport_(sheet, report, now) {
  const first = QUIZ_REPORT_FIRST_ROW;
  const width = QUIZ_REPORT_HEADERS.length;
  if (sheet.getMaxColumns() < width) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), width - sheet.getMaxColumns());
  }
  if (sheet.getMaxRows() >= first) {
    sheet.getRange(first, 1, sheet.getMaxRows() - first + 1, sheet.getMaxColumns())
      .clear().clearNote();
  }
  const summary = report.summary.concat([['Report made', now]]);
  sheet.getRange(first, 1, summary.length, 2).setValues(summary);
  sheet.getRange(first, 1, summary.length, 1).setFontWeight('bold');
  sheet.getRange(first + summary.length - 1, 2).setNumberFormat('M/d/yyyy h:mm am/pm');
  if (!report.pointsOk) sheet.getRange(first + 4, 2).setBackground('#fff2cc');
  if (!report.picturesOk) sheet.getRange(first + 5, 2).setBackground('#fff2cc');

  const headerRow = first + summary.length + 1;
  sheet.getRange(headerRow, 1, 1, width).setValues([QUIZ_REPORT_HEADERS.slice()])
    .setFontWeight('bold');
  if (!report.rows.length) {
    quizReportLayout_(sheet, headerRow);
    return headerRow;
  }
  // Text columns stay plain text, so Sheets can't turn "1, 2, 3" (Correct) or a name like
  // "11/20" into a date. Must be set before the values go in.
  QUIZ_REPORT_TEXT_COLUMNS.forEach(label => sheet.getRange(headerRow + 1,
    QUIZ_REPORT_HEADERS.indexOf(label) + 1, report.rows.length, 1).setNumberFormat('@'));
  const table = sheet.getRange(headerRow + 1, 1, report.rows.length, width);
  table.setValues(report.rows).setVerticalAlignment('top');
  report.groupRows.forEach(i => sheet.getRange(headerRow + 1 + i, 1, 1, width)
    .setBackground(QUIZ_REPORT_GROUP_COLOR).setFontWeight('bold'));
  // Rows needing attention (anything in Check) are light red, group rows included. The
  // table is rewritten each run, so plain shading is used, not conditional formatting.
  const checkIndex = QUIZ_REPORT_HEADERS.indexOf('Check');
  report.rows.forEach((row, i) => {
    if (String(row[checkIndex]).trim()) {
      sheet.getRange(headerRow + 1 + i, 1, 1, width).setBackground(QUIZ_REPORT_CHECK_COLOR);
    }
  });
  ['Question', 'Choices', 'Pictures', 'Check'].forEach(label => sheet.getRange(headerRow + 1,
    QUIZ_REPORT_HEADERS.indexOf(label) + 1, report.rows.length, 1).setWrap(true));
  quizReportLayout_(sheet, headerRow);
  return headerRow;
}

/**
 * Column widths and frozen panes (Lara, 2026-11-08): the header row and everything above
 * it stay put, and so do the columns through Question, so a question stays beside its
 * Pictures and Check while scrolling. The small columns are slimmed and Question Name
 * (always "Question" in practice) is hidden so the frozen part (about 935 pixels) fits a
 * laptop screen.
 */
function quizReportLayout_(sheet, headerRow) {
  const width = QUIZ_REPORT_HEADERS.length;
  sheet.getRange(headerRow, 1, 1, width).setWrap(true).setVerticalAlignment('bottom');
  Object.keys(QUIZ_REPORT_WIDTHS).forEach(label =>
    sheet.setColumnWidth(QUIZ_REPORT_HEADERS.indexOf(label) + 1, QUIZ_REPORT_WIDTHS[label]));
  sheet.hideColumns(QUIZ_REPORT_HEADERS.indexOf('Question Name') + 1);
  sheet.setFrozenRows(headerRow);
  sheet.setFrozenColumns(QUIZ_REPORT_HEADERS.indexOf('Question') + 1);
}
