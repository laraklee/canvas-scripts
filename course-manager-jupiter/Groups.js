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
 *   - putStudentsInGroupsFromActiveColumn (menu: Canvas Tools › Groups): the same column
 *     back to Canvas. Changes only students whose cell differs from Canvas: add, move
 *     (out of the old group, then into the new one), or remove (blank cell). Students not
 *     on the sheet are never touched. Stops before sending if a cell names a group not in
 *     the set, or two groups share a name. Asks first; refused rows turn light red with a
 *     note; 5-minute stop; a rerun only does what still differs.
 *   - listGroupsAndMembers (menu: Canvas Tools › Groups; read-only; this tab): B1 course
 *     ID (blank = cfg_CourseID), B2 group set ID; writes the set's name to C2 (no label;
 *     it sits next to the ID). Row 3 stays blank. From row 5, each group with its members
 *     by name, then students in no group. B2 blank:
 *     lists the course's group sets and IDs instead. Refuses ref_ tabs and tabs whose row
 *     4 isn't blank or its own headers, so it can't wipe a grading sheet. Names go only
 *     onto the sheet; messages and logs give counts.
 * Canvas endpoints called (GET via canvasGet_, Pull groups, Put students in groups, and
 *   List groups and members):
 *   /api/v1/courses/:course/group_categories (List groups, B2 blank)
 *   /api/v1/group_categories/:category
 *   /api/v1/group_categories/:category/groups
 *   /api/v1/groups/:group/users
 *   /api/v1/group_categories/:category/users?unassigned=true (List groups)
 * Canvas write operations (via canvasWrite_, so DRY_RUN applies):
 *   POST /api/v1/courses/:course/group_categories with name
 *   POST /api/v1/group_categories/:category/groups with name
 *   DELETE /api/v1/groups/:group/users/:user (Put students in groups: move or remove)
 *   POST /api/v1/groups/:group/memberships with user_id (Put students in groups: add or
 *   move)
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

// List groups and members (this tab): input cells, output from row 5 (headers in row 4).
const GROUP_LIST_CELLS = Object.freeze({ COURSE_ID: 'B1', SET_ID: 'B2', SET_NAME: 'C2' });
const GROUP_LIST_HEADER_ROW = 4;
const GROUP_LIST_MEMBER_HEADERS = Object.freeze(['Group', 'Members', 'Notes']);
const GROUP_LIST_SET_HEADERS = Object.freeze(['Group set', 'Group set ID (copy to B2)',
  'Groups']);
