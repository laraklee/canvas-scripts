/**
 * Totals each student's raw Canvas points for the assignments in the
 * "Etoilles in Canvas" assignment group that fall in one quarter, and writes
 * the total to Column G of the active roster sheet.
 *
 * The quarter number is typed in G2 (for example 2 or Q2). It is matched to
 * the Canvas grading period whose title contains that number; Canvas decides
 * which assignments are in the period from their due dates. When it finishes,
 * a pop-up lists the assignments it counted.
 *
 * Canvas endpoints (all GET):
 * - /api/v1/courses/:id/grading_periods
 * - /api/v1/courses/:id/assignment_groups?grading_period_id=…&include[]=assignments
 * - /api/v1/courses/:id/assignments/:id/submissions
 *
 * Active roster sheet:
 * - Column B: Canvas User ID
 * - G2: Quarter number
 * - Column G: Output total
 * - Row 3 onward: Students
 */
function syncEtoillesInCanvasTotalsToColumnG() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var rosterSheet = ss.getActiveSheet();

  // ---- Sheet layout ----
  var firstDataRow = 3;
  var studentIdCol = 2;       // B: Canvas User ID
  var outputCol = 7;          // G: total Etoilles points
  var quarterCell = 'G2';     // Quarter number to total

  var targetGroupName = 'Etoilles in Canvas';

  // ---- Canvas configuration ----
  var config = getConfig();
  var baseUrl = String(config.BASE_URL || '').replace(/\/$/, '');
  var courseId = String(config.COURSE_ID || '').trim();
  var apiKey = PropertiesService.getUserProperties().getProperty('CANVAS_API_KEY');

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

  var quarterMatch = String(rosterSheet.getRange(quarterCell).getValue() || '')
    .match(/\d+/);

  if (!quarterMatch) {
    ss.toast(
      'Type the quarter number (for example 2) in ' + quarterCell + '.',
      '🛑 Quarter Missing',
      8
    );
    return;
  }

  var quarterNumber = quarterMatch[0];

  var options = {
    method: 'get',
    headers: {
      Authorization: 'Bearer ' + apiKey
    },
    muteHttpExceptions: true
  };

  // Ask Canvas which Etoilles assignments are in this quarter.
  var period;
  var periodAssignments;
  var assignmentIds;

  try {
    period = findGradingPeriodForQuarter_(baseUrl, courseId, quarterNumber, options);
    periodAssignments = getGroupAssignmentsInPeriod_(
      baseUrl, courseId, targetGroupName, period.id, options
    );
    assignmentIds = periodAssignments.map(function(assignment) {
      return String(assignment.id);
    });
  } catch (err) {
    Logger.log(
      'Etoilles quarter lookup failed | Course=' + courseId +
      ' | Quarter=' + quarterNumber +
      ' | Error=' + err.message
    );
    ss.toast(err.message, '🛑 Error', 15);
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

  var failedAssignments = [];

  ss.toast(
    'Reading ' + assignmentIds.length +
      ' Etoilles assignment(s) for ' + period.title + ' from Canvas...',
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
    period.title + ': totals for ' + assignmentIds.length +
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

  // List what was counted so it can be compared with Canvas's
  // quarter-filtered grade report.
  showCountedAssignments_(ss, period, periodAssignments);
}

/**
 * Shows a pop-up with the grading period's dates and each assignment that
 * was totaled: title, due date, points possible, and whether some sections
 * or students have a different due date. No student data.
 */
function showCountedAssignments_(ss, period, assignments) {
  const timeZone = ss.getSpreadsheetTimeZone();
  const formatDate = function(isoDate) {
    if (!isoDate) {
      return 'no due date';
    }
    return Utilities.formatDate(new Date(isoDate), timeZone, 'M/d/yyyy');
  };

  const lines = [
    period.title + ': ' + formatDate(period.start_date) +
      ' to ' + formatDate(period.end_date),
    '',
    assignments.length + ' Etoilles assignment(s) counted:'
  ];

  assignments.forEach(function(assignment) {
    lines.push(
      '• ' + assignment.name +
      ' | due ' + formatDate(assignment.due_at) +
      ' | ' + assignment.points_possible + ' pts' +
      (assignment.has_overrides ? ' | other due dates for some students/sections' : '')
    );
  });

  SpreadsheetApp.getUi().alert('Etoilles assignments in column G', lines.join('\n'),
    SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Finds the Canvas grading period for a quarter number, matching a title
 * such as "Q2", "Quarter 2", or "2nd Quarter". Throws with a message for
 * the user when there is no single match.
 */
function findGradingPeriodForQuarter_(baseUrl, courseId, quarterNumber, options) {
  const periods = canvasGetAll_(
    baseUrl + '/api/v1/courses/' + encodeURIComponent(courseId) +
      '/grading_periods?per_page=100',
    options,
    'grading_periods'
  );

  if (periods.length === 0) {
    throw new Error('This Canvas course has no grading periods (quarters).');
  }

  // The number on its own, so "Q1" doesn't also match 12 or 2021.
  const numberPattern = new RegExp('(^|\\D)' + Number(quarterNumber) + '(\\D|$)');
  const matches = periods.filter(function(period) {
    return numberPattern.test(String(period.title || ''));
  });

  if (matches.length !== 1) {
    const titles = periods.map(function(period) { return period.title; }).join(', ');
    throw new Error(
      (matches.length === 0 ? 'No' : 'More than one') +
      ' Canvas grading period matches quarter ' + quarterNumber +
      '. Canvas has: ' + titles
    );
  }

  return matches[0];
}

/**
 * Returns the assignments in the named assignment group that Canvas places
 * in the given grading period.
 */
function getGroupAssignmentsInPeriod_(baseUrl, courseId, groupName, periodId, options) {
  const groups = canvasGetAll_(
    baseUrl + '/api/v1/courses/' + encodeURIComponent(courseId) +
      '/assignment_groups?per_page=100&include[]=assignments' +
      '&grading_period_id=' + encodeURIComponent(periodId),
    options
  );

  const targetGroups = groups.filter(function(group) {
    return String(group.name || '').trim().toLowerCase() === groupName.toLowerCase();
  });

  if (targetGroups.length === 0) {
    throw new Error('No Canvas assignment group named "' + groupName + '".');
  }

  const assignments = [];
  targetGroups.forEach(function(group) {
    (group.assignments || []).forEach(function(assignment) {
      assignments.push(assignment);
    });
  });
  return assignments;
}

/**
 * GETs every page of a Canvas list (following the Link header) and returns
 * the combined items. unwrapKey is for endpoints that wrap the list in an
 * object, such as { grading_periods: [...] }.
 */
function canvasGetAll_(url, options, unwrapKey) {
  let items = [];
  let nextUrl = url;

  while (nextUrl) {
    const response = UrlFetchApp.fetch(nextUrl, options);
    const responseCode = response.getResponseCode();

    if (responseCode !== 200) {
      throw new Error('Canvas returned HTTP ' + responseCode + ' while reading quarters.');
    }

    const data = JSON.parse(response.getContentText());
    items = items.concat(unwrapKey ? (data[unwrapKey] || []) : data);

    const headers = response.getAllHeaders();
    nextUrl = getNextUrl(headers['Link'] || headers['link']);
  }

  return items;
}
