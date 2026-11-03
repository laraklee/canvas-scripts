/**
 * 11_GroupListing.js
 * Purpose: Read-only utility that lists every group in a Canvas group set and the
 * students in each group, on the "Group List" tab. Useful for checking or
 * rebuilding groups after a group set was configured incorrectly.
 *
 * Sheet layout ("Group List" tab, created on first run):
 *   B1 = Canvas Course ID
 *   B3 = Group Set ID (Canvas calls this a "group category").
 *        Leave B3 blank to list all group sets in the course with their IDs.
 *   Row 5 down = output (cleared and rewritten on each run).
 *
 * Canvas endpoints called (all GET, read-only):
 *   GET /api/v1/courses/:course_id/group_categories
 *   GET /api/v1/group_categories/:id
 *   GET /api/v1/group_categories/:id/groups
 *   GET /api/v1/groups/:group_id/users
 *   GET /api/v1/group_categories/:id/users?unassigned=true
 *
 * Write operations: none.
 *
 * Properties: User Property CANVAS_API_KEY (set via Setup & Admin > 1);
 *   Canvas base URL from *Config*!B2 (same as the rest of this project).
 *
 * Privacy: student names are written only to the sheet, never to logs or toasts.
 */

const GROUP_LIST_SHEET_NAME_ = 'Group List';
const GROUP_LIST_OUTPUT_ROW_ = 5;
const GROUP_HEADER_COLOR_ = '#CFE2F3';
const UNASSIGNED_HEADER_COLOR_ = '#F4CCCC';

/**
 * Menu entry point. Lists groups and members for the group set in B3,
 * or lists the course's group sets when B3 is blank.
 */
function listGroupsAndMembers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  let sheet = ss.getSheetByName(GROUP_LIST_SHEET_NAME_);
  if (!sheet) {
    sheet = ss.insertSheet(GROUP_LIST_SHEET_NAME_);
    setUpGroupListSheet_(sheet);
    sheet.activate();
    ui.alert('Group List tab created',
      'Type the Course ID in B1 and the Group Set ID in B3, then run this again.\n\n' +
      'Tip: leave B3 blank to see every group set in the course and its ID.',
      ui.ButtonSet.OK);
    return;
  }
  sheet.activate();

  const courseId = String(sheet.getRange('B1').getValue()).trim();
  const groupSetId = String(sheet.getRange('B3').getValue()).trim();

  if (!courseId) {
    ui.alert('Missing Course ID', 'Type the Canvas Course ID in B1.', ui.ButtonSet.OK);
    return;
  }

  try {
    const api = getGroupListApi_();
    clearGroupListOutput_(sheet);
    sheet.getRange('C3').clearContent();

    if (!groupSetId) {
      writeGroupSets_(sheet, api, courseId);
      return;
    }

    const groupSet = canvasGetJson_(api, '/api/v1/group_categories/' + encodeURIComponent(groupSetId));
    if (groupSet.course_id && String(groupSet.course_id) !== courseId) {
      ui.alert('Group set is in a different course',
        'Group Set ' + groupSetId + ' belongs to course ' + groupSet.course_id +
        ', not course ' + courseId + '. Check B1 and B3.',
        ui.ButtonSet.OK);
      return;
    }
    sheet.getRange('C3').setValue(groupSet.name || '');

    writeGroupMembers_(sheet, api, groupSetId);
  } catch (e) {
    Logger.log('listGroupsAndMembers failed (course ' + courseId + ', group set ' + groupSetId + '): ' + e.message);
    ui.alert('Could not list groups', e.message, ui.ButtonSet.OK);
  }
}

/**
 * Writes one block per group (group name and member count, then member names),
 * followed by a block of students in the course who are not in any group of this set.
 */
function writeGroupMembers_(sheet, api, groupSetId) {
  const groups = canvasGetAll_(api, '/api/v1/group_categories/' + encodeURIComponent(groupSetId) + '/groups');
  groups.sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));

  const rows = [];
  const headerRows = [];
  let memberTotal = 0;

  groups.forEach(group => {
    const members = canvasGetAll_(api, '/api/v1/groups/' + group.id + '/users');
    members.sort(compareUsersByLastName_);
    memberTotal += members.length;

    headerRows.push({ row: rows.length, color: GROUP_HEADER_COLOR_ });
    rows.push([group.name, members.length + (members.length === 1 ? ' member' : ' members'), 'Group ID ' + group.id]);
    members.forEach(user => rows.push(['', user.name, '']));
    rows.push(['', '', '']);
  });

  let unassignedCount = null;
  try {
    const unassigned = canvasGetAll_(api,
      '/api/v1/group_categories/' + encodeURIComponent(groupSetId) + '/users?unassigned=true');
    unassigned.sort(compareUsersByLastName_);
    unassignedCount = unassigned.length;

    headerRows.push({ row: rows.length, color: UNASSIGNED_HEADER_COLOR_ });
    rows.push(['Not in any group', unassigned.length + (unassigned.length === 1 ? ' student' : ' students'), '']);
    unassigned.forEach(user => rows.push(['', user.name, '']));
  } catch (e) {
    // Not fatal: the group list itself is still useful.
    Logger.log('Unassigned list unavailable for group set ' + groupSetId + ': ' + e.message);
  }

  sheet.getRange(GROUP_LIST_OUTPUT_ROW_ - 1, 1, 1, 3)
    .setValues([['Group', 'Members', 'Notes']])
    .setFontWeight('bold');

  if (rows.length > 0) {
    sheet.getRange(GROUP_LIST_OUTPUT_ROW_, 1, rows.length, 3).setValues(rows);
    headerRows.forEach(h => {
      sheet.getRange(GROUP_LIST_OUTPUT_ROW_ + h.row, 1, 1, 3)
        .setBackground(h.color)
        .setFontWeight('bold');
    });
  }
  sheet.autoResizeColumns(1, 3);

  let summary = groups.length + ' groups, ' + memberTotal + ' students placed.';
  if (unassignedCount !== null) {
    summary += ' ' + unassignedCount + ' not in a group.';
  }
  SpreadsheetApp.getActiveSpreadsheet().toast(summary, '✅ Group List updated', 8);
}

