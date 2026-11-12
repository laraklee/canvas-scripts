/**
 * Fetches all assignment groups and their contained assignments for the configured Course ID 
 * and writes them to the 'assignmentGroups' sheet. 72
 */
/**
 * Fetches Assignment Groups and their nested Assignments.
 * Updates the *assignmentGroups* sheet with Position instead of Points.
 */
function createAssignmentGroupsList() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  var canvasApiToken = getCanvasToken_(); // Credentials.js
  var config = getConfig();
  var baseUrl = config.BASE_URL;
  var courseId = config.COURSE_ID;
  var sheetName = '*assignmentGroups*';
  
  if (!canvasApiToken || !baseUrl || !courseId) {
    ss.toast(courseId ? missingSetupMessage_() : 'No course number in *Config* B4. Open Canvas Tools › Setup….', '🚨 Setup needed', 8);
    return;
  }
  
  // Request assignment groups, including assignments, and all dates for due date handling.
  var url = baseUrl + '/api/v1/courses/' + courseId + '/assignment_groups?per_page=100&include[]=assignments&include[]=all_dates';

  var options = {
    'method': 'get',
    'headers': { 'Authorization': 'Bearer ' + canvasApiToken },
    'muteHttpExceptions': true
  };
  
  var allGroups = [];
  var nextUrl = url;

  // Handle Pagination
  while (nextUrl) {
    var response = UrlFetchApp.fetch(nextUrl, options);
    if (response.getResponseCode() !== 200) {
      ss.toast("Failed to fetch assignment groups (Code " + response.getResponseCode() + "). Check log.", "🛑 API Error", 8);
      Logger.log("Assignment Group Fetch Error | Course=" + courseId + " | HTTP=" + response.getResponseCode());
      return;
    }
    
    var groups = JSON.parse(response.getContentText());
    allGroups = allGroups.concat(groups);
    
    var linkHeader = response.getAllHeaders()['Link'] || response.getAllHeaders()['link'];
    nextUrl = getNextUrl(linkHeader);
  }

  // --- Process Data ---
  var assignmentData = [];
  allGroups.forEach(function(group) {
    var groupId = group.id;
    var groupName = group.name;
    
    if (group.assignments && Array.isArray(group.assignments)) {
      group.assignments.forEach(function(assignment) {
        // Determine the latest due date from the 'all_dates' array
        var latestDueDate = assignment.all_dates && assignment.all_dates.length > 0 
          ? assignment.all_dates.reduce(function(latest, date) {
              return (latest === null || new Date(date.due_at) > new Date(latest.due_at)) ? date : latest;
            }, null) 
          : null;

        // REWRITE: Replaced assignment.points_possible with assignment.position
        assignmentData.push([
          assignment.id,                                    // 0: Assignment ID
          assignment.name,                                  // 1: Assignment Name
          groupId,                                          // 2: Assignment Group ID
          groupName,                                        // 3: Assignment Group Name
          assignment.position,                             // 4: Position (Internal order)
          latestDueDate ? latestDueDate.due_at : assignment.due_at, // 5: Latest Due Date (ISO)
          assignment.html_url                               // 6: Canvas URL
        ]);
      });
    }
  });

  // Sort by Assignment Name (Column 1)
  assignmentData.sort(function(a, b) {
    return String(a[1]).localeCompare(String(b[1]));
  });
  
  // --- Write to Sheet ---
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  } else {
    sheet.clear();
  }
  
  // REWRITE: Updated header to reflect 'Position' instead of 'Points'
  var headers = ['Assignment ID', 'Assignment Name', 'Group ID', 'Group Name', 'Position', 'Due Date (ISO)', 'Canvas URL'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  
  if (assignmentData.length > 0) {
    sheet.getRange(2, 1, assignmentData.length, headers.length).setValues(assignmentData);
    sheet.autoResizeColumns(1, headers.length);
  }

  ss.toast(assignmentData.length + ' assignments and groups fetched.', '✅ Assignments Updated', 5);
}