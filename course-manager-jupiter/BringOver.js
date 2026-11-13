/**
 * BringOver.js
 * Purpose: Course Manager Tools › 📥 Bring over from my old copy… (Lara, 2026-11-13),
 *   modelled on assign-sheet's 10_BringOver.js. A teacher who makes a fresh copy of the
 *   template uses this IN THE NEW COPY to bring their work over from their old workbook.
 *   A side panel (BringOverPanelPage.html) shows a plan, one line per old tab, with a
 *   choice where there is one; then it brings the work over and reports what to redo by
 *   hand (charts, pivot tables, drawn buttons…), with how.
 *   What happens to each tab (Lara's choices 11/13):
 *   - ref_Config: the named settings in BRING_OVER_CONFIG_NAMES (non-blank cells only),
 *     found by name in both copies (no fixed addresses). Replaces what the new copy has
 *     there. Never cfg_ThisSheetID (this sheet's own ID), cfg_CourseName (a formula) or
 *     B2 (the school's address, already in the template).
 *   - Every other ref_ tab: skipped (Refresh tables… rebuilds them).
 *   - Tabs a tool builds (BRING_OVER_BUILT_TABS): skipped (the tool makes them again).
 *   - Tabs the new copy also has (createByRow, makeAssignment, Comments…): "Bring my
 *     cells in" first (every cell at the same place, into the template's tab, which keeps
 *     its own buttons); or copy as "Name (old)"; or Skip. The Home tab starts on Skip.
 *   - Any other tab (the teacher's own): copied whole as a new tab.
 *   Never overwrites: if the new copy has something in a "Bring my cells in" tab that
 *   differs from the old copy, nothing at all is brought over and the panel says where.
 *   A cell with the same formula in both copies counts as the same, even if it shows
 *   something different for now (e.g. =cfg_CourseName before the settings come in).
 *   All checks run before the first change.
 *   Buttons and pictures drawn over cells can't be read through the Sheets API, so they
 *   don't come over; the panel says so and how to copy them by hand.
 *   The old copy is only read (Sheets API, read-only permission; 09_TabRebuild.js, the
 *   same file as assign-sheet's, copied unchanged).
 * Canvas endpoints called: none. Canvas write operations: none.
 * Logging: counts only, never cell contents, tab names, or the old copy's name.
 * Required User/Script Properties: none.
 */

const BRING_OVER_TITLE = 'Bring over from my old copy';
const BRING_OVER_CONFIG_NAMES = [
  'cfg_CourseID', 'cfg_UserID', 'cfg_CcEmail', 'cfg_MasterCalendarDocID', 'cfg_SchoolYearTab',
  'cfg_TermQuarters', 'cfg_TimeSchoolStart', 'cfg_TimeSchoolEnd', 'cfg_TimeAfterSchool',
  'cfg_TimeNight', 'cfg_SeatingDeckID', 'cfg_SeatingPeriods', 'cfg_JupiterCategories',
];
// Plain names, not TOOL_SHEETS.…: files load in name order, and this one loads before
// Config.js. The offline check compares them with TOOL_SHEETS.
const BRING_OVER_BUILT_TABS = [
  'Course Check', 'Quiz Check', 'Quiz Check detail', 'Quiz report', 'Quiz export report',
  'Assignment Order', 'rubricCanvasExport', 'JupiterExport',
];

