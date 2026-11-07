/**
 * Code.js
 * School Calendar Filter: pulls the school's faculty calendar into this Sheet, lets each
 * teacher keep or hide events, and syncs the kept events to a Google Calendar of their own.
 *
 * This file: the menu, tab setup, and reading the settings on the Start Here tab.
 * Other files: Feed.js (download and parse the ICS feed), Events.js (the Events and
 * Hide Rules tabs), Sync.js (writes to Google Calendar, nightly trigger).
 *
 * Endpoints: the public ICS feed URL on the Start Here tab (read-only).
 * Write calls: Google Calendar only, in Sync.js, and only when "Preview only" is unchecked.
 * Script Properties: none. All settings live on the Start Here tab of each copy of the Sheet.
 */

const DEFAULT_FEED_URL =
  'https://calendar.google.com/calendar/ical/acg4tehdnkv29rfpasrt7eo1kb81qv0l%40import.calendar.google.com/public/basic.ics';
const DEFAULT_CALENDAR_NAME = 'Faculty Calendar (filtered)';

const SHEET_START = 'Start Here';
const SHEET_RULES = 'Hide Rules';
const SHEET_EVENTS = 'Events';

const SETTING_FEED = 'Copy FROM: school calendar (public ICS link)';
const SETTING_CALENDAR = 'Copy TO: my Google Calendar (name or Calendar ID)';
const SETTING_AFTER = 'Only events on or after (optional)';
const SETTING_BEFORE = 'Only events on or before (optional)';
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
  if (!ss.getSheetByName(SHEET_START)) buildStartTab_(ss);

  if (!ss.getSheetByName(SHEET_RULES)) {
    const rules = ss.insertSheet(SHEET_RULES);
    rules.getRange(1, 1, 1, 2).setValues([['Hide events whose title contains', 'Notes (optional)']])
      .setFontWeight('bold');
    rules.setColumnWidth(1, 300);
    rules.setColumnWidth(2, 300);
    rules.setFrozenRows(1);
  }

  if (!ss.getSheetByName(SHEET_EVENTS)) ss.insertSheet(SHEET_EVENTS);
}

/** The first tab: settings (yellow boxes) at the top, instructions underneath. */
function buildStartTab_(ss) {
  const sheet = ss.insertSheet(SHEET_START, 0);
  sheet.getRange('A1').setValue('School Calendar Filter').setFontWeight('bold').setFontSize(16);
  sheet.getRange('A2').setValue('Fill in the yellow boxes, then use the School Calendar menu at the top of the screen.')
    .setFontStyle('italic');

  const settings = [
    [SETTING_FEED, DEFAULT_FEED_URL,
      'Already filled in with the faculty calendar. To use a different one, paste its public .ics link (Google Calendar > Settings > the calendar > Integrate calendar > "Public address in iCal format").'],
    [SETTING_CALENDAR, DEFAULT_CALENDAR_NAME,
      'Type a name and the sheet creates that calendar for you (recommended). Or paste the Calendar ID of a calendar you already have (Google Calendar > Settings > the calendar > Integrate calendar > Calendar ID).'],
    [SETTING_AFTER, '', 'Leave blank to include everything in the feed.'],
    [SETTING_BEFORE, '', 'Leave blank to include everything in the feed.'],
    [SETTING_PREVIEW, true, 'While checked, Sync only reports what it would do. Uncheck it when the preview looks right.'],
  ];
  const first = 4;
  sheet.getRange(first, 1, settings.length, 3).setValues(settings);
  sheet.getRange(first, 1, settings.length, 1).setFontWeight('bold');
  sheet.getRange(first, 2, settings.length, 1).setBackground('#fff2cc')
    .setBorder(true, true, true, true, true, true, '#bbbbbb', SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(first, 3, settings.length, 1).setFontColor('#666666').setFontStyle('italic');
  sheet.getRange(first + 2, 2, 2, 1).setNumberFormat('m/d/yyyy');
  sheet.getRange(first + 4, 2).insertCheckboxes();

  const steps = [
    ['How to use'],
    ['First time: File > Make a copy, then use the School Calendar menu in your copy. Google will ask for permission the first time.'],
    ['1. School Calendar > Refresh events. This downloads the school calendar into the Events tab.'],
    ['2. Uncheck "Keep" for events you do not want. Do not delete rows: a refresh would bring them back.'],
    ['    Faster: add words to the Hide Rules tab (for example "Athletics"), then School Calendar > Apply hide rules.'],
    ['3. School Calendar > Sync kept events. With "Preview only" checked, this only reports what it would do.'],
    [''],
    ['Refreshing again keeps your checkmarks. New events start checked unless a hide rule matches them.'],
    ['Syncing again updates changed events and removes ones you unchecked or the school cancelled.'],
    ['Sync only changes events it created. Anything you add to that calendar yourself is left alone.'],
    ['Optional: "Turn on nightly refresh + sync" keeps your calendar up to date automatically.'],
  ];
  const stepsRow = first + settings.length + 2;
  sheet.getRange(stepsRow, 1, steps.length, 1).setValues(steps);
  sheet.getRange(stepsRow, 1).setFontWeight('bold').setFontSize(12);

  sheet.setColumnWidth(1, 360);
  sheet.setColumnWidth(2, 420);
  sheet.setColumnWidth(3, 460);
  sheet.getRange(first, 2, settings.length, 2).setWrap(true).setVerticalAlignment('top');
  sheet.getRange(first, 1, settings.length, 1).setVerticalAlignment('top');
  ss.setActiveSheet(sheet);
}

/** Reads the Start Here settings into an object, creating tabs first if this is a fresh copy. */
function readSettings_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(SHEET_START)) setupTabs();
  const values = ss.getSheetByName(SHEET_START).getRange('A1:B20').getValues();
  const byLabel = new Map(values.map(function (r) { return [String(r[0]).trim(), r[1]]; }));

  const preview = byLabel.get(SETTING_PREVIEW);
  return {
    feedUrl: String(byLabel.get(SETTING_FEED) || DEFAULT_FEED_URL).trim(),
    calendar: String(byLabel.get(SETTING_CALENDAR) || DEFAULT_CALENDAR_NAME).trim(),
    after: byLabel.get(SETTING_AFTER) instanceof Date ? byLabel.get(SETTING_AFTER) : null,
    before: byLabel.get(SETTING_BEFORE) instanceof Date ? byLabel.get(SETTING_BEFORE) : null,
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
