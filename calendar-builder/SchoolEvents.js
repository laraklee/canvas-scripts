/**
 * SchoolEvents.js
 * Reads the school's faculty calendar and lists its kinds of events (titles) for the page's
 * "School Events" section. Titles are grouped the way calendar-filter groups them, so a
 * "CHANGED: ..." note on one date does not split an event into two titles.
 *
 * The faculty calendar is downloaded from the school's own ICS link (the one teachers
 * subscribe to), the same for everyone, so teachers needn't add it to Google Calendar.
 * (Until 11/15 it was read with CalendarApp from one person's subscribed copy, which no one
 * else could open.) The download is shared through the Script Cache like the bell schedule's
 * (fetchFeedText_ in Code.js), so a change at school can take up to an hour to show.
 * The feed has no repeating events (checked 11/15), so Ics.js not expanding them is fine.
 *
 * Endpoints: the faculty calendar's ICS link (read-only GET, from FACULTY_CALENDAR_URL).
 * Write calls: none.
 * Script Properties: FACULTY_CALENDAR_URL (the faculty calendar's ICS link; not a secret,
 *   but kept out of the code because this repo is public).
 */

const DAY_MS = 86400000;

const FACULTY_FEED = { cachePrefix: 'faculty_ics_v1', label: 'faculty calendar', url: function () { return facultyCalendarUrl_(); } };

/**
 * Called from the page. startKey and endKey are "yyyy-MM-dd" (either may be blank).
 * Returns { total, titles: [{ key, title, count, nextLabel }] }, most frequent titles first.
 * nextLabel is the next date from today on, or the first date if they are all past.
 */
function getSchoolEventTitles(startKey, endKey) {
  const tz = Session.getScriptTimeZone();
  const range = dateRange_(startKey, endKey, tz);
  const events = facultyEvents_(tz).filter(function (ev) {
    return ev.startDate < range.end && ev.endDate > range.start; // Overlaps the range.
  });
  const todayKey = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');

  const groups = new Map();
  events.forEach(function (ev) {
    const title = baseTitle_(ev.title);
    const key = title.toLowerCase();
    const start = ev.startDate;
    const dayKey = ev.dayKey;

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

/**
 * Every faculty calendar event, as parsed by parseIcs_ (Ics.js), plus:
 *   dayKey    "yyyy-MM-dd" of the first day, in Hawaii (script) time;
 *   startDate / endDate  Dates for range checks (endDate is the moment it ends; for all-day
 *             events, midnight after the last day).
 */
function facultyEvents_(tz) {
  const midnight = function (ymd) { return Utilities.parseDate(ymdKey_(ymd), tz, 'yyyy-MM-dd'); };
  return parseIcs_(fetchFeedText_(FACULTY_FEED)).map(function (ev) {
    if (ev.allDay) {
      ev.dayKey = ymdKey_(ev.start);
      ev.startDate = midnight(ev.start);
      ev.endDate = midnight(addDays_(ev.end, 1));
    } else {
      ev.dayKey = Utilities.formatDate(ev.start, tz, 'yyyy-MM-dd');
      ev.startDate = ev.start;
      ev.endDate = new Date(Math.max(ev.end.getTime(), ev.start.getTime() + 1)); // Never zero length.
    }
    return ev;
  });
}

/** The faculty calendar's ICS link from the FACULTY_CALENDAR_URL Script Property. */
function facultyCalendarUrl_() {
  const url = (PropertiesService.getScriptProperties().getProperty('FACULTY_CALENDAR_URL') || '').trim();
  if (!url) {
    throw new Error('The faculty calendar is not set up yet (Script Property FACULTY_CALENDAR_URL is missing).');
  }
  if (!/^https:\/\//i.test(url)) {
    throw new Error('The faculty calendar link (Script Property FACULTY_CALENDAR_URL) must start with https://');
  }
  return url;
}

/**
 * Turns the page's dates into a range. The end is midnight AFTER the last day, in the
 * script's time zone, so late events on the last day are kept. Blank dates default to
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
