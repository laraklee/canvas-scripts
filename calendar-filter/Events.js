/**
 * Events.js
 * Fills the Events tab from the feed and applies the Hide Rules tab.
 *
 * Endpoints: none directly (Feed.js does the download). Write calls: none outside this Sheet.
 * Script Properties: none.
 */

const EVENT_HEADERS = ['Keep', 'Title', 'Start', 'End', 'Location', 'Matched hide rule', 'Description', 'All day', 'UID'];
const COL = { KEEP: 0, TITLE: 1, START: 2, END: 3, LOCATION: 4, RULE: 5, DESCRIPTION: 6, ALL_DAY: 7, UID: 8 };

/** Menu item: downloads the feed and rebuilds the Events tab, keeping earlier checkmarks. */
function refreshEvents() {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(30000)) return notify_('Another refresh or sync is running. Try again in a minute.');
  try {
    const settings = readSettings_();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const tz = ss.getSpreadsheetTimeZone();
    const afterKey = settings.after ? Utilities.formatDate(settings.after, tz, 'yyyy-MM-dd') : '';
    const beforeKey = settings.before ? Utilities.formatDate(settings.before, tz, 'yyyy-MM-dd') : '';

    const events = fetchFeedEvents_(settings.feedUrl).filter(function (ev) {
      const key = ev.allDay ? ymdKey_(ev.start) : Utilities.formatDate(ev.start, tz, 'yyyy-MM-dd');
      return (!afterKey || key >= afterKey) && (!beforeKey || key <= beforeKey);
    });

    const sheet = ss.getSheetByName(SHEET_EVENTS) || ss.insertSheet(SHEET_EVENTS);
    const previousKeep = new Map(readEventRows_(sheet).map(function (r) { return [r.uid, r.keep]; }));
    const rules = readHideRules_();

    const rows = events.map(function (ev) {
      const start = ev.allDay ? noonOn_(ev.start, tz) : ev.start;
      const end = ev.allDay ? noonOn_(ev.end, tz) : ev.end;
      const rule = matchHideRule_(ev.title, rules);
      const keep = previousKeep.has(ev.uid) ? previousKeep.get(ev.uid) : !rule;
      return [keep, ev.title, start, end, ev.location, rule, ev.description, ev.allDay, ev.uid];
    });
    rows.sort(function (a, b) { return a[COL.START] - b[COL.START] || String(a[COL.TITLE]).localeCompare(b[COL.TITLE]); });

    writeEventsSheet_(sheet, rows);

    const newCount = previousKeep.size ? rows.filter(function (r) { return !previousKeep.has(r[COL.UID]); }).length : rows.length;
    const hidden = rows.filter(function (r) { return !r[COL.KEEP]; }).length;
    notify_('Loaded ' + rows.length + ' events (' + newCount + ' new). ' + hidden + ' are unchecked.\n\n' +
      'Next: uncheck anything else you do not want, then School Calendar > Sync.');
  } finally {
    lock.releaseLock();
  }
}

/** Menu item: unchecks every event that matches a hide rule. Never re-checks anything. */
function applyHideRules() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_EVENTS);
  if (!sheet || sheet.getLastRow() < 2) return notify_('The Events tab is empty. Run "Refresh events" first.');

  const rules = readHideRules_();
  const range = sheet.getRange(2, 1, sheet.getLastRow() - 1, EVENT_HEADERS.length);
  const values = range.getValues();
  let newlyHidden = 0;
  values.forEach(function (r) {
    if (!r[COL.UID]) return;
    r[COL.RULE] = matchHideRule_(r[COL.TITLE], rules);
    if (r[COL.RULE] && r[COL.KEEP] === true) {
      r[COL.KEEP] = false;
      newlyHidden++;
    }
  });
  // Write back only the two columns that change, so dates and formats are untouched.
  sheet.getRange(2, COL.KEEP + 1, values.length, 1).setValues(values.map(function (r) { return [r[COL.KEEP]]; }));
  sheet.getRange(2, COL.RULE + 1, values.length, 1).setValues(values.map(function (r) { return [r[COL.RULE]]; }));
  notify_('Unchecked ' + newlyHidden + ' more event(s) using ' + rules.length + ' hide rule(s).');
}

function writeEventsSheet_(sheet, rows) {
  if (sheet.getFilter()) sheet.getFilter().remove();
  sheet.clear();
  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).clearDataValidations();
  sheet.showColumns(1, sheet.getMaxColumns());

  sheet.getRange(1, 1, 1, EVENT_HEADERS.length).setValues([EVENT_HEADERS]).setFontWeight('bold');
  sheet.setFrozenRows(1);
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, EVENT_HEADERS.length).setValues(rows);
    sheet.getRange(2, COL.KEEP + 1, rows.length, 1).insertCheckboxes();
    const formats = rows.map(function (r) {
      const f = r[COL.ALL_DAY] ? 'ddd m/d/yy' : 'ddd m/d/yy h:mm am/pm';
      return [f, f];
    });
    sheet.getRange(2, COL.START + 1, rows.length, 2).setNumberFormats(formats);
  }
  sheet.getRange(1, 1, Math.max(rows.length, 1) + 1, EVENT_HEADERS.length).createFilter();
  sheet.setColumnWidth(COL.KEEP + 1, 50);
  sheet.setColumnWidth(COL.TITLE + 1, 320);
  sheet.setColumnWidths(COL.START + 1, 2, 150);
  sheet.setColumnWidth(COL.LOCATION + 1, 200);
  sheet.setColumnWidth(COL.RULE + 1, 140);
  sheet.setColumnWidth(COL.DESCRIPTION + 1, 200);
  // The sync needs these two columns, but people do not.
  sheet.hideColumns(COL.ALL_DAY + 1, 2);
}

/** Returns the Events tab as objects. Rows without a UID are ignored. */
function readEventRows_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, EVENT_HEADERS.length).getValues()
    .filter(function (r) { return r[COL.UID] && r[COL.START] instanceof Date; })
    .map(function (r) {
      return {
        keep: r[COL.KEEP] === true,
        title: String(r[COL.TITLE]),
        start: r[COL.START],
        end: r[COL.END] instanceof Date ? r[COL.END] : r[COL.START],
        location: String(r[COL.LOCATION]),
        description: String(r[COL.DESCRIPTION]),
        allDay: r[COL.ALL_DAY] === true,
        uid: String(r[COL.UID]),
      };
    });
}

/** Hide rules as [{ text, lower }], from column A of the Hide Rules tab. */
function readHideRules_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_RULES);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues()
    .map(function (r) { return String(r[0]).trim(); })
    .filter(String)
    .map(function (text) { return { text: text, lower: text.toLowerCase() }; });
}

/** The first rule whose text appears in the title (ignoring case), or '' if none. */
function matchHideRule_(title, rules) {
  const lower = String(title).toLowerCase();
  const hit = rules.find(function (rule) { return lower.indexOf(rule.lower) !== -1; });
  return hit ? hit.text : '';
}

/**
 * All-day dates are stored as noon on that day in the Sheet's time zone, so the date
 * shown never slips a day when time zones differ slightly.
 */
function noonOn_(ymd, tz) {
  return Utilities.parseDate(ymdKey_(ymd) + ' 12:00', tz, 'yyyy-MM-dd HH:mm');
}
