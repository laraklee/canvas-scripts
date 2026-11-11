/**
 * Sync.js
 * "Add to my Google Calendar". Step 5b: works out what WOULD change in the teacher's chosen
 * calendars and returns a preview. It never changes a calendar (writing comes in step 5c).
 *
 * How events are matched:
 *  - Events the app adds carry a tag: TAG_CLASSES (bell schedule) or TAG_EVENTS (faculty
 *    calendar), holding the source event's ID, plus TAG_HASH, a fingerprint of what's shown.
 *    Tagged events are kept (same), updated (fingerprint differs), moved (they're in a calendar
 *    the teacher no longer uses for that group), or removed (no longer wanted).
 *  - An untagged event with the same title and start time as a wanted event is the teacher's
 *    own (typed in, or imported from an .ics). It is left alone, and no copy is added.
 *  - Only events inside the date range are looked at.
 *
 * Endpoints: Google Calendar, read-only (the teacher's chosen calendars, the faculty calendar),
 *   and the bell schedule's ICS link through fetchBellScheduleText_() in Code.js.
 * Write calls: none. Saves the teacher's choices (saveChoices) before planning.
 * User Properties read: BUILDER_CHOICES, and BUILDER_LAST_CALENDARS (the calendars the last
 *   real sync used, so events can be moved; written by step 5c).
 */

const TAG_CLASSES = 'builderClassUid';
const TAG_EVENTS = 'builderEventUid';
const TAG_HASH = 'builderHash';
const LAST_CALENDARS_KEY = 'BUILDER_LAST_CALENDARS';
const PREVIEW_EXAMPLES = 5;

const SYNC_GROUPS = [
  { key: 'classes', tag: TAG_CLASSES, choice: 'classesCalendar', label: 'Classes and bell schedule' },
  { key: 'events', tag: TAG_EVENTS, choice: 'eventsCalendar', label: 'School events' },
];

/** Called from the page (Option A). Saves the choices on screen, then returns the preview. */
function previewSync(choices) {
  const saved = saveChoices(choices);
  return planForPage_(buildSyncPlan_(saved));
}

/**
 * Works out every change, per group. Returns
 *   { groups: [{ group, target, adds, updates, unchanged, alreadyThere, moves, removes }],
 *     calendarNames: Map(id -> name) }
 * where adds/alreadyThere hold items, updates/moves hold { item, found }, and removes hold
 * found events ({ ev, calId }).
 */
function buildSyncPlan_(choices) {
  const tz = Session.getScriptTimeZone();
  const range = dateRange_(choices.start, choices.end, tz);
  const wanted = {
    classes: classItems_(choices, tz),
    events: schoolEventItems_(choices, range, tz),
  };

  const targets = {};
  SYNC_GROUPS.forEach(function (g) { targets[g.key] = resolveTargetCalendar_(choices[g.choice], g.label); });

  // Calendars to look in: this time's targets, plus the ones the last sync used (for moves).
  const calendars = new Map();
  SYNC_GROUPS.forEach(function (g) {
    const cal = targets[g.key].calendar;
    if (cal) calendars.set(cal.getId(), cal);
  });
  const last = loadLastCalendars_();
  SYNC_GROUPS.forEach(function (g) {
    const id = last[g.key];
    if (!id || calendars.has(id)) return;
    const cal = CalendarApp.getCalendarById(id);
    if (cal && cal.isOwnedByMe()) calendars.set(id, cal);
  });

  // Read each calendar once.
  const tagged = { classes: new Map(), events: new Map() }; // source ID -> [{ ev, calId }]
  const lookalikes = new Map(); // calendar ID -> Set of match keys of the teacher's own events
  const calendarNames = new Map();
  calendars.forEach(function (cal, calId) {
    calendarNames.set(calId, calendarLabel_(cal));
    const own = new Set();
    cal.getEvents(range.start, range.end).forEach(function (ev) {
      const classUid = ev.getTag(TAG_CLASSES);
      const eventUid = ev.getTag(TAG_EVENTS);
      if (classUid || eventUid) {
        const map = classUid ? tagged.classes : tagged.events;
        const uid = classUid || eventUid;
        if (!map.has(uid)) map.set(uid, []);
        map.get(uid).push({ ev: ev, calId: calId });
      } else if (!ev.isRecurringEvent()) {
        own.add(calendarMatchKey_(ev, tz));
      }
    });
    lookalikes.set(calId, own);
  });

  const groups = SYNC_GROUPS.map(function (g) {
    const target = targets[g.key];
    const targetId = target.calendar ? target.calendar.getId() : null;
    const own = (targetId && lookalikes.get(targetId)) || new Set();
    const plan = { group: g, target: target, adds: [], updates: [], unchanged: 0, alreadyThere: [], moves: [], removes: [] };

    wanted[g.key].forEach(function (item) {
      const found = tagged[g.key].get(item.uid) || [];
      const hereAt = found.findIndex(function (f) { return f.calId === targetId; });
      if (hereAt !== -1) {
        const here = found.splice(hereAt, 1)[0];
        if (here.ev.getTag(TAG_HASH) === item.hash) plan.unchanged++;
        else plan.updates.push({ item: item, found: here });
        return;
      }
      if (found.length) {
        plan.moves.push({ item: item, found: found.shift() });
        return;
      }
      if (own.has(item.matchKey)) plan.alreadyThere.push(item);
      else plan.adds.push(item);
    });
    // Whatever tagged events are left over (unpicked, gone from the school's calendar, or
    // duplicates) get removed.
    tagged[g.key].forEach(function (list) { list.forEach(function (f) { plan.removes.push(f); }); });
    return plan;
  });

  return { groups: groups, calendarNames: calendarNames };
}

