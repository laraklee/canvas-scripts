/**
 * Anonymize.js
 * Purpose: pseudonymize a Canvas "Download Submissions" set that is already in Drive.
 *   Reads a Drive folder holding the Canvas zip and/or the unzipped files, parses each
 *   Canvas filename (name[_LATE]_userID_submissionID_originalFilename), and saves a
 *   renamed copy (for example S-9C1E4B.pdf) into an "anonymized" subfolder. The code is
 *   the first 6 hex characters of HMAC-SHA256(userID + ":" + assignmentID), keyed with
 *   the passphrase. Writes the code-to-student key to the "Key" tab and files it could
 *   not parse to the "Flagged" tab. Only filenames change; file contents are copied as is.
 *   Originals are only read, never changed, moved, or renamed.
 *   Re-running is safe: files already in the Key tab for that assignment are skipped,
 *   so a run that stops at the time limit can simply be run again.
 * Canvas endpoints called: none (works on files already downloaded to Drive).
 * Canvas write operations: none.
 * Required User/Script Properties: User Property ANON_PASSPHRASE (see Passphrase.js).
 */

const ANON_FOLDER_NAME = 'anonymized';
const KEY_SHEET_NAME = 'Key';
const FLAGGED_SHEET_NAME = 'Flagged';
const KEY_HEADERS = ['Name', 'Canvas user ID', 'Assignment ID', 'Code',
  'Original filename', 'Late', 'Anonymized filename'];
const FLAGGED_HEADERS = ['Assignment ID', 'File', 'Reason'];
// Stop before Apps Script's 6-minute limit so the Key tab is never left half-written.
const TIME_BUDGET_MS = 5 * 60 * 1000;

// Canvas bulk download: name[_LATE]_userID_submissionID_originalFilename
const CANVAS_FILENAME_RE = /^([^_]+)(_LATE)?_(\d+)_(\d+)_(.+)$/;
// Zip clutter added by macOS; skipped silently.
const IGNORED_ENTRY_RE = /(^|\/)(__MACOSX\/|\.DS_Store$)/;

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Anonymize')
    .addItem('Anonymize submissions…', 'anonymizeSubmissions')
    .addItem('Match AI results…', 'matchAiResults')
    .addSeparator()
    .addItem('Set passphrase', 'setPassphrase')
    .addItem('Check passphrase', 'checkPassphrase')
    .addToUi();
}

