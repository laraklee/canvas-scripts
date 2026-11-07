/**
 * Feed.js
 * Downloads the school calendar's public ICS feed and turns it into plain event objects.
 *
 * Endpoints: the "Copy FROM" ICS link on the Start Here tab (read-only GET). No write calls.
 * Script Properties: none.
 */

/** Fetches the feed and returns parsed events (cancelled events are left out). */
function fetchFeedEvents_(url) {
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
  const code = response.getResponseCode();
  const text = response.getContentText();
  if (code !== 200 || text.indexOf('BEGIN:VCALENDAR') === -1) {
    throw new Error('Could not read the calendar feed (HTTP ' + code + '). Check the "Copy FROM" link on the Start Here tab.');
  }
  return parseIcs_(text);
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
