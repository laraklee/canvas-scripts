/**
 * SeatingChart.js
 * Purpose: "Build seating chart" (function buildSeatingChart; menu item and Home button).
 *   Ported from the legacy createStudentTextBoxes. For each row of the cfg_SeatingPeriods
 *   table (period | box color | slide number) it adds one text box per student in that
 *   period to that slide of the Slides deck in cfg_SeatingDeckID: first name bold 21 pt
 *   over last name 15 pt, Palatino, centered, filled with the period's color, sorted by
 *   last name, laid out in rows that wrap at the deck's width. Like legacy, it only adds
 *   boxes and never removes any, so running it twice doubles them.
 *   Refreshes ref_peopleList and ref_SectionLookup first (design rule: refresh before use).
 *   Student names go only into the deck; logs and pop-ups show periods and counts only.
 * Canvas endpoints called (GET, through the refresh helpers in RefSheets.js):
 *   /api/v1/courses/:course, /api/v1/courses/:course/enrollments, /api/v1/courses/:course/sections
 * Canvas write operations: none.
 * Google permissions: Slides (presentations scope) to add boxes to the deck.
 * Required named ranges on ref_Config: cfg_SeatingDeckID (the deck's ID, legacy B7) and
 *   cfg_SeatingPeriods (period | color | slide number rows, legacy A8:C11).
 */

const SEATING_DECK_RANGE = 'cfg_SeatingDeckID';
const SEATING_PERIODS_RANGE = 'cfg_SeatingPeriods';
const SEATING_MARGIN = 50;                 // points from the slide's top-left corner
const SEATING_GAP = 10;                    // points between boxes
const SEATING_BOX_WIDTH = 1.8 * 72;        // 1.8 inches
const SEATING_BOX_HEIGHT = 1.17 * 72;      // 1.17 inches
const SEATING_FONT = 'Palatino';
const SEATING_FIRST_NAME_SIZE = 21;
const SEATING_LAST_NAME_SIZE = 15;

/** Adds this file's menu items. Called by onOpen. */
function addSeatingChartMenuItems_(menu) {
  menu.addSeparator();
  menu.addItem('Build seating chart', 'buildSeatingChart');
}

/**
 * Menu (and Home button): Course Manager › Build seating chart.
 * Asks first, refreshes the roster and sections from Canvas, then adds the boxes.
 */
function buildSeatingChart() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  try {
    const deckId = readSeatingDeckId_(ss);
    const periods = readSeatingPeriods_(ss);

    const answer = ui.alert('Build seating chart',
      'This refreshes the roster and sections from Canvas, then adds name boxes for:\n• ' +
      periods.map(p => `Period ${p.period} → slide ${p.slideText}`).join('\n• ') +
      '\n\nBoxes are added; existing boxes are not removed, so running it twice doubles ' +
      'them.\n\nContinue?', ui.ButtonSet.YES_NO);
    if (answer !== ui.Button.YES) return;

    writePeopleListSheet_(ss);
    writeSectionLookupSheet_(ss);
    SpreadsheetApp.flush(); // so the Last Name / First Name formulas are calculated
    const students = readStudentsWithPeriods_(ss);

    let presentation;
    try {
      presentation = SlidesApp.openById(deckId);
    } catch {
      throw sheetProblem_(`The Slides deck in ${SEATING_DECK_RANGE} could not be opened. ` +
        'Check the ID and that you can edit the deck.');
    }
    const slides = presentation.getSlides();
    const pageWidth = presentation.getPageWidth();

    const results = periods.map(p => {
      const slideNumber = Number(p.slideText);
      if (!Number.isInteger(slideNumber) || slideNumber < 1 || slideNumber > slides.length) {
        return `Period ${p.period}: skipped, slide "${p.slideText}" is not in the deck ` +
          `(it has ${slides.length} slide(s)).`;
      }
      const roster = students
        .filter(s => s.period === p.period)
        .sort((a, b) => a.lastName.localeCompare(b.lastName) ||
          a.firstName.localeCompare(b.firstName));
      try {
        addNameBoxes_(slides.slice(slideNumber - 1, slideNumber)[0], roster, p.color, pageWidth);
      } catch {
        return `Period ${p.period}: stopped; check the box color "${p.color}" ` +
          '(use a color like #FFCC00).';
      }
      return `Period ${p.period}: ${roster.length} box(es) on slide ${slideNumber}.`;
    });

    console.log(`Build seating chart: ${periods.length} period row(s), ` +
      `${students.length} student enrollment(s) read.`);
    ui.alert('Build seating chart', results.join('\n'), ui.ButtonSet.OK);
  } catch (error) {
    reportRefreshFailure_('Build seating chart',
      'The seating chart did not finish; boxes already added stay in the deck.', error);
  }
}

