/**
 * Sync.js
 * Copies the kept rows of the Events tab into the user's own Google Calendar.
 *
 * Write calls: Google Calendar (create calendar, create/delete events), and only when
 * "Preview only" is unchecked on the Start Here tab. Each event the sync creates is tagged with the
 * school's event UID; the sync only ever changes or deletes events carrying that tag, so
 * anything added to the calendar by hand is left alone.
 * Script Properties: none.
 */

const TAG_UID = 'schoolCalendarUid';
const TAG_HASH = 'schoolCalendarHash';
const SYNC_TIME_LIMIT_MS = 4.5 * 60 * 1000; // Apps Script stops runs at 6 minutes.
const PAUSE_BETWEEN_WRITES_MS = 150; // Google Calendar rejects bursts of rapid changes.

/** Menu item (also run nightly): adds, updates, and removes events to match the Events tab. */
function syncToCalendar() {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(30000)) return notify_('Another refresh or sync is running. Try again in a minute.');
  try {
    const settings = readSettings_();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const rows = readEventRows_(ss.getSheetByName(SHEET_EVENTS));
    if (!rows.length) return notify_('The Events tab is empty. Run "Refresh events" first.');

    const items = rows.map(function (r) { return toSyncItem_(r, ss.getSpreadsheetTimeZone()); });
    // Only look at calendar events inside the Events tab's date range. Past events that
    // have dropped out of the school feed are left where they are.
    const windowStart = new Date(Math.min.apply(null, items.map(function (i) { return i.start.getTime(); })));
    const windowEnd = new Date(Math.max.apply(null, items.map(function (i) { return i.end.getTime(); })) + 86400000);

    let calendar = findTargetCalendar_(settings.calendar);
    if (calendar && calendar.getId() === settings.source) {
      return notify_('"Copy TO" is the same calendar as "Copy FROM". Pick a different calendar on the Start Here tab.');
    }
    const existing = new Map();
    const removes = [];
    if (calendar) {
      calendar.getEvents(windowStart, windowEnd).forEach(function (ev) {
        const uid = ev.getTag(TAG_UID);
        if (!uid) return;
        if (existing.has(uid)) removes.push(ev); // A duplicate, e.g. from an interrupted run.
        else existing.set(uid, ev);
      });
    }

    const adds = [];
    const updates = [];
    items.filter(function (i) { return i.keep; }).forEach(function (item) {
      const ev = existing.get(item.uid);
      if (!ev) return adds.push(item);
      existing.delete(item.uid);
      if (ev.getTag(TAG_HASH) !== item.hash) updates.push({ item: item, ev: ev });
    });
    existing.forEach(function (ev) { removes.push(ev); }); // Unchecked, or gone from the feed.

    const plan = describePlan_(settings.calendar, calendar, adds, updates, removes);
    if (settings.preview) {
      return notify_('PREVIEW ONLY: nothing was changed.\n\n' + plan +
        '\n\nTo really sync, uncheck "Preview only" on the Start Here tab and run Sync again.');
    }
    if (!adds.length && !updates.length && !removes.length) return notify_(plan);

    if (!calendar) {
      calendar = CalendarApp.createCalendar(settings.calendar);
      calendar.setTimeZone(Session.getScriptTimeZone());
    }

    const deadline = Date.now() + SYNC_TIME_LIMIT_MS;
    const done = { added: 0, updated: 0, removed: 0 };
    const outOfTime = function () { return Date.now() > deadline; };

    for (const ev of removes) {
      if (outOfTime()) break;
      ev.deleteEvent();
      done.removed++;
      Utilities.sleep(PAUSE_BETWEEN_WRITES_MS);
    }
    for (const u of updates) {
      if (outOfTime()) break;
      // Delete and re-create, which also handles an event switching between all-day and timed.
      u.ev.deleteEvent();
      createCalendarEvent_(calendar, u.item);
      done.updated++;
      Utilities.sleep(PAUSE_BETWEEN_WRITES_MS);
    }
    for (const item of adds) {
      if (outOfTime()) break;
      createCalendarEvent_(calendar, item);
      done.added++;
      Utilities.sleep(PAUSE_BETWEEN_WRITES_MS);
    }

    const summary = 'Synced to "' + calendar.getName() + '": added ' + done.added +
      ', updated ' + done.updated + ', removed ' + done.removed + '.';
    const finished = done.added === adds.length && done.updated === updates.length && done.removed === removes.length;
    notify_(finished ? summary : summary + '\n\nRan out of time before finishing. Run Sync again to do the rest.');
  } finally {
    lock.releaseLock();
  }
}

