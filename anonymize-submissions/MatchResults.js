/**
 * MatchResults.js
 * Purpose: matches AI results for one assignment (started from an Index row). Reads the AI-graded
 *   table pasted into its "<name> AI" tab (columns Code, Score, Feedback, Confidence,
 *   Notes, matched by header name, any order), looks each code up in "<name> Key", and
 *   rebuilds "<name> Review" with the student's name next to each result. Flags codes
 *   that are not in the key, codes listed twice, and students the AI left out.
 *   New Quiz answers (see QuizCsv.js) come back one row per answer instead: Code,
 *   Question, Group, Why, Notes. The AI sorts answers into groups; it does not score.
 *   Review is then one row per answer, sorted by student and question, and every answer
 *   in "<name> answers.csv" that the AI left out is flagged.
 *   The pasted table is untrusted text: it is written back as plain text only and is
 *   never treated as instructions or formulas.
 * Canvas endpoints called: none.
 * Canvas write operations: none.
 * Required User/Script Properties: none.
 */

const RESULTS_HEADERS = ['Code', 'Score', 'Feedback', 'Confidence', 'Notes'];
const REVIEW_HEADERS = ['Name', 'Code', 'Score', 'Feedback', 'Confidence', 'Notes',
  'Problem', 'Reviewed'];
const QUIZ_RESULTS_HEADERS = ['Code', 'Question', 'Group', 'Why', 'Notes'];
// Same length as REVIEW_HEADERS with Reviewed last: Archive and the "already checked"
// warning find the checkboxes by position.
const QUIZ_REVIEW_HEADERS = ['Name', 'Code', 'Question', 'Group', 'Why', 'Notes',
  'Problem', 'Reviewed'];
// Every column either kind of AI table can have.
const RESULTS_FIELDS = [...new Set([...RESULTS_HEADERS, ...QUIZ_RESULTS_HEADERS])];
const CODE_RE = /^S-[0-9A-F]{6}$/;

/**
 * Matches one assignment's AI results. Called from the Index tab (see Index.js).
 * Shows a summary alert and returns a short status line for the Index, or null if it
 * stopped early (after telling Lara why).
 */
function runMatch_(ui, assignmentId, shortName, folderId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const resultsName = tabName_(shortName, 'AI');
    const keyName = tabName_(shortName, 'Key');
    const reviewName = tabName_(shortName, 'Review');

    const resultsSheet = ss.getSheetByName(resultsName);
    if (!resultsSheet || resultsSheet.getLastRow() < 2) {
      getOrCreateSheet_(resultsName, RESULTS_HEADERS).activate();
      ui.alert('Paste the AI\'s table into the "' + resultsName + '" tab first ' +
        '(include its header row), then run this again.');
      return null;
    }
    const keySheet = ss.getSheetByName(keyName);
    if (!keySheet || keySheet.getLastRow() < 2) {
      ui.alert('The "' + keyName + '" tab is missing or empty. Anonymize this row first.');
      return null;
    }
    const keyRows = keySheet.getRange(2, 1, keySheet.getLastRow() - 1, KEY_HEADERS.length)
      .getDisplayValues();

    const parsed = parseResultsTable_(resultsSheet.getDataRange().getDisplayValues());
    if (parsed.error) {
      ui.alert(parsed.error);
      return null;
    }

    const reviewSheet = getOrCreateSheet_(reviewName, REVIEW_HEADERS);
    if (hasCheckedReviews_(reviewSheet)) {
      const confirm = ui.alert('Replace the review tab?',
        'Some rows in "' + reviewName + '" are already checked as reviewed. Rebuilding it ' +
        'clears those checkmarks.\n\nReplace it?', ui.ButtonSet.YES_NO);
      if (confirm !== ui.Button.YES) return null;
    }

    const students = studentsByCode_(keyRows, assignmentId);
    let review;
    if (parsed.quiz) {
      review = buildQuizReview_(parsed.rows, students, readQuizAnswers_(folderId, shortName));
      writeReview_(reviewSheet, QUIZ_REVIEW_HEADERS, review.rows.map((row) =>
        [asText_(row.name), asText_(row.code), asText_(row.question), asText_(row.group),
          asText_(row.why), asText_(row.notes), row.problem]));
      boldQuestionText_(reviewSheet, review.rows.map((row) => row.question));
    } else {
      review = buildReview_(parsed.rows, students);
      writeReview_(reviewSheet, REVIEW_HEADERS, review.rows.map(
        ([studentName, code, score, feedback, confidence, notes, problem]) => [
          asText_(studentName), asText_(code), scoreValue_(score), asText_(feedback),
          asText_(confidence), asText_(notes), problem]));
    }

    // Counts and IDs only: no student data in logs.
    console.log('matchAiResults: assignment ' + assignmentId + ' matched=' +
      review.matched + ' problems=' + review.problems + ' quiz=' + parsed.quiz);
    reviewSheet.activate();
    ui.alert('"' + reviewName + '" is ready',
      'Matched: ' + review.matched + (parsed.quiz ? ' answers' : '') + '\n' +
      'Needing a look: ' + review.problems +
      (review.problems ? ' (these are at the top, with the reason in the Problem column)' : ''),
      ui.ButtonSet.OK);
    return review.matched + ' matched, ' + review.problems + ' to check';
  } catch (err) {
    console.error('matchAiResults failed: ' + err.message);
    ui.alert('Something went wrong while matching results. The Key and AI tabs were ' +
      'not changed.');
    return null;
  }
}

