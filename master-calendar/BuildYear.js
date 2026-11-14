/**
 * BuildYear.js — makes a new year tab (e.g. "2027.2028") from the school's public calendars
 *   (Lara, 2026-11-13: build the year tab directly; the Test tab stays as a preview).
 * Same columns as the year tabs, A–I only (the assign-sheets import A:M, so no extra
 *   columns). Q, Wk, Date, Schedule and the *Data Drills* suggestions (grey italic) come
 *   from the calendars; Day, Periods and *JSON* are the year tabs' usual formulas, so a day
 *   fixed later needs only its Schedule code changed. Days to check are yellow, with the
 *   reason in a note on the Schedule cell.
 * Never overwrites: stops if a tab with the year's name already exists.
 * Canvas endpoints called: none.
 * Other web requests: the two calendars' public .ics links (GET only, via BuildTest.js).
 * Write operations: inserts one new tab named for the year in this spreadsheet.
 * Required Script Properties: BELL_PERIODS_ICS_URL, FACULTY_ICS_URL (Master Calendar › Setup…).
 */

const SCHEDULE_TAB_ = '*schedule*';

/** Menu: Master Calendar › Build year tab from calendars…. */
function buildYearTab() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  try {
    const urls = calendarUrls_(ui);
    if (!urls) return;
    const year = askYear_(ui, 'Build year tab',
      'A new tab with this name is made. If the tab already exists, nothing is changed.');
    if (!year) return;
    if (ss.getSheetByName(year)) {
      ui.alert('The ' + year + ' tab already exists, so nothing was changed. To compare it with the ' +
        'calendars, use Master Calendar › Preview a year (Test tab)….');
      return;
    }

    ss.toast('Downloading the calendars…', 'Build year tab', 30);
    const bellEvents = parseIcs_(fetchIcs_(urls.bell, 'Bell Schedule with Periods'));
    const facultyEvents = parseIcs_(fetchIcs_(urls.faculty, 'Faculty Calendar'));
    const schedPer = readSchedPer_(ss);
    const result = buildYear_(bellEvents, facultyEvents, year, schedPer, null);
    if (!result.rows.length) {
      ui.alert('The Bell Schedule calendar has no school days for ' + year + ' yet.');
      return;
    }
    const rows = yearTabRows_(result.rows, schedPer, readScheduleCodes_(ss));

    // Put it just before the newest year tab, where the year tabs are kept.
    const yearTabs = ss.getSheets().filter(function (s) { return /^\d{4}\.\d{4}$/.test(s.getName()); });
    const at = yearTabs.length ? Math.min.apply(null, yearTabs.map(function (s) { return s.getIndex() - 1; }))
      : ss.getSheets().length;
    const sheet = ss.insertSheet(year, at);
    writeYearTab_(sheet, rows);
    ss.setActiveSheet(sheet);

    const toReview = rows.filter(function (r) { return r.review; }).length;
    ui.alert(year + ' tab built', [
      rows.length + ' school days (' + result.firstKey + ' to ' + result.lastKey + ').',
      toReview + ' days to review: yellow, with the reason in a note on the Schedule cell.',
      'Grey italic notes in *Data Drills* are suggestions to check. Add AP exams in *AP Schedule*.',
      'To fix a day, change its Schedule code; Periods and *JSON* follow.',
    ].join('\n\n'), ui.ButtonSet.OK);
  } catch (err) {
    console.error('buildYearTab failed: ' + err.message);
    ui.alert('Could not build the year tab', err.message, ui.ButtonSet.OK);
  }
}

/** Codes listed in *schedule* (column A), which GET_SCHEDULE_JSON needs for the times. */
function readScheduleCodes_(ss) {
  const sheet = ss.getSheetByName(SCHEDULE_TAB_);
  const codes = {};
  if (!sheet || sheet.getLastRow() < 2) return codes;
  sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues().forEach(function (r) {
    if (r[0].trim()) codes[r[0].trim()] = true;
  });
  return codes;
}

/**
 * The year tab's rows (no spreadsheet calls, so it can be checked offline):
 * [{ key, q, wk, code, drills, review }]. Adds a review reason when the code has class
 * periods in *Data Sched-Per* but no times in *schedule* (the *JSON* would be empty).
 */
function yearTabRows_(built, schedPer, scheduleCodes) {
  return built.map(function (r) {
    const review = r.review.slice();
    if (/\d/.test(schedPer[r.code] || '') && !scheduleCodes[r.code]) {
      review.push('code ' + r.code + ' has no times in ' + SCHEDULE_TAB_);
    }
    return { key: r.key, q: r.q, wk: r.wk, code: r.code, drills: r.drills, review: review.join('; ') };
  });
}

function writeYearTab_(sheet, rows) {
  const header = ['Q', 'Wk', 'Date', 'Day', 'Schedule', 'Periods', '*Data Drills*', '*AP Schedule*', '*JSON* '];
  const values = rows.map(function (r, i) {
    const n = i + 2;
    const p = r.key.split('-').map(Number);
    return [r.q, r.wk, new Date(p[0], p[1] - 1, p[2]), '=LEFT(TEXT(C' + n + ', "ddd"), 2)', r.code,
      '=IFERROR(VLOOKUP(E' + n + ', \'' + SCHED_PER_TAB_ + '\'!A:B, 2, FALSE), "---")',
      r.drills.join('\n'), '',
      // One formula in I2 fills the whole column, as in the year tabs.
      i === 0 ? '=GET_SCHEDULE_JSON(E2:E, F2:F, \'' + SCHEDULE_TAB_ + '\'!A:D)' : ''];
  });
  sheet.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
  const body = sheet.getRange(2, 1, values.length, header.length);
  body.setNumberFormat('@'); // Codes like "E1" stay text.
  sheet.getRange(2, 1, values.length, 2).setNumberFormat('0');
  sheet.getRange(2, 3, values.length, 1).setNumberFormat(DATE_FORMAT_);
  [4, 6, 9].forEach(function (c) { sheet.getRange(2, c, values.length, 1).setNumberFormat('General'); });
  body.setValues(values);
  sheet.getRange(2, 7, values.length, 1).setFontColor(SUGGESTION_COLOR_).setFontStyle('italic');
  rows.forEach(function (r, i) {
    if (!r.review) return;
    sheet.getRange(i + 2, 1, 1, header.length).setBackground(REVIEW_FILL_);
    sheet.getRange(i + 2, 5).setNote('Check: ' + r.review);
  });
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, values.length + 1, header.length).setVerticalAlignment('top');
  sheet.setColumnWidth(7, 220);
  sheet.setColumnWidth(9, 200);
}
