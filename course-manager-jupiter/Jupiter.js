/**
 * Jupiter.js
 * Purpose: Jupiter Grades tools (button and menu names match legacy):
 *   - createActiveSheetRoster (CreateRoster button on the grading sheet, e.g. Comments):
 *     refreshes ref_peopleList and ref_SectionLookup first (design rule: refresh before
 *     use). On a sheet with no students yet, writes them into A–E (row 2 labels, students
 *     from row 3, Period then name). On a sheet with students, matches them by User ID in
 *     A so every row stays lined up: refreshes A–E in place, inserts a whole row for each
 *     new student, and deletes the whole row of each dropped student after highlighting
 *     those rows and asking (row numbers only in the message).
 *   - buildJupiterExportFromRecentCanvasGrades (Update Grades button): fills the
 *     JupiterExport tab (Jupiter's import template) with scores for assignments graded
 *     recently in the checked categories; Lara copies and pastes it into Jupiter. Sends the
 *     final score (after any late penalty; legacy sent the score before it).
 *   Student names, IDs, and scores stay in the sheet: never logged or shown in messages.
 *   - refreshJupiterCategories (menu item, and the legacy Config button's script name).
 *   Ported from the legacy refreshJupiterCategories and getJupiterGroupMap_. Rebuilds the
 *   cfg_JupiterCategories table on ref_Config (three columns: Canvas category | Export to
 *   Jupiter? checkbox | Canvas group ID) from the course's assignment groups, keeping your
 *   checkmarks: matched by group ID, or by name for older lists without IDs. New groups
 *   start unchecked; groups no longer in Canvas drop off (the summary counts them).
 *   Update Grades exports only the checked groups, so the column order must stay the
 *   same. Logs counts only.
 * Canvas endpoints called (all GET, via canvasGet_):
 *   /api/v1/courses/:course, /api/v1/courses/:course/enrollments,
 *   /api/v1/courses/:course/sections (CreateRoster, through the refresh helpers in RefSheets.js)
 *   /api/v1/courses/:course/assignment_groups
 *   /api/v1/courses/:course/students/submissions?student_ids[]=all&graded_since=…
 *     &include[]=assignment
 *   /api/v1/courses/:course/assignments/:assignment/submissions
 * Canvas write operations: none.
 * Required: User Properties CANVAS_BASE_URL and CANVAS_TOKEN; named ranges
 *   cfg_JupiterCategories (ref_Config G:I) and cfg_CourseID; sheets ref_peopleList,
 *   ref_SectionLookup, and JupiterExport.
 */

const JUPITER_CATEGORY_RANGE = 'cfg_JupiterCategories';
const JUPITER_CATEGORY_HEADERS = Object.freeze(['Canvas category', 'Export to Jupiter?',
  'Canvas group ID']);

/**
 * Config button: Refresh Jupiter categories (off the menu since 2026-11-11; the panel covers it).
 * Nothing changes unless Canvas answers with at least one assignment group.
 */
function refreshJupiterCategories() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  try {
    const counts = writeJupiterCategories_(ss);
    ss.toast(`${counts.categories} categor${counts.categories === 1 ? 'y' : 'ies'}; ` +
      `${counts.kept} checked kept` + (counts.dropped ? `; ${counts.dropped} checked ` +
        `categor${counts.dropped === 1 ? 'y is' : 'ies are'} no longer in Canvas and ` +
        'dropped off.' : '.'), 'Refresh Jupiter categories', 8);
  } catch (error) {
    reportRefreshFailure_('Refresh Jupiter categories',
      'The Jupiter category table was not changed.', error);
  }
}

/**
 * Rebuilds the cfg_JupiterCategories table (see refreshJupiterCategories) and returns
 * { categories, kept, dropped }. Throws on a problem, before changing anything. Also
 * used by the Refresh tables side panel (RefreshPanel.js).
 */
