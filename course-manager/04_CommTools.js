/**
 * 04_CommTools.gs
 * This file contains functions related to direct communication, specifically targeted email 
 * delivery via GmailApp based on student selections, and generating quick roster tables.
 * * CRITICAL DEPENDENCIES: 
 * - convertRichTextToHtml() (from 01_Utilities.gs)
 * - *peopleList* and *SectionLookup* (from 06_DataSetup.gs)
 */

/**
 * Creates the active sheet roster by pulling student and section data from 
 * the '*peopleList*' and '*SectionLookup*' sheets and writing the basic roster
 * (ID, Name, Period, Section, Email) starting at Row 3.
 */
function createActiveSheetRoster() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();

  var peopleListSheet = ss.getSheetByName('*peopleList*'); 
  var sectionLookupSheet = ss.getSheetByName('*SectionLookup*'); 
  
  var START_ROW = 3; 
  var HEADER_ROW = 2; 

  if (!peopleListSheet || !sectionLookupSheet) {
    var missing = [];
    if (!peopleListSheet) missing.push("'*peopleList*'");
    if (!sectionLookupSheet) missing.push("'*SectionLookup*'");
    
    ss.toast('Setup Error: Missing ' + missing.join(' and ') + '. Please run a Full Data Refresh.', '🚨 Error', 8);
    return;
  }

  // 1. Load Data
  // peopleData loads 7 columns starting from Col C: [Section ID(0), User ID(1), Sorted Name(2), Role(3), Email(4), ...]
  var lastRowPeople = peopleListSheet.getLastRow();
  // Read range C2:G (5 columns) to get Section ID, User ID, Name, Role, Email
  var peopleData = peopleListSheet.getRange(2, 3, lastRowPeople - 1, 5).getValues(); 

  // Assumed SectionLookup structure: [ID(0), Name(1), Period(2)]
  var lastRowLookup = sectionLookupSheet.getLastRow();
  var sectionData = sectionLookupSheet.getRange(2, 1, lastRowLookup - 1, 3).getValues();

  var sectionMap = {};
  sectionData.forEach(function(row) {
    sectionMap[row[0]] = { period: row[2], name: row[1] };
  });

  // 2. Process and Filter Student Data
  var outputData = [];
  var headers = ['User ID', 'Name', 'Period', 'Section Name', 'Email'];

  peopleData.forEach(function(row) {
    var sectionId = row[0]; // Section ID (Index 0, was Col C)
    var role = row[3]; // Role (Index 3, was Col F)

    if (role === 'StudentEnrollment') {
      var period = sectionMap[sectionId] ? sectionMap[sectionId].period : 'N/A';
      var sectionName = sectionMap[sectionId] ? sectionMap[sectionId].name : 'N/A';

      outputData.push([
        row[1],      // User ID (Index 1, was Col D)
        row[2],      // Sorted Name (Index 2, was Col E)
        period,      // Period
        sectionName, // Section Name
        row[4]       // Email Address (Index 4, was Col G)
      ]);
    }
  });

  var numStudents = outputData.length;

  if (numStudents === 0) {
    ss.toast('Roster Empty: No students found.', '⚠️ Warning', 8);
    return;
  }

  // 3. Clear and Write
  var clearRange = sheet.getRange(HEADER_ROW, 1, sheet.getMaxRows(), headers.length + 5);
  clearRange.clearContent();
  clearRange.clearFormat();

  // Write Headers (Row 2)
  sheet.getRange(HEADER_ROW, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#B7E1CD');

  // Write Data (Starting at Row 3)
  sheet.getRange(START_ROW, 1, numStudents, headers.length).setValues(outputData);

  // Formatting
  sheet.setColumnWidth(2, 250); // Name
  sheet.setColumnWidth(4, 200); // Section Name
  sheet.setColumnWidth(5, 250); // Email

  ss.toast(numStudents + ' students written to active sheet roster.', '✅ Roster Populated', 5);
}

/**
 * Sends an email using GmailApp to the specified primary recipient, BCC'ing all selected recipients 
 * (those with a checked box in Column A). Reads student data starting from Row 13. 93
 *
 * Reads email content (Subject, Body, Sender/Primary Recipient) from Rows 4-10, gathers BCC 
 * emails from selected rows (Checkbox in Col A, Email in Col E), and sends a single email via 
 * GmailApp 94.
 */