// ---- What the teacher wants ----

/** Bell schedule events for the checked periods (with new names) and, if checked, all-day events. */
function classItems_(choices, tz) {
  const items = [];
  const seen = new Set();
  parseIcs_(fetchBellScheduleText_()).forEach(function (ev) {
    const day = ev.allDay ? ymdKey_(ev.start) : Utilities.formatDate(ev.start, tz, 'yyyy-MM-dd');
    // Hawaii dates, so an afternoon class the day before the start date can't slip in.
    if (day < choices.start || day > choices.end) return;

    let title = ev.title;
    if (ev.allDay) {
      if (!choices.allDay) return;
    } else {
      const cat = periodCategoryFor_(ev.title);
      const pick = cat && choices.periods[cat.id];
      if (!pick || !pick.keep) return;
      if (pick.rename) title = pick.rename;
    }
    let uid = ev.uid;
    if (seen.has(uid)) uid += '|' + day; // Never let two events share a tag.
    seen.add(uid);
    items.push(makeSyncItem_(uid, title, ev.location, ev.description, ev.allDay, ev.start, ev.end, tz));
  });
  return items;
}

/** Faculty calendar events whose titles the teacher checked. Skips the calendar if none are. */
function schoolEventItems_(choices, range, tz) {
  if (!choices.schoolEvents.length) return [];
  const picks = new Set(choices.schoolEvents);
  const ymdOf = function (date) {
    const p = Utilities.formatDate(date, tz, 'yyyy-MM-dd').split('-');
    return { y: +p[0], m: +p[1], d: +p[2] };
  };
  const items = [];
  facultyCalendar_().getEvents(range.start, range.end).forEach(function (ev) {
    const title = ev.getTitle() || '(no title)';
    if (!picks.has(baseTitle_(title).toLowerCase())) return;
    const allDay = ev.isAllDayEvent();
    const startDay = Utilities.formatDate(allDay ? ev.getAllDayStartDate() : ev.getStartTime(), tz, 'yyyy-MM-dd');
    if (startDay < choices.start || startDay > choices.end) return; // Started before the range.

    // Every date of a repeating event shares one ID, so add the start time to tell them apart.
    const uid = ev.isRecurringEvent() ? ev.getId() + '|' + ev.getStartTime().toISOString() : ev.getId();
    let start;
    let end;
    if (allDay) {
      start = ymdOf(ev.getAllDayStartDate());
      end = addDays_(ymdOf(ev.getAllDayEndDate()), -1); // Calendar's end is the day after.
      if (ymdKey_(end) < ymdKey_(start)) end = start;
    } else {
      start = ev.getStartTime();
      end = ev.getEndTime();
    }
    items.push(makeSyncItem_(uid, title, ev.getLocation(), ev.getDescription(), allDay, start, end, tz));
  });
  return items;
}

/**
 * The dates and fingerprint the sync needs (same approach as calendar-filter's toSyncItem_).
 * All-day start/end are { y, m, d } with an inclusive end; timed ones are Dates.
 */