function writeJupiterCategories_(ss) {
  const table = ss.getRangeByName(JUPITER_CATEGORY_RANGE);
  if (!table || table.getNumColumns() !== JUPITER_CATEGORY_HEADERS.length) {
    throw sheetProblem_(`The named range ${JUPITER_CATEGORY_RANGE} should be three columns ` +
      `on ${SHEETS.CONFIG} (G:I). Check Data › Named ranges.`);
  }
  const sheet = table.getSheet();
  const headerRow = table.getRow();
  const firstColumn = table.getColumn();
  const existingRows = Math.max(0, sheet.getLastRow() - headerRow);
  const existing = existingRows ?
    sheet.getRange(headerRow + 1, firstColumn, existingRows, 3).getValues() : [];

  // Column I is this tool's; refuse to overwrite anything else that is there.
  const idHeader = String(sheet.getRange(headerRow, firstColumn + 2).getValue()).trim();
  if (idHeader && idHeader !== JUPITER_CATEGORY_HEADERS[2]) {
    throw sheetProblem_(`The Canvas group ID column of ${JUPITER_CATEGORY_RANGE} already has ` +
      'a different heading. Move that content before refreshing.');
  }
  if (!idHeader && existing.some(row => !isBlank_(row[2]))) {
    throw sheetProblem_(`The Canvas group ID column of ${JUPITER_CATEGORY_RANGE} already ` +
      'contains data. Move that content before refreshing.');
  }

  const checked = existing
    .filter(row => row[1] === true)
    .map(row => ({ id: jupiterId_(row[2]), name: String(row[0]).trim().toLowerCase() }));

  const courseId = getCourseIdForRefresh_();
  const groups = canvasStep_('assignment groups request', () =>
    canvasGet_('/courses/' + courseId + '/assignment_groups'));
  if (!Array.isArray(groups)) {
    throw sheetProblem_('Canvas did not return a list for the assignment groups request.');
  }
  const entries = groups
    .map(group => ({ id: jupiterId_(group.id), name: String(group.name || '').trim() }))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!entries.length) {
    throw sheetProblem_('Canvas returned no assignment groups, so nothing was changed.');
  }

  const keepChecked = entry => checked.some(c =>
    c.id ? c.id === entry.id : c.name === entry.name.toLowerCase());
  const rows = entries.map(entry => [entry.name, keepChecked(entry), entry.id]);
  const keptCount = rows.filter(row => row[1]).length;
  const droppedCount = checked.filter(c => !entries.some(entry =>
    c.id ? c.id === entry.id : c.name === entry.name.toLowerCase())).length;

  // Canvas answered; only now replace the table.
  const clearRows = Math.max(existingRows, rows.length);
  sheet.getRange(headerRow + 1, firstColumn, clearRows, 3).clearContent();
  sheet.getRange(headerRow + 1, firstColumn + 1, clearRows, 1).clearDataValidations();
  sheet.getRange(headerRow, firstColumn, 1, 3).setValues([JUPITER_CATEGORY_HEADERS.slice()]);
  sheet.getRange(headerRow + 1, firstColumn + 1, rows.length, 1).insertCheckboxes();
  sheet.getRange(headerRow + 1, firstColumn, rows.length, 3).setValues(rows);

  console.log(`Refresh Jupiter categories: ${rows.length} categor(ies), ${keptCount} checked ` +
    `kept, ${droppedCount} checked dropped.`);
  return { categories: rows.length, kept: keptCount, dropped: droppedCount };
}

// ---- Grading sheet roster (CreateRoster button) ----

// The grading sheet (e.g. "Comments"): labels in row 2, students from row 3. The roster
// fills A–E; the Jupiter ID is typed into F by hand (from a Jupiter export).
const ROSTER_HEADER_ROW = 2;
const ROSTER_FIRST_ROW = 3;
const ROSTER_HEADERS = Object.freeze(['User ID', 'Name', 'Period', 'Section Name', 'Email']);
const ROSTER_JUPITER_ID_COLUMN = 6;
// Grading sheet A1:B1: "Last Jupiter Sync:" and when Update Grades last ran.
const JUPITER_SYNC_LABEL = 'Last Jupiter Sync:';
const JUPITER_DEFAULT_DAYS = 7;

/**
 * Button / menu: CreateRoster (legacy name createActiveSheetRoster). Refreshes
 * ref_peopleList and ref_SectionLookup from Canvas, then fills columns A–E of the sheet
 * being viewed (row 2 labels, students from row 3, sorted by Period, then name).
 * First run (no students on the sheet): writes the roster; nothing else changes (asks
 * first if the roster would cover a row like Average). Later runs: applyRosterPlan_ keeps
 * each whole row with its student (adds and drops move every column together).
 */
