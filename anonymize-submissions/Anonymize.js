/**
 * Anonymize.js
 * Purpose: pseudonymize a Canvas "Download Submissions" set that is already in Drive.
 *   Reads a Drive folder holding the Canvas zip and/or the unzipped files, parses each
 *   Canvas filename (name[_LATE]_userID_submissionID_originalFilename), and saves a
 *   renamed copy (for example S-9C1E4B.pdf) into an "anonymized" subfolder. The code is
 *   the first 6 hex characters of HMAC-SHA256(userID + ":" + assignmentID), keyed with
 *   the passphrase. Writes the code-to-student key to the assignment's "<name> Key" tab
 *   and files it could not parse to "<name> Flagged" (see Assignments.js for names).
 *   Only filenames change; file contents are copied as is, with two exceptions: typed
 *   (text entry) submissions, name[_LATE]_userID_text.html, are converted to PDF by
 *   Google so AI tools accept them; and a file with no extension gets one from its
 *   first bytes (PDF, JPEG, PNG, GIF, HEIC, Word/PowerPoint/Excel) or is flagged.
 *   A .csv is read as a quiz Student Analysis report instead, New or Classic (QuizCsv.js).
 *   Originals are only read, never changed, moved, or renamed.
 *   Re-running is safe: files already in the Key tab for that assignment are skipped,
 *   so a run that stops at the time limit can simply be run again.
 *   Safety check (Lara, 2026-11-13): if the "anonymized" subfolder already has files but
 *   this workbook's Key tab has none for the assignment, it stops before copying or
 *   making any tab. That folder was anonymized in another workbook (usually the old copy,
 *   after getting a new copy of the template); running here would copy every file again.
 *   Started from a row of the Index tab (Index.js), which supplies the folder,
 *   quiz/assignment ID, and short name.
 * Canvas endpoints called: none (works on files already downloaded to Drive).
 * Canvas write operations: none.
 * Required User/Script Properties: User Property ANON_PASSPHRASE (see Passphrase.js).
 */

const ANON_FOLDER_NAME = 'anonymized';
const KEY_HEADERS = ['Name', 'Canvas user ID', 'Assignment ID', 'Code',
  'Original filename', 'Late', 'Anonymized filename'];
const FLAGGED_HEADERS = ['Assignment ID', 'File', 'Reason'];
// Stop before Apps Script's 6-minute limit so the Key tab is never left half-written.
const TIME_BUDGET_MS = 5 * 60 * 1000;

// Canvas bulk download: name[_LATE]_userID_submissionID_originalFilename
const CANVAS_FILENAME_RE = /^([^_]+)(_LATE)?_(\d+)_(\d+)_(.+)$/;
// Typed (online text entry) submissions: name[_LATE]_userID_text.html
const CANVAS_TEXT_RE = /^([^_]+)(_LATE)?_(\d+)_(text\.html?)$/i;
// Zip clutter added by macOS; skipped silently.
const IGNORED_ENTRY_RE = /(^|\/)(__MACOSX\/|\.DS_Store$)/;

/**
 * Anonymizes one assignment's folder. Called from the Index tab (see Index.js).
 * Shows a summary alert and returns a short status line for the Index, or null if it
 * stopped before copying anything (after telling Lara why).
 */
