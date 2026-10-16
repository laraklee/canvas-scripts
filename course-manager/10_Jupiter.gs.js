/**
 * 10_Jupiter.gs — Canvas-to-Jupiter export builders.
 *
 * On the Config sheet: G = Canvas group name, H = export checkbox,
 * I = Canvas group ID. Run refreshJupiterCategories() from a Config button
 * to populate these columns. Only checked groups export.
 * The checkbox settings are read automatically on every export.
 *
 * Requires the existing getConfig() and getNextUrlLocal() functions.
 * This file replaces the previous 10_Jupiter.gs; do not keep both copies.
 */

function getJupiterAllowedCategories_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('*Config*');
  if (!sheet) throw new Error("Config sheet not found. Add category names in G and checkboxes in H.");

  const count = sheet.getLastRow() - 1;
  if (count < 1) throw new Error('No Jupiter categories found on Config (G2:H).');

  const allowed = new Set();
  sheet.getRange(2, 7, count, 3).getValues().forEach(function(row) {
    const name = String(row[0]).trim();
    const id = jupiterId_(row[2]);
    if (row[1] === true) {
      if (id) allowed.add('id:' + id);
      // Compatibility with manually entered G/H lists before IDs were added.
      else if (name) allowed.add('name:' + name.toLowerCase());
    }
  });
  if (!allowed.size) throw new Error('Check at least one Jupiter category in Config column H.');
  return allowed;
}

function isJupiterGroupAllowed_(allowed, groupId, groupName) {
  return allowed.has('id:' + jupiterId_(groupId)) ||
    allowed.has('name:' + String(groupName).trim().toLowerCase());
}

function getJupiterCanvasSettings_() {
  const config = getConfig();
  const settings = {
    token: PropertiesService.getUserProperties().getProperty('CANVAS_API_KEY'),
    base: config.BASE_URL ? String(config.BASE_URL).replace(/\/+$/, '') : '',
    courseId: config.COURSE_ID
  };
  if (!settings.token || !settings.base || !settings.courseId) {
    throw new Error('Missing Canvas API key, BASE_URL, or COURSE_ID.');
  }
  settings.options = {
    method: 'GET',
    headers: { Authorization: 'Bearer ' + settings.token, Accept: 'application/json' },
    muteHttpExceptions: true
  };
  return settings;
}

function getJupiterJsonPage_(url, options) {
  const response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() !== 200) {
    throw new Error('Canvas API HTTP ' + response.getResponseCode() + ' while reading ' + url.split('?')[0]);
  }
  return {
    data: JSON.parse(response.getContentText()),
    next: getNextUrlLocal(response.getHeaders().Link || response.getHeaders().link)
  };
}

function getJupiterGroupMap_(settings) {
  const map = {};
  let url = `${settings.base}/api/v1/courses/${settings.courseId}/assignment_groups?per_page=100`;
  while (url) {
    const page = getJupiterJsonPage_(url, settings.options);
    page.data.forEach(function(group) {
      map[String(group.id)] = String(group.name).trim();
    });
    url = page.next;
  }
  return map;
}

/**
 * Run from an assigned drawing/button on Config to refresh G:I.
 * Preserves checked groups by Canvas group ID (or by name for older G/H lists).
 * New groups start unchecked. Does not touch other Config columns.
 */
