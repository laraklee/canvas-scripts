/**
 * Sync.js
 * "Add to my Google Calendar". previewSync() works out what WOULD change in the teacher's
 * chosen calendars; confirmSync() makes those changes, in rounds that fit Apps Script's
 * 6-minute limit (the page keeps calling it until it says it's finished). Each round plans
 * afresh, so a cut-off round never leaves anything half-done or doubled.
 * previewRemoveAll() / confirmRemoveAll() take out every event the app has added.
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
 * Endpoints: Google Calendar (the teacher's chosen calendars; the faculty calendar, read-only),
 *   and the bell schedule's ICS link through fetchBellScheduleText_() in Code.js.
 * Write calls (Google Calendar, only after the teacher confirms a preview, and only through the
 *   helpers in "Calendar writes" below):
 *   - create a calendar: only "My Classes" / "School Events", only if the teacher has none by
 *     that name; calendars are never deleted;
 *   - create an event: tagged, with reminders turned off (decided 11/11, so a main calendar's
 *     default pop-up doesn't fire for every class);
 *   - delete an event: deleteAppEvent_() refuses any event without this app's tag.
 * User Properties: BUILDER_CHOICES (saved before planning), BUILDER_LAST_CALENDARS (every
 *   calendar the app may have events in, per group, so events can be moved and removed).
 */

const TAG_CLASSES = 'builderClassUid';
const TAG_EVENTS = 'builderEventUid';
const TAG_HASH = 'builderHash';
const LAST_CALENDARS_KEY = 'BUILDER_LAST_CALENDARS';
const PREVIEW_EXAMPLES = 5;
const ROUND_LIMIT_MS = 60 * 1000; // Short rounds so the page can show progress often (Apps Script
// stops a run at 6 minutes; each round re-plans first, which takes a few seconds).
const PAUSE_BETWEEN_WRITES_MS = 150; // Google Calendar rejects bursts of rapid changes.
const REMOVE_ALL_YEARS_BACK = 2;
const REMOVE_ALL_YEARS_AHEAD = 3;

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
 * Called from the page after a preview: makes the changes, for about a minute per call.
 * Returns { finished, done: { added, moved, updated, removed }, left, paused }.
 * paused means Google asked for a slower pace; the page waits, then calls again.
 */
function confirmSync(choices) {
  const deadline = Date.now() + ROUND_LIMIT_MS;
  const lock = LockService.getUserLock();
  if (!lock.tryLock(10000)) {
    throw new Error('Your calendar is already being updated (maybe in another tab). Wait for it to finish.');
  }
  try {
    const saved = saveChoices(choices);
    const plan = buildSyncPlan_(saved, true);

    // Remember every calendar the app puts events in BEFORE writing, and never forget one:
    // events outside today's date range may still be in an old calendar, and "Remove
    // everything this app added" needs to find them. (Usually just one or two calendars.)
    const last = plan.last;
    plan.groups.forEach(function (p) {
      if (p.target.calendar) addCalendarId_(last, p.group.key, p.target.calendar.getId());
    });
    saveLastCalendars_(last);

    return applyPlan_(plan, deadline);
  } finally {
    lock.releaseLock();
  }
}

/** Makes the planned changes in a safe order until done or out of time. */
function applyPlan_(plan, deadline) {
  const done = { added: 0, moved: 0, updated: 0, removed: 0 };
  const steps = [];
  plan.groups.forEach(function (p) {
    const cal = p.target.calendar;
    const tag = p.group.tag;
    p.removes.forEach(function (f) { steps.push(function () { deleteAppEvent_(f.ev); done.removed++; }); });
    p.updates.forEach(function (u) {
      steps.push(function () { deleteAppEvent_(u.found.ev); createAppEvent_(cal, u.item, tag); done.updated++; });
    });
    p.moves.forEach(function (m) {
      steps.push(function () { deleteAppEvent_(m.found.ev); createAppEvent_(cal, m.item, tag); done.moved++; });
    });
    p.adds.forEach(function (item) { steps.push(function () { createAppEvent_(cal, item, tag); done.added++; }); });
  });

  let next = 0;
  let paused = false;
  while (next < steps.length && Date.now() < deadline) {
    try {
      steps[next]();
    } catch (err) {
      if (!isRateLimitError_(err)) throw err;
      Logger.log('Google asked for a slower pace after ' + next + ' changes.');
      paused = true;
      break;
    }
    next++;
    Utilities.sleep(PAUSE_BETWEEN_WRITES_MS);
  }
  return { finished: next === steps.length, done: done, left: steps.length - next, paused: paused };
}