const GROUP_LIST_GROUP_COLOR = '#cfe2f3'; // light blue: a group's header row
const GROUP_LIST_NONE_COLOR = '#f4cccc'; // light red: "Not in any group"

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
      (dryRun ? 'Preview mode is ON: nothing will be sent.' :
        'Preview mode is OFF: this creates it in Canvas.'), ui.ButtonSet.YES_NO);
    if (answer !== ui.Button.YES) return;

    const result = canvasWrite_('POST', `/courses/${courseId}/group_categories`, { name });
    if (result.dryRun) {
      console.log('Create group category (preview mode): 1 category would be created.');
      ui.alert('Create group category', 'Preview mode: the category would have been created. ' +
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
      '\n\n' + (dryRun ? 'Preview mode is ON: nothing will be sent.' :
        'Preview mode is OFF: this creates them in Canvas.'), ui.ButtonSet.YES_NO);
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

    console.log(`Create groups${dryRun ? ' (preview mode)' : ''}: ${created} created, ` +
      `${failures.length} failed, ${skipped} skipped` + (timedOut ? ', stopped at time limit.' : '.'));
    ui.alert('Create groups',
      (dryRun ? `Preview mode: ${created} group(s) would have been created. Nothing was sent.` :
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
    const { category, groups, membership } = readGroupSet_(target, courseId);

    const rows = target.lastRow - ROSTER_FIRST_ROW + 1;
    if (rows < 1) throw sheetProblem_('There are no student rows (from row 3) on this sheet.');
    const userIds = sheet.getRange(ROSTER_FIRST_ROW, 1, rows, 1).getValues();
    const current = sheet.getRange(ROSTER_FIRST_ROW, target.column, rows, 1).getValues();
    // planScorePull_ works for any "User ID → value" map: here "scored" means in a group
    // and "missing" means in no group.
    const plan = planScorePull_(userIds, current, membership.groupOf, ROSTER_FIRST_ROW);
    if (!plan.writes.length) {
      throw sheetProblem_('No row from 3 down has a Canvas User ID in column A. ' +
        'Run Build class list (CreateRoster) first.');
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
 * Menu: Canvas Tools › Groups › Put students in groups from this column.
 * Compares each student's cell with their group in Canvas and changes only the
 * differences: add (cell picked, in no group), move (different group picked), remove
 * (cell blank, in a group). Students not on the sheet are never touched. Asks first;
 * stops before sending anything if a cell names a group the set doesn't have.
 */
function putStudentsInGroupsFromActiveColumn() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const title = 'Put students in groups';
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(1000)) {
    ui.alert(title, 'Groups are already being changed. Wait for that run to finish.',
      ui.ButtonSet.OK);
    return;
  }
  try {
    const started = Date.now();
    const sheet = ss.getActiveSheet();
    checkGradingSheet_(sheet);
    const target = readGroupColumn_(sheet);
    const courseId = getCourseIdForRefresh_();

    ss.toast('Reading groups from Canvas…', title, -1);
    const { category, membership } = readGroupSet_(target, courseId);
    ss.toast('', title, 1);
    if (membership.duplicates.length) {
      throw sheetProblem_('More than one group is named ' +
        membership.duplicates.map(name => `"${name}"`).join(', ') +
        '. Rename them in Canvas so each name is different, then run Pull groups again.');
    }

    const rows = target.lastRow - ROSTER_FIRST_ROW + 1;
    if (rows < 1) throw sheetProblem_('There are no student rows (from row 3) on this sheet.');
    const plan = planGroupChanges_(sheet.getRange(ROSTER_FIRST_ROW, 1, rows, 1).getValues(),
      sheet.getRange(ROSTER_FIRST_ROW, target.column, rows, 1).getDisplayValues(),
      membership, ROSTER_FIRST_ROW);
    if (plan.unknownRows.length) {
      throw sheetProblem_(`Row(s) ${plan.unknownRows.join(', ')} name a group that isn't ` +
        'in this set. Pick from the dropdown (run Pull groups to refresh it). Nothing was ' +
        'sent.');
    }
    const setName = String(category.name || '').trim() || 'this group set';
    if (!plan.changes.length) {
      ui.alert(title, `"${setName}": column ${target.letter} already matches Canvas. ` +
        'Nothing to change.', ui.ButtonSet.OK);
      return;
    }

    const dryRun = isDryRun_();
    const answer = ui.alert(dryRun ? `${title} (preview mode)` : title,
      `"${setName}" (course ${courseId})\n\n${groupChangeCounts_(plan)}\n` +
      `Groups affected: ${plan.groupNames.join(', ')}\n\nStudents not on this sheet are ` +
      'not changed.\n\n' + (dryRun ? 'Preview mode is ON: nothing will be sent.' :
        'Preview mode is OFF: these changes WILL be made in Canvas.') + '\n\nContinue?',
      ui.ButtonSet.YES_NO);
    if (answer !== ui.Button.YES) {
      ui.alert(title, 'Cancelled. Nothing was sent.', ui.ButtonSet.OK);
      return;
    }

    ss.toast(`Changing ${plan.changes.length} student(s)…`, title, -1);
    const result = sendGroupChanges_(plan.changes, change => {
      if (change.from) canvasWrite_('DELETE', `/groups/${change.from}/users/${change.userId}`);
      if (change.to) {
        canvasWrite_('POST', `/groups/${change.to}/memberships`, { user_id: change.userId });
      }
    }, (row, refusedType) => {
      const cell = sheet.getRange(row, target.column);
      if (refusedType) {
        cell.setBackground(COMMENT_REFUSED_COLOR).setNote(commentRefusedStatus_(refusedType));
      } else if (String(cell.getBackground()).toLowerCase() === COMMENT_REFUSED_COLOR) {
        // Only this tool's red and note come off, so colors and notes you set stay.
        cell.setBackground(null).setNote('');
      }
    }, { started });
    ss.toast('', title, 1);

    console.log(`Put students in groups${dryRun ? ' (preview mode)' : ''}: ${result.done} done, ` +
      `${result.refusedRows.length} refused, ${result.notStarted} not started.`);
    ui.alert(dryRun ? `${title} (preview mode)` : title, (dryRun ?
      `Preview mode: ${result.done} student(s) would have been changed. Nothing was sent.` :
      `"${setName}": ${result.done} student(s) changed in Canvas.`) +
      (result.refusedRows.length ? `\n\nCanvas refused row(s) ${result.refusedRows.join(', ')}` +
        ' (light red; the cell\'s note says why). The other rows still went. Run Pull ' +
        'groups to see where those students are now.' : '') +
      (result.notStarted ? `\n\nStopped near the time limit with ${result.notStarted} ` +
        'student(s) not changed yet. Run it again to finish.' : '') +
      (dryRun ? '\n\nSee Extensions › Apps Script › Executions for the "PREVIEW MODE" lines.' : ''),
    ui.ButtonSet.OK);
  } catch (error) {
    reportRefreshFailure_(title, 'Stopped. Changes already made stay in Canvas; run Pull ' +
      'groups to see where things stand, then run this again to finish.', error);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Menu: Canvas Tools › Groups › List groups and members (this tab). Read-only in Canvas.
 * B1 course ID (blank = cfg_CourseID), B2 group set ID. Writes the set's name to C2, then
 * from row 5 one block per group (name, member count, members by last name) and a last
 * block of students in the course who are in no group of the set. With B2 blank, lists
 * the course's group sets and their IDs instead, so one can be copied into B2.
 */
function listGroupsAndMembers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const title = 'List groups and members';
  try {
    const sheet = ss.getActiveSheet();
    checkGroupListTab_(sheet);
    labelGroupListTab_(sheet);
    const courseId = groupListCourseId_(sheet);
    const setId = jupiterId_(sheet.getRange(GROUP_LIST_CELLS.SET_ID).getValue());
    if (setId && !/^\d+$/.test(setId)) {
      throw sheetProblem_(`${GROUP_LIST_CELLS.SET_ID} should be a group set ID (a number), ` +
        'or blank to list the course\'s group sets.');
    }

    ss.toast('Reading groups from Canvas…', title, -1);
    if (!setId) {
      const sets = canvasStep_('group sets request', () =>
        canvasGet_(`/courses/${courseId}/group_categories`));
      ss.toast('', title, 1);
      writeGroupListOutput_(sheet, GROUP_LIST_SET_HEADERS, groupSetRows_(sets), []);
      sheet.getRange(GROUP_LIST_CELLS.SET_NAME).clearContent();
      console.log(`List groups and members: ${sets.length} group set(s) listed.`);
      ui.alert(title, `Course ${courseId} has ${sets.length} group set(s), listed from row ` +
        `${GROUP_LIST_HEADER_ROW + 1}. Copy one ID into ${GROUP_LIST_CELLS.SET_ID} and run ` +
        'this again.', ui.ButtonSet.OK);
      return;
    }

    const category = canvasStep_('group set request', () =>
      canvasGet_(`/group_categories/${setId}`));
    if (jupiterId_(category.course_id) !== courseId) {
      throw sheetProblem_(`Group set ${setId} is not in course ${courseId}. Check ` +
        `${GROUP_LIST_CELLS.COURSE_ID} and ${GROUP_LIST_CELLS.SET_ID}.`);
    }
    const groups = canvasStep_('groups request', () =>
      canvasGet_(`/group_categories/${setId}/groups`));
    const members = groups.map(group => canvasStep_('group members request', () =>
      canvasGet_(`/groups/${group.id}/users`)));
    const unassigned = canvasStep_('students-in-no-group request', () =>
      canvasGet_(`/group_categories/${setId}/users`, { unassigned: 'true' }));
    ss.toast('', title, 1);

    const list = groupListRows_(groups, members, unassigned);
    sheet.getRange(GROUP_LIST_CELLS.SET_NAME).setValue(String(category.name || '').trim());
    writeGroupListOutput_(sheet, GROUP_LIST_MEMBER_HEADERS, list.rows, list.blocks);
    console.log(`List groups and members: ${list.groupCount} group(s), ${list.placed} ` +
      `in a group, ${list.unassigned} in none.`);
    ui.alert(title, `"${String(category.name || '').trim()}": ${list.groupCount} group(s), ` +
      `${list.placed} student(s) in a group, ${list.unassigned} in no group.`,
    ui.ButtonSet.OK);
  } catch (error) {
    reportRefreshFailure_(title, 'The list was not changed.', error);
  }
}

/**
 * Rows for the group list: per group (sorted by name, numbers in order) a header row
 * [name, "n members", "Group ID id"], its members' names (sorted by last name), and a
 * blank row; then a "Not in any group" block. Returns { rows, blocks: [{ index, kind }]
 * (row indexes of the header rows; kind 'group' or 'none'), groupCount, placed,
 * unassigned }.
 */
function groupListRows_(groups, members, unassigned) {
  const byName = (a, b) => String(a.name || '').trim().localeCompare(
    String(b.name || '').trim(), undefined, { numeric: true });
  const byLastName = (a, b) => String(a.sortable_name || a.name || '')
    .localeCompare(String(b.sortable_name || b.name || ''));
  const count = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const out = { rows: [], blocks: [], groupCount: groups.length, placed: 0, unassigned: 0 };

  groups.map((group, i) => ({ group, users: members.slice(i, i + 1)[0] || [] }))
    .sort((a, b) => byName(a.group, b.group))
    .forEach(({ group, users }) => {
      out.blocks.push({ index: out.rows.length, kind: 'group' });
      out.rows.push([String(group.name || '').trim(), count(users.length, 'member'),
        `Group ID ${jupiterId_(group.id)}`]);
      [...users].sort(byLastName).forEach(user => out.rows.push(['', user.name || '', '']));
      out.rows.push(['', '', '']);
      out.placed += users.length;
    });

  const none = [...(unassigned || [])].sort(byLastName);
  out.unassigned = none.length;
  out.blocks.push({ index: out.rows.length, kind: 'none' });
  out.rows.push(['Not in any group', count(none.length, 'student'), '']);
  none.forEach(user => out.rows.push(['', user.name || '', '']));
  return out;
}

/** Rows for the group set list: [name, ID, number of groups], sorted by name. */
function groupSetRows_(sets) {
  return [...sets]
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), undefined,
      { numeric: true }))
    .map(set => [String(set.name || '').trim(), jupiterId_(set.id),
      set.groups_count === undefined || set.groups_count === null ? '' : set.groups_count]);
}

