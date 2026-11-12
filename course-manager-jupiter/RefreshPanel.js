/**
 * RefreshPanel.js
 * Purpose: the "Refresh tables" side panel (Lara, 2026-11-11): a checkbox per reference
 *   table, an "All" box, and an Update button, so teachers don't have to find the right
 *   menu items. Each table's name is a link that opens its tab (unhiding a ref_ tab), to
 *   look before or after updating. Also holds the one list of refreshable tables, shared
 *   with Refresh all tables (Menus.js). Course check has its own row and is in "All"
 *   (Lara, 2026-11-11; before, it ran inside the assignment groups step). Jupiter
 *   categories are in the panel but never in "All" (Lara refreshes them by hand while
 *   looking at ref_Config).
 *   - showRefreshPanel (menu: Setup & Data › Refresh tables…): opens RefreshPanelPage.html
 *     (not RefreshPanel.html: Apps Script drops extensions, so the names must differ).
 *   - getRefreshTables, refreshTableFromPanel, showRefreshTableTab: called by the panel
 *     (google.script.run). One refresh call per table, so each gets its own 6-minute run.
 *     Returns counts only.
 * Canvas endpoints called: those of the refreshes (all GET; see RefSheets.js,
 *   Jupiter.js, and CourseCheck.js; the sheet index reads no Canvas).
 * Canvas write operations: none.
 * Required User/Script Properties: User Properties CANVAS_BASE_URL and CANVAS_TOKEN
 *   (through the refreshes); named ranges cfg_CourseID and cfg_JupiterCategories.
 */

const REFRESH_PANEL_TITLE = 'Refresh tables';

/**
 * The reference tables, in panel order: { key, label, inAll, tab, range?, run(ss, shared)
 * → short count summary }. inAll = ticked by "All" and run by Refresh all tables. tab is
 * the sheet the name links to (range: a named range on it to select instead). shared
 * carries the assignment groups download to Course check within one run, so Refresh all
 * tables fetches them once; a panel call starts with an empty one.
 */
function refreshTableList_() {
  return [
    { key: 'courses', label: 'Course list', inAll: true, tab: SHEETS.COURSE_IDS,
      run: ss => `${writeCourseListSheet_(ss)} course(s)` },
    { key: 'people', label: 'People list', inAll: true, tab: SHEETS.PEOPLE_LIST,
      run: ss => `${writePeopleListSheet_(ss)} enrollment row(s)` },
    { key: 'assignmentGroups', label: 'Assignment groups', inAll: true,
      tab: SHEETS.ASSIGNMENT_GROUPS,
      run: (ss, shared) => {
        const counts = writeAssignmentGroupsSheet_(ss);
        shared.canvasGroups = counts.canvasGroups;
        return `${counts.assignments} assignment(s) in ${counts.groups} group(s)`;
      } },
    { key: 'sections', label: 'Section list', inAll: true, tab: SHEETS.SECTION_LOOKUP,
      run: ss => `${writeSectionLookupSheet_(ss).sections} section(s)` },
    { key: 'sheetIndex', label: 'Sheet index', inAll: true, tab: SHEETS.INDEX,
      run: ss => `${buildSheetIndex_(ss)} tab(s)` },
    // Last of "All", so it checks the assignments just downloaded. On its own it
    // downloads them itself (which also refreshes ref_assignmentGroups).
    { key: 'courseCheck', label: 'Course check', inAll: true, tab: TOOL_SHEETS.COURSE_CHECK,
      run: (ss, shared) => courseCheckCountsText_(writeCourseCheck_(ss,
        shared.canvasGroups || writeAssignmentGroupsSheet_(ss).canvasGroups)) },
    { key: 'jupiter', label: 'Jupiter categories', inAll: false, tab: SHEETS.CONFIG,
      range: JUPITER_CATEGORY_RANGE,
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

/** Called by the panel when it opens: [{ key, label, inAll, tab }]. */
function getRefreshTables() {
  return refreshTableList_().map(({ key, label, inAll, tab }) => ({ key, label, inAll, tab }));
}

/**
 * Called by the panel, once per ticked table. Refreshes that table and returns
 * { ok, text } (text: counts, or why it failed; never Canvas's own text). Never throws.
 */
function refreshTableFromPanel(key) {
  const table = refreshTableList_().find(entry => entry.key === key);
  if (!table) return { ok: false, text: 'unknown table' };
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const line = runRefreshSteps_([[table.label, () => table.run(ss, {})]])[0];
  console.log(`Refresh tables panel: ${table.label} ${line.startsWith('✓') ? 'done' : 'failed'}.`);
  return { ok: line.startsWith('✓'), text: line.slice(line.indexOf(': ') + 2) };
}

/**
 * Called by the panel when a table's name is clicked: shows its tab (unhiding a ref_ tab;
 * the next refresh hides it again unless it's still the tab in view) and, for Jupiter
 * categories, selects that table. Returns '' or a short message for the panel.
 */
function showRefreshTableTab(key) {
  const table = refreshTableList_().find(entry => entry.key === key);
  if (!table) return 'Unknown table.';
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(table.tab);
  if (!sheet) {
    return `There is no ${table.tab} tab yet.` + (table.inAll ? ' Update creates it.' : '');
  }
  if (sheet.isSheetHidden()) sheet.showSheet();
  sheet.activate();
  const range = table.range && ss.getRangeByName(table.range);
  if (range) range.activate();
  return '';
}
