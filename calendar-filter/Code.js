/**
 * Code.js
 * School Calendar Filter: pulls the school's faculty calendar into this Sheet, lets each
 * teacher keep or hide events, and syncs the kept events to a Google Calendar of their own.
 *
 * This file: the menu, tab setup, and reading the settings on the Start Here tab.
 * Other files: Feed.js (read the school calendar), Events.js (the Events and Hide Rules
 * tabs), Sync.js (writes to Google Calendar, nightly trigger).
 *
 * Endpoints: Google Calendar (read), or a public ICS link if one is entered (read-only).
 * Write calls: Google Calendar only, in Sync.js, and only when "Preview only" is unchecked.
 * Script Properties: none. All settings live on the Start Here tab of each copy of the Sheet.
 */

const DEFAULT_SOURCE = 'acg4tehdnkv29rfpasrt7eo1kb81qv0l@import.calendar.google.com';
// The first version of Start Here defaulted to the ICS link; "Set up / repair tabs" swaps it for the ID.
const OLD_DEFAULT_FEED_URL =
  'https://calendar.google.com/calendar/ical/acg4tehdnkv29rfpasrt7eo1kb81qv0l%40import.calendar.google.com/public/basic.ics';
const DEFAULT_CALENDAR_NAME = 'Faculty Calendar (filtered)';

const SHEET_START = 'Start Here';
const SHEET_RULES = 'Hide Rules';
const SHEET_EVENTS = 'Events';

const SETTING_SOURCE = 'Copy FROM: school calendar (Calendar ID or ICS link)';
const SETTING_CALENDAR = 'Copy TO: my Google Calendar (name or Calendar ID)';
const SETTING_AFTER = 'Only events on or after (optional)';
const SETTING_BEFORE = 'Only events on or before (optional)';
const SETTING_PREVIEW = 'Preview only (no calendar changes)';
const SETTINGS_FIRST_ROW = 4; // Settings fill rows 4-8, in the order above.

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

/**
 * Creates missing tabs and redraws Start Here with the latest labels and instructions,
 * keeping whatever was typed in its yellow boxes. Never touches rules or events.
 */
function setupTabs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  buildStartTab_(ss);

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
  let sheet = ss.getSheetByName(SHEET_START);
  let saved = [DEFAULT_SOURCE, DEFAULT_CALENDAR_NAME, '', '', true];
  if (sheet) {
    if (String(sheet.getRange(SETTINGS_FIRST_ROW, 1).getValue()).indexOf('Copy FROM') === 0) {
      saved = sheet.getRange(SETTINGS_FIRST_ROW, 2, saved.length, 1).getValues().map(function (r) { return r[0]; });
      if (saved[0] === OLD_DEFAULT_FEED_URL || !saved[0]) saved[0] = DEFAULT_SOURCE;
    }
    sheet.clear();
    sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).clearDataValidations();
  } else {
    sheet = ss.insertSheet(SHEET_START, 0);
  }

  sheet.getRange('A1').setValue('School Calendar Filter').setFontWeight('bold').setFontSize(16);
  sheet.getRange('A2').setValue('Fill in the yellow boxes, then use the School Calendar menu at the top of the screen.')
    .setFontStyle('italic');

  const settings = [
    [SETTING_SOURCE, saved[0],
      'Already filled in with the Faculty Calendar. You must have it in your Google Calendar first (see "Before you start" below). ' +
      'You can also paste any calendar\'s ID, or a public .ics link.'],
    [SETTING_CALENDAR, saved[1],
      'Type a name and the sheet creates that calendar for you (recommended). Or paste the Calendar ID of a calendar you already have ' +
      '(Google Calendar > Settings > the calendar > Integrate calendar > Calendar ID).'],
    [SETTING_AFTER, saved[2], 'Leave blank to include everything.'],
    [SETTING_BEFORE, saved[3], 'Leave blank to include everything.'],
    [SETTING_PREVIEW, saved[4] !== false, 'While checked, Sync only reports what it would do. Uncheck it when the preview looks right.'],
  ];
  const first = SETTINGS_FIRST_ROW;
  sheet.getRange(first, 1, settings.length, 3).setValues(settings);
  sheet.getRange(first, 1, settings.length, 1).setFontWeight('bold');
  sheet.getRange(first, 2, settings.length, 1).setBackground('#fff2cc')
    .setBorder(true, true, true, true, true, true, '#bbbbbb', SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(first, 3, settings.length, 1).setFontColor('#666666').setFontStyle('italic');
  sheet.getRange(first + 2, 2, 2, 1).setNumberFormat('m/d/yyyy');
  sheet.getRange(first + 4, 2).insertCheckboxes();

  const steps = [
    ['Before you start'],
    ['• Add the Faculty Calendar to your Google Calendar, if it is not already listed under "Other calendars":'],
    ['    open calendar.google.com > next to "Other calendars" on the left, click + > Subscribe to calendar >'],
    ['    paste the ID from the "Copy FROM" box above > press Enter. It then appears under "Other calendars".'],
    ['• The school calendar only keeps about one month of past events. Set this up early in the year (August is ideal).'],
    ['    Events already synced to your calendar stay there, even after they drop off the school calendar.'],
    ['• Using your own copy: File > Make a copy, then use the School Calendar menu in your copy. Google asks for permission the first time.'],
    [''],
    ['How to use'],
    ['1. School Calendar > Refresh events. This copies the school calendar into the Events tab.'],
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
  [0, 8].forEach(function (i) { sheet.getRange(stepsRow + i, 1).setFontWeight('bold').setFontSize(12); });

  sheet.setColumnWidth(1, 360);
  sheet.setColumnWidth(2, 420);
  sheet.setColumnWidth(3, 460);
  sheet.getRange(first, 2, settings.length, 2).setWrap(true).setVerticalAlignment('top');
  sheet.getRange(first, 1, settings.length, 1).setVerticalAlignment('top');
  ss.setActiveSheet(sheet);
  ss.moveActiveSheet(1);
}

/** Reads the Start Here settings into an object, creating tabs first if this is a fresh copy. */
function readSettings_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(SHEET_START)) setupTabs();
  const values = ss.getSheetByName(SHEET_START).getRange('A1:B20').getValues();
  const byLabel = new Map(values.map(function (r) { return [String(r[0]).trim(), r[1]]; }));

  // Tabs drawn by an older version have different labels; fall back to the row position.
  const valueAt = function (label, index) {
    if (byLabel.has(label)) return byLabel.get(label);
    return values[SETTINGS_FIRST_ROW - 1 + index][1];
  };
  let source = String(valueAt(SETTING_SOURCE, 0) || DEFAULT_SOURCE).trim();
  if (source === OLD_DEFAULT_FEED_URL) source = DEFAULT_SOURCE;
  const after = valueAt(SETTING_AFTER, 2);
  const before = valueAt(SETTING_BEFORE, 3);
  return {
    source: source,
    calendar: String(valueAt(SETTING_CALENDAR, 1) || DEFAULT_CALENDAR_NAME).trim(),
    after: after instanceof Date ? after : null,
    before: before instanceof Date ? before : null,
    // Anything other than an unchecked box counts as preview, so a missing row is safe.
    preview: valueAt(SETTING_PREVIEW, 4) !== false,
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
