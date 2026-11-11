/**
 * Settings.js
 * Saves and loads each teacher's choices (date range, periods and new names, all-day events,
 * school event titles, and which calendar each group goes on), and lists the calendars a
 * teacher can pick from.
 *
 * Endpoints: Google Calendar, read-only (lists the teacher's own calendars).
 * Write calls: none to any calendar. Saves only to the teacher's own User Properties.
 * User Properties: BUILDER_CHOICES (JSON, written by saveChoices). Each teacher has their own;
 *   other editors of the script cannot read them.
 *
 * Calendar choices are stored as one of:
 *   'new:My Classes' or 'new:School Events'  a calendar with that name, created on first sync
 *                                           (or the teacher's own, if they already have one)
 *   'primary'                               the account's main calendar
 *   a Calendar ID                           another calendar the teacher owns
 */

const CHOICES_KEY = 'BUILDER_CHOICES';
const NEW_CLASSES_CALENDAR = 'My Classes';
const NEW_EVENTS_CALENDAR = 'School Events';
const MAX_RENAME_LENGTH = 100;
const MAX_SCHOOL_PICKS = 300;
const MAX_CHOICES_BYTES = 8500; // User Properties holds at most 9 KB per value.

/** Choices for a teacher who hasn't saved any yet. */
function defaultChoices_() {
  return {
    start: '2026-08-01',
    end: '2027-06-30',
    allDay: false,
    periods: {},
    schoolEvents: [],
    classesCalendar: 'new:' + NEW_CLASSES_CALENDAR,
    eventsCalendar: 'new:' + NEW_EVENTS_CALENDAR,
  };
}

/** Returns the teacher's saved choices, filled in with defaults for anything missing. */
function loadChoices_() {
  const saved = PropertiesService.getUserProperties().getProperty(CHOICES_KEY);
  if (!saved) return defaultChoices_();
  try {
    return cleanChoices_(JSON.parse(saved));
  } catch (err) {
    Logger.log('Saved choices could not be read; using defaults. ' + err.message);
    return defaultChoices_();
  }
}

/** Called from the page whenever something changes. Returns the choices as saved. */
function saveChoices(choices) {
  const clean = cleanChoices_(choices);
  const json = JSON.stringify(clean);
  if (Utilities.newBlob(json).getBytes().length > MAX_CHOICES_BYTES) {
    throw new Error('Too many choices to save. Uncheck some school events and try again.');
  }
  PropertiesService.getUserProperties().setProperty(CHOICES_KEY, json);
  return clean;
}

/** Keeps only known, sensible values, so a bad save can't break the page or the sync. */
function cleanChoices_(raw) {
  const out = defaultChoices_();
  if (!raw || typeof raw !== 'object') return out;

  const isDateKey = function (v) { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v); };
  if (isDateKey(raw.start)) out.start = raw.start;
  if (isDateKey(raw.end)) out.end = raw.end;
  out.allDay = raw.allDay === true;

  const periods = raw.periods && typeof raw.periods === 'object' ? raw.periods : {};
  PERIOD_CATEGORIES.forEach(function (cat) {
    const p = periods[cat.id];
    if (!p || typeof p !== 'object') return;
    const rename = typeof p.rename === 'string' ? p.rename.trim().slice(0, MAX_RENAME_LENGTH) : '';
    if (p.keep === true || rename) out.periods[cat.id] = { keep: p.keep === true, rename: rename };
  });

  if (Array.isArray(raw.schoolEvents)) {
    const seen = new Set();
    raw.schoolEvents.forEach(function (key) {
      if (typeof key === 'string' && key.length <= 200 && seen.size < MAX_SCHOOL_PICKS) seen.add(key);
    });
    out.schoolEvents = Array.from(seen);
  }

  const isCalendarChoice = function (v) {
    return typeof v === 'string' && v.length > 0 && v.length <= 200 &&
      (v === 'primary' || v === 'new:' + NEW_CLASSES_CALENDAR || v === 'new:' + NEW_EVENTS_CALENDAR || v.indexOf('@') > 0);
  };
  if (isCalendarChoice(raw.classesCalendar)) out.classesCalendar = raw.classesCalendar;
  if (isCalendarChoice(raw.eventsCalendar)) out.eventsCalendar = raw.eventsCalendar;
  return out;
}

/**
 * The calendars a teacher can pick for each group: the two new ones, their main calendar,
 * and any other calendar they own (calendars named "My Classes" or "School Events" are
 * already covered by the first two). Returns [{ value, label }].
 */
function calendarOptions_() {
  const options = [
    { value: 'new:' + NEW_CLASSES_CALENDAR, label: NEW_CLASSES_CALENDAR + ' (new calendar)' },
    { value: 'new:' + NEW_EVENTS_CALENDAR, label: NEW_EVENTS_CALENDAR + ' (new calendar)' },
    { value: 'primary', label: 'My main calendar' },
  ];
  try {
    const primaryId = CalendarApp.getDefaultCalendar().getId();
    CalendarApp.getAllOwnedCalendars()
      .filter(function (cal) {
        const name = cal.getName();
        return cal.getId() !== primaryId && name !== NEW_CLASSES_CALENDAR && name !== NEW_EVENTS_CALENDAR;
      })
      .map(function (cal) { return { value: cal.getId(), label: cal.getName() }; })
      .sort(function (a, b) { return a.label.localeCompare(b.label); })
      .forEach(function (opt) { options.push(opt); });
  } catch (err) {
    Logger.log('Could not list calendars: ' + err.message);
  }
  return options;
}

/** JSON that is safe to place inside a <script> tag on the page. */
function jsonForPage_(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