function createActiveSheetRoster() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  try {
    const sheet = ss.getActiveSheet();
    checkGradingSheet_(sheet);
    // Refresh before use, so adds and drops since the last refresh are included.
    writePeopleListSheet_(ss);
    writeSectionLookupSheet_(ss);
    SpreadsheetApp.flush(); // so the people list's formula columns are calculated
    const rows = buildRosterRows_(readRefTable_(ss, SHEETS.PEOPLE_LIST,
      ['Section ID', 'User ID', 'Sorted Name', 'Role', 'Email']),
    readRefTable_(ss, SHEETS.SECTION_LOOKUP, ['Section ID', 'Section Name', 'Period']));
    if (!rows.length) {
      throw sheetProblem_(`${SHEETS.PEOPLE_LIST} has no students. Use Course Manager Tools › ` +
        'Refresh tables… and tick People list.');
    }

    const lastRow = Math.max(sheet.getLastRow(), ROSTER_FIRST_ROW + rows.length - 1);
    const current = sheet.getRange(ROSTER_FIRST_ROW, 1, lastRow - ROSTER_FIRST_ROW + 1,
      ROSTER_HEADERS.length).getDisplayValues();
    // A sheet that already has students: keep every row lined up with its student.
    const plan = planRosterUpdate_(current, rows, ROSTER_FIRST_ROW);
    if (plan) {
      applyRosterPlan_(sheet, plan);
      return;
    }

    // First run (no students yet). Rows with other content in A–E (e.g. Average) are
    // never cleared, and covering one with the new roster needs a Yes.
    const { covered, staleRows } = rosterRowsToChange_(current, rows.length, ROSTER_FIRST_ROW);
    if (covered.length) {
      const answer = ui.alert('CreateRoster', `The new roster (${rows.length} students) would ` +
        `cover row(s) ${covered.join(', ')}, which hold something other than a student in ` +
        'columns A–E (for example an Average row). Overwrite them?', ui.ButtonSet.YES_NO);
      if (answer !== ui.Button.YES) return;
    }

    sheet.getRange(ROSTER_HEADER_ROW, 1, 1, ROSTER_HEADERS.length)
      .setValues([ROSTER_HEADERS.slice()]);
    sheet.getRange(ROSTER_FIRST_ROW, 1, rows.length, ROSTER_HEADERS.length).setValues(rows);
    staleRows.forEach(row => sheet.getRange(row, 1, 1, ROSTER_HEADERS.length).clearContent());

    console.log(`CreateRoster: ${rows.length} student(s) written, ${staleRows.length} old ` +
      `row(s) cleared, ${covered.length} other row(s) overwritten.`);
    ui.alert('CreateRoster', `${rows.length} students written to columns A–E (rows ` +
      `${ROSTER_FIRST_ROW}–${ROSTER_FIRST_ROW + rows.length - 1}).` +
      (staleRows.length ? `\n${staleRows.length} old student row(s) below were cleared in A–E.` :
        '') +
      '\n\nType each student\'s Jupiter ID in column F before using Update Grades. Later ' +
      'runs keep each row with its student.', ui.ButtonSet.OK);
  } catch (error) {
    reportRefreshFailure_('CreateRoster', 'The sheet was not changed.', error);
  }
}

// Background for rows CreateRoster is asking to delete (light red).
const ROSTER_DROP_HIGHLIGHT = '#f4cccc';

/**
 * Carries out planRosterUpdate_'s plan on the grading sheet. Asks before deleting any
 * row (No changes nothing). Then refreshes kept students' A–E in place and deletes and
 * inserts whole rows, from the bottom up so the planned row numbers stay right.
 * Messages give counts and row numbers only.
 */
