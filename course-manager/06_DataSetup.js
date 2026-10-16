/**
 * 06_DataSetup.gs
 * This file contains the primary functions responsible for setting up and refreshing core 
 * lookup sheets by pulling bulk data from the Canvas API.
 * * * Dependencies:
 * - getConfig() (00_Config.gs)
 * - extractPeriod() (defined in this file)
 */

// --- 1. ROSTER AND ENROLLMENTS ---

/**
 * Fetches the entire course roster from Canvas, writes the data to the *peopleList* sheet,
 * and sets up formulas for first/last name parsing.
 * @returns {void}
 */
function createPeopleList() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  // IMPORTANT: Assume getConfig() is robust enough to pull correct keys.
  var userProperties = PropertiesService.getUserProperties();
  var canvasApiToken = userProperties.getProperty('CANVAS_API_KEY');
  var config = getConfig();
  // NOTE: Corrected Config property name to match 00_Config.gs style (COURSE_ID)
  var baseUrl = config.BASE_URL; 
  var courseId = config.COURSE_ID; 

  if (!canvasApiToken || !baseUrl || !courseId) {
    ss.toast("Error: Missing API Key/Course ID.", "Fatal Error", 5);
    return;
  }

  var peopleListSheet = ss.getSheetByName('*peopleList*');
  if (!peopleListSheet) {
    peopleListSheet = ss.insertSheet('*peopleList*');
  } else {
    // --- CRITICAL FIX: Check for and remove existing filter before clearing ---
    var existingFilter = peopleListSheet.getFilter();
    if (existingFilter) {
      existingFilter.remove();
    }
    // -------------------------------------------------------------------------
    peopleListSheet.clear();
  }

  // --- CONFIRMED WORKING HEADERS ---
  var headers = ['Course ID', 'Course Name', 'Section ID', 'User ID', 'Sorted Name', 'Role', 'Email', 'Last Name', 'First Name'];
  peopleListSheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#d0e8d2');

  var options = {
    headers: { 'Authorization': 'Bearer ' + canvasApiToken },
    muteHttpExceptions: true
  };

  var allPeopleData = [];
  
  // 1. Get Course Name
  var courseUrl = baseUrl + "/api/v1/courses/" + courseId;
  var courseResponse = UrlFetchApp.fetch(courseUrl, options);
  var courseContent = JSON.parse(courseResponse.getContentText());
  var courseName = courseContent.name || 'N/A';

  // 2. Fetch Enrollments
  var enrollmentsUrl = baseUrl + "/api/v1/courses/" + courseId + "/enrollments?per_page=100";
  // The API pagination loop should be implemented here for large courses.
  // Assuming a single fetch for now to match the good code.
  var enrollmentsResponse = UrlFetchApp.fetch(enrollmentsUrl, options);
  var enrollments = JSON.parse(enrollmentsResponse.getContentText());

  if (!Array.isArray(enrollments)) {
    ss.toast("API Error: Enrollment data is not an array.", "Fatal Error", 5);
    return;
  }

  // 3. Process Data
  for (var i = 0; i < enrollments.length; i++) {
    var enrollment = enrollments[i];
    if (!enrollment.user || !enrollment.user.id) continue;

    allPeopleData.push([
      enrollment.course_id || courseId, // Col A (Course ID)
      courseName,                      // Col B (Course Name)
      enrollment.course_section_id,    // Col C (Section ID)
      enrollment.user.id,              // Col D (User ID)
      enrollment.user.sortable_name,   // Col E (Sorted Name)
      enrollment.type,                 // Col F (Role - i.e. StudentEnrollment)
      enrollment.user.login_id,        // Col G (Email/Login ID) <-- NOTE: Index 6
      '',                              // Col H (Last Name - Formula Target)
      ''                               // Col I (First Name - Formula Target)
    ]);
  }

  // 4. Write Data and Apply Formulas/Formatting
  if (allPeopleData.length > 0) {
    allPeopleData.sort(function(a, b) { return a[4].localeCompare(b[4]); });

    var dataRange = peopleListSheet.getRange(2, 1, allPeopleData.length, headers.length);
    dataRange.setValues(allPeopleData);
    
    // Formulas for Last Name (Col H, Index 7) and First Name (Col I, Index 8)
    var lastNameFormula = '=IFERROR(LEFT(E2, FIND(",", E2) - 1), E2)';
    var firstNameFormula = '=IFERROR(TRIM(RIGHT(E2, LEN(E2) - FIND(",", E2))), "")';

    // Apply formulas starting from Row 2
    peopleListSheet.getRange(2, 8, allPeopleData.length, 1).setFormula(lastNameFormula);
    peopleListSheet.getRange(2, 9, allPeopleData.length, 1).setFormula(firstNameFormula);
    
    peopleListSheet.setFrozenRows(1);
    
    // Re-apply filter here
    peopleListSheet.getRange(1, 1, allPeopleData.length + 1, headers.length).createFilter(); 
    peopleListSheet.autoResizeColumns(1, headers.length);
    
    ss.toast("People list updated with " + allPeopleData.length + " entries.", "Success!", 3);
  } else {
    ss.toast("Warning: No enrollments found.", "Warning", 5);
  }
}


