/**
 * 10_BringOver.js
 * Purpose: Canvas Tools › 📥 Bring over from my old copy… (Lara, 2026-11-13). A teacher
 *   who makes a fresh copy of the template uses this IN THE NEW COPY to bring their work
 *   over from their old copy. A side panel (BringOverPanelPage.html) shows a plan, one
 *   line per old tab, with a choice where there is one; then it brings the work over and
 *   reports what to redo by hand (charts, pivot tables…), with how.
 *   What happens to each tab (Lara's choices 11/13):
 *   - *Config*: B2–B5, D3, D5, E2:F5 from the old copy (non-blank cells only). Replaces
 *     what the new copy has there.
 *   - Q1–Q4: columns F onward, row by row, only if columns A–E match row by row in both
 *     copies (so each row's lesson lands on the same date). Run 🔄 Update schedule from
 *     Master in the new copy first.
 *   - calendarEvents: every cell, including the post links in H–I (so nothing posts twice).
 *   - Assignment Dates: skipped (reload it from Canvas). Helper tabs: skipped (rebuilt by
 *     Update schedule).
 *   - Any other tab: copied whole as a new tab; if the new copy already has a tab with
 *     that name, skipped unless the teacher picks "copy as Name (old)".
 *   Never overwrites: if the new copy has something in a Q tab (F onward) or in
 *   calendarEvents that differs from the old copy, nothing at all is brought over and the
 *   panel says where (Lara, 11/13). A formula already here counts as different unless
 *   the old cell has the same formula (bringFindInTheWay_). All checks run before the
 *   first change. Buttons and pictures drawn over cells can't be read through the
 *   Sheets API, so they don't come over; the panel says so and how to copy them.
 *   The old copy is only read (Sheets API, read-only permission; 09_TabRebuild.js).
 * Canvas endpoints called: none. Canvas write operations: none.
 * Logging: counts only, never cell contents, tab names, or the old copy's name.
 * Required User/Script Properties: none.
 */

const BRING_OVER_TITLE = 'Bring over from my old copy';
const BRING_OVER_CONFIG_TAB = '*Config*';
const BRING_OVER_CONFIG_CELLS = ['B2', 'B3', 'B4', 'B5', 'D3', 'D5', 'E2:F5'];
const BRING_OVER_QUARTER_TABS = ['Q1', 'Q2', 'Q3', 'Q4'];
const BRING_OVER_QUARTER_FROM_COL0 = 5; // column F
const BRING_OVER_QUARTER_CHECK_COLS = 5; // columns A–E must match
const BRING_OVER_DATA_TABS = ['calendarEvents'];
const BRING_OVER_RELOAD_TABS = ['Assignment Dates'];
const BRING_OVER_HELPER_TABS = ['*simpleSchedule*', '*scheduleLookup*', '*schedule*',
  'AssignmentMaster', 'AssignmentLookupFinal'];

