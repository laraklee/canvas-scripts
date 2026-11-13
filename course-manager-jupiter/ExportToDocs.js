/**
 * ExportToDocs.js
 * Purpose: copies Canvas assignment, discussion, and page content into Google Docs, one
 *   Doc per row, on the tab being viewed (any tab name; recognized by its labels).
 *   exportCanvasToDocs (menu: Canvas Tools › Export to Google Docs).
 *   Tab layout (Lara, 2026-10-25): B1 = the folder name you want; C1 = the folder's link,
 *   written by the script the first time it makes the folder (in My Drive; move or rename
 *   it in Drive any time, the link keeps working). A label row with "Canvas Link" and
 *   "Google Doc" (plus optional "Name" and "Exported") somewhere in rows 1–10 (Lara uses
 *   row 3); data below.
 *   Paste an assignment, discussion, page, course home, or syllabus link from Canvas
 *   (typed, or a blue link showing other text); rows that already have a
 *   Google Doc link are skipped (delete the link to export again). Only rows ticked
 *   in the "Back up?" column export (filled by List course content, CourseContentList.js);
 *   a tab with no Back up? column exports nothing (Lara, 2026-10-25: never make a Doc by
 *   default). Export asks Yes/No with the count first. The Doc gets the
 *   item's title, a link back to Canvas, and its content. Pictures stored in Canvas are
 *   downloaded by the script and put inside the Doc (Google can't log in to Canvas to
 *   fetch them itself); pictures from other sites are left for Google to fetch. A picture
 *   that can't be downloaded is just missing; the Doc is still made.
 *   Discussions: only the teacher's prompt is read, never student replies.
 * Canvas endpoints called (GET via canvasGet_; the course comes from each link):
 *   /api/v1/courses/:course/assignments/:id
 *   /api/v1/courses/:course/discussion_topics/:id
 *   /api/v1/courses/:course/pages/:page_url
 *   /api/v1/courses/:course/front_page (course home link, /courses/:course)
 *   /api/v1/courses/:course?include[]=syllabus_body (syllabus link)
 *   /api/v1/files/:id (a picture's details and temporary download link; the picture
 *   itself is then downloaded from that link without the Canvas token)
 * Canvas write operations: none (read-only, so DRY_RUN doesn't apply).
 * Google Drive (Advanced Drive service v3, scope drive.file: the script can see only
 *   files and folders it made itself): creates the export folder, its Assignments /
 *   Discussions / Pages subfolders (when first needed; syllabus and home page Docs stay at
 *   the top), and each Doc (HTML converted to a Google Doc), and checks the C1 folder
 *   still exists. The Advanced
 *   service (not UrlFetchApp) because Drive answered "accessNotConfigured" to direct
 *   calls: turning the service on also turns on the Drive API for the script.
 * Required: User Properties CANVAS_BASE_URL and CANVAS_TOKEN.
 */

const EXPORT_FOLDER_NAME_CELL = 'B1';
const EXPORT_FOLDER_LINK_CELL = 'C1';
const EXPORT_LABEL_SEARCH_ROWS = 10;
const EXPORT_LABELS = Object.freeze({
  LINK: 'Canvas Link',
  DOC: 'Google Doc',
  NAME: 'Name',
  EXPORTED: 'Exported',
  // Filled by List course content (CourseContentList.js); Back up? also limits Export.
  TYPE: 'Type',
  PUBLISHED: 'Published',
  UPDATED: 'Canvas Updated',
  BACKUP: 'Back up?',
});
const EXPORT_REFUSED_COLOR = '#f4cccc'; // light red, same as Post comments
const EXPORT_TIME_LIMIT_MS = 5 * 60 * 1000;
const EXPORT_IMAGE_MAX_BYTES = 5 * 1024 * 1024; // bigger pictures are left as links
const DRIVE_FOLDER_TYPE = 'application/vnd.google-apps.folder';
const DRIVE_DOC_TYPE = 'application/vnd.google-apps.document';
// Subfolder (inside the C1 folder) for each type; the syllabus and home page stay at the
// top (Lara, 2026-10-25).
const EXPORT_SUBFOLDERS = new Map([
  ['assignments', 'Assignments'],
  ['discussion_topics', 'Discussions'],
  ['pages', 'Pages'],
]);
// Which Canvas request each link type makes, and which fields hold the title and content.
const EXPORT_TYPES = Object.freeze({
  assignments: { label: 'assignment', title: 'name', html: 'description' },
  discussion_topics: { label: 'discussion', title: 'title', html: 'message' },
  pages: { label: 'page', title: 'title', html: 'body' },
  front_page: { label: 'course home page', title: 'title', html: 'body' },
  // syllabus is read from the course itself (see fetchCanvasContent_).
});

