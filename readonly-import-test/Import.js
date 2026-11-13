/**
 * Import.js — SCRATCH TEST, not for teachers.
 * Purpose: answer two questions before we build the real "Bring over tabs from my old
 *   copy" tool.
 *   1. Can a script READ another workbook with only the read-only permission
 *      (spreadsheets.readonly, through the Sheets API advanced service) and REBUILD its
 *      tabs here with only the "this spreadsheet" permission (spreadsheets.currentonly)?
 *      How close does the rebuild come? (runReadOnlyImport)
 *   2. Does the usual way (SpreadsheetApp.openById) work with the read-only permission,
 *      or does it demand full edit access? (checkOpenByUrl)
 *   The rebuild brings: values, formulas, number formats, colors, fonts, bold/italic,
 *   alignment, wrapping, borders, rich text and links, notes, dropdowns and checkboxes,
 *   merged cells, column widths and row heights, hidden rows and columns, frozen rows
 *   and columns, gridlines, tab colors, hidden tabs, conditional colors, named ranges, and
 *   a plain filter (without its criteria). Charts, pivot tables, protected ranges, filter
 *   views and alternating colors are counted in the report, not rebuilt.
 * Canvas endpoints called: none.
 * Google APIs: Sheets API spreadsheets.get on the old copy (read-only).
 * Write operations: only to this spreadsheet. The old copy is never changed.
 * Logging: counts only; never cell contents or tab names.
 * Required User/Script Properties: none.
 */

const IMPORT_FIELDS_ = [
  'properties.title',
  'namedRanges(name,range)',
  'sheets(properties,merges,conditionalFormats,charts(chartId),' +
    'protectedRanges(protectedRangeId),filterViews(filterViewId),basicFilter(range),' +
    'bandedRanges(bandedRangeId),' +
    'data(startRow,startColumn,rowMetadata(pixelSize,hiddenByUser),' +
    'columnMetadata(pixelSize,hiddenByUser),' +
    'rowData(values(userEnteredValue,userEnteredFormat,dataValidation,note,' +
    'textFormatRuns,pivotTable(source))))))',
].join(',');

const DEFAULT_ROW_PX_ = 21;
const DEFAULT_COL_PX_ = 100;

function runReadOnlyImport() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.prompt('Bring tabs over (read-only test)',
    'Paste the link to the OLD copy:', ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  const sourceId = extractSpreadsheetId_(resp.getResponseText());
  const dest = SpreadsheetApp.getActive();
  if (!sourceId) {
    ui.alert('That does not look like a link to a Google Sheet.');
    return;
  }
  if (sourceId === dest.getId()) {
    ui.alert('That is this spreadsheet. Paste the link to the OLD copy.');
    return;
  }
  const started = Date.now();
  try {
    const report = importAllTabs_(sourceId, dest);
    const seconds = Math.round((Date.now() - started) / 1000);
    console.log('Read-only import finished: ' + report.tabs + ' tabs, ' +
      report.cells + ' cells, ' + seconds + ' s');
    ui.alert('Finished in ' + seconds + ' seconds', formatImportReport_(report), ui.ButtonSet.OK);
  } catch (err) {
    console.error('Read-only import stopped; details shown to the user only.');
    ui.alert('Import stopped', String(err && err.message), ui.ButtonSet.OK);
  }
}

function checkOpenByUrl() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.prompt('Check SpreadsheetApp',
    'Paste the link to the OLD copy:', ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  const id = extractSpreadsheetId_(resp.getResponseText());
  if (!id) {
    ui.alert('That does not look like a link to a Google Sheet.');
    return;
  }
  try {
    const other = SpreadsheetApp.openById(id);
    const tabs = other.getSheets().length;
    ui.alert('It worked: SpreadsheetApp opened the old copy (' + tabs +
      ' tabs) with the read-only permission.');
  } catch (err) {
    ui.alert('It did not work (this is a useful answer, not a problem):\n\n' +
      String(err && err.message));
  }
}

