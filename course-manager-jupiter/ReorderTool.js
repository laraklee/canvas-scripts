/**
 * ReorderTool.js
 * Purpose: the "Assignment Order" tool sheet for reordering assignments within their
 *   groups. Step 4a: "Open reorder tool" (refreshes ref_assignmentGroups, then rebuilds
 *   the tool sheet), "Number selected rows 1, 2, 3…" (ported from the legacy
 *   fillSelectedRangeSequentially; counts separately per group, skips hidden rows),
 *   "Preview reorder" (shows what would change, sends nothing), and "Push reorder"
 *   (sends the changes, then checks them in Canvas).
 *   Each assignment's group always comes from ref_assignmentGroups by Assignment ID,
 *   never from the tool sheet, so the tool can never move an assignment to another group.
 *   Logs counts only.
 * Canvas endpoints called: GET /api/v1/courses/:course/assignment_groups (through
 *   writeAssignmentGroupsSheet_ in RefSheets.js).
 * Canvas write operations: Push reorder only, through canvasWrite_ (so DRY_RUN applies):
 *   PUT /api/v1/courses/:course/assignments/:id with assignment[position] only. It changes
 *   the order of assignments within their group; never the group, grades, or anything
 *   else, and never sends notify_of_update.
 * Required User/Script Properties: User Properties CANVAS_BASE_URL and CANVAS_TOKEN
 *   (read by canvasGet_ and canvasWrite_); Script Property DRY_RUN (read by canvasWrite_).
 */

// Group ID (G) is for Lara to see only (e.g. two groups with the same name). The code
// always finds an assignment's group in ref_assignmentGroups by Assignment ID.
const ORDER_HEADERS = Object.freeze(['Group', 'Assignment', 'Due Date', 'Current Position',
  'New Position', 'Assignment ID', 'Group ID']);
// Earlier layouts. Open reorder tool rebuilds them in place with ORDER_HEADERS.
const ORDER_PREVIOUS_LAYOUTS = Object.freeze([
  ['Group', 'Assignment', 'Current Position', 'New Position', 'Assignment ID'],
  ['Group', 'Assignment', 'Due Date', 'Current Position', 'New Position', 'Assignment ID'],
]);
const ORDER_DUE_DATE_COLUMN = 3;
const ORDER_NEW_POSITION_COLUMN = 5;
const ORDER_DUE_DATE_FORMAT = 'ddd m/d/yyyy h:mm am/pm';
const ORDER_READ_ONLY_COLOR = '#eeeeee';
const ORDER_INPUT_COLOR = '#fff2cc';
const ORDER_PREVIEW_LINES = 10;
// Apps Script stops a run at 6 minutes; Push stops sending before then.
const PUSH_TIME_LIMIT_MS = 5 * 60 * 1000;

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
      const knownLayout = [ORDER_HEADERS, ...ORDER_PREVIOUS_LAYOUTS].some(headers => {
        try {
          checkHeaderLayout_(existing, headers);
          return true;
        } catch {
          return false;
        }
      });
      if (!knownLayout) checkHeaderLayout_(existing, ORDER_HEADERS); // throws the clear message
      const typed = readOrderSheet_().filter(row => !isBlank_(row.newPosition)).length;
      if (typed > 0) {
        const answer = ui.alert('Open reorder tool',
          `${typed} New Position entr${typed === 1 ? 'y has' : 'ies have'} not been pushed. ` +
          'Rebuilding the sheet clears them.\n\nRebuild anyway?', ui.ButtonSet.YES_NO);
        if (answer !== ui.Button.YES) return;
      }
    }

    writeAssignmentGroupsSheet_(ss);
    const count = buildOrderSheet_(ss);

    console.log(`Open reorder tool: ${count} assignment row(s) written.`);
    ss.toast(`${count} assignment(s) listed. Type new positions in the yellow column, ` +
      'then use Preview reorder.', 'Open reorder tool', 8);
  } catch (error) {
    reportRefreshFailure_('Open reorder tool', 'The reorder tool did not finish.', error);
  }
}

