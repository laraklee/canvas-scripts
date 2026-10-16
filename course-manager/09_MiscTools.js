/**
 * 09_MiscTools.gs
 * This file contains miscellaneous utility functions, including rubric creation,
 * group management, searchable filters, and general sheet maintenance.
 *
 * Dependencies:
 * - getConfig() (00_Config.gs)
 * - extractPeriod() (06_DataSetup.gs)
 * - convertToUTC() (01_Utilities.gs)
 */

// --- SECTION 1: SHEET INDEX MAINTENANCE ---

/**
 * Creates or updates the Index sheet with a list of all sheets in the workbook.
 */
function refreshIndex() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var indexSheet = ss.getSheetByName('*Index*');
  if (!indexSheet) {
    indexSheet = ss.insertSheet('*Index*');
  }
  var titleCell = indexSheet.getRange("A1");
  titleCell.setValue("Index").setFontWeight("bold").setFontColor("#0000FF").setFontSize(12);

  var sheets = ss.getSheets();
  var sheetData = [];
  for (var i = 0; i < sheets.length; i++) {
    var sheetName = sheets[i].getName();
    var sheetId = sheets[i].getSheetId();
    sheetData.push([
      sheetName,
      '=HYPERLINK("#gid=' + sheetId + '","' + sheetName + '")',
      sheetId
    ]);
  }

  // Custom Sort Logic: User sheets first, then System sheets (*), both alphabetical
  sheetData.sort(function(a, b) {
    var nameA = a[0];
    var nameB = b[0];
    var isAStarred = nameA.startsWith('*');
    var isBStarred = nameB.startsWith('*');

    if (!isAStarred && isBStarred) return -1;
    if (isAStarred && !isBStarred) return 1;
    return nameA.localeCompare(nameB);
  });

  var headerRange = indexSheet.getRange("A3:C3");
  headerRange.setValues([["Sheet Name", "Link", "GID"]]).setBackground("#FFEB9C").setFontWeight("bold");
  var startRow = 4;
  var numRows = sheetData.length;
  indexSheet.getRange(startRow, 1, indexSheet.getMaxRows() - startRow + 1, 3).clearContent();
  
  if (numRows > 0) {
    var dataRange = indexSheet.getRange(startRow, 1, numRows, 3);
    dataRange.setValues(sheetData);

    indexSheet.setColumnWidth(1, 200);
    indexSheet.setColumnWidth(2, 150);
    indexSheet.setColumnWidth(3, 100);
    indexSheet.getRange("A:A").setWrap(true);

    for (var i = 0; i < numRows; i++) {
      var row = startRow + i;
      var color = i % 2 === 0 ? "#FFFFFF" : "#FFF2CC";
      indexSheet.getRange(row, 1, 1, 3).setBackground(color);
      indexSheet.getRange(row, 3).setHorizontalAlignment("left");
    }
  }
  ss.toast('Index has been updated.', '✅ Update Complete', 5);
}

// --- SECTION 2: GROUP MANAGEMENT ---

/**
 * Clears the Group Category ID (D2), Category URL (E2), and all Group IDs (Column A, Row 5 onwards).
 */
function clearGroupData() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var lastRow = sheet.getLastRow();
  if (lastRow >= 5) {
    sheet.getRange("A5:A" + lastRow).clearContent();
  }
  sheet.getRange("D2").clearContent();
  sheet.getRange("E2").clearContent();
  SpreadsheetApp.flush();
  sheet.getRange("A5").activate();
  ss.toast("Group IDs and Category data cleared.", '✅ Success', 3);
}

/**
 * Creates a new Group Category in Canvas using the Course ID (A2) and Category Name (C2).
 */
