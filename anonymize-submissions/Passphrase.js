/**
 * Passphrase.js
 * Purpose: the passphrase and the Setup side panel (Anonymize › ⚙️ Setup…; Lara,
 *   2026-11-12, replacing the Set / Check / Show my passphrase menu items). The
 *   passphrase is the secret key for the HMAC that turns a student's Canvas user ID into
 *   a code. It is saved in this user's User Properties, where other editors of the script
 *   cannot read it, and never logged or put in any message.
 *   - showSetupPanel: opens SetupPanelPage.html on the right.
 *   - getSetupStatus, savePassphraseFromPanel, revealPassphraseForPanel: called by the
 *     panel (google.script.run). They never throw.
 *   The panel shows whether a passphrase is saved and its **check code**: 4 characters
 *   made from the passphrase (HMAC of a fixed word), so a teacher can see that two
 *   workbooks use the same passphrase without showing it (Lara, 2026-11-12). Four hex
 *   characters reveal nothing useful about the passphrase. The passphrase itself is sent
 *   to the panel only by revealPassphraseForPanel, after the panel's "no one watching"
 *   step (Lara, 2026-11-08: so teachers can copy it into a new workbook instead of
 *   keeping a record); each user only ever gets their own.
 * Canvas endpoints called: none.
 * Canvas write operations: none.
 * Required User/Script Properties: reads and writes User Property ANON_PASSPHRASE.
 */

const PROP_PASSPHRASE = 'ANON_PASSPHRASE';
const MIN_PASSPHRASE_LENGTH = 12;
// The fixed word the check code is made from. It has no ":" so it can never be the same
// input as a student code (userId:assignmentId). Changing it changes every check code.
const CHECK_CODE_INPUT = 'passphrase-check';

/** Returns the saved passphrase, or null if none is set. */
function getPassphrase_() {
  return PropertiesService.getUserProperties().getProperty(PROP_PASSPHRASE);
}

/** The 4-character check code for a passphrase, for example "7C1E". */
function passphraseCheckCode_(passphrase) {
  const bytes = Utilities.computeHmacSha256Signature(
    CHECK_CODE_INPUT, passphrase, Utilities.Charset.UTF_8);
  const hex = bytes.map((b) => (b & 0xff).toString(16).padStart(2, '0')).join('');
  return hex.slice(0, 4).toUpperCase();
}

/** Menu: Anonymize › ⚙️ Setup…. Opens the panel on the right. */
function showSetupPanel() {
  const html = HtmlService.createHtmlOutputFromFile('SetupPanelPage').setTitle('Setup');
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Called by the panel when it opens and after a save: { hasPassphrase, checkCode,
 * minLength }. Never includes the passphrase.
 */
function getSetupStatus() {
  try {
    const passphrase = getPassphrase_();
    return { ok: true, hasPassphrase: Boolean(passphrase),
      checkCode: passphrase ? passphraseCheckCode_(passphrase) : '',
      minLength: MIN_PASSPHRASE_LENGTH };
  } catch (err) {
    console.error('Setup panel: status failed: ' + err.message);
    return { ok: false, message: 'Could not read your setup.' };
  }
}

/**
 * Called by the panel's Save button with { passphrase, again, replace } as typed.
 * Saves only if both boxes match and are long enough, and, when one is already saved,
 * only if replace is true (the panel's "codes will change" step). Returns
 * { ok, message, status } or { ok: false, needsReplace: true }. Messages never contain
 * what was typed. Never throws.
 */
function savePassphraseFromPanel(form) {
  try {
    const passphrase = String((form && form.passphrase) || '').trim();
    const again = String((form && form.again) || '').trim();
    if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
      return { ok: false, message: `Not saved: the passphrase must be at least ` +
        `${MIN_PASSPHRASE_LENGTH} characters.` };
    }
    if (passphrase !== again) {
      return { ok: false, message: 'Not saved: the two boxes don\'t match. Type it again.' };
    }
    const saved = getPassphrase_();
    if (saved === passphrase) {
      return { ok: true, message: 'That\'s already your passphrase. Nothing changed.',
        status: getSetupStatus() };
    }
    if (saved && !(form && form.replace === true)) return { ok: false, needsReplace: true };
    PropertiesService.getUserProperties().setProperty(PROP_PASSPHRASE, passphrase);
    console.log('Setup panel: passphrase ' + (saved ? 'replaced.' : 'saved.'));
    return { ok: true, message: saved ? 'New passphrase saved. Codes from now on are new.' :
      'Passphrase saved.', status: getSetupStatus() };
  } catch {
    console.error('Setup panel: passphrase save failed.');
    return { ok: false, message: 'Could not save the passphrase. Nothing changed.' };
  }
}

/**
 * Called by the panel's "Show my passphrase" step, after its own warning. Returns this
 * user's own passphrase: { ok, passphrase } or { ok: false, message }. Never logged.
 */
function revealPassphraseForPanel() {
  try {
    const passphrase = getPassphrase_();
    if (!passphrase) return { ok: false, message: 'No passphrase is saved yet.' };
    return { ok: true, passphrase };
  } catch {
    console.error('Setup panel: show passphrase failed.');
    return { ok: false, message: 'Could not read your passphrase.' };
  }
}
