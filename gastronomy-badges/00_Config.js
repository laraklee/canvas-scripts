
/**
 * 00_Config.js
 * Purpose: the Canvas Tools menu (onOpen), the user guide side panel, and getConfig(),
 *   which reads the *Config* tab. The Canvas address and token live in each teacher's
 *   User Properties (Credentials.js) and are set in the Setup panel (SetupPanel.js,
 *   Canvas Tools › Setup…, 2026-11-12; it replaced "1. Set API Key and Base URL").
 * Canvas endpoints called: none.
 * Canvas write operations: none.
 * Required User/Script Properties: User Property CANVAS_BASE_URL (through
 *   getCanvasBaseUrl_ in Credentials.js).
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
    .addItem('Setup…', 'showSetupPanel')
    .addItem('Run FULL Data Refresh', 'runFullDataRefresh')
    .addSeparator()
    .addItem('User guide', 'showUserGuide')
    .addToUi();
}


/**
 * Menu: Canvas Tools › User guide. Opens UserGuide.html in the side panel, docked on the
 * right, so teachers can follow the steps while they work (Lara, 2026-11-08). The panel
 * has a link to showUserGuideLarge. No Canvas calls; the page holds only the guide text.
 */
function showUserGuide() {
  const html = HtmlService.createHtmlOutputFromFile('UserGuide')
    .setTitle('Gastronomy Badges — User Guide');
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Called from the side panel's "Open in a large window" link (google.script.run), so it
 * has no trailing underscore. Opens the same guide in a big window over the sheet.
 */
function showUserGuideLarge() {
  const html = HtmlService.createHtmlOutputFromFile('UserGuide')
    .setWidth(900)
    .setHeight(650);
  SpreadsheetApp.getUi().showModelessDialog(html, 'Gastronomy Badges — User Guide');
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

  // Canvas address: this teacher's own saved one (Credentials.js; 2026-11-12). *Config*
  // B2 only fills it in the first time.
  config.BASE_URL = getCanvasBaseUrl_();
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