/** The deck ID from cfg_SeatingDeckID, with a clear message if it is missing or blank. */
function readSeatingDeckId_(ss) {
  const range = ss.getRangeByName(SEATING_DECK_RANGE);
  const deckId = range ? String(range.getValue()).trim() : '';
  if (!deckId) {
    throw sheetProblem_(`Put the Slides deck's ID in the cell named ${SEATING_DECK_RANGE} ` +
      `on ${SHEETS.CONFIG} (Data › Named ranges if the name doesn't exist yet). The ID is ` +
      'the long part of the deck\'s web address between /d/ and /edit.');
  }
  return deckId;
}

/**
 * The rows of cfg_SeatingPeriods that have a period: [{ period, color, slideText }].
 * period is text without a leading "P", so 3, "3", and "P3" all match period 3.
 */
function readSeatingPeriods_(ss) {
  const range = ss.getRangeByName(SEATING_PERIODS_RANGE);
  if (!range) {
    throw sheetProblem_(`Name the period table on ${SHEETS.CONFIG} ${SEATING_PERIODS_RANGE} ` +
      '(Data › Named ranges): three columns, period | box color | slide number.');
  }
  const periods = range.getValues()
    .map(row => ({
      period: String(row[0]).trim().replace(/^P/i, ''),
      color: String(row[1]).trim(),
      slideText: String(row[2]).trim(),
    }))
    .filter(p => p.period !== '');
  if (!periods.length) {
    throw sheetProblem_(`${SEATING_PERIODS_RANGE} has no periods. Fill in at least one row: ` +
      'period | box color | slide number.');
  }
  return periods;
}

/**
 * Students from ref_peopleList with their period from ref_SectionLookup, found by
 * header name: [{ period, firstName, lastName }]. Only StudentEnrollment rows.
 */
function readStudentsWithPeriods_(ss) {
  const periodBySection = new Map(readRowsByHeader_(ss, SHEETS.SECTION_LOOKUP,
    ['Section ID', 'Period'])
    .map(([sectionId, period]) => [String(sectionId), String(period).trim()]));
  return readRowsByHeader_(ss, SHEETS.PEOPLE_LIST,
    ['Section ID', 'Role', 'First Name', 'Last Name'])
    .filter(([, role]) => role === 'StudentEnrollment')
    .map(([sectionId, , firstName, lastName]) => ({
      period: periodBySection.get(String(sectionId)) || '',
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
    }));
}

/** Reads the named columns (by header in row 1) of every data row on a sheet. */
function readRowsByHeader_(ss, sheetName, names) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getValues();
  const header = values[0];
  const indexes = names.map(name => {
    const index = header.indexOf(name);
    if (index === -1) throw sheetProblem_(`${sheetName} has no "${name}" column.`);
    return index;
  });
  return values.slice(1).map(row => indexes.map(index => row.slice(index, index + 1)[0]));
}

/** Adds one name box per student to the slide, in rows that wrap at the page width. */
function addNameBoxes_(slide, roster, color, pageWidth) {
  let left = SEATING_MARGIN;
  let top = SEATING_MARGIN;
  roster.forEach(student => {
    const text = student.firstName ? `${student.firstName}\n${student.lastName}` : student.lastName;
    const box = slide.insertTextBox(text, left, top, SEATING_BOX_WIDTH, SEATING_BOX_HEIGHT);
    const range = box.getText();
    range.getTextStyle().setFontFamily(SEATING_FONT);
    if (student.firstName) {
      range.getRange(0, student.firstName.length).getTextStyle()
        .setBold(true).setFontSize(SEATING_FIRST_NAME_SIZE);
    }
    if (student.lastName) {
      range.getRange(text.length - student.lastName.length, text.length).getTextStyle()
        .setFontSize(SEATING_LAST_NAME_SIZE);
    }
    range.getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
    if (color) box.getFill().setSolidFill(color);

    left += SEATING_BOX_WIDTH + SEATING_GAP;
    if (left + SEATING_BOX_WIDTH > pageWidth) {
      left = SEATING_MARGIN;
      top += SEATING_BOX_HEIGHT + SEATING_GAP;
    }
  });
}
