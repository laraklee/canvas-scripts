/**
 * BuildTest.js — builds a "Test" tab for a school year from the school's public calendars.
 * Purpose: a trial of replacing the PDF reading. For each school day it fills
 *   Q, Wk, Date, Day, Schedule (Lara's codes), Periods and *JSON* from the
 *   "Bell Schedule with Periods" calendar, suggests *Data Drills* notes (grey italic) from
 *   the day titles and the Faculty Calendar, and adds a Review column (days to check) and a
 *   column comparing each day with the existing year tab of the same name, if there is one.
 *   *AP Schedule* is left blank (it isn't in any feed).
 * Writes ONLY to the "Test" tab. The year tab, the reference tabs and *Config* are only read.
 * Canvas endpoints called: none.
 * Other web requests: the two calendars' public .ics links (GET only).
 * Write operations: clears and rewrites the "Test" tab in this spreadsheet.
 * Required Script Properties (calendar links, not secrets; set in Master Calendar › Setup…,
 *   the Setup side panel, SetupPanel.js): BELL_PERIODS_ICS_URL, FACULTY_ICS_URL.
 */

const TEST_TAB_ = 'Test';
const SCHED_PER_TAB_ = '*Data Sched-Per*';
const PROP_BELL_URL_ = 'BELL_PERIODS_ICS_URL';
const PROP_FACULTY_URL_ = 'FACULTY_ICS_URL';
const SCHOOL_UTC_OFFSET_HOURS_ = -10; // Hawaii: no daylight saving time.
const DATE_FORMAT_ = 'm" /"d"/ "yy'; // Same as the year tabs.
const SUGGESTION_COLOR_ = '#7f7f7f';
const REVIEW_FILL_ = '#fff2cc';

/**
 * Faculty Calendar events worth suggesting in *Data Drills*, based on what Lara writes there.
 * Each: pattern to match the event title, and the note to suggest (null = the cleaned title).
 */
const DRILL_PATTERNS_ = [
  { re: /open house/i, note: null },
  { re: /lip sync/i, note: 'Lip Sync' },
  { re: /cheerfest/i, note: 'Cheerfest' },
  { re: /end of (first|second|third|fourth) mid-quarter/i, note: 'MQ' },
  { re: /senior camp(?! color)/i, note: 'Senior Camp' },
  { re: /^class day$/i, note: 'Class Day' },
  { re: /psat testing/i, note: null },
  { re: /no homework/i, note: 'No Homework Weekend' },
  { re: /(christmas|easter) chapel/i, note: null },
  { re: /sac review/i, note: 'SAC Review Day' },
  { re: /(semester|final) exams/i, note: null },
  { re: /faculty pd|professional development/i, note: null },
  { re: /^may day$/i, note: 'May Day' },
  { re: /awards?\b(?! chapels)/i, note: null },
  { re: /honors day/i, note: null },
  { re: /graduation|commencement/i, note: null },
];
const NOT_UPPER_SCHOOL_ = /\(LS\)|\bLS\b|K-6|lower school|gr\. ?[1-6]\b/i;
const ORDINALS_ = { first: 1, second: 2, third: 3, fourth: 4 };
const KEEP_UPPER_ = ['US', 'LS', 'AP', 'PD', 'PSAT', 'SAC', 'JNHS', 'RL', 'RSJ', 'MQ'];

// ---------------------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------------------

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Master Calendar')
    .addItem('Setup…', 'showSetupPanel')
    .addItem('Build Test tab from calendars…', 'buildTestTab')
    .addToUi();
}

