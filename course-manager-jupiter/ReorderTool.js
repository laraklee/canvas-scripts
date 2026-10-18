/**
 * ReorderTool.js
 * Purpose: the "Assignment Order" tool sheet for reordering assignments within their
 *   groups. Step 4a: "Open reorder tool" (refreshes ref_assignmentGroups, then rebuilds
 *   the tool sheet), "Number selected rows 1, 2, 3…" (ported from the legacy
 *   fillSelectedRangeSequentially), and "Preview reorder" (shows what would change,
 *   sends nothing). Push comes in step 4b.
 *   Each assignment's group always comes from ref_assignmentGroups by Assignment ID,
 *   never from the tool sheet, so the tool can never move an assignment to another group.
 *   Logs counts only.
 * Canvas endpoints called: GET /api/v1/courses/:course/assignment_groups (through
 *   writeAssignmentGroupsSheet_ in RefSheets.js).
 * Canvas write operations: none yet.
 * Required User/Script Properties: User Properties CANVAS_BASE_URL and CANVAS_TOKEN
 *   (read by canvasGet_).
 */

const ORDER_HEADERS = Object.freeze(['Group', 'Assignment', 'Due Date', 'Current Position',
  'New Position', 'Assignment ID']);
// The first layout (before Due Date was added). Open reorder tool rebuilds it in place.
const ORDER_HEADERS_BEFORE_DUE_DATE = Object.freeze(['Group', 'Assignment',
  'Current Position', 'New Position', 'Assignment ID']);
const ORDER_DUE_DATE_COLUMN = 3;
const ORDER_NEW_POSITION_COLUMN = 5;
const ORDER_DUE_DATE_FORMAT = 'ddd m/d/yyyy h:mm am/pm';
const ORDER_READ_ONLY_COLOR = '#eeeeee';
const ORDER_INPUT_COLOR = '#fff2cc';
const ORDER_PREVIEW_LINES = 10;

/** Adds this file's menu items. Called by onOpen. */
function addReorderToolMenuItems_(menu) {
  menu.addSeparator();
  menu.addItem('Open reorder tool', 'openReorderTool');
  menu.addItem('Number selected rows 1, 2, 3…', 'numberSelectedRows');
  menu.addItem('Preview reorder', 'previewReorder');
}

/**
 * Menu: Course Manager › Open reorder tool.
 * Refreshes ref_assignmentGroups from Canvas, then rebuilds Assignment Order with one row
 * per assignment, sorted by group order and current position, New Position blank.
 * Asks first if New Position entries would be cleared.
 */
function openReorderTool() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  try {
    const existing = ss.getSheetByName(TOOL_SHEETS.ASSIGNMENT_ORDER);
    if (existing) {
      try {
        checkHeaderLayout_(existing, ORDER_HEADERS);
      } catch {
        checkHeaderLayout_(existing, ORDER_HEADERS_BEFORE_DUE_DATE);
      }
      const typed = readOrderSheet_().filter(row => !isBlank_(row.newPosition)).length;
      if (typed > 0) {
        const answer = ui.alert('Open reorder tool',
          `${typed} New Position entr${typed === 1 ? 'y has' : 'ies have'} not been pushed. ` +
          'Rebuilding the sheet clears them.\n\nRebuild anyway?', ui.ButtonSet.YES_NO);
        if (answer !== ui.Button.YES) return;
      }
    }

    writeAssignmentGroupsSheet_(ss);
    const rows = readAssignmentGroups_().map(a =>
      [a.groupName, a.name, toDueDate_(a.dueAt), a.position, '', a.assignmentId]);

    const sheet = existing || ss.insertSheet(TOOL_SHEETS.ASSIGNMENT_ORDER);
    const existingFilter = sheet.getFilter();
    if (existingFilter) existingFilter.remove();
    sheet.getRange(1, 1, 1, ORDER_HEADERS.length)
      .setValues([ORDER_HEADERS.slice()]).setFontWeight('bold');
    replaceDataRows_(sheet, rows, ORDER_HEADERS.length);
    sheet.getRange(2, 1, sheet.getMaxRows() - 1, ORDER_HEADERS.length).setBackground(null);
    if (rows.length) {
      sheet.getRange(2, 1, rows.length, ORDER_HEADERS.length).setBackground(ORDER_READ_ONLY_COLOR);
      sheet.getRange(2, ORDER_NEW_POSITION_COLUMN, rows.length, 1).setBackground(ORDER_INPUT_COLOR);
      sheet.getRange(2, ORDER_DUE_DATE_COLUMN, rows.length, 1).setNumberFormat(ORDER_DUE_DATE_FORMAT);
      sheet.getRange(1, 1, rows.length + 1, ORDER_HEADERS.length).createFilter();
    }
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, ORDER_HEADERS.length);
    sheet.activate();

    console.log(`Open reorder tool: ${rows.length} assignment row(s) written.`);
    ss.toast(`${rows.length} assignment(s) listed. Type new positions in the yellow column, ` +
      'then use Preview reorder.', 'Open reorder tool', 8);
  } catch (error) {
    reportRefreshFailure_('Open reorder tool', 'The reorder tool did not finish.', error);
  }
}

