/**
 * Button-triggered roster refresh:
 * 1. Sync Canvas grades for assignment columns C:F.
 * 2. Calculate Etoilles in Canvas totals in Column G.
 * 3. Write the completion timestamp to B1.
 *
 * Run this from the active roster sheet, not *assignmentGroups*.
 */
function syncRosterGradesAndEtoilles() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();

  var firstAssignmentCol = 3; // C
  var lastAssignmentCol = 6;  // F

  if (sheet.getName() === '*assignmentGroups*') {
    ss.toast(
      'Select a roster sheet before running the sync.',
      '🛑 Wrong Sheet',
      6
    );
    return;
  }

  ss.toast(
    'Starting Canvas grade and Etoilles synchronization...',
    'Progress',
    10
  );

  try {
    // syncGradesAndStatusForAssignmentActiveColumn() determines the
    // assignment from Row 2 of the active column, so temporarily select
    // each assignment column before running it.
    for (var col = firstAssignmentCol; col <= lastAssignmentCol; col++) {
      sheet.getRange(2, col).activate();

      ss.toast(
        'Syncing grades for Column ' + columnToLetter_(col) + '...',
        'Progress',
        10
      );

      syncGradesAndStatusForAssignmentActiveColumn();
    }

    // This function writes totals to Column G.
    syncEtoillesInCanvasTotalsToColumnG();

    // Record a real Sheets date/time value, not plain text.
    var timestampCell = sheet.getRange('B1');
    timestampCell.setValue(new Date());
    timestampCell.setNumberFormat('M/d/yyyy h:mm AM/PM');

    ss.toast(
      'Grades C:F and Etoilles totals in G are synchronized.',
      '✅ Complete',
      8
    );
  } catch (err) {
    Logger.log('Roster synchronization failed: ' + err.message);

    ss.toast(
      'Sync stopped: ' + err.message,
      '🚨 Error',
      10
    );
  }
}

/**
 * Converts a 1-based column number to its spreadsheet letter.
 * Example: 3 becomes C; 27 becomes AA.
 */
function columnToLetter_(columnNumber) {
  var letter = '';

  while (columnNumber > 0) {
    var remainder = (columnNumber - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    columnNumber = Math.floor((columnNumber - 1) / 26);
  }

  return letter;
}