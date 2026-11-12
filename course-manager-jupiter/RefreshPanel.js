/**
 * RefreshPanel.js
 * Purpose: the "Refresh tables" side panel (Lara, 2026-11-11): a checkbox per reference
 *   table, an "All" box, and an Update button, so teachers don't have to find the right
 *   menu items. Also holds the one list of refreshable tables, shared with Refresh all
 *   tables (Menus.js). Jupiter categories are in the panel but never in "All" (Lara
 *   refreshes them by hand while looking at ref_Config).
 *   - showRefreshPanel (menu: Setup & Data › Refresh tables…): opens RefreshPanelPage.html
 *     (not RefreshPanel.html: Apps Script drops extensions, so the names must differ).
 *   - getRefreshTables, refreshTableFromPanel: called by the panel (google.script.run).
 *     One call per table, so each gets its own 6-minute run. Returns counts only.
 * Canvas endpoints called: those of the refreshes (all GET; see RefSheets.js and
 *   Jupiter.js; the sheet index reads no Canvas).
 * Canvas write operations: none.
 * Required User/Script Properties: User Properties CANVAS_BASE_URL and CANVAS_TOKEN
 *   (through the refreshes); named range cfg_CourseID.
 */

const REFRESH_PANEL_TITLE = 'Refresh tables';

/**
 * The reference tables, in panel order: { key, label, inAll, run(ss) → short count
 * summary }. inAll = ticked by "All" and run by Refresh all tables.
 */
function refreshTableList_() {
  return [
    { key: 'courses', label: 'Course list', inAll: true,
      run: ss => `${writeCourseListSheet_(ss)} course(s)` },
    { key: 'people', label: 'People list', inAll: true,
      run: ss => `${writePeopleListSheet_(ss)} enrollment row(s)` },
    { key: 'assignmentGroups', label: 'Assignment groups', inAll: true,
      run: ss => {
        const counts = writeAssignmentGroupsSheet_(ss);
        return `${counts.assignments} assignment(s) in ${counts.groups} group(s). ` +
          courseCheckAfterRefresh_(ss, counts.canvasGroups);
      } },
    { key: 'sections', label: 'Section list', inAll: true,
      run: ss => `${writeSectionLookupSheet_(ss).sections} section(s)` },
    { key: 'sheetIndex', label: 'Sheet index', inAll: true,
      run: ss => `${buildSheetIndex_(ss)} tab(s)` },
    { key: 'jupiter', label: 'Jupiter categories', inAll: false,
      run: ss => {
        const counts = writeJupiterCategories_(ss);
        return `${counts.categories} categor(ies), ${counts.kept} ticked kept` +
          (counts.dropped ? `, ${counts.dropped} ticked dropped off` : '') +
          '. Check the ticks on ref_Config.';
      } },
  ];
}

/** Menu: Setup & Data › Refresh tables…. Opens the panel on the right. */
function showRefreshPanel() {
  const html = HtmlService.createHtmlOutputFromFile('RefreshPanelPage').setTitle(REFRESH_PANEL_TITLE);
  SpreadsheetApp.getUi().showSidebar(html);
}

/** Called by the panel when it opens: [{ key, label, inAll }]. */
function getRefreshTables() {
  return refreshTableList_().map(({ key, label, inAll }) => ({ key, label, inAll }));
}

/**
 * Called by the panel, once per ticked table. Refreshes that table and returns
 * { ok, text } (text: counts, or why it failed; never Canvas's own text). Never throws.
 */
function refreshTableFromPanel(key) {
  const table = refreshTableList_().find(entry => entry.key === key);
  if (!table) return { ok: false, text: 'unknown table' };
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const line = runRefreshSteps_([[table.label, () => table.run(ss)]])[0];
  console.log(`Refresh tables panel: ${table.label} ${line.startsWith('✓') ? 'done' : 'failed'}.`);
  return { ok: line.startsWith('✓'), text: line.slice(line.indexOf(': ') + 2) };
}
