/**
 * Code.js
 * School Calendar Filter: pulls the school's faculty calendar into this Sheet, lets each
 * teacher keep or hide events, and syncs the kept events to a Google Calendar of their own.
 *
 * This file: the menu, tab setup, and reading the Settings tab.
 * Other files: Feed.js (download and parse the ICS feed), Events.js (the Events and
 * Hide Rules tabs), Sync.js (writes to Google Calendar, nightly trigger).
 *
 * Endpoints: the public ICS feed URL in Settings (read-only).
 * Write calls: Google Calendar only, in Sync.js, and only when "Preview only" is unchecked.
 * Script Properties: none. All settings live in the Settings tab of each copy of the Sheet.
 */

const DEFAULT_FEED_URL =
  'https://calendar.google.com/calendar/ical/acg4tehdnkv29rfpasrt7eo1kb81qv0l%40import.calendar.google.com/public/basic.ics';
const DEFAULT_CALENDAR_NAME = 'Faculty Calendar (filtered)';

const SHEET_SETTINGS = 'Settings';
const SHEET_RULES = 'Hide Rules';
const SHEET_EVENTS = 'Events';
const SHEET_INSTRUCTIONS = 'Instructions';

const SETTING_FEED = 'School calendar feed (ICS URL)';
const SETTING_AFTER = 'Only events on or after (optional)';
const SETTING_BEFORE = 'Only events on or before (optional)';
const SETTING_CALENDAR = 'My Google Calendar name';
const SETTING_PREVIEW = 'Preview only (no calendar changes)';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('School Calendar')
    .addItem('1. Refresh events from school calendar', 'refreshEvents')
    .addItem('2. Apply hide rules', 'applyHideRules')
    .addItem('3. Sync kept events to my calendar', 'syncToCalendar')
    .addSeparator()
    .addItem('Turn on nightly refresh + sync', 'turnOnNightlySync')
    .addItem('Turn off nightly refresh + sync', 'turnOffNightlySync')
    .addSeparator()
    .addItem('Set up / repair tabs', 'setupTabs')
    .addToUi();
}

/** Creates any missing tabs. Never overwrites settings or rules that already exist. */
function setupTabs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let settings = ss.getSheetByName(SHEET_SETTINGS);
  if (!settings) {
    settings = ss.insertSheet(SHEET_SETTINGS);
    settings.getRange(1, 1, 6, 2).setValues([
      ['Setting', 'Value'],
      [SETTING_FEED, DEFAULT_FEED_URL],
      [SETTING_AFTER, ''],
      [SETTING_BEFORE, ''],
      [SETTING_CALENDAR, DEFAULT_CALENDAR_NAME],
      [SETTING_PREVIEW, true],
    ]);
    settings.getRange('B6').insertCheckboxes();
    settings.getRange('B3:B4').setNumberFormat('m/d/yyyy');
    settings.getRange('A1:B1').setFontWeight('bold');
    settings.setColumnWidth(1, 280);
    settings.setColumnWidth(2, 420);
    settings.setFrozenRows(1);
  }

  let rules = ss.getSheetByName(SHEET_RULES);
  if (!rules) {
    rules = ss.insertSheet(SHEET_RULES);
    rules.getRange(1, 1, 1, 2).setValues([['Hide events whose title contains', 'Notes (optional)']])
      .setFontWeight('bold');
    rules.setColumnWidth(1, 300);
    rules.setColumnWidth(2, 300);
    rules.setFrozenRows(1);
  }

  writeInstructions_(ss);
  if (!ss.getSheetByName(SHEET_EVENTS)) ss.insertSheet(SHEET_EVENTS);
}

function writeInstructions_(ss) {
  const sheet = ss.getSheetByName(SHEET_INSTRUCTIONS) || ss.insertSheet(SHEET_INSTRUCTIONS, 0);
  sheet.clear();
  const rows = [
    ['How to use this sheet'],
    [''],
    ['First time: File > Make a copy, then open the School Calendar menu in your copy. Google will ask for permission the first time.'],
    ['1. School Calendar > Refresh events. This downloads the faculty calendar into the Events tab.'],
    ['2. Uncheck "Keep" for events you do not want. Do not delete rows: a refresh would bring them back.'],
    ['   Faster: add words to the Hide Rules tab (for example "Athletics"), then School Calendar > Apply hide rules.'],
    ['3. School Calendar > Sync kept events. With "Preview only" checked in Settings, this only reports what it would do.'],
    ['   Uncheck "Preview only" to really sync. Events go into the calendar named in Settings (created if missing).'],
    [''],
    ['Refreshing again keeps your checkmarks. New events start checked unless a hide rule matches them.'],
    ['Syncing again updates changed events and removes ones you unchecked or the school cancelled.'],
    ['Sync only changes events it created. Anything you add to that calendar yourself is left alone.'],
    ['Optional: "Turn on nightly refresh + sync" keeps your calendar up to date automatically.'],
  ];
  sheet.getRange(1, 1, rows.length, 1).setValues(rows);
  sheet.getRange('A1').setFontWeight('bold').setFontSize(14);
  sheet.setColumnWidth(1, 900);
}

/** Reads the Settings tab into an object, creating tabs first if this is a fresh copy. */
function readSettings_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(SHEET_SETTINGS)) setupTabs();
  const values = ss.getSheetByName(SHEET_SETTINGS).getDataRange().getValues();
  const byLabel = new Map(values.map(function (r) { return [String(r[0]).trim(), r[1]]; }));

  const preview = byLabel.get(SETTING_PREVIEW);
  return {
    feedUrl: String(byLabel.get(SETTING_FEED) || DEFAULT_FEED_URL).trim(),
    after: byLabel.get(SETTING_AFTER) instanceof Date ? byLabel.get(SETTING_AFTER) : null,
    before: byLabel.get(SETTING_BEFORE) instanceof Date ? byLabel.get(SETTING_BEFORE) : null,
    calendarName: String(byLabel.get(SETTING_CALENDAR) || DEFAULT_CALENDAR_NAME).trim(),
    // Anything other than an unchecked box counts as preview, so a missing row is safe.
    preview: preview !== false,
  };
}

/** Shows a message in a dialog when someone is looking, or just logs it (nightly trigger). */
function notify_(message) {
  Logger.log(message);
  try {
    SpreadsheetApp.getUi().alert(message);
  } catch {
    // No UI when running from a trigger.
  }
}