// ---------------------------------------------------------------------------
// The import itself

function importAllTabs_(sourceId, dest) {
  const src = Sheets.Spreadsheets.get(sourceId, { includeGridData: true, fields: IMPORT_FIELDS_ });
  const report = newImportReport_();
  const srcSheets = src.sheets || [];

  // Refuse rather than overwrite: any tab name already here stops the import.
  const clashes = srcSheets.filter((s) => dest.getSheetByName(s.properties.title));
  if (clashes.length > 0) {
    throw new Error(clashes.length + ' tab name(s) from the old copy already exist here: ' +
      clashes.map((s) => s.properties.title).join(', ') + '. Rename or delete them first.');
  }

  // 1. Create every tab first, so formulas that point at a later tab find it.
  const byId = new Map();
  srcSheets.forEach((s) => {
    const p = s.properties;
    if (p.sheetType && p.sheetType !== 'GRID') {
      report.notRebuilt.chartTabs++;
      return;
    }
    const sheet = dest.insertSheet(p.title, dest.getNumSheets());
    const gp = p.gridProperties || {};
    resizeSheet_(sheet, gp.rowCount || 1000, gp.columnCount || 26);
    byId.set(p.sheetId || 0, { sheet, src: s });
    report.tabs++;
  });

  // 2. Named ranges before formulas, so formulas that use them work at once.
  (src.namedRanges || []).forEach((nr) => {
    const entry = byId.get(nr.range.sheetId || 0);
    if (!entry) return;
    if (dest.getNamedRanges().some((x) => x.getName() === nr.name)) {
      report.warnings.push('Named range already here, kept the new one: ' + nr.name);
      return;
    }
    dest.setNamedRange(nr.name, gridRangeToRange_(entry.sheet, nr.range));
    report.namedRanges++;
  });

  // 3. Fill each tab.
  byId.forEach(({ sheet, src: s }) => rebuildTab_(sheet, s, report));

  // 4. Hide the tabs that were hidden (after filling; a spreadsheet needs one visible tab).
  byId.forEach(({ sheet, src: s }) => {
    if (s.properties.hidden) sheet.hideSheet();
  });
  return report;
}

function rebuildTab_(sheet, s, report) {
  const p = s.properties;
  const gp = p.gridProperties || {};
  if (gp.frozenRowCount) sheet.setFrozenRows(gp.frozenRowCount);
  if (gp.frozenColumnCount) sheet.setFrozenColumns(gp.frozenColumnCount);
  if (gp.hideGridlines) sheet.setHiddenGridlines(true);
  const tabColor = colorToHex_(p.tabColorStyle || p.tabColor, report);
  if (tabColor) sheet.setTabColor(tabColor);

  (s.data || []).forEach((gd) => rebuildGridData_(sheet, gd, report));

  (s.merges || []).forEach((gr) => {
    gridRangeToRange_(sheet, gr).merge();
    report.merges++;
  });

  const rules = (s.conditionalFormats || [])
    .map((cf) => buildConditionalRule_(sheet, cf, report))
    .filter((r) => r);
  if (rules.length) sheet.setConditionalFormatRules(sheet.getConditionalFormatRules().concat(rules));

  if (s.basicFilter && s.basicFilter.range) {
    gridRangeToRange_(sheet, s.basicFilter.range).createFilter();
    report.filters++;
  }
  report.notRebuilt.charts += (s.charts || []).length;
  report.notRebuilt.protectedRanges += (s.protectedRanges || []).length;
  report.notRebuilt.filterViews += (s.filterViews || []).length;
  report.notRebuilt.alternatingColors += (s.bandedRanges || []).length;
}

