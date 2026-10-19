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
 * Canvas endpoints called: none directly; writes below go through canvasWrite_.
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