function refreshJupiterCategories() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('*Config*');
  if (!sheet) {
    ss.toast('Config sheet not found.', 'Category Refresh Failed', 7);
    return;
  }
  try {
    const existingRows = Math.max(0, sheet.getLastRow() - 1);
    const existing = existingRows ? sheet.getRange(2, 7, existingRows, 3).getValues() : [];
    const idHeader = String(sheet.getRange('I1').getValue()).trim();
    if (idHeader && idHeader !== 'Canvas group ID') {
      throw new Error('Config column I already has a different heading. Move that content before refreshing.');
    }
    if (!idHeader && existing.some(row => row[2] !== '' && row[2] !== null)) {
      throw new Error('Config column I already contains data. Move that content before refreshing.');
    }

    const checkedIds = new Set();
    const checkedNames = new Set();
    existing.forEach(function(row) {
      if (row[1] !== true) return;
      const id = jupiterId_(row[2]);
      if (id) checkedIds.add(id);
      else if (String(row[0]).trim()) checkedNames.add(String(row[0]).trim().toLowerCase());
    });

    const settings = getJupiterCanvasSettings_();
    const groups = getJupiterGroupMap_(settings);
    const entries = Object.keys(groups).map(id => ({id: id, name: groups[id]}))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (!entries.length) throw new Error('Canvas returned no assignment groups; Config was not changed.');

    // Fetch and validate first. Only then replace the managed Config table.
    const clearRows = Math.max(existingRows, entries.length);
    if (clearRows) {
      sheet.getRange(2, 7, clearRows, 3).clearContent();
      sheet.getRange(2, 8, clearRows, 1).clearDataValidations();
    }
    sheet.getRange('G1:I1').setValues([['Canvas category', 'Export to Jupiter?', 'Canvas group ID']]);
    sheet.getRange(2, 8, entries.length, 1).insertCheckboxes();
    sheet.getRange(2, 7, entries.length, 3).setValues(entries.map(function(group) {
      return [group.name,
        checkedIds.has(group.id) || checkedNames.has(group.name.toLowerCase()),
        group.id];
    }));
    ss.toast(`Refreshed ${entries.length} Canvas categories; existing selections retained.`,
      'Jupiter Categories', 7);
  } catch (error) {
    ss.toast(`Category refresh failed: ${error.message}`, 'Jupiter Categories', 9);
    Logger.log(error.stack || error);
  }
}

function jupiterId_(value) {
  return String(value === null || value === undefined ? '' : value).replace(/\.0$/, '').trim();
}

/**
 * Write a fresh JupiterExport matrix. Clears the old assignment columns so
 * a prior, wider export cannot leave an excluded Tests column behind.
 * assignments: [{id, name, category, points, dueDate, scores: {canvasId: score}}]
 */
function writeJupiterExport_(ss, activeSheet, assignments) {
  const exportSheet = ss.getSheetByName('JupiterExport');
  if (!exportSheet) throw new Error("Target sheet 'JupiterExport' not found.");

  const firstDataRow = 3;
  const rosterRows = activeSheet.getLastRow() - firstDataRow + 1;
  if (rosterRows < 1) throw new Error('No student roster rows found on the active sheet.');

  const canvasIds = activeSheet.getRange(firstDataRow, 1, rosterRows, 1).getValues();
  const jupiterIds = activeSheet.getRange(firstDataRow, 6, rosterRows, 1).getValues();
  const roster = {};
  for (let i = 0; i < rosterRows; i++) {
    const jId = jupiterId_(jupiterIds[i][0]);
    if (jId) roster[jId] = jupiterId_(canvasIds[i][0]);
  }

  const rowCount = exportSheet.getLastRow();
  if (rowCount < 1) throw new Error('JupiterExport has no template rows.');
  const width = Math.max(exportSheet.getLastColumn(), assignments.length * 2 + 1);
  if (exportSheet.getMaxColumns() < width) {
    exportSheet.insertColumnsAfter(exportSheet.getMaxColumns(), width - exportSheet.getMaxColumns());
  }

  const range = exportSheet.getRange(1, 1, rowCount, width);
  const values = range.getValues();
  let afterPossible = false;

  for (let row = 0; row < values.length; row++) {
    const label = String(values[row][0]).trim();
    if (label !== 'Class:') {
      for (let col = 1; col < width; col++) values[row][col] = '';
    }

    if (label === 'Possible:') afterPossible = true;
    else if (label !== '') afterPossible = false;

    assignments.forEach(function(item, index) {
      const scoreCol = index * 2 + 1;
      const commentCol = scoreCol + 1;

      if (label === 'Assignment:') values[row][scoreCol] = item.name;
      else if (label === 'Category:') values[row][scoreCol] = item.category;
      else if (label === 'Date:' && item.dueDate) {
        const date = new Date(item.dueDate);
        if (!isNaN(date.getTime())) {
          values[row][scoreCol] = Utilities.formatDate(date, ss.getSpreadsheetTimeZone(), 'M/d/yy');
        }
      } else if (label === 'Possible:') values[row][scoreCol] = item.points;
      else if (label === '' && afterPossible) {
        values[row][scoreCol] = 'Score:';
        values[row][commentCol] = 'Comment:';
      }

      const match = label.match(/\(([^()]*)\)/);
      if (match && Object.prototype.hasOwnProperty.call(roster, match[1].trim())) {
        const canvasId = roster[match[1].trim()];
        if (Object.prototype.hasOwnProperty.call(item.scores, canvasId)) {
          values[row][scoreCol] = item.scores[canvasId];
        }
      }
    });
    if (label === '' && afterPossible) afterPossible = false;
  }
  range.setValues(values);
}