/**
 * Refuses tabs where clearing row 4 down could lose work: ref_ tabs, and tabs whose row 4
 * has something other than this tool's own headers (a grading sheet, for example).
 */
function checkGroupListTab_(sheet) {
  if (isSystemSheet_(sheet.getName())) {
    throw sheetProblem_('Run this on its own tab, not a ref_ tab.');
  }
  const row4 = sheet.getRange(GROUP_LIST_HEADER_ROW, 1, 1, Math.max(sheet.getLastColumn(), 1))
    .getDisplayValues()[0].map(value => String(value).trim());
  const ours = [GROUP_LIST_MEMBER_HEADERS, GROUP_LIST_SET_HEADERS]
    .some(headers => headers.every((header, i) => row4.slice(i, i + 1)[0] === header));
  if (row4.some(Boolean) && !ours) {
    throw sheetProblem_(`Row ${GROUP_LIST_HEADER_ROW} of this tab already has something in ` +
      'it, and this tool replaces everything from there down. Use a new, empty tab.');
  }
}

/** Fills in the A-column labels on a new tab (only blank cells). */
function labelGroupListTab_(sheet) {
  [['A1', 'Course ID:'], ['A2', 'Group set ID:']]
    .forEach(([cell, label]) => {
      const range = sheet.getRange(cell);
      if (!String(range.getDisplayValue()).trim()) range.setValue(label).setFontWeight('bold');
    });
}