/** Menu: Course Manager Tools › 📥 Bring over from my old copy…. Opens the panel. */
function showBringOverPanel() {
  const html = HtmlService.createHtmlOutputFromFile('BringOverPanelPage').setTitle(BRING_OVER_TITLE);
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Called by the panel: "Look at it". Returns { ok, oldTitle, rows: [{ name, action,
 * options: [{ value, label }], note }] } or { ok: false, message }. Never throws.
 */
function planBringOver(link) {
  try {
    const plan = buildBringOverPlan_(link);
    return { ok: true, oldTitle: plan.oldTitle, rows: plan.rows };
  } catch (error) {
    console.error('Bring over: plan failed.');
    return { ok: false, message: error.message };
  }
}

/**
 * Called by the panel: "Bring over". choices: { tab name → action }. Returns { ok,
 * message, done: [lines], handWork: [lines], warnings: [lines] } or { ok: false,
 * message, problems: [lines] }. Never throws.
 */
function runBringOver(link, choices) {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(2000)) {
    return { ok: false, message: 'Bring over is already running in this workbook. Wait for ' +
      'it to finish.', problems: [] };
  }
  const started = Date.now();
  try {
    const result = doBringOver_(link, choices || {});
    console.log('Bring over: ' + (result.ok ? 'finished' : 'stopped before changing anything') +
      ' in ' + Math.round((Date.now() - started) / 1000) + ' s.');
    return result;
  } catch (error) {
    console.error('Bring over: stopped part way.');
    return { ok: false, message: 'Bring over stopped part way: ' + error.message +
      ' Some tabs may already have been brought over. Look at them, then delete this copy ' +
      'and start again from a fresh copy of the template if needed.', problems: [] };
  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// The plan

function buildBringOverPlan_(link) {
  const sourceId = rebuildExtractId_(link);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!sourceId) {
    throw new Error('That doesn\'t look like a link to a Google Sheet. Open your old ' +
      'workbook and copy the whole address from the address bar.');
  }
  if (sourceId === ss.getId()) {
    throw new Error('That\'s the link to THIS workbook. Paste the link to your OLD one.');
  }
  const outline = rebuildReadOutline_(sourceId);
  if (!outline.sheets.some((s) => s.title === SHEETS.CONFIG)) {
    throw new Error('That sheet doesn\'t look like a Course Manager workbook (it has no ' +
      SHEETS.CONFIG + ' tab). Check the link.');
  }
  const rows = outline.sheets.map((s) => planRowFor_(ss, s));
  return { sourceId, oldTitle: outline.title, outline, rows };
}

function planRowFor_(ss, s) {
  const name = s.title;
  const here = Boolean(ss.getSheetByName(name));
  const only = (value, label, note) => ({ name, action: value, options: [{ value, label }], note });
  const skip = { value: 'skip', label: 'Skip' };

  if (!s.isGrid) {
    return only('skip', 'Skip', 'A chart on its own tab: make it again by hand (see the end).');
  }
  if (name === SHEETS.CONFIG && here) {
    return { name, action: 'config', options: [{ value: 'config', label: 'Bring settings in' },
      skip], note: 'Your course number, user ID, cc email, calendar, term quarters, due ' +
      'times, seating chart and Jupiter categories (blank cells are left as they are). ' +
      'Replaces what this copy has in those cells.' };
  }
  if (isSystemSheet_(name)) {
    return only('skip', 'Skip', 'A reference tab: Refresh tables… brings it up to date.');
  }
  if (BRING_OVER_BUILT_TABS.includes(name)) {
    return only('skip', 'Skip', 'A tool makes this tab; run the tool again when you need it.');
  }
  if (here) {
    const isHome = findHomeSheet_([name]) === name;
    return { name, action: isHome ? 'skip' : 'data', options: [
      { value: 'data', label: 'Bring my cells in' },
      { value: 'copyOld', label: 'Copy as "' + oldCopyName_(ss, name) + '"' }, skip],
    note: 'This copy has this tab too. "Bring my cells in" puts your cells at the same ' +
      'places in it; if this copy already has something different there, nothing is ' +
      'brought over and you\'ll see where.' };
  }
  return { name, action: 'copy', options: [{ value: 'copy', label: 'Copy whole tab' }, skip],
    note: 'Your own tab. Buttons drawn on it don\'t come over (see the end).' };
}

/** "Name (old)", or "Name (old 2)"… if that is taken too. */
function oldCopyName_(ss, name) {
  let candidate = name + ' (old)';
  for (let n = 2; ss.getSheetByName(candidate); n++) candidate = name + ' (old ' + n + ')';
  return candidate;
}

// ---------------------------------------------------------------------------
// Bringing it over

function doBringOver_(link, choices) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const plan = buildBringOverPlan_(link);

  // The teacher's choice for each tab, if it's one the plan allows.
  const picks = new Map(Object.entries(choices));
  const chosen = plan.rows.map((row) => {
    const pick = picks.has(row.name) ? picks.get(row.name) : row.action;
    const allowed = row.options.some((o) => o.value === pick);
    return { name: row.name, action: allowed ? pick : row.action };
  }).filter((c) => c.action !== 'skip');
  if (chosen.length === 0) {
    return { ok: false, message: 'Every tab is set to Skip, so there was nothing to bring ' +
      'over.', problems: [] };
  }

  const data = rebuildReadTabs_(plan.sourceId, chosen.map((c) => c.name));
  const srcOf = (name) => data.sheets.get(name);

  // 1. Checks. Nothing changes unless every check passes.
  const problems = [];
  chosen.forEach((c) => {
    const src = srcOf(c.name);
    if (!src) {
      problems.push(c.name + ': could not be read from the old copy.');
      return;
    }
    if (c.action === 'data') {
      const w = bringFindInTheWay_(ss.getSheetByName(c.name), src);
      if (w.count > 0) {
        problems.push(c.name + ': ' + w.count + ' cell(s) in this copy already have ' +
          'something different from the old copy (first: ' + w.first + '). Set this tab ' +
          'to Copy as "' + oldCopyName_(ss, c.name) + '", or Skip.');
      }
    }
  });
  if (problems.length > 0) {
    return { ok: false, message: 'Nothing was brought over yet. Fix these first, then click ' +
      'Bring over again:', problems };
  }

  // 2. New tabs first, so formulas that point at another tab find it.
  const report = rebuildNewReport_();
  const done = [];
  const newTabs = new Map(); // old title → new sheet
  chosen.filter((c) => c.action === 'copy' || c.action === 'copyOld').forEach((c) => {
    const title = c.action === 'copyOld' ? oldCopyName_(ss, c.name) : c.name;
    newTabs.set(c.name, rebuildCreateTab_(ss, srcOf(c.name), title));
  });
  rebuildNamedRanges_(ss, data.namedRanges, data.sheets, newTabs, report);

  // 3. Fill everything.
  chosen.forEach((c) => {
    const src = srcOf(c.name);
    const before = report.cells;
    rebuildCountHandWork_(src, report, c.name);
    if (c.action === 'config') {
      const r = bringConfigNames_(ss, src, data.namedRanges, report);
      done.push(c.name + ': ' + r.cells + ' setting cell(s) brought in.' +
        (r.missing ? ' ' + r.missing + ' setting(s) not found in one of the copies.' : ''));
      return;
    }
    if (c.action === 'data') {
      rebuildWriteCells_(ss.getSheetByName(c.name), src, 0, report, c.name, false);
    } else {
      const sheet = newTabs.get(c.name);
      rebuildFillTab_(sheet, src, report, c.name);
      if (src.properties.hidden) sheet.hideSheet();
    }
    const where = c.action === 'copyOld' ? ' (as "' + newTabs.get(c.name).getName() + '")' : '';
    done.push(c.name + where + ': ' + (report.cells - before) + ' cell(s) with something in them.');
  });

  const handWork = describeHandWork_(report);
  plan.outline.sheets.filter((s) => !s.isGrid).forEach((s) => {
    handWork.push(s.title + ': a chart on its own tab');
  });
  if (chosen.some((c) => c.action !== 'config')) {
    handWork.push('Buttons or pictures you drew on your tabs: these can\'t be copied ' +
      'this way. Look over each tab next to your old copy.');
  }
  return {
    ok: true,
    message: 'Done. Your old copy was not changed.',
    done,
    handWork,
    warnings: report.warnings.slice(0, 10),
  };
}

