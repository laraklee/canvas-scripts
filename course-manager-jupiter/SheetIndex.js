/**
 * SheetIndex.js
 * Purpose: builds ref_Index, a linked list of every tab in the workbook (ported from the
 *   legacy refreshIndex), and writes this workbook's ID into cfg_ThisSheetID (replacing the
 *   legacy writeCurrentSpreadsheetIdToConfig). Runs silently on open, and from the menu
 *   item / Home button "Refresh sheet index" (function refreshSheetIndex).
 *   Same layout as the legacy *Index* tab, because the Home tab reads it: title in A1,
 *   headers in row 3 (Sheet Name, Link, GID), one row per tab from row 4. Your tabs come
 *   first, then reference (ref_) tabs, each alphabetical. Logs counts only.
 * Canvas endpoints called: none.
 * Canvas write operations: none.
 * Required User/Script Properties: none.
 */

const INDEX_TITLE = 'Index';
const INDEX_HEADER_ROW = 3;
const INDEX_HEADERS = Object.freeze(['Sheet Name', 'Link', 'GID']);
const INDEX_HEADER_COLOR = '#FFEB9C';
const INDEX_STRIPE_EVEN = '#FFFFFF';
const INDEX_STRIPE_ODD = '#FFF2CC';

/** Adds this file's menu items. Called by onOpen. */
function addSheetIndexMenuItems_(menu) {
  menu.addSeparator();
  menu.addItem('Refresh sheet index', 'refreshSheetIndex');
}

/**
 * Menu (and Home button): Course Manager › Refresh sheet index.
 * Rebuilds ref_Index and updates cfg_ThisSheetID.
 */
function refreshSheetIndex() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  try {
    const count = buildSheetIndex_(ss);
    ss.toast(`${count} tab(s) listed on ${SHEETS.INDEX}.`, 'Refresh sheet index', 5);
  } catch (error) {
    reportRefreshFailure_('Refresh sheet index', 'The sheet index was not changed.', error);
  }
}

/**
 * Rebuilds ref_Index and writes this workbook's ID into cfg_ThisSheetID (if that named
 * range exists; Check setup reports it if not). Creating ref_Index for the first time
 * does not move you away from the tab you were on. Returns the number of tabs listed.
 */
function buildSheetIndex_(ss) {
  let sheet = ss.getSheetByName(SHEETS.INDEX);
  if (sheet) {
    checkIndexLayout_(sheet);
  } else {
    const current = ss.getActiveSheet();
    sheet = createRefSheet_(ss, SHEETS.INDEX);
    if (current) current.activate();
  }

  const rows = ss.getSheets()
    .map(tab => ({ name: tab.getName(), gid: tab.getSheetId() }))
    .sort((a, b) => Number(isSystemSheet_(a.name)) - Number(isSystemSheet_(b.name)) ||
      a.name.localeCompare(b.name))
    .map(tab => [
      tab.name,
      `=HYPERLINK("#gid=${tab.gid}","${tab.name.replace(/"/g, '""')}")`,
      tab.gid,
    ]);

  sheet.getRange('A1').setValue(INDEX_TITLE)
    .setFontWeight('bold').setFontColor('#0000FF').setFontSize(12);
  sheet.getRange(INDEX_HEADER_ROW, 1, 1, INDEX_HEADERS.length)
    .setValues([INDEX_HEADERS.slice()])
    .setBackground(INDEX_HEADER_COLOR).setFontWeight('bold');

  const firstRow = INDEX_HEADER_ROW + 1;
  const oldRows = sheet.getLastRow() - INDEX_HEADER_ROW;
  if (oldRows > 0) {
    sheet.getRange(firstRow, 1, oldRows, INDEX_HEADERS.length).clearContent().setBackground(null);
  }
  if (rows.length) {
    const block = sheet.getRange(firstRow, 1, rows.length, INDEX_HEADERS.length);
    block.setValues(rows);
    block.setBackgrounds(rows.map((_, i) =>
      Array(INDEX_HEADERS.length).fill(i % 2 === 0 ? INDEX_STRIPE_EVEN : INDEX_STRIPE_ODD)));
    sheet.getRange(firstRow, 3, rows.length, 1).setHorizontalAlignment('left');
  }
  sheet.setColumnWidth(1, 200);
  sheet.setColumnWidth(2, 150);
  sheet.setColumnWidth(3, 100);
  sheet.getRange('A:A').setWrap(true);

  const idCell = ss.getRangeByName('cfg_ThisSheetID');
  if (idCell && idCell.getValue() !== ss.getId()) idCell.setValue(ss.getId());

  console.log(`Refresh sheet index: ${rows.length} tab(s) listed.`);
  return rows.length;
}

/** Refuses to overwrite ref_Index if row 3 is not the index headers (or blank). */
function checkIndexLayout_(sheet) {
  const header = sheet.getRange(INDEX_HEADER_ROW, 1, 1, INDEX_HEADERS.length).getValues()[0];
  const blank = header.every(value => value === '');
  if (!blank && JSON.stringify(header) !== JSON.stringify(INDEX_HEADERS)) {
    throw sheetProblem_(`Row ${INDEX_HEADER_ROW} of ${SHEETS.INDEX} should read ` +
      INDEX_HEADERS.map(h => `"${h}"`).join(', ') +
      '. Move that content or rename the sheet before refreshing.');
  }
}
