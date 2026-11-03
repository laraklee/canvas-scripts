
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
  try {
    refreshIndex();
  } catch(e) {
    Logger.log("Initial Setup Refresh Failed: " + e.message);
  }

  var ui = SpreadsheetApp.getUi();

  // THE REVISED GRADEBOOK-FREE DAILY TOOLS MENU
  ui.createMenu('Canvas Tools')
    .addSubMenu(
      ui.createMenu('1. Roster & Data Sync')
        .addItem('Create Roster Table (Active Sheet)', 'createActiveSheetRoster')
        .addSeparator()
        .addItem('🔄 Map Multi-Column Range to Jupiter Export', 'mapMultipleCanvasAssignmentsToJupiterExport')
    )
    .addSeparator()
    .addSubMenu(
      ui.createMenu('2. Batch Text Comments')
        .addItem('Post Comments to Canvas Portals (Active Col +1)', 'postBatchCommentsForAssignmentActiveColumn')
        .addItem('Post Single Message Comment to ALL Students', 'promptAndConfirmBatchCommentToAllStudents')
    )
    .addSeparator()
    .addSubMenu(
      ui.createMenu('3. Content Creation')
        .addItem('A. Create All (Assignment + Overrides)', 'makeAssignmentAll')
        .addItem('B. Load Assignment for Editing', 'fetchAssignment')
        .addItem('C. Update Existing Assignment', 'updateAssignmentInCanvas')
        .addSeparator()
        .addItem('Create New Quiz (Shell + Overrides)', 'createQuizWithOverrides')
        .addItem('Create Classic Quiz (Shell + Overrides)', 'postOneClassicQuizWithOverrides')
        .addItem('Create Graded Discussion (Shell + Overrides)', 'createDiscussionWithOverrides')
        .addSeparator()
        .addItem('Add Questions to Classic Quiz (Reads A15:J)', 'addQuestionsToClassicQuiz')
    )
    .addSeparator()
    .addSubMenu(
      ui.createMenu('4. Rubric Layouts')
        .addItem('Setup Rubric Template (Active Sheet)', 'setupRubricUI')
        .addItem('Export for Canvas (to New Sheet)', 'exportRubricToCanvasFormat')
        .addSeparator()
        .addItem('Batch Calendar/Announce (Selected Rows)', 'processUnifiedSheetForCanvasWithLinks')
    )
    .addToUi();

  // THE ADMIN & INITIALIZATION SETUP MENU
  ui.createMenu('Setup & Admin')
    .addItem('1. Set API Key and Base URL', 'setUserProperties')
    .addItem('2. Run FULL Data Refresh (Master Setup)', 'runFullDataRefresh')
    .addSeparator()
    .addSubMenu(
      ui.createMenu('Roster & Utility Tools')
        .addItem('Refresh Assignment Groups (*assignmentGroups*)', 'createAssignmentGroupsList')
        .addItem('A. Fill Selected Cells Sequentially', 'fillSelectedRangeSequentially')
        .addItem('B. Push Position to Canvas (Selected Rows)', 'updateAssignmentPositionsFromSelectedRows')
        .addSeparator()
        .addItem('Create Seating Chart Slides (from *Config*)', 'createStudentTextBoxes')
        .addItem('Refresh Sheet Index', 'refreshIndex')
    )
    .addSeparator()
    .addSubMenu(
      ui.createMenu('Email & Dev Tools')
        .addItem('Generate Email List (in Active Cell)', 'generateEmailList')
        .addItem('Toggle Selected Checkboxes', 'toggleSelectedCheckboxes')
        .addItem('Send Emails (BCC Selected)', 'sendEmailsToSelected')
        .addSeparator()
        .addItem('Parse JSON Response to Sheet', 'parseJsonToSheet')
    )
    .addSeparator()
    .addSubMenu(
      ui.createMenu('Group Management')
        .addItem('1. Clear Group Data', 'clearGroupData')
        .addItem('2. Create Group Category', 'createGroupCategory')
        .addItem('3. Create Groups List', 'createGroups')
        .addSeparator()
        .addItem('List Groups & Members (Group List tab)', 'listGroupsAndMembers')
    )
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