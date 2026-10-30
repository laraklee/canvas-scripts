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