/** Menu: Anonymize › Anonymize submissions… */
function anonymizeSubmissions() {
  const ui = SpreadsheetApp.getUi();
  const started = Date.now();
  let stage = 'setup';
  try {
    const passphrase = getPassphrase_();
    if (!passphrase) {
      ui.alert('No passphrase is saved yet. Use Anonymize › Set passphrase first.');
      return;
    }

    const folderText = promptText_(ui, 'Anonymize (1 of 2)',
      'Paste the Google Drive folder link or ID that holds the Canvas download ' +
      '(the zip, the unzipped files, or both).');
    if (folderText === null) return;
    const folderId = parseFolderId_(folderText);
    if (!folderId) {
      ui.alert('That does not look like a Drive folder link or ID.');
      return;
    }

    const assignmentText = promptText_(ui, 'Anonymize (2 of 2)',
      'Enter the Canvas assignment ID (the number after /assignments/ in the ' +
      'assignment\'s address).');
    if (assignmentText === null) return;
    const assignmentId = assignmentText.trim();
    if (!/^\d+$/.test(assignmentId)) {
      ui.alert('The assignment ID should be digits only.');
      return;
    }

    stage = 'opening the folder';
    let folder;
    try {
      folder = DriveApp.getFolderById(folderId);
    } catch {
      ui.alert('Could not open that folder. Check the link, and that your account ' +
        'can see it.');
      return;
    }
    const outFolder = getOrCreateSubfolder_(folder, ANON_FOLDER_NAME);
    const keySheet = getOrCreateSheet_(KEY_SHEET_NAME, KEY_HEADERS);
    const flaggedSheet = getOrCreateSheet_(FLAGGED_SHEET_NAME, FLAGGED_HEADERS);

    stage = 'reading the Key tab';
    const state = readKeyState_(keySheet, assignmentId);

    stage = 'listing files';
    const flagged = [];
    const sources = listSources_(folder, flagged);

    stage = 'copying files';
    let copied = 0;
    let skipped = 0;
    let stoppedEarly = false;
    for (const source of sources) {
      if (Date.now() - started > TIME_BUDGET_MS) {
        stoppedEarly = true;
        break;
      }
      const match = CANVAS_FILENAME_RE.exec(source.name);
      if (!match) {
        flagged.push([assignmentId, source.label, 'Does not match the Canvas filename pattern; not copied']);
        continue;
      }
      const [, studentName, lateTag, userId, , originalName] = match;
      const doneKey = userId + '|' + originalName;
      if (state.done.has(doneKey)) {
        skipped++;
        continue;
      }

      const code = makeCode_(userId, assignmentId, passphrase);
      const owner = state.codeOwner.get(code);
      if (owner && owner !== userId) {
        flagged.push([assignmentId, source.label, 'Code ' + code +
          ' is already used by another student (rare collision); not copied']);
        continue;
      }

      const count = (state.codeCount.get(code) || 0) + 1;
      const outName = (count === 1 ? code : code + '-' + count) + extensionOf_(originalName);
      try {
        source.copyTo(outFolder, outName);
      } catch (err) {
        flagged.push([assignmentId, source.label, 'Copy failed: ' + err.message]);
        continue;
      }
      keySheet.appendRow([asText_(studentName), asText_(userId), asText_(assignmentId),
        code, asText_(originalName), Boolean(lateTag), outName]);

      state.done.add(doneKey);
      state.codeOwner.set(code, userId);
      state.codeCount.set(code, count);
      copied++;
    }

    stage = 'writing the Flagged tab';
    writeFlagged_(flaggedSheet, flagged);

    // Counts and IDs only: no student data in logs.
    console.log('anonymize: assignment ' + assignmentId + ' copied=' + copied +
      ' skipped=' + skipped + ' flagged=' + flagged.length + ' stoppedEarly=' + stoppedEarly);

    ui.alert(stoppedEarly ? 'Paused at the time limit' : 'Done',
      'Copied: ' + copied + '\n' +
      'Already done before (skipped): ' + skipped + '\n' +
      'Flagged: ' + flagged.length + (flagged.length ? ' (see the Flagged tab)' : '') +
      (stoppedEarly ? '\n\nNot finished yet. Run Anonymize submissions again with the ' +
        'same folder and assignment ID to continue.' : '') +
      '\n\nOnly filenames were changed. Names written inside the files themselves ' +
      'are still there.',
      ui.ButtonSet.OK);
  } catch (err) {
    console.error('anonymize failed while ' + stage + ': ' + err.message);
    ui.alert('Something went wrong while ' + stage + '. Nothing in the original ' +
      'folder was changed. Run it again; files already done will be skipped.');
  }
}

/**
 * Lists every file to process, sorted by name so "-2", "-3" suffixes come out the same
 * on every run. Each source has a name (the bare filename), a label (where it came
 * from, for the Flagged tab), and copyTo(folder, newName).
 */