/**
 * Writes the course's group sets (name, ID, number of groups) so the teacher can pick one for B3.
 */
function writeGroupSets_(sheet, api, courseId) {
  const sets = canvasGetAll_(api, '/api/v1/courses/' + encodeURIComponent(courseId) + '/group_categories');
  sets.sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));

  sheet.getRange(GROUP_LIST_OUTPUT_ROW_ - 1, 1, 1, 3)
    .setValues([['Group Set', 'Group Set ID (copy to B3)', 'Groups']])
    .setFontWeight('bold');

  if (sets.length > 0) {
    const rows = sets.map(set => [set.name, set.id, set.groups_count != null ? set.groups_count : '']);
    sheet.getRange(GROUP_LIST_OUTPUT_ROW_, 1, rows.length, 3).setValues(rows);
    sheet.getRange(GROUP_LIST_OUTPUT_ROW_, 2, rows.length, 1).setHorizontalAlignment('left');
  }
  sheet.autoResizeColumns(1, 3);

  SpreadsheetApp.getActiveSpreadsheet().toast(
    sets.length + ' group sets found. Copy one ID into B3 and run again.', 'Group Sets', 8);
}

/** Labels the input cells on a new Group List tab. */
function setUpGroupListSheet_(sheet) {
  sheet.getRange('A1').setValue('Course ID').setFontWeight('bold');
  sheet.getRange('A3').setValue('Group Set ID').setFontWeight('bold');
  sheet.getRange('B1').setBackground('#FFF2CC');
  sheet.getRange('B3').setBackground('#FFF2CC');
  sheet.getRange('C1').setValue('← Canvas course number (from the course URL)').setFontColor('#666666');
  sheet.getRange('A2').setValue('Leave B3 blank to list all group sets in the course.').setFontColor('#666666');
  sheet.setColumnWidth(1, 200);
  sheet.setColumnWidth(2, 220);
}

/** Clears rows 4 and below (header + output), including old colors. */
function clearGroupListOutput_(sheet) {
  const lastRow = sheet.getLastRow();
  const startRow = GROUP_LIST_OUTPUT_ROW_ - 1;
  if (lastRow >= startRow) {
    sheet.getRange(startRow, 1, lastRow - startRow + 1, sheet.getMaxColumns())
      .clearContent()
      .setBackground(null)
      .setFontWeight('normal');
  }
}

/** Sorts Canvas user objects by last name (sortable_name), falling back to display name. */
function compareUsersByLastName_(a, b) {
  return String(a.sortable_name || a.name).localeCompare(String(b.sortable_name || b.name));
}

// --- Read-only Canvas request helpers ---

/** Returns { baseUrl, token } or throws a clear setup error. */
function getGroupListApi_() {
  const token = PropertiesService.getUserProperties().getProperty('CANVAS_API_KEY');
  const baseUrl = String(getConfig().BASE_URL || '').trim().replace(/\/+$/, '');
  if (!token || !baseUrl) {
    throw new Error('Canvas API key or Base URL is not set. Use Setup & Admin > 1. Set API Key and Base URL.');
  }
  return { baseUrl: baseUrl, token: token };
}

/**
 * GET one URL from Canvas. Checks the response code and backs off when the
 * rate limit is low. Returns the HTTPResponse.
 */
function canvasGetResponse_(api, url) {
  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + api.token },
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    let detail = '';
    if (code === 401) detail = ' Your API key may be expired or wrong.';
    if (code === 403) detail = ' You may not have permission to view groups in this course.';
    if (code === 404) detail = ' Check the Course ID and Group Set ID.';
    // The request path has only course/group IDs, no student data.
    throw new Error('Canvas returned error ' + code + ' for ' + url.replace(api.baseUrl, '') + '.' + detail);
  }

  const headers = response.getHeaders();
  const remaining = parseFloat(headers['X-Rate-Limit-Remaining'] || headers['x-rate-limit-remaining']);
  if (!isNaN(remaining) && remaining < 100) {
    Utilities.sleep(2000);
  }
  return response;
}

/** GET a single Canvas object by API path. */
function canvasGetJson_(api, path) {
  return JSON.parse(canvasGetResponse_(api, api.baseUrl + path).getContentText());
}

/** GET every page of a Canvas list endpoint (per_page=100, follows the Link header). */
function canvasGetAll_(api, path) {
  let url = api.baseUrl + path + (path.indexOf('?') === -1 ? '?' : '&') + 'per_page=100';
  const results = [];
  while (url) {
    const response = canvasGetResponse_(api, url);
    const page = JSON.parse(response.getContentText());
    Array.prototype.push.apply(results, page);
    const headers = response.getHeaders();
    url = getNextUrl(headers['Link'] || headers['link']);
  }
  return results;
}