function sendEmailsToSelected() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var ui = SpreadsheetApp.getUi(); // Kept for consistency, but replacing alerts

  var senderName = sheet.getRange("C4").getValue();
  var primaryRecipient = sheet.getRange("C10").getValue();
  var subject = sheet.getRange("C5").getValue();
  var bodyRange = sheet.getRange("C6:E9");

  // CRITICAL DEPENDENCY: Must be defined in 01_Utilities.gs
  if (typeof convertRichTextToHtml !== 'function') {
    ss.toast('The required helper function convertRichTextToHtml is missing from 01_Utilities.gs.', '🚨 Setup Error', 8);
    return;
  }
  var bodyHtml = convertRichTextToHtml(bodyRange);

  var lastRow = sheet.getLastRow();
  var startDataRow = 13;
  var numDataRows = lastRow - startDataRow + 1;

  if (numDataRows <= 0) {
    ss.toast('No student data found starting at row ' + startDataRow + '.', '🛑 Data Error', 5);
    return;
  }

  var dataRange = sheet.getRange(startDataRow, 1, numDataRows, 5);
  var data = dataRange.getValues();
  var bccRecipients = [];

  for (var i = 0; i < data.length; i++) {
    // Column A (Index 0) is the checkbox, Column E (Index 4) is the email
    if (data[i][0] === true) { 
      var emailAddress = data[i][4];
      if (emailAddress) {
        bccRecipients.push(emailAddress);
      }
    }
  }

  if (bccRecipients.length > 0 && primaryRecipient) {
    try {
      GmailApp.sendEmail(primaryRecipient, subject, '', {
        name: senderName,
        htmlBody: bodyHtml,
        bcc: bccRecipients.join(',')
      });

      var message = "Email sent to " + primaryRecipient + " with " + bccRecipients.length + " recipients BCC'd.";
      ss.toast(message, '✅ Email Sent', 5);
      return message;
    } catch (e) {
      ss.toast('Failed to send email. Check Gmail permissions: ' + e.message, '❌ Gmail Error', 10);
      Logger.log('Email failed: ' + e.message);
      return 'Email failed: ' + e.message;
    }
  } else {
    var errorMessage = "No recipients selected or primary recipient (C10) missing.";
    ss.toast(errorMessage, '⚠️ Warning', 5); 
    return errorMessage;
  }
}

/**
 * Fetches the student roster and section data, then writes a formatted, sortable
 * email list starting at the currently active cell. 
 * Requires *peopleList* and *SectionLookup* to be populated. 96
 */
function generateEmailList() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  var activeSheet = ss.getActiveSheet();
  var activeCell = ss.getActiveCell();

  var existingFilter = activeSheet.getFilter();
  if (existingFilter) {
    existingFilter.remove();
  }

  var peopleListSheet = ss.getSheetByName('*peopleList*');
  var sectionLookupSheet = ss.getSheetByName('*SectionLookup*');
  
  // 1. Check Prerequisites
  if (!peopleListSheet || !sectionLookupSheet) {
    ss.toast('Setup Error: Missing *peopleList* or *SectionLookup*. Run a full data refresh.', '🚨 Error', 8);
    return;
  }

  // 2. Load Data (Retrieves 9 columns of data based on fixed createPeopleList structure)
  var lastRowPeople = peopleListSheet.getLastRow();
  // Start reading from Col A (1) for 7 columns to get all required indices (up to email)
  var peopleData = peopleListSheet.getRange(2, 1, lastRowPeople - 1, 7).getValues(); 

  var lastRowLookup = sectionLookupSheet.getLastRow();
  var sectionData = sectionLookupSheet.getRange(2, 1, lastRowLookup - 1, 3).getValues();
  
  var sectionMap = {};
  sectionData.forEach(function(row) {
    sectionMap[row[0]] = { period: row[2], name: row[1] };
  });

  // 3. Process and Filter Data
  var outputData = [];
  peopleData.forEach(function(row) {
    var role = row[5]; // Index 5 (Col F)
    
    // Only process Student Enrollments
    if (role === 'StudentEnrollment') {
      var sectionId = row[2]; // Index 2 (Col C)
      var period = sectionMap[sectionId] ? sectionMap[sectionId].period : '';
      var sectionName = sectionMap[sectionId] ? sectionMap[sectionId].name : '';

      outputData.push([
        false,                   // 0: Checkbox (Select)
        period,                  // 1: Period
        row[3],                  // 2: User ID (Col D)
        row[4],                  // 3: Student Name (Col E)
        row[6],                  // 4: Email Address (Col G/Index 6)
        sectionName,             // 5: Section Name
        row[2]                   // 6: Section ID (Col C)
      ]);
    }
  });

  // 4. Sort by Period, then Name
  outputData.sort(function(a, b) {
    if (a[1] < b[1]) return -1; // Sort by Period (Index 1)
    if (a[1] > b[1]) return 1;
    if (a[3] < b[3]) return -1; // Then by Student Name (Index 3)
    if (a[3] > b[3]) return 1;
    return 0;
  });

  var startRow = activeCell.getRow();
  var startCol = activeCell.getColumn();
  var numStudents = outputData.length;

  if (numStudents === 0) {
    ss.toast('Roster Empty: No students found with StudentEnrollment role.', '⚠️ Warning', 8);
    return;
  }

  // 5. Write Data and Apply Formatting
  var headers = ['Select', 'Period', 'User ID', 'Student Name', 'Email', 'Section Name', 'Section ID'];
  
  // Set headers and initial formatting (BOLD, Color)
  var headerRange = activeSheet.getRange(startRow, startCol, 1, headers.length);
  headerRange.setValues([headers]).setFontWeight('bold').setBackground('#d9ead3'); 

  var dataRange = activeSheet.getRange(startRow + 1, startCol, numStudents, headers.length);
  dataRange.setValues(outputData);

  // Apply Checkboxes (Data Validation)
  var checkboxRule = SpreadsheetApp.newDataValidation().setAllowInvalid(false).requireCheckbox().build();
  activeSheet.getRange(startRow + 1, startCol, numStudents, 1).setDataValidation(checkboxRule);

  // Apply Column Widths
  activeSheet.setColumnWidth(startCol + 3, 200); // Student Name
  activeSheet.setColumnWidth(startCol + 4, 250); // Email
  
  // Create filter over all headers and data
  var filterRange = activeSheet.getRange(startRow, startCol, numStudents + 1, headers.length);
  filterRange.createFilter(); 
  
  SpreadsheetApp.flush();
  ss.toast(numStudents + ' students listed in roster.', '✅ Success', 5);
}