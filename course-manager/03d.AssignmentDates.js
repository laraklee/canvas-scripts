/**
 * Fetches assignments from Canvas, formats dates as 'M/d/yy' and times as 'h:mm a',
 * injects native VLOOKUP schedule formulas against *simpleSchedule*, and enables filter views.
 *
 * @return {void}
 */
function fetchCanvasAssignmentDates() {
  var config = getConfig(); // from 00_Config.gs
  var userProperties = PropertiesService.getUserProperties(); // from 00_Config.gs
  var apiKey = userProperties.getProperty('CANVAS_API_KEY');
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  if (!apiKey || !config.COURSE_ID || !config.BASE_URL) {
    SpreadsheetApp.getUi().alert('Missing API Key, Course ID, or Base URL in Config.');
    return;
  }

  var sheetName = 'Assignment Dates';
  var sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  
  // Clear contents from Row 2 down to preserve Row 1 buttons and Column Widths
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clear();
  }

  // Define Table Headers (13 Columns)
  var headers = [
    'Update?',        // Col A (1)
    'ID',             // Col B (2) - Static Primary Key
    'Assignment Name',// Col C (3) - Hyperlinked Title
    'Sub. Type(s)',   // Col D (4) - Dropdown Selector
    'Points',         // Col E (5)
    'Open Date',      // Col F (6)
    'Open Time',      // Col G (7)
    'Schedule Info',  // Col H (8) - VLOOKUP Formula (*simpleSchedule*)
    'Due Date',       // Col I (9)
    'Due Time',       // Col J (10)
    'Lock Date',      // Col K (11)
    'Lock Time',      // Col L (12)
    'Sync Status'     // Col M (13)
  ];

  // Set Headers on ROW 2
  sheet.getRange(2, 1, 1, headers.length)
       .setValues([headers])
       .setFontWeight('bold')
       .setBackground('#f3f3f3');
  sheet.setFrozenRows(2);

  var urlBase = config.BASE_URL.replace(/\/$/, '');
  var nextUrl = urlBase + '/api/v1/courses/' + config.COURSE_ID + '/assignments?per_page=100';
  var allAssignments = [];

  ss.toast('Fetching assignments from Canvas...', 'Canvas Sync', -1);

  // Pagination Loop
  while (nextUrl) {
    var response = UrlFetchApp.fetch(nextUrl, {
      'method': 'get',
      'headers': { 'Authorization': 'Bearer ' + apiKey },
      'muteHttpExceptions': true
    });

    if (response.getResponseCode() !== 200) {
      ss.toast('Failed to fetch assignments: ' + response.getContentText().slice(0, 50), 'Error', 5);
      return;
    }

    var assignments = JSON.parse(response.getContentText());
    allAssignments = allAssignments.concat(assignments);

    var headersMap = response.getAllHeaders();
    var linkHeader = headersMap['Link'] || headersMap['link'];
    nextUrl = getNextPageUrl_(linkHeader);
  }

  if (allAssignments.length === 0) {
    ss.toast('No assignments found.', 'Complete', 5);
    return;
  }

  var rows = [];
  var hyperlinkFormulas = [];
  var scheduleFormulas = [];
  var tz = ss.getSpreadsheetTimeZone();
  var fetchTimestamp = 'Loaded (' + Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm:ss') + ')';

  for (var i = 0; i < allAssignments.length; i++) {
    var item = allAssignments[i];
    var rowIndex = 3 + i; // Data rows start at Row 3
    var safeName = String(item.name || 'Untitled').replace(/"/g, '""');
    var linkFormula = '=HYPERLINK("' + item.html_url + '", "' + safeName + '")';

    // Native VLOOKUP formula referencing Due Date (Col I) against *simpleSchedule* Cols C:F
    var schedFormula = '=IF(I' + rowIndex + '<>"", IFERROR(VLOOKUP(I' + rowIndex + ', \'*simpleSchedule*\'!C:F, 3, FALSE) & " : " & VLOOKUP(I' + rowIndex + ', \'*simpleSchedule*\'!C:F, 4, FALSE), "No Match"), "")';

    var subTypesString = (item.submission_types && item.submission_types.length > 0) 
      ? item.submission_types.join(', ') 
      : 'online_upload';

    // Format clean date strings ('M/d/yy') and time strings ('h:mm a') using spreadsheet timezone
    var unlockObj = formatDisplayDateTime_(item.unlock_at, tz);
    var dueObj = formatDisplayDateTime_(item.due_at, tz);
    var lockObj = formatDisplayDateTime_(item.lock_at, tz);

    rows.push([
      false, // Col A
      item.id,
      '',    // Col C Formula Placeholder
      subTypesString, // Col D
      item.points_possible !== null ? item.points_possible : '',
      unlockObj.date, // Col F: 'M/d/yy' String (e.g., 8/12/26)
      unlockObj.time, // Col G: 'h:mm a' String (e.g., 8:00 am)
      '',    // Col H Schedule Formula Placeholder
      dueObj.date,    // Col I: 'M/d/yy' String (e.g., 8/12/26)
      dueObj.time,    // Col J: 'h:mm a' String (e.g., 4:00 pm)
      lockObj.date,   // Col K: 'M/d/yy' String (e.g., 8/12/26)
      lockObj.time,   // Col L: 'h:mm a' String (e.g., 11:59 pm)
      fetchTimestamp // Col M
    ]);

    hyperlinkFormulas.push([linkFormula]);
    scheduleFormulas.push([schedFormula]);
  }

  // Write Data Starting at ROW 3
  var dataStartRow = 3;
  var totalRows = rows.length;
  sheet.getRange(dataStartRow, 1, totalRows, headers.length).setValues(rows);
  
  // Inject Formulas in Col C (Name Hyperlink) and Col H (Schedule Lookup)
  sheet.getRange(dataStartRow, 3, hyperlinkFormulas.length, 1).setFormulas(hyperlinkFormulas);
  sheet.getRange(dataStartRow, 8, scheduleFormulas.length, 1).setFormulas(scheduleFormulas);

  // Apply Submission Type Dropdown Presets
  var allowedSubTypes = [
    'online_upload',
    'online_text_entry',
    'online_url',
    'online_upload, online_text_entry',
    'online_upload, online_url',
    'online_upload, online_text_entry, online_url',
    'on_paper',
    'discussion_topic',
    'external_tool',
    'none'
  ];
  var validationRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(allowedSubTypes, true)
    .setAllowInvalid(true)
    .build();
  sheet.getRange(dataStartRow, 4, totalRows, 1).setDataValidation(validationRule);

  // Formatting & Controls
  sheet.getRange(dataStartRow, 1, totalRows, 1).insertCheckboxes();
  sheet.getRange(dataStartRow, 5, totalRows, 1).setNumberFormat('0.##');
  
  // Display Number Formatting
  sheet.getRange(dataStartRow, 6, totalRows, 1).setNumberFormat('m/d/yy');
  sheet.getRange(dataStartRow, 9, totalRows, 1).setNumberFormat('m/d/yy');
  sheet.getRange(dataStartRow, 11, totalRows, 1).setNumberFormat('m/d/yy');

  sheet.getRange(dataStartRow, 7, totalRows, 1).setNumberFormat('h:mm am/pm');
  sheet.getRange(dataStartRow, 10, totalRows, 1).setNumberFormat('h:mm am/pm');
  sheet.getRange(dataStartRow, 12, totalRows, 1).setNumberFormat('h:mm am/pm');

  // Color Coding Pairings
  sheet.getRange(dataStartRow, 6, totalRows, 2).setFontColor('#0d522c').setBackground('#e6f4ea'); // Open: Emerald/Mint
  sheet.getRange(dataStartRow, 8, totalRows, 1).setFontColor('#4a148c').setBackground('#f3e5f5'); // Schedule Info: Deep Purple Tint
  sheet.getRange(dataStartRow, 9, totalRows, 2).setFontColor('#1a73e8').setBackground('#e8f0fe'); // Due: Blue/Ice Blue
  sheet.getRange(dataStartRow, 11, totalRows, 2).setFontColor('#9c0006').setBackground('#fce8e6'); // Lock: Crimson/Red

  // Enable Interactive Filter Table across headers and data rows
  var filterRange = sheet.getRange(2, 1, totalRows + 1, headers.length);
  var currentFilter = sheet.getFilter();
  if (!currentFilter) {
    filterRange.createFilter();
  }

  ss.toast('Loaded ' + totalRows + ' assignments starting at Row 3.', 'Success', 5);
}