function applyRosterPlan_(sheet, plan) {
  const ui = SpreadsheetApp.getUi();
  if (plan.drops.length && !confirmRosterDrops_(sheet, plan.drops)) {
    ui.alert('CreateRoster', 'Nothing was changed.', ui.ButtonSet.OK);
    return;
  }

  sheet.getRange(ROSTER_HEADER_ROW, 1, 1, ROSTER_HEADERS.length)
    .setValues([ROSTER_HEADERS.slice()]);
  plan.updates.forEach(update =>
    sheet.getRange(update.row, 1, 1, ROSTER_HEADERS.length).setValues([update.values]));

  const insertsAt = new Map(); // row number -> new students going just before it
  plan.inserts.forEach(insert =>
    insertsAt.set(insert.before, (insertsAt.get(insert.before) || []).concat([insert.values])));
  const rowsToChange = [...new Set(plan.drops.concat([...insertsAt.keys()]))].sort((a, b) => b - a);
  rowsToChange.forEach(row => {
    // At the same row, delete first, so the new rows aren't the ones deleted.
    if (plan.drops.includes(row)) sheet.deleteRow(row);
    const added = insertsAt.get(row);
    if (!added) return;
    // Inserting after the row above copies a student row's formatting (not the labels').
    if (row - 1 >= ROSTER_FIRST_ROW) sheet.insertRowsAfter(row - 1, added.length);
    else sheet.insertRowsBefore(row, added.length);
    sheet.getRange(row, 1, added.length, ROSTER_HEADERS.length).setValues(added);
  });

  console.log(`CreateRoster update: ${plan.keptCount} kept, ${plan.updates.length} refreshed, ` +
    `${plan.inserts.length} added, ${plan.drops.length} deleted, ` +
    `${plan.periodChangedRows.length} changed period.`);
  ui.alert('CreateRoster', `Roster updated: ${plan.keptCount} student row(s) kept ` +
    `(${plan.updates.length} with changes in A–E), ${plan.inserts.length} added, ` +
    `${plan.drops.length} deleted.` +
    (plan.addedRows.length ? `\n\nNew student row(s): ${plan.addedRows.join(', ')}. Type ` +
      'their Jupiter IDs in column F before using Update Grades.' : '') +
    (plan.periodChangedRows.length ? `\n\nRow(s) ${plan.periodChangedRows.join(', ')} changed ` +
      'period. Re-sort if you want students grouped by section.' : ''), ui.ButtonSet.OK);
}

/**
 * Highlights the rows to delete, scrolls to them, and asks (row numbers only, so names
 * are seen in the sheet, never in the message). Unless the answer is Yes, the rows get
 * their colors back. Returns true for Yes.
 */
function confirmRosterDrops_(sheet, drops) {
  const ui = SpreadsheetApp.getUi();
  const ranges = drops.map(row => sheet.getRange(row, 1, 1, sheet.getLastColumn()));
  const saved = ranges.map(range => ({ range, colors: range.getBackgrounds() }));
  let answer = ui.Button.NO;
  try {
    ranges.forEach(range => range.setBackground(ROSTER_DROP_HIGHLIGHT));
    sheet.setActiveRange(ranges[0]);
    SpreadsheetApp.flush();
    answer = ui.alert('CreateRoster', `${drops.length} student(s) on this sheet are no longer ` +
      `in the Canvas course: the highlighted row(s) ${drops.join(', ')}.\n\nDelete these ` +
      'whole rows? Their Jupiter ID, scores, and comments on this sheet are deleted too ' +
      '(Canvas keeps their records).\n\nYes: update the roster and delete them.\nNo: change ' +
      'nothing.', ui.ButtonSet.YES_NO);
  } finally {
    if (answer !== ui.Button.YES) saved.forEach(s => s.range.setBackgrounds(s.colors));
  }
  return answer === ui.Button.YES;
}

/**
 * Roster rows [User ID, Name, Period, Section Name, Email] for each student (Role
 * StudentEnrollment), once each (a student in two sections keeps the first), sorted by
 * Period, then name. Section name and period come from the sections table ('N/A' if not
 * found).
 */
