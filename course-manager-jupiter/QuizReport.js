/**
 * QuizReport.js
 * Purpose: a read-only report of one Classic quiz's structure, so groups ("pick 3 of 7")
 *   and their questions can be seen in one place. runQuizReport (menu: Canvas Tools ›
 *   Quiz report (this tab)).
 *   Tab layout (Lara, 2026-10-26): A1 "Quiz link:", B1 = a Classic quiz link pasted from
 *   Canvas (…/courses/:course/quizzes/:quiz; typed, or a blue link). Works on the tab
 *   being viewed when its A1 says "Quiz link:" (so Lara can keep several report tabs);
 *   otherwise opens (or makes) a tab named "Quiz report". Everything from row 3 down is
 *   replaced on each run: a short summary (title, points in Canvas vs. points found
 *   here), then one row per group followed by its questions, in quiz order.
 *   Known gap: Canvas has no documented way to list a quiz's groups, so groups are found
 *   through their questions. A group that pulls from a question bank has no questions
 *   in the quiz, so it can't be found; the points check shows the missing points.
 *   Quiz questions only: never student answers, submissions, or quiz statistics.
 * Canvas endpoints called (GET via canvasGet_; the course comes from the link):
 *   /api/v1/courses/:course/quizzes/:quiz
 *   /api/v1/courses/:course/quizzes/:quiz/questions
 *   /api/v1/courses/:course/quizzes/:quiz/groups/:group (one per group found)
 * Canvas write operations: none (read-only, so DRY_RUN doesn't apply).
 * Required: User Properties CANVAS_BASE_URL and CANVAS_TOKEN.
 */

const QUIZ_REPORT_TAB = 'Quiz report';
const QUIZ_REPORT_LABEL = 'Quiz link:';
const QUIZ_REPORT_FIRST_ROW = 3;
const QUIZ_REPORT_MAX_TEXT = 5000; // a Sheets cell holds 50,000 characters at most
const QUIZ_REPORT_GROUP_COLOR = '#eeeeee';
const QUIZ_REPORT_HEADERS = Object.freeze(['Kind', 'Group', 'Pick', 'Of', 'Points each',
  'Source', '#', 'Question Type', 'Points', 'Question Name', 'Question', 'Choices',
  'Correct', 'Check', 'Group ID', 'Question ID']);
// Question types whose correct choice(s) are worth showing (weight above 0 = correct).
const QUIZ_CHOICE_TYPES = Object.freeze(['multiple_choice_question', 'true_false_question',
  'multiple_answers_question']);
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

/** Menu: Canvas Tools › Quiz report (this tab). */
function runQuizReport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const title = 'Quiz report';
  try {
    const sheet = quizReportSheet_(ss);
    const linkCell = sheet.getRange('B1');
    const link = cellLinks_(linkCell.getRichTextValues(), linkCell.getFormulas(),
      linkCell.getDisplayValues())[0][0];
    if (!String(link).trim()) {
      ui.alert(title, `Paste a Classic quiz link from Canvas into B1 of the "${sheet.getName()}" ` +
        'tab, then run Quiz report again.', ui.ButtonSet.OK);
      return;
    }
    const parsed = parseQuizLink_(link);
    if (!parsed) {
      throw sheetProblem_('B1 needs a Classic quiz link, like …/courses/123/quizzes/456 ' +
        '(open the quiz in Canvas and copy the address). New Quizzes aren\'t supported.');
    }
    const root = `/courses/${parsed.courseId}/quizzes/${parsed.quizId}`;
    ss.toast('Reading the quiz…', title, -1);
    const quiz = canvasGet_(root);
    const questions = canvasGet_(`${root}/questions`);
    const groups = new Map();
    quizGroupIds_(questions).forEach(id => {
      try {
        groups.set(id, canvasGet_(`${root}/groups/${id}`));
      } catch (error) {
        if (CANVAS_STOP_ALL_TYPES.includes(error.canvasType)) throw error;
        groups.set(id, { failed: error.canvasType || 'UNEXPECTED' });
      }
    });
    const report = buildQuizReport_(quiz, questions, groups);
    writeQuizReport_(sheet, report, new Date());
    ss.toast('', title, 1);
    const n = report.counts;
    console.log(`Quiz report: quiz ${parsed.quizId}, ${n.groups} group(s), ${n.questions} ` +
      `question(s), ${n.checks} check(s), points ${report.pointsOk ? 'match' : 'differ'}.`);
    ui.alert(title, `${n.groups} group(s) and ${n.questions} question(s) listed.\n\n` +
      `Points: ${report.pointsMessage}` +
      (n.checks ? `\n\n${n.checks} row(s) have something in the Check column.` : ''),
    ui.ButtonSet.OK);
  } catch (error) {
    ss.toast('', title, 1);
    reportRefreshFailure_(title, 'The report was not changed.', error);
  }
}