/**
 * Menu: Course Manager › Number selected rows 1, 2, 3…
 * Fills the selected New Position cells on Assignment Order with 1, 2, 3… from top to
 * bottom. Ported from the legacy fillSelectedRangeSequentially, limited to that column.
 */
function numberSelectedRows() {
  const ui = SpreadsheetApp.getUi();
  try {
    const range = SpreadsheetApp.getActiveRange();
    const sheet = range ? range.getSheet() : null;
    if (!sheet || sheet.getName() !== TOOL_SHEETS.ASSIGNMENT_ORDER ||
        range.getColumn() !== ORDER_NEW_POSITION_COLUMN || range.getNumColumns() !== 1 ||
        range.getRow() < 2) {
      ui.alert('Number selected rows',
        `Select cells in the New Position column (the yellow column) on ` +
        `${TOOL_SHEETS.ASSIGNMENT_ORDER}, below the header, then try again.`, ui.ButtonSet.OK);
      return;
    }
    const numbers = Array.from({ length: range.getNumRows() }, (_, i) => [i + 1]);
    range.setValues(numbers);
    SpreadsheetApp.getActiveSpreadsheet()
      .toast(`${numbers.length} cell(s) numbered.`, 'Number selected rows', 3);
  } catch (error) {
    console.error('Number selected rows failed: ' + error.message);
    ui.alert('Number selected rows could not finish: ' + error.message);
  }
}

/**
 * Menu: Course Manager › Preview reorder.
 * Compares the New Position entries with ref_assignmentGroups and shows which groups
 * would change and how many moves each needs. Sends nothing to Canvas.
 */
function previewReorder() {
  const ui = SpreadsheetApp.getUi();
  try {
    const plan = planReorder_(readOrderSheet_(), readAssignmentGroups_());
    console.log(`Preview reorder: ${plan.changes.length} group(s) would change, ` +
      `${countMoves_(plan)} move(s), ${plan.problems.length} problem(s).`);
    ui.alert('Preview reorder', formatPlan_(plan) + '\n\nNothing was sent to Canvas.',
      ui.ButtonSet.OK);
  } catch (error) {
    reportRefreshFailure_('Preview reorder', 'Nothing was sent to Canvas.', error);
  }
}

/**
 * Reads Assignment Order as a list of { assignmentId, newPosition }, finding columns by
 * header name (so sorting or moving columns is fine).
 */
