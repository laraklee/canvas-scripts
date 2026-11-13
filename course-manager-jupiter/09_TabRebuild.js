/**
 * 09_TabRebuild.js
 * Purpose: the copy engine behind "Bring over from my old copy" (10_BringOver.js;
 *   Lara, 2026-11-13). It READS another spreadsheet through the Sheets API with the
 *   read-only permission and REBUILDS tabs, or blocks of cells, in this spreadsheet. The
 *   old copy is never changed (the read-only permission can't change it). Tested in
 *   readonly-import-test/ on 11/13. Written to be shared: the same file can go into the
 *   other workbook projects unchanged.
 *   Two ways to write:
 *   - rebuildFillTab_: a whole tab (values, formulas, formats, rich text and links, notes,
 *     dropdowns and checkboxes, merges, sizes, hidden rows/columns, frozen rows/columns,
 *     gridlines, tab color, conditional colors, a plain filter).
 *   - rebuildWriteCells_ with fromCol0: the cells from one column on, into a tab that
 *     already exists (the template's own tab). The template keeps its dropdowns, notes and
 *     conditional colors where the old copy has none, and columns hidden here stay hidden.
 *   Not rebuilt (counted per tab for the teacher to redo by hand): charts, pivot tables,
 *   protected ranges, filter views, alternating colors, unusual dropdown or conditional
 *   rules. SpreadsheetApp.openById can't be used: it needs full edit access (tested).
 * Canvas endpoints called: none.
 * Google APIs: Sheets API spreadsheets.get on the old copy (advanced service "Sheets",
 *   scope spreadsheets.readonly). Writes only to this spreadsheet (currentonly).
 * Logging: none here. Callers log counts only, never cell contents or tab names.
 * Required User/Script Properties: none.
 */

const REBUILD_SHEET_FIELDS_ =
  'sheets(properties,merges,conditionalFormats,charts(chartId),' +
  'protectedRanges(protectedRangeId),filterViews(filterViewId),basicFilter(range),' +
  'bandedRanges(bandedRangeId),' +
  'data(startRow,startColumn,rowMetadata(pixelSize,hiddenByUser),' +
  'columnMetadata(pixelSize,hiddenByUser),' +
  'rowData(values(userEnteredValue,formattedValue,userEnteredFormat,dataValidation,note,' +
  'textFormatRuns,pivotTable(source)))))';

const REBUILD_DEFAULT_ROW_PX_ = 21;
const REBUILD_DEFAULT_COL_PX_ = 100;

/** The spreadsheet ID in a pasted link (or a bare ID), or null. */
function rebuildExtractId_(text) {
  const t = String(text || '').trim();
  const m = t.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/);
  if (m) return m[1];
  return /^[a-zA-Z0-9_-]{20,}$/.test(t) ? t : null;
}

/**
 * The old copy's name and tabs, without cell data: { title, sheets: [{ title, isGrid,
 * hidden, charts, protectedRanges, filterViews, alternatingColors }] }. Throws an Error
 * with a teacher-friendly message if the sheet can't be read.
 */
function rebuildReadOutline_(spreadsheetId) {
  let src;
  try {
    src = Sheets.Spreadsheets.get(spreadsheetId, {
      fields: 'properties.title,sheets(properties(sheetId,title,sheetType,hidden),' +
        'charts(chartId),protectedRanges(protectedRangeId),filterViews(filterViewId),' +
        'bandedRanges(bandedRangeId))',
    });
  } catch (err) {
    throw new Error(rebuildDescribeReadError_(err));
  }
  return {
    title: (src.properties && src.properties.title) || '',
    sheets: (src.sheets || []).map((s) => ({
      title: s.properties.title,
      isGrid: !s.properties.sheetType || s.properties.sheetType === 'GRID',
      hidden: Boolean(s.properties.hidden),
      charts: (s.charts || []).length,
      protectedRanges: (s.protectedRanges || []).length,
      filterViews: (s.filterViews || []).length,
      alternatingColors: (s.bandedRanges || []).length,
    })),
  };
}

/**
 * Full cell data for the named tabs of the old copy, plus its named ranges:
 * { sheets: Map(title → Sheets API sheet), namedRanges: [...] }.
 */