/** Find recently graded Canvas assignments in checked categories and export grades. */
function buildJupiterExportFromRecentCanvasGrades(defaultDays) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const activeSheet = ss.getActiveSheet();
  const ui = SpreadsheetApp.getUi();

  if (activeSheet.getName() === 'JupiterExport' || activeSheet.getName().startsWith('*')) {
    ss.toast('Run this from your active grading sheet.', 'Sync Halted', 5);
    return;
  }

  const stamp = activeSheet.getRange('B1').getValue();
  const fallbackDays = Number(defaultDays) > 0 ? Number(defaultDays) : 7;
  let calculatedDays = fallbackDays;
  let note = `No previous sync stamp found. Defaulting to ${fallbackDays} days.`;
  if (stamp instanceof Date && !isNaN(stamp.getTime())) {
    calculatedDays = Math.max(1, Math.ceil((Date.now() - stamp.getTime()) / 86400000));
    note = `Last sync: ${Utilities.formatDate(stamp, ss.getSpreadsheetTimeZone(), 'M/d/yy h:mm a')} (${calculatedDays} day(s) ago).`;
  }

  const response = ui.prompt('Fetch Recent Grades for Jupiter',
    `${note}\n\nClick OK to search ${calculatedDays} day(s) back, or enter a custom number of days:`,
    ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() !== ui.Button.OK) return;
  const enteredDays = parseInt(response.getResponseText().trim(), 10);
  const lookbackDays = Number.isInteger(enteredDays) && enteredDays > 0 ? enteredDays : calculatedDays;

  try {
    const allowed = getJupiterAllowedCategories_();
    const settings = getJupiterCanvasSettings_();
    const groups = getJupiterGroupMap_(settings);
    const since = new Date(Date.now() - lookbackDays * 86400000).toISOString();
    const found = new Map();
    ss.toast('Finding recently graded assignments...', 'Jupiter Export', -1);

    let url = `${settings.base}/api/v1/courses/${settings.courseId}/students/submissions` +
      `?student_ids[]=all&state[]=active&graded_since=${encodeURIComponent(since)}` +
      '&include[]=assignment&per_page=100';
    while (url) {
      const page = getJupiterJsonPage_(url, settings.options);
      page.data.forEach(function(sub) {
        if (!sub.assignment_id || !sub.assignment) return;
        const assignment = sub.assignment;
        const category = groups[String(assignment.assignment_group_id)] || 'Unassigned';
        if (!isJupiterGroupAllowed_(allowed, assignment.assignment_group_id, category)) return;
        const id = jupiterId_(sub.assignment_id);
        if (!found.has(id)) {
          found.set(id, {
            id: id,
            name: String(assignment.name).trim(),
            category: category,
            points: assignment.points_possible,
            dueDate: assignment.due_at || '',
            scores: {}
          });
        }
      });
      url = page.next;
    }

    const assignments = Array.from(found.values());
    if (!assignments.length) {
      ss.toast(`No recently graded assignments in checked categories (${lookbackDays} days).`,
        'Nothing exported', 6);
      return;
    }

    ss.toast(`Fetching class scores for ${assignments.length} assignment(s)...`, 'Jupiter Export', -1);
    assignments.forEach(function(item) {
      let pageUrl = `${settings.base}/api/v1/courses/${settings.courseId}` +
        `/assignments/${item.id}/submissions?student_ids[]=all&per_page=100`;
      while (pageUrl) {
        const page = getJupiterJsonPage_(pageUrl, settings.options);
        page.data.forEach(function(sub) {
          // Keep zero scores and distinguish an ungraded student from a scored one.
          let score = '';
          if (sub.entered_score !== null && sub.entered_score !== undefined) score = sub.entered_score;
          else if (sub.score !== null && sub.score !== undefined) score = sub.score;
          else if (sub.grade !== null && sub.grade !== undefined) score = sub.grade;
          item.scores[jupiterId_(sub.user_id)] = score;
        });
        pageUrl = page.next;
      }
    });

    writeJupiterExport_(ss, activeSheet, assignments);
    activeSheet.getRange('A1').setValue('Last Jupiter Sync:').setFontWeight('bold');
    activeSheet.getRange('B1').setValue(new Date()).setNumberFormat('m/d/yyyy h:mm am/pm');
    ss.toast(`Exported ${assignments.length} assignment(s) from checked categories.`,
      'Jupiter Export Complete', 8);
  } catch (error) {
    ss.toast(`Export failed: ${error.message}`, 'Jupiter Export', 8);
    Logger.log(error.stack || error);
  }
}