function makeSyncItem_(uid, title, location, description, allDay, start, end, tz) {
  const item = { uid: uid, title: title, location: location || '', description: description || '', allDay: allDay };
  let startKey;
  let endKey;
  if (allDay) {
    startKey = ymdKey_(start);
    endKey = ymdKey_(end);
    item.singleDay = startKey >= endKey;
    // Plain dates in the script's time zone; Calendar uses only the date part.
    item.start = new Date(start.y, start.m - 1, start.d);
    item.end = item.singleDay ? item.start : new Date(end.y, end.m - 1, end.d + 1); // Exclusive end.
  } else {
    item.start = start;
    item.end = end < start ? start : end;
    startKey = item.start.toISOString();
    endKey = item.end.toISOString();
  }
  item.dayLabel = Utilities.formatDate(item.start, tz, 'EEE M/d');
  item.matchKey = baseTitle_(title).toLowerCase() + '|' + startKey;
  const fingerprint = JSON.stringify([item.title, item.location, item.description, allDay, startKey, endKey]);
  item.hash = Utilities.base64Encode(
    Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, fingerprint, Utilities.Charset.UTF_8));
  return item;
}

/** Same shape as an item's matchKey, for an event already in a calendar. */
function calendarMatchKey_(ev, tz) {
  const start = ev.isAllDayEvent()
    ? Utilities.formatDate(ev.getAllDayStartDate(), tz, 'yyyy-MM-dd')
    : ev.getStartTime().toISOString();
  return baseTitle_(ev.getTitle()).toLowerCase() + '|' + start;
}

// ---- Where it goes ----

/**
 * Turns a saved calendar choice into { calendar, label, willCreate }. calendar is null for a
 * new calendar that doesn't exist yet (step 5c creates it).
 */
function resolveTargetCalendar_(choice, groupLabel) {
  if (choice === 'primary') {
    return { calendar: CalendarApp.getDefaultCalendar(), label: 'your main calendar', willCreate: false };
  }
  if (choice.indexOf('new:') === 0) {
    const name = choice.slice(4);
    const owned = CalendarApp.getOwnedCalendarsByName(name)[0] || null;
    return { calendar: owned, label: name, willCreate: !owned };
  }
  const cal = CalendarApp.getCalendarById(choice);
  if (!cal || !cal.isOwnedByMe()) {
    throw new Error('The calendar chosen for "' + groupLabel + '" is no longer available. ' +
      'Pick another one in Option A and try again.');
  }
  return { calendar: cal, label: cal.getName(), willCreate: false };
}

function calendarLabel_(cal) {
  return cal.isMyPrimaryCalendar() ? 'your main calendar' : cal.getName();
}

/** { classes: calendarId, events: calendarId } from the last real sync, or {}. */
function loadLastCalendars_() {
  try {
    return JSON.parse(PropertiesService.getUserProperties().getProperty(LAST_CALENDARS_KEY) || '{}') || {};
  } catch (err) {
    Logger.log('Could not read the last-used calendars: ' + err.message);
    return {};
  }
}

// ---- For the page ----

/** Plain counts and a few examples per group (the page can't receive calendar objects). */
function planForPage_(plan) {
  const tz = Session.getScriptTimeZone();
  const itemLabel = function (item) { return item.title + ' (' + item.dayLabel + ')'; };
  const eventLabel = function (f) {
    const ev = f.ev;
    const when = ev.isAllDayEvent() ? ev.getAllDayStartDate() : ev.getStartTime();
    return ev.getTitle() + ' (' + Utilities.formatDate(when, tz, 'EEE M/d') + ')';
  };
  const examples = function (list, label) { return list.slice(0, PREVIEW_EXAMPLES).map(label); };

  return {
    groups: plan.groups.map(function (p) {
      const movedFrom = new Set(p.moves.map(function (m) { return plan.calendarNames.get(m.found.calId); }));
      return {
        label: p.group.label,
        calendar: p.target.label,
        willCreate: p.target.willCreate,
        add: p.adds.length,
        update: p.updates.length,
        unchanged: p.unchanged,
        alreadyThere: p.alreadyThere.length,
        move: p.moves.length,
        movedFrom: Array.from(movedFrom),
        remove: p.removes.length,
        examples: {
          add: examples(p.adds, itemLabel),
          update: examples(p.updates, function (u) { return itemLabel(u.item); }),
          alreadyThere: examples(p.alreadyThere, itemLabel),
          move: examples(p.moves, function (m) { return itemLabel(m.item); }),
          remove: examples(p.removes, eventLabel),
        },
      };
    }),
  };
}
