/**
 * CourseContentList.js
 * Purpose: step 1 of the course backup tool (Lara, 2026-10-25). listCourseContent (menu:
 *   Canvas Tools › List course content (this tab)) fills the Export to Google Docs tab
 *   (ExportToDocs.js; same B1/C1 folder cells and row 3 labels) with one row per
 *   assignment, discussion, and page in a course, plus the syllabus and the course home
 *   page, so Lara can tick which ones to back up (Export then does only ticked rows).
 *   Course: the number in B2 (label "Course ID:" in A2), or this workbook's cfg_CourseID
 *   when B2 is blank, so any course she teaches can be listed from one workbook.
 *   Rows already on the tab are matched by their Canvas link and stay where they are: their
 *   Canvas Link, Google Doc, Exported, and Back up? cells are never changed; only Name,
 *   Type, Published, and Canvas Updated are refreshed. New items go below the last row
 *   with a Canvas link, each with an unticked Back up? box. Rows whose item is no longer
 *   in Canvas are left alone and counted. Optional row 3 labels, each filled only if it is
 *   there: Name, Type, Published, Canvas Updated, Back up?. Graded discussions are listed
 *   once (as discussions); quizzes are left out for now (not in v1).
 *   Step 3: a row with a Google Doc whose Canvas last-updated date is after its Exported
 *   date gets a light yellow Google Doc cell and the note "Changed in Canvas since export";
 *   the mark comes off on a later run once that's no longer true (only this tool's yellow
 *   and note). Needs the Exported column. Discussions and the syllabus have no Canvas date,
 *   so they are never marked.
 * Canvas endpoints called (GET via canvasGet_):
 *   /api/v1/courses/:course?include[]=syllabus_body
 *   /api/v1/courses/:course/assignments
 *   /api/v1/courses/:course/discussion_topics
 *   /api/v1/courses/:course/pages
 * Canvas write operations: none (read-only, so DRY_RUN doesn't apply). Google Drive: none.
 * Required: User Properties CANVAS_BASE_URL and CANVAS_TOKEN; named range cfg_CourseID
 *   (used when B2 is blank).
 */

const CONTENT_COURSE_ID_CELL = 'B2';
const CONTENT_COURSE_ID_LABEL_CELL = 'A2';
const CONTENT_COURSE_ID_LABEL = 'Course ID:';
const CONTENT_TYPE_NAMES = new Map([
  ['syllabus', 'Syllabus'],
  ['front_page', 'Home page'],
  ['assignments', 'Assignment'],
  ['discussion_topics', 'Discussion'],
  ['pages', 'Page'],
]);
// Step 3: a Google Doc cell whose item changed in Canvas after its Exported date.
const CONTENT_CHANGED_COLOR = '#fff2cc'; // light yellow
const CONTENT_CHANGED_NOTE = 'Changed in Canvas since export';
// Assignments that are really a discussion (listed as one) or a quiz (not in v1).
const CONTENT_SKIP_SUBMISSION_TYPES = Object.freeze(['discussion_topic', 'online_quiz']);

/**
 * Menu: Canvas Tools › List course content (this tab). Reads Canvas only; on the tab it
 * refreshes the info cells of rows already there and adds new items at the bottom.
 */