function buildRosterRows_(people, sections) {
  const sectionById = new Map(sections.map(section =>
    [jupiterId_(section['Section ID']), section]));
  const seen = new Set();
  return people
    .filter(person => person.Role === 'StudentEnrollment')
    .filter(person => {
      const id = jupiterId_(person['User ID']);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map(person => {
      const section = sectionById.get(jupiterId_(person['Section ID']));
      return [jupiterId_(person['User ID']), person['Sorted Name'],
        section ? section.Period : 'N/A', section ? section['Section Name'] : 'N/A',
        person.Email];
    })
    .sort(compareRosterRows_);
}

/** Roster order: Period (3 before 10; 'N/A' after numbers), then name. */
function compareRosterRows_(a, b) {
  return String(a[2]).localeCompare(String(b[2]), undefined, { numeric: true }) ||
    String(a[1]).localeCompare(String(b[1]));
}

/**
 * How to update a sheet that already has students, from the current A–E text starting at
 * firstRow and the new roster rows (in roster order). Students are matched by the User ID
 * in A. Returns null if the sheet has no students yet (first run). Otherwise, with row
 * numbers as they are now:
 *   updates: kept students whose A–E text changes ({ row, values });
 *   drops: rows of students no longer in the roster (whole rows to delete);
 *   inserts: new students ({ before, values }), each a whole row going just before that
 *     row number (in roster order when several share one);
 * and, as they will be after the changes, for the final message: addedRows (the new
 * students) and periodChangedRows (kept students whose period changed; not moved).
 * Stops if one User ID is on two rows, or if more than half the sheet's students would be
 * deleted (most likely a short list from Canvas).
 */
function planRosterUpdate_(current, rows, firstRow) {
  const sheetRows = new Map(); // User ID -> row number, in sheet order
  current.forEach((row, i) => {
    const id = String(row[0]).trim();
    if (!/^\d+$/.test(id)) return;
    if (sheetRows.has(id)) {
      throw sheetProblem_(`Rows ${sheetRows.get(id)} and ${firstRow + i} have the same User ID ` +
        'in column A. Delete one of them, then run CreateRoster again.');
    }
    sheetRows.set(id, firstRow + i);
  });
  if (!sheetRows.size) return null;

  const rosterById = new Map(rows.map(row => [row[0], row]));
  const drops = [];
  const kept = [];
  sheetRows.forEach((row, id) => {
    if (rosterById.has(id)) kept.push({ row, values: rosterById.get(id) });
    else drops.push(row);
  });
  if (drops.length * 2 > sheetRows.size) {
    throw sheetProblem_(`${drops.length} of the ${sheetRows.size} students on this sheet are ` +
      `not in the ${rows.length} students Canvas sent. That is more than half, which usually ` +
      'means Canvas sent an incomplete list or cfg_CourseID points to another course. Check ' +
      'cfg_CourseID and try again in a few minutes.');
  }

  const text = values => values.map(value => String(value).trim());
  const currentText = row => text(current[row - firstRow]);
  const updates = kept.filter(k => JSON.stringify(currentText(k.row)) !== JSON.stringify(text(k.values)));
  const periodChanged = kept.filter(k => currentText(k.row)[2] !== text(k.values)[2]);

  // New students: in place if the sheet is in roster order; otherwise after the last
  // student with the same period; otherwise after the last student.
  const inOrder = kept.every((k, i) => i === 0 || compareRosterRows_(kept[i - 1].values, k.values) <= 0);
  const afterLast = kept[kept.length - 1].row + 1;
  const inserts = rows.filter(row => !sheetRows.has(row[0])).map(values => {
    if (inOrder) {
      const next = kept.find(k => compareRosterRows_(k.values, values) > 0);
      return { before: next ? next.row : afterLast, values };
    }
    const samePeriod = kept.filter(k => String(k.values[2]) === String(values[2]));
    return { before: samePeriod.length ? samePeriod[samePeriod.length - 1].row + 1 : afterLast,
      values };
  });

  // Row numbers after the changes: rows deleted above move a row up, rows inserted at or
  // above move it down.
  const countBelow = (list, row) => list.filter(r => r < row).length;
  const insertRows = inserts.map(insert => insert.before);
  const newRow = row => row - countBelow(drops, row) + countBelow(insertRows, row + 1);
  const addedRows = inserts.map((insert, i) => insert.before - countBelow(drops, insert.before) +
    countBelow(insertRows, insert.before) + insertRows.slice(0, i).filter(r => r === insert.before).length);
  return { updates, drops, inserts, keptCount: kept.length, addedRows,
    periodChangedRows: periodChanged.map(k => newRow(k.row)) };
}

/**
 * Which rows change, from the current A–E text starting at firstRow: covered = rows the
 * new roster (count rows) will overwrite that hold something other than a student
 * (A not a numeric ID but A–E not blank); staleRows = old student rows past the new
 * roster (numeric ID in A), which get cleared in A–E.
 */
function rosterRowsToChange_(current, count, firstRow) {
  const isStudent = row => /^\d+$/.test(String(row.slice(0, 1)[0]).trim());
  const hasContent = row => row.some(value => String(value).trim() !== '');
  const covered = [];
  const staleRows = [];
  current.forEach((row, i) => {
    if (i < count) {
      if (!isStudent(row) && hasContent(row)) covered.push(firstRow + i);
    } else if (isStudent(row)) {
      staleRows.push(firstRow + i);
    }
  });
  return { covered, staleRows };
}

/** Stops on tabs that aren't a grading sheet (ref_ tabs, legacy * tabs, JupiterExport). */
function checkGradingSheet_(sheet) {
  const name = sheet.getName();
  if (name.startsWith('ref_') || name.startsWith('*') || name === TOOL_SHEETS.JUPITER_EXPORT) {
    throw sheetProblem_('Run this from your grading sheet (for example Comments), not ' +
      `${name}.`);
  }
}

/**
 * A ref_ sheet's rows as objects keyed by the given header names (row 1). Stops with a
 * clear message if the sheet or a header is missing.
 */
function readRefTable_(ss, sheetName, headers) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw sheetProblem_(`${sheetName} is missing. Refresh it first (Course Manager Tools › ` +
    'Refresh tables…).');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  const header = values[0].map(value => String(value).trim());
  const columns = headers.map(name => {
    const index = header.indexOf(name);
    if (index === -1) throw sheetProblem_(`${sheetName} has no "${name}" column. Refresh it.`);
    return [name, index];
  });
  return values.slice(1).map(row =>
    Object.fromEntries(columns.map(([name, index]) => [name, row.slice(index, index + 1)[0]])));
}

// ---- Update Grades (JupiterExport) ----

/**
 * Button / menu: Update Grades (legacy name buildJupiterExportFromRecentCanvasGrades).
 * Run from the grading sheet. Asks how many days back to look (default: since the B1
 * "Last Jupiter Sync" stamp, or 7 days), finds Canvas assignments graded since then in
 * the categories checked in cfg_JupiterCategories, reads every student's score for
 * them, and fills JupiterExport (Jupiter's import template) for you to copy and paste
 * into Jupiter.
 * Students are matched by Jupiter ID: grading sheet A (Canvas User ID) and F (Jupiter
 * ID), and "(Jupiter ID)" at the end of each JupiterExport student label. Reads Canvas
 * only; logs counts only.
 */
function buildJupiterExportFromRecentCanvasGrades() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  try {
    const sheet = ss.getActiveSheet();
    checkGradingSheet_(sheet);
    const timeZone = ss.getSpreadsheetTimeZone();
    const stamp = sheet.getRange(1, 2).getValue();
    let days = JUPITER_DEFAULT_DAYS;
    let note = `No previous sync stamp in B1, so the default is ${days} days.`;
    if (stamp instanceof Date && !isNaN(stamp.getTime())) {
      days = Math.max(1, Math.ceil((Date.now() - stamp.getTime()) / 86400000));
      note = `Last sync: ${Utilities.formatDate(stamp, timeZone, 'M/d/yy h:mm a')} ` +
        `(${days} day(s) ago).`;
    }
    const response = ui.prompt('Update Grades', `${note}\n\nClick OK to look ${days} day(s) ` +
      'back, or type a different number of days:', ui.ButtonSet.OK_CANCEL);
    if (response.getSelectedButton() !== ui.Button.OK) return;
    const typed = parseInt(response.getResponseText().trim(), 10);
    if (Number.isInteger(typed) && typed > 0) days = typed;

    const exportSheet = ss.getSheetByName(TOOL_SHEETS.JUPITER_EXPORT);
    if (!exportSheet || exportSheet.getLastRow() < 1) {
      throw sheetProblem_(`There is no ${TOOL_SHEETS.JUPITER_EXPORT} tab with Jupiter's ` +
        'template. Copy it in from a Jupiter export first.');
    }
    const allowed = readJupiterAllowed_(ss);
    const roster = readJupiterRoster_(sheet);
    if (!roster.size) {
      throw sheetProblem_('No student on this sheet has both a User ID in A and a Jupiter ID ' +
        'in F (from row 3).');
    }

    const courseId = getCourseIdForRefresh_();
    const groups = canvasStep_('assignment groups request', () =>
      canvasGet_('/courses/' + courseId + '/assignment_groups'));
    const groupNames = new Map((Array.isArray(groups) ? groups : [])
      .map(group => [jupiterId_(group.id), String(group.name || '').trim()]));
    const since = new Date(Date.now() - days * 86400000).toISOString();
    ss.toast('Finding recently graded assignments…', 'Update Grades', -1);
    const recent = canvasStep_('recent submissions request', () =>
      canvasGet_('/courses/' + courseId + '/students/submissions', {
        'student_ids[]': 'all', graded_since: since, 'include[]': 'assignment' }));
    const assignments = pickJupiterAssignments_(Array.isArray(recent) ? recent : [],
      groupNames, allowed);
    if (!assignments.length) {
      ss.toast(`No assignments in checked categories were graded in the last ${days} ` +
        'day(s). JupiterExport was not changed.', 'Update Grades', 8);
      return;
    }

    ss.toast(`Reading scores for ${assignments.length} assignment(s)…`, 'Update Grades', -1);
    assignments.forEach(item => {
      const submissions = canvasStep_('scores request', () =>
        canvasGet_(`/courses/${courseId}/assignments/${item.id}/submissions`));
      (Array.isArray(submissions) ? submissions : []).forEach(submission => {
        item.scores.set(jupiterId_(submission.user_id), scoreForJupiter_(submission));
      });
    });

    const range = exportSheet.getRange(1, 1, exportSheet.getLastRow(),
      Math.max(exportSheet.getLastColumn(), assignments.length * 2 + 1));
    if (exportSheet.getMaxColumns() < range.getNumColumns()) {
      exportSheet.insertColumnsAfter(exportSheet.getMaxColumns(),
        range.getNumColumns() - exportSheet.getMaxColumns());
    }
    const result = fillJupiterExport_(range.getValues(), assignments, roster,
      dueAt => Utilities.formatDate(new Date(dueAt), timeZone, 'M/d/yy'));
    range.setValues(result.values);
    sheet.getRange(1, 1).setValue(JUPITER_SYNC_LABEL).setFontWeight('bold');
    sheet.getRange(1, 2).setValue(new Date()).setNumberFormat('m/d/yyyy h:mm am/pm');

    console.log(`Update Grades: ${assignments.length} assignment(s), ${result.matched} ` +
      `student row(s) matched, ${result.unmatched} not matched.`);
    ui.alert('Update Grades', `${assignments.length} assignment(s) from checked categories ` +
      `written to ${TOOL_SHEETS.JUPITER_EXPORT}, with scores for ${result.matched} ` +
      'student(s).' + (result.unmatched ? `\n\n${result.unmatched} student row(s) in ` +
      `${TOOL_SHEETS.JUPITER_EXPORT} have no matching Jupiter ID in column F of this sheet, ` +
      'so their scores are blank. Check column F.' : '') +
      '\n\nNext: copy JupiterExport and paste it into Jupiter.', ui.ButtonSet.OK);
  } catch (error) {
    reportRefreshFailure_('Update Grades', 'The last sync time (B1) was not changed.', error);
  }
}

