/**
 * MakeAssignment.js
 * Purpose: the makeAssignment tabs: create one Canvas item plus its section overrides.
 *   Lara keeps several copies of the tab with different names, so every function works
 *   on the tab being viewed, never a tab name. The tab is recognized by its mini-tables,
 *   each found by its first label (MAKE_ASSIGNMENT_TABLES), so tables can sit anywhere
 *   and repeat labels like "Due Date". Columns within a table are found by label.
 *   - Item: two label rows read as one table ("canvasID" row and "Canvas URL" row); each
 *     row's values are in the row just below it.
 *   - Overrides ("OverrideID" row): one override per row below it, to the last row used.
 *   Labels are every non-blank cell from the first label to the right edge of that row
 *   (blank cells, e.g. a merged label's extra cells, are skipped), so don't put another
 *   table beside one; labels the code doesn't use (e.g. Schedule) are ignored.
 *   Built so far (step 1): checkMakeAssignmentLabels. Still to come: previewAssignment,
 *   makeAssignmentAll, createDropdowns1, clearCreationIDs.
 *   Reads labels only, never cell values below them. No student data. Logs counts only.
 * Canvas endpoints called: none. Canvas write operations: none (so far).
 * Required User/Script Properties: none (so far).
 */

const MAKE_ASSIGNMENT_TABLES = Object.freeze([
  {
    key: 'item',
    name: 'Item (first row)',
    labels: ['canvasID', 'name', 'points_possible', 'Due Date', 'Due Time', 'Unlock At',
      'Unlock Time', 'Lock At', 'Lock Time'],
  },
  {
    key: 'itemMore',
    name: 'Item (second row)',
    labels: ['Canvas URL', 'Type of Submission', 'Type', 'Published', 'Google Link Text:',
      'Document URL:', 'Instructions:', 'Status', 'Payload'],
  },
  {
    key: 'overrides',
    name: 'Overrides',
    labels: ['OverrideID', 'Section ID', 'Period', 'Due Date', 'Due Time', 'Unlock At',
      'Unlock Time', 'Lock At', 'Lock Time', 'Status', 'Payload'],
  },
].map(table => Object.freeze(table)));

/** Adds this file's menu items. Called by onOpen. */
function addMakeAssignmentMenuItems_(menu) {
  menu.addSeparator();
  menu.addItem('Check makeAssignment labels (this tab)', 'checkMakeAssignmentLabels');
}

/** Button / menu: checks the labels of the makeAssignment tab being viewed. */
function checkMakeAssignmentLabels() {
  const ui = SpreadsheetApp.getUi();
  try {
    const sheet = SpreadsheetApp.getActiveSheet();
    const layout = findMakeAssignmentLayout_(readLabelGrid_(sheet));
    console.log(`Check makeAssignment labels: ${layout.problemCount} problem(s).`);
    ui.alert('Check makeAssignment labels', `Tab: ${sheet.getName()}\n\n` +
      describeMakeAssignmentLayout_(layout), ui.ButtonSet.OK);
  } catch (error) {
    reportRefreshFailure_('Check makeAssignment labels', 'Nothing was changed.', error);
  }
}

/** The displayed text of every used cell on the tab, as a grid of trimmed strings. */
function readLabelGrid_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (!lastRow || !lastColumn) return [];
  return sheet.getRange(1, 1, lastRow, lastColumn).getDisplayValues()
    .map(row => row.map(value => String(value).trim()));
}

/**
 * Finds each table in the grid. Returns { tables: { key → table }, problemCount }, where
 * each table is { name, firstLabel, headerRow, columns: Map(label → column), missing,
 * duplicates, ignored, problems } (rows and columns 1-based; headerRow 0 if not found).
 * Overrides also get firstDataRow and lastDataRow.
 */
