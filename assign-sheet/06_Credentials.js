/**
 * 06_Credentials.js
 * Purpose: the "Set Canvas token" menu item. Prompts for the Canvas web address and
 *   access token and saves them in this user's User Properties, where other editors of
 *   the script cannot read them. The token is never shown, logged, or put in a message.
 *   Adapted from course-manager-jupiter/Credentials.js.
 * Canvas endpoints called: none.
 * Canvas write operations: none.
 * Required User/Script Properties: writes User Properties CANVAS_BASE_URL and CANVAS_TOKEN.
 */

const PROP_TOKEN = 'CANVAS_TOKEN';
const PROP_BASE_URL = 'CANVAS_BASE_URL';

/**
 * Menu: Canvas Tools › Set Canvas token.
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
    if (token) props.setProperty(PROP_TOKEN, token);
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