/**
 * The checked categories in cfg_JupiterCategories: { ids: Set, names: Set (lower case) }.
 * Rows without a group ID (older lists) match by name, like legacy.
 */
function readJupiterAllowed_(ss) {
  const table = ss.getRangeByName(JUPITER_CATEGORY_RANGE);
  if (!table) throw sheetProblem_(`The named range ${JUPITER_CATEGORY_RANGE} is missing.`);
  const sheet = table.getSheet();
  const rows = Math.max(0, sheet.getLastRow() - table.getRow());
  const allowed = { ids: new Set(), names: new Set() };
  if (rows) {
    sheet.getRange(table.getRow() + 1, table.getColumn(), rows, 3).getValues()
      .filter(row => row.slice(1, 2)[0] === true)
      .forEach(row => {
        const id = jupiterId_(row.slice(2, 3)[0]);
        if (id) allowed.ids.add(id);
        else if (String(row.slice(0, 1)[0]).trim()) {
          allowed.names.add(String(row.slice(0, 1)[0]).trim().toLowerCase());
        }
      });
  }
  if (!allowed.ids.size && !allowed.names.size) {
    throw sheetProblem_(`Tick at least one category in ${JUPITER_CATEGORY_RANGE} ` +
      `(${SHEETS.CONFIG}), or refresh them (Course Manager Tools › Refresh tables…, tick Jupiter ` +
      'categories).');
  }
  return allowed;
}

