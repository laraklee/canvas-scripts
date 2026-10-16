/**
 * 01_Utilities.gs
 * This file contains general helper functions used across the project,
 * primarily for logging, date/time calculation, and low-level UI/data helpers.
 */

/**
 * Creates dynamic dropdown menus in Column F for section override rows (Rows 7-11).
 * Reads standard schedule times from *Config* and dynamic period times directly from *simpleSchedule*.
 * 
 * @param {GoogleAppsScript.Spreadsheet.Sheet} [targetSheet] Optional target sheet reference; defaults to active sheet.
 * @return {void}
 */
function createDropdowns1(targetSheet) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = targetSheet || ss.getActiveSheet();
  var ui = SpreadsheetApp.getUi();

  SpreadsheetApp.flush(); 

  var configSheet = ss.getSheetByName('*Config*');
  if (!configSheet) {
    ui.alert('Error', 'Missing *Config* sheet.', ui.ButtonSet.OK);
    return;
  }
  
  // 1. Read Standard Times from *Config* (B14-B17)
  var schoolStart = formatTime(configSheet.getRange("B14").getValue());
  var schoolEnd = formatTime(configSheet.getRange("B15").getValue());
  var afterSchool = formatTime(configSheet.getRange("B16").getValue());
  var night = formatTime(configSheet.getRange("B17").getValue());

  // Target Rows: Section Overrides (Rows 7-11)
  var targetRows = [7, 8, 9, 10, 11];

  // 2. Populate Dropdowns
  for (var index = 0; index < targetRows.length; index++) {
    var i = targetRows[index];
    var period = sheet.getRange("C" + i).getValue();
    var date = sheet.getRange("D" + i).getValue();
    var timeOptions = [];

    // Look up dynamic period start/end times if valid Date and Period exist
    if (period && date instanceof Date) {
      var periodTimes = getPeriodTimesForDate(date, period);
      
      if (periodTimes && periodTimes.start && periodTimes.end) {
        timeOptions.push('Period Start (' + formatTime(periodTimes.start) + ')');
        timeOptions.push('Period End (' + formatTime(periodTimes.end) + ')');
      }
    }

    // Add standard static time options
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

  ss.toast('Dropdowns refreshed in Column F (Rows 7-11).', 'Success', 5);
}

/**
 * Resolves period start and end times for a specific Date object and period string
 * directly from the *simpleSchedule* sheet.
 * 
 * @param {Date} date Target date object from Column D.
 * @param {string|number} period Period string from Column C (e.g., "1" or "1,2").
 * @return {Object|null} Object containing {start, end} time values or null if not found.
 */
function getPeriodTimesForDate(date, period) {
  if (!(date instanceof Date) || !period) return null;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('*simpleSchedule*');
  if (!sheet) return null;

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  var timeZone = ss.getSpreadsheetTimeZone();
  var targetDateStr = Utilities.formatDate(date, timeZone, "yyyy-MM-dd");
  var targetPeriod = String(period).split(',')[0].trim();

  // Read Columns A through I (Cols: C=Date[2], I=JSON[8])
  var data = sheet.getRange(2, 1, lastRow - 1, 9).getValues();

  for (var i = 0; i < data.length; i++) {
    var rowDate = data[i][2]; // Column C
    if (rowDate instanceof Date) {
      if (Utilities.formatDate(rowDate, timeZone, "yyyy-MM-dd") === targetDateStr) {
        var jsonString = data[i][8]; // Column I
        if (!jsonString) return null;

        try {
          var scheduleJSON = JSON.parse(jsonString);
          for (var j = 0; j < scheduleJSON.length; j++) {
            if (String(scheduleJSON[j].period).trim() === targetPeriod) {
              return {
                start: scheduleJSON[j].start,
                end: scheduleJSON[j].end
              };
            }
          }
        } catch (e) {
          logToSystem("getPeriodTimesForDate", "JSON parse error on row " + (i + 2) + ": " + e.message);
        }
        return null;
      }
    }
  }

  return null;
}

