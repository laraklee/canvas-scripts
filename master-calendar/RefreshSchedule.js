/**
 * RefreshSchedule.js — copies schedule day titles into the *Calendar_Import* tab.
 * Purpose: reads a faculty calendar .ics file that was downloaded by hand from the school
 *   website and uploaded to Drive as faculty_master.ics (download link in the private
 *   notes repo), and lists each Upper School day's schedule title. Lower School days skipped.
 *   Written when the bell schedule feed seemed to hold only about 60 days; the
 *   "Bell Schedule with Periods" Google calendar keeps the full year (see BRIEF.md), so
 *   this file is expected to be replaced.
 * Canvas endpoints called: none.
 * Write operations: clears and rewrites *Calendar_Import* in this spreadsheet only.
 * Required User/Script Properties: none.
 * Run: syncFutureDraftSchedule()
 */

function syncFutureDraftSchedule() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const fileName = "faculty_master.ics";
  const destSheetName = '*Calendar_Import*';

  try {
    const files = DriveApp.getFilesByName(fileName);
    if (!files.hasNext()) throw new Error("File '" + fileName + "' not found in Drive. Ensure it is named exactly: " + fileName);
    
    const file = files.next();
    const icsContent = file.getBlob().getDataAsString();
    const dataRows = [];
    
    // Split the raw text into individual events
    const events = icsContent.split("BEGIN:VEVENT");

    events.forEach(block => {
      let summaryMatch = block.match(/SUMMARY:(.*)/);
      if (!summaryMatch) return;
      
      let title = summaryMatch[1].trim().replace(/\\,/g, ",");

      // FILTER: Only keep actual schedule labels (A-F, Exams, etc.)
      // We skip the Faculty "noise" like lunch menus or meetings.
      const isAcademic = title.includes("Schedule") || title.includes("EXAMS") || title.includes("Reading Day");
      const isLowerSchool = title.includes("(LS)");

      if (isAcademic && !isLowerSchool) {
        // Extract Date: Looks for YYYYMMDD
        let dateMatch = block.match(/DTSTART(?:;VALUE=DATE)?:(\d{8})/);
        
        if (dateMatch) {
          let dStr = dateMatch[1];
          let dateObj = new Date(
            dStr.substring(0, 4), 
            parseInt(dStr.substring(4, 6)) - 1, 
            dStr.substring(6, 8)
          );
          dataRows.push([dateObj, title]);
        }
      }
    });

    // Sort chronologically so the sheet is easy to read
    dataRows.sort((a, b) => a[0].getTime() - b[0].getTime());

    let destSheet = ss.getSheetByName(destSheetName) || ss.insertSheet(destSheetName);
    destSheet.clear();
    
    if (dataRows.length > 0) {
      destSheet.getRange(1, 1, 1, 2).setValues([["Date", "Live Schedule Title"]]).setFontWeight("bold");
      destSheet.getRange(2, 1, dataRows.length, 2).setValues(dataRows);
      
      // Formatting to dd/mm/yyyy
      destSheet.getRange(2, 1, dataRows.length, 1).setNumberFormat("dd/MM/yyyy");
      destSheet.autoResizeColumns(1, 2);
      
      const startStr = Utilities.formatDate(dataRows[0][0], "HST", "MM/dd/yy");
      const endStr = Utilities.formatDate(dataRows[dataRows.length-1][0], "HST", "MM/dd/yy");
      ss.toast(`Imported ${dataRows.length} events from ${startStr} to ${endStr}`, "✅ Sync Complete");
    }

  } catch (e) {
    ss.toast(e.message, "🛑 Error");
  }
}