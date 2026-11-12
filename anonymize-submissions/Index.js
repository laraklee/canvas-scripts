/**
 * Index.js
 * Purpose: the Index tab and the Anonymize menu. B1 holds the link to this course's AI
 *   grading folder; each subfolder of it (one per assignment, holding the Canvas
 *   download) gets a row: Folder, Short name, Quiz/Assignment ID, Anonymized, Matched,
 *   Folder ID. Lara clicks a row, then "Anonymize selected row" or "Match AI results
 *   for selected row" (menu items, or buttons drawn on the Index assigned to
 *   anonymizeSelectedRow / matchSelectedRow / refreshFolderList). "Archive selected
 *   row…" deletes that assignment's Key, AI, and Flagged tabs (after asking), keeps
 *   Review but hides it, and marks the row Archived so it can't be re-run by mistake.
 *   "Sort Review by question / by student" re-sort the open quiz Review tab
 *   (MatchResults.js). "❓ User guide" opens UserGuide.html in the side panel
 *   (showUserGuide, below; showUserGuideLarge for the big window).
 * Canvas endpoints called: none.
 * Canvas write operations: none.
 * Required User/Script Properties: none here (see Passphrase.js, Assignments.js).
 */

const INDEX_SHEET_NAME = 'Index';
const INDEX_HEADERS = ['Folder', 'Short name', 'Quiz/Assignment ID', 'Anonymized', 'Matched',
  'Folder ID'];
const INDEX_HEADER_ROW = 3;
const INDEX_FIRST_ROW = INDEX_HEADER_ROW + 1;
const ARCHIVED_PREFIX = 'Archived: ';
const COL = { FOLDER: 1, SHORT_NAME: 2, ASSIGNMENT_ID: 3, ANONYMIZED: 4, MATCHED: 5, FOLDER_ID: 6 };

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Anonymize')
    .addItem('Refresh folder list', 'refreshFolderList')
    .addItem('Anonymize selected row', 'anonymizeSelectedRow')
    .addItem('Match AI results for selected row', 'matchSelectedRow')
    .addItem('Archive selected row…', 'archiveSelectedRow')
    .addSeparator()
    .addItem('Sort Review by question', 'sortReviewByQuestion')
    .addItem('Sort Review by student', 'sortReviewByStudent')
    .addSeparator()
    .addItem('⚙️ Setup…', 'showSetupPanel') // Passphrase.js (set, check code, show)
    .addSeparator()
    .addItem('❓ User guide', 'showUserGuide')
    .addToUi();
}

/**
 * Menu: Anonymize › ❓ User guide. Opens UserGuide.html in the side panel, docked on the
 * right, so teachers can follow the steps while they work in the sheet (Lara,
 * 2026-11-08: the big window covered the sheet). The panel has a link to
 * showUserGuideLarge for reading straight through. No Canvas or Drive calls; the page
 * holds only the guide text.
 */
