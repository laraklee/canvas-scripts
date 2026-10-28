/**
 * Groups.js
 * Purpose: the three buttons on the createGroups tab (same function names as legacy, so
 *   the copied buttons keep working), plus menu items. Ported from the legacy
 *   clearGroupData, createGroupCategory, and createGroups (no helpers).
 *   Tab layout (kept from legacy): A2 course ID (=cfg_CourseID, shown only; the code reads
 *   cfg_CourseID), C2 group category name (typed), D2 category ID and E2 "Category URL"
 *   link (written by createGroupCategory); from row 5, the "GroupID" and "Group Names"
 *   columns, found by their row 4 headers.
 *   - clearGroupData: clears D2, E2, and the GroupID column, to start a new set. Sheet only.
 *   - createGroupCategory: creates the category named in C2; refuses if D2 already has an
 *     ID (no duplicates).
 *   - createGroups: creates one empty group per name, skipping rows that already have a
 *     GroupID (so a rerun only creates what is missing). Writes each new ID as it goes.
 *   Groups are created empty (no members), so no student data is involved. Both writes ask
 *   first and go through canvasWrite_, so nothing is sent while dry run is ON. Logs counts
 *   only; messages give row numbers and Canvas error types, never Canvas's text.
 *   - pullGroupsForActiveColumn (menu: Canvas Tools › Groups; read-only): on a grading
 *     sheet, the clicked column's row 2 holds a group category ID. Writes each student's
 *     current group name into their row (blank if in no group) and gives the student
 *     cells a dropdown of the set's group names, so names can be picked without typos.
 *     Same row rules and replace-question as Pull scores (planScorePull_, scoreRuns_ in
 *     AssignmentColumn.js). Student IDs stay in the sheet; messages give counts and group
 *     names only.
 * Canvas endpoints called (GET via canvasGet_, Pull groups only):
 *   /api/v1/group_categories/:category
 *   /api/v1/group_categories/:category/groups
 *   /api/v1/groups/:group/users
 * Canvas write operations (via canvasWrite_, so DRY_RUN applies):
 *   POST /api/v1/courses/:course/group_categories with name
 *   POST /api/v1/group_categories/:category/groups with name
 * Required User/Script Properties: User Properties CANVAS_BASE_URL and CANVAS_TOKEN;
 *   Script Property DRY_RUN. Named ranges: cfg_CourseID (cfg_CourseName for messages).
 */

// Cell positions on the createGroups tab (legacy layout).
const GROUPS_CELLS = Object.freeze({
  CATEGORY_NAME: 'C2',
  CATEGORY_ID: 'D2',
  CATEGORY_LINK: 'E2',
});
const GROUPS_HEADER_ROW = 4;
const GROUPS_ID_HEADER = 'GroupID';
const GROUPS_NAME_HEADER = 'Group Names';
const GROUPS_TIME_LIMIT_MS = 5 * 60 * 1000;

/**
 * Button / menu: Clear group data. Clears the category ID and link (D2, E2) and every
 * GroupID below the header, so the tab is ready for a new set. Changes nothing in Canvas;
 * groups already created stay there.
 */
function clearGroupData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  try {
    const sheet = getGroupsSheet_(ss);
    sheet.getRange(GROUPS_CELLS.CATEGORY_ID).clearContent();
    sheet.getRange(GROUPS_CELLS.CATEGORY_LINK).clearContent();
    const table = readGroupsTable_(sheet);
    if (table.rows.length) {
      sheet.getRange(GROUPS_HEADER_ROW + 1, table.idColumn, table.rows.length, 1).clearContent();
    }
    ss.toast('Category ID, link, and group IDs cleared. Nothing was changed in Canvas.',
      'Clear group data', 5);
  } catch (error) {
    reportRefreshFailure_('Clear group data', 'Nothing was cleared.', error);
  }
}

/**
 * Button / menu: Create group category. Creates the category named in C2 in the
 * cfg_CourseID course, then writes its ID to D2 and a link to E2.
 */