/**
 * Formats time values (Date objects, time strings, or HHMM numbers) into standard display strings (e.g., "8:15 AM").
 * 
 * @param {Date|string|number} timeVal Input cell value or time string.
 * @return {string} Formatted time string.
 */
function formatTime(timeVal) {
  if (!timeVal) return '';
  if (timeVal instanceof Date) {
    return Utilities.formatDate(timeVal, SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), "h:mm a");
  }
  var str = String(timeVal).trim();
  if ((str.length === 3 || str.length === 4) && !isNaN(str)) {
    var padStr = str.length === 3 ? "0" + str : str;
    var hrs = parseInt(padStr.slice(0, 2), 10);
    var mins = padStr.slice(2);
    var ampm = hrs >= 12 ? 'PM' : 'AM';
    hrs = hrs % 12 || 12;
    return hrs + ':' + mins + ' ' + ampm;
  }
  return str;
}

/**
 * Quick security audit tool to check if any sensitive keys 
 * are accidentally stored in the global ScriptProperties.
 */
function checkGlobalScriptProperties() {
  const scriptProps = PropertiesService.getScriptProperties().getKeys();
  
  if (scriptProps.length === 0) {
    Logger.log("✅ Clear: No keys found in global ScriptProperties.");
  } else {
    Logger.log("⚠️ Warning: The following keys exist globally for all users:");
    Logger.log(scriptProps);
  }
}

/**
 * Utility: Looks up a Period Name (Col C) from a Section ID (Col A) 
 * in the *SectionLookup* sheet. Used to populate the UI during Fetch.
 */
function getPeriodNameFromId(sectionId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var lookupSheet = ss.getSheetByName('*SectionLookup*');
  if (!lookupSheet) return "";
  
  var data = lookupSheet.getDataRange().getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]) === String(sectionId)) { // Col A is ID
      return data[i][2]; // Col C is Period Name
    }
  }
  return "";
}

/**
 * Global Utility: Combines Date and Time into a Canvas-ready ISO string.
 * Prevents the "1969 Epoch Bug" by validating inputs before conversion.
 * @param {Date} dateVal - The Date object from the spreadsheet.
 * @param {Date|String|number} timeVal - The Time value from the spreadsheet.
 * @return {string} The ISO 8601 formatted string or an empty string if invalid.
 */
function getCanvasTimestamp(dateVal, timeVal) {
  // 1. If it's not a valid Date object, return empty string so Canvas ignores/clears it.
  if (!(dateVal instanceof Date) || isNaN(dateVal.getTime())) {
    return "";
  }

  // 2. Pass to existing UTC converter for Hawaii-safe ISO formatting.
  // CRITICAL: Re-uses your existing convertToUTC logic in 01_Utilities.
  return convertToUTC(dateVal, timeVal);
}

// --- 1. LOGGING & SCHEDULE TOOLS ---

/**
 * Helper: Logs the API response (Code and Body) to the active sheet at a specified row.
 * Writes the response to the row's designated output columns (D and E). 6
 *
 * Helper function to handle the writing of the Canvas API response code and body to the sheet. 5
 *
 * @param {object} args An object containing {sheet: Sheet, rowIndex: number, responseCode: number, responseBody: string, endpoint: string}
 */