/**
 * Pushes updated assignment details back to Canvas API. Reads data rows starting at Row 3.
 * Merges separate Date and Time values into a single unified ISO timestamp.
 *
 * @return {void}
 */
function pushAssignmentDatesToCanvas() {
  var config = getConfig(); // from 00_Config.gs
  var userProperties = PropertiesService.getUserProperties(); // from 00_Config.gs
  var apiKey = userProperties.getProperty('CANVAS_API_KEY');
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Assignment Dates');

  if (!sheet) {
    SpreadsheetApp.getUi().alert('The "Assignment Dates" sheet does not exist.');
    return;
  }

  var lastRow = sheet.getLastRow();
  var dataStartRow = 3;

  if (lastRow < dataStartRow) {
    ss.toast('No assignment data found to push.', 'Complete', 5);
    return;
  }

  var numRowsToRead = lastRow - dataStartRow + 1;

  // Read Cols A:M values (13 cols) AND Col C formulas starting at ROW 3
  var data = sheet.getRange(dataStartRow, 1, numRowsToRead, 13).getValues();
  var nameFormulas = sheet.getRange(dataStartRow, 3, numRowsToRead, 1).getFormulas();
  var urlBase = config.BASE_URL.replace(/\/$/, '');
  var updatedCount = 0;

  ss.toast('Scanning assignments for update...', 'Canvas Sync', -1);

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var rowIndex = dataStartRow + i;
    var isChecked = row[0];        // Col A
    var assignmentId = row[1];     // Col B
    var rawNameVal = row[2];       // Col C
    var rawFormula = nameFormulas[i][0];
    var subTypeCellVal = row[3];   // Col D
    var pointsVal = row[4];        // Col E
    var openDate = row[5];         // Col F
    var openTime = row[6];         // Col G
    // Col H (index 7) is Schedule Info Formula - skipped during API push
    var dueDate = row[8];          // Col I
    var dueTime = row[9];          // Col J
    var lockDate = row[10];        // Col K
    var lockTime = row[11];        // Col L
    var statusCell = sheet.getRange(rowIndex, 13); // Col M

    if (isChecked !== true || !assignmentId) {
      continue;
    }

    var cleanName = extractNameFromCell_(rawNameVal, rawFormula);
    var subTypesArray = parseSubmissionTypesArray_(subTypeCellVal);

    var payload = {
      'assignment': {
        'name': cleanName,
        'submission_types': subTypesArray,
        'unlock_at': mergeDateAndTimeIso_(openDate, openTime),
        'due_at': mergeDateAndTimeIso_(dueDate, dueTime),
        'lock_at': mergeDateAndTimeIso_(lockDate, lockTime)
      }
    };

    if (pointsVal !== '' && !isNaN(pointsVal)) {
      payload.assignment['points_possible'] = Number(pointsVal);
    }

    var url = urlBase + '/api/v1/courses/' + config.COURSE_ID + '/assignments/' + assignmentId;
    var options = {
      'method': 'put',
      'headers': { 'Authorization': 'Bearer ' + apiKey },
      'contentType': 'application/json',
      'payload': JSON.stringify(payload),
      'muteHttpExceptions': true
    };

    try {
      var res = UrlFetchApp.fetch(url, options);
      if (res.getResponseCode() === 200) {
        var updateTimestamp = 'Updated (' + Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd HH:mm:ss') + ')';
        statusCell.setValue(updateTimestamp);
        sheet.getRange(rowIndex, 1).setValue(false); // Uncheck post-update
        updatedCount++;
      } else {
        statusCell.setValue('Failed: ' + res.getResponseCode());
      }
    } catch (e) {
      statusCell.setValue('Error: ' + e.message.slice(0, 30));
    }
  }

  ss.toast('Updated ' + updatedCount + ' assignment(s).', 'Success', 5);
}