function createGroupCategory() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  try {
    const sheet = getGroupsSheet_(ss);
    const name = String(sheet.getRange(GROUPS_CELLS.CATEGORY_NAME).getValue()).trim();
    if (!name) {
      throw sheetProblem_(`Type the group category name in ${GROUPS_CELLS.CATEGORY_NAME} first.`);
    }
    if (!isBlank_(sheet.getRange(GROUPS_CELLS.CATEGORY_ID).getValue())) {
      throw sheetProblem_(`A category was already created (its ID is in ${GROUPS_CELLS.CATEGORY_ID}). ` +
        'To start a new set, use Clear group data first.');
    }
    const courseId = getCourseIdForRefresh_();
    const dryRun = isDryRun_();

    const answer = ui.alert('Create group category',
      `Create the group category "${name}" in ${courseLabel_()}?\n\n` +
      (dryRun ? 'Dry run is ON: nothing will be sent.' :
        'Dry run is OFF: this creates it in Canvas.'), ui.ButtonSet.YES_NO);
    if (answer !== ui.Button.YES) return;

    const result = canvasWrite_('POST', `/courses/${courseId}/group_categories`, { name });
    if (result.dryRun) {
      console.log('Create group category (dry run): 1 category would be created.');
      ui.alert('Create group category', 'Dry run: the category would have been created. ' +
        `Nothing was sent, and ${GROUPS_CELLS.CATEGORY_ID} was left blank.`, ui.ButtonSet.OK);
      return;
    }
    if (!result.id) throw sheetProblem_('Canvas did not return the new category\'s ID.');

    sheet.getRange(GROUPS_CELLS.CATEGORY_ID).setValue(result.id);
    const link = `${getCanvasCredentials_().baseUrl}/courses/${courseId}/groups#tab-${result.id}`;
    sheet.getRange(GROUPS_CELLS.CATEGORY_LINK).setRichTextValue(
      SpreadsheetApp.newRichTextValue().setText('Category URL →').setLinkUrl(link).build());
    console.log('Create group category: 1 category created.');
    ui.alert('Create group category', `Created. Its ID (${result.id}) is in ` +
      `${GROUPS_CELLS.CATEGORY_ID}. Next: Create groups.`, ui.ButtonSet.OK);
  } catch (error) {
    reportRefreshFailure_('Create group category', 'No category was created.', error);
  }
}

/**
 * Button / menu: Create groups. Creates one empty group per name in the Group Names
 * column, in the category in D2, skipping rows that already have a GroupID.
 * Writes each new group's ID next to its name as soon as Canvas answers.
 */
function createGroups() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  try {
    const started = Date.now();
    const sheet = getGroupsSheet_(ss);
    const dryRun = isDryRun_();
    const categoryId = String(sheet.getRange(GROUPS_CELLS.CATEGORY_ID).getValue())
      .replace(/\.0$/, '').trim();
    if (!categoryId && !dryRun) {
      throw sheetProblem_(`There is no category ID in ${GROUPS_CELLS.CATEGORY_ID}. ` +
        'Use Create group category first.');
    }

    const table = readGroupsTable_(sheet);
    const named = table.rows.filter(row => row.name);
    const toCreate = named.filter(row => isBlank_(row.id));
    const skipped = named.length - toCreate.length;
    if (!toCreate.length) {
      ui.alert('Create groups', named.length ?
        `All ${named.length} group name(s) already have a GroupID. Nothing to create.` :
        `Type group names under "${GROUPS_NAME_HEADER}" first.`, ui.ButtonSet.OK);
      return;
    }

    const answer = ui.alert('Create groups',
      `Create ${toCreate.length} empty group(s) in category "` +
      `${sheet.getRange(GROUPS_CELLS.CATEGORY_NAME).getDisplayValue()}" in ${courseLabel_()}?` +
      (skipped ? `\n${skipped} row(s) already have a GroupID and will be skipped.` : '') +
      '\n\n' + (dryRun ? 'Dry run is ON: nothing will be sent.' :
        'Dry run is OFF: this creates them in Canvas.'), ui.ButtonSet.YES_NO);
    if (answer !== ui.Button.YES) return;

    let created = 0;
    let timedOut = false;
    const failures = [];
    for (const row of toCreate) {
      if (Date.now() - started > GROUPS_TIME_LIMIT_MS) {
        timedOut = true;
        break;
      }
      try {
        const result = canvasWrite_('POST', `/group_categories/${categoryId || 0}/groups`,
          { name: row.name });
        if (!result.dryRun) {
          if (!result.id) throw sheetProblem_('no group ID returned');
          sheet.getRange(row.sheetRow, table.idColumn).setValue(result.id);
        }
        created++;
      } catch (error) {
        if (error.canvasType && CANVAS_STOP_ALL_TYPES.includes(error.canvasType)) throw error;
        if (!error.canvasType && !error.isSheetProblem) throw error;
        failures.push(`row ${row.sheetRow}: ${error.message}`);
      }
    }

    console.log(`Create groups${dryRun ? ' (dry run)' : ''}: ${created} created, ` +
      `${failures.length} failed, ${skipped} skipped` + (timedOut ? ', stopped at time limit.' : '.'));
    ui.alert('Create groups',
      (dryRun ? `Dry run: ${created} group(s) would have been created. Nothing was sent.` :
        `${created} group(s) created; their IDs are in the ${GROUPS_ID_HEADER} column.`) +
      (skipped ? `\n${skipped} row(s) skipped (already had a GroupID).` : '') +
      (failures.length ? `\n\nNot created (${failures.length}):\n• ` + failures.join('\n• ') +
        '\nFix those rows and run Create groups again; it skips the ones already made.' : '') +
      (timedOut ? '\n\nStopped near the time limit; run Create groups again to finish.' : ''),
      ui.ButtonSet.OK);
  } catch (error) {
    reportRefreshFailure_('Create groups', 'Groups already created keep their IDs on the ' +
      'sheet; run Create groups again to finish the rest.', error);
  }
}

