/**
 * Code.js
 * Faculty Calendar Builder (pilot): serves the web page and reads the school bell schedule.
 * Started from a colleague's "Faculty Custom Calendar Builder" (see BRIEF.md). The page works
 * as his did (pick periods, rename them, download a one-time .ics file), plus a School Events
 * list from the faculty calendar (SchoolEvents.js), saved choices and calendar menus
 * (Settings.js), period rules shared by the page and server (Periods.js), and the preview of
 * "Add to my Google Calendar" (Sync.js, using the ICS parser in Ics.js).
 *
 * Endpoints: the bell schedule's public ICS link (read-only GET, built from BELL_SCHEDULE_ID).
 * Write calls: none in this file. Calendar writes are only in Sync.js (after a confirmed preview).
 * Permission: full Google Calendar access (appsscript.json), needed to create the teacher's
 *   calendars and events; Sync.js only ever changes or deletes events this app tagged.
 * Script Properties: BELL_SCHEDULE_ID (the bell schedule's Google Calendar ID; not a secret,
 *   but kept out of the code because this repo is public).
 * Caches (Script Cache, shared by all teachers): the schedule's "last revised" time, for 6
 *   hours, and the downloaded schedule itself (fresh for 1 hour, kept up to 6 as a fallback),
 *   because Google limits ICS downloads from Apps Script (HTTP 429).
 */

// Update by hand whenever the tool changes; shown at the top of the page.
const SYSTEM_REVISION_DATE = '11/11/2026'; // Step 5c: Confirm writes to Google Calendar.

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
    const text = fetchBellScheduleText_(true);
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

// ---- Bell schedule download, shared by everyone ----
// Google limits how often Apps Script may download a calendar's ICS link (HTTP 429), and that
// limit is not per teacher. So one downloaded copy is shared through the Script Cache:
// - under an hour old: everyone uses it, with no download at all;
// - older (up to 6 hours, the cache's maximum): download a fresh copy, but if Google says
//   no, use the older copy rather than fail.
// A script-wide lock means that when many teachers arrive at once, one downloads and the
// rest wait a few seconds and use that copy.

const ICS_CACHE_PREFIX = 'bell_ics_v1';
const ICS_FRESH_MS = 60 * 60 * 1000; // 1 hour
const ICS_KEEP_SECONDS = 21600; // 6 hours, the longest the cache keeps anything
const ICS_CHUNK_CHARS = 30000; // Cache values max out at 100 KB; 30,000 characters is safe.
const ICS_FETCH_ATTEMPTS = 4;
const ICS_LOCK_WAIT_MS = 30000;

/**
 * Returns the bell schedule as ICS text, from the shared copy when possible.
 * quick (used while the page loads): never waits for the lock and tries the download only
 * once, so a busy morning can't hold up the page.
 */
function fetchBellScheduleText_(quick) {
  const cache = CacheService.getScriptCache();
  let copy = readCachedIcs_(cache);
  if (copy && copy.fresh) return copy.text;

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(quick ? 0 : ICS_LOCK_WAIT_MS)) {
    // Someone else has been downloading for a while. Use whatever copy exists.
    copy = readCachedIcs_(cache);
    if (copy) return copy.text;
    throw new Error('The bell schedule is busy loading for other teachers. Try again in a minute.');
  }
  try {
    copy = readCachedIcs_(cache); // Another teacher may have just downloaded it.
    if (copy && copy.fresh) return copy.text;
    try {
      const text = downloadBellSchedule_(quick ? 1 : ICS_FETCH_ATTEMPTS);
      writeCachedIcs_(cache, text);
      return text;
    } catch (err) {
      if (copy) {
        Logger.log('Bell schedule download failed; using the copy from earlier. ' + err.message);
        return copy.text;
      }
      throw err;
    }
  } finally {
    lock.releaseLock();
  }
}

/** Downloads the bell schedule's public ICS feed, retrying when Google is busy. */
function downloadBellSchedule_(attempts) {
  let code = 0;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const response = UrlFetchApp.fetch(bellScheduleUrl_(), {
      muteHttpExceptions: true,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GoogleAppsScriptCalendarProxy)' }
    });
    code = response.getResponseCode();
    if (code === 200) {
      const content = response.getContentText();
      if (!content.includes('BEGIN:VCALENDAR')) {
        throw new Error('The bell schedule feed did not contain calendar (.ics) data.');
      }
      return content;
    }
    // 429 = too many requests, 5xx = server trouble: both are worth waiting out (2, 4, 8 s).
    if (code !== 429 && code < 500) break;
    if (attempt < attempts) Utilities.sleep(2000 * Math.pow(2, attempt - 1));
  }
  if (code === 429) {
    throw new Error('Google is limiting downloads of the bell schedule right now. Try again in a few minutes.');
  }
  throw new Error('Google returned HTTP error ' + code + ' for the bell schedule. Try again in a minute.');
}

/**
 * Reads the shared copy: returns { text, fresh } or null. The copy is stored in pieces under
 * a random batch ID, so pieces from two different downloads can never be mixed.
 */
function readCachedIcs_(cache) {
  const metaJson = cache.get(ICS_CACHE_PREFIX + ':meta');
  if (!metaJson) return null;
  let meta;
  try { meta = JSON.parse(metaJson); } catch { return null; }
  const keys = [];
  for (let i = 0; i < meta.pieces; i++) keys.push(ICS_CACHE_PREFIX + ':' + meta.batch + ':' + i);
  const found = cache.getAll(keys);
  if (keys.some(function (k) { return typeof found[k] !== 'string'; })) return null; // A piece expired.
  return {
    text: keys.map(function (k) { return found[k]; }).join(''),
    fresh: Date.now() - meta.savedAt < ICS_FRESH_MS,
  };
}

function writeCachedIcs_(cache, text) {
  const batch = Utilities.getUuid().slice(0, 8);
  const values = {};
  let pieces = 0;
  for (let at = 0; at < text.length; at += ICS_CHUNK_CHARS) {
    values[ICS_CACHE_PREFIX + ':' + batch + ':' + pieces] = text.slice(at, at + ICS_CHUNK_CHARS);
    pieces++;
  }
  try {
    cache.putAll(values, ICS_KEEP_SECONDS);
    // The pieces go in first, so a reader never finds a batch ID whose pieces aren't there yet.
    cache.put(ICS_CACHE_PREFIX + ':meta',
      JSON.stringify({ batch: batch, pieces: pieces, savedAt: Date.now() }), ICS_KEEP_SECONDS);
  } catch (err) {
    // Too big for the cache, or the cache is unavailable: carry on without it.
    Logger.log('Could not save the shared bell schedule copy: ' + err.message);
  }
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