/** Map Jupiter ID → Canvas User ID from the grading sheet (A and F, from row 3). */
function readJupiterRoster_(sheet) {
  const roster = new Map();
  const rows = sheet.getLastRow() - ROSTER_FIRST_ROW + 1;
  if (rows < 1) return roster;
  const canvasIds = sheet.getRange(ROSTER_FIRST_ROW, 1, rows, 1).getValues();
  const jupiterIds = sheet.getRange(ROSTER_FIRST_ROW, ROSTER_JUPITER_ID_COLUMN, rows, 1)
    .getValues();
  canvasIds.forEach((row, i) => {
    const canvasId = jupiterId_(row.slice(0, 1)[0]);
    const jupiter = jupiterId_(jupiterIds.slice(i, i + 1)[0].slice(0, 1)[0]);
    if (canvasId && jupiter) roster.set(jupiter, canvasId);
  });
  return roster;
}

/**
 * The recently graded assignments in allowed categories, once each, in the order Canvas
 * listed them: [{ id, name, category, points, dueAt, scores: Map }].
 */
function pickJupiterAssignments_(submissions, groupNames, allowed) {
  const found = new Map();
  submissions.forEach(submission => {
    const assignment = submission.assignment;
    if (!submission.assignment_id || !assignment) return;
    const groupId = jupiterId_(assignment.assignment_group_id);
    const category = groupNames.get(groupId) || 'Unassigned';
    if (!allowed.ids.has(groupId) && !allowed.names.has(category.toLowerCase())) return;
    const id = jupiterId_(submission.assignment_id);
    if (found.has(id)) return;
    found.set(id, { id, name: String(assignment.name || '').trim(), category,
      points: assignment.points_possible, dueAt: assignment.due_at || '', scores: new Map() });
  });
  return Array.from(found.values());
}