/** Menu: Canvas Tools › 📥 Bring over from my old copy…. Opens the panel on the right. */
function showBringOverPanel() {
  const html = HtmlService.createHtmlOutputFromFile('BringOverPanelPage').setTitle(BRING_OVER_TITLE);
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Called by the panel: "Look at it". Returns { ok, message, oldTitle, rows: [{ name,
 * action, options: [{ value, label }], note }] } or { ok: false, message }. Never throws.
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
    return { ok: false, message: 'Bring over is already running in this sheet. Wait for it ' +
      'to finish.', problems: [] };
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
    throw new Error('That doesn\'t look like a link to a Google Sheet. Open your old copy ' +
      'and copy the whole address from the address bar.');
  }
  if (sourceId === ss.getId()) {
    throw new Error('That\'s the link to THIS sheet. Paste the link to your OLD copy.');
  }
  const outline = rebuildReadOutline_(sourceId);
  const oldTitles = outline.sheets.map((s) => s.title);
  if (!oldTitles.includes(BRING_OVER_CONFIG_TAB) || !oldTitles.includes('Q1')) {
    throw new Error('That sheet doesn\'t look like an Assignment sheet (it has no ' +
      BRING_OVER_CONFIG_TAB + ' or Q1 tab). Check the link.');
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
  if (name === BRING_OVER_CONFIG_TAB && here) {
    return { name, action: 'config', options: [{ value: 'config', label: 'Bring settings in' },
      skip], note: 'B2–B5, D3, D5 and E2:F5 (blank cells are left as they are). Replaces ' +
      'what this copy has in those cells.' };
  }
  if (BRING_OVER_QUARTER_TABS.includes(name) && here) {
    return { name, action: 'quarter', options: [{ value: 'quarter', label: 'Bring columns F→ in' },
      skip], note: 'Your columns from F on, row by row, after checking that columns A–E ' +
      'match in both copies.' };
  }
  if (BRING_OVER_DATA_TABS.includes(name) && here) {
    return { name, action: 'data', options: [{ value: 'data', label: 'Bring rows in' }, skip],
      note: 'All rows, with the links in H and I, so nothing is posted twice.' };
  }
  if (BRING_OVER_RELOAD_TABS.includes(name)) {
    return only('skip', 'Skip', 'Reload it from Canvas afterwards (📝 Assignment dates › ' +
      'Load assignment dates from Canvas).');
  }
  if (BRING_OVER_HELPER_TABS.includes(name)) {
    return only('skip', 'Skip', 'A helper tab: 🔄 Update schedule from Master rebuilds it.');
  }
  if (here) {
    return { name, action: 'skip', options: [skip,
      { value: 'copyOld', label: 'Copy as "' + oldCopyName_(ss, name) + '"' }],
    note: 'This copy has its own tab with this name.' };
  }
  return { name, action: 'copy', options: [{ value: 'copy', label: 'Copy whole tab' }, skip],
    note: 'Your own tab.' };
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
    if (c.action === 'quarter') {
      const q = checkQuarterRows_(ss.getSheetByName(c.name), src);
      if (q) problems.push(c.name + ': ' + q);
    }
    if (c.action === 'quarter' || c.action === 'data') {
      const fromCol0 = c.action === 'quarter' ? BRING_OVER_QUARTER_FROM_COL0 : 0;
      const w = bringFindInTheWay_(ss.getSheetByName(c.name), src, fromCol0);
      if (w.count > 0) {
        problems.push(c.name + ': ' + w.count + ' cell(s) in this copy already have ' +
          'something different from the old copy (first: ' + w.first + '). Clear them, or ' +
          'set this tab to Skip.');
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
      const n = bringConfigCells_(ss.getSheetByName(c.name), src, report);
      done.push(c.name + ': ' + n + ' setting(s) brought in.');
      return;
    }
    if (c.action === 'quarter') {
      rebuildWriteCells_(ss.getSheetByName(c.name), src, BRING_OVER_QUARTER_FROM_COL0, report,
        c.name, false);
    } else if (c.action === 'data') {
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
  if (chosen.some((c) => c.action === 'copy' || c.action === 'copyOld')) {
    handWork.push('Buttons or pictures you drew on your own tabs: these can\'t be copied ' +
      'this way. Look over each copied tab next to your old copy.');
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
 * Like rebuildFindInTheWay_ (09_TabRebuild.js, shared and kept unchanged), but formula
 * cells are compared by formula (Lara, 11/13, from Course Manager's version): a cell with
 * a formula here is in the way unless the old cell has the same formula, even if both
 * show the same thing today, so a template formula is never replaced. Other cells are
 * compared by what they show, as before. Looks from column fromCol0 on.
 * { count, first } (first is like "F12", or '').
 */
function bringFindInTheWay_(sheet, src, fromCol0) {
  const rows = rebuildRows_(src);
  const nCols = rows.reduce((m, r) => Math.max(m, (r.values || []).length), 0);
  const rowsHere = Math.min(rows.length, sheet.getMaxRows());
  const colsHere = Math.min(nCols, sheet.getMaxColumns()) - fromCol0;
  if (rowsHere <= 0 || colsHere <= 0) return { count: 0, first: '' };
  const range = sheet.getRange(1, fromCol0 + 1, rowsHere, colsHere);
  const values = range.getValues();
  const shown = range.getDisplayValues();
  const formulas = range.getFormulas();
  let count = 0;
  let first = '';
  values.forEach((row, r) => {
    row.forEach((v, c) => {
      if (v === '' || v === false) return;
      const old = rebuildCellAt_(rows, r, fromCol0 + c);
      const formula = formulas.at(r).at(c);
      const oldFormula = old.userEnteredValue && old.userEnteredValue.formulaValue;
      if (formula ? formula === oldFormula : shown.at(r).at(c) === (old.formattedValue || '')) {
        return;
      }
      count++;
      if (!first) first = rebuildA1_(r + 1, fromCol0 + c + 1);
    });
  });
  return { count, first };
}

/**
 * Q tabs: columns A–E must match row by row. Returns '' if they do, else why not.
 * Compares what each cell shows (the old copy's formatted value and this copy's display).
 */
function checkQuarterRows_(sheet, src) {
  const rows = rebuildRows_(src);
  const n = Math.min(rows.length, sheet.getMaxRows());
  if (n === 0) return '';
  const here = sheet.getRange(1, 1, n, BRING_OVER_QUARTER_CHECK_COLS).getDisplayValues();
  let differ = 0;
  let firstRow = 0;
  let oldHasDates = false;
  let hereHasDates = false;
  here.forEach((shown, r) => {
    const old = [];
    for (let c = 0; c < BRING_OVER_QUARTER_CHECK_COLS; c++) {
      old.push(rebuildCellAt_(rows, r, c).formattedValue || '');
    }
    if (old.some((v) => v !== '')) oldHasDates = true;
    if (shown.some((v) => v !== '')) hereHasDates = true;
    if (old.join('\u0001') !== shown.join('\u0001')) {
      differ++;
      if (!firstRow) firstRow = r + 1;
    }
  });
  if (oldHasDates && !hereHasDates) {
    return 'columns A–E are empty in this copy. Run 🔄 Update schedule from Master first.';
  }
  if (differ > 0) {
    return differ + ' row(s) in columns A–E don\'t match the old copy (first: row ' +
      firstRow + '), so lessons would land on the wrong dates. Run 🔄 Update schedule ' +
      'from Master in this copy; if they still differ, the school calendar has changed: ' +
      'set this tab to Skip and copy your columns by hand.';
  }
  return '';
}

/** *Config*: copies the listed cells that aren't blank in the old copy. Returns how many. */
function bringConfigCells_(sheet, src, report) {
  const rows = rebuildRows_(src);
  let n = 0;
  BRING_OVER_CONFIG_CELLS.forEach((a1) => {
    const range = sheet.getRange(a1);
    for (let r = 0; r < range.getNumRows(); r++) {
      for (let c = 0; c < range.getNumColumns(); c++) {
        const row0 = range.getRow() - 1 + r;
        const col0 = range.getColumn() - 1 + c;
        const value = rebuildCellValue_(rebuildCellAt_(rows, row0, col0), report);
        if (value === '') continue;
        sheet.getRange(row0 + 1, col0 + 1).setValue(value);
        n++;
      }
    }
  });
  return n;
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
