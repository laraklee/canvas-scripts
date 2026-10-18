/**
 * Jupiter.js
 * Purpose: Jupiter Grades tools. So far: "Refresh Jupiter categories" (function
 *   refreshJupiterCategories; menu item, and the legacy Config button's script name).
 *   Ported from the legacy refreshJupiterCategories and getJupiterGroupMap_. Rebuilds the
 *   cfg_JupiterCategories table on ref_Config (three columns: Canvas category | Export to
 *   Jupiter? checkbox | Canvas group ID) from the course's assignment groups, keeping your
 *   checkmarks: matched by group ID, or by name for older lists without IDs. New groups
 *   start unchecked; groups no longer in Canvas drop off (the summary counts them).
 *   The Jupiter export tools (not ported yet) export only the checked groups, so the
 *   column order must stay the same. Logs counts only.
 * Canvas endpoints called: GET /api/v1/courses/:course/assignment_groups (via canvasGet_).
 * Canvas write operations: none.
 * Required named ranges: cfg_JupiterCategories (ref_Config G:I), cfg_CourseID.
 */

const JUPITER_CATEGORY_RANGE = 'cfg_JupiterCategories';
const JUPITER_CATEGORY_HEADERS = Object.freeze(['Canvas category', 'Export to Jupiter?',
  'Canvas group ID']);

/** Adds this file's menu items. Called by onOpen. */
function addJupiterMenuItems_(menu) {
  menu.addSeparator();
  menu.addItem('Refresh Jupiter categories', 'refreshJupiterCategories');
}

/**
 * Menu (and Config button): Course Manager › Refresh Jupiter categories.
 * Nothing changes unless Canvas answers with at least one assignment group.
 */
function refreshJupiterCategories() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  try {
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
    ss.toast(`${rows.length} categor${rows.length === 1 ? 'y' : 'ies'}; ${keptCount} checked ` +
      'kept' + (droppedCount ? `; ${droppedCount} checked categor${droppedCount === 1 ?
        'y is' : 'ies are'} no longer in Canvas and dropped off.` : '.'),
      'Refresh Jupiter categories', 8);
  } catch (error) {
    reportRefreshFailure_('Refresh Jupiter categories',
      'The Jupiter category table was not changed.', error);
  }
}

/** A Canvas ID as text, without a trailing ".0" from the sheet. Blank stays blank. */
function jupiterId_(value) {
  return isBlank_(value) ? '' : String(value).replace(/\.0$/, '').trim();
}
