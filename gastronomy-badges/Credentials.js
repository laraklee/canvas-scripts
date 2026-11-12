/**
 * Credentials.js
 * Purpose: where this sheet keeps each teacher's Canvas address and token (Lara,
 *   2026-11-12, modelled on course-manager-jupiter's Credentials.js). Both live in the
 *   teacher's own User Properties, where other editors of the script cannot read them.
 *   - getCanvasToken_ / getCanvasBaseUrl_: what the tools use. The first time either
 *     runs for a teacher, it moves an old setup over by itself (Lara, 2026-11-12), so
 *     nobody re-enters anything: a token saved under the old name CANVAS_API_KEY moves
 *     to CANVAS_TOKEN (the old one is deleted), and if no address is saved yet, the
 *     school's address in *Config* B2 is saved as theirs.
 *   - saveCanvasCredentialsFromPanel: the Setup panel's Save button (SetupPanel.js).
 *   The token is never logged or put in a message, and never shown except its last 4
 *   characters, to its owner only, in the Setup panel (tokenHint_), with the date it was
 *   saved.
 * Canvas endpoints called: none.
 * Canvas write operations: none.
 * Required User/Script Properties: reads and writes User Properties CANVAS_BASE_URL,
 *   CANVAS_TOKEN, and CANVAS_TOKEN_SAVED (when the token was saved); reads and deletes
 *   the old CANVAS_API_KEY. Reads *Config* B2 (the school's Canvas address).
 */

const PROP_TOKEN = 'CANVAS_TOKEN';
const PROP_BASE_URL = 'CANVAS_BASE_URL';
// When the token was last saved (ISO date and time), so the Setup panel can show it next
// to the token's last 4 characters. Not secret.
const PROP_TOKEN_SAVED = 'CANVAS_TOKEN_SAVED';
// The name the token was saved under before 2026-11-12 ("1. Set API Key and Base URL").
const OLD_PROP_TOKEN = 'CANVAS_API_KEY';
const CONFIG_SHEET = '*Config*';
// *Config* B2: the school's Canvas address. Kept in the sheet so it never goes into
// this public code. Only used to fill in a teacher's address when none is saved.
const CONFIG_BASE_URL_CELL = 'B2';

/** This teacher's Canvas token, or '' if none is saved. Never log or show it. */
function getCanvasToken_() {
  const props = PropertiesService.getUserProperties();
  moveOldSetup_(props);
  return props.getProperty(PROP_TOKEN) || '';
}

/** This teacher's Canvas address ("https://host"), or '' if none is saved. */
function getCanvasBaseUrl_() {
  const props = PropertiesService.getUserProperties();
  moveOldSetup_(props);
  return props.getProperty(PROP_BASE_URL) || '';
}

/**
 * Moves an old setup over (see the header). Does nothing once it has run. Never throws:
 * if it can't run, the tools say what's missing and point to Setup….
 */
function moveOldSetup_(props) {
  try {
    if (!props.getProperty(PROP_TOKEN)) {
      const oldToken = props.getProperty(OLD_PROP_TOKEN);
      if (oldToken) {
        props.setProperty(PROP_TOKEN, oldToken.trim());
        props.deleteProperty(OLD_PROP_TOKEN);
        console.log('Canvas setup: old token property moved to CANVAS_TOKEN.');
      }
    }
    if (!props.getProperty(PROP_BASE_URL)) {
      const address = readConfigBaseUrl_();
      if (address) {
        props.setProperty(PROP_BASE_URL, address);
        console.log('Canvas setup: address saved from *Config* B2.');
      }
    }
  } catch (error) {
    console.error('Canvas setup: moving the old setup failed: ' + error.message);
  }
}

/**
 * The Canvas address in *Config* B2, as "https://host", or '' if the tab or cell is
 * missing, blank, or not a web address.
 */
function readConfigBaseUrl_() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG_SHEET);
    const text = sheet ? String(sheet.getRange(CONFIG_BASE_URL_CELL).getValue()).trim() : '';
    return text ? normalizeBaseUrl_(text) : '';
  } catch {
    return '';
  }
}

/**
 * Called by the Setup panel's Save button (google.script.run, so no trailing underscore)
 * with { baseUrl, token } as typed. A blank box keeps what is saved. Returns
 * { ok, message }; the message never contains the token or what was typed, and the token
 * is never sent back. Never throws.
 */
function saveCanvasCredentialsFromPanel(form) {
  try {
    const props = PropertiesService.getUserProperties();
    moveOldSetup_(props);
    const urlText = String((form && form.baseUrl) || '').trim();
    const token = String((form && form.token) || '').trim();
    const baseUrl = urlText ? normalizeBaseUrl_(urlText) : props.getProperty(PROP_BASE_URL);
    if (!baseUrl) return { ok: false, message: 'Enter your Canvas address. Nothing was saved.' };
    if (!token && !props.getProperty(PROP_TOKEN)) {
      return { ok: false, message: 'Paste your Canvas token. Nothing was saved.' };
    }
    if (/\s/.test(token)) {
      return { ok: false, message: 'That token contains spaces or line breaks. Nothing was ' +
        'saved. Copy it again and retry.' };
    }
    props.setProperty(PROP_BASE_URL, baseUrl);
    if (token) {
      props.setProperty(PROP_TOKEN, token);
      props.setProperty(PROP_TOKEN_SAVED, new Date().toISOString());
    }
    console.log('Canvas setup (panel): address saved' + (token ? ', token saved.' : '.'));
    return { ok: true, message: 'Saved for your Google account only. Token: ' +
      (token ? 'saved.' : 'unchanged.') };
  } catch (error) {
    // normalizeBaseUrl_'s message never repeats what was typed.
    console.error('Canvas setup (panel) failed.');
    return { ok: false, message: 'Not saved. ' + error.message };
  }
}

/**
 * What the Setup panel may show about this teacher's saved token: { hint, savedAt }.
 * hint is the last 4 characters ('' if none is saved, or if the token is too short for 4
 * characters to be a small part of it); savedAt the ISO time it was saved ('' if it was
 * saved before 2026-11-12, when this started being recorded). Never the token itself.
 */
function tokenHint_(props) {
  const token = props.getProperty(PROP_TOKEN) || '';
  return {
    hint: token.length >= 20 ? token.slice(-4) : '',
    savedAt: token ? props.getProperty(PROP_TOKEN_SAVED) || '' : '',
  };
}

/**
 * Turns what was typed into "https://host" with no path and no trailing slash.
 * The error message never repeats the input, in case a token was pasted by mistake.
 */
function normalizeBaseUrl_(text) {
  const withoutScheme = String(text).trim().replace(/^https?:\/\//i, '');
  const host = withoutScheme.split(/[/?#:]/)[0].toLowerCase();
  const looksLikeHost = /^[a-z0-9.-]+$/.test(host) && host.includes('.') &&
    !host.startsWith('.') && !host.endsWith('.') && !host.includes('..');
  if (!looksLikeHost) {
    throw new Error('That does not look like a web address. Copy the start of your Canvas address bar and try again.');
  }
  return 'https://' + host;
}

/** The message the tools show when the address or token is missing. */
function missingSetupMessage_() {
  return 'Canvas isn\'t set up for you yet. Open Canvas Tools › Setup… and save your ' +
    'Canvas address and token.';
}