/**
 * Menu: Canvas Tools › Export to Google Docs (this tab).
 * Each row's cells are written as soon as its Doc is made, so a stop part-way leaves an
 * accurate record and a rerun does only the rest.
 */
function exportCanvasToDocs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const title = 'Back up course to Google Docs'; // menu label (2026-11-12)
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
    // Only ticked rows are ever exported (Lara, 2026-10-25): no Back up? column, no Docs.
    const backupCol = table.columns.get(EXPORT_LABELS.BACKUP);
    if (!backupCol) {
      ui.alert(title, `This tab has no "${EXPORT_LABELS.BACKUP}" column, so nothing was ` +
        `exported. Add a "${EXPORT_LABELS.BACKUP}" label in row ${table.headerRow} (next to ` +
        `"${EXPORT_LABELS.LINK}"), put a checkbox on each row (Insert › Checkbox), and tick ` +
        'the rows to export.', ui.ButtonSet.OK);
      return;
    }
    const plan = planExports_(
      cellLinks_(linkCells.getRichTextValues(), linkCells.getFormulas(),
        linkCells.getDisplayValues()),
      sheet.getRange(table.headerRow + 1, docCol, rows, 1).getDisplayValues(),
      table.headerRow + 1,
      sheet.getRange(table.headerRow + 1, backupCol, rows, 1).getValues());
    if (!plan.exports.length && !plan.badLinks.length) {
      ui.alert(title, `Nothing to export: tick "${EXPORT_LABELS.BACKUP}" on rows with a ` +
        'Canvas link and no Google Doc link.' +
        (plan.alreadyDone ? ` ${plan.alreadyDone} row(s) already have a Doc (delete the ` +
          'link to export again).' : ''), ui.ButtonSet.OK);
      return;
    }
    if (plan.exports.length) {
      const answer = ui.alert(title, exportConfirmText_(plan),
        ui.ButtonSet.YES_NO);
      if (answer !== ui.Button.YES) {
        ui.alert(title, 'Cancelled. No Docs were made.', ui.ButtonSet.OK);
        return;
      }
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
      'discussion, page, course home, or syllabus link from Canvas', true));

    let result = { made: 0, refusedRows: [], notStarted: 0 };
    let folder = null;
    const pictures = { embedded: 0, missed: 0 };
    if (plan.exports.length) {
      ss.toast('Checking the Drive folder…', title, -1);
      folder = exportFolder_(sheet);
      ss.toast(`Exporting ${plan.exports.length} item(s)…`, title, -1);
      const baseUrl = getCanvasCredentials_().baseUrl;
      const loadImage = cachedLoader_(loadCanvasImage_);
      const folderFor = subfolderFinder_(folder.id);
      result = runExports_(plan.exports,
        item => {
          const content = fetchCanvasContent_(item);
          const embedded = embedCanvasImages_(content.html, baseUrl, loadImage);
          pictures.embedded += embedded.embedded;
          pictures.missed += embedded.missed;
          return Object.assign(content, { html: embedded.html });
        },
        (item, content) => createDocFromHtml_(content.title || 'Untitled (from Canvas)',
          folderFor(item.type), buildExportHtml_(content, item.link)),
        (item, content, doc) => {
          if (nameCol) sheet.getRange(item.row, nameCol).setValue(content.title);
          sheet.getRange(item.row, docCol).setValue(doc.webViewLink);
          if (exportedCol) sheet.getRange(item.row, exportedCol).setValue(new Date());
          markRow(item.row, '', false);
        },
        (item, error) => markRow(item.row, exportRefusedNote_(error.canvasType, item.type),
          true),
        { started });
    }
    ss.toast('', title, 1);

    const refused = result.refusedRows.concat(plan.badLinks).sort((a, b) => a - b);
    console.log(`Export to Docs: ${result.made} made, ${result.refusedRows.length} refused, ` +
      `${plan.badLinks.length} bad link(s), ${result.notStarted} not started, ` +
      `${plan.alreadyDone} already done; pictures ${pictures.embedded} put in, ` +
      `${pictures.missed} missed.`);
    ui.alert(title, `${result.made} Google Doc(s) made` +
      (folder && folder.created ? ` in the new folder "${folder.name}" (link in ` +
        `${EXPORT_FOLDER_LINK_CELL}; it's in My Drive, move it anywhere)` : '') + '.' +
      (pictures.embedded || pictures.missed ? `\nPictures stored in Canvas: ` +
        `${pictures.embedded} put into the Docs` + (pictures.missed ? `, ${pictures.missed} ` +
        'could not be downloaded (missing from the Doc)' : '') + '.' : '') +
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
 * Doc are required; the rest are optional. Capitals and extra spaces don't matter. A label
 * used twice stops the run.
 */
function findExportTable_(grid) {
  const isLabel = (value, label) => exportLabelText_(value) === exportLabelText_(label);
  const r = grid.findIndex(row => row.some(value => isLabel(value, EXPORT_LABELS.LINK)));
  if (r === -1) {
    throw sheetProblem_(`This tab has no "${EXPORT_LABELS.LINK}" label in rows 1–` +
      `${EXPORT_LABEL_SEARCH_ROWS}. Open your export tab first.`);
  }
  const columns = new Map();
  const row = grid.slice(r, r + 1)[0];
  Object.values(EXPORT_LABELS).forEach(label => {
    const found = row.map((value, c) => (isLabel(value, label) ? c + 1 : 0))
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

/** The Yes/No question before any Docs are made, with the counts. */
function exportConfirmText_(plan) {
  return `Make ${plan.exports.length} Google Doc(s)?\n\n` +
    `These are the rows ticked "${EXPORT_LABELS.BACKUP}" that have no Google Doc yet.` +
    (plan.notTicked ? ` ${plan.notTicked} unticked row(s) are skipped.` : '') +
    (plan.alreadyDone ? `\n${plan.alreadyDone} row(s) already have a Doc and are skipped.` : '') +
    '\n\nAbout a few seconds per Doc; a long list stops near 5 minutes (run Export again ' +
    'for the rest).';
}

/**
 * A label as compared: capitals and extra spaces ignored, so "Back Up?" matches
 * "Back up?" (Lara typed it that way, 2026-10-25, and Export missed the column).
 */
function exportLabelText_(value) {
  return String(value).trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Which rows to export. links and docs are one-column display-value grids starting at
 * firstRow. A row exports when it has a link and no Google Doc link, and, when ticks (the
 * Back up? column's values) is given, its box is ticked.
 * Returns { exports: [{ row, link, type, courseId, itemId }], badLinks: [row], alreadyDone,
 * notTicked }.
 */
function planExports_(links, docs, firstRow, ticks) {
  const plan = { exports: [], badLinks: [], alreadyDone: 0, notTicked: 0 };
  links.forEach((cells, i) => {
    const link = String(cells.slice(0, 1)[0]).trim();
    if (!link) return;
    if (String(docs.slice(i, i + 1)[0].slice(0, 1)[0]).trim()) {
      plan.alreadyDone++;
      return;
    }
    if (ticks && ticks.slice(i, i + 1)[0].slice(0, 1)[0] !== true) {
      plan.notTicked++;
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
 * Returns { type, courseId, itemId } or null. Types: assignments, discussion_topics,
 * pages (by URL name), front_page (the course home, /courses/1 or /courses/1/wiki), and
 * syllabus (/courses/1/assignments/syllabus). Assignment and discussion IDs must be
 * numbers.
 */
function parseCanvasContentLink_(link) {
  const text = String(link);
  const syllabus = text.match(/\/courses\/(\d+)\/assignments\/syllabus\/?(?:[?#]|$)/);
  if (syllabus) return { type: 'syllabus', courseId: syllabus[1], itemId: '' };
  const home = text.match(/\/courses\/(\d+)(?:\/wiki)?\/?(?:[?#]|$)/);
  if (home) return { type: 'front_page', courseId: home[1], itemId: '' };
  const match = text.match(
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
  const course = `/courses/${item.courseId}`;
  if (item.type === 'syllabus') {
    const data = canvasGet_(course, { 'include[]': 'syllabus_body' });
    return {
      title: `${String(data.name || 'Course').trim()} Syllabus`,
      html: String(data.syllabus_body || ''),
      url: '', // the pasted link is used
    };
  }
  const spec = EXPORT_TYPES[item.type];
  const path = item.type === 'front_page' ? `${course}/front_page` :
    `${course}/${item.type}/` +
      (item.type === 'pages' ? encodeURIComponent(item.itemId) : item.itemId);
  const data = canvasGet_(path);
  return {
    title: String(data[spec.title] || '').trim(),
    html: String(data[spec.html] || ''),
    url: String(data.html_url || ''),
  };
}

/**
 * Puts pictures stored in this Canvas inside the HTML. Each <img> whose address is on
 * this Canvas (starts with "/" or the Canvas address) and names a file (/files/123) gets
 * load(fileId) → { type, base64 } or null; found pictures become data: addresses that
 * Google can read without logging in. Other pictures are left alone. Returns
 * { html, embedded, missed }.
 */
function embedCanvasImages_(html, baseUrl, load) {
  const counts = { embedded: 0, missed: 0 };
  const out = String(html).replace(/(<img\b[^>]*?\bsrc\s*=\s*)(["'])([^"']*)\2/gi,
    (whole, start, quote, src) => {
      const fileId = canvasImageFileId_(src, baseUrl);
      if (!fileId) return whole;
      const image = load(fileId);
      if (!image) {
        counts.missed++;
        return whole;
      }
      counts.embedded++;
      return `${start}${quote}data:${image.type};base64,${image.base64}${quote}`;
    });
  return { html: out, embedded: counts.embedded, missed: counts.missed };
}

/** The Canvas file ID in a picture address on this Canvas, or '' (e.g. another site). */
function canvasImageFileId_(src, baseUrl) {
  const address = String(src).replace(/&amp;/g, '&').trim();
  const onCanvas = (address.startsWith('/') && !address.startsWith('//')) ||
    address.toLowerCase().startsWith(String(baseUrl).toLowerCase() + '/');
  const match = address.match(/\/files\/(\d+)(?:[/?#]|$)/);
  return onCanvas && match ? match[1] : '';
}

/** Wraps load(id) so each ID is looked up once per run (a picture used twice). */
function cachedLoader_(load) {
  const seen = new Map();
  return id => {
    if (!seen.has(id)) seen.set(id, load(id));
    return seen.get(id);
  };
}

/**
 * Downloads one picture stored in Canvas: { type, base64 }, or null if it isn't a
 * picture, is over 5 MB, or can't be downloaded. Canvas gives a temporary download link
 * (GET /files/:id); the picture comes from that link, never with the token. Token,
 * network, and busy errors still stop the export.
 */
function loadCanvasImage_(fileId) {
  let file;
  try {
    file = canvasGet_(`/files/${fileId}`);
  } catch (error) {
    if (!error.canvasType || CANVAS_STOP_ALL_TYPES.includes(error.canvasType)) throw error;
    return null;
  }
  const type = String(file['content-type'] || '');
  if (!/^image\/[\w.+-]+$/.test(type) || !file.url || Number(file.size) > EXPORT_IMAGE_MAX_BYTES) {
    return null;
  }
  try {
    const response = UrlFetchApp.fetch(file.url, { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) return null;
    return { type, base64: Utilities.base64Encode(response.getContent()) };
  } catch {
    return null;
  }
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

/** Short note text for a row Canvas refused, from the error type (and link type) only. */
function exportRefusedNote_(type, linkType) {
  if (type === 'NOT_FOUND' && linkType === 'front_page') {
    return 'Not exported: this course has no front page (its home is not set to a Page)';
  }
  if (type === 'NOT_FOUND') return 'Not exported: not found in Canvas (404)';
  if (type === 'NOT_ALLOWED') return 'Not exported: not allowed (403)';
  const code = String(type).match(/^HTTP_(\d+)$/);
  return code ? `Not exported: Canvas error (HTTP ${code[1]})` : 'Not exported: Canvas error';
}

// ---- Google Drive ----

/**
 * The folder for this tab's Docs: { id, name, created }. Uses the link in C1 if there is
 * one (it must be a folder this script made); otherwise makes a folder in My Drive named
 * from B1 and writes its link to C1.
 */
function exportFolder_(sheet) {
  const link = String(sheet.getRange(EXPORT_FOLDER_LINK_CELL).getDisplayValue()).trim();
  if (link) {
    const id = folderIdFromLink_(link);
    let folder = null;
    if (id) {
      try {
        folder = Drive.Files.get(id, { fields: 'id,name,mimeType,trashed' });
      } catch {
        folder = null; // not found, or not one the script made (drive.file)
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
  const folder = driveStep_('making the folder', () =>
    Drive.Files.create({ name, mimeType: DRIVE_FOLDER_TYPE }));
  sheet.getRange(EXPORT_FOLDER_LINK_CELL).setValue(driveFolderUrl_(folder.id));
  return { id: folder.id, name, created: true };
}

/** Uploads HTML as a new Google Doc in the folder; returns { id, webViewLink }. */
/**
 * Returns folderFor(type): the folder ID a Doc of that type goes in. Assignments,
 * discussions, and pages go in a subfolder of parentId (found by name, or made the first
 * time it's needed); other types (syllabus, home page) go in parentId. Each subfolder is
 * looked up once per run. A subfolder renamed in Drive isn't found, so a new one is made.
 */
function subfolderFinder_(parentId) {
  const found = new Map();
  return type => {
    const name = EXPORT_SUBFOLDERS.get(type);
    if (!name) return parentId;
    if (!found.has(name)) found.set(name, exportSubfolder_(parentId, name));
    return found.get(name);
  };
}

/** The ID of the folder named name inside parentId (made by the script), made if missing. */
function exportSubfolder_(parentId, name) {
  if (!/^[\w-]+$/.test(parentId)) throw sheetProblem_('The Docs folder link in C1 looks wrong.');
  const list = driveStep_(`finding the ${name} folder`, () => Drive.Files.list({
    q: `'${parentId}' in parents and name = '${name}' and ` +
      `mimeType = '${DRIVE_FOLDER_TYPE}' and trashed = false`,
    fields: 'files(id)',
    pageSize: 10,
  }));
  const existing = ((list && list.files) || []).slice(0, 1)[0];
  if (existing) return existing.id;
  return driveStep_(`making the ${name} folder`, () => Drive.Files.create(
    { name, mimeType: DRIVE_FOLDER_TYPE, parents: [parentId] })).id;
}

function createDocFromHtml_(name, folderId, html) {
  const doc = driveStep_('making a Doc', () => Drive.Files.create(
    { name, mimeType: DRIVE_DOC_TYPE, parents: [folderId] },
    Utilities.newBlob(html, 'text/html', 'export.html')));
  return { id: doc.id, webViewLink: driveDocUrl_(doc.id) };
}

function driveFolderUrl_(id) {
  return `https://drive.google.com/drive/folders/${id}`;
}

function driveDocUrl_(id) {
  return `https://docs.google.com/document/d/${id}/edit`;
}

/**
 * Runs one Drive call; on failure, a clear message with Google's own short explanation
 * (Drive errors name the problem, never file contents). Nothing is logged here.
 */
function driveStep_(label, work) {
  try {
    return work();
  } catch (error) {
    const why = String(error && error.message || '').replace(/^API call to [\w.]+ failed with error:\s*/i, '')
      .slice(0, 150);
    throw sheetProblem_(`Google Drive refused ${label}` + (why ? `: ${why}` : '.'));
  }
}

