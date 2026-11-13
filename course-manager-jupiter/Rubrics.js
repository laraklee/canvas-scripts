/**
 * Rubrics.js
 * Purpose: "Export rubric for Canvas" (function exportRubricToCanvasFormat; same name as
 *   legacy, so a copied button still works). Reads the rubric tab being viewed (Lara copies
 *   a rubric template tab for each rubric) and writes the rubricCanvasExport tab in
 *   Canvas's rubric-import layout. Lara downloads that tab as CSV and imports it in Canvas
 *   (Rubrics › Import). Nothing is sent to Canvas.
 *   The rubric tab is found by the labels in column A, so rows can move:
 *   - "Rubric Title": the title is in the cell just below it.
 *   - "Criterion Description": descriptions in that row from column B; the criterion
 *     names are in the row just above it.
 *   - "Rating N Name", "Rating N Description", "Rating N Points" (N = 1, 2, …): one group
 *     of rows per rating, exported in N order.
 *   Every column from B is a criterion. A criterion with no ratings (e.g. a "Criterion 5"
 *   placeholder) is skipped silently; so is a blank rating. A rating with a name but no
 *   points (or points but no name), or ratings with no criterion name, stop the export
 *   with the cells to fix, and the export tab is not changed.
 *   Ported from legacy exportRubricToCanvasFormat, which read fixed cells that no longer
 *   match the template (title from A1, two rows per rating, no rating descriptions, five
 *   criteria). Legacy setupRubricUI is not ported (it never ran; Lara copies a template).
 *   No student data. Logs counts only.
 * Canvas endpoints called: none. Canvas write operations: none.
 * Required User/Script Properties: none.
 */

/** Pop-up title: the tool's Course Manager Tools menu label (2026-11-12). */
const RUBRIC_TITLE = "Turn this tab's rubric into a Canvas file";

const RUBRIC_TITLE_LABEL = 'Rubric Title';
const RUBRIC_DESCRIPTION_LABEL = 'Criterion Description';
const RUBRIC_RATING_LABEL = /^Rating (\d+) (Name|Description|Points)$/;
const RUBRIC_EXPORT_HEADERS = Object.freeze(['Rubric Name', 'Criteria Name',
  'Criteria Description', 'Criteria Enable Range']);
const RUBRIC_RATING_HEADERS = Object.freeze(['Rating Name', 'Rating Description',
  'Rating Points']);

/**
 * Button / menu: Export rubric for Canvas. Reads the rubric tab being viewed and replaces
 * the rubricCanvasExport tab (created if missing) with Canvas's import layout.
 */
function exportRubricToCanvasFormat() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  try {
    const sheet = ss.getActiveSheet();
    if (sheet.getName() === TOOL_SHEETS.RUBRIC_EXPORT) {
      throw sheetProblem_('Run this from your rubric tab, not the export tab.');
    }
    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();
    if (!lastRow || !lastColumn) throw sheetProblem_('This tab is empty.');
    const range = sheet.getRange(1, 1, lastRow, lastColumn);
    const result = buildRubricExport_(range.getValues(),
      range.getDisplayValues().map(row => row.map(value => String(value).trim())));
    if (result.problems.length) {
      ui.alert(RUBRIC_TITLE, 'The export tab was not changed. Please fix:\n• ' +
        result.problems.join('\n• '), ui.ButtonSet.OK);
      return;
    }

    let exportSheet = ss.getSheetByName(TOOL_SHEETS.RUBRIC_EXPORT);
    if (!exportSheet) exportSheet = ss.insertSheet(TOOL_SHEETS.RUBRIC_EXPORT);
    exportSheet.clearContents();
    exportSheet.getRange(1, 1, result.rows.length, result.rows[0].length).setValues(result.rows);
    exportSheet.getRange(1, 1, 1, result.rows[0].length).setFontWeight('bold');

    const criteria = result.rows.length - 1;
    console.log(`Export rubric: ${criteria} criteria, ${result.ratingColumns} rating ` +
      `column group(s), ${result.skipped} empty criteria skipped.`);
    ui.alert(RUBRIC_TITLE, `"${result.title}": ${criteria} criteria written to ` +
      `${TOOL_SHEETS.RUBRIC_EXPORT}` + (result.skipped ? ` (${result.skipped} empty ` +
      'criteria skipped)' : '') + '.\n\nNext: open that tab, then File › Download › ' +
      'Comma-separated values (.csv), and import the file in Canvas (Rubrics › Import).',
    ui.ButtonSet.OK);
  } catch (error) {
    reportRefreshFailure_(RUBRIC_TITLE, 'The export tab was not changed.', error);
  }
}