function createGroupCategory() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var config = getConfig();
  var baseUrl = config.BASE_URL;
  var apiKey = PropertiesService.getUserProperties().getProperty('CANVAS_API_KEY');
  var courseId = sheet.getRange("A2").getValue();
  var categoryName = sheet.getRange("C2").getValue();

  if (!courseId || !categoryName || !apiKey) {
    ss.toast('Course ID (A2), Category Name (C2), or API Key is missing.', '🚨 Configuration Error', 8);
    return;
  }

  var url = baseUrl + "/api/v1/courses/" + courseId + "/group_categories";
  var payload = { name: categoryName };

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + apiKey },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    var resp = UrlFetchApp.fetch(url, options);
    var responseCode = resp.getResponseCode();
    var responseText = resp.getContentText();

    if (responseCode >= 200 && responseCode < 300) {
      var newCategory = JSON.parse(responseText);
      sheet.getRange("D2").setValue(newCategory.id);

      var linkUrl = baseUrl + "/courses/" + courseId + "/groups#tab-" + newCategory.id;
      var richTextValue = SpreadsheetApp.newRichTextValue()
        .setText("Category URL →").setLinkUrl(linkUrl).build();
      sheet.getRange("E2").setRichTextValue(richTextValue);

      ss.toast('Group Category created with ID: ' + newCategory.id, '✅ Success', 5);
    } else {
      ss.toast('Category creation failed (Code ' + responseCode + ')', '🛑 API Error', 10);
      Logger.log("createGroupCategory failed: " + responseText);
    }
  } catch (e) {
    ss.toast('System Error: ' + e.message, '🔥 System Error', 10);
  }
}

/**
 * Creates individual groups in Canvas under the Category ID stored in D2.
 */
function createGroups() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var ui = SpreadsheetApp.getUi();
  var courseId = sheet.getRange("A2").getValue();
  var categoryId = sheet.getRange("D2").getValue();
  if (!courseId || !categoryId) {
    ui.alert('Error', 'Course ID (A2) or Category ID (D2) is missing.', ui.ButtonSet.OK);
    return;
  }

  var userProperties = PropertiesService.getUserProperties();
  var canvasApiToken = userProperties.getProperty('CANVAS_API_KEY');
  var config = getConfig();
  var baseUrl = config.BASE_URL;

  if (!canvasApiToken || !baseUrl) {
    ui.alert('Error', 'API Key or Base URL not set.', ui.ButtonSet.OK);
    return;
  }

  var groupNames = sheet.getRange("B5:B" + sheet.getLastRow()).getValues();
  var groupUrl = baseUrl + '/api/v1/group_categories/' + categoryId + '/groups';
  var createdGroups = 0;
  var errorMessages = [];

  for (var i = 0; i < groupNames.length; i++) {
    var groupName = String(groupNames[i][0]).trim();
    if (groupName === "") continue;

    var options = {
      'method': 'post',
      'headers': {'Authorization': 'Bearer ' + canvasApiToken},
      'contentType': 'application/json',
      'payload': JSON.stringify({'name': groupName}),
      'muteHttpExceptions': true
    };

    try {
      var response = UrlFetchApp.fetch(groupUrl, options);
      var responseCode = response.getResponseCode();

      if (responseCode >= 200 && responseCode < 300) {
        var groupData = JSON.parse(response.getContentText());
        sheet.getRange(i + 5, 1).setValue(groupData.id);
        createdGroups++;
      } else {
        errorMessages.push("Row " + (i + 5) + ": API Error (" + responseCode + ")");
        Logger.log("Group creation failed for " + groupName + ": " + response.getContentText());
      }
    } catch (error) {
      errorMessages.push("Row " + (i + 5) + ": System Error (" + error.message.slice(0, 50) + ")");
    }
  }

  if (createdGroups > 0) {
    ui.alert('Success', createdGroups + ' groups created.' + (errorMessages.length > 0 ? '\nSome rows failed.' : ''), ui.ButtonSet.OK);
  } else {
    ui.alert('Warning', 'No groups were created. Check the Execution Log.', ui.ButtonSet.OK);
  }
}

// --- SECTION 3: RUBRIC TOOLS ---

/**
 * Sets up the active sheet with the necessary cells, headers, and formatting required
 * to design a Canvas rubric for export.
 */
