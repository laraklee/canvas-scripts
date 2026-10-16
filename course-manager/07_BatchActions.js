/**
 * 07_BatchActions.gs
 * This file contains high-level functions for batch processing, including posting comments,
 * synchronizing grades, fetching quarter grades, and generating PDF reports.
 *
 * * Dependencies:
 * - getConfig() (00_Config.gs)
 * - getStudentGradesLocal() (grades.gs - to be integrated later)
 * - exportSheetAsPDF() (utility.gs - to be integrated later)
 */

// --- 1. BATCH COMMENTING ---

/**
 * Posts comments written in the active column (Column X) to Canvas submissions. 
 * Assumes Assignment ID is in Row 2 of the active column, and student data starts in Row 3. 61
 */
function postBatchCommentsForAssignmentActiveColumn() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var ui = SpreadsheetApp.getUi();
  
  var activeCol = sheet.getActiveCell().getColumn();
  var assignmentId = sheet.getRange(2, activeCol).getValue(); // Reading ID from Row 2
  
  if (!assignmentId) {
    // FIX 1: Replaced ui.alert with ss.toast
    ss.toast('Assignment ID missing from Row 2 of active column.', '🛑 Error', 5);
    return;
  }
  
  var config = getConfig();
  var baseUrl = config.BASE_URL.replace(/\/$/, '');
  var apiKey = PropertiesService.getUserProperties().getProperty('CANVAS_API_KEY');
  var courseId = config.COURSE_ID;
  
  if (!apiKey || !courseId) {
    // FIX 2: Replaced ui.alert with ss.toast
    ss.toast('API Key or Course ID is missing. Check configuration.', '🚨 Configuration Error', 8);
    return;
  }
  
  var statusCol = activeCol + 1; // Status column is Active Column + 1
  var firstDataRow = 3;
  var lastRow = sheet.getLastRow();
  
  var userIds = sheet.getRange(firstDataRow, 1, lastRow - firstDataRow + 1, 1).getValues().flat(); // Col A has UserIDs
  var comments = sheet.getRange(firstDataRow, activeCol, lastRow - firstDataRow + 1, 1).getValues().flat();
  
  var successCount = 0;
  
  // Display a toast to indicate the start of the batch process
  ss.toast('Starting batch comment post for ' + userIds.length + ' students...', 'Progress', 10);
  
  for (var i = 0; i < userIds.length; i++) {
    var userId = userIds[i];
    var comment = comments[i];
    var statusCell = sheet.getRange(firstDataRow + i, statusCol);
    
    // Skip if no UserID or no comment provided
    if (!userId || !comment) {
      statusCell.setValue('');
      continue;
    }
    
    var url = baseUrl + '/api/v1/courses/' + courseId + '/assignments/' + assignmentId + '/submissions/' + userId;
    
    var payload = {
      comment: {
        text_comment: String(comment).trim()
      }
    };
    
    var options = {
      'method': 'put', // Use PUT to update the submission with a comment
      'headers': {
        'Authorization': 'Bearer ' + apiKey
      },
      'contentType': 'application/json',
      'payload': JSON.stringify(payload),
      'muteHttpExceptions': true
    };
    
    try {
      var response = UrlFetchApp.fetch(url, options);
      var code = response.getResponseCode();
      
      if (code >= 200 && code < 300) {
        statusCell.setValue('Commented');
        successCount++;
      } else {
        statusCell.setValue('API Error: ' + code);
        Logger.log('Error posting comment for User ' + userId + ' (Code ' + code + '): ' + response.getContentText().slice(0, 100));
      }
    } catch (err) {
      statusCell.setValue('Failed');
      Logger.log('System error posting comment for User ' + userId + ': ' + err.message);
    }
  }
  
  ss.toast('Batch Comment Complete! Posted ' + successCount + ' comments.', '✅ Complete', 5);
}

/**
 * Prompts the user for an Assignment ID and Comment, then posts that single comment 
 * to ALL student submissions in the course roster (Col A). 68
 */