/**
 * The tab to report on: the one being viewed if its A1 says "Quiz link:", otherwise the
 * "Quiz report" tab (made, with its A1 label, if there isn't one), which is then opened.
 */
function quizReportSheet_(ss) {
  const active = ss.getActiveSheet();
  if (exportLabelText_(active.getRange('A1').getDisplayValue()) ===
      exportLabelText_(QUIZ_REPORT_LABEL)) {
    return active;
  }
  const sheet = ss.getSheetByName(QUIZ_REPORT_TAB) || ss.insertSheet(QUIZ_REPORT_TAB);
  if (!String(sheet.getRange('A1').getDisplayValue()).trim()) {
    sheet.getRange('A1').setValue(QUIZ_REPORT_LABEL).setFontWeight('bold');
  }
  sheet.activate();
  return sheet;
}

/** { courseId, quizId } from a Classic quiz link (…/courses/1/quizzes/2…), or null. */
function parseQuizLink_(link) {
  const match = String(link).match(/\/courses\/(\d+)\/quizzes\/(\d+)/);
  return match ? { courseId: match[1], quizId: match[2] } : null;
}

/** Each group ID used by the questions, once, in the order first seen. */
function quizGroupIds_(questions) {
  return Array.from(new Set(questions.map(q => q.quiz_group_id).filter(Boolean)));
}

/**
 * Builds the report from Canvas's replies. groups: Map group ID → the group, or
 * { failed: errorType } when it couldn't be read. Returns { summary: [[label, value]],
 * rows (QUIZ_REPORT_HEADERS order), groupRows (0-based indexes into rows), counts,
 * pointsOk, pointsMessage }.
 */
function buildQuizReport_(quiz, questions, groups) {
  const inGroup = new Map();
  const tops = [];
  questions.forEach(q => {
    if (!q.quiz_group_id) {
      tops.push({ position: q.position, question: q });
      return;
    }
    if (!inGroup.has(q.quiz_group_id)) inGroup.set(q.quiz_group_id, []);
    inGroup.get(q.quiz_group_id).push(q);
  });
  inGroup.forEach((list, id) => {
    const group = groups.get(id) || {};
    tops.push({ position: group.failed ? quizMinPosition_(list) : group.position,
      groupId: id });
  });
  // Quiz order; at the same position a group comes first.
  const order = item => (Number.isFinite(item.position) ? item.position : Infinity);
  tops.sort((a, b) => order(a) - order(b) || (a.groupId ? -1 : 0) - (b.groupId ? -1 : 0));

  const rows = [];
  const groupRows = [];
  const counts = { groups: 0, questions: 0, checks: 0 };
  let found = 0;
  let number = 0;
  const questionRow = (q, groupName, groupId, points) => {
    number++;
    counts.questions++;
    const answers = quizAnswerCells_(q);
    const text = quizHtmlText_(q.question_text);
    const check = !text ? 'No question text' :
      (QUIZ_CHOICE_TYPES.includes(q.question_type) && !answers.correct ?
        'No correct answer marked' : '');
    if (check) counts.checks++;
    rows.push(['Question', groupName, '', '', '', '', number,
      QUIZ_TYPE_NAMES[q.question_type] || q.question_type || '', points,
      q.question_name || '', quizCellText_(text), quizCellText_(answers.choices),
      answers.correct, check, groupId || '', q.id]);
  };
  tops.forEach(item => {
    if (item.question) {
      const points = Number(item.question.points_possible) || 0;
      found += points;
      questionRow(item.question, '', '', points);
      return;
    }
    const list = inGroup.get(item.groupId).slice()
      .sort((a, b) => (a.position || 0) - (b.position || 0));
    const group = groups.get(item.groupId) || { failed: 'UNEXPECTED' };
    counts.groups++;
    groupRows.push(rows.length);
    if (group.failed) {
      counts.checks++;
      rows.push(['Group', '(couldn\'t read)', '', list.length, '', '', '', '', '', '', '', '',
        '', `Couldn't read this group (${group.failed})`, item.groupId, '']);
      list.forEach(q => questionRow(q, '', item.groupId, ''));
      return;
    }
    const pick = Number(group.pick_count) || 0;
    const each = Number(group.question_points) || 0;
    found += pick * each;
    const bank = group.assessment_question_bank_id;
    const check = pick === 0 ? 'Picks 0: students get no question from this group' :
      (!bank && pick > list.length ? `Picks ${pick} but has only ${list.length} question(s)` : '');
    if (check) counts.checks++;
    rows.push(['Group', group.name || '', pick, list.length, each,
      bank ? `Bank ${bank}` : 'In quiz', '', '', pick * each, '', '', '', '', check,
      item.groupId, '']);
    list.forEach(q => questionRow(q, group.name || '', item.groupId, each));
  });

  const canvasPoints = Number(quiz.points_possible) || 0;
  const diff = Math.round((canvasPoints - found) * 100) / 100;
  const pointsOk = Math.abs(diff) < 0.01;
  const pointsMessage = pointsOk ? 'OK: every point is accounted for.' :
    (diff > 0 ? `${diff} point(s) not found here. Usually a group that pulls from a ` +
      'question bank: Canvas doesn\'t list those, so they don\'t appear below.' :
      `${-diff} more point(s) here than Canvas shows. Canvas may update its total after ` +
      'the quiz is saved again (Edit › Save).');
  const summary = [
    ['Quiz', quiz.title || ''],
    ['Published', quiz.published ? 'Yes' : 'No'],
    ['Points in Canvas', canvasPoints],
    ['Points found here', found],
    ['Points check', pointsMessage],
  ];
  return { summary, rows, groupRows, counts, pointsOk, pointsMessage };
}