/** Converts an Events row into the dates and fingerprint the sync needs. */
function toSyncItem_(row, sheetTz) {
  const item = {
    keep: row.keep, uid: row.uid, title: row.title, location: row.location,
    description: row.description, allDay: row.allDay,
  };
  let startKey;
  let endKey;
  if (row.allDay) {
    const first = ymdFromCell_(row.start, sheetTz);
    const last = ymdFromCell_(row.end, sheetTz);
    startKey = ymdKey_(first);
    endKey = ymdKey_(last);
    item.singleDay = startKey >= endKey;
    // Plain dates in the script's time zone; Calendar uses only the date part.
    item.start = new Date(first.y, first.m - 1, first.d);
    item.end = item.singleDay ? item.start : new Date(last.y, last.m - 1, last.d + 1); // Exclusive end.
  } else {
    item.start = row.start;
    item.end = row.end < row.start ? row.start : row.end;
    startKey = item.start.toISOString();
    endKey = item.end.toISOString();
  }
  // A fingerprint of everything that shows up in the calendar, to spot changed events.
  const fingerprint = JSON.stringify([item.title, item.location, item.description, item.allDay, startKey, endKey]);
  item.hash = Utilities.base64Encode(
    Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, fingerprint, Utilities.Charset.UTF_8));
  return item;
}

function createCalendarEvent_(calendar, item) {
  const options = { location: item.location, description: item.description };
  let ev;
  if (!item.allDay) ev = calendar.createEvent(item.title, item.start, item.end, options);
  else if (item.singleDay) ev = calendar.createAllDayEvent(item.title, item.start, options);
  else ev = calendar.createAllDayEvent(item.title, item.start, item.end, options);
  ev.setTag(TAG_UID, item.uid);
  ev.setTag(TAG_HASH, item.hash);
}

function describePlan_(calendarName, calendar, adds, updates, removes) {
  const examples = function (titles) {
    if (!titles.length) return '';
    const shown = titles.slice(0, 5).join('; ');
    return ' (e.g. ' + shown + (titles.length > 5 ? '; ...' : '') + ')';
  };
  const lines = [];
  if (!calendar) lines.push('Create a new calendar named "' + calendarName + '".');
  lines.push('Add ' + adds.length + ' event(s)' + examples(adds.map(function (i) { return i.title; })));
  lines.push('Update ' + updates.length + ' event(s)' + examples(updates.map(function (u) { return u.item.title; })));
  lines.push('Remove ' + removes.length + ' event(s)' + examples(removes.map(function (ev) { return ev.getTitle(); })));
  return lines.join('\n');
}

/**
 * The "Copy TO" setting can be a Calendar ID (has an @) or a name. Returns null only for
 * a name with no matching calendar yet, which the sync then creates.
 */
function findTargetCalendar_(nameOrId) {
  if (nameOrId.indexOf('@') !== -1) {
    const byId = CalendarApp.getCalendarById(nameOrId);
    if (!byId) {
      throw new Error('Could not find a calendar with the ID "' + nameOrId + '". Check the "Copy TO" box ' +
        'on the Start Here tab, and make sure you can make changes to that calendar.');
    }
    return byId;
  }
  return CalendarApp.getOwnedCalendarsByName(nameOrId)[0] || null;
}

function ymdFromCell_(date, tz) {
  const parts = Utilities.formatDate(date, tz, 'yyyy-MM-dd').split('-');
  return { y: +parts[0], m: +parts[1], d: +parts[2] };
}

// ---- Nightly trigger ----

function turnOnNightlySync() {
  removeNightlyTriggers_();
  ScriptApp.newTrigger('nightlyRefreshAndSync').timeBased().everyDays(1).atHour(3).create();
  const preview = readSettings_().preview;
  notify_('Nightly refresh + sync is on (around 3 a.m.).' +
    (preview ? '\n\n"Preview only" is still checked on the Start Here tab, so the nightly run will not change your calendar until you uncheck it.' : ''));
}

function turnOffNightlySync() {
  removeNightlyTriggers_();
  notify_('Nightly refresh + sync is off.');
}

/** Run by the nightly trigger. */
function nightlyRefreshAndSync() {
  refreshEvents();
  syncToCalendar();
}

function removeNightlyTriggers_() {
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'nightlyRefreshAndSync'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
}
