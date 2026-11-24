/**
 * Menu.js (Quiz Check workbook)
 * Purpose: the "Quiz Check" menu and the in-sheet user guide. "Check quizzes…" opens the
 *   Quiz Check side panel (QuizCheck.js); "❓ User guide" opens UserGuide.html docked on
 *   the right (showUserGuide), with an "Open in a large window" link (showUserGuideLarge).
 *   The workbook has no settings, so there is no Setup panel.
 * Canvas endpoints called: none.
 * Canvas write operations: none.
 * Required User/Script Properties: none.
 */

const QUIZ_CHECK_GUIDE_TITLE = 'Quiz Check — User Guide';

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Quiz Check')
    .addItem('Check quizzes…', 'showQuizCheck')
    .addSeparator()
    .addItem('❓ User guide', 'showUserGuide')
    .addToUi();
}

/** Menu: Quiz Check › ❓ User guide. Opens the guide in the side panel. */
function showUserGuide() {
  const html = HtmlService.createHtmlOutputFromFile('UserGuide').setTitle(QUIZ_CHECK_GUIDE_TITLE);
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Called from the guide's "Open in a large window" link (google.script.run), so it has no
 * trailing underscore. Opens the same guide in a big window over the sheet.
 */
function showUserGuideLarge() {
  const html = HtmlService.createHtmlOutputFromFile('UserGuide').setWidth(900).setHeight(650);
  SpreadsheetApp.getUi().showModelessDialog(html, QUIZ_CHECK_GUIDE_TITLE);
}
