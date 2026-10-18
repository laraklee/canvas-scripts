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
 *   - checkMakeAssignmentLabels: checks the labels of the tab being viewed.
 *   - previewAssignment: fills Payload and Status for the item and each override row with
 *     what would be sent; never sends anything. The item is planned like a createByRow
 *     row (same request builders; Type of Submission sets submission_types for Type A).
 *     An item with a canvasID isn't created again; only overrides without an OverrideID
 *     are planned. An override row needs a numeric Section ID and a Due Date; blank rows
 *     are skipped. Blank times: Due and Lock 11:59 PM, Unlock 12:00 AM.
 *   Still to come: makeAssignmentAll, createDropdowns1, clearCreationIDs.
 *   No student data is read or written. Logs counts only.
 * Canvas endpoints called: none. Canvas write operations: none (so far).
 * Required User/Script Properties: none so far. Named ranges: cfg_CourseID.
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

// Canvas's allowed submission_types (Type A only; D, CQ, and NQ set their own).
const MAKE_ASSIGNMENT_SUBMISSION_TYPES = Object.freeze(['online_upload', 'online_text_entry',
  'online_url', 'media_recording', 'student_annotation', 'on_paper', 'none',
  'external_tool']);

/** Adds this file's menu items. Called by onOpen. */
function addMakeAssignmentMenuItems_(menu) {
  menu.addSeparator();
  menu.addItem('Preview assignment (this tab)', 'previewAssignment');
  menu.addItem('Check makeAssignment labels (this tab)', 'checkMakeAssignmentLabels');
}

/**
 * Button / menu: Preview. Fills Payload and Status for the item and each override row
 * with what makeAll would send. Never sends anything, whatever the dry-run setting.
 */
function previewAssignment() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  try {
    const job = readMakeAssignment_(ss);
    const { item, overrides } = job.plan;
    if (item.request) {
      job.writeItem('Payload', JSON.stringify(item.request.payload));
      job.writeItem('Status', `Preview (${item.label}): not sent`);
    } else {
      job.writeItem('Status', item.message);
    }
    const target = item.canvasId || 'new item';
    let ready = 0;
    overrides.forEach(plan => {
      if (plan.payload) {
        ready++;
        job.writeOverride(plan, 'Payload', JSON.stringify(plan.payload));
        job.writeOverride(plan, 'Status', `Preview: not sent (for ${target})`);
      } else {
        job.writeOverride(plan, 'Status', plan.message);
      }
    });
    console.log(`Preview assignment: item ${item.request ? 'ready' : 'not ready'}, ` +
      `${ready} of ${overrides.length} override(s) ready.`);
    ss.toast(`Item: ${item.request ? 'ready' : 'see Status'}. Overrides: ${ready} ready, ` +
      `${overrides.length - ready} skipped or with a problem. Nothing was sent.`,
      'Preview assignment', 8);
  } catch (error) {
    reportRefreshFailure_('Preview assignment', 'Nothing was sent.', error);
  }
}

/**
 * Reads the tab being viewed and plans the item and its overrides:
 * { plan: { item, overrides }, writeItem(label, value), writeOverride(plan, label, value) }.
 */
function readMakeAssignment_(ss) {
  const sheet = ss.getActiveSheet();
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (!lastRow || !lastColumn) throw sheetProblem_('This tab is empty.');
  const range = sheet.getRange(1, 1, lastRow, lastColumn);
  const values = range.getValues();
  const shown = range.getDisplayValues().map(row => row.map(value => String(value).trim()));
  const layout = findMakeAssignmentLayout_(shown);
  if (layout.problemCount) {
    throw sheetProblem_(`This tab's labels have ${layout.problemCount} problem(s). Use ` +
      'Course Manager › Check makeAssignment labels (this tab).');
  }
  const plan = planMakeAssignment_(layout, values, shown, getCourseIdForRefresh_(),
    ss.getSpreadsheetTimeZone());
  const { itemMore, overrides } = layout.tables;
  return {
    plan,
    // Status and Payload for the item are in the second item row.
    writeItem: (label, value) => sheet.getRange(itemMore.headerRow + 1,
      itemMore.columns.get(label)).setValue(value),
    writeOverride: (overridePlan, label, value) => sheet.getRange(overridePlan.rowNumber,
      overrides.columns.get(label)).setValue(value),
  };
}

/**
 * Plans the item and every override row from the tab's values (cells) and displayed text
 * (shown), both full-tab grids. Returns { item, overrides }:
 * - item: { type, label, request? (createByRow's request for its type), canvasId? (when
 *   already created), message? (when not sending) }.
 * - overrides: [{ rowNumber, sectionId, payload?, message? }], blank rows left out.
 *   Each override is sent to overridePath_(courseId, the item's canvasID).
 */
function planMakeAssignment_(layout, values, shown, courseId, timeZone) {
  const { item, itemMore, overrides } = layout.tables;
  const at = (grid, row, column) => grid.slice(row - 1, row)[0].slice(column - 1, column)[0];
  const itemTable = label => (item.columns.has(label) ? item : itemMore);
  const itemCell = label => {
    const table = itemTable(label);
    return at(values, table.headerRow + 1, table.columns.get(label));
  };
  const itemText = label => {
    const table = itemTable(label);
    return at(shown, table.headerRow + 1, table.columns.get(label));
  };

  const overridePlans = [];
  const seenSections = new Map();
  for (let row = overrides.firstDataRow; row <= overrides.lastDataRow; row++) {
    const cell = label => at(values, row, overrides.columns.get(label));
    const text = label => at(shown, row, overrides.columns.get(label));
    const plan = planOverride_(row, cell, text, timeZone, seenSections);
    if (plan) overridePlans.push(plan);
  }
  return { item: planMakeAssignmentItem_(itemCell, itemText, courseId, timeZone),
    overrides: overridePlans };
}