function listCourseContent() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const title = 'List everything in the course on this tab'; // menu label (2026-11-12)
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(1000)) {
    ui.alert(title, 'An export or list is already running. Wait for it to finish.',
      ui.ButtonSet.OK);
    return;
  }
  try {
    const sheet = ss.getActiveSheet();
    const table = findExportTable_(sheet.getRange(1, 1,
      Math.min(EXPORT_LABEL_SEARCH_ROWS, Math.max(sheet.getLastRow(), 1)),
      Math.max(sheet.getLastColumn(), 1)).getDisplayValues());
    const courseId = contentCourseId_(sheet);

    ss.toast('Reading the course from Canvas…', title, -1);
    const course = canvasStep_('course request', () =>
      canvasGet_(`/courses/${courseId}`, { 'include[]': 'syllabus_body' }));
    const asList = data => (Array.isArray(data) ? data : []);
    const items = contentItems_(courseId, getCanvasCredentials_().baseUrl, course,
      asList(canvasStep_('assignments request', () =>
        canvasGet_(`/courses/${courseId}/assignments`))),
      asList(canvasStep_('discussions request', () =>
        canvasGet_(`/courses/${courseId}/discussion_topics`))),
      asList(canvasStep_('pages request', () => canvasGet_(`/courses/${courseId}/pages`))));

    const firstRow = table.headerRow + 1;
    const rows = Math.max(sheet.getLastRow() - table.headerRow, 0);
    const linkCol = table.columns.get(EXPORT_LABELS.LINK);
    let links = [];
    if (rows) {
      const cells = sheet.getRange(firstRow, linkCol, rows, 1);
      links = cellLinks_(cells.getRichTextValues(), cells.getFormulas(), cells.getDisplayValues())
        .map(cell => cell.slice(0, 1)[0]);
    }
    const plan = planContentList_(items, links, courseId);
    const infoColumns = contentInfoColumns_(table.columns);

    // Rows already on the tab: refresh only their info cells; other rows keep their
    // values and formulas.
    if (plan.matches.size) {
      infoColumns.forEach(({ column, value }) => {
        const range = sheet.getRange(firstRow, column, rows, 1);
        const formulas = range.getFormulas();
        range.setValues(range.getValues().map((cells, i) => {
          if (plan.matches.has(i)) return [value(plan.matches.get(i))];
          return [formulas.slice(i, i + 1)[0].slice(0, 1)[0] || cells.slice(0, 1)[0]];
        }));
      });
    }

    // Step 3: mark Docs whose item changed in Canvas since export; unmark ones that
    // didn't (only this tool's yellow and note come off).
    const exportedCol = table.columns.get(EXPORT_LABELS.EXPORTED);
    let changed = 0;
    if (plan.matches.size && exportedCol) {
      const docCells = sheet.getRange(firstRow, table.columns.get(EXPORT_LABELS.DOC), rows, 1);
      const flags = planChangeFlags_(plan.matches, docCells.getDisplayValues(),
        sheet.getRange(firstRow, exportedCol, rows, 1).getValues());
      const marks = applyChangeFlags_(flags, docCells.getBackgrounds(), docCells.getNotes());
      changed = marks.changed;
      if (marks.touched) docCells.setBackgrounds(marks.backgrounds).setNotes(marks.notes);
    }

    // New items below the last row that has a Canvas link.
    const added = plan.newItems.length;
    if (added) {
      const start = firstRow + plan.lastLinkIndex + 1;
      sheet.getRange(start, linkCol, added, 1).setValues(plan.newItems.map(item => [item.link]));
      infoColumns.forEach(({ column, value }) => {
        sheet.getRange(start, column, added, 1)
          .setValues(plan.newItems.map(item => [value(item)]));
      });
      const backupCol = table.columns.get(EXPORT_LABELS.BACKUP);
      if (backupCol) {
        sheet.getRange(start, backupCol, added, 1).insertCheckboxes().setValue(false);
      }
    }
    ss.toast('', title, 1);

    const name = String(course.name || '').trim() || 'this course';
    console.log(`List course content: course ${courseId}, ${items.length} item(s), ` +
      `${added} added, ${plan.matches.size} row(s) refreshed, ${plan.gone} gone, ` +
      `${changed} changed since export.`);
    ui.alert(title, `"${name}" (course ${courseId}): ${items.length} item(s) in Canvas.\n\n` +
      `${added} new item(s) added at the bottom` + (added && table.columns.has(EXPORT_LABELS.BACKUP) ?
        ' (Back up? unticked)' : '') + `; ${plan.matches.size} row(s) already here were ` +
      'refreshed.' +
      (changed ? `\n\n${changed} exported item(s) changed in Canvas since export: their ` +
        'Google Doc cells are light yellow. To redo one, delete its Doc link, tick ' +
        `"${EXPORT_LABELS.BACKUP}", and Export again. (Discussions and the syllabus have ` +
        'no Canvas date, so they are never marked.)' : '') +
      (plan.gone ? `\n\n${plan.gone} row(s) for this course are no longer in Canvas ` +
        '(deleted or renamed page); they were left alone.' : '') +
      (table.columns.has(EXPORT_LABELS.BACKUP) ? '' : `\n\nTip: add a "${EXPORT_LABELS.BACKUP}" ` +
        'label in the label row so you can tick which items to export. Export does ' +
        'only ticked rows, so without it nothing is exported.') +
      '\n\nQuizzes are not listed yet.', ui.ButtonSet.OK);
  } catch (error) {
    reportRefreshFailure_(title, 'Listing stopped.', error);
  } finally {
    lock.releaseLock();
  }
}