/**
 * Reads the pasted table. Accepts a normal pasted table, or a Markdown table that landed
 * as "| a | b |" lines in column A. Returns { rows, quiz }: rows are objects with the
 * RESULTS_FIELDS fields ('' when a column is missing); quiz is true when a header has a
 * Group column (New Quiz answers). Rows above the first header row are ignored.
 */
function parseResultsTable_(values) {
  const grid = values
    .map(splitMarkdownRow_)
    .filter((cells) => cells.some((cell) => cell !== ''))
    .filter((cells) => !cells.every((cell) => cell === '' || /^:?-{3,}:?$/.test(cell)));

  // Every row with a "Code" cell is a header and sets the column order for the rows
  // under it, so pasting below the script's header row, or pasting several batches,
  // works even if the AI ordered its columns differently.
  const isHeader = (cells) => cells.some((cell) => cell.toLowerCase() === 'code');
  if (!grid.some(isHeader)) {
    return { error: 'Could not find a header row with a "Code" column in the AI tab.' };
  }
  const cellAt = (cells, index) => (index === -1 ? '' : String(cells.at(index) || '').trim());
  let columns = null;
  let quiz = false;
  const rows = [];
  for (const cells of grid) {
    if (isHeader(cells)) {
      const header = cells.map((cell) => cell.toLowerCase());
      columns = RESULTS_FIELDS.map((name) => header.indexOf(name.toLowerCase()));
      if (header.includes('group')) quiz = true;
      continue;
    }
    if (!columns) continue;
    rows.push(Object.fromEntries(RESULTS_FIELDS.map((name, i) => [name, cellAt(cells, columns[i])])));
  }
  return { rows, quiz };
}

/** "| a | b |" in the first cell only → ['a', 'b']. Any other row is returned trimmed. */
function splitMarkdownRow_(row) {
  const cells = row.map((cell) => String(cell).trim());
  const onlyFirst = cells.slice(1).every((cell) => cell === '');
  if (onlyFirst && cells[0].startsWith('|')) {
    return cells[0].replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
  }
  return cells;
}

/**
 * Cleans up a code as the AI typed it: "s‑O14852-2.pdf" → "S-014852-2". Removes spaces
 * and invisible characters, turns any dash into "-", drops a file extension, and, since
 * codes only use 0-9 and A-F, reads the letters O as 0 and I or L as 1.
 * Returns '' if it still isn't a code.
 */
function normalizeCode_(text) {
  const cleaned = String(text).normalize('NFKC')
    .replace(/[\s\u200B-\u200D\u2060\uFEFF]/g, '')
    .toUpperCase()
    .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-')
    .replace(/\.[A-Z0-9]+$/, '');
  const match = /^S-([0-9A-Z]{6})(-\d+)?$/.exec(cleaned);
  if (!match) return '';
  const body = match[1].replace(/O/g, '0').replace(/[IL]/g, '1');
  return CODE_RE.test('S-' + body) ? 'S-' + body + (match[2] || '') : '';
}

/**
 * "s-9c1e4b-2.pdf" → "S-9C1E4B" (the student's code, without a file number). Keeps the
 * first 8 characters rather than stripping "-digits", because a code can be all digits
 * (S-014852) and must not lose its own digits.
 */
function baseCode_(text) {
  return normalizeCode_(text).slice(0, 8);
}

/** Code → student name, for one assignment's rows in the Key tab. */
function studentsByCode_(keyRows, assignmentId) {
  const byCode = new Map();
  for (const [studentName, , rowAssignmentId, code] of keyRows) {
    if (rowAssignmentId === assignmentId && !byCode.has(code)) byCode.set(code, studentName);
  }
  return byCode;
}

/**
 * One Review row per AI result, plus one row per student the AI left out.
 * Problem rows sort to the top; everything else is sorted by last name.
 */
function buildReview_(resultRows, studentByCode) {
  const rows = [];
  const seenFullCodes = new Set();
  const seenBaseCodes = new Set();
  let matched = 0;
  let problems = 0;

  for (const result of resultRows) {
    const fullCode = normalizeCode_(result.Code);
    const code = baseCode_(result.Code);
    let problem = '';
    if (!code) problem = 'Not a valid code';
    else if (!studentByCode.has(code)) problem = 'Code not in the Key for this assignment';
    else if (seenFullCodes.has(fullCode)) problem = 'Code listed more than once';
    const studentName = studentByCode.get(code) || '';
    if (code) seenBaseCodes.add(code);
    if (fullCode) seenFullCodes.add(fullCode);
    if (problem) problems++; else matched++;
    rows.push([studentName, result.Code, result.Score, result.Feedback, result.Confidence,
      result.Notes, problem]);
  }

  for (const [code, studentName] of studentByCode) {
    if (seenBaseCodes.has(code)) continue;
    problems++;
    rows.push([studentName, code, '', '', '', '', 'Missing from AI results']);
  }

  rows.sort((a, b) => {
    if (Boolean(a[6]) !== Boolean(b[6])) return a[6] ? -1 : 1;
    return compareNames_(a[0], b[0]);
  });
  return { rows, matched, problems };
}