/** Menu: builds the Test tab for a school year. */
function buildTestTab() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  try {
    const props = PropertiesService.getScriptProperties();
    const bellUrl = props.getProperty(PROP_BELL_URL_);
    const facultyUrl = props.getProperty(PROP_FACULTY_URL_);
    if (!bellUrl || !facultyUrl) {
      ui.alert('First use Master Calendar › Setup… to add the two calendar links.');
      return;
    }

    const res = ui.prompt('Build Test tab',
      'School year to build, for example 2026.2027.\n\nOnly the "' + TEST_TAB_ + '" tab is changed. ' +
      'If a tab with this year\'s name exists, it is only read, to compare.',
      ui.ButtonSet.OK_CANCEL);
    if (res.getSelectedButton() !== ui.Button.OK) return;
    const year = res.getResponseText().trim();
    if (!/^\d{4}\.\d{4}$/.test(year) || Number(year.slice(5)) !== Number(year.slice(0, 4)) + 1) {
      ui.alert('Please type the year like 2026.2027.');
      return;
    }

    let testSheet = ss.getSheetByName(TEST_TAB_);
    if (testSheet && testSheet.getLastRow() > 0) {
      const ok = ui.alert('Replace the Test tab?',
        'The "' + TEST_TAB_ + '" tab already has data. Clear it and build ' + year + ' again?',
        ui.ButtonSet.YES_NO);
      if (ok !== ui.Button.YES) return;
    }

    ss.toast('Downloading the calendars…', 'Build Test tab', 30);
    const bellEvents = parseIcs_(fetchIcs_(bellUrl, 'Bell Schedule with Periods'));
    const facultyEvents = parseIcs_(fetchIcs_(facultyUrl, 'Faculty Calendar'));

    const schedPer = readSchedPer_(ss);
    const existing = readYearTab_(ss.getSheetByName(year));
    const result = buildYear_(bellEvents, facultyEvents, year, schedPer, existing);
    if (!result.rows.length) {
      ui.alert('The Bell Schedule calendar has no school days for ' + year + ' yet.');
      return;
    }

    if (!testSheet) testSheet = ss.insertSheet(TEST_TAB_, ss.getSheets().length);
    writeTestTab_(testSheet, result, year, existing !== null);
    ss.setActiveSheet(testSheet);

    const lines = [
      result.rows.length + ' school days written (' + result.firstKey + ' to ' + result.lastKey + ').',
      result.reviewCount + ' days to review (yellow, see the Review column).',
    ];
    if (existing) {
      lines.push(result.differCount + ' days differ from the ' + year + ' tab (last column).');
      if (result.onlyInExisting.length) {
        lines.push('In the ' + year + ' tab but not in the calendar: ' +
          result.onlyInExisting.slice(0, 8).join(', ') + (result.onlyInExisting.length > 8 ? '…' : '') + '.');
      }
    }
    lines.push('Grey italic notes in *Data Drills* are suggestions to check.' +
      (result.facultyFirstKey ? ' The Faculty Calendar only goes back to ' + result.facultyFirstKey +
        ', so there are no suggestions from it before then.' : ''));
    ui.alert('Test tab built', lines.join('\n\n'), ui.ButtonSet.OK);
  } catch (err) {
    console.error('buildTestTab failed: ' + err.message);
    ui.alert('Could not build the Test tab', err.message, ui.ButtonSet.OK);
  }
}

// ---------------------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------------------

/** Downloads a public .ics link, retrying when Google is busy. */
function fetchIcs_(url, label) {
  let code = 0;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    code = response.getResponseCode();
    if (code === 200) {
      const text = response.getContentText();
      if (!text.includes('BEGIN:VCALENDAR')) throw new Error('The ' + label + ' link did not return calendar data.');
      return text;
    }
    if (code !== 429 && code < 500) break;
    if (attempt < 3) Utilities.sleep(2000 * attempt);
  }
  throw new Error('Google returned error ' + code + ' for the ' + label + ' link. Try again in a minute, ' +
    'or use Test links in Master Calendar › Setup.');
}

/** *Data Sched-Per*: { code: periods string }. */
function readSchedPer_(ss) {
  const sheet = ss.getSheetByName(SCHED_PER_TAB_);
  const map = {};
  if (!sheet || sheet.getLastRow() < 2) return map;
  sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getDisplayValues().forEach(function (r) {
    if (r[0]) map[r[0].trim()] = r[1].trim();
  });
  return map;
}

