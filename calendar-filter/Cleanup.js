/**
 * Cleanup.js
 * ONE-TIME USE, delete this file afterward. Removes the events the sync put into your
 * main (personal) Google Calendar, after switching "Copy TO" to a separate calendar.
 * Run from the Apps Script editor: pick a function in the toolbar, click Run, read the
 * Execution log.
 *   1. cleanupPreview: lists what would be deleted. Changes nothing.
 *   2. cleanupDelete: deletes those events.
 *
 * Only events carrying the sync's tag are touched (the ones it added, plus old copies it
 * matched). Untagged events are never touched.
 * Endpoints: Google Calendar. Write calls: deleteEvent, in cleanupDelete only.
 * Script Properties: none.
 */

function cleanupPreview() {
  const found = findSyncedInMainCalendar_();
  const tz = Session.getScriptTimeZone();
  found.forEach(function (ev) {
    const when = ev.isAllDayEvent() ? ev.getAllDayStartDate() : ev.getStartTime();
    Logger.log(Utilities.formatDate(when, tz, 'EEE M/d/yy h:mm a') + '  ' + ev.getTitle());
  });
  Logger.log('PREVIEW: ' + found.length + ' synced event(s) in "' + CalendarApp.getDefaultCalendar().getName() +
    '" would be deleted. Nothing was changed. Run cleanupDelete to delete them.');
}

function cleanupDelete() {
  const found = findSyncedInMainCalendar_();
  const deadline = Date.now() + SYNC_TIME_LIMIT_MS;
  let deleted = 0;
  for (const ev of found) {
    if (Date.now() > deadline) break;
    ev.deleteEvent();
    deleted++;
    Utilities.sleep(PAUSE_BETWEEN_WRITES_MS);
  }
  Logger.log('Deleted ' + deleted + ' of ' + found.length + ' synced event(s).' +
    (deleted < found.length ? ' Ran out of time: run cleanupDelete again to finish.' : ' Done.'));
}

/** Tagged events in the main calendar, two years either side of today. */
function findSyncedInMainCalendar_() {
  const day = 86400000;
  const now = Date.now();
  return CalendarApp.getDefaultCalendar()
    .getEvents(new Date(now - 730 * day), new Date(now + 730 * day))
    .filter(function (ev) { return !!ev.getTag(TAG_UID); });
}
