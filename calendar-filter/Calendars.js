/**
 * Calendars.js
 * "List my calendars": writes every Google Calendar this account can see (owned,
 * subscribed, or shared) to a "My Calendars" tab, with its Calendar ID, so a teacher can
 * copy the exact ID into the Copy FROM or Copy TO box on Start Here.
 *
 * Endpoints: Google Calendar (read only, CalendarApp.getAllCalendars).
 * Write calls: none. Only this Sheet's "My Calendars" tab is changed.
 * Properties: none.
 */

const SHEET_CALENDARS = 'My Calendars';

function listMyCalendars() {
  try {
    const rows = CalendarApp.getAllCalendars()
      .map(function (cal) {
        return [cal.getName(), cal.getId(), cal.isOwnedByMe() ? 'Yes' : 'No', cal.isHidden() ? 'No' : 'Yes'];
      })
      // Mine first, then A to Z by name.
      .sort(function (a, b) { return b[2].localeCompare(a[2]) || a[0].localeCompare(b[0]); });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_CALENDARS) || ss.insertSheet(SHEET_CALENDARS);
    sheet.clear();
    const header = ['Calendar name', 'Calendar ID (copy this)', 'Mine?', 'Shown in my calendar list?'];
    sheet.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
    if (rows.length) sheet.getRange(2, 1, rows.length, header.length).setValues(rows);
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, header.length);
    ss.setActiveSheet(sheet);

    notify_('Listed ' + rows.length + ' calendars on the "' + SHEET_CALENDARS + '" tab.');
  } catch (err) {
    notify_('Could not list your calendars: ' + err.message);
  }
}
