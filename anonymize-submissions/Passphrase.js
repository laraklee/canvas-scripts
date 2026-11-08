/**
 * Passphrase.js
 * Purpose: the "Set passphrase", "Check passphrase", and "Show my passphrase" menu
 *   items. The passphrase is the secret key for the HMAC that turns a student's Canvas
 *   user ID into a code. It is saved in this user's User Properties, where other editors
 *   of the script cannot read it. It is never logged or put in any other message; "Show
 *   my passphrase" displays it only to the user who saved it, after a warning (Lara,
 *   2026-11-08: so teachers can copy it into a new workbook without keeping a record).
 * Canvas endpoints called: none.
 * Canvas write operations: none.
 * Required User/Script Properties: writes User Property ANON_PASSPHRASE.
 */

const PROP_PASSPHRASE = 'ANON_PASSPHRASE';
const MIN_PASSPHRASE_LENGTH = 12;

/** Returns the saved passphrase, or null if none is set. */
function getPassphrase_() {
  return PropertiesService.getUserProperties().getProperty(PROP_PASSPHRASE);
}

/** Menu: Anonymize › Set passphrase. */
function setPassphrase() {
  const ui = SpreadsheetApp.getUi();
  try {
    if (getPassphrase_()) {
      const confirm = ui.alert('Replace passphrase?',
        'A passphrase is already saved. If you change it, every student gets a NEW ' +
        'code, so codes from earlier runs will no longer match.\n\nReplace it?',
        ui.ButtonSet.YES_NO);
      if (confirm !== ui.Button.YES) return;
    }
    const response = ui.prompt('Set passphrase',
      'Enter a passphrase of at least ' + MIN_PASSPHRASE_LENGTH + ' characters. ' +
      'Use the same one in each of your workbooks: the same passphrase always gives ' +
      'the same codes. Never write it on the sheet. To copy it into another workbook ' +
      'later, use Anonymize › Show my passphrase here.',
      ui.ButtonSet.OK_CANCEL);
    if (response.getSelectedButton() !== ui.Button.OK) return;
    const passphrase = response.getResponseText().trim();
    if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
      ui.alert('Not saved: the passphrase must be at least ' +
        MIN_PASSPHRASE_LENGTH + ' characters.');
      return;
    }
    PropertiesService.getUserProperties().setProperty(PROP_PASSPHRASE, passphrase);
    ui.alert('Passphrase saved.');
  } catch (err) {
    console.error('setPassphrase failed: ' + err.message);
    ui.alert('Could not save the passphrase: ' + err.message);
  }
}

/** Menu: Anonymize › Check passphrase. Says whether one is set, never what it is. */
function checkPassphrase() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(getPassphrase_()
    ? 'A passphrase is saved for your account.'
    : 'No passphrase is saved yet. Use Anonymize › Set passphrase.');
}

/**
 * Menu: Anonymize › Show my passphrase. Shows the current user's own saved passphrase
 * (from their User Properties), after a warning, so they can copy it into Set
 * passphrase in another workbook. Never logged; other users only ever see their own.
 */
function showPassphrase() {
  const ui = SpreadsheetApp.getUi();
  const passphrase = getPassphrase_();
  if (!passphrase) {
    ui.alert('No passphrase is saved yet. Use Anonymize › Set passphrase.');
    return;
  }
  const confirm = ui.alert('Show my passphrase?',
    'Your passphrase will appear on screen. Make sure no one else can see it, and ' +
    'don\'t paste it anywhere except Set passphrase in another of your workbooks.' +
    '\n\nShow it?', ui.ButtonSet.YES_NO);
  if (confirm !== ui.Button.YES) return;
  ui.alert('Your passphrase', passphrase, ui.ButtonSet.OK);
}