function runAnonymize_(ui, folderId, assignmentId, shortName) {
  const started = Date.now();
  let stage = 'setup';
  try {
    const passphrase = getPassphrase_();
    if (!passphrase) {
      ui.alert('No passphrase is saved yet. Open Anonymize › ⚙️ Setup… and set it first.');
      return null;
    }

    stage = 'opening the folder';
    let folder;
    try {
      folder = DriveApp.getFolderById(folderId);
    } catch {
      ui.alert('Could not open that folder. Use Refresh folder list, and check that your ' +
        'account can see the folder.');
      return null;
    }
    stage = 'checking for an earlier run';
    const earlierKey = SpreadsheetApp.getActiveSpreadsheet()
      .getSheetByName(tabName_(shortName, 'Key'));
    if (anonymizedElsewhere_(folder, earlierKey, assignmentId)) {
      console.log('anonymize: assignment ' + assignmentId + ' refused (anonymized folder has ' +
        'files, no Key rows here).');
      ui.alert('Already anonymized somewhere else',
        'This assignment\'s "' + ANON_FOLDER_NAME + '" folder already has files, but this ' +
        'workbook has no Key for it. It was probably anonymized in another workbook (for ' +
        'example your old copy). Nothing was copied.\n\n' +
        'Finish this assignment (Match and Archive) in the workbook that anonymized it, and ' +
        'delete its row here.\n\n' +
        'To start it over here instead: delete the "' + ANON_FOLDER_NAME + '" folder inside ' +
        'this assignment\'s folder in Drive, then run Anonymize again.',
        ui.ButtonSet.OK);
      return null;
    }

    const outFolder = getOrCreateSubfolder_(folder, ANON_FOLDER_NAME);
    const keySheet = getOrCreateSheet_(tabName_(shortName, 'Key'), KEY_HEADERS);
    // The AI tab is made now, ready for pasting. Flagged is only made if something is.
    getOrCreateSheet_(tabName_(shortName, 'AI'), RESULTS_HEADERS);
    const flaggedName = tabName_(shortName, 'Flagged');

    stage = 'reading the Key tab';
    const state = readKeyState_(keySheet, assignmentId);

    stage = 'listing files';
    const flagged = [];
    const sources = listSources_(folder, flagged);

    stage = 'copying files';
    let copied = 0;
    let skipped = 0;
    let stoppedEarly = false;
    const quizzes = [];
    for (const source of sources) {
      if (Date.now() - started > TIME_BUDGET_MS) {
        stoppedEarly = true;
        break;
      }
      if (isQuizReport_(source.name)) {
        const quiz = anonymizeQuizCsv_(source,
          { assignmentId, shortName, passphrase, state, keySheet, outFolder, flagged });
        copied += quiz.added;
        skipped += quiz.skipped;
        if (quiz.outName) quizzes.push(quiz);
        continue;
      }
      const parsed = parseCanvasName_(source.name);
      if (!parsed) {
        flagged.push([assignmentId, source.label, 'Does not match the Canvas filename pattern; not copied']);
        continue;
      }
      const { studentName, lateTag, userId, originalName, isText } = parsed;
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

      let extension = isText ? '.pdf' : extensionOf_(originalName);
      if (!extension) {
        try {
          extension = sniffExtension_(source.getBlob());
        } catch {
          extension = '';
        }
        if (!extension) {
          flagged.push([assignmentId, source.label,
            'No file extension, and the file type was not recognized; not copied']);
          continue;
        }
      }

      const count = (state.codeCount.get(code) || 0) + 1;
      const outName = (count === 1 ? code : code + '-' + count) + extension;
      try {
        if (isText) outFolder.createFile(htmlToPdf_(source.getBlob(), outName));
        else source.copyTo(outFolder, outName);
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

    // A quiz's AI tab gets the quiz columns, unless results were already pasted in.
    const aiSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(tabName_(shortName, 'AI'));
    if (quizzes.length && aiSheet && aiSheet.getLastRow() <= 1) {
      aiSheet.getRange(1, 1, 1, Math.max(aiSheet.getLastColumn(), 1)).clearContent();
      aiSheet.getRange(1, 1, 1, QUIZ_RESULTS_HEADERS.length).setValues([QUIZ_RESULTS_HEADERS])
        .setFontWeight('bold');
    }

    stage = 'writing the Flagged tab';
    const flaggedSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(flaggedName);
    if (flagged.length || flaggedSheet) {
      writeFlagged_(flaggedSheet || getOrCreateSheet_(flaggedName, FLAGGED_HEADERS), flagged);
    }

    // Counts and IDs only: no student data in logs.
    console.log('anonymize: assignment ' + assignmentId + ' copied=' + copied +
      ' skipped=' + skipped + ' flagged=' + flagged.length + ' stoppedEarly=' + stoppedEarly +
      ' quizAnswers=' + quizzes.reduce((sum, quiz) => sum + quiz.answers, 0));

    const quizLines = quizzes.map((quiz) => '\n\nQuiz report: ' + quiz.answers +
      ' essay answers saved in "' + quiz.outName + '" (anonymized folder).' +
      (quiz.noEssay ? ' ' + quiz.noEssay + ' student(s) had no essay answers and were left out.' : '') +
      (quiz.essayNumbers.length ? '\nClassic Quiz: read as essays (answers with formatting): Q' +
        quiz.essayNumbers.join(', Q') + '. Check that these are your essay questions.' : ''));
    ui.alert(stoppedEarly ? 'Paused at the time limit' : 'Done',
      (quizzes.length ? 'Students added to the Key' : 'Copied') + ': ' + copied + '\n' +
      'Already done before (skipped): ' + skipped + '\n' +
      'Flagged: ' + flagged.length +
      (flagged.length ? ' (see the "' + flaggedName + '" tab)' : '') +
      quizLines.join('') +
      (stoppedEarly ? '\n\nNot finished yet. Run Anonymize this row again to continue.' : '') +
      (quizzes.length
        ? '\n\nNames were removed, but a name a student typed inside an answer is still there.'
        : '\n\nOnly filenames were changed. Names written inside the files themselves ' +
          'are still there.'),
      ui.ButtonSet.OK);
    return (stoppedEarly ? 'Paused: ' : '') + (copied + skipped) +
      (quizzes.length ? ' students, ' : ' files, ') +
      flagged.length + ' flagged';
  } catch (err) {
    console.error('anonymize failed while ' + stage + ': ' + err.message);
    ui.alert('Something went wrong while ' + stage + '. Nothing in the original ' +
      'folder was changed. Run it again; files already done will be skipped.');
    return null;
  }
}

/**
 * Lists every file to process, sorted by name so "-2", "-3" suffixes come out the same
 * on every run. Each source has a name (the bare filename), a label (where it came
 * from, for the Flagged tab), getBlob(), and copyTo(folder, newName).
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
          getBlob: () => blob,
          copyTo: (outFolder, newName) => outFolder.createFile(blob.setName(newName)),
        });
      }
    } else {
      sources.push({
        name: fileName,
        label: fileName,
        getBlob: () => file.getBlob(),
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

/**
 * Splits a Canvas download filename into its parts, or returns null if it doesn't fit.
 * Uploads: name[_LATE]_userID_submissionID_originalFilename.
 * Typed answers: name[_LATE]_userID_text.html (isText: true).
 */
function parseCanvasName_(fileName) {
  const upload = CANVAS_FILENAME_RE.exec(fileName);
  if (upload) {
    const [, studentName, lateTag, userId, , originalName] = upload;
    return { studentName, lateTag, userId, originalName, isText: false };
  }
  const text = CANVAS_TEXT_RE.exec(fileName);
  if (text) {
    const [, studentName, lateTag, userId, originalName] = text;
    return { studentName, lateTag, userId, originalName, isText: true };
  }
  return null;
}

/** A typed Canvas answer (HTML) as a PDF named newName. Google does the conversion. */
function htmlToPdf_(htmlBlob, newName) {
  return htmlBlob.setContentType('text/html').getAs('application/pdf').setName(newName);
}

/**
 * The extension that matches a file's first bytes, or '' if unrecognized.
 * Office files are zips; their inner folder names tell Word, PowerPoint, and Excel apart.
 */
function sniffExtension_(blob) {
  const bytes = blob.getBytes().slice(0, 16).map((b) => b & 0xff);
  const startsWith = (sig, offset = 0) => sig.every((b, i) => bytes.at(offset + i) === b);
  const ascii = (text) => Array.from(text, (c) => c.charCodeAt(0));
  if (startsWith(ascii('%PDF'))) return '.pdf';
  if (startsWith([0xff, 0xd8, 0xff])) return '.jpg';
  if (startsWith([0x89, 0x50, 0x4e, 0x47])) return '.png';
  if (startsWith(ascii('GIF8'))) return '.gif';
  if (startsWith(ascii('ftyp'), 4) && /^(heic|heix|mif1)$/.test(String.fromCharCode(...bytes.slice(8, 12)))) {
    return '.heic';
  }
  if (startsWith([0x50, 0x4b, 0x03, 0x04])) {
    const names = Utilities.unzip(blob.copyBlob().setContentType('application/zip'))
      .map((entry) => entry.getName());
    if (names.some((n) => n.startsWith('word/'))) return '.docx';
    if (names.some((n) => n.startsWith('ppt/'))) return '.pptx';
    if (names.some((n) => n.startsWith('xl/'))) return '.xlsx';
  }
  return '';
}

/** ".pdf" from "Lab Report.pdf"; "" when there is no extension. */
function extensionOf_(fileName) {
  const match = /\.[^./\s]+$/.exec(fileName);
  return match ? match[0] : '';
}

/**
 * True if the folder's "anonymized" subfolder already has files but keySheet (this
 * workbook's Key tab for the assignment, or null) has no rows for assignmentId: the
 * files came from another workbook. Doesn't create anything.
 */
function anonymizedElsewhere_(folder, keySheet, assignmentId) {
  const existing = folder.getFoldersByName(ANON_FOLDER_NAME);
  if (!existing.hasNext()) return false;
  if (!existing.next().getFiles().hasNext()) return false;
  return !keySheet || readKeyState_(keySheet, assignmentId).done.size === 0;
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
