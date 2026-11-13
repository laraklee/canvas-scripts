/**
 * Sample.js — SCRATCH TEST, not for teachers.
 * Purpose: the menu, plus made-up sample tabs (no real people or student data) for the
 *   read-only import test. "Build sample tabs" runs in the OLD copy; "Remove sample tabs"
 *   runs in the NEW copy (made with File › Make a copy) so it starts empty.
 *   The samples cover what teachers' tabs tend to have: formulas that point at other
 *   tabs and at a named range, a cloned tab with an extra column, dates and percents,
 *   colors, bold, borders, merged cells, column widths, a hidden column, a frozen row,
 *   notes, a dropdown from a list, a dropdown from a range, checkboxes, a link on part
 *   of a cell's text, a whole-cell link, text that looks like a number or date,
 *   conditional colors, tab colors, and a chart (expected NOT to come over).
 * Canvas endpoints called: none.
 * Write operations: only to this spreadsheet (spreadsheets.currentonly).
 * Required User/Script Properties: none.
 */

const SAMPLE_TABS_ = ['Scores', 'Scores (my clone)', 'Settings'];
const SAMPLE_NAMED_RANGE_ = 'PassingScore';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Read-only test')
    .addItem('1. Build sample tabs (old copy)', 'buildSampleTabs')
    .addItem('2. Remove sample tabs (new copy)', 'removeSampleTabs')
    .addSeparator()
    .addItem('3. Bring tabs over from the old copy (read-only)', 'runReadOnlyImport')
    .addItem('4. Check: can the usual way open it read-only?', 'checkOpenByUrl')
    .addToUi();
}