/**
 * Builds the export rows from the rubric tab's values (cells) and displayed text (shown).
 * Returns { rows (header first), title, ratingColumns, skipped, problems }. Problems
 * name cells (e.g. "D7") and never block on placeholders.
 */
function buildRubricExport_(cells, shown) {
  const problems = [];
  const columnA = shown.map(row => row.slice(0, 1)[0] || '');
  const rowOf = label => {
    const rows = columnA.map((text, i) => (text === label ? i + 1 : 0)).filter(Boolean);
    if (rows.length !== 1) {
      problems.push(rows.length ? `"${label}" appears ${rows.length} times in column A; ` +
        'keep one.' : `column A has no "${label}" label.`);
    }
    return rows.length ? rows[0] : 0;
  };
  const at = (grid, row, column) =>
    String(grid.slice(row - 1, row)[0].slice(column - 1, column)[0] ?? '').trim();
  const cellAt = (row, column) => cells.slice(row - 1, row)[0].slice(column - 1, column)[0];

  const titleRow = rowOf(RUBRIC_TITLE_LABEL);
  const descriptionRow = rowOf(RUBRIC_DESCRIPTION_LABEL);
  const title = titleRow && titleRow < shown.length ? at(shown, titleRow + 1, 1) : '';
  if (titleRow && !title) problems.push(`the title (A${titleRow + 1}) is blank.`);
  if (descriptionRow === 1) problems.push(`"${RUBRIC_DESCRIPTION_LABEL}" can't be in row 1.`);

  // Rating rows by number: { number: { Name: row, Description: row, Points: row } }.
  const ratingRows = new Map();
  columnA.forEach((text, i) => {
    const match = text.match(RUBRIC_RATING_LABEL);
    if (!match) return;
    const number = Number(match[1]);
    if (!ratingRows.has(number)) ratingRows.set(number, {});
    Object.assign(ratingRows.get(number), { [match[2]]: i + 1 });
  });
  const ratingNumbers = Array.from(ratingRows.keys()).sort((a, b) => a - b);
  ratingNumbers.forEach(number => {
    const parts = ratingRows.get(number);
    ['Name', 'Description', 'Points'].filter(part => !(part in parts)).forEach(part =>
      problems.push(`column A has no "Rating ${number} ${part}" label.`));
  });
  if (!ratingNumbers.length) problems.push('column A has no "Rating 1 Name" labels.');
  if (problems.length) return { rows: [], title, ratingColumns: 0, skipped: 0, problems };

  const width = shown.reduce((max, row) => Math.max(max, row.length), 0);
  const criteria = [];
  let skipped = 0;
  for (let column = 2; column <= width; column++) {
    const name = at(shown, descriptionRow - 1, column);
    const letter = cellName_(1, column).replace(/\d+$/, '');
    const ratings = [];
    ratingNumbers.forEach(number => {
      const rows = ratingRows.get(number);
      const ratingName = at(shown, rows.Name, column);
      const description = at(shown, rows.Description, column);
      const pointsText = at(shown, rows.Points, column);
      if (!ratingName && !description && !pointsText) return;
      if (!ratingName) {
        problems.push(`${letter}${rows.Name}: Rating ${number} has points or a description ` +
          'but no name.');
      } else if (!pointsText) {
        problems.push(`${letter}${rows.Points}: Rating ${number} ("${ratingName}") has no points.`);
      } else if (isNaN(Number(cellAt(rows.Points, column)))) {
        problems.push(`${letter}${rows.Points}: Rating ${number} points must be a number.`);
      } else {
        ratings.push([ratingName, description, Number(cellAt(rows.Points, column))]);
      }
    });
    if (!ratings.length) {
      if (name || at(shown, descriptionRow, column)) skipped++;
      continue;
    }
    if (!name) {
      problems.push(`${letter}${descriptionRow - 1}: this criterion has ratings but no name.`);
      continue;
    }
    criteria.push({ name, description: at(shown, descriptionRow, column), ratings });
  }
  if (!problems.length && !criteria.length) problems.push('no criterion has any ratings.');
  if (problems.length) return { rows: [], title, ratingColumns: 0, skipped, problems };

  // One Name/Description/Points group per rating, as wide as the criterion with the most.
  const ratingColumns = Math.max(...criteria.map(criterion => criterion.ratings.length));
  const header = RUBRIC_EXPORT_HEADERS.concat(...Array(ratingColumns).fill(RUBRIC_RATING_HEADERS));
  const rows = [header].concat(criteria.map(criterion => {
    const row = [title, criterion.name, criterion.description, 'FALSE']
      .concat(...criterion.ratings);
    return row.concat(Array(header.length - row.length).fill(''));
  }));
  return { rows, title, ratingColumns, skipped, problems };
}
