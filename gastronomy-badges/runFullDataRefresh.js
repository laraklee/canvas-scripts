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
  SpreadsheetApp.flush(); // Commit ID before moving to API calls

  // Step 2: API Calls
  ss.toast('Step 2: Fetching Canvas Roster & Assignments...', 'Progress');
  createPeopleList();
  createAssignmentGroupsList();
  SpreadsheetApp.flush(); // Release UI thread to render the new tables
  
  ss.toast('All core Canvas data sheets updated.', '✅ Setup Complete' , 5);
}