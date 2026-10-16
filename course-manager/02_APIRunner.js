/**
 * 02_APIRunner.gs
 * This file contains the primary functions responsible for executing API requests to the Canvas LMS.
 * It manages authentication, request processing, pagination, and error reporting.
 */

function sendCanvasRequest(url, method, apiKey, payload, statusCell, successText) {
  var options = {
    'method': method,
    'headers': { 'Authorization': 'Bearer ' + apiKey },
    'contentType': 'application/json',
    'payload': JSON.stringify(payload),
    'muteHttpExceptions': true
  };
  try {
    var response = UrlFetchApp.fetch(url, options);
    var result = JSON.parse(response.getContentText());
    if ((response.getResponseCode() === 201 || result.html_url)) {
      statusCell.setFormula('=HYPERLINK("' + result.html_url + '", "' + successText + '")');
    } else {
      statusCell.setValue('Failed: ' + response.getContentText().slice(0, 50));
    }
  } catch (err) {
    statusCell.setValue('Error: ' + err.message.slice(0, 50));
  }
}

function processUnifiedSheetForCanvasWithLinks() {
  var config = getConfig();
  var userProperties = PropertiesService.getUserProperties();
  var ui = SpreadsheetApp.getUi();

  var apiKey = userProperties.getProperty('CANVAS_API_KEY');
  var courseId = config.COURSE_ID;
  var urlBase = config.BASE_URL.replace(/\/$/, '');

  if (!apiKey || !courseId || !urlBase) {
    ui.alert('Error', 'Missing Course ID, API Key, or Base URL in Config.', ui.ButtonSet.OK);
    return;
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var selection = sheet.getActiveRange();
  var startRow = selection.getRow();
  var numRows = selection.getNumRows();

  var data = sheet.getRange(startRow, 1, numRows, 9).getValues();
  ss.toast('Processing ' + numRows + ' row(s)...', 'Canvas Sync', -1);

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var rowIndex = startRow + i;

    var calendarChecked = row[0]; 
    var announceChecked = row[1]; 
    var title = row[2];           
    var body = row[3];            
    var eventDate = row[4];       
    var delayedPost = row[5];     
    var allowReplies = (row[6] === true); 

    var calendarStatusCell = sheet.getRange(rowIndex, 8);
    var announceStatusCell = sheet.getRange(rowIndex, 9);

    if (!title) continue;

    if (calendarChecked === true) {
      var calendarPayload = {
        'calendar_event': {
          'context_code': 'course_' + courseId,
          'title': title || 'Calendar Event',
          'description': body || '',
          'start_at': (eventDate && eventDate.toISOString) ? eventDate.toISOString() : (eventDate || ''),
          'all_day': true
        }
      };

      var calUrl = urlBase + '/api/v1/calendar_events';
      sendCanvasRequest(calUrl, 'post', apiKey, calendarPayload, calendarStatusCell, "View Event");
    } else {
      calendarStatusCell.setValue('');
    }

    if (announceChecked === true) {
      var announcePayload = {
        'title': title,
        'message': body,
        'is_announcement': true,
        'allow_student_to_reply': allowReplies
      };
      if (delayedPost) {
        announcePayload['delayed_post_at'] = (delayedPost.toISOString) ? delayedPost.toISOString() : delayedPost;
      }

      var annUrl = urlBase + '/api/v1/courses/' + courseId + '/discussion_topics';
      sendCanvasRequest(annUrl, 'post', apiKey, announcePayload, announceStatusCell, "View Announcement");
    } else {
      announceStatusCell.setValue('');
    }
  }
  ss.toast('Sync Complete: ' + numRows + ' row(s) processed.', 'Success', 5);
}

/**
 * Executes API operations from selected rows, creates target sheets if missing,
 * and hands off response payloads to the structural JSON parser.
 *
 * @param {void}
 * @return {void}
 */