function logResponse(args) {
  var sheet = args.sheet;
  var rowIndex = args.rowIndex;
  var responseCode = args.responseCode;
  var responseBody = args.responseBody;
  var endpoint = args.endpoint;

  // The output columns for API Runner are typically D (Response Code) and E (Response Body/Error)
  var RESPONSE_CODE_COL = 4; // Column D
  var RESPONSE_BODY_COL = 5; // Column E

  // Log the response code
  sheet.getRange(rowIndex, RESPONSE_CODE_COL).setValue(responseCode);

  // Check for success or error
  if (responseCode >= 200 && responseCode < 300) {
    // SUCCESS (2xx)
    try {
      // Try to pretty-print the JSON response if possible
      var jsonObject = JSON.parse(responseBody);
      sheet.getRange(rowIndex, RESPONSE_BODY_COL).setValue(JSON.stringify(jsonObject, null, 2));
    } catch (e) {
      // Handle cases where the response is not JSON (e.g., PUT/DELETE return 204 No Content)
      sheet.getRange(rowIndex, RESPONSE_BODY_COL).setValue(responseBody);
    }
  } else {
    // ERROR (4xx, 5xx, etc.)
    var errorMessage = 'Endpoint: ' + endpoint + ' | ' + 'Code: ' + responseCode + ' | ';

    // Attempt to extract the error message from Canvas's standard JSON error format
    try {
      var errorJson = JSON.parse(responseBody);
      if (errorJson.errors && errorJson.errors.length > 0) {
        // Concatenate all error messages
        var canvasErrors = errorJson.errors.map(function(err) {
          return err.message;
        }).join(' | ');
        errorMessage += 'Canvas Error: ' + canvasErrors;
      } else {
        errorMessage += 'Raw Body: ' + responseBody.slice(0, 200) + '...'; // Truncate long bodies
      }
    } catch (e) {
      errorMessage += 'Raw Body: ' + responseBody.slice(0, 200) + '...';
    }

    sheet.getRange(rowIndex, RESPONSE_BODY_COL).setValue(errorMessage);
  }
}


/**
 * Finds the start and end times for a specific period in a given schedule.
 * MODIFIED: This now reads the JSON schedule data from Column I (Index 8)
 * of the *simpleSchedule* sheet, instead of reading individual columns.
 *
 * Searches the *simpleSchedule* sheet to find the start and end times for a specific 
 * schedule type (e.g., "Regular") and period (e.g., "1").
 * @param {string} schedule The name of the schedule (e.g., 'A', 'Regular').
 * @param {string} period The name of the period (e.g., '1', 'L').
 * @returns {object|null} An object {start: time, end: time} or null.
 */
function getPeriodTimes(schedule, period) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var SCHEDULE_SHEET_NAME = '*simpleSchedule*';
  var sheet = ss.getSheetByName(SCHEDULE_SHEET_NAME);

  if (!sheet) {
    Logger.log("FATAL ALERT in getPeriodTimes(): Sheet '" + SCHEDULE_SHEET_NAME + "' is missing from the template. Cannot calculate period times.");
    // FIX: Replace blocking alert with non-blocking toast before throwing
    ss.toast("Configuration Error: The required sheet '" + SCHEDULE_SHEET_NAME + "' is missing. Cannot calculate period times.", "Error", 8); 
    // Throwing an error stops the execution chain cleanly.
    throw new Error("Missing required sheet: " + SCHEDULE_SHEET_NAME); 
  }

  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 9).getValues();

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var rowScheduleName = String(row[0]).trim(); // Schedule Name (Col A / Index 0)

    if (rowScheduleName === schedule) {
      var jsonString = row[8]; // JSON string (Col I / Index 8, since we fetched a 9-column range)

      if (!jsonString) {
        Logger.log('Warning: Schedule "' + schedule + '" found, but Column I (JSON data) is empty.');
        return null;
      }

      try {
        var scheduleJSON = JSON.parse(jsonString);

        for (var j = 0; j < scheduleJSON.length; j++) {
          if (String(scheduleJSON[j].period).trim() === String(period).trim()) {
            return {
              start: String(scheduleJSON[j].start), // Ensure times are returned as strings (e.g., '0815')
              end: String(scheduleJSON[j].end)
            };
          }
        }
        return null;
      } catch (e) {
        Logger.log('Error parsing schedule JSON on row ' + (i + 2) + ' for schedule "' + schedule + '": ' + e.message);
        return null;
      }
    }
  }

  return null;
}

// --- 2. DATE/TIME CONVERSION TOOLS ---