function promptAndConfirmBatchCommentToAllStudents() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var ui = SpreadsheetApp.getUi();
  
  // Step 1: Prompt for Assignment ID (MUST BE BLOCKING)
  var assignPrompt = ui.prompt("Canvas Batch Comment", "Enter the Assignment ID:", ui.ButtonSet.OK_CANCEL);
  if (assignPrompt.getSelectedButton() !== ui.Button.OK) return;
  var assignmentId = assignPrompt.getResponseText().trim();
  if (!assignmentId) {
    // FIX 1: Replaced ui.alert with ss.toast
    ss.toast("No Assignment ID provided.", "🛑 Error", 5);
    return;
  }
  
  // Step 2: Prompt for Comment (MUST BE BLOCKING)
  var commentPrompt = ui.prompt("Canvas Batch Comment", "Enter the comment to post to ALL students:", ui.ButtonSet.OK_CANCEL);
  if (commentPrompt.getSelectedButton() !== ui.Button.OK) return;
  var comment = commentPrompt.getResponseText().trim();
  if (!comment) {
    // FIX 2: Replaced ui.alert with ss.toast
    ss.toast("No comment provided.", "🛑 Error", 5);
    return;
  }

  // Step 3: Get Configuration and Roster
  var config = getConfig();
  var baseUrl = config.BASE_URL.replace(/\/$/, '');
  var apiKey = PropertiesService.getUserProperties().getProperty('CANVAS_API_KEY');
  var courseId = config.COURSE_ID;
  
  if (!apiKey || !courseId) {
    // FIX 3: Replaced ui.alert with ss.toast
    ss.toast('API Key or Course ID is missing. Check configuration.', '🚨 Configuration Error', 8);
    return;
  }
  
  var firstDataRow = 3;
  var lastRow = sheet.getLastRow();
  // We assume the roster list (User ID) is in Column A
  var userIds = sheet.getRange(firstDataRow, 1, lastRow - firstDataRow + 1, 1).getValues().flat().filter(id => id);
  
  // Step 4: Confirmation (MUST BE BLOCKING)
  var confirmation = ui.alert(
    "CONFIRM ACTION",
    "You are about to post the SAME comment to " + userIds.length + " student submissions for Assignment ID: " + assignmentId + ".\n\nContinue?",
    ui.ButtonSet.YES_NO
  );
  if (confirmation !== ui.Button.YES) return;

  var successCount = 0;
  ss.toast('Starting batch post to ' + userIds.length + ' students...', 'Progress', 10);
  
  // The payload is the same for every student
  var payload = {
    comment: {
      text_comment: comment
    }
  };

  for (var i = 0; i < userIds.length; i++) {
    var userId = userIds[i];
    
    var url = baseUrl + '/api/v1/courses/' + courseId + '/assignments/' + assignmentId + '/submissions/' + userId;
    
    var options = {
      'method': 'put',
      'headers': {
        'Authorization': 'Bearer ' + apiKey
      },
      'contentType': 'application/json',
      'payload': JSON.stringify(payload),
      'muteHttpExceptions': true
    };
    
    try {
      var response = UrlFetchApp.fetch(url, options);
      if (response.getResponseCode() >= 200 && response.getResponseCode() < 300) {
        successCount++;
      } else {
        Logger.log('Failed to post comment for User ' + userId + ' (Code ' + response.getResponseCode() + ').');
      }
    } catch (err) {
      Logger.log('System error posting comment for User ' + userId + ': ' + err.message);
    }
  }
  
  var finalMessage = 'Batch Complete! Successfully posted comment to ' + successCount + ' students.';
  // FIX 4: Replaced ui.alert with ss.toast for final confirmation
  ss.toast(finalMessage, '✅ Complete', 5); 
}


// --- 2. BATCH GRADE SYNC ---

/**
 * Fetches the current grade from Canvas for all students for the Assignment ID defined in Row 2 
 * of the active column. 65
 */
