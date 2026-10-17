/* 01_Utilities.gs */

/**
 * CONNECTS TO THE MASTER:
 * Injects a DYNAMIC formula into A1 that reads directly from *Config*.
 * UPDATED: Uses toast to prevent UI freezing.
 */
function updateMasterConnection() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var targetTabName = '*simpleSchedule*';
  var targetSheet = ss.getSheetByName(targetTabName);
  
  // Create or clear the sheet
  if (!targetSheet) {
    targetSheet = ss.insertSheet(targetTabName);
  } else {
    targetSheet.clear(); 
  }

  // The Smart Formula: 
  // Reads Doc ID from '*Config*!D3'
  // Reads Sheet Name from '*Config*!D5' and appends "!A:M"
  var dynamicFormula = '=IMPORTRANGE(\'*Config*\'!D3, \'*Config*\'!D5 & "!A:M")';
  
  // Set the formula
  targetSheet.getRange("A1").setFormula(dynamicFormula);
  
  logToSystem("updateMasterConnection", "Connection reset with dynamic Config links.");
  
  // FINAL SUCCESS (Non-blocking)
  ss.toast("Connection Reset! Check *simpleSchedule* A1 for #REF! errors (Allow Access).", "Success", 5);
}

/**
 * Forces the IMPORTRANGE function in the '*simpleSchedule*' sheet to recalculate.
 * This is the "Soft Refresh" that toggles a cell to force Google to fetch new data.
 */
function refreshSimpleSchedule() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('*simpleSchedule*');

  if (!sheet) {
    logToSystem("refreshSimpleSchedule", "Sheet not found.");
    return;
  }

  // Add a temporary cell with NOW() function to force a flush/recalc
  var tempCell = sheet.getRange('A2');
  tempCell.setFormula('=NOW()');
  SpreadsheetApp.flush();
  tempCell.clear();
  
  logToSystem("refreshSimpleSchedule", "Refreshed IMPORTRANGE.");
}

/**
 * UI HELPER: Toggles checkboxes in the currently selected range.
 */
function toggleSelectedCheckboxes() {
  var range = SpreadsheetApp.getActiveRange();
  if (!range) return;
  
  var values = range.getValues();
  var allChecked = true;

  // First pass: Check if everything is currently checked
  for (var i = 0; i < values.length; i++) {
    for (var j = 0; j < values[i].length; j++) {
      if (values[i][j] !== true) {
        allChecked = false;
        break;
      }
    }
  }

  // If all are checked, uncheck them. Otherwise, check them all.
  range.setValue(!allChecked);
}

/**
 * LOGGING HELPER: Standardized logging format.
 */
function logToSystem(functionName, message) {
  var timestamp = new Date().toLocaleTimeString();
  Logger.log("[" + timestamp + "] " + functionName + ": " + message);
}

/**
 * Helper function to refresh specific formulas on a single Quarter sheet.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} targetSheet The sheet containing the broken formulas (e.g., Q1).
 */
function refreshQuarterFormulas_(targetSheet) {
  if (!targetSheet) {
    console.error("Target sheet not provided for formula refresh.");
    return;
  }
  
  const sheetName = targetSheet.getName();
  const rangesToRefresh = ['A4', 'B2']; // The cells containing the potentially broken formulas

  rangesToRefresh.forEach(rangeString => {
    try {
      var range = targetSheet.getRange(rangeString);
      var formula = range.getFormula();
      
      // We only refresh if a formula exists and is not empty
      if (formula && formula !== "") {
        // Read and immediately write the formula back to force a refresh
        range.setFormula(formula);
        console.log(`Refreshed formula in ${sheetName}!${rangeString}`);
      }
    } catch (e) {
      console.error(`Failed to refresh formula in ${sheetName}!${rangeString}: ${e.toString()}`);
    }
  });

  // Since this is a helper, we call flush outside the loop to batch updates
}

/**
 * Main function to iterate through Q1-Q4 sheets and fix broken formula references.
 * Should be called after AssignmentLookupFinal is rebuilt.
 */
function refreshAllQuarterSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // We use an array to explicitly define the sheets to process
  const quarterSheets = ['Q1', 'Q2', 'Q3', 'Q4']; 
  
  console.log("Starting refreshAllQuarterSheets...");

  quarterSheets.forEach(sheetName => {
    const sheet = ss.getSheetByName(sheetName);
    
    if (sheet) {
      // Call the helper function for each sheet
      refreshQuarterFormulas_(sheet);
    } else {
      console.warn(`Quarter sheet '${sheetName}' not found. Skipping refresh.`);
    }
  });

  // Important: Flush the spreadsheet operations only once at the end
  SpreadsheetApp.flush(); 
  console.log("refreshAllQuarterSheets: Complete.");
}