/** Plans the item, the same way as a createByRow row, plus Type of Submission for A. */
function planMakeAssignmentItem_(cell, text, courseId, timeZone) {
  const name = text('name');
  const type = text('Type').toUpperCase();
  const plan = { type: type || '?', label: type || '?' };
  const canvasId = text('canvasID');
  if (canvasId) {
    return Object.assign(plan, { canvasId,
      message: 'Already created; only overrides without an OverrideID will be made' });
  }
  if (!name) return Object.assign(plan, { message: 'Not ready: no name' });
  if (!CREATE_BY_ROW_KNOWN_TYPES.includes(type)) {
    return Object.assign(plan, { message: type ?
      `Not ready: Type "${type}" is not A, D, NQ, or CQ` : 'Not ready: no Type' });
  }
  try {
    const time = (dateLabel, timeLabel, what, blankTime) => buildCanvasTime_(cell(dateLabel),
      text(timeLabel), timeZone, what, blankTime);
    const fields = {
      name,
      points: cell('points_possible'),
      dueAt: time('Due Date', 'Due Time', 'Due', BLANK_TIME_END_OF_DAY),
      unlockAt: time('Unlock At', 'Unlock Time', 'Unlock', BLANK_TIME_START_OF_DAY),
      lockAt: time('Lock At', 'Lock Time', 'Lock', BLANK_TIME_END_OF_DAY),
      description: buildDescription_(text('Instructions:'), text('Document URL:'),
        text('Google Link Text:')),
      published: parsePublished_(cell('Published')),
    };
    if (type === 'A') fields.submissionTypes = parseSubmissionTypes_(text('Type of Submission'));
    if (!fields.published) plan.label = type === 'NQ' ? 'NQ, Published ignored' : `${type}, draft`;
    return Object.assign(plan, { request: requestForType_(type, fields, courseId) });
  } catch (error) {
    if (!error.isSheetProblem) throw error;
    return Object.assign(plan, { message: 'Not ready: ' + error.message });
  }
}

/**
 * "online_upload, online_text_entry" (a multi-choice dropdown's text) → a list; blank →
 * undefined, so the assignment builder uses its default (online_upload).
 */
function parseSubmissionTypes_(textValue) {
  const chosen = String(textValue).split(',').map(part => part.trim()).filter(Boolean);
  if (!chosen.length) return undefined;
  const unknown = chosen.filter(choice => !MAKE_ASSIGNMENT_SUBMISSION_TYPES.includes(choice));
  if (unknown.length) {
    throw sheetProblem_(`Type of Submission "${unknown.join(', ')}" is not a Canvas ` +
      'submission type');
  }
  return chosen;
}

/**
 * Plans one override row. Returns null for a blank row (no Section ID and no Due Date),
 * { payload } when ready, or { message } when not. seenSections catches a section used
 * twice (Canvas allows one override per section).
 */
function planOverride_(rowNumber, cell, text, timeZone, seenSections) {
  const sectionId = text('Section ID');
  const dueDate = cell('Due Date');
  if (!sectionId && isBlank_(dueDate)) return null;
  const plan = { rowNumber, sectionId };
  if (text('OverrideID')) return Object.assign(plan, { message: 'Skipped: already has an OverrideID' });
  if (!/^\d+$/.test(sectionId)) {
    return Object.assign(plan, { message: sectionId ?
      'Not ready: Section ID must be a number' : 'Not ready: no Section ID' });
  }
  if (seenSections.has(sectionId)) {
    return Object.assign(plan, {
      message: `Not ready: same Section ID as row ${seenSections.get(sectionId)}` });
  }
  seenSections.set(sectionId, rowNumber);
  if (isBlank_(dueDate)) return Object.assign(plan, { message: 'Not ready: no Due Date' });
  try {
    const time = (dateLabel, timeLabel, what, blankTime) => buildCanvasTime_(cell(dateLabel),
      text(timeLabel), timeZone, what, blankTime);
    const dates = {
      dueAt: time('Due Date', 'Due Time', 'Due', BLANK_TIME_END_OF_DAY),
      unlockAt: time('Unlock At', 'Unlock Time', 'Unlock', BLANK_TIME_START_OF_DAY),
      lockAt: time('Lock At', 'Lock Time', 'Lock', BLANK_TIME_END_OF_DAY),
    };
    return Object.assign(plan, {
      payload: { assignment_override: addDates_({ course_section_id: Number(sectionId) }, dates) },
    });
  } catch (error) {
    if (!error.isSheetProblem) throw error;
    return Object.assign(plan, { message: 'Not ready: ' + error.message });
  }
}

/** Where an override is sent: the item's assignment (for D, CQ, NQ too: their assignment ID). */
function overridePath_(courseId, assignmentId) {
  return `/courses/${courseId}/assignments/${assignmentId}/overrides`;
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
