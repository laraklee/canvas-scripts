/**
 * ExportToDocs.js
 * Purpose: copies Canvas assignment, discussion, and page content into Google Docs, one
 *   Doc per row, on the tab being viewed (any tab name; recognized by its labels).
 *   exportCanvasToDocs (menu: Canvas Tools › Export to Google Docs).
 *   Tab layout (Lara, 2026-10-25): B2 = the folder name you want; B3 = the folder's link,
 *   written by the script the first time it makes the folder (in My Drive; move or rename
 *   it in Drive any time, the link keeps working). A label row with "Canvas Link" and
 *   "Google Doc" (plus optional "Name" and "Exported") somewhere in rows 1–10; data below.
 *   Paste an assignment, discussion, or page link from Canvas (typed, or a blue link
 *   showing other text); rows that already have a
 *   Google Doc link are skipped (delete the link to export again). The Doc gets the
 *   item's title, a link back to Canvas, and its content. Images stored in Canvas usually
 *   don't come through (Google can't log in to Canvas to fetch them).
 *   Discussions: only the teacher's prompt is read, never student replies.
 * Canvas endpoints called (GET via canvasGet_; the course comes from each link):
 *   /api/v1/courses/:course/assignments/:id
 *   /api/v1/courses/:course/discussion_topics/:id
 *   /api/v1/courses/:course/pages/:page_url
 * Canvas write operations: none (read-only, so DRY_RUN doesn't apply).
 * Google Drive (REST v3 through UrlFetchApp, scope drive.file: the script can see only
 *   files and folders it made itself): creates the export folder, creates each Doc (HTML
 *   converted to a Google Doc), and checks the B3 folder still exists.
 * Required: User Properties CANVAS_BASE_URL and CANVAS_TOKEN.
 */

const EXPORT_FOLDER_NAME_CELL = 'B2';
const EXPORT_FOLDER_LINK_CELL = 'B3';
const EXPORT_LABEL_SEARCH_ROWS = 10;
const EXPORT_LABELS = Object.freeze({
  LINK: 'Canvas Link',
  DOC: 'Google Doc',
  NAME: 'Name',
  EXPORTED: 'Exported',
});
const EXPORT_REFUSED_COLOR = '#f4cccc'; // light red, same as Post comments
const EXPORT_TIME_LIMIT_MS = 5 * 60 * 1000;
const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';
const DRIVE_FOLDER_TYPE = 'application/vnd.google-apps.folder';
const DRIVE_DOC_TYPE = 'application/vnd.google-apps.document';
// Which Canvas request each link type makes, and which fields hold the title and content.
const EXPORT_TYPES = Object.freeze({
  assignments: { label: 'assignment', title: 'name', html: 'description' },
  discussion_topics: { label: 'discussion', title: 'title', html: 'message' },
  pages: { label: 'page', title: 'title', html: 'body' },
});

/**
 * Menu: Canvas Tools › Export to Google Docs (this tab).
 * Each row's cells are written as soon as its Doc is made, so a stop part-way leaves an
 * accurate record and a rerun does only the rest.
 */