/** The course to list: B2, or cfg_CourseID when B2 is blank. Labels A2 if it's empty. */
function contentCourseId_(sheet) {
  const typed = String(sheet.getRange(CONTENT_COURSE_ID_CELL).getDisplayValue()).trim();
  const label = sheet.getRange(CONTENT_COURSE_ID_LABEL_CELL);
  if (!String(label.getDisplayValue()).trim()) label.setValue(CONTENT_COURSE_ID_LABEL);
  if (!typed) return getCourseIdForRefresh_();
  if (!/^\d+$/.test(typed)) {
    throw sheetProblem_(`${CONTENT_COURSE_ID_CELL} should be a Canvas course number (the ` +
      'number after /courses/ in the course\'s address), or blank for this workbook\'s course.');
  }
  return typed;
}

/** The optional info columns on the tab: [{ column, value(item) }]. */
function contentInfoColumns_(columns) {
  return [
    [EXPORT_LABELS.NAME, item => item.name],
    [EXPORT_LABELS.TYPE, item => item.typeName],
    [EXPORT_LABELS.PUBLISHED, item => item.published],
    [EXPORT_LABELS.UPDATED, item => (item.updated ? new Date(item.updated) : '')],
  ].filter(([label]) => columns.has(label))
    .map(([label, value]) => ({ column: columns.get(label), value }));
}

/**
 * One item per thing to back up, in tab order: syllabus (if it has text), home page,
 * assignments, discussions, pages. Each: { type, typeName, name, published ("Yes"/"No"/""),
 * updated (Canvas date text or ""), link, keys }. keys are what a row's link must match
 * (the home page matches both its page link and the course home link).
 */
function contentItems_(courseId, baseUrl, course, assignments, discussions, pages) {
  const root = `${baseUrl}/courses/${courseId}`;
  const yesNo = value => (value === true ? 'Yes' : value === false ? 'No' : '');
  const make = (type, name, published, updated, link, extraKeys) => {
    const parsed = parseCanvasContentLink_(link);
    return {
      type, typeName: CONTENT_TYPE_NAMES.get(type), name: String(name || '').trim(),
      published: yesNo(published), updated: String(updated || ''), link,
      keys: (parsed ? [contentLinkKey_(parsed)] : []).concat(extraKeys || []),
    };
  };
  const pageLink = page => page.html_url || `${root}/pages/${page.url}`;
  const items = [];
  if (String(course.syllabus_body || '').trim()) {
    items.push(make('syllabus', 'Syllabus', null, '', `${root}/assignments/syllabus`));
  }
  pages.filter(page => page.front_page).forEach(page => items.push(make('front_page',
    page.title, page.published, page.updated_at, pageLink(page),
    [contentLinkKey_({ type: 'front_page', courseId, itemId: '' })])));
  assignments.filter(a => ![].concat(a.submission_types || [])
    .some(type => CONTENT_SKIP_SUBMISSION_TYPES.includes(type)))
    .forEach(a => items.push(make('assignments', a.name, a.published, a.updated_at,
      a.html_url || `${root}/assignments/${a.id}`)));
  discussions.forEach(d => items.push(make('discussion_topics', d.title, d.published,
    d.updated_at, d.html_url || `${root}/discussion_topics/${d.id}`)));
  pages.filter(page => !page.front_page).forEach(page => items.push(make('pages', page.title,
    page.published, page.updated_at, pageLink(page))));
  return items;
}

