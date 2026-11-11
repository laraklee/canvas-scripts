/**
 * SchoolEvents.js
 * Reads the school's faculty calendar and lists its kinds of events (titles) for the page's
 * "School Events" section. Titles are grouped the way calendar-filter groups them, so a
 * "CHANGED: ..." note on one date does not split an event into two titles.
 *
 * Endpoints: Google Calendar, read-only (CalendarApp), for the calendar in FACULTY_CALENDAR_ID.
 * Write calls: none.
 * Script Properties: FACULTY_CALENDAR_ID (the faculty calendar's Google Calendar ID; not a
 *   secret, but kept out of the code because this repo is public).
 * Each teacher must already have the faculty calendar in their own Google Calendar list.
 */

const DAY_MS = 86400000;

/**
 * Called from the page. startKey and endKey are "yyyy-MM-dd" (either may be blank).
 * Returns { total, titles: [{ key, title, count, nextLabel }] }, most frequent titles first.
 * nextLabel is the next date from today on, or the first date if they are all past.
 */
function getSchoolEventTitles(startKey, endKey) {
  const calendar = facultyCalendar_();
  const tz = Session.getScriptTimeZone();
  const range = dateRange_(startKey, endKey, tz);
  const events = calendar.getEvents(range.start, range.end);
  const todayKey = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');

  const groups = new Map();
  events.forEach(function (ev) {
    const title = baseTitle_(ev.getTitle() || '(no title)');
    const key = title.toLowerCase();
    const start = ev.isAllDayEvent() ? ev.getAllDayStartDate() : ev.getStartTime();
    const dayKey = Utilities.formatDate(start, tz, 'yyyy-MM-dd');

    let g = groups.get(key);
    if (!g) {
      g = { key: key, title: title, count: 0, first: null, firstKey: '', next: null, nextKey: '' };
      groups.set(key, g);
    }
    g.count++;
    if (!g.first || dayKey < g.firstKey) { g.first = start; g.firstKey = dayKey; }
    if (dayKey >= todayKey && (!g.next || dayKey < g.nextKey)) { g.next = start; g.nextKey = dayKey; }
  });

  const titles = Array.from(groups.values())
    .map(function (g) {
      return {
        key: g.key,
        title: g.title,
        count: g.count,
        nextLabel: Utilities.formatDate(g.next || g.first, tz, 'EEE M/d/yy'),
      };
    })
    .sort(function (a, b) { return b.count - a.count || a.title.localeCompare(b.title); });

  return { total: events.length, titles: titles };
}

/** Opens the faculty calendar, or throws a message the teacher can act on. */
function facultyCalendar_() {
  const id = (PropertiesService.getScriptProperties().getProperty('FACULTY_CALENDAR_ID') || '').trim();
  if (!id) {
    throw new Error('The faculty calendar is not set up yet (Script Property FACULTY_CALENDAR_ID is missing).');
  }
  const calendar = CalendarApp.getCalendarById(id);
  if (!calendar) {
    throw new Error('Could not open the faculty calendar. Add it to your Google Calendar first, ' +
      'then click Load School Events again.');
  }
  return calendar;
}

/**
 * Turns the page's dates into a range for CalendarApp. The end is midnight AFTER the last day,
 * in the script's time zone, so late events on the last day are kept. Blank dates default to
 * a year back and a year and a half ahead.
 */
function dateRange_(startKey, endKey, tz) {
  const parse = function (key) {
    return /^\d{4}-\d{2}-\d{2}$/.test(key || '') ? Utilities.parseDate(key, tz, 'yyyy-MM-dd') : null;
  };
  const now = Date.now();
  const start = parse(startKey) || new Date(now - 365 * DAY_MS);
  const lastDay = parse(endKey);
  const end = lastDay ? Utilities.parseDate(nextDayKey_(endKey), tz, 'yyyy-MM-dd') : new Date(now + 548 * DAY_MS);
  if (end <= start) throw new Error('The end date is before the start date. Check step 2.');
  return { start: start, end: end };
}

/** "2027-06-30" -> "2027-07-01" (calendar arithmetic, so time zones and DST can't shift it). */
function nextDayKey_(key) {
  const p = key.split('-').map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + 1));
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
    String(d.getUTCDate()).padStart(2, '0');
}

/**
 * Same as calendar-filter: the school sometimes appends notes such as
 * "CHANGED: Location change from I212 to W301". Group titles without that note.
 */
function baseTitle_(title) {
  return String(title).replace(/\s+CHANGED:.*$/i, '').replace(/\s+/g, ' ').trim();
}