function performCanvasApiOperation() {
  var userProperties = PropertiesService.getUserProperties();
  var canvasApiToken = userProperties.getProperty('CANVAS_API_KEY');
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var config = getConfig();
  var baseUrl = config.BASE_URL;

  // --- SECURITY AUDIT CHECK ---
  if (!canvasApiToken || !baseUrl) {
    ss.toast("API Key or Base URL not set. Please populate the *Config* sheet.", "🚨 Configuration Error", 8);
    return;
  }

  var sheet = ss.getActiveSheet();
  if (sheet.getName() !== 'API Batch') {
    ss.toast("Access Restriction: This function must be executed on the 'API Batch' sheet.", "🛑 Error", 5);
    return;
  }

  var activeRange = sheet.getActiveRange();
  var startRow = activeRange.getRow();
  var numRows = activeRange.getNumRows();
  var totalCalls = 0;
  var insertedRowsOffset = 0;

  var data = sheet.getRange(startRow, 1, numRows, 6).getValues();

  for (var i = 0; i < numRows; i++) {
    var currentRowIndex = startRow + i + insertedRowsOffset;
    var row = data[i];

    var operation = String(row[0]).trim().toUpperCase();
    var rawEndpoint = row[1] ? String(row[1]).trim() : '';
    var payload = row[2];
    var sheetToReportTo = String(row[5]).trim();

    if (!operation || !rawEndpoint) continue;

    var cleanedEndpoint = rawEndpoint
      .replace(/^(https?:\/\/[^\/]+)?(\/)?(api\/v1\/)?/, '')
      .split(/\s+/)[0]
      .replace(/\/$/, '');

    var url = baseUrl + '/api/v1/' + cleanedEndpoint;
    var options = {
      'method': operation.toLowerCase(),
      'headers': { 'Authorization': 'Bearer ' + canvasApiToken },
      'muteHttpExceptions': true
    };

    if (operation === 'POST' || operation === 'PUT') {
      if (typeof payload === 'string' && payload.trim().startsWith('{')) {
        options.contentType = 'application/json';
        options.payload = payload;
      } else {
        options.contentType = 'application/x-www-form-urlencoded';
        options.payload = payload;
      }
    }

    // --- WORKSPACE VERIFICATION: AUTO-CREATE REPORT SHEET ---
    var targetSheet;
    if (sheetToReportTo) {
      targetSheet = ss.getSheetByName(sheetToReportTo);
      if (!targetSheet) {
        // Create the reporting sheet if it does not exist
        targetSheet = ss.insertSheet(sheetToReportTo);
        // Clear old structural headers if it's a fresh initialization
        targetSheet.clear(); 
        ss.toast("Created missing reporting sheet: '" + sheetToReportTo + "'", "📁 Workspace Updated", 4);
      }
    } else {
      targetSheet = sheet;
    }

    var nextUrl = url;
    var pageCounter = 0;
    var accumulatedResponses = [];

    do {
      pageCounter++;
      if (pageCounter > 1) url = nextUrl;
      totalCalls++;

      var response = UrlFetchApp.fetch(url, options);
      var responseCode = response.getResponseCode();
      var responseBody = response.getContentText();

      var targetRow = currentRowIndex;
      if (pageCounter > 1 && targetSheet.getName() === sheet.getName()) {
        targetSheet.insertRowAfter(targetRow);
        targetRow++;
        insertedRowsOffset++;
      }

      // Log metadata confirmation directly back to execution context row
      logResponse({
        sheet: sheet, // Always log status code to the manager row
        rowIndex: targetRow,
        responseCode: responseCode,
        responseBody: responseBody.substring(0, 100) + "...", // Keep grid light weight
        endpoint: cleanedEndpoint
      });

      if (responseCode >= 200 && responseCode < 300) {
        accumulatedResponses.push(responseBody);
        
        if (operation === 'GET') {
          var headers = response.getAllHeaders();
          var linkHeader = headers['Link'] || headers['link']; 
          nextUrl = getNextUrl(linkHeader);
        } else {
          nextUrl = null;
        }
      } else {
        nextUrl = null;
      }

    } while (nextUrl);

    // --- INTEGRATION: HANDOFF TO THE CONSOLIDATED PARSER ---
    if (sheetToReportTo && accumulatedResponses.length > 0) {
      ss.toast("Parsing data arrays to target sheet...", "⚡ Structural Processing", 3);
      parseCombinedJsonToSheet(accumulatedResponses, targetSheet);
    }
  }

  ss.toast('Batch Engine Complete. ' + totalCalls + ' items run.', '✅ Success', 5);
}

/**
 * Structural Array Parser: Transforms accumulated JSON page chunks into rows and columns
 *
 * @param {Array<string>} responseTextArray Array of raw JSON strings collected from endpoints
 * @param {Sheet} targetSheet The Google Sheets UI instance where records should be populated
 * @return {void}
 */
function parseCombinedJsonToSheet(responseTextArray, targetSheet) {
  var allRecords = [];
  
  // 1. Unify multiple pagination pages into a single flat array
  for (var i = 0; i < responseTextArray.length; i++) {
    try {
      var parsed = JSON.parse(responseTextArray[i]);
      if (Array.isArray(parsed)) {
        allRecords = allRecords.concat(parsed);
      } else if (parsed && typeof parsed === 'object') {
        allRecords.push(parsed);
      }
    } catch(e) {
      Logger.log("Failed parsing JSON chunk index " + i + ": " + e.message);
    }
  }

  if (allRecords.length === 0) return;

  // 2. Extract uniquely indexed headers from keys across the JSON collection
  var headerMap = {};
  allRecords.forEach(function(record) {
    Object.keys(record).forEach(function(key) {
      headerMap[key] = true;
    });
  });
  var headers = Object.keys(headerMap);

  // 3. Map records into row vectors matching the generated header layout array
  var rows = [];
  allRecords.forEach(function(record) {
    var row = headers.map(function(header) {
      var val = record[header];
      // Flatten arrays or sub-objects (like 'enrollments' or 'calendar') into strings
      if (typeof val === 'object' && val !== null) {
        return JSON.stringify(val);
      }
      return val === undefined ? "" : val;
    });
    rows.push(row);
  });

  // 4. Atomic batch write operation to the destination sheet grid
  targetSheet.clearContents();
  targetSheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
  targetSheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  targetSheet.autoResizeColumns(1, headers.length);
}

/**
 * Helper function to extract the URL for the next page from the Link header. 3
 *
 * Helper used internally by performCanvasApiOperation to parse the HTTP Link header returned by 
 * Canvas and find the URL for the next page of results during pagination 4.
 *
 * @param {string} linkHeader The HTTP Link header value from the Canvas API response.
 * @returns {string|null} The URL for the next page, or null if not found.
 */
function getNextUrl(linkHeader) {
  if (!linkHeader) {
    return null;
  }

  var parts = linkHeader.split(',');
  for (var i = 0; i < parts.length; i++) {
    var part = parts[i].trim();
    if (part.indexOf('rel="next"') !== -1) {
      var match = part.match(/<([^>]+)>/);
      if (match && match[1]) {
        return match[1];
      }
    }
  }
  return null;
}