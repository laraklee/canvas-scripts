/**
 * Events.js
 * Fills the Events and Pick Titles tabs from the school calendar, and works out which
 * events will sync from the user's choices:
 *   1. an Override on the Events tab (Keep / Hide) always wins;
 *   2. otherwise a title checked on Pick Titles is kept;
 *   3. otherwise a hide word drops it, and a keep word keeps it;
 *   4. anything else is left out. Everything starts unchecked.
 *
 * Endpoints: none directly (Feed.js reads the calendar). Write calls: none outside this Sheet.
 * Script Properties: none.
 */

const EVENT_HEADERS = ['Override', 'Will sync', 'Why', 'Title', 'Start', 'End', 'Location', 'Description', 'All day', 'UID'];
const COL = { OVERRIDE: 0, SYNC: 1, WHY: 2, TITLE: 3, START: 4, END: 5, LOCATION: 6, DESCRIPTION: 7, ALL_DAY: 8, UID: 9 };
const TITLE_HEADERS = ['Pick', 'Title', 'Events', 'Next date', 'Example location', 'Status'];
const TCOL = { PICK: 0, TITLE: 1, COUNT: 2, NEXT: 3, LOCATION: 4, STATUS: 5 };
const SYNC_MARK = '✓';

/** Menu item: reads the school calendar and rebuilds the Events and Pick Titles tabs. */
function refreshEvents() {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(30000)) return notify_('Another refresh or sync is running. Try again in a minute.');
  try {
    const settings = readSettings_();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const tz = ss.getSpreadsheetTimeZone();
    const afterKey = settings.after ? Utilities.formatDate(settings.after, tz, 'yyyy-MM-dd') : '';
    const beforeKey = settings.before ? Utilities.formatDate(settings.before, tz, 'yyyy-MM-dd') : '';

    const events = fetchSourceEvents_(settings).filter(function (ev) {
      const key = ev.allDay ? ymdKey_(ev.start) : Utilities.formatDate(ev.start, tz, 'yyyy-MM-dd');
      return (!afterKey || key >= afterKey) && (!beforeKey || key <= beforeKey);
    });

    if (!ss.getSheetByName(SHEET_WORDS)) buildWordsTab_(ss);
    const eventsSheet = ss.getSheetByName(SHEET_EVENTS) || ss.insertSheet(SHEET_EVENTS);
    const overrides = new Map();
    if (hasCurrentLayout_(eventsSheet)) {
      readEventValues_(eventsSheet).forEach(function (r) {
        if (r[COL.OVERRIDE]) overrides.set(String(r[COL.UID]), r[COL.OVERRIDE]);
      });
    }

    const rows = events.map(function (ev) {
      return [
        overrides.get(ev.uid) || '', '', '', ev.title,
        ev.allDay ? noonOn_(ev.start, tz) : ev.start,
        ev.allDay ? noonOn_(ev.end, tz) : ev.end,
        ev.location, ev.description, ev.allDay, ev.uid,
      ];
    });
    rows.sort(function (a, b) { return a[COL.START] - b[COL.START] || String(a[COL.TITLE]).localeCompare(b[COL.TITLE]); });

    writeEventsSheet_(eventsSheet, rows);
    const titleCount = writeTitlesSheet_(ss, rows, readPicks_());
    const kept = applyChoices_().filter(function (r) { return r.keep; }).length;

    notify_('Loaded ' + rows.length + ' events with ' + titleCount + ' different titles. ' + kept + ' will sync.\n\n' +
      'Next: check the kinds of events you want on the Pick Titles tab, then School Calendar > Sync.');
  } finally {
    lock.releaseLock();
  }
}

/** Menu item: refreshes the "Will sync" column after changing picks, words, or overrides. */
function updateChoices() {
  const rows = applyChoices_();
  if (!rows) return notify_('The Events tab is empty or out of date. Run "Refresh events" first.');
  const kept = rows.filter(function (r) { return r.keep; }).length;
  notify_(kept + ' of ' + rows.length + ' events will sync. The Events tab shows which ones, and why.');
}

/**
 * Works out keep / leave out for every event, writes "Will sync" and "Why" on the Events tab
 * and "Status" on Pick Titles, and returns the events as objects (null if the tab is not ready).
 */
