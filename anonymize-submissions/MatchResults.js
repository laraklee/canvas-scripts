/**
 * MatchResults.js
 * Purpose: the "Match AI results" menu item. For one assignment, reads the AI-graded
 *   table pasted into its "<name> AI" tab (columns Code, Score, Feedback, Confidence,
 *   Notes, matched by header name, any order), looks each code up in "<name> Key", and
 *   rebuilds "<name> Review" with the student's name next to each result. Flags codes
 *   that are not in the key, codes listed twice, and students the AI left out.
 *   The pasted table is untrusted text: it is written back as plain text only and is
 *   never treated as instructions or formulas.
 * Canvas endpoints called: none.
 * Canvas write operations: none.
 * Required User/Script Properties: none.
 */

const RESULTS_HEADERS = ['Code', 'Score', 'Feedback', 'Confidence', 'Notes'];
const REVIEW_HEADERS = ['Name', 'Code', 'Score', 'Feedback', 'Confidence', 'Notes',
  'Problem', 'Reviewed'];
const CODE_RE = /^S-[0-9A-F]{6}$/;

/** Menu: Anonymize › Match AI results… */
function matchAiResults() {
  const ui = SpreadsheetApp.getUi();
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const assignment = promptSavedAssignment_(ui, 'Match AI results');
    if (!assignment) return;
    const assignmentId = assignment.id;
    const resultsName = tabName_(assignment.name, 'AI');
    const keyName = tabName_(assignment.name, 'Key');
    const reviewName = tabName_(assignment.name, 'Review');

    const resultsSheet = ss.getSheetByName(resultsName);
    if (!resultsSheet || resultsSheet.getLastRow() < 2) {
      getOrCreateSheet_(resultsName, RESULTS_HEADERS).activate();
      ui.alert('Paste the AI\'s table into the "' + resultsName + '" tab first ' +
        '(include its header row), then run this again.');
      return;
    }
    const keySheet = ss.getSheetByName(keyName);
    if (!keySheet || keySheet.getLastRow() < 2) {
      ui.alert('The "' + keyName + '" tab is missing or empty. Run "Anonymize submissions…" first.');
      return;
    }
    const keyRows = keySheet.getRange(2, 1, keySheet.getLastRow() - 1, KEY_HEADERS.length)
      .getDisplayValues();

    const parsed = parseResultsTable_(resultsSheet.getDataRange().getDisplayValues());
    if (parsed.error) {
      ui.alert(parsed.error);
      return;
    }

    const reviewSheet = getOrCreateSheet_(reviewName, REVIEW_HEADERS);
    if (hasCheckedReviews_(reviewSheet)) {
      const confirm = ui.alert('Replace the review tab?',
        'Some rows in "' + reviewName + '" are already checked as reviewed. Rebuilding it ' +
        'clears those checkmarks.\n\nReplace it?', ui.ButtonSet.YES_NO);
      if (confirm !== ui.Button.YES) return;
    }

    const review = buildReview_(parsed.rows, studentsByCode_(keyRows, assignmentId));
    writeReview_(reviewSheet, review.rows);

    // Counts and IDs only: no student data in logs.
    console.log('matchAiResults: assignment ' + assignmentId + ' matched=' +
      review.matched + ' problems=' + review.problems);
    reviewSheet.activate();
    ui.alert('"' + reviewName + '" is ready',
      'Matched: ' + review.matched + '\n' +
      'Needing a look: ' + review.problems +
      (review.problems ? ' (these are at the top, with the reason in the Problem column)' : ''),
      ui.ButtonSet.OK);
  } catch (err) {
    console.error('matchAiResults failed: ' + err.message);
    ui.alert('Something went wrong while matching results. The Key and AI tabs were ' +
      'not changed.');
  }
}

/**
 * Reads the pasted table. Accepts a normal pasted table, or a Markdown table that landed
 * as "| a | b |" lines in column A. Finds the header row (the first row with a "Code"
 * cell) and returns rows as objects with the RESULTS_HEADERS fields.
 */
function parseResultsTable_(values) {
  const grid = values
    .map(splitMarkdownRow_)
    .filter((cells) => cells.some((cell) => cell !== ''))
    .filter((cells) => !cells.every((cell) => cell === '' || /^:?-{3,}:?$/.test(cell)));

  const headerIndex = grid.findIndex((cells) =>
    cells.some((cell) => cell.toLowerCase() === 'code'));
  if (headerIndex === -1) {
    return { error: 'Could not find a header row with a "Code" column in the AI tab.' };
  }
  const header = grid.at(headerIndex).map((cell) => cell.toLowerCase());
  const [code, score, feedback, confidence, notes] =
    RESULTS_HEADERS.map((name) => header.indexOf(name.toLowerCase()));
  const cellAt = (cells, index) => (index === -1 ? '' : String(cells.at(index) || '').trim());

  const rows = grid.slice(headerIndex + 1).map((cells) => ({
    Code: cellAt(cells, code),
    Score: cellAt(cells, score),
    Feedback: cellAt(cells, feedback),
    Confidence: cellAt(cells, confidence),
    Notes: cellAt(cells, notes),
  }));
  return { rows };
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

/** "s-9c1e4b-2.pdf" → "S-9C1E4B". Returns '' if it isn't a code. */
function baseCode_(text) {
  const upper = String(text).trim().toUpperCase()
    .replace(/\.[A-Z0-9]+$/, '')
    .replace(/-\d+$/, '');
  return CODE_RE.test(upper) ? upper : '';
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
 * Problem rows sort to the top; everything else is sorted by name.
 */
function buildReview_(resultRows, studentByCode) {
  const rows = [];
  const seenRawCodes = new Set();
  const seenBaseCodes = new Set();
  let matched = 0;
  let problems = 0;

  for (const result of resultRows) {
    const rawCode = result.Code.toUpperCase();
    const code = baseCode_(result.Code);
    let problem = '';
    if (!code) problem = 'Not a valid code';
    else if (!studentByCode.has(code)) problem = 'Code not in the Key for this assignment';
    else if (seenRawCodes.has(rawCode)) problem = 'Code listed more than once';
    const studentName = studentByCode.get(code) || '';
    if (code) seenBaseCodes.add(code);
    seenRawCodes.add(rawCode);
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
    return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
  });
  return { rows, matched, problems };
}

function hasCheckedReviews_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  return sheet.getRange(2, REVIEW_HEADERS.length, lastRow - 1, 1).getValues()
    .some(([value]) => value === true);
}

/** Clears and rewrites the Review tab. Text comes from the AI, so it goes in as text. */
function writeReview_(sheet, rows) {
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const old = sheet.getRange(2, 1, lastRow - 1, REVIEW_HEADERS.length);
    old.clearContent();
    old.clearDataValidations();
  }
  if (rows.length === 0) return;
  const values = rows.map(([studentName, code, score, feedback, confidence, notes, problem]) => [
    asText_(studentName), asText_(code), scoreValue_(score), asText_(feedback),
    asText_(confidence), asText_(notes), problem, false]);
  sheet.getRange(2, 1, values.length, REVIEW_HEADERS.length).setValues(values)
    .setVerticalAlignment('top');
  sheet.getRange(2, REVIEW_HEADERS.length, values.length, 1).insertCheckboxes();
}

/** A plain number stays a number (so it can be copied into a gradebook); anything else is text. */
function scoreValue_(score) {
  return /^-?\d*\.?\d+$/.test(score) ? Number(score) : asText_(score);
}