/** Export the selected score columns, skipping unchecked Canvas categories. */
function mapMultipleCanvasAssignmentsToJupiterExport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const activeSheet = ss.getActiveSheet();
  if (activeSheet.getName() === 'JupiterExport' || activeSheet.getName().startsWith('*')) {
    ss.toast('Run this from your active grading sheet.', 'Sync Halted', 5);
    return;
  }

  const selection = activeSheet.getActiveRange();
  if (!selection) {
    ss.toast('Highlight assignment score columns first.', 'Sync Halted', 5);
    return;
  }

  try {
    const allowed = getJupiterAllowedCategories_();
    const settings = getJupiterCanvasSettings_();
    const groups = getJupiterGroupMap_(settings);
    const assignments = [];
    const firstDataRow = 3;
    const rosterRows = activeSheet.getLastRow() - firstDataRow + 1;
    if (rosterRows < 1) throw new Error('No student roster rows found on the active sheet.');
    const canvasIds = activeSheet.getRange(firstDataRow, 1, rosterRows, 1).getValues();

    for (let col = selection.getColumn(); col <= selection.getLastColumn(); col++) {
      if (col === 1 || col === 6) throw new Error('Selection includes a student ID column. Highlight assignment score columns only.');
      const id = jupiterId_(activeSheet.getRange(2, col).getValue());
      if (!/^\d+$/.test(id)) throw new Error(`Numeric Canvas assignment ID missing from row 2, column ${col}.`);

      const url = `${settings.base}/api/v1/courses/${settings.courseId}/assignments/${id}`;
      const meta = getJupiterJsonPage_(url, settings.options).data;
      const category = groups[String(meta.assignment_group_id)] || 'Unassigned';
      if (!isJupiterGroupAllowed_(allowed, meta.assignment_group_id, category)) continue;

      const scores = {};
      const columnScores = activeSheet.getRange(firstDataRow, col, rosterRows, 1).getValues();
      for (let row = 0; row < rosterRows; row++) {
        const canvasId = jupiterId_(canvasIds[row][0]);
        if (canvasId) scores[canvasId] = columnScores[row][0];
      }
      assignments.push({
        id: id,
        name: String(meta.name).trim(),
        category: category,
        points: meta.points_possible,
        dueDate: meta.due_at || '',
        scores: scores
      });
    }

    if (!assignments.length) {
      ss.toast('None of the selected assignments has a checked Jupiter category.',
        'Nothing exported', 6);
      return;
    }
    writeJupiterExport_(ss, activeSheet, assignments);
    ss.toast(`Exported ${assignments.length} selected assignment(s) from checked categories.`,
      'Jupiter Export Complete', 8);
  } catch (error) {
    ss.toast(`Export failed: ${error.message}`, 'Jupiter Export', 8);
    Logger.log(error.stack || error);
  }
}