function syncGradesAndStatusForAssignmentActiveColumn() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var ui = SpreadsheetApp.getUi();

  var config = getConfig();
  var baseUrl = config.BASE_URL.replace(/\/$/, '');
  var apiKey = PropertiesService.getUserProperties().getProperty('CANVAS_API_KEY');
  var courseId = config.COURSE_ID;

  var activeCol = sheet.getActiveCell().getColumn();
  var assignmentId = sheet.getRange(2, activeCol).getValue(); // Reading ID from Row 2
  
  if (!assignmentId) {
    // FIX 1: Replaced ui.alert with ss.toast
    ss.toast('Assignment ID missing from Row 2 of active column.', '🛑 Error', 5);
    return;
  }
  
  // Check Config (if not checked in postBatchCommentsForAssignmentActiveColumn)
  if (!apiKey || !courseId) {
    ss.toast('API Key or Course ID is missing. Check configuration.', '🚨 Configuration Error', 8);
    return;
  }


  var firstDataRow = 3;
  var lastRow = sheet.getLastRow();
  var userIds = sheet.getRange(firstDataRow, 1, lastRow - firstDataRow + 1, 1).getValues().flat().filter(id => id); // Col A has UserIDs
  
  var successCount = 0;
  ss.toast('Starting grade synchronization for ' + userIds.length + ' students...', 'Progress', 10);
  
  for (var i = 0; i < userIds.length; i++) {
    var userId = userIds[i];
    var gradeCell = sheet.getRange(firstDataRow + i, activeCol);

    if (!userId) {
      gradeCell.setValue('');
      continue;
    }

    var submissionUrl = baseUrl + '/api/v1/courses/' + courseId + '/assignments/' + assignmentId + '/submissions/' + userId;
    
    var options = {
      'method': 'get',
      'headers': {
        'Authorization': 'Bearer ' + apiKey
      },
      'muteHttpExceptions': true
    };
    
    try {
      var response = UrlFetchApp.fetch(submissionUrl, options);
      if (response.getResponseCode() == 200) {
        var submissionData = JSON.parse(response.getContentText());
        
        // --- GRADE WRITE ---
        // Prioritize score, then grade string
        if (submissionData.score !== undefined && submissionData.score !== null) {
          gradeCell.setValue(submissionData.score);
        } else if (submissionData.grade !== undefined && submissionData.grade !== null) {
          gradeCell.setValue(submissionData.grade);
        } else {
          gradeCell.setValue('');
        }
        successCount++;
      } else {
        gradeCell.setValue('API Err: ' + response.getResponseCode());
      }
    } catch (err) {
      gradeCell.setValue('Failed');
      Logger.log('Grade sync failed for User ' + userId + ': ' + err.message);
    }
  }
  
  ss.toast('Batch Complete! ' + successCount + ' grades synchronized.', '✅ Complete', 5);
}

/**
 * Prompts the user to select a Grading Period using the ROBUST Browser.inputBox, 
 * fetches ALL course scores in one batch, and maps them to students.
 * Optimized with Toasts to prevent the "Working" spinner hang.
 */
/**
 * Fetches course scores in one batch and writes them to the active column.
 * Optimized with a Surgical Write and Focus Shift to kill the "Working" spinner.
 */
function fillGradesForSelectedGradingPeriodInActiveColumn() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var ui = SpreadsheetApp.getUi();

  // --- 1. Load Configuration & Prerequisites ---
  var gradingSheet = ss.getSheetByName('*gradingPeriods*');
  if (!gradingSheet) {
    ss.toast('Missing prerequisite sheet: *gradingPeriods*.', '🛑 Error', 8);
    return;
  }
  
  var lastGradingRow = gradingSheet.getLastRow();
  if (lastGradingRow < 2) {
    ss.toast('The *gradingPeriods* sheet is empty.', '🛑 Error', 8);
    return;
  }

  var gradingData = gradingSheet.getRange(2, 1, lastGradingRow - 1, 2).getValues();
  var validPeriods = gradingData.filter(function(row) { return row[0] && row[1]; });

  var promptText = validPeriods.map(function(row, i) {
    return (i + 1) + ": " + row[1];
  }).join('\n');
  
  // --- 2. Prompt for Selection (Modern UI) ---
  var response = ui.prompt(
    'Choose Grading Period',
    'Enter the number for the grading period to fetch grades for:\n\n' + promptText,
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() !== ui.Button.OK) return;
  
  var index = parseInt(response.getResponseText().trim(), 10) - 1;
  if (isNaN(index) || index < 0 || index >= validPeriods.length) {
    ss.toast('Invalid selection.', '🛑 Error', 5);
    return;
  }
  
  var gradingPeriodId = validPeriods[index][0]; 
  var gradingPeriodTitle = validPeriods[index][1];

  // --- 3. Load Config ---
  var config = getConfig(); // cite: 1118
  var baseUrl = config.BASE_URL ? config.BASE_URL.replace(/\/+$/, '') : ""; // cite: 1119
  var apiKey = PropertiesService.getUserProperties().getProperty('CANVAS_API_KEY'); // cite: 1120
  var courseId = config.COURSE_ID; // cite: 1121
  
  if (!apiKey || !courseId) {
    ss.toast('Missing API Key or Course ID in Config.', '🚨 Config Error', 8);
    return;
  }

  // --- 4. Batch Fetch Grades ---
  ss.toast('Fetching scores for ' + gradingPeriodTitle + '...', '⏳ Connecting');
  
  var url = baseUrl + '/api/v1/courses/' + courseId + '/enrollments?type[]=StudentEnrollment&grading_period_id=' + gradingPeriodId + '&per_page=100';
  var allEnrollments = [];

  try {
    while (url) {
      var res = UrlFetchApp.fetch(url, {
        'method': 'get',
        'headers': { 'Authorization': 'Bearer ' + apiKey },
        'muteHttpExceptions': true
      });
      if (res.getResponseCode() !== 200) throw new Error('API Error ' + res.getResponseCode());
      
      allEnrollments = allEnrollments.concat(JSON.parse(res.getContentText()));
      url = getNextUrlLocal(res.getHeaders()['Link']); // cite: 1133-1135
    }
  } catch (err) {
    ss.toast('API Failed: ' + err.message, '🔥 Error', 10);
    return;
  }

  // --- 5. Map Grades in Memory ---
  var gradeMap = {};
  allEnrollments.forEach(function(e) {
    if (e.user_id && e.grades) {
      gradeMap[e.user_id] = (e.grades.current_score !== null) ? e.grades.current_score : "N/A";
    }
  });

  // --- 6. Write Grades (Surgical Write & Range Optimization) ---
  var firstDataRow = 3;
  var lastRow = sheet.getLastRow();
  if (lastRow < firstDataRow) return;

  var idRange = sheet.getRange(firstDataRow, 1, lastRow - firstDataRow + 1, 1);
  var idValues = idRange.getValues(); 
  var stats = { found: 0, na: 0, missing: 0 };

  var outputValues = idValues.map(function(row) {
    var userId = row[0];
    if (!userId) return [""]; 
    if (gradeMap.hasOwnProperty(userId)) {
      var val = gradeMap[userId];
      val === "N/A" ? stats.na++ : stats.found++;
      return [val];
    }
    stats.missing++;
    return ["Not Found"];
  });

  var activeCol = sheet.getActiveCell().getColumn();
  var targetRange = sheet.getRange(firstDataRow, activeCol, outputValues.length, 1);

  // SURGICAL STEP: Clear before write to break formula/metadata loops
  targetRange.clearContent();
  SpreadsheetApp.flush(); 
  targetRange.setValues(outputValues);

  // --- 7. Final Sync & Focus Shift (The "Spinner Killer") ---
  SpreadsheetApp.flush(); 

  // Move selection to a neutral zone to force the browser to release the column focus
  sheet.getRange(1, 1).activate(); 

  var summary = "Found: " + stats.found + " | N/A: " + stats.na + " | Missing: " + stats.missing;
  ss.toast(summary, '✅ Sync Complete: ' + gradingPeriodTitle, 8);
}

