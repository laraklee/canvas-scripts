/**
 * MatchResults.js
 * Purpose: matches AI results for one assignment (started from an Index row). Reads the AI-graded
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

/**
 * Matches one assignment's AI results. Called from the Index tab (see Index.js).
 * Shows a summary alert and returns a short status line for the Index, or null if it
 * stopped early (after telling Lara why).
 */
function runMatch_(ui, assignmentId, shortName) {
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
 * as "| a | b |" lines in column A. Returns rows as objects with the RESULTS_HEADERS
 * fields; rows above the first header row are ignored.
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
  const rows = [];
  for (const cells of grid) {
    if (isHeader(cells)) {
      const header = cells.map((cell) => cell.toLowerCase());
      columns = RESULTS_HEADERS.map((name) => header.indexOf(name.toLowerCase()));
      continue;
    }
    if (!columns) continue;
    const [code, score, feedback, confidence, notes] = columns;
    rows.push({
      Code: cellAt(cells, code),
      Score: cellAt(cells, score),
      Feedback: cellAt(cells, feedback),
      Confidence: cellAt(cells, confidence),
      Notes: cellAt(cells, notes),
    });
  }
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
 * Problem rows sort to the top; everything else is sorted by name.
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
