/**
 * Feed.js
 * Reads the school calendar and turns it into plain event objects. The "Copy FROM" setting
 * is either a Google Calendar ID (read directly, the default) or a public ICS link (downloaded).
 *
 * Endpoints: the ICS link, if one is used (read-only GET). Otherwise Google Calendar (read-only).
 * Write calls: none. Script Properties: none.
 */

const FETCH_ATTEMPTS = 4;

/** Returns events from the "Copy FROM" source, limited to the date range in settings. */
function fetchSourceEvents_(settings) {
  const source = settings.source.replace(/^webcal:\/\//i, 'https://');
  if (/^https?:\/\//i.test(source)) return fetchFeedEvents_(source);
  return readCalendarEvents_(source, settings);
}

/** Reads a Google Calendar the user has in their calendar list. */
function readCalendarEvents_(calendarId, settings) {
  const calendar = CalendarApp.getCalendarById(calendarId);
  if (!calendar) {
    throw new Error('Could not open the school calendar "' + calendarId + '". Add it to your Google Calendar first ' +
      '(see "Before you start" on the Start Here tab), then try again.');
  }
  // Calendar needs a date range. Without one in settings, go well past both ends of the school year.
  const day = 86400000;
  const start = settings.after || new Date(Date.now() - 365 * day);
  const end = settings.before ? new Date(settings.before.getTime() + day) : new Date(Date.now() + 548 * day);

  const tz = Session.getScriptTimeZone();
  const ymdOf = function (date) {
    const parts = Utilities.formatDate(date, tz, 'yyyy-MM-dd').split('-');
    return { y: +parts[0], m: +parts[1], d: +parts[2] };
  };

  return calendar.getEvents(start, end).map(function (ev) {
    const out = {
      // Every occurrence of a repeating event shares one ID, so add the start time to tell them apart.
      uid: ev.isRecurringEvent() ? ev.getId() + '|' + ev.getStartTime().toISOString() : ev.getId(),
      title: ev.getTitle() || '(no title)',
      location: ev.getLocation(),
      description: ev.getDescription(),
      allDay: ev.isAllDayEvent(),
    };
    if (out.allDay) {
      // Both are midnight in the script's time zone; the end is the day AFTER the last day.
      out.start = ymdOf(ev.getAllDayStartDate());
      out.end = addDays_(ymdOf(ev.getAllDayEndDate()), -1);
      if (ymdKey_(out.end) < ymdKey_(out.start)) out.end = out.start;
    } else {
      out.start = ev.getStartTime();
      out.end = ev.getEndTime();
    }
    return out;
  });
}

/** Downloads an ICS feed and returns parsed events (cancelled events are left out). */
function fetchFeedEvents_(url) {
  let code = 0;
  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt++) {
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
    code = response.getResponseCode();
    if (code === 200) {
      const text = response.getContentText();
      if (text.indexOf('BEGIN:VCALENDAR') !== -1) return parseIcs_(text);
      break;
    }
    // 429 = too many requests, 5xx = server trouble: both are worth waiting out.
    if (code !== 429 && code < 500) break;
    if (attempt < FETCH_ATTEMPTS) Utilities.sleep(2000 * Math.pow(2, attempt - 1));
  }
  const hint = code === 429
    ? 'Google is limiting downloads right now. Wait a few minutes, or use the calendar\'s ID instead of its link.'
    : 'Check the "Copy FROM" box on the Start Here tab.';
  throw new Error('Could not read the calendar feed (HTTP ' + code + '). ' + hint);
}

/**
 * Parses ICS text. Each event is
 *   { uid, title, location, description, allDay, start, end }
 * where all-day events use { y, m, d } for start and end (end is the LAST day, inclusive)
 * and timed events use Date objects.
 */
function parseIcs_(text) {
  // Long lines are folded onto the next line with a leading space or tab; join them back.
  const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const events = [];
  let props = null;

  lines.forEach(function (line) {
    if (line === 'BEGIN:VEVENT') { props = new Map(); return; }
    if (line === 'END:VEVENT') {
      const ev = props && toEvent_(props);
      if (ev) events.push(ev);
      props = null;
      return;
    }
    if (!props) return;

    const colon = line.indexOf(':');
    if (colon < 1) return;
    const head = line.slice(0, colon).split(';');
    const name = head[0].toUpperCase();
    if (props.has(name)) return;
    const params = new Map();
    head.slice(1).forEach(function (p) {
      const eq = p.indexOf('=');
      if (eq > 0) params.set(p.slice(0, eq).toUpperCase(), p.slice(eq + 1).replace(/^"|"$/g, ''));
    });
    props.set(name, { value: line.slice(colon + 1), params: params });
  });
  return events;
}

function toEvent_(props) {
  const status = props.get('STATUS');
  if (status && status.value.toUpperCase() === 'CANCELLED') return null;
  if (!props.has('DTSTART') || !props.has('UID')) return null;

  const start = parseIcsDate_(props.get('DTSTART'));
  const end = props.has('DTEND') ? parseIcsDate_(props.get('DTEND')) : null;
  if (!start) return null;

  const ev = {
    uid: props.get('UID').value.trim(),
    title: icsText_(props.get('SUMMARY')) || '(no title)',
    location: icsText_(props.get('LOCATION')),
    description: icsText_(props.get('DESCRIPTION')),
    allDay: start.allDay,
  };

  if (start.allDay) {
    // ICS end dates for all-day events are exclusive (the day after the last day).
    ev.start = start.ymd;
    ev.end = end && end.allDay ? addDays_(end.ymd, -1) : start.ymd;
    if (ymdKey_(ev.end) < ymdKey_(ev.start)) ev.end = ev.start;
  } else {
    ev.start = start.date;
    ev.end = end && !end.allDay && end.date >= start.date ? end.date : start.date;
  }
  return ev;
}

/** Returns { allDay: true, ymd } or { allDay: false, date }, or null if unreadable. */
function parseIcsDate_(prop) {
  const v = prop.value.trim();
  const dateOnly = v.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dateOnly) {
    return { allDay: true, ymd: { y: +dateOnly[1], m: +dateOnly[2], d: +dateOnly[3] } };
  }
  const t = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!t) return null;
  if (t[7] === 'Z') {
    return { allDay: false, date: new Date(Date.UTC(+t[1], t[2] - 1, +t[3], +t[4], +t[5], +t[6])) };
  }
  // A local time, either in a named zone (TZID=...) or "floating" (use the script's zone).
  const zone = prop.params.get('TZID') || Session.getScriptTimeZone();
  return { allDay: false, date: Utilities.parseDate(v, zone, "yyyyMMdd'T'HHmmss") };
}

/** Undoes ICS text escaping (\, \; \\ and \n). */
function icsText_(prop) {
  if (!prop) return '';
  return prop.value
    .replace(/\\([\\;,nN])/g, function (_, c) { return c === 'n' || c === 'N' ? '\n' : c; })
    .trim();
}

function addDays_(ymd, n) {
  const d = new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d + n));
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
}

/** "2026-11-07" style key; sorts and compares correctly as a string. */
function ymdKey_(ymd) {
  return ymd.y + '-' + String(ymd.m).padStart(2, '0') + '-' + String(ymd.d).padStart(2, '0');
}