/**
 * Formats an ISO date string into 'M/d/yy' Date string and 'h:mm a' Time string using timezone.
 *
 * @param {string} isoString Raw ISO date string from Canvas API.
 * @param {string} timeZone Spreadsheet timezone identifier string.
 * @return {Object} Object containing {date: string, time: string}.
 * @private
 */
function formatDisplayDateTime_(isoString, timeZone) {
  if (!isoString) return { date: '', time: '' };
  var d = new Date(isoString);
  if (isNaN(d.getTime())) return { date: '', time: '' };

  var dateStr = Utilities.formatDate(d, timeZone, 'M/d/yy');
  var timeStr = Utilities.formatDate(d, timeZone, 'h:mm a').toLowerCase();

  return { date: dateStr, time: timeStr };
}

/**
 * Combines separate Date and Time values into a single ISO 8601 string payload.
 * Supports both 24-hour ('16:00:00') and 12-hour ('4:00 pm') time formats.
 *
 * @param {Date|string} dateVal Pure date string or object.
 * @param {Date|string} timeVal Time string or fraction.
 * @return {string|null} Combined ISO string or null.
 * @private
 */
function mergeDateAndTimeIso_(dateVal, timeVal) {
  if (!dateVal) return null;

  var baseDate = (dateVal instanceof Date) ? new Date(dateVal.getTime()) : new Date(dateVal);
  if (isNaN(baseDate.getTime())) return null;

  if (timeVal) {
    if (timeVal instanceof Date) {
      baseDate.setHours(timeVal.getHours(), timeVal.getMinutes(), timeVal.getSeconds());
    } else {
      var str = String(timeVal).trim().toLowerCase();
      var isPm = str.indexOf('pm') !== -1;
      var isAm = str.indexOf('am') !== -1;
      var cleanStr = str.replace(/[^\d:]/g, '');
      var parts = cleanStr.split(':');

      if (parts.length >= 2) {
        var h = parseInt(parts[0], 10) || 0;
        var m = parseInt(parts[1], 10) || 0;
        var s = parts.length > 2 ? (parseInt(parts[2], 10) || 0) : 0;

        if (isPm && h < 12) h += 12;
        if (isAm && h === 12) h = 0;

        baseDate.setHours(h, m, s);
      }
    }
  }

  return baseDate.toISOString();
}