/** The existing year tab, if any: { 'yyyy-mm-dd': { code, periods } }, or null. */
function readYearTab_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return null;
  const n = sheet.getLastRow() - 1;
  const dates = sheet.getRange(2, 3, n, 1).getValues();
  const codes = sheet.getRange(2, 5, n, 2).getDisplayValues();
  const map = {};
  dates.forEach(function (r, i) {
    const d = r[0];
    if (!(d instanceof Date)) return;
    const key = ymdKey_({ y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() });
    map[key] = { code: codes[i][0].trim(), periods: codes[i][1].trim() };
  });
  return map;
}

// ---------------------------------------------------------------------------------------
// Building (no spreadsheet calls, so it can be checked offline)
// ---------------------------------------------------------------------------------------

/**
 * Builds the rows for a school year.
 * Returns { rows, firstKey, lastKey, reviewCount, differCount, onlyInExisting, facultyFirstKey }.
 * Each row: { key, q, wk, code, periods, json, drills[], review[], differ }.
 */
function buildYear_(bellEvents, facultyEvents, year, schedPer, existing) {
  const y1 = Number(year.slice(0, 4));
  const fromKey = y1 + '-08-01';
  const toKey = (y1 + 1) + '-07-31';
  const days = collectBellDays_(bellEvents, fromKey, toKey);
  const faculty = collectFacultyNotes_(facultyEvents, fromKey, toKey);

  // Classify every weekday that has anything on the Bell Schedule calendar.
  const keys = Object.keys(days).filter(function (k) { return !isWeekend_(k); }).sort();
  keys.forEach(function (k) {
    days[k].kind = dayKind_(days[k]);
    // The Bell Schedule may say only "NO US CLASSES" on exam days; the Faculty Calendar says exams.
    const examNote = (faculty.notes[k] || []).some(function (n) { return /exams?\b/i.test(n); });
    if (days[k].kind === 'other' && examNote) days[k].kind = 'exam';
  });
  // A holiday next to a break belongs to the break (e.g. the Monday before Fall Break).
  let changed = true;
  while (changed) {
    changed = false;
    keys.forEach(function (k, i) {
      if (days[k].kind !== 'holiday') return;
      const near = [keys[i - 1], keys[i + 1]].filter(function (n) {
        return n && Math.abs(dayNumber_(n) - dayNumber_(k)) <= 3 && days[n].kind === 'break';
      });
      if (near.length) { days[k].kind = 'break'; changed = true; }
    });
  }
  const schoolKeys = keys.filter(function (k) { return days[k].kind === 'school' || days[k].kind === 'exam'; });
  if (!schoolKeys.length) return { rows: [], reviewCount: 0, differCount: 0, onlyInExisting: [] };
  const firstKey = schoolKeys[0];
  const lastKey = schoolKeys[schoolKeys.length - 1];

  const rows = [];
  let q = 0;
  let wk = 0;
  let prevKey = null;
  let examRun = 0;
  keys.forEach(function (k) {
    if (k < firstKey || k > lastKey || days[k].kind === 'break' || days[k].kind === 'empty') return;
    const day = days[k];
    if (!prevKey || dayNumber_(k) - dayNumber_(prevKey) > 7) { q++; wk = 1; }
    else if (weekNumber_(k) !== weekNumber_(prevKey)) wk++;
    examRun = day.kind === 'exam' && prevKey && days[prevKey].kind === 'exam' ? examRun + 1 : 1;
    prevKey = k;

    const review = [];
    const code = scheduleCode_(day, examRun, review);
    const periods = periodTokens_(day, code);
    const periodList = day.periods.map(function (p) { return { period: p.period, start: p.start, end: p.end }; });
    checkDay_(code, periods, periodList, schedPer, review);

    const drills = drillNotes_(day, k === firstKey).concat(faculty.notes[k] || []);
    const row = {
      key: k, q: q, wk: wk, code: code,
      // No timed events (holidays, PSAT, exams): use *Data Sched-Per* like the year tabs do.
      periods: periods || (code in schedPer ? schedPer[code] : '---'),
      json: JSON.stringify(periodList),
      drills: dedupe_(drills), review: review, differ: '',
    };
    if (existing) {
      const old = existing[k];
      if (!old) row.differ = 'not in the year tab';
      else {
        const parts = [];
        if (old.code !== row.code) parts.push('Schedule: ' + old.code);
        if (old.periods !== row.periods) parts.push('Periods: ' + old.periods);
        row.differ = parts.join(' · ');
      }
    }
    rows.push(row);
  });

  const built = {};
  rows.forEach(function (r) { built[r.key] = true; });
  const onlyInExisting = existing ? Object.keys(existing).filter(function (k) {
    return k >= fromKey && k <= toKey && !built[k];
  }).sort() : [];

  return {
    rows: rows, firstKey: firstKey, lastKey: lastKey,
    reviewCount: rows.filter(function (r) { return r.review.length; }).length,
    differCount: rows.filter(function (r) { return r.differ; }).length,
    onlyInExisting: onlyInExisting,
    facultyFirstKey: faculty.firstKey,
  };
}