function setupRubricUI() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var ui = SpreadsheetApp.getUi();

  var confirmation = ui.alert(
    'Warning',
    'This function will CLEAR the entire contents of the active sheet and set up the Rubric Template. Continue?',
    ui.ButtonSet.YES_NO);

  if (confirmation !== ui.ButtonSet.YES) return;

  sheet.clear();
  sheet.setFrozenRows(2);
  sheet.setColumnWidth(1, 150);

  var template = [
    ['', 'RUBRIC DESIGN TEMPLATE (Canvas Export)', '', '', '', ''],
    ['Rubric Title:', 'Rubric Criteria', 'Criteria Description', 'Rating 4', 'Rating 3', 'Rating 2'],
    ['Criteria Name:', 'Criterion 1', 'Criterion 2', 'Criterion 3', 'Criterion 4', 'Criterion 5'],
    ['Description:', 'Description 1', 'Description 2', 'Description 3', 'Description 4', 'Description 5'],
    ['Rating 4 Name:', 'Excellent', 'Excellent', 'Excellent', 'Excellent', 'Excellent'],
    ['Rating 4 Points:', 4, 4, 4, 4, 4],
    ['Rating 3 Name:', 'Good', 'Good', 'Good', 'Good', 'Good'],
    ['Rating 3 Points:', 3, 3, 3, 3, 3],
    ['Rating 2 Name:', 'Fair', 'Fair', 'Fair', 'Fair', 'Fair'],
    ['Rating 2 Points:', 2, 2, 2, 2, 2],
    ['Rating 1 Name:', 'Poor', 'Poor', 'Poor', 'Poor', 'Poor'],
    ['Rating 1 Points:', 1, 1, 1, 1, 1],
    ['Rating 0 Name:', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A'],
    ['Rating 0 Points:', 0, 0, 0, 0, 0]
  ];

  sheet.getRange(1, 1, template.length, template[0].length).setValues(template);
  sheet.getRange('A1:F1').merge().setFontWeight('bold').setBackground('#B7E1CD').setHorizontalAlignment('center');
  sheet.getRange('A2:F2').setFontWeight('bold').setBackground('#D9EAD3');
  sheet.getRange('B3:F4').setBackground('#FFF2CC');
  sheet.getRange('B5:F14').setBackground('#EAD1DC');

  ss.setNamedRange('RubricInputBlock', sheet.getRange('A1:F14'));
  ss.toast('Rubric template created. Use the "Export for Canvas" menu item when ready.', '✅ Success', 5);
}

/**
 * Reads data from the structured Rubric template sheet and converts it into
 * a flat, CSV-compatible format suitable for direct upload to Canvas.
 */
function exportRubricToCanvasFormat() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var uiSheet = ss.getActiveSheet();
  
  var exportSheetName = "rubricCanvasExport";
  var exportSheet = ss.getSheetByName(exportSheetName);
  if (!exportSheet) {
    exportSheet = ss.insertSheet(exportSheetName);
  } else {
    exportSheet.clear();
  }
  
  var header = [
    "Rubric Name", "Criteria Name", "Criteria Description", "Criteria Enable Range",
    "Rating Name", "Rating Description", "Rating Points",
    "Rating Name", "Rating Description", "Rating Points",
    "Rating Name", "Rating Description", "Rating Points",
    "Rating Name", "Rating Description", "Rating Points"
  ];
  exportSheet.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold').setBackground('#f4cccc');

  var rubricTitle = uiSheet.getRange("A1").getValue();
  var criteriaNames = uiSheet.getRange(3, 2, 1, 5).getValues()[0];
  var exportRow = 2;

  for (var c = 0; c < criteriaNames.length; c++) {
    var criterionName = String(criteriaNames[c]).trim();
    if (!criterionName) continue;

    var criterionDescription = uiSheet.getRange(4, 2 + c).getValue();
    var criterionEnableRange = "FALSE";
    var row = [rubricTitle, criterionName, criterionDescription, criterionEnableRange];
    var maxRatings = 4;

    for (var r = 0; r < maxRatings; r++) {
      var baseRow = 5 + (r * 2);
      var ratingName = uiSheet.getRange(baseRow, 2 + c).getValue();
      var ratingPoints = uiSheet.getRange(baseRow + 1, 2 + c).getValue();
      var ratingDesc = "";

      if (ratingName !== null && String(ratingName).trim() !== "") {
        row.push(ratingName, ratingDesc, ratingPoints);
      } else {
        row.push('', '', '');
      }
    }

    var zeroRatingName = uiSheet.getRange(13, 2 + c).getValue();
    var zeroRatingPoints = uiSheet.getRange(14, 2 + c).getValue();
    if (zeroRatingName !== null && String(zeroRatingName).trim() !== "") {
      row.push(zeroRatingName, "", zeroRatingPoints);
    } else {
      row.push('', '', '');
    }

    exportSheet.getRange(exportRow, 1, 1, row.length).setValues([row]);
    exportRow++;
  }
  exportSheet.autoResizeColumns(1, header.length);
  ss.toast('Rubric CSV data written to sheet: ' + exportSheetName + '. Ready for Canvas import.', '✅ Success', 8);
}