/**
 * Rebuilds Assignment Order from ref_assignmentGroups as it is now (no Canvas request),
 * with New Position blank. Used by Open reorder tool and after a verified Push.
 * Returns the number of assignment rows.
 */
function buildOrderSheet_(ss) {
  const rows = readAssignmentGroups_().map(a =>
    [a.groupName, a.name, toDueDate_(a.dueAt), a.position, '', a.assignmentId, a.groupId]);

  const sheet = ss.getSheetByName(TOOL_SHEETS.ASSIGNMENT_ORDER) ||
    ss.insertSheet(TOOL_SHEETS.ASSIGNMENT_ORDER);
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
  return rows.length;
}

/**
 * Menu: Course Manager › Number selected rows 1, 2, 3…
 * Fills the selected New Position cells on Assignment Order from top to bottom, counting
 * 1, 2, 3… separately for each group (found by Assignment ID in ref_assignmentGroups).
 * So sorting the whole sheet by Due Date and numbering every row gives each group its
 * own 1…N in due-date order. Rows hidden by a filter (or hidden by hand) are skipped and
 * keep what they had. Ported from the legacy fillSelectedRangeSequentially.
 */
function numberSelectedRows() {
  const ui = SpreadsheetApp.getUi();
  try {
    const range = SpreadsheetApp.getActiveRange();
    const sheet = range ? range.getSheet() : null;
    const onToolSheet = sheet && sheet.getName() === TOOL_SHEETS.ASSIGNMENT_ORDER;
    const lastColumn = onToolSheet ? sheet.getLastColumn() : 0;
    const header = onToolSheet ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0] : [];
    const col = { id: header.indexOf('Assignment ID'), newPosition: header.indexOf('New Position') };
    if (!onToolSheet || range.getColumn() !== col.newPosition + 1 ||
        range.getNumColumns() !== 1 || range.getRow() < 2) {
      ui.alert('Number selected rows',
        `Select cells in the New Position column (the yellow column) on ` +
        `${TOOL_SHEETS.ASSIGNMENT_ORDER}, below the header, then try again.`, ui.ButtonSet.OK);
      return;
    }
    if (col.id === -1) {
      throw sheetProblem_(`${TOOL_SHEETS.ASSIGNMENT_ORDER} has no "Assignment ID" column. ` +
        'Run Open reorder tool.');
    }
    const firstRow = range.getRow();
    const rows = sheet.getRange(firstRow, 1, range.getNumRows(), lastColumn).getValues()
      .map((row, i) => ({
        assignmentId: String(row[col.id]).replace(/\.0$/, '').trim(),
        current: row[col.newPosition],
        skip: sheet.isRowHiddenByFilter(firstRow + i) || sheet.isRowHiddenByUser(firstRow + i),
      }));
    const groupIdById = new Map(readAssignmentGroups_().map(a => [a.assignmentId, a.groupId]));
    numberByGroup_(rows, groupIdById);
    range.setValues(rows.map(row => [row.number ?? row.current]));

    const numberedRows = rows.filter(row => row.number !== undefined);
    const groups = new Set(numberedRows.map(row => groupIdById.get(row.assignmentId))).size;
    const numbered = numberedRows.length;
    const skipped = rows.length - numbered;
    SpreadsheetApp.getActiveSpreadsheet().toast(
      `${numbered} cell(s) numbered in ${groups} group(s)` +
      (skipped ? `; ${skipped} hidden or unknown row(s) skipped.` : '.'),
      'Number selected rows', 5);
  } catch (error) {
    reportRefreshFailure_('Number selected rows', 'No cells were changed.', error);
  }
}

/**
 * Numbers rows top to bottom, counting separately per group. rows is
 * [{ assignmentId, skip }]; sets row.number on each row that is not skipped and whose
 * group is found in groupIdById. Other rows are left without a number.
 */