/** Groups the Bell Schedule events by school-time date: { key: { titles[], periods[], other[] } }. */
function collectBellDays_(events, fromKey, toKey) {
  const days = {};
  const get = function (k) {
    if (!days[k]) days[k] = { titles: [], periods: [], other: [] };
    return days[k];
  };
  events.forEach(function (ev) {
    if (ev.allDay) {
      const k = ymdKey_(ev.start);
      if (k < fromKey || k > toKey) return;
      if (/\(LS\)|offices|campus closed/i.test(ev.title)) return;
      get(k).titles.push(ev.title.replace(/\s+/g, ' ').trim());
      return;
    }
    const start = schoolTime_(ev.start);
    if (start.key < fromKey || start.key > toKey) return;
    const end = schoolTime_(ev.end);
    const m = ev.title.match(/^p\w*d\s*(\d)\b/i); // "Period 3", also the feed's "Peiod 3"
    if (m) get(start.key).periods.push({ period: m[1], start: start.hhmm, end: end.hhmm });
    else get(start.key).other.push({ title: ev.title.replace(/\s+/g, ' ').trim(), start: start.hhmm });
  });
  Object.keys(days).forEach(function (k) {
    days[k].periods.sort(function (a, b) { return a.start - b.start; });
    days[k].other.sort(function (a, b) { return a.start - b.start; });
  });
  return days;
}

/** Faculty Calendar notes that match DRILL_PATTERNS_: { notes: { key: [note] }, firstKey }. */
function collectFacultyNotes_(events, fromKey, toKey) {
  const notes = {};
  let firstKey = null;
  events.forEach(function (ev) {
    const startKey = ev.allDay ? ymdKey_(ev.start) : schoolTime_(ev.start).key;
    if (!firstKey || startKey < firstKey) firstKey = startKey;
    const title = ev.title.replace(/\s*CHANGED:.*$/i, '').replace(/\s+/g, ' ').trim();
    if (NOT_UPPER_SCHOOL_.test(title)) return;
    const hit = DRILL_PATTERNS_.find(function (p) { return p.re.test(title); });
    if (!hit) return;
    let note = hit.note || titleCase_(title);
    if (hit.note === 'MQ') note = 'MQ' + ORDINALS_[title.match(hit.re)[1].toLowerCase()];
    const endKey = ev.allDay ? ymdKey_(ev.end) : startKey;
    for (let k = startKey; k <= endKey; k = nextKey_(k)) {
      if (k < fromKey || k > toKey) continue;
      (notes[k] = notes[k] || []).push(note);
    }
  });
  return { notes: notes, firstKey: firstKey };
}

/** 'school', 'exam', 'holiday', 'break', 'other' (no classes, not a holiday) or 'empty'. */
function dayKind_(day) {
  const all = day.titles.join(' | ');
  if (day.periods.length || /\bschedule\b/i.test(all)) return 'school';
  if (/exams?\b/i.test(all)) return 'exam';
  if (/break|merry christmas|happy new year/i.test(all)) return 'break';
  if (/holiday|holy day/i.test(all)) return 'holiday';
  if (all) return 'other';
  return 'empty';
}