/**
 * Which Google Doc cells to mark (step 3). For each row already on the tab (matches: row
 * index → item) that has a Doc link: true if Canvas's last-updated date is after the
 * row's Exported date, otherwise false (no date on either side counts as unchanged:
 * discussions and the syllabus have no Canvas date). docs and exported are one-column
 * grids. Returns Map row index → true/false.
 */
function planChangeFlags_(matches, docs, exported) {
  const flags = new Map();
  matches.forEach((item, i) => {
    if (!String(docs.slice(i, i + 1)[0].slice(0, 1)[0]).trim()) return;
    const exportedAt = sheetDate_(exported.slice(i, i + 1)[0].slice(0, 1)[0]);
    const updatedAt = sheetDate_(item.updated);
    flags.set(i, Boolean(exportedAt && updatedAt && updatedAt.getTime() > exportedAt.getTime()));
  });
  return flags;
}

/**
 * New backgrounds and notes for the Doc column: changed rows get the yellow and note;
 * unchanged rows lose only this tool's yellow and note (colors and notes Lara set stay).
 * Returns { backgrounds, notes, changed, touched }.
 */
function applyChangeFlags_(flags, backgrounds, notes) {
  const out = { backgrounds: backgrounds.map(row => row.slice()),
    notes: notes.map(row => row.slice()), changed: 0, touched: false };
  flags.forEach((isChanged, i) => {
    const bgRow = out.backgrounds.slice(i, i + 1)[0];
    const noteRow = out.notes.slice(i, i + 1)[0];
    const ours = String(bgRow.slice(0, 1)[0]).toLowerCase() === CONTENT_CHANGED_COLOR;
    if (isChanged) {
      out.changed++;
      bgRow.splice(0, 1, CONTENT_CHANGED_COLOR);
      noteRow.splice(0, 1, CONTENT_CHANGED_NOTE);
      out.touched = true;
    } else {
      if (ours) {
        bgRow.splice(0, 1, null);
        out.touched = true;
      }
      if (noteRow.slice(0, 1)[0] === CONTENT_CHANGED_NOTE) {
        noteRow.splice(0, 1, '');
        out.touched = true;
      }
    }
  });
  return out;
}

/** A Date from a sheet value (Date) or Canvas date text, or null if blank or unreadable. */
function sheetDate_(value) {
  if (value === '' || value === null || value === undefined) return null;
  const date = Object.prototype.toString.call(value) === '[object Date]' ?
    value : new Date(String(value));
  return isNaN(date.getTime()) ? null : date;
}

/** A link's match key, e.g. "pages:12:lab-safety" (page names ignore capitals). */
function contentLinkKey_(parsed) {
  return `${parsed.type}:${parsed.courseId}:${String(parsed.itemId).toLowerCase()}`;
}

/**
 * Matches Canvas items to the tab's rows. links = each row's address (from cellLinks_),
 * starting at the first data row. Returns { matches: Map row index → item, newItems,
 * gone (rows for this course with no match in Canvas), lastLinkIndex (-1 if none) }.
 */
function planContentList_(items, links, courseId) {
  const byKey = new Map();
  items.forEach(item => item.keys.forEach(key => byKey.set(key, item)));
  const matches = new Map();
  const found = new Set();
  let gone = 0;
  let lastLinkIndex = -1;
  links.forEach((link, i) => {
    if (String(link).trim()) lastLinkIndex = i;
    const parsed = parseCanvasContentLink_(link);
    if (!parsed) return;
    const item = byKey.get(contentLinkKey_(parsed));
    if (item) {
      matches.set(i, item);
      found.add(item);
    } else if (parsed.courseId === String(courseId)) {
      gone++;
    }
  });
  return { matches, newItems: items.filter(item => !found.has(item)), gone, lastLinkIndex };
}