function buildSampleTabs() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActive();
  if (SAMPLE_TABS_.some((name) => ss.getSheetByName(name))) {
    ui.alert('Sample tabs are already here. Use "Remove sample tabs" first.');
    return;
  }

  // Settings first, so the formulas on Scores have something to point at. It is moved
  // to the end afterwards, so the import meets Scores before Settings (a harder case).
  const settings = ss.insertSheet('Settings');
  settings.getRange('A1:B1').setValues([['Setting', 'Value']]).setFontWeight('bold');
  settings.getRange('A2:B3').setValues([['Passing score', 0.7], ['Late penalty', 0.1]]);
  settings.getRange('B2:B3').setNumberFormat('0%');
  settings.getRange('A5:A8').setValues([['Homework'], ['Quiz'], ['Test'], ['Lab']]);
  settings.getRange('A4').setValue('Categories').setFontStyle('italic');
  settings.setHiddenGridlines(true);
  settings.setTabColor('#93c47d');
  ss.setNamedRange(SAMPLE_NAMED_RANGE_, settings.getRange('B2'));

  const scores = ss.insertSheet('Scores');
  const headers = ['Name', 'Category', 'Due date', 'Points', 'Out of', 'Percent',
    'Passed?', 'Done', 'Link', 'Comment', 'Code', 'Status'];
  scores.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setBackground('#cfe2f3').setWrap(true)
    .setVerticalAlignment('middle')
    .setBorder(null, null, true, null, null, null, '#000000', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  scores.setRowHeight(1, 40);
  scores.setFrozenRows(1);

  const rows = [];
  for (let i = 1; i <= 5; i++) {
    const r = i + 1;
    rows.push([
      'Sample ' + i,
      ['Homework', 'Quiz', 'Test', 'Lab', 'Quiz'][i - 1],
      new Date(2026, 10, 10 + i),
      [8, 6, 10, 4, 9][i - 1],
      10,
      '=IFERROR(D' + r + '/E' + r + ',"")',
      '=IF(F' + r + '>=' + SAMPLE_NAMED_RANGE_ + ',"Yes","No")',
      i % 2 === 1,
      '',
      i === 2 ? 'Turned in late' : '',
      ["'007", "'1/2", "'=not a formula", "'TRUE", "'12:30"][i - 1],
      ['Not started', 'In progress', 'Done', 'Done', 'In progress'][i - 1],
    ]);
  }
  scores.getRange(2, 1, rows.length, headers.length).setValues(rows);
  scores.getRange('C2:C6').setNumberFormat('m/d/yyyy');
  scores.getRange('F2:F6').setNumberFormat('0%');
  scores.getRange('D2:D6').setHorizontalAlignment('center');
  scores.getRange('J2:J6').setFontStyle('italic').setFontColor('#666666');
  scores.getRange('A2').setNote('A note on a cell');
  scores.getRange('D4').setNote('Another note');

  // Dropdowns and checkboxes.
  scores.getRange('B2:B6').setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInRange(settings.getRange('A5:A8'), true).build());
  scores.getRange('L2:L6').setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(['Not started', 'In progress', 'Done'], true).build());
  scores.getRange('H2:H6').insertCheckboxes();

  // A link on part of the text (like the HW links on Q tabs), and one on the whole cell.
  scores.getRange('I2').setRichTextValue(SpreadsheetApp.newRichTextValue()
    .setText('See the HW page').setLinkUrl(8, 15, 'https://www.example.com/hw').build());
  scores.getRange('I3').setRichTextValue(SpreadsheetApp.newRichTextValue()
    .setText('Example site').setLinkUrl('https://www.example.com/').build());
  const bold = SpreadsheetApp.newTextStyle().setBold(true).setForegroundColor('#cc0000').build();
  scores.getRange('I4').setRichTextValue(SpreadsheetApp.newRichTextValue()
    .setText('Only this part is red').setTextStyle(10, 21, bold).build());

  // Totals row: merged label, formulas, one pointing at the Settings tab.
  scores.getRange('A8:C8').merge().setValue('Totals').setHorizontalAlignment('right');
  scores.getRange('D8').setFormula('=SUM(D2:D6)');
  scores.getRange('F8').setFormula('=AVERAGE(F2:F6)').setNumberFormat('0.0%');
  scores.getRange('G8').setFormula('=Settings!B3');
  scores.getRange('A8:G8').setFontColor('#1155cc').setFontWeight('bold')
    .setBorder(true, true, true, true, null, null, '#1155cc', SpreadsheetApp.BorderStyle.SOLID);

  // Conditional colors: a color scale, a text rule, and a custom-formula rule.
  scores.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().setRanges([scores.getRange('F2:F6')])
      .setGradientMinpoint('#f4cccc').setGradientMaxpoint('#b6d7a8').build(),
    SpreadsheetApp.newConditionalFormatRule().setRanges([scores.getRange('G2:G6')])
      .whenTextEqualTo('No').setBackground('#ea9999').build(),
    SpreadsheetApp.newConditionalFormatRule().setRanges([scores.getRange('A2:A6')])
      .whenFormulaSatisfied('=$H2=TRUE').setStrikethrough(true).build(),
  ]);

  scores.setColumnWidth(1, 120);
  scores.setColumnWidth(9, 170);
  scores.hideColumns(5);
  scores.setTabColor('#6fa8dc');

  // A chart: expected NOT to come over (it should show up in the report instead).
  scores.insertChart(scores.newChart().setChartType(Charts.ChartType.COLUMN)
    .addRange(scores.getRange('A1:A6')).addRange(scores.getRange('D1:D6'))
    .setPosition(10, 2, 0, 0).build());

  // A teacher's clone with an extra column, including a formula back to the original tab.
  const clone = scores.copyTo(ss).setName('Scores (my clone)');
  clone.getRange('M1').setValue('Extra').setFontWeight('bold').setBackground('#fff2cc');
  clone.getRange('M2').setFormula('=D2*2');
  clone.getRange('M3').setFormula("='Scores'!D3+1");

  ss.setActiveSheet(settings);
  ss.moveActiveSheet(ss.getNumSheets());
  ss.setActiveSheet(scores);
  ui.alert('Sample tabs built: Scores, Scores (my clone), Settings.\n\n' +
    'Next: File › Make a copy of this spreadsheet. In the copy, use step 2, then step 3.');
}

function removeSampleTabs() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActive();
  const found = SAMPLE_TABS_.filter((name) => ss.getSheetByName(name));
  if (found.length === 0) {
    ui.alert('No sample tabs here.');
    return;
  }
  const answer = ui.alert('Remove sample tabs?',
    'This deletes these tabs from THIS spreadsheet: ' + found.join(', ') +
    '.\nOnly do this in the NEW copy.', ui.ButtonSet.YES_NO);
  if (answer !== ui.Button.YES) return;
  if (ss.getSheets().length === found.length) ss.insertSheet('Sheet1');
  found.forEach((name) => ss.deleteSheet(ss.getSheetByName(name)));
  ss.getNamedRanges().forEach((nr) => {
    if (nr.getName() === SAMPLE_NAMED_RANGE_) nr.remove();
  });
  ui.alert('Sample tabs removed. Next: step 3, and paste the link to the OLD copy.');
}