function readOrderSheet_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TOOL_SHEETS.ASSIGNMENT_ORDER);
  if (!sheet) {
    throw sheetProblem_(`${TOOL_SHEETS.ASSIGNMENT_ORDER} is missing. Run Open reorder tool.`);
  }
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  const header = values[0];
  const column = name => {
    const index = header.indexOf(name);
    if (index === -1) {
      throw sheetProblem_(`${TOOL_SHEETS.ASSIGNMENT_ORDER} has no "${name}" column. ` +
        'Run Open reorder tool.');
    }
    return index;
  };
  const col = { id: column('Assignment ID'), newPosition: column('New Position') };
  return values.slice(1)
    .map(row => ({
      assignmentId: String(row[col.id]).replace(/\.0$/, '').trim(),
      newPosition: row[col.newPosition],
    }))
    .filter(row => row.assignmentId !== '');
}

/**
 * Works out the changes per group. A typed New Position is that assignment's exact final
 * slot in its group (typing 1-5 on five rows makes them exactly 1-5). Blank rows fill the
 * remaining slots in their current order. Duplicates, non-whole numbers, or numbers larger
 * than the group skip that group. Moves are listed top to bottom and only for
 * assignments that need to move, except when the group's Canvas numbering is messy
 * (not exactly 1, 2, 3…): then every assignment in the group gets its new position.
 * Groups with no typed numbers are never changed.
 * Returns { changes: [{ groupId, groupName, moves: [{ assignmentId, position }],
 *   renumberAll, newOrder: ['1. name', ...], hiddenLines }], unchangedGroups,
 *   problems: [{ groupName, reason }] }.
 */
function planReorder_(orderRows, refRows) {
  const refById = new Map(refRows.map(row => [row.assignmentId, row]));
  const groups = new Map();
  refRows.forEach(row => {
    if (!groups.has(row.groupId)) {
      groups.set(row.groupId, { groupName: row.groupName, members: [], typed: new Map() });
    }
    groups.get(row.groupId).members.push(row);
  });

  const problems = [];
  const badGroups = new Set();
  const seen = new Set();
  let unknown = 0;
  orderRows.forEach(row => {
    const ref = refById.get(row.assignmentId);
    if (!ref) {
      if (!isBlank_(row.newPosition)) unknown++;
      return;
    }
    const group = groups.get(ref.groupId);
    if (seen.has(row.assignmentId)) {
      badGroups.add(ref.groupId);
      problems.push({ groupName: group.groupName, reason: 'an assignment is listed twice' });
      return;
    }
    seen.add(row.assignmentId);
    if (isBlank_(row.newPosition)) return;
    const position = Number(row.newPosition);
    if (!Number.isInteger(position) || position < 1) {
      badGroups.add(ref.groupId);
      problems.push({ groupName: group.groupName,
        reason: 'New Position must be a whole number, 1 or more' });
      return;
    }
    group.typed.set(row.assignmentId, position);
  });
  if (unknown) {
    problems.push({ groupName: '(no group)', reason: `${unknown} row(s) with a New Position ` +
      'are not in the latest Canvas list. Run Open reorder tool again.' });
  }

  const changes = [];
  let unchangedGroups = 0;
  groups.forEach((group, groupId) => {
    const size = group.members.length;
    const typedNumbers = Array.from(group.typed.values());
    if (new Set(typedNumbers).size !== typedNumbers.length) {
      badGroups.add(groupId);
      problems.push({ groupName: group.groupName, reason: 'two rows have the same New Position' });
    }
    if (typedNumbers.some(position => position > size)) {
      badGroups.add(groupId);
      problems.push({ groupName: group.groupName,
        reason: `a New Position is larger than the group's ${size} assignment(s)` });
    }
    if (badGroups.has(groupId)) return;
    if (!group.typed.size) {
      unchangedGroups++;
      return;
    }

    const currentMembers = group.members
      .map((member, index) => ({ member, index }))
      .sort((a, b) => (a.member.position - b.member.position) || (a.index - b.index))
      .map(entry => entry.member);
    const current = currentMembers.map(member => member.assignmentId);
    // Canvas numbering is "messy" when it is not exactly 1, 2, 3… (duplicates or gaps).
    const messy = currentMembers.some((member, slot) => member.position !== slot + 1);
    // Typed rows take their exact slots; the rest fill the gaps in their current order.
    const typedBySlot = new Map(Array.from(group.typed, ([assignmentId, slot]) => [slot, assignmentId]));
    const untyped = current.filter(assignmentId => !group.typed.has(assignmentId));
    const desired = Array.from({ length: size }, (_, i) => typedBySlot.get(i + 1) ?? untyped.shift());

    // Walk top to bottom; each move puts the right assignment into that slot.
    const working = current.slice();
    let moves = [];
    desired.forEach((assignmentId, slot) => {
      const from = working.indexOf(assignmentId);
      if (from === slot) return;
      working.splice(from, 1);
      working.splice(slot, 0, assignmentId);
      moves.push({ assignmentId, position: slot + 1 });
    });
    // If the order changes and Canvas numbering is messy, renumber the whole group
    // 1…N in the new order instead of relying on Canvas to shift the others.
    if (moves.length && messy) {
      moves = desired.map((assignmentId, slot) => ({ assignmentId, position: slot + 1 }));
    }
    if (moves.length) {
      // For Preview: the new order from the first changed slot to the last, capped.
      const changedSlots = desired
        .map((assignmentId, slot) => (current.indexOf(assignmentId) !== slot ? slot : -1))
        .filter(slot => slot >= 0);
      const first = Math.min(...changedSlots);
      const lines = desired.slice(first, Math.max(...changedSlots) + 1)
        .map((assignmentId, k) => `${first + k + 1}. ${refById.get(assignmentId).name}`);
      changes.push({ groupId, groupName: group.groupName, moves, renumberAll: messy,
        newOrder: lines.slice(0, ORDER_PREVIEW_LINES),
        hiddenLines: Math.max(0, lines.length - ORDER_PREVIEW_LINES) });
    } else {
      unchangedGroups++;
    }
  });
  return { changes, unchangedGroups, problems };
}

