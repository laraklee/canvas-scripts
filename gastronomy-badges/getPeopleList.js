/**
 * Fetches the entire course roster from Canvas, writes the data to the *peopleList* sheet,
 * and sets up formulas for first/last name parsing.
 * @returns {void}
 */
function createPeopleList() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  // IMPORTANT: Assume getConfig() is robust enough to pull correct keys.
  var canvasApiToken = getCanvasToken_(); // Credentials.js
  var config = getConfig();
  // NOTE: Corrected Config property name to match 00_Config.gs style (COURSE_ID)
  var baseUrl = config.BASE_URL; 
  var courseId = config.COURSE_ID; 

  if (!canvasApiToken || !baseUrl || !courseId) {
    ss.toast(courseId ? missingSetupMessage_() : 'No course number in *Config* B4. Open Canvas Tools › Setup….', 'Setup needed', 8);
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