// --- SECTION 4: ASSIGNMENT SELECTOR UTILITIES ---

/**
 * Prompts the user for both the input and output cell locations, then places the
 * dynamic filter formula and the searchable dropdown, linking them together.
 */
function setupAssignmentFilterAndDropdown() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var ui = SpreadsheetApp.getUi();
  
  var inputResponse = ui.prompt(
    '1. Define Assignment Input Cell',
    'Enter the A1 notation of the cell where the user will type the Assignment Name (e.g., B3):',
    ui.ButtonSet.OK_CANCEL
  );
  if (inputResponse.getSelectedButton() !== ui.Button.OK) return;
  var inputCellA1 = inputResponse.getResponseText().trim().toUpperCase();
  var inputCell = sheet.getRange(inputCellA1);

  var filterResponse = ui.prompt(
    '2. Define Filter List Start Cell',
    'Enter the A1 notation of the cell where the Filter Formula should be placed (e.g., Q2):',
    ui.ButtonSet.OK_CANCEL
  );
  if (filterResponse.getSelectedButton() !== ui.Button.OK) return;
  var filterStartCellA1 = filterResponse.getResponseText().trim().toUpperCase();
  var filterStartCell = sheet.getRange(filterStartCellA1);

  var assignmentsSheetName = '*assignmentGroups*';
  var filterFormula =
    '=FILTER(\'' + assignmentsSheetName + '\'!B:B, ' +
    'LEN(\'' + assignmentsSheetName + '\'!B:B) > 0, ' +
    'ISNUMBER(SEARCH(' + inputCellA1 + ', \'' + assignmentsSheetName + '\'!B:B)))';

  filterStartCell.setFormula(filterFormula);
  
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(filterStartCell.offset(1, 0), true)
    .setAllowInvalid(false)
    .setHelpText("Select an assignment name. Start typing in " + inputCellA1)
    .build();

  inputCell.setDataValidation(rule);
  ss.toast('Searchable filter setup complete. Formula in ' + filterStartCellA1, '✅ Filter Setup', 5);
}

/**
 * Creates a searchable data validation dropdown in the active cell based on assignment names.
 */
function createAssignmentSelector() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var assignmentsSheet = ss.getSheetByName('*assignmentGroups*');
  if (!assignmentsSheet) {
    ss.toast('Sheet *assignmentGroups* not found. Please run a data refresh first.', '🛑 Error', 8);
    return;
  }
  
  var lastRow = assignmentsSheet.getLastRow();
  var nameListRange = assignmentsSheet.getRange('B2:B' + lastRow);
  var nameList = nameListRange.getValues().flat().filter(String);
  if (nameList.length === 0) {
    ss.toast('No assignments found in *assignmentGroups*.', '🛑 Error', 8);
    return;
  }
  
  var activeCell = sheet.getActiveCell();
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(nameList)
    .setAllowInvalid(false)
    .setHelpText("Select an assignment name. Type to search.")
    .build();
  activeCell.setDataValidation(rule);
  activeCell.clearContent();
  activeCell.setFontColor('black').setFontSize(10).setHorizontalAlignment('left');

  ss.toast('Searchable assignment selector created in ' + activeCell.getA1Notation() + '.', '✅ Selector Created', 5);
}