function rebuildReadTabs_(spreadsheetId, titles) {
  if (titles.length === 0) return { sheets: new Map(), namedRanges: [] };
  let src;
  try {
    src = Sheets.Spreadsheets.get(spreadsheetId, {
      includeGridData: true,
      ranges: titles.map(rebuildQuoteTitle_),
      fields: 'namedRanges(name,range),' + REBUILD_SHEET_FIELDS_,
    });
  } catch (err) {
    throw new Error(rebuildDescribeReadError_(err));
  }
  const sheets = new Map();
  (src.sheets || []).forEach((s) => sheets.set(s.properties.title, s));
  return { sheets, namedRanges: src.namedRanges || [] };
}

function rebuildQuoteTitle_(title) {
  return "'" + String(title).replace(/'/g, "''") + "'";
}

function rebuildDescribeReadError_(err) {
  const text = String((err && err.message) || '');
  if (/not found|does not have permission|PERMISSION_DENIED|NOT_FOUND|forbidden/i.test(text)) {
    return 'Could not open that sheet. Check the link, and that your Google account can ' +
      'open it.';
  }
  if (/has not been used|is disabled|SERVICE_DISABLED/i.test(text)) {
    return 'The Google Sheets API is turned off for this sheet\'s script. Ask whoever ' +
      'manages this sheet to turn it on (Extensions › Apps Script › Services).';
  }
  return 'Could not read the old copy (' + text.slice(0, 160) + ').';
}

/** A fresh tally for a run. hand: Map(tab title → things to redo by hand). */
function rebuildNewReport_() {
  return {
    cells: 0, formulas: 0, richText: 0, notes: 0, validations: 0, conditionalRules: 0,
    merges: 0, namedRanges: 0, themeColors: 0, warnings: [], hand: new Map(),
  };
}

/** The "redo by hand" counts for one tab (created on first use). */
function rebuildHand_(report, tabTitle) {
  if (!report.hand.has(tabTitle)) {
    report.hand.set(tabTitle, { charts: 0, pivotTables: 0, protectedRanges: 0,
      filterViews: 0, alternatingColors: 0, otherRules: 0 });
  }
  return report.hand.get(tabTitle);
}

/** Counts what can't be rebuilt on a tab (call once per tab brought over). */
function rebuildCountHandWork_(src, report, tabTitle) {
  const h = rebuildHand_(report, tabTitle);
  h.charts += (src.charts || []).length;
  h.protectedRanges += (src.protectedRanges || []).length;
  h.filterViews += (src.filterViews || []).length;
  h.alternatingColors += (src.bandedRanges || []).length;
}

/** The old tab's rows (from row 1, column A), or []. */
function rebuildRows_(src) {
  const gd = (src.data || []).at(0);
  return (gd && gd.rowData) || [];
}

/** One old cell (0-based row and column), or {}. */
function rebuildCellAt_(rows, r, c) {
  const row = rows.at(r);
  return (row && (row.values || []).at(c)) || {};
}

// ---------------------------------------------------------------------------
// Whole tabs

/** Inserts an empty tab at the end, sized like the old one. */
function rebuildCreateTab_(ss, src, title) {
  const sheet = ss.insertSheet(title, ss.getNumSheets());
  const gp = src.properties.gridProperties || {};
  rebuildResize_(sheet, gp.rowCount || 1000, gp.columnCount || 26, true);
  return sheet;
}

/** Fills a tab made by rebuildCreateTab_ with everything from the old tab. */
function rebuildFillTab_(sheet, src, report, tabTitle) {
  const p = src.properties;
  const gp = p.gridProperties || {};
  if (gp.frozenRowCount) sheet.setFrozenRows(gp.frozenRowCount);
  if (gp.frozenColumnCount) sheet.setFrozenColumns(gp.frozenColumnCount);
  if (gp.hideGridlines) sheet.setHiddenGridlines(true);
  const tabColor = rebuildColor_(p.tabColorStyle || p.tabColor, report);
  if (tabColor) sheet.setTabColor(tabColor);

  rebuildWriteCells_(sheet, src, 0, report, tabTitle, true);

  const rules = (src.conditionalFormats || [])
    .map((cf) => rebuildConditionalRule_(sheet, cf, report, tabTitle))
    .filter((r) => r);
  if (rules.length) sheet.setConditionalFormatRules(sheet.getConditionalFormatRules().concat(rules));

  if (src.basicFilter && src.basicFilter.range && !sheet.getFilter()) {
    rebuildGridRange_(sheet, src.basicFilter.range).createFilter();
  }
}

/** Named ranges from the old copy that point into the given tabs (old title → new sheet). */
function rebuildNamedRanges_(ss, namedRanges, oldSheets, newSheetsByOldTitle, report) {
  const byId = new Map();
  oldSheets.forEach((s, title) => byId.set(s.properties.sheetId || 0, title));
  namedRanges.forEach((nr) => {
    const oldTitle = byId.get(nr.range.sheetId || 0);
    const sheet = oldTitle !== undefined ? newSheetsByOldTitle.get(oldTitle) : null;
    if (!sheet) return;
    if (ss.getNamedRanges().some((x) => x.getName() === nr.name)) {
      report.warnings.push('The new copy already has a named range "' + nr.name +
        '"; it was kept.');
      return;
    }
    ss.setNamedRange(nr.name, rebuildGridRange_(sheet, nr.range));
    report.namedRanges++;
  });
}

// ---------------------------------------------------------------------------
// Cells (whole tab, or from one column on)

/**
 * Writes the old tab's cells from column fromCol0 (0-based) on, at the same places.
 * wholeTab: also row heights, hidden rows, and every merge. Otherwise only merges and
 * column sizes from fromCol0 on, and the tab keeps its own dropdowns and notes where
 * the old copy has none.
 */
function rebuildWriteCells_(sheet, src, fromCol0, report, tabTitle, wholeTab) {
  const hand = rebuildHand_(report, tabTitle);
  (src.data || []).forEach((gd) => {
    const row0 = gd.startRow || 0;
    const startCol = gd.startColumn || 0;
    const skip = Math.max(0, fromCol0 - startCol);
    const col0 = startCol + skip;
    const rowData = gd.rowData || [];
    const nRows = rowData.length;
    const nCols = rowData.reduce((m, r) => Math.max(m, (r.values || []).length - skip), 0);

    if (nRows > 0 && nCols > 0) {
      rebuildResize_(sheet, row0 + nRows, col0 + nCols, false);
      const rect = sheet.getRange(row0 + 1, col0 + 1, nRows, nCols);
      const values = [];
      const notes = rect.getNotes();
      const rules = rect.getDataValidations();
      const fmt = rebuildFormatGroups_();
      const richCells = [];
      const ruleCache = new Map();
      let anyNote = false;
      let anyRule = false;

      rowData.forEach((rd, r) => {
        const rowVals = [];
        const cells = (rd.values || []).slice(skip);
        const rowNotes = notes.at(r);
        const rowRules = rules.at(r);
        for (let c = 0; c < nCols; c++) {
          const cell = cells.at(c) || {};
          const a1 = rebuildA1_(row0 + r + 1, col0 + c + 1);
          rowVals.push(rebuildCellValue_(cell, report));
          if (cell.note) {
            rowNotes.splice(c, 1, cell.note);
            anyNote = true;
            report.notes++;
          }
          if (cell.dataValidation) {
            const rule = rebuildValidation_(cell.dataValidation, ruleCache, report, hand);
            if (rule) {
              rowRules.splice(c, 1, rule);
              anyRule = true;
            }
          }
          if (cell.userEnteredFormat) rebuildAddFormat_(fmt, a1, cell.userEnteredFormat, report);
          if (cell.pivotTable) hand.pivotTables++;
          const rich = rebuildRichText_(cell, report);
          if (rich) richCells.push({ a1, rich });
        }
        values.push(rowVals);
      });

      rect.setValues(values);
      rebuildApplyFormats_(sheet, fmt);
      // Rich text last: a font set on the whole cell afterwards would wipe it.
      richCells.forEach(({ a1, rich }) => sheet.getRange(a1).setRichTextValue(rich));
      report.richText += richCells.length;
      if (anyNote) rect.setNotes(notes);
      if (anyRule) rect.setDataValidations(rules);
    }

    (gd.columnMetadata || []).forEach((m, i) => {
      if (i < skip) return;
      const col = startCol + i + 1;
      // A column already hidden here stays hidden: setting a width would show it again
      // (Lara's test, 11/13), and the template may hide a column on purpose.
      if (sheet.isColumnHiddenByUser(col)) return;
      if (m.pixelSize && m.pixelSize !== REBUILD_DEFAULT_COL_PX_) sheet.setColumnWidth(col, m.pixelSize);
      if (m.hiddenByUser) sheet.hideColumns(col);
    });
    if (wholeTab) {
      (gd.rowMetadata || []).forEach((m, i) => {
        const row = row0 + i + 1;
        if (m.pixelSize && m.pixelSize !== REBUILD_DEFAULT_ROW_PX_) sheet.setRowHeight(row, m.pixelSize);
        if (m.hiddenByUser) sheet.hideRows(row);
      });
    }
  });

  (src.merges || []).forEach((gr) => {
    if (!wholeTab && (gr.startColumnIndex || 0) < fromCol0) return;
    try {
      rebuildGridRange_(sheet, gr).merge();
      report.merges++;
    } catch {
      report.warnings.push('Some merged cells on "' + tabTitle + '" could not be merged ' +
        'again (they overlap the new copy\'s own).');
    }
  });
}

/**
 * Counts cells in the new copy that are in the way: they hold something (not blank, not
 * an unticked checkbox) that differs from the old copy's cell at the same place. Looks
 * from column fromCol0 on. { count, first } (first is like "F12", or '').
 */
function rebuildFindInTheWay_(sheet, src, fromCol0) {
  const rows = rebuildRows_(src);
  const nCols = rows.reduce((m, r) => Math.max(m, (r.values || []).length), 0);
  const rowsHere = Math.min(rows.length, sheet.getMaxRows());
  const colsHere = Math.min(nCols, sheet.getMaxColumns()) - fromCol0;
  if (rowsHere <= 0 || colsHere <= 0) return { count: 0, first: '' };
  const range = sheet.getRange(1, fromCol0 + 1, rowsHere, colsHere);
  const values = range.getValues();
  const shown = range.getDisplayValues();
  let count = 0;
  let first = '';
  values.forEach((row, r) => {
    row.forEach((v, c) => {
      if (v === '' || v === false) return;
      const old = rebuildCellAt_(rows, r, fromCol0 + c).formattedValue || '';
      if (shown.at(r).at(c) === old) return;
      count++;
      if (!first) first = rebuildA1_(r + 1, fromCol0 + c + 1);
    });
  });
  return { count, first };
}

// ---------------------------------------------------------------------------
// Values

function rebuildCellValue_(cell, report) {
  const v = cell.userEnteredValue;
  if (!v) return '';
  report.cells++;
  if (v.formulaValue !== undefined) {
    report.formulas++;
    return v.formulaValue;
  }
  if (v.numberValue !== undefined) return v.numberValue;
  if (v.boolValue !== undefined) return v.boolValue;
  if (v.stringValue !== undefined) {
    // A leading apostrophe keeps "007", "1/2" or "=x" as text, not a number, date or
    // formula. Sheets hides the apostrophe.
    return rebuildLooksLikeNonText_(v.stringValue) ? "'" + v.stringValue : v.stringValue;
  }
  return '';
}

function rebuildLooksLikeNonText_(s) {
  const t = s.trim();
  if (t === '') return false;
  if (/^[=+\-'@]/.test(t)) return true;
  if (!isNaN(Number(t.replace(/[$,%]/g, '')))) return true;
  if (/^(true|false)$/i.test(t)) return true;
  const parts = t.split(/[/.-]/);
  if (parts.length >= 2 && parts.length <= 3 && parts.every((x) => /^\d{1,4}$/.test(x))) return true;
  if (/^\d{1,2}:\d{2}/.test(t)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Cell formats, grouped so one call covers every cell with the same setting

function rebuildFormatGroups_() {
  return {
    numberFormat: new Map(), background: new Map(), fontColor: new Map(),
    fontFamily: new Map(), fontSize: new Map(), fontWeight: new Map(),
    fontStyle: new Map(), fontLine: new Map(), hAlign: new Map(),
    vAlign: new Map(), wrap: new Map(), border: new Map(),
  };
}

function rebuildAddToGroup_(group, key, a1) {
  if (!group.has(key)) group.set(key, []);
  group.get(key).push(a1);
}

function rebuildAddFormat_(g, a1, f, report) {
  const nf = rebuildNumberFormat_(f.numberFormat);
  if (nf) rebuildAddToGroup_(g.numberFormat, nf, a1);
  const bg = rebuildColor_(f.backgroundColorStyle || f.backgroundColor, report);
  if (bg) rebuildAddToGroup_(g.background, bg, a1);
  const tf = f.textFormat || {};
  const fc = rebuildColor_(tf.foregroundColorStyle || tf.foregroundColor, report);
  if (fc) rebuildAddToGroup_(g.fontColor, fc, a1);
  if (tf.fontFamily) rebuildAddToGroup_(g.fontFamily, tf.fontFamily, a1);
  if (tf.fontSize) rebuildAddToGroup_(g.fontSize, tf.fontSize, a1);
  if (tf.bold) rebuildAddToGroup_(g.fontWeight, 'bold', a1);
  if (tf.italic) rebuildAddToGroup_(g.fontStyle, 'italic', a1);
  if (tf.strikethrough) rebuildAddToGroup_(g.fontLine, 'line-through', a1);
  else if (tf.underline) rebuildAddToGroup_(g.fontLine, 'underline', a1);
  if (f.horizontalAlignment) rebuildAddToGroup_(g.hAlign, f.horizontalAlignment.toLowerCase(), a1);
  if (f.verticalAlignment) rebuildAddToGroup_(g.vAlign, f.verticalAlignment.toLowerCase(), a1);
  if (f.wrapStrategy) rebuildAddToGroup_(g.wrap, f.wrapStrategy, a1);
  if (f.borders) {
    Object.entries(f.borders).forEach(([side, b]) => {
      if (!['top', 'left', 'bottom', 'right'].includes(side)) return;
      if (!b || !b.style || b.style === 'NONE') return;
      const color = rebuildColor_(b.colorStyle || b.color, report) || '#000000';
      rebuildAddToGroup_(g.border, side + '|' + b.style + '|' + color, a1);
    });
  }
}

function rebuildApplyFormats_(sheet, g) {
  const each = (group, fn) => group.forEach((a1s, key) => fn(sheet.getRangeList(a1s), key));
  each(g.numberFormat, (rl, k) => rl.setNumberFormat(k));
  each(g.background, (rl, k) => rl.setBackground(k));
  each(g.fontColor, (rl, k) => rl.setFontColor(k));
  each(g.fontFamily, (rl, k) => rl.setFontFamily(k));
  each(g.fontSize, (rl, k) => rl.setFontSize(k));
  each(g.fontWeight, (rl, k) => rl.setFontWeight(k));
  each(g.fontStyle, (rl, k) => rl.setFontStyle(k));
  each(g.fontLine, (rl, k) => rl.setFontLine(k));
  each(g.hAlign, (rl, k) => rl.setHorizontalAlignment(k));
  each(g.vAlign, (rl, k) => rl.setVerticalAlignment(k));
  each(g.wrap, (rl, k) => rl.setWrapStrategy(rebuildWrap_(k)));
  each(g.border, (rl, k) => {
    const [side, style, color] = k.split('|');
    rl.setBorder(side === 'top' ? true : null, side === 'left' ? true : null,
      side === 'bottom' ? true : null, side === 'right' ? true : null, null, null,
      color, rebuildBorderStyle_(style));
  });
}

function rebuildBorderStyle_(apiValue) {
  const S = SpreadsheetApp.BorderStyle;
  switch (apiValue) {
    case 'DOTTED': return S.DOTTED;
    case 'DASHED': return S.DASHED;
    case 'SOLID_MEDIUM': return S.SOLID_MEDIUM;
    case 'SOLID_THICK': return S.SOLID_THICK;
    case 'DOUBLE': return S.DOUBLE;
    default: return S.SOLID;
  }
}

function rebuildWrap_(apiValue) {
  if (apiValue === 'WRAP' || apiValue === 'LEGACY_WRAP') return SpreadsheetApp.WrapStrategy.WRAP;
  if (apiValue === 'CLIP') return SpreadsheetApp.WrapStrategy.CLIP;
  return SpreadsheetApp.WrapStrategy.OVERFLOW;
}

function rebuildNumberFormat_(nf) {
  if (!nf) return null;
  if (nf.pattern) return nf.pattern;
  switch (nf.type) {
    case 'TEXT': return '@';
    case 'NUMBER': return '#,##0.00';
    case 'PERCENT': return '0.00%';
    case 'CURRENCY': return '$#,##0.00';
    case 'DATE': return 'm/d/yyyy';
    case 'TIME': return 'h:mm:ss am/pm';
    case 'DATE_TIME': return 'm/d/yyyy h:mm:ss';
    case 'SCIENTIFIC': return '0.00E+00';
    default: return null;
  }
}

// ---------------------------------------------------------------------------
// Rich text (links and formatting on part of a cell's text)

function rebuildRichText_(cell, report) {
  const v = cell.userEnteredValue;
  if (!v || v.stringValue === undefined) return null;
  const text = v.stringValue;
  const runs = cell.textFormatRuns || [];
  const tf = (cell.userEnteredFormat && cell.userEnteredFormat.textFormat) || {};
  const cellLink = tf.link && tf.link.uri;
  if (runs.length === 0 && !cellLink) return null;

  const builder = SpreadsheetApp.newRichTextValue().setText(text);
  if (cellLink) builder.setLinkUrl(cellLink);
  runs.forEach((run, i) => {
    const start = run.startIndex || 0;
    const next = runs.at(i + 1);
    const end = next ? (next.startIndex || 0) : text.length;
    if (end <= start) return;
    const f = run.format || {};
    const style = SpreadsheetApp.newTextStyle();
    let styled = false;
    if (f.bold !== undefined) { style.setBold(f.bold); styled = true; }
    if (f.italic !== undefined) { style.setItalic(f.italic); styled = true; }
    if (f.strikethrough !== undefined) { style.setStrikethrough(f.strikethrough); styled = true; }
    if (f.underline !== undefined) { style.setUnderline(f.underline); styled = true; }
    if (f.fontSize) { style.setFontSize(f.fontSize); styled = true; }
    if (f.fontFamily) { style.setFontFamily(f.fontFamily); styled = true; }
    const color = rebuildColor_(f.foregroundColorStyle || f.foregroundColor, report);
    if (color) { style.setForegroundColor(color); styled = true; }
    if (styled) builder.setTextStyle(start, end, style.build());
    if (f.link && f.link.uri) builder.setLinkUrl(start, end, f.link.uri);
  });
  return builder.build();
}

// ---------------------------------------------------------------------------
// Dropdowns and checkboxes

function rebuildValidation_(dv, cache, report, hand) {
  const key = JSON.stringify(dv);
  if (cache.has(key)) {
    const cached = cache.get(key);
    if (cached) report.validations++;
    return cached;
  }
  const cond = dv.condition || {};
  const vals = (cond.values || []).map((x) => x.userEnteredValue);
  const first = vals.at(0);
  const second = vals.at(1);
  const showDropdown = dv.showCustomUi !== false;
  let b = SpreadsheetApp.newDataValidation();
  try {
    switch (cond.type) {
      case 'ONE_OF_LIST': b = b.requireValueInList(vals, showDropdown); break;
      case 'ONE_OF_RANGE':
        b = b.requireValueInRange(SpreadsheetApp.getActive()
          .getRange(String(first).replace(/^=/, '')), showDropdown);
        break;
      case 'BOOLEAN':
        b = vals.length >= 2 ? b.requireCheckbox(first, second)
          : vals.length === 1 ? b.requireCheckbox(first) : b.requireCheckbox();
        break;
      case 'CUSTOM_FORMULA': b = b.requireFormulaSatisfied(first); break;
      case 'NUMBER_BETWEEN': b = b.requireNumberBetween(Number(first), Number(second)); break;
      case 'NUMBER_NOT_BETWEEN': b = b.requireNumberNotBetween(Number(first), Number(second)); break;
      case 'NUMBER_GREATER': b = b.requireNumberGreaterThan(Number(first)); break;
      case 'NUMBER_GREATER_THAN_EQ': b = b.requireNumberGreaterThanOrEqualTo(Number(first)); break;
      case 'NUMBER_LESS': b = b.requireNumberLessThan(Number(first)); break;
      case 'NUMBER_LESS_THAN_EQ': b = b.requireNumberLessThanOrEqualTo(Number(first)); break;
      case 'NUMBER_EQ': b = b.requireNumberEqualTo(Number(first)); break;
      case 'NUMBER_NOT_EQ': b = b.requireNumberNotEqualTo(Number(first)); break;
      case 'TEXT_CONTAINS': b = b.requireTextContains(first); break;
      case 'TEXT_NOT_CONTAINS': b = b.requireTextDoesNotContain(first); break;
      case 'TEXT_EQ': b = b.requireTextEqualTo(first); break;
      case 'TEXT_IS_EMAIL': b = b.requireTextIsEmail(); break;
      case 'TEXT_IS_URL': b = b.requireTextIsUrl(); break;
      case 'DATE_IS_VALID': b = b.requireDate(); break;
      default: b = null;
    }
  } catch {
    b = null;
  }
  if (!b) {
    cache.set(key, null);
    hand.otherRules++;
    return null;
  }
  b = b.setAllowInvalid(!dv.strict);
  if (dv.inputMessage) b = b.setHelpText(dv.inputMessage);
  const rule = b.build();
  cache.set(key, rule);
  report.validations++;
  return rule;
}

// ---------------------------------------------------------------------------
// Conditional colors

function rebuildConditionalRule_(sheet, cf, report, tabTitle) {
  const hand = rebuildHand_(report, tabTitle);
  const ranges = (cf.ranges || []).map((gr) => rebuildGridRange_(sheet, gr));
  if (ranges.length === 0) return null;
  let b = SpreadsheetApp.newConditionalFormatRule().setRanges(ranges);

  if (cf.gradientRule) {
    const g = cf.gradientRule;
    b = rebuildGradientPoint_(b, g.minpoint, 'Min', report);
    if (g.midpoint) b = rebuildGradientPoint_(b, g.midpoint, 'Mid', report);
    b = rebuildGradientPoint_(b, g.maxpoint, 'Max', report);
    if (!b) { hand.otherRules++; return null; }
    report.conditionalRules++;
    return b.build();
  }

  const br = cf.booleanRule;
  if (!br) { hand.otherRules++; return null; }
  const cond = br.condition || {};
  const vals = (cond.values || []).map((x) => x.userEnteredValue);
  const first = vals.at(0);
  const second = vals.at(1);
  const isNum = (v) => v !== undefined && !isNaN(Number(v));
  const one = isNum(first);
  const two = one && isNum(second);
  let set = true;
  switch (cond.type) {
    case 'NUMBER_GREATER': if (one) b = b.whenNumberGreaterThan(Number(first)); else set = false; break;
    case 'NUMBER_GREATER_THAN_EQ': if (one) b = b.whenNumberGreaterThanOrEqualTo(Number(first)); else set = false; break;
    case 'NUMBER_LESS': if (one) b = b.whenNumberLessThan(Number(first)); else set = false; break;
    case 'NUMBER_LESS_THAN_EQ': if (one) b = b.whenNumberLessThanOrEqualTo(Number(first)); else set = false; break;
    case 'NUMBER_EQ': if (one) b = b.whenNumberEqualTo(Number(first)); else set = false; break;
    case 'NUMBER_NOT_EQ': if (one) b = b.whenNumberNotEqualTo(Number(first)); else set = false; break;
    case 'NUMBER_BETWEEN': if (two) b = b.whenNumberBetween(Number(first), Number(second)); else set = false; break;
    case 'NUMBER_NOT_BETWEEN': if (two) b = b.whenNumberNotBetween(Number(first), Number(second)); else set = false; break;
    case 'TEXT_CONTAINS': b = b.whenTextContains(first); break;
    case 'TEXT_NOT_CONTAINS': b = b.whenTextDoesNotContain(first); break;
    case 'TEXT_STARTS_WITH': b = b.whenTextStartsWith(first); break;
    case 'TEXT_ENDS_WITH': b = b.whenTextEndsWith(first); break;
    case 'TEXT_EQ': b = b.whenTextEqualTo(first); break;
    case 'BLANK': b = b.whenCellEmpty(); break;
    case 'NOT_BLANK': b = b.whenCellNotEmpty(); break;
    case 'CUSTOM_FORMULA': b = b.whenFormulaSatisfied(first); break;
    default: set = false;
  }
  if (!set) { hand.otherRules++; return null; }

  const f = br.format || {};
  const bg = rebuildColor_(f.backgroundColorStyle || f.backgroundColor, report);
  if (bg) b = b.setBackground(bg);
  const tf = f.textFormat || {};
  const fc = rebuildColor_(tf.foregroundColorStyle || tf.foregroundColor, report);
  if (fc) b = b.setFontColor(fc);
  if (tf.bold !== undefined) b = b.setBold(tf.bold);
  if (tf.italic !== undefined) b = b.setItalic(tf.italic);
  if (tf.strikethrough !== undefined) b = b.setStrikethrough(tf.strikethrough);
  if (tf.underline !== undefined) b = b.setUnderline(tf.underline);
  report.conditionalRules++;
  return b.build();
}

function rebuildGradientPoint_(b, point, which, report) {
  if (!b || !point) return b;
  const color = rebuildColor_(point.colorStyle || point.color, report) || '#ffffff';
  const type = point.type;
  if (type === 'MIN' && which === 'Min') return b.setGradientMinpoint(color);
  if (type === 'MAX' && which === 'Max') return b.setGradientMaxpoint(color);
  const interp = rebuildInterpolation_(type);
  if (!interp) return null;
  const value = String(point.value === undefined ? '' : point.value);
  if (which === 'Min') return b.setGradientMinpointWithValue(color, interp, value);
  if (which === 'Mid') return b.setGradientMidpointWithValue(color, interp, value);
  return b.setGradientMaxpointWithValue(color, interp, value);
}

function rebuildInterpolation_(apiValue) {
  const T = SpreadsheetApp.InterpolationType;
  switch (apiValue) {
    case 'NUMBER': return T.NUMBER;
    case 'PERCENT': return T.PERCENT;
    case 'PERCENTILE': return T.PERCENTILE;
    case 'MIN': return T.MIN;
    case 'MAX': return T.MAX;
    default: return null;
  }
}

// ---------------------------------------------------------------------------
// Small helpers

/** Grows (and, if shrink, shrinks) a tab to at least rows × cols. */
function rebuildResize_(sheet, rows, cols, shrink) {
  const r = sheet.getMaxRows();
  const c = sheet.getMaxColumns();
  if (rows > r) sheet.insertRowsAfter(r, rows - r);
  else if (shrink && rows < r) sheet.deleteRows(rows + 1, r - rows);
  if (cols > c) sheet.insertColumnsAfter(c, cols - c);
  else if (shrink && cols < c) sheet.deleteColumns(cols + 1, c - cols);
}

function rebuildGridRange_(sheet, gr) {
  const r0 = gr.startRowIndex || 0;
  const c0 = gr.startColumnIndex || 0;
  const r1 = gr.endRowIndex !== undefined ? gr.endRowIndex : sheet.getMaxRows();
  const c1 = gr.endColumnIndex !== undefined ? gr.endColumnIndex : sheet.getMaxColumns();
  return sheet.getRange(r0 + 1, c0 + 1, r1 - r0, c1 - c0);
}

function rebuildA1_(row, col) {
  let s = '';
  let n = col;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s + row;
}

/** Sheets API color (or ColorStyle) → "#rrggbb". Theme-only colors are counted, not guessed. */
function rebuildColor_(c, report) {
  if (!c) return null;
  if (c.themeColor && !c.rgbColor) {
    report.themeColors++;
    return null;
  }
  const rgb = c.rgbColor || c;
  const hex = (x) => ('0' + Math.round((x || 0) * 255).toString(16)).slice(-2);
  return '#' + hex(rgb.red) + hex(rgb.green) + hex(rgb.blue);
}