/**
 * Menu: Canvas Tools › Groups › Pull groups into this column. Read-only in Canvas.
 * Nothing on the sheet changes unless Canvas answers and (if cells are filled) you say Yes.
 */
function pullGroupsForActiveColumn() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const title = 'Pull groups';
  try {
    const sheet = ss.getActiveSheet();
    checkGradingSheet_(sheet);
    const target = readGroupColumn_(sheet);
    const courseId = getCourseIdForRefresh_();

    ss.toast('Reading groups from Canvas…', title, -1);
    const category = canvasStep_('group set request', () =>
      canvasGet_(`/group_categories/${target.categoryId}`));
    if (jupiterId_(category.course_id) !== courseId) {
      throw sheetProblem_(`Group set ${target.categoryId} is not in this workbook's course ` +
        `(${courseId}). Check row 2 of column ${target.letter}.`);
    }
    const groups = canvasStep_('groups request', () =>
      canvasGet_(`/group_categories/${target.categoryId}/groups`));
    const members = groups.map(group => canvasStep_('group members request', () =>
      canvasGet_(`/groups/${group.id}/users`)));
    const membership = groupMembership_(groups, members);

    const rows = target.lastRow - ROSTER_FIRST_ROW + 1;
    if (rows < 1) throw sheetProblem_('There are no student rows (from row 3) on this sheet.');
    const userIds = sheet.getRange(ROSTER_FIRST_ROW, 1, rows, 1).getValues();
    const current = sheet.getRange(ROSTER_FIRST_ROW, target.column, rows, 1).getValues();
    // planScorePull_ works for any "User ID → value" map: here "scored" means in a group
    // and "missing" means in no group.
    const plan = planScorePull_(userIds, current, membership.groupOf, ROSTER_FIRST_ROW);
    if (!plan.writes.length) {
      throw sheetProblem_('No row from 3 down has a Canvas User ID in column A. ' +
        'Run CreateRoster first.');
    }
    const onSheet = new Set(userIds.map(cells => jupiterId_(cells.slice(0, 1)[0])));
    const notOnSheet = [...membership.groupOf.keys()].filter(id => !onSheet.has(id)).length;

    const setName = String(category.name || '').trim() || 'this group set';
    ss.toast('', title, 1);
    if (plan.filled) {
      const answer = ui.alert(title, `"${setName}" (course ${courseId})\n\n${plan.filled} ` +
        `student cell(s) in column ${target.letter} already have something in them. ` +
        'Replace them with the groups from Canvas?', ui.ButtonSet.YES_NO);
      if (answer !== ui.Button.YES) {
        ui.alert(title, 'Nothing was changed.', ui.ButtonSet.OK);
        return;
      }
    }

    const rule = membership.names.length ? SpreadsheetApp.newDataValidation()
      .requireValueInList(membership.names, true).setAllowInvalid(false).build() : null;
    scoreRuns_(plan.writes).forEach(run => {
      const range = sheet.getRange(run.row, target.column, run.values.length, 1);
      range.setValues(run.values);
      if (rule) range.setDataValidation(rule);
    });

    console.log(`Pull groups: ${groups.length} group(s), ${plan.writes.length} student ` +
      `row(s), ${plan.scored} in a group, ${notOnSheet} member(s) not on the sheet.`);
    ui.alert(title, `"${setName}": ${groups.length} group(s). Column ${target.letter} ` +
      `updated for ${plan.writes.length} student(s): ${plan.scored} in a group, ` +
      `${plan.missing} in none (blank).` +
      (rule ? '\n\nEach student cell now has a dropdown of the group names.' :
        '\n\nThis set has no groups yet, so no dropdown was added. Create groups first.') +
      (notOnSheet ? `\n\n${notOnSheet} group member(s) have no row on this sheet ` +
        '(for example, another section, a dropped student, or the Test Student).' : '') +
      (membership.duplicates.length ? '\n\nMore than one group is named: ' +
        membership.duplicates.map(name => `"${name}"`).join(', ') +
        '. Rename them in Canvas so each name is different.' : ''), ui.ButtonSet.OK);
  } catch (error) {
    reportRefreshFailure_(title, 'The sheet was not changed.', error);
  }
}

