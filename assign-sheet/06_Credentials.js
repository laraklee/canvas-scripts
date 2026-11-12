/**
 * 06_Credentials.js
 * Purpose: saves each teacher's Canvas web address and access token in their own User
 *   Properties, where other editors of the script cannot read them.
 *   saveCanvasCredentialsFromPanel is the Setup panel's Save button (08_SetupPanel.js,
 *   Canvas Tools › ⚙️ Setup…; 2026-11-12). It replaced the "Set Canvas token" prompts.
 *   The token is never logged or put in a message, and never shown except its last 4
 *   characters, to its owner only, in the Setup panel (tokenHint_), with the date it was
 *   saved. Adapted from course-manager-jupiter/Credentials.js.
 * Canvas endpoints called: none.
 * Canvas write operations: none.
 * Required User/Script Properties: writes User Properties CANVAS_BASE_URL, CANVAS_TOKEN,
 *   and CANVAS_TOKEN_SAVED (when the token was saved).
 */

const PROP_TOKEN = 'CANVAS_TOKEN';
const PROP_BASE_URL = 'CANVAS_BASE_URL';
// When the token was last saved (ISO date and time), so the Setup panel can show it next
// to the token's last 4 characters. Not secret.
const PROP_TOKEN_SAVED = 'CANVAS_TOKEN_SAVED';

/**
 * Called by the Setup panel's Save button (google.script.run, so no trailing underscore)
 * with { baseUrl, token } as typed. A blank box keeps what is saved. Returns
 * { ok, message }; the message never contains the token or what was typed, and the token
 * is never sent back. Never throws.
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