/**
 * The score Jupiter gets: Canvas's final score (after any late penalty; legacy used the
 * score before the penalty), else the grade (e.g. "complete"); blank if excused or
 * not graded.
 */
function scoreForJupiter_(submission) {
  if (submission.excused) return '';
  if (submission.score !== null && submission.score !== undefined) return submission.score;
  if (submission.grade !== null && submission.grade !== undefined) return submission.grade;
  return '';
}

/**
 * Fills the JupiterExport grid (ported from legacy writeJupiterExport_). Column A labels
 * are kept; every other cell is cleared except on the "Class:" row. Each assignment gets
 * a Score/Comment column pair: name on "Assignment:", category on "Category:", due date
 * on "Date:", points on "Possible:", "Score:"/"Comment:" on the blank row after
 * "Possible:", and each student's score on rows labelled "... (Jupiter ID)".
 * Returns { values, matched, unmatched } (student rows with / without a roster match).
 */
function fillJupiterExport_(values, assignments, roster, formatDueDate) {
  let afterPossible = false;
  let matched = 0;
  let unmatched = 0;
  const out = values.map(row => row.slice());
  out.forEach(row => {
    const label = String(row.slice(0, 1)[0]).trim();
    if (label !== 'Class:') row.fill('', 1);
    if (label === 'Possible:') afterPossible = true;
    else if (label !== '') afterPossible = false;
    const idMatch = label.match(/\((\d+)\)\s*$/);
    const canvasId = idMatch ? roster.get(idMatch[1]) : undefined;
    if (idMatch) {
      if (canvasId) matched++;
      else unmatched++;
    }

    assignments.forEach((item, index) => {
      const scoreColumn = index * 2 + 1;
      const put = (column, value) => row.splice(column, 1, value);
      if (label === 'Assignment:') put(scoreColumn, item.name);
      else if (label === 'Category:') put(scoreColumn, item.category);
      else if (label === 'Date:' && item.dueAt) put(scoreColumn, formatDueDate(item.dueAt));
      else if (label === 'Possible:') put(scoreColumn, item.points);
      else if (label === '' && afterPossible) {
        put(scoreColumn, 'Score:');
        put(scoreColumn + 1, 'Comment:');
      }
      if (canvasId && item.scores.has(canvasId)) put(scoreColumn, item.scores.get(canvasId));
    });
    if (label === '' && afterPossible) afterPossible = false;
  });
  return { values: out, matched, unmatched };
}

/** A Canvas ID as text, without a trailing ".0" from the sheet. Blank stays blank. */
function jupiterId_(value) {
  return isBlank_(value) ? '' : String(value).replace(/\.0$/, '').trim();
}
