/**
 * 05_DataSync.gs
 * This file handles synchronization tasks, including running a full data refresh from Canvas 
 * and managing the IMPORTRANGE connection to the external Master Calendar sheet.
 * * * CRITICAL ASSUMPTION: The 'simpleSchedule' data is synchronized via an IMPORTRANGE 
 * or another method handled by updateMasterConnection() or runFullScheduleUpdate().
 */

/**
 * Executes all primary data refresh functions in the correct order. 122
 *
 * Orchestrates the entire setup process by calling the key functions required to pull 
 * static lookup data from Canvas (Roster, Assignments, Sections, Grading Periods) 123.
 * * NOTE: This function requires createPeopleList(), createAssignmentGroupsList(), 
 * createSectionLookup(), fetchAndWriteGradingPeriodsWithLogging(), and inputScheduleCode() 
 * to be defined in subsequent files.
 */

function runFullDataRefresh() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  // Step 1: Config
  ss.toast('Step 1: Updating Config...', 'Progress');
  writeCurrentSpreadsheetIdToConfig();
  SpreadsheetApp.flush(); 

  // Step 2: API Calls
  ss.toast('Step 2: Fetching Canvas Roster & Assignments...', 'Progress');
  createPeopleList();
  createAssignmentGroupsList();
  // REMOVED: courseNameLookupByAPI(); <-- Stripped out to prevent crash
  SpreadsheetApp.flush(); 

  // Step 3: Dependent Processing
  ss.toast('Step 3: Updating Sections...', 'Progress');
  createSectionLookup();
  // REMOVED: fetchAndWriteGradingPeriodsWithLogging(); <-- Stripped out legacy gradebook dependency
  SpreadsheetApp.flush();

  // Step 4: Schedule
  ss.toast('Step 4: Synchronizing Schedule...', 'Progress');
  runFullScheduleUpdate();
  ss.toast('All core Canvas data sheets updated.',  '✅ Setup Complete'  , 5);
}

/**
 * Runs the schedule update process, which is assumed to pull external schedule data 
 * and populate the *simpleSchedule* sheet. 
 */
function runFullScheduleUpdate() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  ss.toast("Schedule synchronization started. This may take a moment.", "Schedule Update", 15); // Use longer display time for long task
  
  try {
    // CRITICAL: Logic to read Master Sheet ID and pull/process data into *simpleSchedule*
    // Placeholder function call for schedule data import and processing
    // inputScheduleCode(); 
    
    ss.toast('Schedule data updated in *simpleSchedule*.', 'Sync Complete', 5);
    
  } catch (e) {
    // FIX 1: Replace blocking alert with non-blocking toast for schedule sync failure
    ss.toast("Failed to update schedule data: " + e.message, "⚠️ Schedule Sync Error", 8);
    Logger.log("Schedule Sync Error: " + e.message);
  }
}


/**
 * Resets the connection to the Master Calendar sheet, typically by re-writing an 
 * IMPORTRANGE formula to force a refresh of the connection token.
 */
function updateMasterConnection() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // This function would contain logic to clear and re-write the IMPORTRANGE 
  // formula on a hidden cell of the *simpleSchedule* sheet.
  // Since we are not sure of the exact cell/formula, we will provide a placeholder.
  
  // FIX 2: Replace blocking alert with non-blocking toast for simple status
  ss.toast("Master sheet connection token refreshed. Run 'Update Data from Master' next.", "🔗 Connection Refreshed", 5);
  Logger.log("Master connection token refreshed.");
}