function rebuildGridData_(sheet, gd, report) {
  const row0 = gd.startRow || 0;
  const col0 = gd.startColumn || 0;
  const rowData = gd.rowData || [];
  const nRows = rowData.length;
  const nCols = rowData.reduce((m, r) => Math.max(m, (r.values || []).length), 0);

  if (nRows > 0 && nCols > 0) {
    const values = [];
    const notes = [];
    const rules = [];
    const fmt = newFormatGroups_();
    const richCells = [];
    const ruleCache = new Map();
    let anyNote = false;
    let anyRule = false;

    rowData.forEach((rd, r) => {
      const rowVals = [];
      const rowNotes = [];
      const rowRules = [];
      const cells = rd.values || [];
      for (let c = 0; c < nCols; c++) {
        const cell = cells.at(c) || {};
        const a1 = a1_(row0 + r + 1, col0 + c + 1);
        rowVals.push(cellValue_(cell, report));
        rowNotes.push(cell.note || '');
        if (cell.note) { anyNote = true; report.notes++; }
        const rule = cell.dataValidation ? buildValidation_(cell.dataValidation, ruleCache, report) : null;
        rowRules.push(rule);
        if (rule) anyRule = true;
        if (cell.userEnteredFormat) addCellFormat_(fmt, a1, cell.userEnteredFormat, report);
        if (cell.pivotTable) report.notRebuilt.pivotTables++;
        const rich = buildRichText_(cell, report);
        if (rich) richCells.push({ a1, rich });
      }
      values.push(rowVals);
      notes.push(rowNotes);
      rules.push(rowRules);
    });

    const rect = sheet.getRange(row0 + 1, col0 + 1, nRows, nCols);
    rect.setValues(values);
    applyFormatGroups_(sheet, fmt);
    // Rich text goes last: setting a font on the whole cell afterwards would wipe it.
    richCells.forEach(({ a1, rich }) => sheet.getRange(a1).setRichTextValue(rich));
    report.richText += richCells.length;
    if (anyNote) rect.setNotes(notes);
    if (anyRule) rect.setDataValidations(rules);
  }

  (gd.columnMetadata || []).forEach((m, i) => {
    const col = col0 + i + 1;
    if (m.pixelSize && m.pixelSize !== DEFAULT_COL_PX_) sheet.setColumnWidth(col, m.pixelSize);
    if (m.hiddenByUser) sheet.hideColumns(col);
  });
  (gd.rowMetadata || []).forEach((m, i) => {
    const row = row0 + i + 1;
    if (m.pixelSize && m.pixelSize !== DEFAULT_ROW_PX_) sheet.setRowHeight(row, m.pixelSize);
    if (m.hiddenByUser) sheet.hideRows(row);
  });
}

// ---------------------------------------------------------------------------
// Values

function cellValue_(cell, report) {
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
    const s = v.stringValue;
    // A leading apostrophe keeps "007", "1/2" or "=x" as text instead of a number,
    // date or formula. Sheets hides the apostrophe.
    return looksLikeNonText_(s) ? "'" + s : s;
  }
  report.warnings.push('A cell had an error value and was left blank.');
  return '';
}