/**
 * The clicked column on a grading sheet: { column, letter, categoryId, lastRow }.
 * Refuses the roster and Jupiter ID columns (A–F) and a row 2 that isn't an ID number.
 */
function readGroupColumn_(sheet) {
  const column = sheet.getActiveCell().getColumn();
  const letter = sheet.getRange(1, column).getA1Notation().replace(/\d+/g, '');
  if (column <= ROSTER_JUPITER_ID_COLUMN) {
    throw sheetProblem_('Click a cell in a groups column first (G or later). ' +
      'Columns A–F hold the roster and Jupiter IDs.');
  }
  const categoryId = jupiterId_(sheet.getRange(ASSIGNMENT_ID_ROW, column).getValue());
  if (!/^\d+$/.test(categoryId)) {
    throw sheetProblem_(`Row 2 of column ${letter} should hold the group set's category ID ` +
      `(the number Create group category puts in ${GROUPS_CELLS.CATEGORY_ID} of ` +
      `${TOOL_SHEETS.CREATE_GROUPS}).`);
  }
  return { column, letter, categoryId, lastRow: sheet.getLastRow() };
}

/**
 * groups is Canvas's group list; members holds each group's user list, in the same order.
 * Returns { groupOf: Map of User ID → group name, names: group names in Canvas's order
 * (each once), duplicates: names used by more than one group }.
 */
function groupMembership_(groups, members) {
  const groupOf = new Map();
  const names = [];
  const duplicates = [];
  groups.forEach((group, i) => {
    const name = String(group.name || '').trim();
    if (names.includes(name)) {
      if (!duplicates.includes(name)) duplicates.push(name);
    } else {
      names.push(name);
    }
    (members.slice(i, i + 1)[0] || []).forEach(user => groupOf.set(jupiterId_(user.id), name));
  });
  return { groupOf, names, duplicates };
}

function getGroupsSheet_(ss) {
  const sheet = ss.getSheetByName(TOOL_SHEETS.CREATE_GROUPS);
  if (!sheet) {
    throw sheetProblem_(`There is no tab named ${TOOL_SHEETS.CREATE_GROUPS}.`);
  }
  return sheet;
}

/**
 * Finds the GroupID and Group Names columns by their headers in row 4 and reads every
 * row below: { idColumn, rows: [{ sheetRow, id, name }] }.
 */
function readGroupsTable_(sheet) {
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const header = sheet.getRange(GROUPS_HEADER_ROW, 1, 1, lastColumn).getValues()[0]
    .map(value => String(value).trim());
  const idIndex = header.indexOf(GROUPS_ID_HEADER);
  const nameIndex = header.indexOf(GROUPS_NAME_HEADER);
  if (idIndex === -1 || nameIndex === -1) {
    throw sheetProblem_(`Row ${GROUPS_HEADER_ROW} of ${TOOL_SHEETS.CREATE_GROUPS} should have ` +
      `the headers "${GROUPS_ID_HEADER}" and "${GROUPS_NAME_HEADER}".`);
  }
  const dataRows = sheet.getLastRow() - GROUPS_HEADER_ROW;
  const values = dataRows > 0 ?
    sheet.getRange(GROUPS_HEADER_ROW + 1, 1, dataRows, lastColumn).getValues() : [];
  return {
    idColumn: idIndex + 1,
    rows: values.map((row, i) => ({
      sheetRow: GROUPS_HEADER_ROW + 1 + i,
      id: row.slice(idIndex, idIndex + 1)[0],
      name: String(row.slice(nameIndex, nameIndex + 1)[0]).trim(),
    })),
  };
}

/** "Biology (P3)" from cfg_CourseName, or "the cfg_CourseID course" if it is blank. */
function courseLabel_() {
  try {
    return String(getCfg_('CourseName'));
  } catch {
    return 'the cfg_CourseID course';
  }
}