/**
 * Creates a searchable dropdown in the active cell and writes a dynamic INDEX/MATCH
 * formula into the cell immediately BELOW it to look up the Assignment ID.
 */
function createAssignmentSelectorBelow() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var assignmentsSheetName = '*assignmentGroups*';
  var assignmentsSheet = ss.getSheetByName(assignmentsSheetName);
  if (!assignmentsSheet) {
    ss.toast('Sheet *assignmentGroups* not found. Please run a data refresh first.', '🛑 Error', 8);
    return;
  }

  var lastRow = assignmentsSheet.getLastRow();
  var nameListRange = assignmentsSheet.getRange('B2:B' + lastRow);
  var nameList = nameListRange.getValues().flat().filter(String);
  if (nameList.length === 0) {
    ss.toast('No assignments found in *assignmentGroups*.', '🛑 Error', 8);
    return;
  }
  var activeCell = sheet.getActiveCell();
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(nameList)
    .setAllowInvalid(false)
    .setHelpText("Select an assignment name. Type to search.")
    .build();
  activeCell.setDataValidation(rule);
  activeCell.clearContent();
  var nameCellA1 = activeCell.getA1Notation();
  var idCell = sheet.getRange(activeCell.getRow() + 1, activeCell.getColumn());
  
  var formula = '=IFERROR(INDEX(\'' + assignmentsSheetName + '\'!A:A, MATCH(' + nameCellA1 + ', \'' + assignmentsSheetName + '\'!B:B, 0)), """")';
  idCell.setFormula(formula);
  ss.toast('Searchable selector created in ' + nameCellA1 + '. ID formula is now in ' + idCell.getA1Notation() + '.', '✅ Selector Created', 5);
}

// --- SECTION 5: SCHEDULING AND TIME HELPERS ---

/**
 * Helper: Formats a raw time value (e.g. 815) into a string (e.g., "0815").
 */
function formatTime(time) {
  if (!time) return "";
  if (typeof time === 'number') {
    var timeStr = String(time);
    while (timeStr.length < 4) {
      timeStr = '0' + timeStr;
    }
    return timeStr;
  }
  return String(time);
}

/**
 * Searches the *simpleSchedule* sheet by date to find the corresponding JSON array
 * of period times, then finds the specific period's start and end times within that array.
 */
function getPeriodTimesForDate(date, period) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var simpleSchedule = ss.getSheetByName('*simpleSchedule*');
  if (!simpleSchedule) return null;
  var lastRow = simpleSchedule.getLastRow();
  if (lastRow < 2) return null;
  
  var data = simpleSchedule.getRange(2, 1, lastRow - 1, 9).getValues();
  var periodString = String(period).trim();
  for (var i = 0; i < data.length; i++) {
    var rowDate = data[i][2]; // Column C

    if (rowDate instanceof Date && rowDate.getFullYear() === date.getFullYear() && rowDate.getMonth() === date.getMonth() && rowDate.getDate() === date.getDate()) {
      var timesJson = data[i][8]; // Column I
      if (!timesJson) continue;

      try {
        var times = JSON.parse(timesJson);
        for (var j = 0; j < times.length; j++) {
          if (String(times[j].period).trim() === periodString) {
            return {start: times[j].start, end: times[j].end};
          }
        }
      } catch (e) {
        console.log("JSON Parse Error row " + i);
      }
    }
  }
  return null;
}

/**
 * Creates dynamic data validation dropdowns in the time column (F7:F11) for overrides.
 * Reads standard times from *Config* and period-specific times from the schedule.
 */