function listSources_(folder, flagged) {
  const sources = [];
  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    const fileName = file.getName();
    if (isZip_(file)) {
      let entries;
      try {
        entries = Utilities.unzip(file.getBlob().setContentType('application/zip'));
      } catch {
        flagged.push(['', fileName, 'Could not unzip (Apps Script handles zips up to ' +
          'about 50 MB). Unzip it on your computer and upload the files instead.']);
        continue;
      }
      for (const blob of entries) {
        const entryPath = blob.getName();
        if (entryPath.endsWith('/') || IGNORED_ENTRY_RE.test(entryPath)) continue;
        sources.push({
          name: entryPath.split('/').pop(),
          label: fileName + ' › ' + entryPath,
          copyTo: (outFolder, newName) => outFolder.createFile(blob.setName(newName)),
        });
      }
    } else {
      sources.push({
        name: fileName,
        label: fileName,
        copyTo: (outFolder, newName) => file.makeCopy(newName, outFolder),
      });
    }
  }
  return sources.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

function isZip_(file) {
  return /zip/i.test(file.getMimeType()) || /\.zip$/i.test(file.getName());
}

/** S-XXXXXX: first 6 hex characters of HMAC-SHA256(userId:assignmentId, passphrase). */
function makeCode_(userId, assignmentId, passphrase) {
  const bytes = Utilities.computeHmacSha256Signature(
    userId + ':' + assignmentId, passphrase, Utilities.Charset.UTF_8);
  const hex = bytes.map((b) => (b & 0xff).toString(16).padStart(2, '0')).join('');
  return 'S-' + hex.slice(0, 6).toUpperCase();
}

/** ".pdf" from "Lab Report.pdf"; "" when there is no extension. */
function extensionOf_(fileName) {
  const match = /\.[^./\s]+$/.exec(fileName);
  return match ? match[0] : '';
}

/**
 * What the Key tab already holds for this assignment: which files are done, how many
 * files each code has (for "-2" suffixes), and which student owns each code.
 */
function readKeyState_(keySheet, assignmentId) {
  const state = { done: new Set(), codeCount: new Map(), codeOwner: new Map() };
  const lastRow = keySheet.getLastRow();
  if (lastRow < 2) return state;
  const rows = keySheet.getRange(2, 1, lastRow - 1, KEY_HEADERS.length).getDisplayValues();
  for (const row of rows) {
    const [, userId, rowAssignmentId, code, originalName] = row;
    if (rowAssignmentId !== assignmentId) continue;
    state.done.add(userId + '|' + originalName);
    state.codeCount.set(code, (state.codeCount.get(code) || 0) + 1);
    state.codeOwner.set(code, userId);
  }
  return state;
}

/** Replaces the Flagged tab's rows with this run's list. */
function writeFlagged_(sheet, flagged) {
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, FLAGGED_HEADERS.length).clearContent();
  if (flagged.length === 0) return;
  const rows = flagged.map(([assignmentId, label, reason]) =>
    [asText_(assignmentId), asText_(label), reason]);
  sheet.getRange(2, 1, rows.length, FLAGGED_HEADERS.length).setValues(rows);
}

/**
 * Stores a value as plain text. Filenames come from students, so one starting with
 * "=" must not become a formula, and long IDs must not turn into 1.2E+13.
 */
function asText_(value) {
  const text = String(value);
  return text === '' ? '' : "'" + text;
}

function getOrCreateSheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getOrCreateSubfolder_(parent, name) {
  const existing = parent.getFoldersByName(name);
  return existing.hasNext() ? existing.next() : parent.createFolder(name);
}

/** Accepts a full Drive folder link or a bare ID. Returns the ID, or null. */
function parseFolderId_(text) {
  const trimmed = text.trim();
  const fromUrl = /\/folders\/([A-Za-z0-9_-]+)/.exec(trimmed) ||
    /[?&]id=([A-Za-z0-9_-]+)/.exec(trimmed);
  if (fromUrl) return fromUrl[1];
  return /^[A-Za-z0-9_-]{10,}$/.test(trimmed) ? trimmed : null;
}

/** Shows a prompt; returns the typed text, or null if the user cancels. */
function promptText_(ui, title, message) {
  const response = ui.prompt(title, message, ui.ButtonSet.OK_CANCEL);
  return response.getSelectedButton() === ui.Button.OK ? response.getResponseText() : null;
}