// --- 2. ASSIGNMENT LOOKUP ---

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
  var userProperties = PropertiesService.getUserProperties();
  var canvasApiToken = userProperties.getProperty('CANVAS_API_KEY');
  var config = getConfig();
  var baseUrl = config.BASE_URL;
  var courseId = config.COURSE_ID;
  var sheetName = '*assignmentGroups*';
  
  if (!canvasApiToken || !baseUrl || !courseId) {
    ss.toast("API Key, Base URL, or Course ID is missing. Cannot fetch assignments.", "🚨 Configuration Error", 8);
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
      Logger.log("Assignment Group Fetch Error: " + response.getContentText().slice(0, 300));
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


// --- 3. SECTION LOOKUP (DEPENDS ON ROSTER) ---

/**
 * Creates the *SectionLookup* sheet, which is a key dependency for many other functions. 
 * It calls getUniqueSectionIds and fetchSectionNames to populate a list of Canvas sections 
 * with their corresponding period numbers 75.
 */
function createSectionLookup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  var peopleListSheet = ss.getSheetByName('*peopleList*');
  var sheetName = '*SectionLookup*';
  
  if (!peopleListSheet) {
    ss.toast('Error: *peopleList* not found. Run Roster refresh first.', 'Fatal Error', 5);
    return;
  }
  
  var sectionLookupSheet = ss.getSheetByName(sheetName);
  if (!sectionLookupSheet) {
    sectionLookupSheet = ss.insertSheet(sheetName);
  } else {
    sectionLookupSheet.clear();
  }
  
  // Helper functions used internally
  var sectionIds = getUniqueSectionIds(peopleListSheet);
  var sectionData = fetchSectionNames(sectionIds);
  
  sectionLookupSheet.getRange(1, 1, 1, 4).setValues([['Section ID', 'Section Name', 'Period', 'Section ID Copy']]).setFontWeight('bold');
  
  if (sectionData.length > 0) {
    sectionLookupSheet.getRange(2, 1, sectionData.length, 4).setValues(sectionData);
  }
  
  sectionLookupSheet.autoResizeColumns(1, 4);
  ss.toast(sheetName + ' sheet created with ' + sectionData.length + ' sections.', '✅ Lookup Created', 3);
}

/**
 * Helper: Gets unique Section IDs from the specified sheet (Column C, index 2). 77
 *
 * Helper function that reads Column C (Section ID) from the given sheet (typically *peopleList*) 
 * and returns an array of unique Section IDs 78.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet The sheet to read from (*peopleList*).
 * @returns {string[]} An array of unique string Section IDs.
 */
function getUniqueSectionIds(sheet) {
  // Read all non-header values from Column C (Section ID)
  var sectionColumn = sheet.getRange('C2:C' + sheet.getLastRow()).getValues();
  var uniqueSections = {};
  
  sectionColumn.forEach(function(row) {
    if (row[0]) uniqueSections[row[0]] = true;
  });
  
  return Object.keys(uniqueSections);
}

/**
 * Helper: Fetches full section data from Canvas for a list of Section IDs. 80
 *
 * Fetches the full section details (name, period) from the Canvas API for a batch of 
 * sectionIds using individual API calls 81.
 * @param {string[]} sectionIds Array of Section IDs.
 * @returns {any[][]} Returns a 2D array of section data [ID, Name, Period, ID Copy].
 */
/**
 * Helper: Fetches full section data from Canvas for a list of Section IDs.
 * Optimized to prevent UI "spinner" hangs by batching UI updates.
 * @param {string[]} sectionIds Array of Section IDs.
 * @returns {any[][]} Returns a 2D array of section data [ID, Name, Period, ID Copy].
 */
function fetchSectionNames(sectionIds) {
  var userProperties = PropertiesService.getUserProperties();
  var canvasApiToken = userProperties.getProperty('CANVAS_API_KEY');
  var config = getConfig(); // cite: 1536
  var baseUrl = config.BASE_URL; // cite: 1537
  var courseId = config.COURSE_ID; // cite: 1538
  var sectionData = [];
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  if (!canvasApiToken || !baseUrl || !courseId) { // cite: 1539
    ss.toast("API Key, Base URL, or Course ID is missing. Cannot fetch section names.", "🚨 Configuration Error", 8);
    return [];
  }

  for (var i = 0; i < sectionIds.length; i++) {
    var sectionId = sectionIds[i];
    
    // --- UI OPTIMIZATION: Only toast every 5 sections to prevent UI lag ---
    if (i % 5 === 0 || i === sectionIds.length - 1) {
      ss.toast('Fetching section ' + (i + 1) + ' of ' + sectionIds.length + '...', 'Progress');
      // Force the spreadsheet to "catch up" so the spinner doesn't get orphaned
      SpreadsheetApp.flush(); // cite: 2599
    }

    var url = baseUrl + '/api/v1/courses/' + courseId + '/sections/' + sectionId; // cite: 1548
    var options = {
      'method': 'get',
      'headers': { 'Authorization': 'Bearer ' + canvasApiToken }, // cite: 1543
      'muteHttpExceptions': true // cite: 1544
    };

    try {
      var response = UrlFetchApp.fetch(url, options);
      if (response.getResponseCode() === 200) {
        var section = JSON.parse(response.getContentText()); // cite: 1551
        var period = extractPeriod(section.name); // cite: 1552

        sectionData.push([
          section.id,   // cite: 1553
          section.name, // cite: 1553
          period,       // cite: 1553
          section.id    // cite: 1553 (ID Copy for VLOOKUP key)
        ]);
      } else {
        Logger.log('Failed to fetch section ' + sectionId + ': Code ' + response.getResponseCode()); // cite: 1555
      }
    } catch (e) {
      Logger.log('System error fetching section ' + sectionId + ': ' + e.message); // cite: 1555
    }
  }

  return sectionData;
}

/**
 * Helper: Extracts the period number from a section name (e.g., "Course (P3)" -> "3"). 82
 *
 * Uses a regular expression (/\(P(\d+)\)/) to parse the period number from a section name string 83.
 * @param {string} sectionName
 * @returns {string} The period number string (e.g., "3") or an empty string.
 */
function extractPeriod(sectionName) {
  var match = String(sectionName).match(/\(P(\d+)\)/);
  return match ? match[1] : '';
}