/**
 * Orders names by last name, as SpeedGrader does. "Last, First" is used as is;
 * "First Last" is sorted by its last word, then the rest. A two-word last name
 * ("Van Buren") sorts under its last word: the Key only has the name as Canvas wrote it.
 */
function compareNames_(a, b) {
  const key = (name) => {
    const text = String(name).trim().toLowerCase();
    if (text.includes(',')) return text;
    const words = text.split(/\s+/);
    return words.length < 2 ? text : words.at(-1) + ', ' + words.slice(0, -1).join(' ');
  };
  return key(a).localeCompare(key(b));
}

/**
 * New Quiz answers: one Review row per AI result ({ name, code, question, group, why,
 * notes, problem }), plus one per answer the AI left out. answers (from the answers
 * file via readQuizAnswers_; null if it can't be read) says which questions each code
 * answered and gives each question's text for its label; without it, only students
 * missing entirely are flagged and questions show as just "Q6".
 * Problem rows sort to the top; everything else by last name, then question number.
 */
function buildQuizReview_(resultRows, studentByCode, answers) {
  const expected = answers && answers.byCode;
  const questions = answers && answers.questions;
  const rows = [];
  const seen = new Set();
  const seenCodes = new Set();
  let matched = 0;
  let problems = 0;

  for (const result of resultRows) {
    const code = baseCode_(result.Code);
    const number = questionNumber_(result.Question);
    const done = expected && expected.get(code);
    let problem = '';
    if (!code) problem = 'Not a valid code';
    else if (!studentByCode.has(code)) problem = 'Code not in the Key for this assignment';
    else if (!number) problem = 'No question number (Q1, Q2, …)';
    else if (seen.has(code + '|' + number)) problem = 'Answer listed more than once';
    else if (expected && !(done && done.has(number))) problem = 'This student did not answer this question';
    if (code) seenCodes.add(code);
    if (code && number) seen.add(code + '|' + number);
    if (problem) problems++; else matched++;
    rows.push({ name: studentByCode.get(code) || '', code: result.Code, number,
      question: number ? questionLabel_(number, questions) : result.Question, group: result.Group,
      why: result.Why, notes: result.Notes, problem });
  }

  const missing = (code, number) => {
    problems++;
    rows.push({ name: studentByCode.get(code) || '', code, number,
      question: number ? questionLabel_(number, questions) : '', group: '', why: '', notes: '',
      problem: 'Missing from AI results' });
  };
  if (expected) {
    for (const [code, numbers] of expected) {
      for (const number of numbers) if (!seen.has(code + '|' + number)) missing(code, number);
    }
  } else {
    for (const code of studentByCode.keys()) if (!seenCodes.has(code)) missing(code, 0);
  }

  rows.sort((a, b) => {
    if (Boolean(a.problem) !== Boolean(b.problem)) return a.problem ? -1 : 1;
    return compareNames_(a.name, b.name) || a.number - b.number;
  });
  return { rows, matched, problems };
}

function hasCheckedReviews_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  return sheet.getRange(2, REVIEW_HEADERS.length, lastRow - 1, 1).getValues()
    .some(([value]) => value === true);
}

/**
 * Clears and rewrites the Review tab with these headers (Reviewed last, as a checkbox).
 * values are the rows without the checkbox; callers pass AI text through asText_.
 */
function writeReview_(sheet, headers, values) {
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const old = sheet.getRange(2, 1, lastRow - 1, headers.length);
    old.clearContent();
    old.clearDataValidations();
  }
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  if (values.length === 0) return;
  sheet.getRange(2, 1, values.length, headers.length)
    .setValues(values.map((row) => [...row, false]))
    .setVerticalAlignment('top');
  sheet.getRange(2, headers.length, values.length, 1).insertCheckboxes();
}

/**
 * In a quiz Review's Question column, bolds the question text after "Q6 · " so it
 * stands out when matching answers in SpeedGrader. Labels without text stay plain.
 */
function boldQuestionText_(sheet, labels) {
  if (labels.length === 0) return;
  const column = QUIZ_REVIEW_HEADERS.indexOf('Question') + 1;
  const bold = SpreadsheetApp.newTextStyle().setBold(true).build();
  sheet.getRange(2, column, labels.length, 1).setRichTextValues(labels.map((label) => {
    const text = String(label);
    const builder = SpreadsheetApp.newRichTextValue().setText(text);
    const start = text.indexOf(' · ');
    if (start !== -1) builder.setTextStyle(start + 3, text.length, bold);
    return [builder.build()];
  }));
}

/** A plain number stays a number (so it can be copied into a gradebook); anything else is text. */
function scoreValue_(score) {
  return /^-?\d*\.?\d+$/.test(score) ? Number(score) : asText_(score);
}