/**
 * Like rebuildFindInTheWay_ (09_TabRebuild.js), for a whole tab, but formula cells are
 * compared by formula: the same formula in both copies is never in the way, even if it
 * shows something different for now (=cfg_CourseName shows another value until the
 * settings come in), and a different formula always is. { count, first } (first is like
 * "F12", or '').
 */
function bringFindInTheWay_(sheet, src) {
  const rows = rebuildRows_(src);
  const nCols = rows.reduce((m, r) => Math.max(m, (r.values || []).length), 0);
  const rowsHere = Math.min(rows.length, sheet.getMaxRows());
  const colsHere = Math.min(nCols, sheet.getMaxColumns());
  if (rowsHere <= 0 || colsHere <= 0) return { count: 0, first: '' };
  const range = sheet.getRange(1, 1, rowsHere, colsHere);
  const values = range.getValues();
  const shown = range.getDisplayValues();
  const formulas = range.getFormulas();
  let count = 0;
  let first = '';
  values.forEach((row, r) => {
    row.forEach((v, c) => {
      if (v === '' || v === false) return;
      const old = rebuildCellAt_(rows, r, c);
      const formula = formulas.at(r).at(c);
      const oldFormula = old.userEnteredValue && old.userEnteredValue.formulaValue;
      // A formula here is the same only if the old cell has that formula; otherwise the
      // template's formula would be replaced, even if both show the same thing today.
      if (formula ? formula === oldFormula : shown.at(r).at(c) === (old.formattedValue || '')) {
        return;
      }
      count++;
      if (!first) first = rebuildA1_(r + 1, c + 1);
    });
  });
  return { count, first };
}