function createDropdowns() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var configSheet = ss.getSheetByName('*Config*');
  if (!configSheet) {
    ss.toast('Missing *Config* sheet.', '🛑 Error', 5);
    return;
  }
  var schoolStart = formatTime(configSheet.getRange("B6").getValue());
  var schoolEnd = formatTime(configSheet.getRange("B7").getValue());
  var afterSchool = formatTime(configSheet.getRange("B8").getValue());
  var night = formatTime(configSheet.getRange("B9").getValue());

  for (var i = 7; i <= 11; i++) {
    var period = sheet.getRange("C" + i).getValue();
    var date = sheet.getRange("D" + i).getValue();
    var timeOptions = [];

    if (period && date) {
      var periodTimes = getPeriodTimesForDate(date, period);
      if (periodTimes) {
        timeOptions.push('Period Start (' + formatTime(periodTimes.start) + ')');
        timeOptions.push('Period End (' + formatTime(periodTimes.end) + ')');
      }
    }

    timeOptions.push('School Start (' + schoolStart + ')');
    timeOptions.push('School End (' + schoolEnd + ')');
    timeOptions.push('After School (' + afterSchool + ')');
    timeOptions.push('Night (' + night + ')');

    var rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(timeOptions)
      .setAllowInvalid(false)
      .build();
    sheet.getRange("F" + i).setDataValidation(rule);
  }
  ss.toast('Dropdowns created/refreshed in Column F.', '✅ Dropdowns Updated', 5);
}

// --- SECTION 6: AD-HOC DEVELOPER JSON UTILITIES ---

/**
 * Reads JSON response bodies from selected rows (Column E), combines them (handling pagination),
 * and writes the extracted data as a structured table to a target sheet named in Column F.
 */
function parseJsonToSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sourceSheet = ss.getActiveSheet();
  var activeRange = sourceSheet.getActiveRange();
  var startRow = activeRange.getRow();
  var numRows = activeRange.getNumRows();
  
  var data = sourceSheet.getRange(startRow, 5, numRows, 2).getValues();
  var combinedJsonData = [];
  var targetSheetName = null;
  var foundSheetName = false;

  for (var i = 0; i < numRows; i++) {
    var rowIndex = startRow + i;
    var jsonString = data[i][0];
    var currentRowTargetSheet = String(data[i][1]).trim();

    if (currentRowTargetSheet && !foundSheetName) {
      targetSheetName = currentRowTargetSheet;
      foundSheetName = true;
    }
    if (!jsonString) continue;

    var cleanJsonString = jsonString.replace(/^Page \d+: /, '');

    try {
      var pageData = JSON.parse(cleanJsonString);
      if (Array.isArray(pageData)) {
        combinedJsonData = combinedJsonData.concat(pageData);
      } else if (typeof pageData === 'object' && pageData !== null) {
        combinedJsonData.push(pageData);
      }
    } catch (error) {
      Logger.log('Error parsing JSON in row ' + rowIndex + ': ' + error);
    }
  }

  if (combinedJsonData.length === 0) {
    ss.toast('No valid JSON data was parsed from the selected rows.', '⚠️ Warning', 5);
    return;
  }
  if (!targetSheetName) {
    ss.toast('No target sheet name found in Column F of the selected range.', '🛑 Error', 5);
    return;
  }

  var targetSheet = ss.getSheetByName(targetSheetName);
  if (!targetSheet) {
    targetSheet = ss.insertSheet(targetSheetName);
  }
  targetSheet.clear();

  var headers = Object.keys(combinedJsonData.reduce(function(acc, obj) {
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) { acc[key] = true; }
    }
    return acc;
  }, {}));

  var values = combinedJsonData.map(function(item) {
    return headers.map(function(header) {
      return item[header];
    });
  });

  targetSheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  targetSheet.getRange(2, 1, values.length, headers.length).setValues(values);
  targetSheet.autoResizeColumns(1, headers.length);
  targetSheet.getRange(1, 1, values.length + 1, headers.length).setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);

  ss.toast(combinedJsonData.length + ' records written to sheet: ' + targetSheetName, '✅ JSON Parsed', 5);
}