/** Lara's schedule code for a day. Adds to review[] when the code is a guess. */
function scheduleCode_(day, examRun, review) {
  if (day.kind === 'exam') return 'EX' + examRun;
  if (day.kind === 'holiday') return 'H';
  const title = day.titles.find(function (t) { return /schedule/i.test(t); }) || day.titles[0] || '';
  const order = periodOrder_(title, day);
  let m = title.match(/^([A-F])(\d?)\s*schedule/i);
  if (m) {
    const letter = m[1].toUpperCase();
    const reversed = (letter === 'E' || letter === 'F') && /^(3,4|7,8)/.test(order);
    return letter + m[2] + (reversed ? 'r' : '');
  }
  if (/^chapel\b.*schedule/i.test(title)) return 'CH';
  if (/psat/i.test(title)) return 'PSAT';
  if (/fair day/i.test(title)) return 'SpFair';
  m = title.match(/^special\b/i);
  if (m) {
    // Special chapel days: E for periods 1–4, F for 5–8, like ESpA and FSpA.
    const letter = /^(1|3)/.test(order) ? 'E' : 'F';
    const code = letter + 'SpA' + (/^(3,4|7,8)/.test(order) ? 'r' : '');
    review.push('special schedule "' + title + '": code guessed');
    return code;
  }
  review.push('no schedule code for "' + (title || 'blank') + '"');
  return '?';
}

/** "1,2,3,4" style order from the title's parentheses, or from the period events. */
function periodOrder_(title, day) {
  const m = title.match(/\(\s*(\d(?:\s*,\s*\d)+)\s*,?\s*\)/);
  if (m) return m[1].replace(/\s/g, '');
  return day.periods.map(function (p) { return p.period; }).join(',');
}

/** The Periods column (e.g. "A,7,8,M/L,5,6") from the day's timed events. */
function periodTokens_(day, code) {
  const items = day.periods.map(function (p) { return { start: p.start, token: p.period }; });
  day.other.forEach(function (o) {
    const t = o.title.toLowerCase();
    let token = null;
    if (/^homeroom|^break$/.test(t)) token = null;
    else if (t === 'meeting/lunch') token = 'M/L';
    else if (t === 'lunch') token = 'L';
    else if (t === 'meeting') token = 'M';
    else if (/assembly/.test(t)) token = 'A';
    else if (/chapel\s*1\b/.test(t)) token = 'Ch-A';
    else if (/chapel\s*2\b/.test(t)) token = 'Ch-B';
    else if (/chapel/.test(t)) token = 'Ch';
    if (token) items.push({ start: o.start, token: token });
  });
  items.sort(function (a, b) { return a.start - b.start; });
  const tokens = [];
  items.forEach(function (it) {
    if (it.token === 'L' && tokens[tokens.length - 1] === 'M') tokens[tokens.length - 1] = 'M/L';
    else tokens.push(it.token);
  });
  if (code === 'CH' && tokens[0] !== 'Ch') tokens.unshift('Ch');
  return tokens.join(',');
}

/** Adds review notes: wrong number of periods, code or periods not matching *Data Sched-Per*. */
function checkDay_(code, periods, periodList, schedPer, review) {
  const need = /^[A-D]$/.test(code) ? 6 : /^[EF]\d?r?$/.test(code) ? 4 : code === 'CH' ? 8 : null;
  if (need !== null && periodList.length !== need) {
    review.push(periodList.length + ' periods in the calendar (expected ' + need + ')');
  }
  if (code === '?' || code === 'H' || /^EX\d/.test(code)) return;
  if (!(code in schedPer)) review.push('code ' + code + ' is not in ' + SCHED_PER_TAB_);
  else if (periods && schedPer[code] !== periods && schedPer[code] !== 'All') {
    review.push(SCHED_PER_TAB_ + ' says ' + schedPer[code]);
  }
}

/** Notes from the Bell Schedule's day titles: holidays, No Chapel, special schedules. */
function drillNotes_(day, isFirstDay) {
  const notes = [];
  if (isFirstDay) notes.push('First Day of School');
  day.titles.forEach(function (t) {
    if (/no chapel\)/i.test(t)) notes.push('No Chapel');
    if (/holiday|holy day/i.test(t)) {
      // "LABOR DAY SCHOOL HOLIDAY" → "Labor Day", but "HEAD OF SCHOOL HOLIDAY" stays whole.
      let name = t.replace(/\s*\(observed\)/i, '').trim();
      if (!/\bof school hol/i.test(name)) name = name.replace(/\s*school hol(iday|y day).*$/i, '').trim();
      notes.push(titleCase_(name || t));
    }
    if (/^special\b/i.test(t)) notes.push(t.replace(/\s*\([^)]*\)/g, '').trim());
    if (/psat/i.test(t)) notes.push('PSAT');
  });
  return notes;
}