/**
 * ref_Config: for each name in BRING_OVER_CONFIG_NAMES, copies the old copy's non-blank
 * cells of that named range into the same named range here (same offsets, cut to the
 * smaller of the two). Returns { cells, missing } (missing: names not found in either
 * copy, or not on ref_Config).
 */
function bringConfigNames_(ss, src, namedRanges, report) {
  const rows = rebuildRows_(src);
  const oldSheetId = src.properties.sheetId || 0;
  const oldByName = new Map(namedRanges.map((nr) => [nr.name, nr.range]));
  let cells = 0;
  let missing = 0;
  BRING_OVER_CONFIG_NAMES.forEach((name) => {
    const old = oldByName.get(name);
    const here = ss.getRangeByName(name);
    if (!old || (old.sheetId || 0) !== oldSheetId || !here ||
      here.getSheet().getName() !== SHEETS.CONFIG) {
      missing++;
      return;
    }
    const r0 = old.startRowIndex || 0;
    const c0 = old.startColumnIndex || 0;
    const r1 = old.endRowIndex !== undefined ? Math.min(old.endRowIndex, rows.length) : rows.length;
    const c1 = old.endColumnIndex !== undefined ? old.endColumnIndex
      : rows.reduce((m, r) => Math.max(m, (r.values || []).length), 0);
    const nRows = Math.min(r1 - r0, here.getNumRows());
    const nCols = Math.min(c1 - c0, here.getNumColumns());
    const sheet = here.getSheet();
    for (let r = 0; r < nRows; r++) {
      for (let c = 0; c < nCols; c++) {
        const value = rebuildCellValue_(rebuildCellAt_(rows, r0 + r, c0 + c), report);
        if (value === '') continue;
        sheet.getRange(here.getRow() + r, here.getColumn() + c).setValue(value);
        cells++;
      }
    }
  });
  return { cells, missing };
}

/** Lines for the panel: what to redo by hand, per tab. */
function describeHandWork_(report) {
  const lines = [];
  report.hand.forEach((h, tab) => {
    const parts = [];
    if (h.charts) parts.push(h.charts + ' chart(s)');
    if (h.pivotTables) parts.push(h.pivotTables + ' pivot table(s)');
    if (h.protectedRanges) parts.push(h.protectedRanges + ' protected range(s)');
    if (h.filterViews) parts.push(h.filterViews + ' filter view(s)');
    if (h.alternatingColors) parts.push(h.alternatingColors + ' set(s) of alternating colors');
    if (h.otherRules) parts.push(h.otherRules + ' unusual dropdown or color rule(s)');
    if (parts.length) lines.push(tab + ': ' + parts.join(', '));
  });
  if (report.themeColors) {
    lines.push(report.themeColors + ' cell color(s) came from a theme and were left plain.');
  }
  return lines;
}
