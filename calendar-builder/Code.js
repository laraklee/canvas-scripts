/**
 * Code.js
 * Faculty Calendar Builder (pilot): serves the web page and reads the school bell schedule.
 * Started from a colleague's "Faculty Custom Calendar Builder" (see BRIEF.md). The page works
 * as his did (pick periods, rename them, download a one-time .ics file), plus a School Events
 * list from the faculty calendar (SchoolEvents.js), saved choices and calendar menus
 * (Settings.js), and period rules shared by the page and server (Periods.js).
 *
 * Endpoints: the bell schedule's public ICS link (read-only GET, built from BELL_SCHEDULE_ID).
 * Write calls: none.
 * Script Properties: BELL_SCHEDULE_ID (the bell schedule's Google Calendar ID; not a secret,
 *   but kept out of the code because this repo is public).
 * Caches: the schedule's "last revised" time, for 6 hours (Script Cache).
 */

// Update by hand whenever the tool changes; shown at the top of the page.
const SYSTEM_REVISION_DATE = '11/11/2026'; // Step 5a: saved choices, calendar menus.

const CACHE_KEY_REVISED = 'master_schedule_hst_v2';
const CACHE_SECONDS = 21600; // 6 hours

/** Serves the web app page. */
function doGet() {
  const template = HtmlService.createTemplateFromFile('Page');
  template.systemRevisionDate = SYSTEM_REVISION_DATE;
  template.scheduleLastRevised = getMasterScheduleRevisedDateHST();
  template.periodCategoriesJson = jsonForPage_(PERIOD_CATEGORIES);
  template.choicesJson = jsonForPage_(loadChoices_());
  template.calendarOptionsJson = jsonForPage_(calendarOptions_());

  return template.evaluate()
    .setTitle('Faculty Custom Calendar Builder')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Finds the newest LAST-MODIFIED time in the bell schedule (or CREATED, if there are none),
 * shows it in Hawaii time, and caches it for 6 hours.
 */
function getMasterScheduleRevisedDateHST() {
  const cache = CacheService.getScriptCache();
  const cachedDate = cache.get(CACHE_KEY_REVISED);
  if (cachedDate) return cachedDate;

  try {
    const text = fetchBellScheduleText_();
    // LAST-MODIFIED only: DTSTAMP is the export time, so it is always "now".
    const latest = latestStamp_(text, LAST_MODIFIED_RE) || latestStamp_(text, CREATED_RE);
    if (latest) {
      const hst = Utilities.formatDate(latest, 'Pacific/Honolulu', 'MM/dd/yyyy hh:mm a') + ' HST';
      cache.put(CACHE_KEY_REVISED, hst, CACHE_SECONDS);
      return hst;
    }
  } catch (err) {
    Logger.log('Could not read the bell schedule revised date: ' + err.message);
  }
  return 'Unavailable';
}

/** Called from the page: returns the bell schedule as ICS text. */
function fetchDefaultCalendar() {
  return fetchBellScheduleText_();
}

/** Downloads the bell schedule's public ICS feed. Throws a readable error on failure. */
function fetchBellScheduleText_() {
  const response = UrlFetchApp.fetch(bellScheduleUrl_(), {
    muteHttpExceptions: true,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GoogleAppsScriptCalendarProxy)' }
  });

  const code = response.getResponseCode();
  if (code !== 200) {
    throw new Error('Google returned HTTP error ' + code + ' for the bell schedule. Try again in a minute.');
  }

  const content = response.getContentText();
  if (!content.includes('BEGIN:VCALENDAR')) {
    throw new Error('The bell schedule feed did not contain calendar (.ics) data.');
  }
  return content;
}

/** Builds the bell schedule's public ICS link from the BELL_SCHEDULE_ID Script Property. */
function bellScheduleUrl_() {
  const id = (PropertiesService.getScriptProperties().getProperty('BELL_SCHEDULE_ID') || '').trim();
  if (!id) {
    throw new Error('The bell schedule is not set up yet (Script Property BELL_SCHEDULE_ID is missing).');
  }
  return 'https://calendar.google.com/calendar/ical/' + encodeURIComponent(id) + '/public/basic.ics';
}

// Values look like 20261104T193000Z (time optional).
const LAST_MODIFIED_RE = /^LAST-MODIFIED:([0-9TZ]+)/gm;
const CREATED_RE = /^CREATED:([0-9TZ]+)/gm;

/** Returns the newest UTC timestamp matched by regex (LAST_MODIFIED_RE or CREATED_RE), or null. */
function latestStamp_(text, regex) {
  regex.lastIndex = 0;
  let latest = null;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const v = match[1];
    if (v.length < 8) continue;
    const part = function (from, to) { return Number(v.slice(from, to)) || 0; };
    const date = new Date(Date.UTC(part(0, 4), part(4, 6) - 1, part(6, 8), part(9, 11), part(11, 13), part(13, 15)));
    if (!latest || date > latest) latest = date;
  }
  return latest;
}
