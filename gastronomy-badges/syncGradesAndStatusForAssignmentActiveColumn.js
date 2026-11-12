/**
 * Fetches the current grade from Canvas for all students for the Assignment ID
 * in Row 2 of the currently active column.
 *
 * Sheet layout:
 * - Row 2: Canvas Assignment IDs
 * - Column B: Canvas User IDs
 * - Row 3 onward: student roster
 */
function syncGradesAndStatusForAssignmentActiveColumn() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();

  var config = getConfig();
  var baseUrl = String(config.BASE_URL || '').replace(/\/$/, '');
  var apiKey = getCanvasToken_(); // Credentials.js
  var courseId = String(config.COURSE_ID || '').trim();

  var activeCol = sheet.getActiveCell().getColumn();
  var assignmentId = String(sheet.getRange(2, activeCol).getValue() || '').trim();

  var firstDataRow = 3;
  var studentIdCol = 2; // Column B
  var lastRow = sheet.getLastRow();

  if (!assignmentId) {
    ss.toast(
      'Assignment ID is missing from Row 2 of the active column.',
      '🛑 Error',
      5
    );
    return;
  }

  if (!baseUrl || !apiKey || !courseId) {
    ss.toast(
      courseId ? missingSetupMessage_() : 'No course number in *Config* B4. Open Canvas Tools › Setup….',
      '🚨 Setup needed',
      8
    );
    return;
  }

  if (lastRow < firstDataRow) {
    ss.toast('No student rows found below Row 2.', '🛑 Error', 5);
    return;
  }

  // Do NOT filter blank IDs: preserving every row prevents grade shifting.
  var userIds = sheet
    .getRange(firstDataRow, studentIdCol, lastRow - firstDataRow + 1, 1)
    .getValues()
    .flat();

  var successCount = 0;
  var notFoundCount = 0;
  var errorCount = 0;

  ss.toast(
    'Starting grade synchronization for ' + userIds.length + ' roster rows...',
    'Progress',
    10
  );

  var options = {
    method: 'get',
    headers: {
      Authorization: 'Bearer ' + apiKey
    },
    muteHttpExceptions: true
  };

  for (var i = 0; i < userIds.length; i++) {
    var row = firstDataRow + i;
    var userId = String(userIds[i] || '').trim();
    var gradeCell = sheet.getRange(row, activeCol);

    if (!userId) {
      gradeCell.clearContent();
      continue;
    }

    var submissionUrl =
      baseUrl +
      '/api/v1/courses/' + encodeURIComponent(courseId) +
      '/assignments/' + encodeURIComponent(assignmentId) +
      '/submissions/' + encodeURIComponent(userId);

    try {
      var response = UrlFetchApp.fetch(submissionUrl, options);
      var responseCode = response.getResponseCode();
      var responseText = response.getContentText();

      if (responseCode === 200) {
        var submissionData = JSON.parse(responseText);

        // Prefer numeric score; fall back to Canvas's grade string.
        if (submissionData.score !== undefined && submissionData.score !== null) {
          gradeCell.setValue(submissionData.score);
        } else if (
          submissionData.grade !== undefined &&
          submissionData.grade !== null
        ) {
          gradeCell.setValue(submissionData.grade);
        } else {
          gradeCell.clearContent();
        }

        successCount++;
      } else if (responseCode === 404) {
        gradeCell.setValue('Not found');
        notFoundCount++;
      } else {
        gradeCell.setValue('API Err: ' + responseCode);
        errorCount++;

        // No student IDs or Canvas replies in the log (privacy). The cell
        // itself shows which row failed.
        Logger.log(
          'Grade sync HTTP ' + responseCode +
          ' | Assignment=' + assignmentId
        );
      }
    } catch (err) {
      gradeCell.setValue('Failed');
      errorCount++;

      // err.message can contain the request URL, which includes the
      // student's Canvas ID, so log only the error type.
      Logger.log(
        'Grade sync failed | Assignment=' + assignmentId +
        ' | Error type=' + err.name
      );
    }
  }

  // One summary line instead of a line per student.
  if (notFoundCount > 0 || errorCount > 0) {
    Logger.log(
      'Grade sync | Course=' + courseId +
      ' | Assignment=' + assignmentId +
      ' | not found=' + notFoundCount +
      ' | errors=' + errorCount
    );
  }

  ss.toast(
    successCount + ' grades synced; ' +
    notFoundCount + ' not found; ' +
    errorCount + ' other error(s).',
    '✅ Complete',
    8
  );
}