/**
 * Parses a comma-separated cell value string into an array of submission type strings.
 *
 * @param {string} cellVal Raw string from cell.
 * @return {Array<string>} Cleaned array of submission type codes.
 * @private
 */
function parseSubmissionTypesArray_(cellVal) {
  if (!cellVal) return ['online_upload'];
  var parts = String(cellVal).split(',');
  var result = [];
  for (var i = 0; i < parts.length; i++) {
    var trimmed = parts[i].trim();
    if (trimmed !== "") {
      result.push(trimmed);
    }
  }
  return result.length > 0 ? result : ['online_upload'];
}

/**
 * Extracts pure string title from plain text or a HYPERLINK formula string.
 *
 * @param {string} displayValue Cell displayed text.
 * @param {string} formulaValue Cell formula string (if present).
 * @return {string} Sanitized assignment title string.
 * @private
 */
function extractNameFromCell_(displayValue, formulaValue) {
  if (formulaValue && formulaValue.indexOf('=HYPERLINK') === 0) {
    var match = formulaValue.match(/=HYPERLINK\(\s*".*?"\s*,\s*"(.*)"\s*\)/i);
    if (match && match[1]) {
      return match[1].replace(/""/g, '"').trim();
    }
  }
  return String(displayValue || 'Untitled').trim();
}

/**
 * Extracts the "next" page URL from HTTP Link Header for Canvas API pagination.
 *
 * @param {string} header The raw HTTP Link header.
 * @return {string|null} Next page URL or null if on final page.
 * @private
 */
function getNextPageUrl_(header) {
  if (!header) return null;
  var links = header.split(',');
  for (var i = 0; i < links.length; i++) {
    var parts = links[i].split(';');
    if (parts.length < 2) continue;
    if (parts[1].indexOf('rel="next"') !== -1) {
      return parts[0].trim().replace(/^<|>$/g, '');
    }
  }
  return null;
}