function showUserGuide() {
  const html = HtmlService.createHtmlOutputFromFile('UserGuide')
    .setTitle('AI Grading Helper — User Guide');
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Called from the side panel's "Open in a large window" link (google.script.run), so it
 * has no trailing underscore. Opens the same guide in a big window over the sheet.
 */
function showUserGuideLarge() {
  const html = HtmlService.createHtmlOutputFromFile('UserGuide')
    .setWidth(900)
    .setHeight(650);
  SpreadsheetApp.getUi().showModelessDialog(html, 'AI Grading Helper — User Guide');
}

/** Menu/button: adds a row for each assignment subfolder not already on the Index. */
function refreshFolderList() {
  const ui = SpreadsheetApp.getUi();
  try {
    const sheet = getOrCreateIndex_();
    sheet.activate();
    // Index tabs made before 11/4 say "Assignment ID"; any Canvas number works there.
    const idHeader = sheet.getRange(INDEX_HEADER_ROW, COL.ASSIGNMENT_ID);
    if (idHeader.getDisplayValue() === 'Assignment ID') idHeader.setValue(INDEX_HEADERS[COL.ASSIGNMENT_ID - 1]);
    // A pasted link may show as the folder's title; the URL is then behind the text.
    const linkCell = sheet.getRange('B1');
    const rich = linkCell.getRichTextValue();
    let folderText = (rich && rich.getLinkUrl()) || linkCell.getDisplayValue();
    if (!folderText) {
      folderText = promptText_(ui, 'Course folder',
        'Paste the link to this course\'s AI grading folder. Put each assignment\'s ' +
        'Canvas download in its own subfolder inside it.');
      if (folderText === null) return;
      sheet.getRange('B1').setValue(asText_(folderText.trim()));
    }
    const folderId = parseFolderId_(folderText);
    if (!folderId) {
      ui.alert('B1 does not look like a Drive folder link. Paste the course folder\'s link there.');
      return;
    }
    let courseFolder;
    try {
      courseFolder = DriveApp.getFolderById(folderId);
    } catch {
      ui.alert('Could not open the folder in B1. Check the link, and that your account can see it.');
      return;
    }

    const lastRow = sheet.getLastRow();
    const known = new Set(lastRow < INDEX_FIRST_ROW ? [] : sheet
      .getRange(INDEX_FIRST_ROW, COL.FOLDER_ID, lastRow - INDEX_HEADER_ROW, 1)
      .getDisplayValues().map(([id]) => id));

    const found = [];
    const folders = courseFolder.getFolders();
    while (folders.hasNext()) {
      const folder = folders.next();
      if (folder.getName() === ANON_FOLDER_NAME || known.has(folder.getId())) continue;
      found.push(folder);
    }
    found.sort((a, b) => a.getName().localeCompare(b.getName()));

    let row = Math.max(lastRow, INDEX_HEADER_ROW) + 1;
    for (const folder of found) {
      const link = SpreadsheetApp.newRichTextValue().setText(folder.getName())
        .setLinkUrl(folder.getUrl()).build();
      sheet.getRange(row, COL.FOLDER).setRichTextValue(link);
      sheet.getRange(row, COL.SHORT_NAME, 1, 5).setValues([[
        asText_(cleanShortName_(folder.getName())), '', '', '', asText_(folder.getId())]]);
      row++;
    }
    ui.alert(found.length
      ? 'Added ' + found.length + ' folder(s). Type the quiz or assignment ID (the number at the ' +
        'end of its Canvas address) on each new row.'
      : 'No new folders. Make a subfolder for each assignment inside the course folder.');
  } catch (err) {
    console.error('refreshFolderList failed: ' + err.message);
    ui.alert('Something went wrong while refreshing the folder list.');
  }
}

/** Menu/button: anonymizes the assignment on the selected Index row. */
function anonymizeSelectedRow() {
  const ui = SpreadsheetApp.getUi();
  const job = selectedJob_(ui);
  if (!job || isArchived_(ui, job)) return;
  const status = runAnonymize_(ui, job.folderId, job.assignmentId, job.shortName);
  if (status) writeStatus_(job, COL.ANONYMIZED, status);
}

/** Menu/button: matches AI results for the assignment on the selected Index row. */
function matchSelectedRow() {
  const ui = SpreadsheetApp.getUi();
  const job = selectedJob_(ui);
  if (!job || isArchived_(ui, job)) return;
  const status = runMatch_(ui, job.assignmentId, job.shortName, job.folderId);
  if (status) writeStatus_(job, COL.MATCHED, status);
}

/**
 * Menu: deletes the selected assignment's Key, AI, and Flagged tabs once grades are in
 * Canvas, keeping Review (which has each name, code, score, and comment) but hiding it.
 * Asks first,
 * refuses if there is no Review tab, and marks the row Archived so it isn't re-run.
 */
function archiveSelectedRow() {
  const ui = SpreadsheetApp.getUi();
  try {
    const job = selectedJob_(ui);
    if (!job || isArchived_(ui, job)) return;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const review = ss.getSheetByName(tabName_(job.shortName, 'Review'));
    if (!review || review.getLastRow() < 2) {
      ui.alert('"' + job.shortName + '" has no Review tab yet, so archiving would delete ' +
        'the only record of which code is which student. Run Match AI results first.');
      return;
    }
    const toDelete = ['Key', 'AI', 'Flagged']
      .map((kind) => ss.getSheetByName(tabName_(job.shortName, kind)))
      .filter(Boolean);
    const unreviewed = review.getRange(2, REVIEW_HEADERS.length, review.getLastRow() - 1, 1)
      .getValues().filter(([checked]) => checked !== true).length;

    const confirm = ui.alert('Archive "' + job.shortName + '"?',
      'This deletes: ' + (toDelete.map((sheet) => sheet.getName()).join(', ') || 'nothing') +
      '.\nThis keeps and hides: ' + review.getName() +
      ' (names, codes, scores, comments).\n\n' +
      (unreviewed ? unreviewed + ' row(s) in Review are not checked as reviewed.\n\n' : '') +
      'Only do this once the grades are in Canvas. After archiving, this row can\'t be ' +
      'anonymized or matched again. (File › Version history can bring the tabs back.)',
      ui.ButtonSet.YES_NO);
    if (confirm !== ui.Button.YES) return;

    for (const sheet of toDelete) ss.deleteSheet(sheet);
    review.hideSheet();
    // Counts and IDs only: no student data in logs.
    console.log('archive: assignment ' + job.assignmentId + ' tabsDeleted=' + toDelete.length);
    writeStatus_(job, COL.ANONYMIZED, ARCHIVED_PREFIX + 'Key and AI tabs deleted');
    ui.alert('Archived. "' + review.getName() + '" is kept but hidden. To see it, use ' +
      'View › Hidden sheets.');
  } catch (err) {
    console.error('archiveSelectedRow failed: ' + err.message);
    ui.alert('Something went wrong while archiving. Check which tabs are left; ' +
      'File › Version history can restore anything deleted.');
  }
}

/**
 * True (after telling Lara why) if the row was archived. Its Key is gone, so
 * anonymizing again would copy every file a second time.
 */
function isArchived_(ui, job) {
  const status = job.sheet.getRange(job.row, COL.ANONYMIZED).getDisplayValue();
  if (!status.startsWith(ARCHIVED_PREFIX)) return false;
  ui.alert('"' + job.shortName + '" is archived: its Key tab was deleted.\n\n' +
    'To start it over, delete its "anonymized" folder in Drive and clear the Anonymized ' +
    'cell on this row.');
  return true;
}

/**
 * Reads and checks the selected Index row. Returns {sheet, row, folderId, assignmentId,
 * shortName}, or null after telling Lara what to fix.
 */
function selectedJob_(ui) {
  const sheet = SpreadsheetApp.getActiveSheet();
  if (sheet.getName() !== INDEX_SHEET_NAME) {
    ui.alert('Go to the Index tab and click the assignment\'s row first.');
    return null;
  }
  const row = sheet.getActiveRange().getRow();
  const lastRow = sheet.getLastRow();
  if (row < INDEX_FIRST_ROW || row > lastRow) {
    ui.alert('Click a cell in an assignment\'s row (row ' + INDEX_FIRST_ROW + ' or below) first.');
    return null;
  }
  const [folderName, shortText, assignmentText, , , folderId] =
    sheet.getRange(row, 1, 1, INDEX_HEADERS.length).getDisplayValues()[0];

  const assignmentId = assignmentText.trim();
  if (!/^\d+$/.test(assignmentId)) {
    ui.alert('Type the quiz or assignment ID (digits only) in column C of row ' + row + '.\n\n' +
      'It\'s the number after /quizzes/ or /assignments/ in its Canvas address.');
    return null;
  }
  if (!folderId) {
    ui.alert('Row ' + row + ' has no Folder ID. Use Refresh folder list to add folders.');
    return null;
  }
  const otherRows = sheet.getRange(INDEX_FIRST_ROW, COL.ASSIGNMENT_ID,
    lastRow - INDEX_HEADER_ROW, 1).getDisplayValues()
    .map(([id], i) => ({ id: id.trim(), row: INDEX_FIRST_ROW + i }))
    .filter((r) => r.id === assignmentId && r.row !== row);
  if (otherRows.length) {
    ui.alert('ID ' + assignmentId + ' is also on row ' + otherRows[0].row +
      '. Each quiz or assignment ID should be on one row only.');
    return null;
  }

  const shortName = cleanShortName_(shortText) || cleanShortName_(folderName);
  if (!shortName) {
    ui.alert('Type a short name in column B of row ' + row + '.');
    return null;
  }
  if (shortName !== shortText) sheet.getRange(row, COL.SHORT_NAME).setValue(asText_(shortName));
  if (!applyAssignmentName_(ui, assignmentId, shortName)) return null;
  return { sheet, row, folderId, assignmentId, shortName };
}

/** "12 files, 1 flagged · 10/19 9:40 AM" in the row's status column. */
function writeStatus_(job, column, status) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const when = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'M/d h:mm a');
  job.sheet.getRange(job.row, column).setValue(asText_(status + ' · ' + when));
}

function getOrCreateIndex_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(INDEX_SHEET_NAME);
  if (sheet) return sheet;
  sheet = ss.insertSheet(INDEX_SHEET_NAME, 0);
  sheet.getRange('A1').setValue('Course folder link:').setFontWeight('bold');
  sheet.getRange('A2').setValue('Click an assignment\'s row, then use the Anonymize menu.')
    .setFontStyle('italic');
  sheet.getRange(INDEX_HEADER_ROW, 1, 1, INDEX_HEADERS.length).setValues([INDEX_HEADERS])
    .setFontWeight('bold');
  sheet.setFrozenRows(INDEX_HEADER_ROW);
  sheet.getRange(1, COL.FOLDER_ID, sheet.getMaxRows(), 1).setFontColor('#999999');
  sheet.setColumnWidth(COL.FOLDER, 220);
  sheet.setColumnWidth(COL.SHORT_NAME, 180);
  sheet.setColumnWidths(COL.ANONYMIZED, 2, 200);
  return sheet;
}