/** B1's course number, or cfg_CourseID when B1 is blank. */
function groupListCourseId_(sheet) {
  const typed = jupiterId_(sheet.getRange(GROUP_LIST_CELLS.COURSE_ID).getValue());
  if (!typed) return getCourseIdForRefresh_();
  if (!/^\d+$/.test(typed)) {
    throw sheetProblem_(`${GROUP_LIST_CELLS.COURSE_ID} should be a Canvas course number, ` +
      'or blank for this workbook\'s course.');
  }
  return typed;
}

/** Clears row 4 down (values and this tool's colors), then writes headers and rows. */
function writeGroupListOutput_(sheet, headers, rows, blocks) {
  const width = headers.length;
  const lastRow = sheet.getLastRow();
  if (lastRow >= GROUP_LIST_HEADER_ROW) {
    sheet.getRange(GROUP_LIST_HEADER_ROW, 1, lastRow - GROUP_LIST_HEADER_ROW + 1, width)
      .clearContent().setBackground(null).setFontWeight('normal');
  }
  sheet.getRange(GROUP_LIST_HEADER_ROW, 1, 1, width).setValues([headers])
    .setFontWeight('bold');
  if (rows.length) {
    sheet.getRange(GROUP_LIST_HEADER_ROW + 1, 1, rows.length, width).setValues(rows)
      .setHorizontalAlignment('left');
  }
  blocks.forEach(block => {
    sheet.getRange(GROUP_LIST_HEADER_ROW + 1 + block.index, 1, 1, width)
      .setBackground(block.kind === 'none' ? GROUP_LIST_NONE_COLOR : GROUP_LIST_GROUP_COLOR)
      .setFontWeight('bold');
  });
  sheet.autoResizeColumns(1, width);
}

