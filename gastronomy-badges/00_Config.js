
/**
 * 00_Config.gs
 * This file contains the core setup and configuration functions for the Course Manager.
 * It is responsible for creating the custom menu, reading static settings from the *Config* sheet,
 * and securely handling the Canvas API key.
 *
 * NOTE: This version uses the advanced, two-tiered menu structure.
 */

/**
 * Creates the complete custom menu system for the Canvas Tools workbook 
 * using two top-level menus for organization: Day-to-Day Tools and Admin/Setup.
 * * Dependencies: refreshIndex() (09_MiscTools.gs), all menu functions (now consolidated 03-09).
 */
function onOpen() {


  var ui = SpreadsheetApp.getUi();

  // 1. CONTENT CREATION, GRADING, AND REPORTING (The daily use menu)
  ui.createMenu('Canvas Tools')
    .addItem('Update Etoilles', 'syncRosterGradesAndEtoilles')
    .addSeparator()
    .addItem('1. Set API Key and Base URL', 'setUserProperties')
    .addItem('2. Run FULL Data Refresh (Master Setup)', 'runFullDataRefresh') 
    .addToUi();
}


/**
 * Reads core configuration variables from the *Config* sheet.
 */
function getConfig() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('*Config*');
  if (!sheet) {
    throw new Error("*Config* sheet not found!");
  }

  var config = {};

  // Canvas & User Settings (Based on your *Config* CSV)
  config.BASE_URL = sheet.getRange("B2").getValue();
  config.CANVAS_USER_ID = sheet.getRange("B3").getValue();
  config.COURSE_ID = sheet.getRange("B4").getValue();

  config.CourseID = config.COURSE_ID;

  config.CC_EMAIL = sheet.getRange("B5").getValue();

  // Master Calendar Settings
  config.MASTER_SHEET_ID = sheet.getRange("D3").getValue();
  config.SCHOOL_YEAR_TAB = sheet.getRange("D5").getValue();

  config.ENCYCLOPEDIA_ID = sheet.getRange("B12").getValue();
  return config;
}

/**
 * Prompts the user for the Canvas API Key and securely stores it using PropertiesService.
 */
function setUserProperties() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var userProperties = PropertiesService.getUserProperties();
  var config = getConfig();
  var currentApiKey = userProperties.getProperty('CANVAS_API_KEY');
  var baseUrl = config.BASE_URL;

  // Prepare status message for the current key
  var currentKeyDisplay = currentApiKey 
    ? (currentApiKey.substring(0, 4) + '...') 
    : 'NOT SET';

  var promptMessage = 
    'Your current Base URL is: ' + baseUrl + '\n' +
    'The currently stored API Key starts with: ' + currentKeyDisplay + '\n\n' +
    'Please enter the new Canvas API Access Token (Personal Key) below, or click CANCEL to keep the current key:';

  var result = ui.prompt(
      'Canvas API Key Setup',
      promptMessage,
      ui.ButtonSet.OK_CANCEL
  );

  if (result.getSelectedButton() == ui.Button.OK) {
    var token = result.getResponseText();
    if (token) {
      PropertiesService.getUserProperties().setProperty('CANVAS_API_KEY', token);
      
      var newKeyDisplay = token.substring(0, 4) + '...';
      var successMessage = 
        'Success! API Key has been stored securely.\n\n' +
        'BASE URL: ' + baseUrl + '\n' +
        'SAVED KEY STARTS WITH: ' + newKeyDisplay;
        
      ss.toast(successMessage, 'API Key Saved (Success)', 8);
    } else {
      ss.toast('No key was entered. The API Key was not updated.', 'API Key Setup (Warning)', 8);
    }
  }
}