function applyChoices_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_EVENTS);
  if (!hasCurrentLayout_(sheet) || sheet.getLastRow() < 2) return null;

  const values = readEventValues_(sheet);
  const picks = readPicks_();
  const words = readWords_();

  const decisions = values.map(function (r) {
    const d = decide_(r[COL.TITLE], r[COL.OVERRIDE], picks, words);
    r[COL.SYNC] = d.keep ? SYNC_MARK : '';
    r[COL.WHY] = d.why;
    return [r[COL.SYNC], r[COL.WHY]];
  });
  sheet.getRange(2, COL.SYNC + 1, values.length, 2).setValues(decisions);

  const titles = ss.getSheetByName(SHEET_TITLES);
  if (titles && titles.getLastRow() > 1) {
    const names = titles.getRange(2, TCOL.TITLE + 1, titles.getLastRow() - 1, 1).getValues();
    titles.getRange(2, TCOL.STATUS + 1, names.length, 1).setValues(names.map(function (n) {
      return [titleStatus_(n[0], picks, words)];
    }));
  }

  return values
    .map(function (r) {
      return {
        keep: r[COL.SYNC] === SYNC_MARK,
        title: String(r[COL.TITLE]),
        start: r[COL.START],
        end: r[COL.END] instanceof Date ? r[COL.END] : r[COL.START],
        location: String(r[COL.LOCATION]),
        description: String(r[COL.DESCRIPTION]),
        allDay: r[COL.ALL_DAY] === true,
        uid: String(r[COL.UID]),
      };
    })
    .filter(function (r) { return r.uid && r.start instanceof Date; });
}

/** The rules from the top of this file, for one event. Returns { keep, why }. */
function decide_(title, override, picks, words) {
  if (override === 'Keep') return { keep: true, why: 'Override: Keep' };
  if (override === 'Hide') return { keep: false, why: 'Override: Hide' };
  if (picks.has(titleKey_(title))) return { keep: true, why: 'Picked title' };
  const hide = matchWord_(title, words.hide);
  if (hide) return { keep: false, why: 'Hide word: ' + hide };
  const keep = matchWord_(title, words.keep);
  if (keep) return { keep: true, why: 'Keep word: ' + keep };
  return { keep: false, why: '' };
}

function titleStatus_(title, picks, words) {
  if (picks.has(titleKey_(title))) return 'Picked';
  const hide = matchWord_(title, words.hide);
  if (hide) return 'Hidden by word: ' + hide;
  const keep = matchWord_(title, words.keep);
  return keep ? 'Kept by word: ' + keep : '';
}

/**
 * The school sometimes appends notes such as "CHANGED: Location change from I212 to W301".
 * Titles are grouped and picked without that note, so a change does not drop an event.
 */
function baseTitle_(title) {
  return String(title).replace(/\s+CHANGED:.*$/i, '').replace(/\s+/g, ' ').trim();
}

function titleKey_(title) {
  return baseTitle_(title).toLowerCase();
}

// ---- Tabs ----

function writeEventsSheet_(sheet, rows) {
  resetSheet_(sheet);
  sheet.getRange(1, 1, 1, EVENT_HEADERS.length).setValues([EVENT_HEADERS]).setFontWeight('bold');
  sheet.setFrozenRows(1);
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, EVENT_HEADERS.length).setValues(rows);
    sheet.getRange(2, COL.OVERRIDE + 1, rows.length, 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(['Keep', 'Hide'], true).setAllowInvalid(false).build());
    const formats = rows.map(function (r) {
      const f = r[COL.ALL_DAY] ? 'ddd m/d/yy' : 'ddd m/d/yy h:mm am/pm';
      return [f, f];
    });
    sheet.getRange(2, COL.START + 1, rows.length, 2).setNumberFormats(formats);
    sheet.getRange(2, COL.SYNC + 1, rows.length, 1).setHorizontalAlignment('center').setFontColor('#188038');
    sheet.getRange(2, COL.WHY + 1, rows.length, 1).setFontColor('#666666');
  }
  sheet.getRange(1, 1, Math.max(rows.length, 1) + 1, EVENT_HEADERS.length).createFilter();
  sheet.setColumnWidth(COL.OVERRIDE + 1, 80);
  sheet.setColumnWidth(COL.SYNC + 1, 70);
  sheet.setColumnWidth(COL.WHY + 1, 150);
  sheet.setColumnWidth(COL.TITLE + 1, 320);
  sheet.setColumnWidths(COL.START + 1, 2, 150);
  sheet.setColumnWidth(COL.LOCATION + 1, 200);
  sheet.setColumnWidth(COL.DESCRIPTION + 1, 200);
  // The sync needs these two columns, but people do not.
  sheet.hideColumns(COL.ALL_DAY + 1, 2);
}

