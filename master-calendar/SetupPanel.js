/**
 * SetupPanel.js — the "Setup" side panel (Lara, 2026-11-13: setup as a side panel, like
 *   the other projects). Replaces the old "Set calendar links…" prompts.
 *   - showSetupPanel (menu: Master Calendar › Setup…): opens SetupPanelPage.html.
 *   - getSetupStatus, testCalendarLinks, saveCalendarLinks: called by the panel
 *     (google.script.run). They return plain objects and never throw.
 *   The links are the calendars' public addresses (not secrets), kept in Script
 *   Properties so they stay out of this public code.
 * Canvas endpoints called: none.
 * Other web requests: Test links downloads the two .ics links (GET only).
 * Write operations: Script Properties BELL_PERIODS_ICS_URL and FACULTY_ICS_URL (Save).
 * Required Script Properties: the two above (this panel sets them).
 */

const SETUP_PANEL_TITLE_ = 'Setup';
/** The two links. A function, so it never depends on which file Apps Script loads first. */
function calendarLinks_() {
  return [
    { key: PROP_BELL_URL_, label: 'Bell Schedule with Periods' },
    { key: PROP_FACULTY_URL_, label: 'Faculty Calendar' },
  ];
}

/** Menu: Master Calendar › Setup…. Opens the panel on the right. */
function showSetupPanel() {
  const html = HtmlService.createHtmlOutputFromFile('SetupPanelPage').setTitle(SETUP_PANEL_TITLE_);
  SpreadsheetApp.getUi().showSidebar(html);
}

/** Called by the panel: { links: [{ key, label, url }] } ('' when not saved). */
function getSetupStatus() {
  try {
    const props = PropertiesService.getScriptProperties();
    return {
      ok: true,
      links: calendarLinks_().map(function (c) {
        return { key: c.key, label: c.label, url: props.getProperty(c.key) || '' };
      }),
    };
  } catch (err) {
    console.error('Setup panel: status failed: ' + err.message);
    return { ok: false, message: 'Could not read the saved links.' };
  }
}

/** True for an https link ending in .ics. */
function looksLikeIcsLink_(text) {
  return /^https:\/\/\S+\.ics$/i.test(text);
}

/**
 * Called by the panel: Save. form = { BELL_PERIODS_ICS_URL: '…', FACULTY_ICS_URL: '…' }.
 * A blank box keeps the saved link. Saves nothing if any link looks wrong.
 * Returns { ok, message }.
 */
function saveCalendarLinks(form) {
  try {
    const props = PropertiesService.getScriptProperties();
    const changes = {};
    const problems = [];
    calendarLinks_().forEach(function (c) {
      const text = String((form && form[c.key]) || '').trim();
      if (!text || text === props.getProperty(c.key)) return;
      if (looksLikeIcsLink_(text)) changes[c.key] = text;
      else problems.push(c.label);
    });
    if (problems.length) {
      return { ok: false, message: problems.join(' and ') + ': that doesn\'t look like a public .ics ' +
        'link (it should start with https:// and end in .ics). Nothing was saved.' };
    }
    const names = Object.keys(changes);
    if (!names.length) return { ok: true, message: 'No changes. Nothing was saved.' };
    props.setProperties(changes);
    console.log('Setup panel: saved ' + names.length + ' calendar link(s).');
    return { ok: true, message: 'Saved.' };
  } catch (err) {
    console.error('Setup panel: save failed: ' + err.message);
    return { ok: false, message: 'Could not save the links. Nothing was changed.' };
  }
}

/**
 * Called by the panel: Test links. Downloads each saved calendar and returns
 * { results: [{ label, ok, message }] }, e.g. "3,119 events, 10/2/2024 to 6/3/2027".
 */
function testCalendarLinks() {
  const props = PropertiesService.getScriptProperties();
  return {
    results: calendarLinks_().map(function (c) {
      const url = props.getProperty(c.key);
      if (!url) return { label: c.label, ok: false, message: 'not saved yet.' };
      try {
        const events = parseIcs_(fetchIcs_(url, c.label));
        if (!events.length) return { label: c.label, ok: false, message: 'reached, but it has no events.' };
        const keys = events.map(function (ev) {
          return ev.allDay ? ymdKey_(ev.start) : schoolTime_(ev.start).key;
        }).sort();
        return { label: c.label, ok: true, message: events.length.toLocaleString('en-US') + ' events, ' +
          shortDate_(keys[0]) + ' to ' + shortDate_(keys[keys.length - 1]) + '.' };
      } catch (err) {
        console.error('Setup panel: test failed for one link: ' + err.message);
        return { label: c.label, ok: false, message: err.message };
      }
    }),
  };
}

/** '2026-08-10' → '8/10/2026'. */
function shortDate_(key) {
  const p = keyToYmd_(key);
  return p.m + '/' + p.d + '/' + p.y;
}