// --- SECTION 7: ORDERING AND SEATING CHART SYSTEM ---

/**
 * Puts sequential integers (1, 2, 3, ...) into the selected block of cells, filling row by row.
 */
function fillSelectedRangeSequentially() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var range = spreadsheet.getActiveRange();
  if (!range) {
    spreadsheet.toast('Please select a range of cells first.', '🛑 Error', 3);
    return;
  }
  var numRows = range.getNumRows();
  var numColumns = range.getNumColumns();
  var values = [];
  var counter = 1;

  for (var i = 0; i < numRows; i++) {
    var row = [];
    for (var j = 0; j < numColumns; j++) {
      row.push(counter);
      counter++;
    }
    values.push(row);
  }
  range.setValues(values);
  spreadsheet.toast(counter - 1 + ' cells filled sequentially.', '✅ Sequencing Complete', 3);
}

/**
 * Reads Assignment ID (Col 1), Group ID (Col 3), and Position (Col 5) from the selected rows
 * and updates the assignment order configuration parameters directly in Canvas.
 */
function updateAssignmentPositionsFromSelectedRows() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var userProperties = PropertiesService.getUserProperties();
  var canvasApiToken = userProperties.getProperty('CANVAS_API_KEY');
  var config = getConfig();
  var baseUrl = config.BASE_URL;
  var courseId = config.COURSE_ID;

  if (!canvasApiToken || !courseId) {
    ss.toast("API Key or Course ID missing.", "🚨 Configuration Error", 8);
    return;
  }
  var activeRange = sheet.getActiveRange();
  var startRow = activeRange.getRow();
  var numRows = activeRange.getNumRows();
  var data = sheet.getRange(startRow, 1, numRows, 5).getValues();
  var successCount = 0;

  ss.toast("Starting position update for " + numRows + " rows...", "Progress", 5);

  for (var i = 0; i < numRows; i++) {
    var row = data[i];
    var assignmentId = String(row[0]).trim();
    var assignmentGroupId = String(row[2]).trim();
    var position = Number(row[4]);

    if (!assignmentId || !assignmentGroupId || isNaN(position)) continue;

    var url = baseUrl + "/api/v1/courses/" + courseId + "/assignments/" + assignmentId;
    var payload = {
      assignment: {
        assignment_group_id: assignmentGroupId,
        position: position
      }
    };

    var options = {
      method: 'put',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + canvasApiToken },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    try {
      var resp = UrlFetchApp.fetch(url, options);
      if (resp.getResponseCode() === 200) {
        successCount++;
      } else {
        Logger.log("Position update failed for ID " + assignmentId + ": " + resp.getContentText().slice(0, 100));
      }
    } catch (e) {
      Logger.log("System error updating position for ID " + assignmentId + ": " + e.message);
    }
  }
  ss.toast(successCount + " assignment positions updated.", '✅ Update Complete', 5);
}

/**
 * Seating Chart Creator
 * Creates text boxes (seating chart) in a Google Slides presentation for a
 * specified section or period, pulling student data directly from the central
 * *peopleList* and *SectionLookup* sheets.
 */