function looksLikeNonText_(s) {
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

function newFormatGroups_() {
  return {
    numberFormat: new Map(), background: new Map(), fontColor: new Map(),
    fontFamily: new Map(), fontSize: new Map(), fontWeight: new Map(),
    fontStyle: new Map(), fontLine: new Map(), hAlign: new Map(),
    vAlign: new Map(), wrap: new Map(), border: new Map(),
  };
}

function addToGroup_(group, key, a1) {
  if (!group.has(key)) group.set(key, []);
  group.get(key).push(a1);
}

function addCellFormat_(g, a1, f, report) {
  const nf = numberFormatPattern_(f.numberFormat);
  if (nf) addToGroup_(g.numberFormat, nf, a1);
  const bg = colorToHex_(f.backgroundColorStyle || f.backgroundColor, report);
  if (bg) addToGroup_(g.background, bg, a1);
  const tf = f.textFormat || {};
  const fc = colorToHex_(tf.foregroundColorStyle || tf.foregroundColor, report);
  if (fc) addToGroup_(g.fontColor, fc, a1);
  if (tf.fontFamily) addToGroup_(g.fontFamily, tf.fontFamily, a1);
  if (tf.fontSize) addToGroup_(g.fontSize, tf.fontSize, a1);
  if (tf.bold) addToGroup_(g.fontWeight, 'bold', a1);
  if (tf.italic) addToGroup_(g.fontStyle, 'italic', a1);
  if (tf.strikethrough) addToGroup_(g.fontLine, 'line-through', a1);
  else if (tf.underline) addToGroup_(g.fontLine, 'underline', a1);
  if (f.horizontalAlignment) addToGroup_(g.hAlign, f.horizontalAlignment.toLowerCase(), a1);
  if (f.verticalAlignment) addToGroup_(g.vAlign, f.verticalAlignment.toLowerCase(), a1);
  if (f.wrapStrategy) addToGroup_(g.wrap, f.wrapStrategy, a1);
  if (f.borders) {
    Object.entries(f.borders).forEach(([side, b]) => {
      if (!['top', 'left', 'bottom', 'right'].includes(side)) return;
      if (!b || !b.style || b.style === 'NONE') return;
      const color = colorToHex_(b.colorStyle || b.color, report) || '#000000';
      addToGroup_(g.border, side + '|' + b.style + '|' + color, a1);
      report.borders++;
    });
  }
}

function applyFormatGroups_(sheet, g) {
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
  each(g.wrap, (rl, k) => rl.setWrapStrategy(wrapStrategy_(k)));
  each(g.border, (rl, k) => {
    const [side, style, color] = k.split('|');
    const bs = borderStyle_(style);
    rl.setBorder(side === 'top' ? true : null, side === 'left' ? true : null,
      side === 'bottom' ? true : null, side === 'right' ? true : null, null, null, color, bs);
  });
}

function borderStyle_(apiValue) {
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

function interpolationType_(apiValue) {
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

function wrapStrategy_(apiValue) {
  if (apiValue === 'WRAP' || apiValue === 'LEGACY_WRAP') return SpreadsheetApp.WrapStrategy.WRAP;
  if (apiValue === 'CLIP') return SpreadsheetApp.WrapStrategy.CLIP;
  return SpreadsheetApp.WrapStrategy.OVERFLOW;
}

function numberFormatPattern_(nf) {
  if (!nf) return null;
  if (nf.pattern) return nf.pattern;
  const defaults = {
    TEXT: '@', NUMBER: '#,##0.00', PERCENT: '0.00%', CURRENCY: '$#,##0.00',
    DATE: 'm/d/yyyy', TIME: 'h:mm:ss am/pm', DATE_TIME: 'm/d/yyyy h:mm:ss',
    SCIENTIFIC: '0.00E+00',
  };
  return defaults[nf.type] || null;
}

// ---------------------------------------------------------------------------
// Rich text (links and formatting on part of a cell's text)

function buildRichText_(cell, report) {
  const v = cell.userEnteredValue;
  if (!v || v.stringValue === undefined) return null;
  const text = v.stringValue;
  const runs = cell.textFormatRuns || [];
  const cellLink = cell.userEnteredFormat && cell.userEnteredFormat.textFormat &&
    cell.userEnteredFormat.textFormat.link && cell.userEnteredFormat.textFormat.link.uri;
  if (runs.length === 0 && !cellLink) return null;

  const builder = SpreadsheetApp.newRichTextValue().setText(text);
  if (cellLink) builder.setLinkUrl(cellLink);
  runs.forEach((run, i) => {
    const start = run.startIndex || 0;
    const end = i + 1 < runs.length ? (runs[i + 1].startIndex || 0) : text.length;
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
    const color = colorToHex_(f.foregroundColorStyle || f.foregroundColor, report);
    if (color) { style.setForegroundColor(color); styled = true; }
    if (styled) builder.setTextStyle(start, end, style.build());
    if (f.link && f.link.uri) builder.setLinkUrl(start, end, f.link.uri);
  });
  return builder.build();
}

// ---------------------------------------------------------------------------
// Dropdowns and checkboxes

function buildValidation_(dv, cache, report) {
  const key = JSON.stringify(dv);
  if (cache.has(key)) {
    const cached = cache.get(key);
    if (cached) report.validations++;
    else report.notRebuilt.dropdownRules++;
    return cached;
  }
  const cond = dv.condition || {};
  const vals = (cond.values || []).map((x) => x.userEnteredValue);
  const showDropdown = dv.showCustomUi !== false;
  let b = SpreadsheetApp.newDataValidation();
  switch (cond.type) {
    case 'ONE_OF_LIST': b = b.requireValueInList(vals, showDropdown); break;
    case 'ONE_OF_RANGE': {
      const range = SpreadsheetApp.getActive().getRange(String(vals[0]).replace(/^=/, ''));
      b = b.requireValueInRange(range, showDropdown);
      break;
    }
    case 'BOOLEAN':
      b = vals.length >= 2 ? b.requireCheckbox(vals[0], vals[1])
        : vals.length === 1 ? b.requireCheckbox(vals[0]) : b.requireCheckbox();
      break;
    case 'CUSTOM_FORMULA': b = b.requireFormulaSatisfied(vals[0]); break;
    case 'NUMBER_BETWEEN': b = b.requireNumberBetween(Number(vals[0]), Number(vals[1])); break;
    case 'NUMBER_NOT_BETWEEN': b = b.requireNumberNotBetween(Number(vals[0]), Number(vals[1])); break;
    case 'NUMBER_GREATER': b = b.requireNumberGreaterThan(Number(vals[0])); break;
    case 'NUMBER_GREATER_THAN_EQ': b = b.requireNumberGreaterThanOrEqualTo(Number(vals[0])); break;
    case 'NUMBER_LESS': b = b.requireNumberLessThan(Number(vals[0])); break;
    case 'NUMBER_LESS_THAN_EQ': b = b.requireNumberLessThanOrEqualTo(Number(vals[0])); break;
    case 'NUMBER_EQ': b = b.requireNumberEqualTo(Number(vals[0])); break;
    case 'NUMBER_NOT_EQ': b = b.requireNumberNotEqualTo(Number(vals[0])); break;
    case 'TEXT_CONTAINS': b = b.requireTextContains(vals[0]); break;
    case 'TEXT_NOT_CONTAINS': b = b.requireTextDoesNotContain(vals[0]); break;
    case 'TEXT_EQ': b = b.requireTextEqualTo(vals[0]); break;
    case 'TEXT_IS_EMAIL': b = b.requireTextIsEmail(); break;
    case 'TEXT_IS_URL': b = b.requireTextIsUrl(); break;
    case 'DATE_IS_VALID': b = b.requireDate(); break;
    default:
      cache.set(key, null);
      report.notRebuilt.dropdownRules++;
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

function buildConditionalRule_(sheet, cf, report) {
  const ranges = (cf.ranges || []).map((gr) => gridRangeToRange_(sheet, gr));
  if (ranges.length === 0) return null;
  let b = SpreadsheetApp.newConditionalFormatRule().setRanges(ranges);

  if (cf.gradientRule) {
    const g = cf.gradientRule;
    b = applyGradientPoint_(b, g.minpoint, 'Min', report);
    if (g.midpoint) b = applyGradientPoint_(b, g.midpoint, 'Mid', report);
    b = applyGradientPoint_(b, g.maxpoint, 'Max', report);
    if (!b) { report.notRebuilt.conditionalRules++; return null; }
    report.conditionalRules++;
    return b.build();
  }

  const br = cf.booleanRule;
  if (!br) { report.notRebuilt.conditionalRules++; return null; }
  const cond = br.condition || {};
  const vals = (cond.values || []).map((x) => x.userEnteredValue);
  const num = (i) => Number(vals.at(i));
  const numOk = (n) => vals.slice(0, n).every((v) => v !== undefined && !isNaN(Number(v)));
  switch (cond.type) {
    case 'NUMBER_GREATER': if (!numOk(1)) break; b = b.whenNumberGreaterThan(num(0)); break;
    case 'NUMBER_GREATER_THAN_EQ': if (!numOk(1)) break; b = b.whenNumberGreaterThanOrEqualTo(num(0)); break;
    case 'NUMBER_LESS': if (!numOk(1)) break; b = b.whenNumberLessThan(num(0)); break;
    case 'NUMBER_LESS_THAN_EQ': if (!numOk(1)) break; b = b.whenNumberLessThanOrEqualTo(num(0)); break;
    case 'NUMBER_EQ': if (!numOk(1)) break; b = b.whenNumberEqualTo(num(0)); break;
    case 'NUMBER_NOT_EQ': if (!numOk(1)) break; b = b.whenNumberNotEqualTo(num(0)); break;
    case 'NUMBER_BETWEEN': if (!numOk(2)) break; b = b.whenNumberBetween(num(0), num(1)); break;
    case 'NUMBER_NOT_BETWEEN': if (!numOk(2)) break; b = b.whenNumberNotBetween(num(0), num(1)); break;
    case 'TEXT_CONTAINS': b = b.whenTextContains(vals[0]); break;
    case 'TEXT_NOT_CONTAINS': b = b.whenTextDoesNotContain(vals[0]); break;
    case 'TEXT_STARTS_WITH': b = b.whenTextStartsWith(vals[0]); break;
    case 'TEXT_ENDS_WITH': b = b.whenTextEndsWith(vals[0]); break;
    case 'TEXT_EQ': b = b.whenTextEqualTo(vals[0]); break;
    case 'BLANK': b = b.whenCellEmpty(); break;
    case 'NOT_BLANK': b = b.whenCellNotEmpty(); break;
    case 'CUSTOM_FORMULA': b = b.whenFormulaSatisfied(vals[0]); break;
    default: break;
  }
  // If no condition was set above, the rule cannot be rebuilt.
  if (!conditionWasSet_(b)) { report.notRebuilt.conditionalRules++; return null; }

  const f = br.format || {};
  const bg = colorToHex_(f.backgroundColorStyle || f.backgroundColor, report);
  if (bg) b = b.setBackground(bg);
  const tf = f.textFormat || {};
  const fc = colorToHex_(tf.foregroundColorStyle || tf.foregroundColor, report);
  if (fc) b = b.setFontColor(fc);
  if (tf.bold !== undefined) b = b.setBold(tf.bold);
  if (tf.italic !== undefined) b = b.setItalic(tf.italic);
  if (tf.strikethrough !== undefined) b = b.setStrikethrough(tf.strikethrough);
  if (tf.underline !== undefined) b = b.setUnderline(tf.underline);
  report.conditionalRules++;
  return b.build();
}

function conditionWasSet_(builder) {
  try {
    return builder.getBooleanCondition() !== null;
  } catch {
    return false;
  }
}

function applyGradientPoint_(b, point, which, report) {
  if (!b || !point) return b;
  const color = colorToHex_(point.colorStyle || point.color, report) || '#ffffff';
  const type = point.type;
  if (type === 'MIN' && which === 'Min') return b.setGradientMinpoint(color);
  if (type === 'MAX' && which === 'Max') return b.setGradientMaxpoint(color);
  const interp = interpolationType_(type);
  if (!interp) return null;
  const value = String(point.value === undefined ? '' : point.value);
  if (which === 'Min') return b.setGradientMinpointWithValue(color, interp, value);
  if (which === 'Mid') return b.setGradientMidpointWithValue(color, interp, value);
  return b.setGradientMaxpointWithValue(color, interp, value);
}

// ---------------------------------------------------------------------------
// Small helpers

function extractSpreadsheetId_(text) {
  const t = String(text || '').trim();
  const m = t.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/);
  if (m) return m[1];
  return /^[a-zA-Z0-9_-]{20,}$/.test(t) ? t : null;
}

function resizeSheet_(sheet, rows, cols) {
  const r = sheet.getMaxRows();
  const c = sheet.getMaxColumns();
  if (rows > r) sheet.insertRowsAfter(r, rows - r);
  else if (rows < r) sheet.deleteRows(rows + 1, r - rows);
  if (cols > c) sheet.insertColumnsAfter(c, cols - c);
  else if (cols < c) sheet.deleteColumns(cols + 1, c - cols);
}

function gridRangeToRange_(sheet, gr) {
  const r0 = gr.startRowIndex || 0;
  const c0 = gr.startColumnIndex || 0;
  const r1 = gr.endRowIndex !== undefined ? gr.endRowIndex : sheet.getMaxRows();
  const c1 = gr.endColumnIndex !== undefined ? gr.endColumnIndex : sheet.getMaxColumns();
  return sheet.getRange(r0 + 1, c0 + 1, r1 - r0, c1 - c0);
}

function a1_(row, col) {
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
function colorToHex_(c, report) {
  if (!c) return null;
  if (c.themeColor && !c.rgbColor) {
    report.themeColors++;
    return null;
  }
  const rgb = c.rgbColor || c;
  const hex = (x) => ('0' + Math.round((x || 0) * 255).toString(16)).slice(-2);
  return '#' + hex(rgb.red) + hex(rgb.green) + hex(rgb.blue);
}

// ---------------------------------------------------------------------------
// Report

function newImportReport_() {
  return {
    tabs: 0, cells: 0, formulas: 0, notes: 0, richText: 0, validations: 0,
    conditionalRules: 0, merges: 0, borders: 0, namedRanges: 0, filters: 0, themeColors: 0,
    notRebuilt: {
      charts: 0, chartTabs: 0, pivotTables: 0, protectedRanges: 0, filterViews: 0,
      alternatingColors: 0, dropdownRules: 0, conditionalRules: 0,
    },
    warnings: [],
  };
}

function formatImportReport_(r) {
  const n = r.notRebuilt;
  const lines = [
    'Rebuilt:',
    '  Tabs: ' + r.tabs,
    '  Cells with something in them: ' + r.cells + ' (formulas: ' + r.formulas + ')',
    '  Rich-text cells (links, part-bold): ' + r.richText,
    '  Notes: ' + r.notes + '   Dropdowns/checkboxes: ' + r.validations,
    '  Conditional color rules: ' + r.conditionalRules + '   Merges: ' + r.merges,
    '  Border edges: ' + r.borders + '   Named ranges: ' + r.namedRanges +
      '   Filters: ' + r.filters,
    '',
    'NOT rebuilt (expected):',
    '  Charts: ' + n.charts + '   Chart tabs: ' + n.chartTabs + '   Pivot tables: ' + n.pivotTables,
    '  Protected ranges: ' + n.protectedRanges + '   Filter views: ' + n.filterViews +
      '   Alternating colors: ' + n.alternatingColors,
    '  Dropdown rules of an unusual kind: ' + n.dropdownRules +
      '   Conditional rules of an unusual kind: ' + n.conditionalRules,
    '  Theme colors (left at default): ' + r.themeColors,
  ];
  if (r.warnings.length) lines.push('', 'Notes:', ...r.warnings.slice(0, 10).map((w) => '  ' + w));
  lines.push('', 'Now compare each tab with the old copy, side by side.');
  return lines.join('\n');
}
