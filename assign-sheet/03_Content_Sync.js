/* 03_Content_Sync.gs */

/**
 * 1. MASTER STABILIZATION WRAPPER
 * Runs the "Copy Content" routine for all four quarters.
 * Usage: Call this to back up/stabilize your manual content columns.
 */
function runContentCopyForAllQuarters() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
  
  SpreadsheetApp.getActive().toast('Starting Content Stabilization...', 'Sync', 60);
  Logger.log("STARTING MASTER CONTENT STABILIZATION LOOP...");

  quarters.forEach(function(qName) {
    var sourceSheetName = '*' + qName + '*'; // e.g., *Q1*
    var destSheetName = qName;               // e.g., Q1
    
    var destSheet = ss.getSheetByName(destSheetName);
    var sourceSheet = ss.getSheetByName(sourceSheetName);

    if (!destSheet || !sourceSheet) {
      Logger.log("Skipping: " + destSheetName + " (Source or Dest missing)");
      return;
    }

    // Execute the copy for this quarter
    copyContentColumns(sourceSheetName);
    SpreadsheetApp.flush();
  });

  Logger.log("MASTER CONTENT STABILIZATION COMPLETE.");
  SpreadsheetApp.getActive().toast('Content Stabilization Complete.', 'Success', 5);
}


/**
 * 2. CANVAS SYNC
 * Processes selected rows to create Calendar Events and Announcements in Canvas.
 * UPDATED: Uses 'toast' to prevent UI freezing.
 */
function processUnifiedSheetForCanvasWithLinks() {
  var config = getConfig(); // from 00_Config.gs
  var userProperties = PropertiesService.getUserProperties();
  
  // We don't strictly need 'ui' for alerts anymore, but we keep it for the initial error check.
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

  // Read 9 columns (A:I) starting from the selected row
  var data = sheet.getRange(startRow, 1, numRows, 9).getValues();
  
  // Toast to let user know it started
  ss.toast('Processing ' + numRows + ' row(s)...', 'Canvas Sync', -1);

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var rowIndex = startRow + i;

    var calendarChecked = row[0]; // Col A
    var announceChecked = row[1]; // Col B
    var title = row[2];           // Col C
    var body = row[3];            // Col D
    var eventDate = row[4];       // Col E
    var delayedPost = row[5];     // Col F
    var allowReplies = (row[6] === true); // Col G

    // Status output cells: H and I
    var calendarStatusCell = sheet.getRange(rowIndex, 8);
    var announceStatusCell = sheet.getRange(rowIndex, 9);

    if (!title) continue;

    // --- A. Calendar Event ---
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

    // --- B. Announcement ---
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
  
  // FINAL SUCCESS MESSAGE (Non-blocking)
  ss.toast('Sync Complete: ' + numRows + ' row(s) processed.', 'Success', 5);
}

/**
 * 3. COPY CONTENT COLUMNS (Internal Logic)
 * Copies static data (C, D, E...) from source *Q1* to destination Q1.
 */
function copyContentColumns(sourceSheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var destSheet = ss.getActiveSheet(); 
  var sourceSheet = ss.getSheetByName(sourceSheetName);

  if (!sourceSheet) return;

  var SOURCE_DATA_START_ROW = 3;
  var DEST_WRITE_START_ROW = 4;
  
  var destHeaders = destSheet.getRange(2, 1, 1, destSheet.getLastColumn()).getValues()[0];
  var lastDayCodeRow = findLastDataRow(destSheet, 1);
  var numRowsToCopy = lastDayCodeRow - DEST_WRITE_START_ROW + 1;

  if (numRowsToCopy <= 0) return;

  // Loop through headers starting at Column C (index 2)
  for (var colIndex = 2; colIndex < destHeaders.length; colIndex++) {
    var headerText = String(destHeaders[colIndex]).trim();
    if (headerText === "") break;

    var sourceColIndex = findColumnIndexByHeader(sourceSheet, headerText);
    if (sourceColIndex === -1) continue;

    var sourceRange = sourceSheet.getRange(SOURCE_DATA_START_ROW, sourceColIndex + 1, numRowsToCopy, 1);
    var valuesToCopy = sourceRange.getValues();
    
    destSheet.getRange(DEST_WRITE_START_ROW, colIndex + 1, numRowsToCopy, 1).setValues(valuesToCopy);
  }
  Logger.log("Copied content for " + destSheet.getName());
}

/**
 * 4. COPY FINAL ASSIGNMENT DATA
 * Updates the Day Code and Formatted Text columns (A & B) in the Q sheets.
 */
function copyFinalAssignmentData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
  
  quarters.forEach(function(qName) {
    var sourceSheetName = '*' + qName + '*';
    var destSheet = ss.getSheetByName(qName);
    var sourceSheet = ss.getSheetByName(sourceSheetName);
    
    if (!sourceSheet || !destSheet) return;

    var periodPairLabel = destSheet.getRange('B2').getValue();
    if (!periodPairLabel) return;

    var sourceColIndex = findColumnIndexByHeader(sourceSheet, periodPairLabel);
    if (sourceColIndex === -1) return;

    var lastDataRow = findLastDataRow(sourceSheet, 1);
    var numRows = lastDataRow - 2; // (Start Row 3 - 1)

    if (numRows < 1) return;

    // Read Col A (DayCode) and Dynamic Col (Text)
    var sourceRange = sourceSheet.getRange(3, 1, numRows, sourceColIndex + 1);
    var data = sourceRange.getValues();
    var pasteArray = [];

    for (var i = 0; i < data.length; i++) {
      var dayCode = data[i][0];
      var text = data[i][sourceColIndex];
      pasteArray.push([dayCode, text]);
    }

    destSheet.getRange(4, 1, pasteArray.length, 2).setValues(pasteArray);
  });
  Logger.log("Assignment Data Copied.");
}

// --- SHARED HELPERS ---

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

function findColumnIndexByHeader(sheet, headerText) {
  if (!sheet) return -1;
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var cleanSearch = String(headerText).replace(/[^0-9,]/g, '').trim();
  
  for (var i = 0; i < headers.length; i++) {
    // Try exact match first, then clean match
    if (String(headers[i]).trim() === String(headerText).trim()) return i;
    if (String(headers[i]).replace(/[^0-9,]/g, '').trim() === cleanSearch) return i;
  }
  return -1;
}

function findLastDataRow(sheet, colIndex) {
  if (!sheet) return 0;
  var values = sheet.getRange(1, colIndex, sheet.getMaxRows(), 1).getValues();
  for (var i = values.length - 1; i >= 0; i--) {
    if (String(values[i][0]).trim() !== "") return i + 1;
  }
  return 0;
}