/**
 * Works out every change, per group. Returns
 *   { groups: [{ group, target, adds, updates, unchanged, alreadyThere, moves, removes }],
 *     calendarNames: Map(id -> name), last }
 * where adds/alreadyThere hold items, updates/moves hold { item, found }, and removes hold
 * found events ({ ev, calId }). With createMissing, new calendars are created first.
 */
function buildSyncPlan_(choices, createMissing) {
  const tz = Session.getScriptTimeZone();
  const range = dateRange_(choices.start, choices.end, tz);
  const wanted = {
    classes: classItems_(choices, tz),
    events: schoolEventItems_(choices, range, tz),
  };

  const last = loadLastCalendars_();
  const created = new Map(); // Name -> calendar created this run (both groups may pick one).
  const targets = {};
  SYNC_GROUPS.forEach(function (g) {
    // Only create a new calendar for a group that has events to put in it.
    const create = createMissing && wanted[g.key].length > 0;
    targets[g.key] = resolveTargetCalendar_(choices[g.choice], g.label, last, create, created);
  });

  // Calendars to look in: this time's targets, plus every calendar the app may have used.
  const calendars = new Map();
  SYNC_GROUPS.forEach(function (g) {
    const cal = targets[g.key].calendar;
    if (cal) calendars.set(cal.getId(), cal);
  });
  allLastCalendarIds_(last).forEach(function (id) {
    if (calendars.has(id)) return;
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

  return { groups: groups, calendarNames: calendarNames, last: last };
}

// ---- What the teacher wants ----

/**
 * Bell schedule events for the checked periods (with new names) and, if checked, all-day events.
 * icsText: a teacher's own .ics file (used by the .ics download only); otherwise the official
 * bell schedule. "Add to my Google Calendar" always uses the official one.
 */
function classItems_(choices, tz, icsText) {
  const items = [];
  const seen = new Set();
  parseIcs_(icsText || fetchBellScheduleText_()).forEach(function (ev) {
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
 * Turns a saved calendar choice into { calendar, label, willCreate }. For a new calendar that
 * doesn't exist yet, calendar is null, unless createMissing, which creates it.
 * A calendar the app created before is found through `last` first: Google can take a moment
 * to list a brand-new calendar by name, and looking only by name could create a second one.
 */
function resolveTargetCalendar_(choice, groupLabel, last, createMissing, created) {
  if (choice === 'primary') {
    return { calendar: CalendarApp.getDefaultCalendar(), label: 'your main calendar', willCreate: false };
  }
  if (choice.indexOf('new:') === 0) {
    const name = choice.slice(4);
    let owned = created.get(name) || null;
    allLastCalendarIds_(last).forEach(function (id) {
      if (owned) return;
      const cal = CalendarApp.getCalendarById(id);
      if (cal && cal.isOwnedByMe() && cal.getName() === name) owned = cal;
    });
    if (!owned) owned = CalendarApp.getOwnedCalendarsByName(name)[0] || null;
    if (!owned && createMissing) {
      owned = createAppCalendar_(name);
      created.set(name, owned);
    }
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

/** { classes: [calendarId, ...], events: [...] }: every calendar the app may have used. */
function loadLastCalendars_() {
  let raw = {};
  try {
    raw = JSON.parse(PropertiesService.getUserProperties().getProperty(LAST_CALENDARS_KEY) || '{}') || {};
  } catch (err) {
    Logger.log('Could not read the last-used calendars: ' + err.message);
  }
  const out = {};
  SYNC_GROUPS.forEach(function (g) {
    const v = raw[g.key];
    out[g.key] = Array.isArray(v) ? v.filter(function (id) { return typeof id === 'string'; })
      : (typeof v === 'string' ? [v] : []);
  });
  return out;
}

function saveLastCalendars_(last) {
  PropertiesService.getUserProperties().setProperty(LAST_CALENDARS_KEY, JSON.stringify(last));
}

function addCalendarId_(last, groupKey, id) {
  if (!last[groupKey]) last[groupKey] = [];
  if (last[groupKey].indexOf(id) === -1) last[groupKey].push(id);
}

function allLastCalendarIds_(last) {
  const ids = new Set();
  SYNC_GROUPS.forEach(function (g) { (last[g.key] || []).forEach(function (id) { ids.add(id); }); });
  return Array.from(ids);
}

// ---- Remove everything this app added ----

/** Called from the page: how many app events each calendar holds. Read-only. */
function previewRemoveAll() {
  const found = findAllAppEvents_();
  return {
    total: found.events.length,
    calendars: Array.from(found.perCalendar.entries()).map(function (e) { return { calendar: e[0], count: e[1] }; }),
  };
}

/** Called from the page after that preview: deletes them, in rounds like confirmSync. */
function confirmRemoveAll() {
  const deadline = Date.now() + ROUND_LIMIT_MS;
  const lock = LockService.getUserLock();
  if (!lock.tryLock(10000)) {
    throw new Error('Your calendar is already being updated (maybe in another tab). Wait for it to finish.');
  }
  try {
    const events = findAllAppEvents_().events;
    let removed = 0;
    let paused = false;
    while (removed < events.length && Date.now() < deadline) {
      try {
        deleteAppEvent_(events[removed]);
      } catch (err) {
        if (!isRateLimitError_(err)) throw err;
        paused = true;
        break;
      }
      removed++;
      Utilities.sleep(PAUSE_BETWEEN_WRITES_MS);
    }
    return { finished: removed === events.length, done: { removed: removed }, left: events.length - removed, paused: paused };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Every tagged event, at any date from 2 years back to 3 years ahead, in every calendar the
 * app may have used plus the currently chosen ones. Returns { events, perCalendar: Map(name -> count) }.
 */
function findAllAppEvents_() {
  const ids = new Set(allLastCalendarIds_(loadLastCalendars_()));
  const choices = loadChoices_();
  const empty = {};
  SYNC_GROUPS.forEach(function (g) {
    try {
      const t = resolveTargetCalendar_(choices[g.choice], g.label, empty, false, new Map());
      if (t.calendar) ids.add(t.calendar.getId());
    } catch (err) {
      Logger.log('Skipping an unavailable calendar choice: ' + err.message);
    }
  });

  const now = new Date();
  const start = new Date(now.getFullYear() - REMOVE_ALL_YEARS_BACK, 0, 1);
  const end = new Date(now.getFullYear() + REMOVE_ALL_YEARS_AHEAD, 11, 31);
  const events = [];
  const perCalendar = new Map();
  ids.forEach(function (id) {
    const cal = CalendarApp.getCalendarById(id);
    if (!cal || !cal.isOwnedByMe()) return;
    const mine = cal.getEvents(start, end).filter(isAppEvent_);
    if (!mine.length) return;
    mine.forEach(function (ev) { events.push(ev); });
    perCalendar.set(calendarLabel_(cal), (perCalendar.get(calendarLabel_(cal)) || 0) + mine.length);
  });
  return { events: events, perCalendar: perCalendar };
}

// ---- Calendar writes (the only functions that change a calendar) ----

function createAppCalendar_(name) {
  const cal = CalendarApp.createCalendar(name);
  cal.setTimeZone(Session.getScriptTimeZone());
  return cal;
}

/** Adds one event, tagged so the app can recognize it later, with reminders turned off. */
function createAppEvent_(calendar, item, tag) {
  const options = { location: item.location, description: item.description };
  let ev;
  if (!item.allDay) ev = calendar.createEvent(item.title, item.start, item.end, options);
  else if (item.singleDay) ev = calendar.createAllDayEvent(item.title, item.start, options);
  else ev = calendar.createAllDayEvent(item.title, item.start, item.end, options);
  ev.setTag(tag, item.uid);
  ev.setTag(TAG_HASH, item.hash);
  ev.removeAllReminders();
}

/** Deletes one event, but only if this app added it. Anything else is refused. */
function deleteAppEvent_(ev) {
  if (!isAppEvent_(ev)) throw new Error('Refused to delete an event this app did not add.');
  ev.deleteEvent();
}

function isAppEvent_(ev) {
  return Boolean(ev.getTag(TAG_CLASSES) || ev.getTag(TAG_EVENTS));
}

/** Google's "slow down" errors, which are worth waiting out rather than failing. */
function isRateLimitError_(err) {
  return /too many|rate limit|quota|try again later/i.test(String(err && err.message));
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
        willCreate: p.target.willCreate && p.adds.length > 0, // Only created if it gets events.
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