function findMakeAssignmentLayout_(grid) {
  const tables = {};
  let problemCount = 0;
  MAKE_ASSIGNMENT_TABLES.forEach(spec => {
    const table = findLabelRow_(grid, spec);
    problemCount += table.problems.length;
    tables[spec.key] = table;
  });

  const overrides = tables.overrides;
  if (overrides.headerRow) {
    overrides.firstDataRow = overrides.headerRow + 1;
    overrides.lastDataRow = grid.length;
    if (overrides.lastDataRow < overrides.firstDataRow) {
      overrides.problems.push('there are no rows below the Overrides labels.');
      problemCount++;
    }
  }
  [tables.item, tables.itemMore].forEach(table => {
    if (table.headerRow && table.headerRow >= grid.length) {
      table.problems.push(`there is no row below row ${table.headerRow} for its values.`);
      problemCount++;
    }
  });
  return { tables, problemCount };
}

/** Finds one table's label row by its first label and checks its labels. */
function findLabelRow_(grid, spec) {
  const firstLabel = spec.labels[0];
  const table = { name: spec.name, firstLabel, headerRow: 0, columns: new Map(),
    missing: [], duplicates: [], ignored: [], problems: [] };

  const hits = [];
  grid.forEach((row, r) => row.forEach((value, c) => {
    if (value === firstLabel) hits.push({ row: r, column: c });
  }));
  if (!hits.length) {
    table.problems.push(`no cell says "${firstLabel}".`);
    return table;
  }
  if (hits.length > 1) {
    table.problems.push(`"${firstLabel}" appears ${hits.length} times ` +
      `(${hits.map(hit => cellName_(hit.row + 1, hit.column + 1)).join(', ')}); ` +
      'it must appear once.');
    return table;
  }

  const { row, column } = hits[0];
  table.headerRow = row + 1;
  const labelRow = grid.slice(row, row + 1)[0];
  const seen = new Set();
  for (let c = column; c < labelRow.length; c++) {
    const label = labelRow.slice(c, c + 1)[0];
    if (!label) continue; // e.g. the extra cells of a merged "Instructions:" label
    if (seen.has(label)) {
      if (!table.duplicates.includes(label)) table.duplicates.push(label);
      continue;
    }
    seen.add(label);
    if (spec.labels.includes(label)) table.columns.set(label, c + 1);
    else table.ignored.push(label);
  }
  table.missing = spec.labels.filter(label => !table.columns.has(label));
  if (table.missing.length) {
    table.problems.push(`missing ${table.missing.map(label => `"${label}"`).join(', ')}.`);
  }
  if (table.duplicates.length) {
    table.problems.push(`appears twice: ${table.duplicates.map(l => `"${l}"`).join(', ')}.`);
  }
  return table;
}

/** A plain-language summary of the layout for the alert. */
function describeMakeAssignmentLayout_(layout) {
  const lines = MAKE_ASSIGNMENT_TABLES.map(spec => {
    const table = layout.tables[spec.key];
    if (table.problems.length && !table.headerRow) {
      return `✗ ${table.name}: ${table.problems.join(' ')}`;
    }
    let line = `${table.problems.length ? '✗' : '✓'} ${table.name}: labels in row ` +
      `${table.headerRow}`;
    if (table.problems.length) line += `; ${table.problems.join(' ')}`;
    else line += `, all ${spec.labels.length} found.`;
    if (table.firstDataRow && table.lastDataRow >= table.firstDataRow) {
      line += `\n   Override rows: ${table.firstDataRow}–${table.lastDataRow}.`;
    }
    if (table.ignored.length) line += `\n   Not used by the code: ${table.ignored.join(', ')}.`;
    return line;
  });
  return lines.join('\n\n') + (layout.problemCount ?
    '\n\nLabels must match exactly, including capitals and colons.' :
    '\n\nThis tab is ready for makeAssignment.');
}

/** "C12" from a 1-based row and column. */
function cellName_(row, column) {
  let letters = '';
  for (let n = column; n > 0; n = Math.floor((n - 1) / 26)) {
    letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
  }
  return letters + row;
}
