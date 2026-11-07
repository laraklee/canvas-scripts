function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('ICS Tools')
    .addItem('Import ICS file', 'showIcsUploadDialog')
    //.addItem('Enhance Events Table', 'enhanceEventSheet')
    //.addItem('Format Table Layout', 'formatEventSheetSimple')
    .addItem('Export as ICS', 'exportSheetToICS') // <- added export
    .addToUi();
}


// Show ICS file upload dialog
function showIcsUploadDialog() {
  var html = HtmlService.createHtmlOutputFromFile('IcsUploader')
    .setWidth(400)
    .setHeight(200);
  SpreadsheetApp.getUi().showModalDialog(html, 'Upload ICS File');
}

// Parse uploaded ICS and write to active sheet
function processIcsFile(formData) {
  var data = formData.icsFile.split(',')[1];
  var decoded = Utilities.newBlob(Utilities.base64Decode(data)).getDataAsString();
  var events = decoded.split('BEGIN:VEVENT').slice(1);
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  sheet.clear();
  sheet.appendRow(['SUMMARY', 'DESCRIPTION', 'LOCATION', 'DTSTART', 'DTEND', 'UID']);

  events.forEach(function (eventData) {
    var summary = match(/SUMMARY:(.*?)\r?\n/, eventData);
    var desc = match(/DESCRIPTION:(.*?)\r?\n/, eventData);
    var location = match(/LOCATION:(.*?)\r?\n/, eventData);
    var dtstart = match(/DTSTART(?:;[^:]+)?:([^\r\n]+)/, eventData);
    var dtend = match(/DTEND(?:;[^:]+)?:([^\r\n]+)/, eventData);
    var uid = match(/UID:(.*?)\r?\n/, eventData);
    sheet.appendRow([summary, desc, location, dtstart, dtend, uid]);
  });

  function match(pattern, str) {
    var res = str.match(pattern);
    return res ? res[1] : '';
  }
}

// Enhance the event table with checkboxes/filtering
function enhanceEventSheet() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var dataRange = sheet.getDataRange();
  var values = dataRange.getValues();

  sheet.insertColumnBefore(1);
  sheet.getRange(1, 1).setValue("Select");
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).insertCheckboxes();
  }
  sheet.getRange(1, 2, 1, values[0].length).setValues([values[0]]);
  if (values.length > 1) {
    sheet.getRange(2, 2, values.length - 1, values[0].length).setValues(values.slice(1));
  }
  sheet.autoResizeColumns(1, sheet.getLastColumn());
  sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).createFilter();
}

// Format table columns and dates
function formatEventSheetSimple() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  sheet.setColumnWidth(1, 40);    // Checkbox
  sheet.autoResizeColumn(2);      // SUMMARY
  sheet.setColumnWidth(3, 100);   // DESCRIPTION
  sheet.setColumnWidth(4, 100);   // LOCATION
  sheet.setColumnWidth(7, 100);   // UID
  var lastRow = sheet.getLastRow();
  for (var r = 2; r <= lastRow; r++) {
    var val = sheet.getRange(r, 5).getValue();
    var dateOut = '';
    var match = String(val).match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?/);
    if (match) {
      var yy = Number(match[1]), mm = Number(match[2]), dd = Number(match[3]);
      if (match[4] && match[5]) {
        var hh = match[4], min = match[5];
        dateOut = Utilities.formatDate(new Date(Date.UTC(yy, mm-1, dd, hh, min)), Session.getScriptTimeZone(), "MM/dd/yy HH:mm");
      } else {
        dateOut = Utilities.formatDate(new Date(Date.UTC(yy, mm-1, dd)), Session.getScriptTimeZone(), "MM/dd/yy");
      }
      sheet.getRange(r, 5).setValue(dateOut);
    }
  }
}

function exportSheetToICS() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var lastRow = sheet.getLastRow();
  var dataRange = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn());
  var data = dataRange.getValues();

  // Find column indices for headers
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var idxSummary = headers.indexOf("SUMMARY");
  var idxDescription = headers.indexOf("DESCRIPTION");
  var idxLocation = headers.indexOf("LOCATION");
  var idxDTSTART = headers.indexOf("DTSTART");
  var idxDTEND = headers.indexOf("DTEND");
  var idxUID = headers.indexOf("UID");
  var idxSelect = headers.indexOf("Select"); // If you have a checkbox column

  var icsContent = [];
  icsContent.push("BEGIN:VCALENDAR");
  icsContent.push("VERSION:2.0");
  icsContent.push("CALSCALE:GREGORIAN");
  icsContent.push("PRODID:-//Your Organization//Sheet Export//EN");

  for (var i = 0; i < data.length; i++) {
    // If you want to filter by checkbox, uncomment the following lines:
    // if (idxSelect > -1 && data[i][idxSelect] !== true) continue; // skip unselected

    var summary = data[i][idxSummary] || "";
    var description = data[i][idxDescription] || "";
    var location = data[i][idxLocation] || "";
    var dtstart = String(data[i][idxDTSTART]).replace(/[^0-9TZ]/g,''); // Clean format, keep original
    var dtend = String(data[i][idxDTEND]).replace(/[^0-9TZ]/g,'');
    var uid = data[i][idxUID] || ('row'+(i+2)+'@sheet-export');

    if (!summary || !dtstart) continue; // Skip blank rows

    icsContent.push("BEGIN:VEVENT");
    icsContent.push("SUMMARY:" + summary);
    if (description) icsContent.push("DESCRIPTION:" + description);
    if (location) icsContent.push("LOCATION:" + location);
    icsContent.push("DTSTART:" + dtstart);
    if (dtend) icsContent.push("DTEND:" + dtend);
    icsContent.push("UID:" + uid);
    icsContent.push("END:VEVENT");
  }

  icsContent.push("END:VCALENDAR");

  var finalICS = icsContent.join("\r\n");

  // Save to Drive and/or prompt download
  var fileName = "exported_events_" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmm") + ".ics";
  var file = DriveApp.createFile(fileName, finalICS, MimeType.PLAIN_TEXT);
  SpreadsheetApp.getUi().alert("ICS file created in your Google Drive: " + file.getName());
}

