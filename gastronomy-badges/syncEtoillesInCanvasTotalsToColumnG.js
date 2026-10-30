/**
 * Totals each student's raw Canvas points for all assignments in the
 * "Etoilles in Canvas" assignment group and writes the total to Column G
 * of the active roster sheet.
 *
 * Active roster sheet:
 * - Column B: Canvas User ID
 * - Column G: Output total
 * - Row 3 onward: Students
 *
 * *assignmentGroups* sheet:
 * - Column A: Assignment ID
 * - Column D: Group Name
 */
function syncEtoillesInCanvasTotalsToColumnG() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var rosterSheet = ss.getActiveSheet();
  var assignmentGroupsSheet = ss.getSheetByName('*assignmentGroups*');

  // ---- Sheet layout ----
  var firstDataRow = 3;
  var studentIdCol = 2;       // B: Canvas User ID
  var outputCol = 7;          // G: total Etoilles points

  var assignmentIdCol = 1;    // A on *assignmentGroups*: Canvas Assignment ID
  var groupNameCol = 4;       // D on *assignmentGroups*: Group Name
  var targetGroupName = 'Etoilles in Canvas';

  // ---- Canvas configuration ----
  var config = getConfig();
  var baseUrl = String(config.BASE_URL || '').replace(/\/$/, '');
  var courseId = String(config.COURSE_ID || '').trim();
  var apiKey = PropertiesService.getUserProperties().getProperty('CANVAS_API_KEY');

  if (!assignmentGroupsSheet) {
    ss.toast('Sheet "*assignmentGroups*" was not found.', '🛑 Error', 8);
    return;
  }

  if (rosterSheet.getName() === '*assignmentGroups*') {
    ss.toast(
      'Select the roster sheet before running this function.',
      '🛑 Wrong Sheet',
      6
    );
    return;
  }

  if (!baseUrl || !courseId || !apiKey) {
    ss.toast(
      'Base URL, Course ID, or Canvas API key is missing.',
      '🚨 Configuration Error',
      8
    );
    return;
  }

  var groupLastRow = assignmentGroupsSheet.getLastRow();

  if (groupLastRow < 2) {
    ss.toast(
      '"*assignmentGroups*" has no assignment rows.',
      '🛑 Error',
      6
    );
    return;
  }

  // Read columns A through D, beginning below headers.
  var assignmentGroupRows = assignmentGroupsSheet
    .getRange(2, 1, groupLastRow - 1, groupNameCol)
    .getValues();

  // Find Canvas assignment IDs whose Group Name is the target group.
  var assignmentIds = assignmentGroupRows
    .filter(function(row) {
      return String(row[groupNameCol - 1] || '').trim().toLowerCase() ===
        targetGroupName.toLowerCase();
    })
    .map(function(row) {
      return String(row[assignmentIdCol - 1] || '').trim();
    })
    .filter(function(id) {
      return id !== '';
    });

  if (assignmentIds.length === 0) {
    ss.toast(
      'No assignments with Group Name "' + targetGroupName +
        '" were found in "*assignmentGroups*".',
      '🛑 Error',
      8
    );
    return;
  }

  var rosterLastRow = rosterSheet.getLastRow();

  if (rosterLastRow < firstDataRow) {
    ss.toast('No students found below Row 2.', '🛑 Error', 6);
    return;
  }

  // Preserve blanks so every output remains aligned to the correct roster row.
  var rosterUserIds = rosterSheet
    .getRange(
      firstDataRow,
      studentIdCol,
      rosterLastRow - firstDataRow + 1,
      1
    )
    .getValues()
    .flat();

  // Set up every student at zero before collecting grades.
  var totalsByUserId = {};

  rosterUserIds.forEach(function(id) {
    var userId = String(id || '').trim();

    if (userId) {
      totalsByUserId[userId] = 0;
    }
  });

  var options = {
    method: 'get',
    headers: {
      Authorization: 'Bearer ' + apiKey
    },
    muteHttpExceptions: true
  };

  var failedAssignments = [];

  ss.toast(
    'Reading ' + assignmentIds.length +
      ' Etoilles assignment(s) from Canvas...',
    'Progress',
    10
  );

  // Fetch all class submissions for each Etoilles assignment once.
  assignmentIds.forEach(function(assignmentId) {
    var submissionsUrl =
      baseUrl +
      '/api/v1/courses/' + encodeURIComponent(courseId) +
      '/assignments/' + encodeURIComponent(assignmentId) +
      '/submissions?per_page=100';

    try {
      var response = UrlFetchApp.fetch(submissionsUrl, options);
      var responseCode = response.getResponseCode();

      if (responseCode !== 200) {
        failedAssignments.push(assignmentId);

        // No Canvas reply text in the log: it can include student data.
        Logger.log(
          'Could not get submissions | Assignment=' + assignmentId +
          ' | HTTP=' + responseCode
        );
        return;
      }

      var submissions = JSON.parse(response.getContentText());

      submissions.forEach(function(submission) {
        var userId = String(submission.user_id || '').trim();

        // Count only students who appear in the roster sheet.
        if (Object.prototype.hasOwnProperty.call(totalsByUserId, userId)) {
          if (submission.score !== null && submission.score !== undefined) {
            totalsByUserId[userId] += Number(submission.score);
          }
        }
      });
    } catch (err) {
      failedAssignments.push(assignmentId);

      Logger.log(
        'Canvas fetch failed | Assignment=' + assignmentId +
        ' | Error=' + err.message
      );
    }
  });

  // Build all output values before writing anything.
  var outputValues = rosterUserIds.map(function(id) {
  var userId = String(id || '').trim();

  if (!userId) {
    return [''];
  }

  var total = totalsByUserId[userId] || 0;

  // Leave Column G blank when the student's total is zero.
  return [total === 0 ? '' : total];
});

  // Write results to Column G in one batch operation.
  rosterSheet
    .getRange(firstDataRow, outputCol, outputValues.length, 1)
    .setValues(outputValues);

  var completionMessage =
    'Totals for ' + assignmentIds.length +
    ' Etoilles assignment(s) written to Column G.';

  if (failedAssignments.length > 0) {
    completionMessage +=
      ' ' + failedAssignments.length +
      ' assignment(s) could not be read—see Execution log.';
  }

  ss.toast(
    completionMessage,
    failedAssignments.length ? '⚠️ Completed with Errors' : '✅ Complete',
    10
  );
}