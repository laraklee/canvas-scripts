/**
 * IcsExport.js
 * Option B, "Just download an .ics file": builds the file on the server from the same event
 * lists "Add to my Google Calendar" uses (classItems_ and schoolEventItems_ in Sync.js), so the
 * download and the sync always agree on periods, new names, school events, and dates (dates are
 * filtered in Hawaii time, so an afternoon class the day before the start date can't slip in).
 * Text is escaped and long lines folded as the ICS standard requires, so a new name like
 * "Bio; Room 12" can't break the file. Each event keeps a stable UID, so a calendar app can
 * recognize the same event when a newer file is imported.
 *
 * Endpoints: the bell schedule's ICS link (through fetchBellScheduleText_ in Code.js, unless the
 *   teacher picked their own file) and the faculty calendar, read-only (CalendarApp).
 * Write calls: none. Nothing is written to any calendar; the page downloads the text.
 * User Properties: BUILDER_CHOICES (the choices on screen are saved first, as the preview does).
 */

const ICS_FILE_NAME = 'My_School_Calendar.ics';
const ICS_UID_DOMAIN = '@calendar-builder';
const ICS_LINE_OCTETS = 75; // The ICS standard's longest line, in bytes.

/**
 * Called from the page. ownIcsText is the teacher's own .ics file, if they chose one in card 1
 * (null for the official bell schedule). Returns { fileName, text, classes, events }; text is
 * empty when nothing matched.
 */
function buildIcsFile(choices, ownIcsText) {
  const saved = saveChoices(choices);
  const tz = Session.getScriptTimeZone();
  const range = dateRange_(saved.start, saved.end, tz);
  const classes = classItems_(saved, tz, typeof ownIcsText === 'string' && ownIcsText ? ownIcsText : null);
  const events = schoolEventItems_(saved, range, tz);
  const result = { fileName: ICS_FILE_NAME, text: '', classes: classes.length, events: events.length };
  if (!classes.length && !events.length) return result;

  const stamp = icsUtc_(new Date());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Faculty Calendar Builder (pilot)//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:My School Calendar',
    'X-WR-TIMEZONE:' + tz,
  ];
  classes.forEach(function (item) { pushIcsEvent_(lines, item, 'class-', stamp, tz); });
  events.forEach(function (item) { pushIcsEvent_(lines, item, 'event-', stamp, tz); });
  lines.push('END:VCALENDAR');
  result.text = lines.map(foldIcsLine_).join('\r\n') + '\r\n';
  return result;
}

/** Adds one VEVENT. Timed events are written in UTC; all-day ones as plain dates. */
function pushIcsEvent_(lines, item, uidPrefix, stamp, tz) {
  lines.push('BEGIN:VEVENT');
  lines.push('UID:' + icsEscape_(uidPrefix + item.uid + ICS_UID_DOMAIN));
  lines.push('DTSTAMP:' + stamp);
  if (item.allDay) {
    const startKey = Utilities.formatDate(item.start, tz, 'yyyyMMdd');
    // ICS all-day ends are exclusive (the day after the last day). A sync item's end already is,
    // except for a single day, where it equals the start.
    const endKey = item.singleDay ? nextIcsDate_(startKey) : Utilities.formatDate(item.end, tz, 'yyyyMMdd');
    lines.push('DTSTART;VALUE=DATE:' + startKey);
    lines.push('DTEND;VALUE=DATE:' + endKey);
  } else {
    lines.push('DTSTART:' + icsUtc_(item.start));
    lines.push('DTEND:' + icsUtc_(item.end));
  }
  lines.push('SUMMARY:' + icsEscape_(item.title));
  if (item.location) lines.push('LOCATION:' + icsEscape_(item.location));
  if (item.description) lines.push('DESCRIPTION:' + icsEscape_(item.description));
  lines.push('TRANSP:OPAQUE');
  lines.push('END:VEVENT');
}

/** "20261111T003000Z" */
function icsUtc_(date) {
  return Utilities.formatDate(date, 'UTC', "yyyyMMdd'T'HHmmss'Z'");
}

/** "20261231" -> "20270101" */
function nextIcsDate_(key) {
  const next = addDays_({ y: +key.slice(0, 4), m: +key.slice(4, 6), d: +key.slice(6, 8) }, 1);
  return ymdKey_(next).replace(/-/g, '');
}

/** ICS text escaping: backslash, semicolon, comma, and line breaks. */
function icsEscape_(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * Splits a line longer than 75 bytes onto continuation lines that start with a space, without
 * cutting a character (accented letters and emoji take more than one byte).
 */
function foldIcsLine_(line) {
  const out = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const size = utf8Bytes_(ch);
    const limit = out.length ? ICS_LINE_OCTETS - 1 : ICS_LINE_OCTETS; // Continuations start with a space.
    if (bytes + size > limit) {
      out.push(current);
      current = '';
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  out.push(current);
  return out.join('\r\n ');
}

function utf8Bytes_(ch) {
  const code = ch.codePointAt(0);
  if (code < 0x80) return 1;
  if (code < 0x800) return 2;
  if (code < 0x10000) return 3;
  return 4;
}
