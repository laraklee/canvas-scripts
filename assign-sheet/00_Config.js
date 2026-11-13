/**
 * 00_Config.js
 * Purpose: the Canvas Tools menu (onOpen), the user guide side panel, and the *Config*
 *   tab readers (getConfig, getConfiguredPeriodPairs). Setup (token, connection, course,
 *   preview mode) is the Setup panel, Canvas Tools › ⚙️ Setup… (08_SetupPanel.js;
 *   2026-11-12). 📥 Bring over from my old copy… is 10_BringOver.js (2026-11-13). On open, a short message says whether preview mode is ON.
 *   Preview mode = the DRY_RUN setting (called "dry run" until 2026-11-12).
 * Canvas endpoints called: none.
 * Canvas write operations: none.
 * Required User/Script Properties: reads Script Property DRY_RUN on open (through
 *   05_CanvasApi.js); the Canvas address and token are User Properties read there.
 */

/**
 * Runs automatically when the spreadsheet is opened.
 * Creates the custom menu for tools, grouped by what each item works on.
 * Labels can change freely; the function names cannot (drawn buttons call them).
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Canvas Tools')
    .addSubMenu(ui.createMenu('📅 Calendar & announcements')
      .addItem('Post selected calendarEvents rows to Canvas', 'processUnifiedSheetForCanvasWithLinks')) // 03_Content_Sync.js
    .addSubMenu(ui.createMenu('📝 Assignment dates')
      .addItem('Load assignment dates from Canvas', 'fetchCanvasAssignmentDates') // 07_AssignmentDates.js
      .addItem('Send changed dates to Canvas', 'pushAssignmentDatesToCanvas')
      .addSeparator()
      .addItem('Add section dates below selected assignment', 'addSectionDatesRow')
      .addItem('Add student dates below selected assignment', 'addStudentDatesRow')
      .addItem('Remove section/student dates on selected rows', 'removeSelectedOverrideRows')
      .addItem('Sort by selected column (keeps ↳ rows together)', 'sortAssignmentDatesBySelectedColumn'))
    .addSeparator()
    .addItem('🔄 Update schedule from Master', 'runFullScheduleUpdate') // 02_Master_Builder.js (Steps 1-4)
    .addItem('🔗 Reset Master connection', 'updateMasterConnection')    // 01_Utilities.js (restores the IMPORTRANGE)
    .addItem('☑️ Toggle checkboxes', 'toggleSelectedCheckboxes')        // 01_Utilities.js
    .addSeparator()
    .addItem('⚙️ Setup…', 'showSetupPanel') // 08_SetupPanel.js (token, connection, course, preview mode)
    .addItem('📥 Bring over from my old copy…', 'showBringOverPanel') // 10_BringOver.js (new copy of the template)
    .addSeparator()
    .addItem('❓ User guide', 'showUserGuide')
    .addToUi();

  // A short "Preview mode is ON/OFF" message at the bottom right (05_CanvasApi.js).
  try {
    showPreviewModeToast_(SpreadsheetApp.getActiveSpreadsheet());
  } catch (error) {
    console.error('Preview mode message on open failed: ' + error.message);
  }
}

/**
 * Menu: Canvas Tools › ❓ User guide. Opens UserGuide.html in the side panel, docked on
 * the right, so teachers can follow the steps while they work (Lara, 2026-11-08). The
 * panel has a link to showUserGuideLarge. No Canvas calls; the page holds only the guide.
 */
function showUserGuide() {
  const html = HtmlService.createHtmlOutputFromFile('UserGuide')
    .setTitle('Assignment Sheet — User Guide');
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
  SpreadsheetApp.getUi().showModelessDialog(html, 'Assignment Sheet — User Guide');
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

// The Canvas token is set in the Setup panel: Canvas Tools › ⚙️ Setup… (08_SetupPanel.js).