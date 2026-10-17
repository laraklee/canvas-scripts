/* 00_Config.gs */

/**
 * Runs automatically when the spreadsheet is opened.
 * Creates the custom menu for tools.
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Canvas Tools')
    .addItem('Set API Key', 'setUserProperties')
    .addSeparator()
    .addItem('🔄 Update Data from Master', 'runFullScheduleUpdate')   // Runs the Builder (Steps 1-4)
    .addItem('🔗 Reset Master Connection', 'updateMasterConnection') // Restores the IMPORTRANGE (Source)
    .addSeparator()
    .addItem('Toggle Checkboxes', 'toggleSelectedCheckboxes')
    .addToUi();
}

/**
 * Reads specific cells from the *Config* sheet based on your Project Layout.
 */
function getConfig() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('*Config*');
  if (!sheet) {
    throw new Error("*Config* sheet not found!");
  }

  var config = {};
  
  // Canvas & User Settings
  config.BASE_URL = sheet.getRange("B2").getValue();
  config.CANVAS_USER_ID = sheet.getRange("B3").getValue();
  config.COURSE_ID = sheet.getRange("B4").getValue();
  config.CC_EMAIL = sheet.getRange("B5").getValue();
  
  // Master Calendar Settings
  config.MASTER_SHEET_ID = sheet.getRange("D3").getValue();
  config.SCHOOL_YEAR_TAB = sheet.getRange("D5").getValue();

  return config;
}

/**
 * Reads the *Config* sheet to see which Period Pairs are active (checked).
 * Looks at E2:F5.
 */
function getConfiguredPeriodPairs() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var configSheet = ss.getSheetByName('*Config*');
  if (!configSheet) return ['1,2', '3,4', '5,6', '7,8']; // Default fallback

  // Read E2:F5 (4 rows, 2 columns)
  // Col 1 (E) = Checkbox, Col 2 (F) = Label
  var values = configSheet.getRange("E2:F5").getValues(); 
  var selectedPairs = [];

  for (var i = 0; i < values.length; i++) {
    var isChecked = values[i][0]; 
    var label = String(values[i][1]).trim();
    
    if (isChecked === true && label !== "") {
      selectedPairs.push(label);
    }
  }

  return selectedPairs.length > 0 ? selectedPairs : ['1,2', '3,4', '5,6', '7,8'];
}

/**
 * Securely sets the Canvas API Key in User Properties.
 */
function setUserProperties() {
  var ui = SpreadsheetApp.getUi();
  var userProperties = PropertiesService.getUserProperties();
  var config = getConfig();

  var currentApiKey = userProperties.getProperty('CANVAS_API_KEY') || '[No API Key set]';
  var displayKey = currentApiKey === '[No API Key set]' ? currentApiKey : currentApiKey.substring(0, 5) + '...';

  var response = ui.prompt('Set API Key', 
    'Current Base URL: ' + config.BASE_URL + '\n' +
    'Current Key: ' + displayKey + '\n\n' +
    'Enter new Canvas API Key:', ui.ButtonSet.OK_CANCEL);

  if (response.getSelectedButton() == ui.Button.OK) {
    var newKey = response.getResponseText().trim();
    if (newKey) {
      userProperties.setProperty('CANVAS_API_KEY', newKey);
      ui.alert('Success', 'API Key saved securely.', ui.ButtonSet.OK);
    }
  }
}