function exportCanvasToDocs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const title = 'Export to Google Docs';
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(1000)) {
    ui.alert(title, 'An export is already running. Wait for it to finish.', ui.ButtonSet.OK);
    return;
  }
  try {
    const started = Date.now();
    const sheet = ss.getActiveSheet();
    const table = findExportTable_(sheet.getRange(1, 1,
      Math.min(EXPORT_LABEL_SEARCH_ROWS, Math.max(sheet.getLastRow(), 1)),
      Math.max(sheet.getLastColumn(), 1)).getDisplayValues());
    const rows = sheet.getLastRow() - table.headerRow;
    if (rows < 1) throw sheetProblem_(`There are no rows below the "${EXPORT_LABELS.LINK}" label.`);
    const linkCol = table.columns.get(EXPORT_LABELS.LINK);
    const docCol = table.columns.get(EXPORT_LABELS.DOC);
    const nameCol = table.columns.get(EXPORT_LABELS.NAME);
    const exportedCol = table.columns.get(EXPORT_LABELS.EXPORTED);
    const linkCells = sheet.getRange(table.headerRow + 1, linkCol, rows, 1);
    const plan = planExports_(
      cellLinks_(linkCells.getRichTextValues(), linkCells.getFormulas(),
        linkCells.getDisplayValues()),
      sheet.getRange(table.headerRow + 1, docCol, rows, 1).getDisplayValues(),
      table.headerRow + 1);
    if (!plan.exports.length && !plan.badLinks.length) {
      ui.alert(title, 'Nothing to export: paste Canvas links in the ' +
        `"${EXPORT_LABELS.LINK}" column of rows with no Google Doc link.` +
        (plan.alreadyDone ? ` ${plan.alreadyDone} row(s) already have a Doc (delete the ` +
          'link to export again).' : ''), ui.ButtonSet.OK);
      return;
    }

    const markRow = (row, note, refused) => {
      const cell = sheet.getRange(row, linkCol).setNote(note || null);
      // Only this tool's red comes off, so colors you set yourself stay.
      if (refused) cell.setBackground(EXPORT_REFUSED_COLOR);
      else if (String(cell.getBackground()).toLowerCase() === EXPORT_REFUSED_COLOR) {
        cell.setBackground(null);
      }
    };
    plan.badLinks.forEach(row => markRow(row, 'Not exported: not an assignment, ' +
      'discussion, or page link from Canvas', true));

    let result = { made: 0, refusedRows: [], notStarted: 0 };
    let folder = null;
    if (plan.exports.length) {
      ss.toast('Checking the Drive folder…', title, -1);
      folder = exportFolder_(sheet);
      ss.toast(`Exporting ${plan.exports.length} item(s)…`, title, -1);
      result = runExports_(plan.exports,
        item => fetchCanvasContent_(item),
        (item, content) => createDocFromHtml_(content.title || 'Untitled (from Canvas)',
          folder.id, buildExportHtml_(content, item.link)),
        (item, content, doc) => {
          if (nameCol) sheet.getRange(item.row, nameCol).setValue(content.title);
          sheet.getRange(item.row, docCol).setValue(doc.webViewLink);
          if (exportedCol) sheet.getRange(item.row, exportedCol).setValue(new Date());
          markRow(item.row, '', false);
        },
        (item, error) => markRow(item.row, exportRefusedNote_(error.canvasType), true),
        { started });
    }
    ss.toast('', title, 1);

    const refused = result.refusedRows.concat(plan.badLinks).sort((a, b) => a - b);
    console.log(`Export to Docs: ${result.made} made, ${result.refusedRows.length} refused, ` +
      `${plan.badLinks.length} bad link(s), ${result.notStarted} not started, ` +
      `${plan.alreadyDone} already done.`);
    ui.alert(title, `${result.made} Google Doc(s) made` +
      (folder && folder.created ? ` in the new folder "${folder.name}" (link in ` +
        `${EXPORT_FOLDER_LINK_CELL}; it's in My Drive, move it anywhere)` : '') + '.' +
      (plan.alreadyDone ? `\n${plan.alreadyDone} row(s) already had a Doc and were skipped.` : '') +
      (refused.length ? `\n\nNot exported: row(s) ${refused.join(', ')} (light red; the ` +
        'link cell\'s note says why). The other rows still went.' : '') +
      (result.notStarted ? `\n\nStopped near the time limit with ${result.notStarted} ` +
        'row(s) not done yet. Run Export again to do the rest.' : ''),
    ui.ButtonSet.OK);
  } catch (error) {
    reportRefreshFailure_(title, 'Export stopped. Rows with a Google Doc link are done; ' +
      'running Export again does only the rest.', error);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Finds the label row in the top rows of the tab (grid = display values). Returns
 * { headerRow, columns: Map label → column number } (1-based). Canvas Link and Google
 * Doc are required; Name and Exported are optional. A label used twice stops the run.
 */
function findExportTable_(grid) {
  const r = grid.findIndex(row => row.some(value => String(value).trim() === EXPORT_LABELS.LINK));
  if (r === -1) {
    throw sheetProblem_(`This tab has no "${EXPORT_LABELS.LINK}" label in rows 1–` +
      `${EXPORT_LABEL_SEARCH_ROWS}. Open your export tab first.`);
  }
  const columns = new Map();
  const row = grid.slice(r, r + 1)[0];
  Object.values(EXPORT_LABELS).forEach(label => {
    const found = row.map((value, c) => (String(value).trim() === label ? c + 1 : 0))
      .filter(Boolean);
    if (found.length > 1) throw sheetProblem_(`Row ${r + 1} has "${label}" more than once.`);
    if (found.length) columns.set(label, found[0]);
  });
  if (!columns.has(EXPORT_LABELS.DOC)) {
    throw sheetProblem_(`Row ${r + 1} needs a "${EXPORT_LABELS.DOC}" label next to ` +
      `"${EXPORT_LABELS.LINK}".`);
  }
  return { headerRow: r + 1, columns };
}

/**
 * Which rows to export. links and docs are one-column display-value grids starting at
 * firstRow. A row exports when it has a link and no Google Doc link.
 * Returns { exports: [{ row, link, type, courseId, itemId }], badLinks: [row], alreadyDone }.
 */
function planExports_(links, docs, firstRow) {
  const plan = { exports: [], badLinks: [], alreadyDone: 0 };
  links.forEach((cells, i) => {
    const link = String(cells.slice(0, 1)[0]).trim();
    if (!link) return;
    if (String(docs.slice(i, i + 1)[0].slice(0, 1)[0]).trim()) {
      plan.alreadyDone++;
      return;
    }
    const parsed = parseCanvasContentLink_(link);
    if (parsed) plan.exports.push(Object.assign({ row: firstRow + i, link }, parsed));
    else plan.badLinks.push(firstRow + i);
  });
  return plan;
}

/**
 * The web address in each cell of a one-column range, as a one-column grid. A blue link
 * shows text (often the item's name) with the address hidden behind it, so the address
 * comes from, in order: the cell's link, a link on part of its text, a
 * =HYPERLINK("address", …) formula, then the text you see.
 */
function cellLinks_(richTexts, formulas, displays) {
  return displays.map((cells, i) => {
    const rich = richTexts.slice(i, i + 1)[0].slice(0, 1)[0];
    const runLink = rich ? (rich.getRuns().map(run => run.getLinkUrl()).find(Boolean)) : '';
    const formula = String(formulas.slice(i, i + 1)[0].slice(0, 1)[0]);
    const hyperlink = formula.match(/^=\s*HYPERLINK\(\s*"([^"]+)"/i);
    return [(rich && rich.getLinkUrl()) || runLink || (hyperlink ? hyperlink[1] : '') ||
      cells.slice(0, 1)[0]];
  });
}

/**
 * Reads a Canvas link like <your Canvas address>/courses/1/pages/lab-safety.
 * Returns { type, courseId, itemId } (type: assignments, discussion_topics, or pages) or
 * null. Assignment and discussion IDs must be numbers; a page uses its URL name.
 */
function parseCanvasContentLink_(link) {
  const match = String(link).match(
    /\/courses\/(\d+)\/(assignments|discussion_topics|pages)\/([^/?#\s]+)/);
  if (!match) return null;
  const [, courseId, type, itemId] = match;
  if (type !== 'pages') return /^\d+$/.test(itemId) ? { type, courseId, itemId } : null;
  try {
    return { type, courseId, itemId: decodeURIComponent(itemId) };
  } catch {
    return null; // a broken %-code in the page name
  }
}

/** Folder ID from a Drive folder link (…/folders/ID or …?id=ID), or ''. */
function folderIdFromLink_(link) {
  const match = String(link).match(/\/folders\/([\w-]+)|[?&]id=([\w-]+)/);
  return match ? match[1] || match[2] : '';
}

/**
 * Runs each export: read(item) gets the Canvas content, make(item, content) creates the
 * Doc, done(item, content, doc) writes the row. A Canvas refusal for one row (e.g. 404)
 * goes to refused(item, error) and the rest still go; errors that would hit every row
 * (token, network, busy, Drive) are thrown. Stops starting rows after the time limit.
 * options: { started, now }. Returns { made, refusedRows, notStarted }.
 */
function runExports_(items, read, make, done, refused, options) {
  const now = options.now || (() => Date.now());
  const result = { made: 0, refusedRows: [], notStarted: 0 };
  for (let i = 0; i < items.length; i++) {
    if (now() - options.started > EXPORT_TIME_LIMIT_MS) {
      result.notStarted = items.length - i;
      break;
    }
    const item = items.slice(i, i + 1)[0];
    let content;
    try {
      content = read(item);
    } catch (error) {
      if (!error.canvasType || CANVAS_STOP_ALL_TYPES.includes(error.canvasType)) throw error;
      refused(item, error);
      result.refusedRows.push(item.row);
      continue;
    }
    done(item, content, make(item, content));
    result.made++;
  }
  return result;
}

/** Reads one item from Canvas: { title, html, url }. */
function fetchCanvasContent_(item) {
  const spec = EXPORT_TYPES[item.type];
  const id = item.type === 'pages' ? encodeURIComponent(item.itemId) : item.itemId;
  const data = canvasGet_(`/courses/${item.courseId}/${item.type}/${id}`);
  return {
    title: String(data[spec.title] || '').trim(),
    html: String(data[spec.html] || ''),
    url: String(data.html_url || ''),
  };
}

/** The Doc's HTML: title as a heading, a link back to Canvas, then Canvas's content. */
function buildExportHtml_(content, pastedLink) {
  const title = escapeHtml_(content.title || 'Untitled (from Canvas)');
  const href = escapeHtml_(content.url || pastedLink).replace(/"/g, '&quot;');
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + title +
    '</title></head><body><h1>' + title + '</h1><p><a href="' + href +
    '">Open in Canvas</a></p>' + (content.html.trim() || '<p>(No content in Canvas.)</p>') +
    '</body></html>';
}

/** Short note text for a row Canvas refused, from the error type only. */
function exportRefusedNote_(type) {
  if (type === 'NOT_FOUND') return 'Not exported: not found in Canvas (404)';
  if (type === 'NOT_ALLOWED') return 'Not exported: not allowed (403)';
  const code = String(type).match(/^HTTP_(\d+)$/);
  return code ? `Not exported: Canvas error (HTTP ${code[1]})` : 'Not exported: Canvas error';
}

// ---- Google Drive ----

/**
 * The folder for this tab's Docs: { id, name, created }. Uses the link in B3 if there is
 * one (it must be a folder this script made); otherwise makes a folder in My Drive named
 * from B2 and writes its link to B3.
 */
function exportFolder_(sheet) {
  const link = String(sheet.getRange(EXPORT_FOLDER_LINK_CELL).getDisplayValue()).trim();
  if (link) {
    const id = folderIdFromLink_(link);
    let folder = null;
    if (id) {
      try {
        folder = driveRequest_('get', `${DRIVE_API}/${encodeURIComponent(id)}` +
          '?fields=id,name,mimeType,trashed');
      } catch (error) {
        if (!error.driveCode || ![403, 404].includes(error.driveCode)) throw error;
      }
    }
    if (!folder || folder.mimeType !== DRIVE_FOLDER_TYPE || folder.trashed) {
      throw sheetProblem_(`The script can't use the folder in ${EXPORT_FOLDER_LINK_CELL}. ` +
        'It can only use folders it made itself, and not ones in the trash. Clear ' +
        `${EXPORT_FOLDER_LINK_CELL} to have it make a new folder named from ` +
        `${EXPORT_FOLDER_NAME_CELL}.`);
    }
    return { id: folder.id, name: folder.name, created: false };
  }
  const name = String(sheet.getRange(EXPORT_FOLDER_NAME_CELL).getDisplayValue()).trim();
  if (!name) {
    throw sheetProblem_(`Type a name for the Docs folder in ${EXPORT_FOLDER_NAME_CELL}.`);
  }
  const folder = driveRequest_('post', `${DRIVE_API}?fields=id,webViewLink`,
    { contentType: 'application/json',
      payload: JSON.stringify({ name, mimeType: DRIVE_FOLDER_TYPE }) });
  sheet.getRange(EXPORT_FOLDER_LINK_CELL).setValue(folder.webViewLink);
  return { id: folder.id, name, created: true };
}

/** Uploads HTML as a new Google Doc in the folder; returns { id, webViewLink }. */
function createDocFromHtml_(name, folderId, html) {
  const boundary = 'export-' + Utilities.getUuid();
  const body = multipartBody_(boundary,
    { name, mimeType: DRIVE_DOC_TYPE, parents: [folderId] }, html);
  return driveRequest_('post', `${DRIVE_UPLOAD_API}?uploadType=multipart&fields=id,webViewLink`,
    { contentType: `multipart/related; boundary=${boundary}`,
      payload: Utilities.newBlob(body).getBytes() });
}

/** Drive's two-part upload body: the file's settings (JSON), then its HTML. */
function multipartBody_(boundary, metadata, html) {
  return `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n--${boundary}\r\n` +
    `Content-Type: text/html; charset=UTF-8\r\n\r\n${html}\r\n--${boundary}--`;
}

/**
 * One Drive request with the script's own Google sign-in (drive.file scope). Errors say
 * the HTTP code only; error.driveCode holds it. Never logs the token or file contents.
 */
function driveRequest_(method, url, extra) {
  const options = Object.assign({
    method,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true,
  }, extra || {});
  let response;
  try {
    response = UrlFetchApp.fetch(url, options);
  } catch {
    throw sheetProblem_('Could not reach Google Drive. Try again in a minute.');
  }
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    const error = sheetProblem_(`Google Drive refused the request (HTTP ${code}).`);
    error.driveCode = code;
    throw error;
  }
  return JSON.parse(response.getContentText());
}
