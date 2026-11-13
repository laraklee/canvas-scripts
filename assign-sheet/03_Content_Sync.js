/**
 * 03_Content_Sync.js
 * Purpose: posts selected rows of the calendarEvents sheet to Canvas as calendar events
 *   and/or announcements (the "Post selected rows to Canvas" button). The old *Qn* → Qn
 *   copy functions (runContentCopyForAllQuarters, copyContentColumns,
 *   copyFinalAssignmentData) were removed 2026-11-13: unused, and they could write over
 *   teachers' own Q-tab columns.
 * Canvas endpoints called (both through canvasWrite_, so DRY_RUN applies):
 *   POST /api/v1/calendar_events (all-day course calendar event)
 *   POST /api/v1/courses/:course/discussion_topics with is_announcement (announcement)
 * Required User/Script Properties: User Properties CANVAS_BASE_URL and CANVAS_TOKEN;
 *   Script Property DRY_RUN. Course ID comes from the *Config* sheet, cell B4.
 */

/**
 * CANVAS SYNC
 * Button: "Post selected rows to Canvas" on the calendarEvents sheet (keep this name;
 * the drawn button calls it). For each selected row with a Title:
 *   Col A checked -> calendar event on the Calendar Date (col E), link in col H.
 *   Col B checked -> announcement, scheduled for Delayed Post (col F) if filled,
 *                    replies allowed only if col G is checked; link in col I.
 * A row whose H or I cell already has a "View…" link is skipped for that part, so
 * nothing is posted twice (clear the cell to post again). Unchecked parts are left
 * alone. Asks before sending. With preview mode ON, the status cell says "Preview mode OK".
 */
const EVENTS_HEADER_ROW = 2;
const EVENTS_FIRST_DATA_ROW = 3;
const EVENTS_STOP_ALL_TYPES = Object.freeze(['NOT_SET_UP', 'TOKEN_REJECTED', 'UNREACHABLE',
  'RATE_LIMITED', 'BAD_RESPONSE']);

function processUnifiedSheetForCanvasWithLinks() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  try {
    const sheet = ss.getActiveSheet();
    const headers = sheet.getRange(EVENTS_HEADER_ROW, 3, 1, 2).getDisplayValues()[0];
    if (headers[0].trim().toLowerCase() !== 'title' || headers[1].trim().toLowerCase() !== 'body') {
      ui.alert('Post to Canvas',
        'This only works on the calendarEvents sheet (Title in C2, Body in D2). Nothing was sent.',
        ui.ButtonSet.OK);
      return;
    }
    const courseId = String(getConfig().COURSE_ID).trim();
    if (!/^\d+$/.test(courseId)) {
      ui.alert('Post to Canvas', 'The Course ID in *Config* B4 is missing or not a number. ' +
        'Nothing was sent.', ui.ButtonSet.OK);
      return;
    }

    const jobs = collectEventJobs_(sheet, courseId);
    if (jobs.problems.length) {
      ui.alert('Post to Canvas', 'Fix these first. Nothing was sent.\n\n' +
        jobs.problems.join('\n'), ui.ButtonSet.OK);
      return;
    }
    if (!jobs.toSend.length) {
      ui.alert('Post to Canvas', 'Nothing to post in the selected rows.' +
        (jobs.skipped ? `\n\n${jobs.skipped} item(s) already have a View link and were skipped.` : ''),
        ui.ButtonSet.OK);
      return;
    }

    const events = jobs.toSend.filter(job => job.kind === 'event').length;
    const announcements = jobs.toSend.length - events;
    const answer = ui.alert('Post to Canvas?',
      `Course ${courseId}: ${events} calendar event(s), ${announcements} announcement(s).` +
      (jobs.skipped ? `\n${jobs.skipped} item(s) already posted will be skipped.` : '') +
      '\n\n' + describeDryRun_(isDryRun_()) + '\n\nContinue?',
      ui.ButtonSet.YES_NO);
    if (answer !== ui.Button.YES) return;

    ss.toast(`Posting ${jobs.toSend.length} item(s)...`, 'Canvas', -1);
    const result = sendEventJobs_(sheet, jobs.toSend);
    console.log(`Post to Canvas: ${result.sent} sent, ${result.failed} failed, ` +
      `${jobs.skipped} skipped, preview mode ${result.dryRun ? 'ON' : 'OFF'}.`);
    ss.toast('', '', 1);
    ui.alert('Post to Canvas',
      (result.dryRun ? `Preview mode: ${result.sent} item(s) checked; nothing was sent to Canvas.` :
        `${result.sent} item(s) posted.`) +
      (result.failed ? `\n${result.failed} item(s) failed; see columns H and I.` : '') +
      (result.stoppedMessage ? '\n\nStopped early: ' + result.stoppedMessage : ''),
      ui.ButtonSet.OK);
  } catch (error) {
    console.error('Post to Canvas failed: ' + (error.canvasType || error.message));
    ss.toast('', '', 1);
    ui.alert('Post to Canvas', 'Could not finish. ' + describeCanvasError_(error), ui.ButtonSet.OK);
  }
}