/**
 * Helper function to convert various time inputs (string, fractional number) into a reliable Date object component. 148
 *
 * Robustly converts different time formats (Date objects, time strings like "9:15 AM", 
 * or spreadsheet fractional numbers) into a reliable JavaScript Date object representing 
 * only the time component 149.
 * @param {Date|string|number} timeVal
 * @returns {Date|null} A Date object (time component only) or null.
 */
function parseTimeValue(timeVal) {
  if (!timeVal) return null;
  if (timeVal instanceof Date) {
    return timeVal;
  }
  if (typeof timeVal === 'string') {
    var timeStamp = new Date('12/30/1899 ' + timeVal);
    if (!isNaN(timeStamp.getTime())) {
      return timeStamp;
    }
  }
  if (typeof timeVal === 'number' && timeVal < 1) {
    var hours = Math.floor(timeVal * 24);
    var minutes = Math.round((timeVal * 24 * 60) % 60);
    var d = new Date();
    d.setHours(hours, minutes, 0, 0);
    return d;
  }
  return null;
}


/**
 * Converts a date and time from the spreadsheet into the ISO 8601 UTC 
 * format required by the Canvas API, respecting the Hawaii timezone.
 * * @param {Date} dateVal - The date object from the spreadsheet cell.
 * @param {number|string} timeVal - The time from Config (e.g., 815, 1405, 2200).
 * @return {string} The UTC formatted string (e.g., 2026-01-29T00:05:00Z).
 */

/**
 * BULLETPROOF HAWAII VERSION: 
 * Stops the "Day-Back" shift by treating the sheet value as a literal string first.
 */
function convertToUTC(dateVal, timeVal) {
  if (!dateVal || dateVal === "") return null;

  // 1. Get the date components without letting JS "guess" the timezone
  // We use the JS Date object methods but we check if they are shifting
  var d = new Date(dateVal);
  
  // If dateVal was "2026-01-28", and d.getDate() gives 27, we know it shifted.
  // To fix this, we use the UTC methods to get the literal day you typed.
  var year = d.getUTCFullYear();
  var month = d.getUTCMonth(); 
  var day = d.getUTCDate();

  // 2. Parse your TimeVal (e.g., 1405)
  var timeStr = String(timeVal);
  var hours = parseInt(timeStr.slice(0, timeStr.length - 2), 10);
  var minutes = parseInt(timeStr.slice(-2), 10);

  // 3. Create a date object using local parameters
  // This constructor: new Date(year, month, day, hours, mins) 
  // ALWAYS uses the script's local timezone (Hawaii).
  var localMoment = new Date(year, month, day, hours, minutes, 0);

  // 4. Convert to UTC String
  // This will correctly show the 29th for any time after 2:00 PM (14:00)
  var canvasString = Utilities.formatDate(localMoment, "UTC", "yyyy-MM-dd'T'HH:mm:ss'Z'");
  
  Logger.log("Target Local Time: " + localMoment.toString());
  Logger.log("Generated UTC String: " + canvasString);

  return canvasString;
}

// --- 3. GENERAL UTILITY TOOLS ---

/**
 * Toggles the status (checked/unchecked) of all checkboxes found within the currently selected cell range(s). 177
 *
 * Identifies if all checkboxes in the selected range are checked. If yes, it unchecks them; 
 * otherwise, it checks them. It specifically checks for cells with DataValidationCriteria.CHECKBOX 178.
 */