// Ensure this helper is present if you aren't loading it from another file
function getNextUrlLocal(linkHeader) {
  if (!linkHeader) return null;
  var links = linkHeader.split(',');
  for (var i = 0; i < links.length; i++) {
    var parts = links[i].split(';');
    if (parts[1] && parts[1].indexOf('rel="next"') !== -1) {
      return parts[0].replace(/[<>]/g, '').trim();
    }
  }
  return null;
}

/**
 * Local Helper: Extracts the next pagination URL from the Canvas HTTP Link header.
 * Included here to ensure the function works standalone.
 */
function getNextUrlLocal(linkHeader) {
  if (!linkHeader) return null;
  var links = linkHeader.split(',');
  for (var i = 0; i < links.length; i++) {
    var parts = links[i].split(';');
    // Look for rel="next"
    if (parts[1] && parts[1].indexOf('rel="next"') !== -1) {
      return parts[0].replace(/[<>]/g, '').trim();
    }
  }
  return null;
}


// --- 3. BATCH PDF EXPORT ---

/**
 * Processes a list of Student IDs, runs grade retrieval, and exports a PDF for each. 
 * Configuration (source sheet name, folder ID) is read from the active sheet. 58
 */
function batchExportAllStudentGrades() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var activeSheet = ss.getActiveSheet();
  var ui = SpreadsheetApp.getUi();
  
  var STATUS_CELL = "F1"; // Cell for displaying real-time status/progress

  // --- 1. Get configuration details ---
  var sourceSheetName = activeSheet.getRange("B4").getValue(); // Sheet name containing *peopleList* data
  var studentIdCell = activeSheet.getRange("C1"); // Cell where the student ID is written on the report sheet
  var gradeReportSheetName = activeSheet.getRange("B2").getValue(); // Name of the sheet to be exported as PDF
  var gradeReportSheet = ss.getSheetByName(gradeReportSheetName);

  if (!gradeReportSheet) {
    // FIX 1: Replaced ui.alert with ss.toast
    ss.toast("Grade Report sheet named in B2 ('" + gradeReportSheetName + "') not found.", '🛑 Error', 8);
    return;
  }
  
  var sourceSheet = ss.getSheetByName(sourceSheetName);
  if (!sourceSheet) {
    // FIX 2: Replaced ui.alert with ss.toast
    ss.toast("Roster source sheet named in B4 ('" + sourceSheetName + "') not found.", '🛑 Error', 8);
    return;
  }
  
  // --- 2. Fetch and Filter All Student Data ---
  var lastRow = sourceSheet.getLastRow();
  // Fetch a 3-column range: D (Student ID, index 0), E (Name), F (Role, index 2) - Assumed mapping
  // We rely on the structure established by createPeopleList()
  var rosterData = sourceSheet.getRange(2, 4, lastRow - 1, 3).getValues(); 

  // Filter by Role (Index 2) AND ensure ID exists
  var studentIds = rosterData
    .filter(function(row) { 
      return row[2] === "StudentEnrollment"; // Filter by Enrollment Type
    }) 
    .map(function(row) { 
      return String(row[0]).trim(); // Student ID is index 0 
    }) 
    .filter(function(id) { 
      return id; 
    });
  
  if (studentIds.length === 0) {
    // FIX 3: Replaced ui.alert with ss.toast
    ss.toast("No StudentEnrollment IDs found in Column D of source sheet: " + sourceSheetName, '🛑 Error', 8);
    return;
  }
  
  // --- 3. Initialize Status ---
  var statusRange = activeSheet.getRange(STATUS_CELL);
  var successfulExports = 0;
  var totalStudents = studentIds.length;
  
  // FIX 4: Replaced ui.alert with non-blocking ss.toast to start the batch process
  ss.toast("Starting batch PDF export for " + totalStudents + " students. Keep an eye on cell " + STATUS_CELL + " for progress.", 'Progress', 10);
  
  // --- 4. Process each student ID ---
  // Activate the report sheet once to ensure all operations occur there
  ss.setActiveSheet(gradeReportSheet);
  
  for (var index = 0; index < totalStudents; index++) {
    var studentId = studentIds[index];
    
    // Progress update on the active sheet
    var statusMessage = "[ " + (index + 1) + "/" + totalStudents + " ] Processing: " + studentId;
    activeSheet.getRange(STATUS_CELL).setValue(statusMessage);
    
    // A. Update the Student ID on the active sheet (C1 of the REPORT sheet)
    studentIdCell.setValue(studentId); 
    
    // B. Run the grade retrieval function
    try {
      // CRITICAL DEPENDENCY: getStudentGradesLocal MUST be defined (in grades.gs)
      getStudentGradesLocal(); 
    } catch (e) {
      statusRange.setValue("[ " + (index + 1) + "/" + totalStudents + " ] ❌ ERROR: Grade lookup failed for " + studentId + ". Skipping export.");
      Logger.log("Error running getStudentGradesLocal for ID " + studentId + ": " + e.message);
      continue;
    }
    
    // C. Wait for formulas to finish
    SpreadsheetApp.flush();
    Utilities.sleep(1500); // Give the sheet time to calculate lookups/formulas
    
    // D. Lock the Filename in B10 (preventing dual-file creation/race conditions)
    var filenameRange = gradeReportSheet.getRange("B10");
    var stableFilename = filenameRange.getValue();
    filenameRange.setValue(stableFilename); // Writing the value back as a hard string
    
    // E. Trigger the PDF export function
    try {
      // CRITICAL DEPENDENCY: exportSheetAsPDF MUST be defined (in utility.gs)
      var filename = exportSheetAsPDF(); 
      if (filename) {
        successfulExports++;
        statusRange.setValue("[ " + (index + 1) + "/" + totalStudents + " ] ✅ SUCCESS: " + filename + " saved.");
      } else {
        statusRange.setValue("[ " + (index + 1) + "/" + totalStudents + " ] ❌ FAILED: Export returned false for " + studentId + ".");
      }
    } catch (e) {
      statusRange.setValue("[ " + (index + 1) + "/" + totalStudents + " ] 🚨 FATAL EXPORT ERROR for " + studentId + ". Check log.");
      Logger.log("Export failed for Student ID " + studentId + ". Details: " + e.message);
    }
  }
  
  // 5. Final confirmation and return to original sheet
  ss.setActiveSheet(activeSheet);
  var finalMessage = "Processing Complete! Successfully exported " + successfulExports + " of " + totalStudents + " students.";
  statusRange.setValue(finalMessage);
  // FIX 5: Replaced ui.alert with ss.toast for final confirmation
  ss.toast(finalMessage, '✅ Batch Complete', 5);
}