function countMoves_(plan) {
  return plan.changes.reduce((total, change) => total + change.moves.length, 0);
}

/**
 * Alert text for a plan: group names, counts, and each changing group's new order
 * (assignment names). Never logged.
 */
function formatPlan_(plan) {
  const parts = [];
  const stamp = SpreadsheetApp.getActiveSpreadsheet().getRangeByName(ASSIGNMENT_GROUPS_REFRESHED.name);
  if (stamp && stamp.getValue() instanceof Date) {
    parts.push('Based on Canvas as of ' + stamp.getDisplayValue() + '.');
  }
  if (plan.changes.length) {
    parts.push(`${plan.changes.length} group(s) would change (${countMoves_(plan)} move(s)):`);
    plan.changes.forEach(c => {
      const how = c.renumberAll ?
        `numbering has duplicates or gaps; all ${c.moves.length} will be renumbered` :
        `${c.moves.length} move(s)`;
      parts.push(`• ${c.groupName}: ${how}. New order:\n    ` +
        c.newOrder.join('\n    ') +
        (c.hiddenLines ? `\n    …and ${c.hiddenLines} more` : ''));
    });
  } else {
    parts.push('No groups would change.');
  }
  parts.push(`${plan.unchangedGroups} group(s) unchanged.`);
  if (plan.problems.length) {
    parts.push('Problems (these groups will be skipped):\n• ' +
      plan.problems.map(p => `${p.groupName}: ${p.reason}`).join('\n• '));
  }
  return parts.join('\n\n');
}

/** A due date for the sheet: a real date (shown in the Sheet's time zone), or blank. */
function toDueDate_(value) {
  if (value instanceof Date) return value;
  if (isBlank_(value)) return '';
  const date = new Date(value);
  return isNaN(date.getTime()) ? '' : date;
}

function isBlank_(value) {
  return value === '' || value === null || value === undefined;
}