function toggleSelectedCheckboxes() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var selectedRanges = sheet.getActiveRangeList().getRanges();
  
  if (selectedRanges.length === 0) {
    ss.toast('Please select a range of cells first.', 'No Selection', 3);
    return;
  }
  
  var allChecked = true;
  var hasCheckboxes = false;
  var cellsToggled = 0;
  
  // First pass: Check if all current checkboxes are checked
  selectedRanges.forEach(function(range) {
    var values = range.getValues();
    var validations = range.getDataValidations();
    
    // Iterate through rows and columns of the range
    for (var i = 0; i < validations.length; i++) {
      for (var j = 0; j < validations[i].length; j++) {
        var validation = validations[i][j];
        if (validation != null && validation.getCriteriaType() == SpreadsheetApp.DataValidationCriteria.CHECKBOX) {
          hasCheckboxes = true;
          if (values[i][j] !== true) {
            allChecked = false;
          }
        }
      }
    }
  });
  
  if (!hasCheckboxes) {
    ss.toast('No checkboxes found in the selected range(s).', 'No Checkboxes', 3);
    return;
  }
  
  var newValue = !allChecked; // Determine the target value (uncheck all, or check all)
  
  // Second pass: Apply the new value to all found checkboxes
  selectedRanges.forEach(function(range) {
    var values = range.getValues();
    var validations = range.getDataValidations();
    
    for (var i = 0; i < validations.length; i++) {
      for (var j = 0; j < validations[i].length; j++) {
        var validation = validations[i][j];
        if (validation != null && validation.getCriteriaType() == SpreadsheetApp.DataValidationCriteria.CHECKBOX) {
          values[i][j] = newValue;
          cellsToggled++;
        }
      }
    }
    range.setValues(values);
  });
  
  ss.toast('Toggled ' + cellsToggled + ' checkbox(es).', 'Toggled', 3);
}

/**
 * Converts rich text content (links, bold, etc.) from a single spreadsheet cell range 
 * into basic HTML format suitable for GmailApp. 174
 *
 * Converts the rich text value of a cell range (used for email body) into basic HTML, 
 * specifically handling hyperlinks (<a>) and line breaks (<br>), for use with GmailApp.sendEmail 175.
 * @param {GoogleAppsScript.Spreadsheet.Range} range The range containing the rich text content.
 * @returns {string} The HTML formatted string.
 */
function convertRichTextToHtml(range) {
  var richTextValue = range.getRichTextValue();
  var text = richTextValue.getText();
  var runs = richTextValue.getRuns();
  var html = '';
  var lastIndex = 0;

  for (var i = 0; i < runs.length; i++) {
    var run = runs[i];
    var runText = run.getText();
    var runIndex = text.indexOf(runText, lastIndex);
    var url = run.getLinkUrl();

    // 1. Append plain text between runs or before the first run
    html += text.substring(lastIndex, runIndex);

    // 2. Apply hyperlink tag if a URL exists
    if (url) {
      html += '<a href="' + url + '">' + runText + '</a>';
    } else {
      // 3. Apply basic formatting (Note: Advanced formatting like bold/italics requires more complex logic)
      html += runText;
    }
    lastIndex = runIndex + runText.length;
  }

  // 4. Append any remaining text after the last run
  html += text.substring(lastIndex);

  // 5. Convert newline characters to HTML line breaks
  return html.replace(/\n/g, '<br>');
}

/**
 * Writes the unique ID of the current spreadsheet to a designated cell (B6) 
 * on the *Config* sheet. This ID is used for self-referencing IMPORTRANGE formulas.
 */
function writeCurrentSpreadsheetIdToConfig() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  var configSheet = ss.getSheetByName('*Config*');

  if (!configSheet) {
    // FIX: Replace blocking alert with non-blocking toast before throwing
    ss.toast("Configuration Error: The required sheet '*Config*' is missing.", "Error", 8); 
    throw new Error("Missing *Config* sheet.");
  }

  // Get the ID of the current spreadsheet
  var spreadsheetId = ss.getId();
  
  // Write the ID to the reserved cell B6
  configSheet.getRange('B6').setValue(spreadsheetId);
  
  // Optional: Add a label next to it for user clarity
  configSheet.getRange('A6').setValue('THIS_SHEET_ID (Auto-Generated)');
  
  Logger.log("Current Spreadsheet ID written to *Config*!B6: " + spreadsheetId);
}