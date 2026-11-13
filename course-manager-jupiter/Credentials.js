/**
 * Credentials.js
 * Purpose: the "Set Canvas token" menu item. Prompts for the Canvas web address and
 *   access token and saves them in this user's User Properties, where other editors of
 *   the script cannot read them. The token is never logged or put in a message, and
 *   never shown except its last 4 characters, to its owner only, in the Setup panel
 *   (tokenHint_; Lara, 2026-11-11), with the date it was saved.
 *   saveCanvasCredentialsFromPanel does the same as the prompts for the Setup panel's
 *   Save button (SetupPanel.js, 2026-11-11).
 * Canvas endpoints called: none.
 * Canvas write operations: none.
 * Required User/Script Properties: writes User Properties CANVAS_BASE_URL, CANVAS_TOKEN,
 *   and CANVAS_TOKEN_SAVED (when the token was saved).
 */

const PROP_TOKEN = 'CANVAS_TOKEN';
const PROP_BASE_URL = 'CANVAS_BASE_URL';
// When the token was last saved (ISO date and time), so the Setup panel can show it
// next to the token's last 4 characters (Lara, 2026-11-11). Not secret.
const PROP_TOKEN_SAVED = 'CANVAS_TOKEN_SAVED';

/**
 * Set Canvas token (no longer on the menu since 2026-11-12; Setup… saves the token).
 * Asks for the Canvas address, then the token. Saves nothing unless both steps finish.
 */
function setCanvasCredentials() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getUserProperties();
  try {
    const savedUrl = props.getProperty(PROP_BASE_URL);
    const urlResponse = ui.prompt('Canvas setup (1 of 2)',
      'Enter your school\'s Canvas web address: the start of the address bar when ' +
      'you are logged in to Canvas.' +
      (savedUrl ? '\n\nCurrently saved: ' + savedUrl + '\nLeave blank to keep it.' : ''),
      ui.ButtonSet.OK_CANCEL);
    if (urlResponse.getSelectedButton() !== ui.Button.OK) return;
    const urlText = urlResponse.getResponseText().trim();
    const baseUrl = urlText ? normalizeBaseUrl_(urlText) : savedUrl;
    if (!baseUrl) {
      ui.alert('No Canvas address was entered. Nothing was saved.');
      return;
    }

    const hasToken = Boolean(props.getProperty(PROP_TOKEN));
    const tokenResponse = ui.prompt('Canvas setup (2 of 2)',
      'Paste your Canvas access token (in Canvas: Account > Settings > New Access Token).' +
      (hasToken ? '\n\nA token is already saved. Leave blank to keep it.' : ''),
      ui.ButtonSet.OK_CANCEL);
    if (tokenResponse.getSelectedButton() !== ui.Button.OK) return;
    const token = tokenResponse.getResponseText().trim();
    if (!token && !hasToken) {
      ui.alert('No token was entered. Nothing was saved.');
      return;
    }
    if (/\s/.test(token)) {
      ui.alert('That token contains spaces or line breaks. Nothing was saved. Copy it again and retry.');
      return;
    }

    props.setProperty(PROP_BASE_URL, baseUrl);
    if (token) saveToken_(props, token);
    ui.alert('Canvas setup',
      'Saved for your Google account only.\n\nCanvas address: ' + baseUrl +
      '\nToken: ' + (token ? 'saved' : 'unchanged'),
      ui.ButtonSet.OK);
  } catch (error) {
    // Messages from this file never contain the token or what was typed.
    console.error('Canvas setup failed: ' + error.message);
    ui.alert('Canvas setup could not finish: ' + error.message);
  }
}

/**
 * Called by the Setup panel's Save button (SetupPanel.js; google.script.run, so no
 * trailing underscore) with { baseUrl, token } as typed. Same rules as the prompts: a
 * blank box keeps what is saved. Returns { ok, message }; the message never contains
 * the token or what was typed, and the token is never sent back. Never throws.
 */
function saveCanvasCredentialsFromPanel(form) {
  try {
    const props = PropertiesService.getUserProperties();
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
    if (token) saveToken_(props, token);
    console.log('Canvas setup (panel): address saved' + (token ? ', token saved.' : '.'));
    return { ok: true, message: 'Saved for your Google account only. Token: ' +
      (token ? 'saved.' : 'unchanged.') };
  } catch (error) {
    // normalizeBaseUrl_'s message never repeats what was typed.
    console.error('Canvas setup (panel) failed.');
    return { ok: false, message: 'Not saved. ' + error.message };
  }
}

/** Saves the token and when it was saved. */
function saveToken_(props, token) {
  props.setProperty(PROP_TOKEN, token);
  props.setProperty(PROP_TOKEN_SAVED, new Date().toISOString());
}

/**
 * What the Setup panel may show about this user's saved token: { hint, savedAt }.
 * hint is the last 4 characters ('' if none is saved, or if the token is too short for 4
 * characters to be a small part of it); savedAt the ISO time it was saved ('' if saved
 * before 2026-11-11, when this started being recorded). Never the token itself.
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
  const withoutScheme = text.trim().replace(/^https?:\/\//i, '');
  const host = withoutScheme.split(/[/?#:]/)[0].toLowerCase();
  const looksLikeHost = /^[a-z0-9.-]+$/.test(host) && host.includes('.') &&
    !host.startsWith('.') && !host.endsWith('.') && !host.includes('..');
  if (!looksLikeHost) {
    throw new Error('That does not look like a web address. Copy the start of your Canvas address bar and try again.');
  }
  return 'https://' + host;
}