// ---------------------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------------------

function writeTestTab_(sheet, result, year, compared) {
  sheet.clear();
  const header = ['Q', 'Wk', 'Date', 'Day', 'Schedule', 'Periods', '*Data Drills*', '*AP Schedule*',
    '*JSON* ', 'Review', compared ? 'Differs from ' + year : 'Compare'];
  const values = result.rows.map(function (r, i) {
    const p = r.key.split('-').map(Number);
    return [r.q, r.wk, new Date(p[0], p[1] - 1, p[2]), '=LEFT(TEXT(C' + (i + 2) + ', "ddd"), 2)',
      r.code, r.periods, r.drills.join('\n'), '', r.json, r.review.join('; '),
      compared ? r.differ : 'no ' + year + ' tab to compare'];
  });
  sheet.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
  const body = sheet.getRange(2, 1, values.length, header.length);
  body.setNumberFormat('@'); // Codes like "E1" and "1,2" stay text.
  sheet.getRange(2, 1, values.length, 2).setNumberFormat('0');
  sheet.getRange(2, 3, values.length, 1).setNumberFormat(DATE_FORMAT_);
  sheet.getRange(2, 4, values.length, 1).setNumberFormat('General');
  body.setValues(values);
  sheet.getRange(2, 7, values.length, 1).setFontColor(SUGGESTION_COLOR_).setFontStyle('italic');
  result.rows.forEach(function (r, i) {
    if (r.review.length) sheet.getRange(i + 2, 1, 1, header.length).setBackground(REVIEW_FILL_);
  });
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, values.length + 1, header.length).setVerticalAlignment('top');
  sheet.setColumnWidth(7, 220);
  sheet.setColumnWidth(9, 200);
  sheet.setColumnWidth(10, 260);
  sheet.setColumnWidth(11, 220);
}

// ---------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------

/** School-time date key and HHMM number (e.g. 815) for a Date. */
function schoolTime_(date) {
  const d = new Date(date.getTime() + SCHOOL_UTC_OFFSET_HOURS_ * 3600 * 1000);
  return {
    key: ymdKey_({ y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() }),
    hhmm: d.getUTCHours() * 100 + d.getUTCMinutes(),
  };
}

function keyToYmd_(key) {
  const p = key.split('-').map(Number);
  return { y: p[0], m: p[1], d: p[2] };
}

function nextKey_(key) { return ymdKey_(addDays_(keyToYmd_(key), 1)); }

/** Days since 1970-01-01, for counting gaps. */
function dayNumber_(key) {
  const p = keyToYmd_(key);
  return Math.round(Date.UTC(p.y, p.m - 1, p.d) / 86400000);
}

function dayOfWeek_(key) { return (dayNumber_(key) + 4) % 7; } // 1970-01-01 was a Thursday.

function isWeekend_(key) { const w = dayOfWeek_(key); return w === 0 || w === 6; }

/** Monday-based week number, for counting weeks. */
function weekNumber_(key) { return Math.floor((dayNumber_(key) + 3) / 7); }

/** "US FINAL EXAMS" → "US Final Exams". Leaves mixed-case text alone; short codes stay upper. */
function titleCase_(text) {
  if (text !== text.toUpperCase()) return text;
  return text.replace(/[A-Z][A-Z']*/g, function (word, at) {
    if (KEEP_UPPER_.indexOf(word) >= 0) return word;
    if (at > 0 && /^(OF|AND|THE|FOR)$/.test(word)) return word.toLowerCase();
    return word.charAt(0) + word.slice(1).toLowerCase();
  });
}

function dedupe_(list) {
  const seen = {};
  return list.filter(function (x) {
    const k = x.toLowerCase();
    if (seen[k]) return false;
    seen[k] = true;
    return true;
  });
}