/** One row per title, most frequent first. Earlier picks are kept. Returns the number of titles. */
function writeTitlesSheet_(ss, eventRows, picks) {
  const now = new Date();
  const groups = new Map();
  eventRows.forEach(function (r) {
    const key = titleKey_(r[COL.TITLE]);
    let g = groups.get(key);
    if (!g) {
      g = { title: baseTitle_(r[COL.TITLE]), count: 0, next: null, first: r[COL.START], location: '' };
      groups.set(key, g);
    }
    g.count++;
    if (r[COL.START] >= now && (!g.next || r[COL.START] < g.next)) g.next = r[COL.START];
    if (!g.location && r[COL.LOCATION]) g.location = r[COL.LOCATION];
  });

  const rows = Array.from(groups.entries())
    .map(function (entry) {
      const g = entry[1];
      return [picks.has(entry[0]), g.title, g.count, g.next || g.first, g.location, ''];
    })
    .sort(function (a, b) { return b[TCOL.COUNT] - a[TCOL.COUNT] || a[TCOL.TITLE].localeCompare(b[TCOL.TITLE]); });

  const sheet = ss.getSheetByName(SHEET_TITLES) || ss.insertSheet(SHEET_TITLES);
  resetSheet_(sheet);
  sheet.getRange(1, 1, 1, TITLE_HEADERS.length).setValues([TITLE_HEADERS]).setFontWeight('bold');
  sheet.setFrozenRows(1);
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, TITLE_HEADERS.length).setValues(rows);
    sheet.getRange(2, TCOL.PICK + 1, rows.length, 1).insertCheckboxes();
    sheet.getRange(2, TCOL.NEXT + 1, rows.length, 1).setNumberFormat('ddd m/d/yy');
    sheet.getRange(2, TCOL.STATUS + 1, rows.length, 1).setFontColor('#666666');
  }
  sheet.getRange(1, 1, Math.max(rows.length, 1) + 1, TITLE_HEADERS.length).createFilter();
  sheet.setColumnWidth(TCOL.PICK + 1, 50);
  sheet.setColumnWidth(TCOL.TITLE + 1, 360);
  sheet.setColumnWidth(TCOL.COUNT + 1, 60);
  sheet.setColumnWidth(TCOL.NEXT + 1, 110);
  sheet.setColumnWidth(TCOL.LOCATION + 1, 200);
  sheet.setColumnWidth(TCOL.STATUS + 1, 200);
  return rows.length;
}

function resetSheet_(sheet) {
  if (sheet.getFilter()) sheet.getFilter().remove();
  sheet.clear();
  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).clearDataValidations();
  sheet.showColumns(1, sheet.getMaxColumns());
}

/** True if the Events tab was built by this version (older versions had a "Keep" column). */
function hasCurrentLayout_(sheet) {
  return !!sheet && sheet.getLastRow() >= 1 && sheet.getRange(1, 1).getValue() === EVENT_HEADERS[0];
}

function readEventValues_(sheet) {
  if (sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, EVENT_HEADERS.length).getValues();
}

/** The set of title keys checked on Pick Titles. */
function readPicks_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TITLES);
  const picks = new Set();
  if (!sheet || sheet.getLastRow() < 2) return picks;
  sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues().forEach(function (r) {
    if (r[TCOL.PICK] === true) picks.add(titleKey_(r[TCOL.TITLE]));
  });
  return picks;
}

/** Keep words (column A) and hide words (column B) as [{ text, lower }]. */
function readWords_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_WORDS);
  const words = { keep: [], hide: [] };
  if (!sheet || sheet.getLastRow() < 2) return words;
  sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues().forEach(function (r) {
    [['keep', r[0]], ['hide', r[1]]].forEach(function (pair) {
      const text = String(pair[1]).trim();
      if (text) words[pair[0]].push({ text: text, lower: text.toLowerCase() });
    });
  });
  return words;
}

/** The first word that appears in the title (ignoring case), or '' if none. */
function matchWord_(title, list) {
  const lower = String(title).toLowerCase();
  const hit = list.find(function (w) { return lower.indexOf(w.lower) !== -1; });
  return hit ? hit.text : '';
}

/**
 * All-day dates are stored as noon on that day in the Sheet's time zone, so the date
 * shown never slips a day when time zones differ slightly.
 */
function noonOn_(ymd, tz) {
  return Utilities.parseDate(ymdKey_(ymd) + ' 12:00', tz, 'yyyy-MM-dd HH:mm');
}