/**
 * Reads the selected rows (A:I) and returns { toSend, skipped, problems }.
 * Each job: { kind: 'event' | 'announcement', row, path, payload, statusCol, linkText }.
 */
function collectEventJobs_(sheet, courseId) {
  const selection = sheet.getActiveRange();
  const firstRow = Math.max(selection.getRow(), EVENTS_FIRST_DATA_ROW);
  const lastRow = selection.getLastRow();
  const jobs = { toSend: [], skipped: 0, problems: [] };
  if (lastRow < firstRow) return jobs;

  const range = sheet.getRange(firstRow, 1, lastRow - firstRow + 1, 9);
  const values = range.getValues();
  const formulas = range.getFormulas();
  const display = range.getDisplayValues();
  const alreadyPosted = (i, col) =>
    formulas[i][col] !== '' || /^View /.test(display[i][col]);

  values.forEach((row, i) => {
    const rowNumber = firstRow + i;
    const [calendarChecked, announceChecked, title, body, eventDate, delayedPost, replies] = row;
    if (!String(title).trim()) return;

    if (calendarChecked === true) {
      if (alreadyPosted(i, 7)) {
        jobs.skipped++;
      } else if (!eventDate) {
        jobs.problems.push(`Row ${rowNumber}: Calendar is checked but Calendar Date is empty.`);
      } else {
        jobs.toSend.push({
          kind: 'event', row: rowNumber, statusCol: 8, linkText: 'View Event',
          path: '/calendar_events',
          payload: {
            calendar_event: {
              context_code: 'course_' + courseId,
              title: String(title),
              description: String(body || ''),
              start_at: toCanvasDate_(eventDate),
              all_day: true,
            },
          },
        });
      }
    }

    if (announceChecked === true) {
      if (alreadyPosted(i, 8)) {
        jobs.skipped++;
      } else {
        const payload = {
          title: String(title),
          message: String(body || ''),
          is_announcement: true,
          lock_comment: replies !== true,
        };
        if (delayedPost) payload.delayed_post_at = toCanvasDate_(delayedPost);
        jobs.toSend.push({
          kind: 'announcement', row: rowNumber, statusCol: 9, linkText: 'View Announcement',
          path: `/courses/${courseId}/discussion_topics`,
          payload,
        });
      }
    }
  });
  return jobs;
}

/**
 * Sends each job through canvasWrite_ and writes its status cell. Stops everything
 * on errors that would hit every remaining item (token, network, Canvas busy).
 */
function sendEventJobs_(sheet, jobs) {
  const result = { sent: 0, failed: 0, dryRun: false, stoppedMessage: '' };
  for (const job of jobs) {
    const cell = sheet.getRange(job.row, job.statusCol);
    try {
      const reply = canvasWrite_('POST', job.path, job.payload);
      if (reply.dryRun) {
        result.dryRun = true;
        cell.setValue('Preview mode OK');
      } else if (reply.html_url) {
        cell.setFormula(`=HYPERLINK("${String(reply.html_url).replace(/"/g, '""')}", "${job.linkText}")`);
      } else {
        cell.setValue('Posted (no link returned)');
      }
      result.sent++;
    } catch (error) {
      result.failed++;
      cell.setValue('Failed: ' + (error.canvasType || 'UNEXPECTED'));
      if (EVENTS_STOP_ALL_TYPES.includes(error.canvasType)) {
        result.stoppedMessage = describeCanvasError_(error);
        break;
      }
    }
    SpreadsheetApp.flush();
  }
  return result;
}

/** A sheet date becomes an ISO timestamp; anything else is sent as typed. */
function toCanvasDate_(value) {
  return value instanceof Date ? value.toISOString() : String(value).trim();
}