function numberByGroup_(rows, groupIdById) {
  const counts = new Map();
  rows.forEach(row => {
    const groupId = groupIdById.get(row.assignmentId);
    if (row.skip || groupId === undefined) return;
    const next = (counts.get(groupId) || 0) + 1;
    counts.set(groupId, next);
    row.number = next;
  });
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
 * Menu: Course Manager › Push reorder.
 * Refreshes ref_assignmentGroups, works out the plan from that fresh data, asks for
 * confirmation (showing the dry-run state), then sends each move through canvasWrite_
 * one group at a time: PUT /courses/:course/assignments/:id with assignment[position]
 * only. After a real push, refreshes again and checks which groups now match. If all
 * match, rebuilds Assignment Order; otherwise keeps the New Position numbers so Push can
 * be run again (it only sends what is still out of place). Reports counts and group
 * names only.
 */
function pushReorder() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(1000)) {
    ui.alert('Push reorder', 'Another Push is already running. Wait for it to finish.',
      ui.ButtonSet.OK);
    return;
  }
  try {
    const started = Date.now();
    const courseId = getCourseIdForRefresh_();
    writeAssignmentGroupsSheet_(ss);
    const orderRows = readOrderSheet_();
    const plan = planReorder_(orderRows, readAssignmentGroups_());
    const total = countMoves_(plan);
    if (!plan.changes.length) {
      ui.alert('Push reorder', formatPlan_(plan) + '\n\nNothing to send.', ui.ButtonSet.OK);
      return;
    }

    const dryRun = isDryRun_();
    const answer = ui.alert(dryRun ? 'Push reorder (dry run)' : 'Push reorder',
      formatPlan_(plan) + '\n\n' + (dryRun ?
        `Dry run is ON: nothing will be sent. The ${total} update(s) will only be logged.` :
        `Dry run is OFF: this will send ${total} update(s) in ${plan.changes.length} ` +
          'group(s) to Canvas.') + '\n\nContinue?',
      ui.ButtonSet.YES_NO);
    if (answer !== ui.Button.YES) {
      ui.alert('Push reorder', 'Cancelled. Nothing was sent.', ui.ButtonSet.OK);
      return;
    }

    const sent = sendReorder_(courseId, plan, started);
    const refusedText = sent.refused.size ?
      '\n\nRefused by Canvas (that group stopped): ' +
        Array.from(sent.refused, ([message, n]) => `${n} × ${message}`).join(' ') +
        ' A closed grading period or a locked assignment can cause this.' : '';
    const timeText = sent.timedOut ?
      ` Stopped near the time limit with ${sent.groupsNotStarted} group(s) not started; ` +
        'run Push again to finish.' : '';
    console.log(`Push reorder${dryRun ? ' (dry run)' : ''}: ${sent.count} update(s), ` +
      `${sent.refusedCount} refused, ${plan.changes.length} group(s) planned` +
      (sent.timedOut ? ', stopped at time limit.' : '.'));

    if (dryRun) {
      ui.alert('Push reorder (dry run)', `Dry run: ${sent.count} update(s) in ` +
        `${plan.changes.length} group(s) would have been sent. Nothing was sent.${timeText}` +
        '\n\nSee Extensions › Apps Script › Executions for the "DRY RUN" lines.',
        ui.ButtonSet.OK);
      return;
    }

    // Check the result in Canvas. A group matches when its order no longer differs
    // (a numbering-only tidy-up left over does not count as a mismatch).
    writeAssignmentGroupsSheet_(ss);
    const after = planReorder_(orderRows, readAssignmentGroups_());
    const stillDifferent = after.changes.filter(c => c.newOrder.length);
    const differentIds = new Set(stillDifferent.map(c => c.groupId));
    const matched = plan.changes.filter(c => !differentIds.has(c.groupId)).length;
    // Rebuild (which clears New Position) only when nothing is left to fix.
    const allMatched = matched === plan.changes.length && !sent.timedOut &&
      !plan.problems.length;
    if (allMatched) buildOrderSheet_(ss);
    console.log(`Push reorder check: ${matched} of ${plan.changes.length} group(s) match.`);

    ui.alert('Push reorder',
      `${sent.count} update(s) sent.${refusedText}${timeText}\n\n` +
      `Canvas now matches your order in ${matched} of ${plan.changes.length} group(s).` +
      (stillDifferent.length ? '\nStill different: ' +
        stillDifferent.map(c => c.groupName).join(', ') + '.' : '') +
      (plan.problems.length ? `\n${plan.problems.length} problem(s) were skipped (see Preview).` : '') +
      '\n\n' + (allMatched ?
        'The Assignment Order sheet was rebuilt with the new positions.' :
        'Your New Position numbers were kept. Run Preview to see what is still different, ' +
          'then Push again; it only sends what is still out of place.'),
      ui.ButtonSet.OK);
  } catch (error) {
    reportRefreshFailure_('Push reorder', 'Push stopped. Run Preview to see where things ' +
      'stand; running Push again only sends what is still out of place.', error);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Sends a plan's moves one group at a time through canvasWrite_ (which only logs while
 * dry run is ON). If Canvas refuses a move, that group stops and the next group starts.
 * Stops starting new moves near the time limit.
 * Returns { count, refused: Map(type → n), refusedCount, timedOut, groupsNotStarted }.
 */