/** The smallest question position in a list (for a group whose own position is unknown). */
function quizMinPosition_(list) {
  const positions = list.map(q => q.position).filter(Number.isFinite);
  return positions.length ? Math.min(...positions) : Infinity;
}

/**
 * A question's answers as two cells: choices ("1) text" per line) and correct (the
 * numbers of the correct choices, only for multiple choice, true/false, and multiple
 * answers).
 */
function quizAnswerCells_(question) {
  const answers = Array.isArray(question.answers) ? question.answers : [];
  const choices = answers.map((a, i) => `${i + 1}) ${quizAnswerText_(a)}`).join('\n');
  const correct = QUIZ_CHOICE_TYPES.includes(question.question_type) ?
    answers.map((a, i) => (Number(a.weight) > 0 ? i + 1 : 0)).filter(Boolean).join(', ') : '';
  return { choices, correct };
}

/**
 * One answer's text: a matching pair as "left → right" (Canvas also puts the left side in
 * text, so pairs come first), else plain text, else its HTML as text, else numeric parts.
 */
function quizAnswerText_(answer) {
  if (answer.left || answer.right) return `${answer.left || ''} → ${answer.right || ''}`;
  if (answer.text) return String(answer.text);
  const html = quizHtmlText_(answer.html);
  if (html) return html;
  if (answer.exact !== undefined && answer.exact !== null) {
    return `${answer.exact}` + (Number(answer.margin) ? ` ± ${answer.margin}` : '');
  }
  if (answer.start !== undefined && answer.start !== null) return `${answer.start} to ${answer.end}`;
  return '';
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
    .replace(/&#(\d+);/g, (all, code) => String.fromCharCode(Number(code)))
    .split('\n').map(line => line.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n');
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

/** Replaces everything from row 3 down with the report. Rows 1–2 are left alone. */
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

  const headerRow = first + summary.length + 1;
  sheet.getRange(headerRow, 1, 1, width).setValues([QUIZ_REPORT_HEADERS.slice()])
    .setFontWeight('bold');
  if (!report.rows.length) return;
  const table = sheet.getRange(headerRow + 1, 1, report.rows.length, width);
  table.setValues(report.rows).setVerticalAlignment('top');
  report.groupRows.forEach(i => sheet.getRange(headerRow + 1 + i, 1, 1, width)
    .setBackground(QUIZ_REPORT_GROUP_COLOR).setFontWeight('bold'));
  ['Question', 'Choices'].forEach(label => {
    const col = QUIZ_REPORT_HEADERS.indexOf(label) + 1;
    sheet.getRange(headerRow + 1, col, report.rows.length, 1).setWrap(true);
    sheet.setColumnWidth(col, label === 'Question' ? 400 : 250);
  });
}