/**
 * Reads the group set in row 2 and its groups' members, after checking the set is in
 * this workbook's course: { category, groups, membership } (see groupMembership_).
 */
function readGroupSet_(target, courseId) {
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
  return { category, groups, membership: groupMembership_(groups, members) };
}

/**
 * Which students to change. userIds and wanted (the cells' shown text) are one-column
 * grids starting at firstRow; membership comes from groupMembership_. Rows without a
 * numeric User ID are skipped. Returns { changes: [{ row, userId, from, to }] (group IDs;
 * '' for none), unknownRows, adds, moves, removes, groupNames (affected, each once) }.
 */
function planGroupChanges_(userIds, wanted, membership, firstRow) {
  const plan = { changes: [], unknownRows: [], adds: 0, moves: 0, removes: 0, groupNames: [] };
  const affect = name => {
    if (!plan.groupNames.includes(name)) plan.groupNames.push(name);
  };
  userIds.forEach((cells, i) => {
    const userId = jupiterId_(cells.slice(0, 1)[0]);
    if (!/^\d+$/.test(userId)) return;
    const want = String(wanted.slice(i, i + 1)[0].slice(0, 1)[0]).trim();
    const have = membership.groupOf.get(userId) || '';
    if (want && !membership.idByName.has(want)) {
      plan.unknownRows.push(firstRow + i);
      return;
    }
    if (want === have) return;
    if (want && have) plan.moves++;
    else if (want) plan.adds++;
    else plan.removes++;
    if (have) affect(have);
    if (want) affect(want);
    plan.changes.push({
      row: firstRow + i,
      userId,
      from: have ? membership.groupIdOf.get(userId) : '',
      to: want ? membership.idByName.get(want) : '',
    });
  });
  return plan;
}

/** "3 to add, 2 to move, 1 to remove" (only the kinds that are there). */
function groupChangeCounts_(plan) {
  return [[plan.adds, 'add'], [plan.moves, 'move'], [plan.removes, 'remove']]
    .filter(([count]) => count).map(([count, verb]) => `${count} to ${verb}`).join(', ');
}

/**
 * Sends each change with send(change) and records each row right away with
 * record(row, refusedType) ('' when it went through). A refusal for one student is
 * recorded and the rest still go; errors that would hit every request (token, network,
 * busy) are thrown. Stops starting new changes after the time limit.
 * options: { started, now }. Returns { done, refusedRows, notStarted }.
 */
function sendGroupChanges_(changes, send, record, options) {
  const now = options.now || (() => Date.now());
  const result = { done: 0, refusedRows: [], notStarted: 0 };
  for (let i = 0; i < changes.length; i++) {
    if (now() - options.started > GROUPS_TIME_LIMIT_MS) {
      result.notStarted = changes.length - i;
      break;
    }
    const change = changes.slice(i, i + 1)[0];
    try {
      send(change);
      record(change.row, '');
      result.done++;
    } catch (error) {
      if (!error.canvasType || CANVAS_STOP_ALL_TYPES.includes(error.canvasType)) throw error;
      record(change.row, error.canvasType);
      result.refusedRows.push(change.row);
    }
  }
  return result;
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
 * Returns { groupOf: Map of User ID → group name, groupIdOf: Map of User ID → group ID,
 * idByName: Map of group name → group ID (the first group with that name), names: group
 * names in Canvas's order (each once), duplicates: names used by more than one group }.
 */
function groupMembership_(groups, members) {
  const groupOf = new Map();
  const groupIdOf = new Map();
  const idByName = new Map();
  const names = [];
  const duplicates = [];
  groups.forEach((group, i) => {
    const name = String(group.name || '').trim();
    const id = jupiterId_(group.id);
    if (names.includes(name)) {
      if (!duplicates.includes(name)) duplicates.push(name);
    } else {
      names.push(name);
      idByName.set(name, id);
    }
    (members.slice(i, i + 1)[0] || []).forEach(user => {
      groupOf.set(jupiterId_(user.id), name);
      groupIdOf.set(jupiterId_(user.id), id);
    });
  });
  return { groupOf, groupIdOf, idByName, names, duplicates };
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