function sendReorder_(courseId, plan, started) {
  const result = { count: 0, refused: new Map(), refusedCount: 0, timedOut: false,
    groupsNotStarted: 0 };
  plan.changes.forEach(change => {
    if (result.timedOut) {
      result.groupsNotStarted++;
      return;
    }
    for (const move of change.moves) {
      if (Date.now() - started > PUSH_TIME_LIMIT_MS) {
        result.timedOut = true;
        return;
      }
      try {
        canvasWrite_('PUT', `/courses/${courseId}/assignments/${move.assignmentId}`,
          { assignment: { position: move.position } });
        result.count++;
      } catch (error) {
        // Problems that would hit every group (token, network, busy) stop the whole Push.
        if (!error.canvasType || CANVAS_STOP_ALL_TYPES.includes(error.canvasType)) throw error;
        // error.message names the type and code only, e.g. "...not allowed to do this (403)."
        result.refused.set(error.message, (result.refused.get(error.message) || 0) + 1);
        result.refusedCount++;
        return; // stop this group; the next group still runs
      }
    }
  });
  return result;
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
 * (not exactly 1, 2, 3…): then every assignment in the group gets its new position,
 * also when every row in the group was numbered and the order stays the same (tidy up).
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
    // If Canvas numbering is messy, renumber the whole group 1…N in the new order instead
    // of relying on Canvas to shift the others: when the order changes, or when every
    // assignment in the group was numbered (a "tidy up" even if the order stays the same).
    const fullyNumbered = group.typed.size === size;
    if (messy && (moves.length || fullyNumbered)) {
      moves = desired.map((assignmentId, slot) => ({ assignmentId, position: slot + 1 }));
    }
    if (moves.length) {
      // For Preview: the new order from the first changed slot to the last, capped.
      // Empty when only the numbering is tidied.
      const changedSlots = desired
        .map((assignmentId, slot) => (current.indexOf(assignmentId) !== slot ? slot : -1))
        .filter(slot => slot >= 0);
      const first = changedSlots.length ? Math.min(...changedSlots) : 0;
      const last = changedSlots.length ? Math.max(...changedSlots) : -1;
      const lines = desired.slice(first, last + 1)
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
      if (!c.newOrder.length) {
        parts.push(`• ${c.groupName}: ${how} 1-${c.moves.length}. Order stays the same.`);
        return;
      }
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