function createStudentTextBoxes() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  try {
    var configSheet = ss.getSheetByName('*Config*');
    if (!configSheet) throw new Error("Sheet '*Config*' not found!");

    var docId = configSheet.getRange('B7').getValue().toString().trim();
    if (!docId) {
      ui.alert('Configuration Error', 'Slide Deck ID is missing from cell B7 of the *Config* sheet.', ui.ButtonSet.OK);
      return;
    }

    var sectionsRange = configSheet.getRange('A8:A11').getValues();
    var colorsRange = configSheet.getRange('B8:B11').getValues();
    var slidesRange = configSheet.getRange('C8:C11').getValues();

    var configSections = [];
    for (var i = 0; i < sectionsRange.length; i++) {
      if (sectionsRange[i][0]) {
        configSections.push({
          section: sectionsRange[i][0].toString().trim(),
          color: colorsRange[i][0],
          slideNum: slidesRange[i][0]
        });
      }
    }

    if (configSections.length === 0) {
      ui.alert('Configuration Error', 'No periods/sections are defined starting at cell A8 of the *Config* sheet.', ui.ButtonSet.OK);
      return;
    }

    var peopleListSheet = ss.getSheetByName('*peopleList*');
    var sectionLookupSheet = ss.getSheetByName('*SectionLookup*');

    if (!peopleListSheet || !sectionLookupSheet) {
      ui.alert('Setup Error', 'Missing *peopleList* or *SectionLookup* sheets. Please run a Full Data Refresh.', ui.ButtonSet.OK);
      return;
    }

    var sectionMap = {};
    var sectionLookupData = sectionLookupSheet.getDataRange().getValues();
    for (var i = 1; i < sectionLookupData.length; i++) {
      sectionMap[sectionLookupData[i][3]] = sectionLookupData[i][2];
    }

    var rawRosterData = peopleListSheet.getDataRange().getValues();
    var studentRoster = rawRosterData.slice(1).filter(function(row) {
      return row[5] && row[5].toString().includes('StudentEnrollment');
    }).map(function(row) {
      var sectionId = row[2];
      return {
        section: sectionMap[sectionId] || sectionId,
        lastName: row[7],
        firstName: row[8]
      };
    });

    var presentation = SlidesApp.openById(docId);
    var slides = presentation.getSlides();
    var boxesCreated = 0;

    for (var j = 0; j < configSections.length; j++) {
      var currentConfig = configSections[j];
      var targetPeriod = currentConfig.section;
      var currentColor = currentConfig.color;
      var currentSlideNumber = parseInt(currentConfig.slideNum);

      if (isNaN(currentSlideNumber) || currentSlideNumber < 1 || currentSlideNumber > slides.length) {
        ui.alert('Slide Error', 'Invalid or missing slide number: ' + currentConfig.slideNum + ' for period ' + targetPeriod + '.', ui.ButtonSet.OK);
        continue;
      }

      var slide = slides[currentSlideNumber - 1];
      var left = 50;
      var top = 50;
      var boxWidth = 1.8 * 72;
      var boxHeight = 1.17 * 72;

      var targetStudents = studentRoster.filter(function(student) {
        return student.section.toString().trim() === targetPeriod;
      });

      targetStudents.sort(function(a, b) {
        return a.lastName.localeCompare(b.lastName);
      });

      for (var i = 0; i < targetStudents.length; i++) {
        var student = targetStudents[i];
        var studentInfo = student.firstName + '\n' + student.lastName;

        var textBox = slide.insertTextBox(studentInfo, left, top, boxWidth, boxHeight);
        var textRange = textBox.getText();
        textRange.getTextStyle().setFontFamily('Palatino');

        if (student.firstName.length > 0) {
          textRange.getRange(0, student.firstName.length).getTextStyle().setBold(true).setFontSize(21);
        }

        if (student.lastName.length > 0) {
          var lastNameStart = student.firstName.length + 1;
          var lastNameEnd = studentInfo.length;
          textRange.getRange(lastNameStart, lastNameEnd).getTextStyle().setFontSize(15);
        }

        textBox.getFill().setSolidFill(currentColor);
        textBox.getText().getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
        boxesCreated++;

        left += boxWidth + 10;
        if (left + boxWidth > 720) {
          left = 50;
          top += boxHeight + 10;
        }
      }
    }

    ui.alert('Seating Chart Complete', 'Text boxes created successfully! Total created: ' + boxesCreated + '.', ui.ButtonSet.OK);

  } catch (error) {
    Logger.log('Error in createStudentTextBoxes: ' + error.toString());
    ui.alert('Fatal Error', 'An error occurred during chart creation: ' + error.message, ui.ButtonSet.OK);
  }
}