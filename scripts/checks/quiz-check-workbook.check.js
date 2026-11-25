/**
 * scripts/checks/quiz-check-workbook.check.js
 * Purpose: offline check of the standalone Quiz Check workbook (quiz-check-workbook/).
 *   1. Drift: its shared code must match course-manager-jupiter's, so a fix in one is
 *      copied to the other: QtiReader.js whole, the panel's zip-slice-reader script, and
 *      each shared function in QuizReport.js and QuizCheck.js (quizExportFiles_ differs
 *      on purpose: its too-large message).
 *   2. No Canvas: no UrlFetchApp or PropertiesService anywhere, and only the two narrow
 *      scopes in appsscript.json.
 *   3. It works: a MADE-UP course export (texts and sizes, gzipped the way the panel
 *      sends them) goes through receiveCourseExport and receiveQuizCheckDetail against a
 *      pretend workbook; then the menu's Detail for selected quiz (from the upload saved
 *      on the hidden tab, in several pieces) and Clear check results…. Nothing is sent anywhere; Utilities is stubbed with Node's zlib.
 *   Run with the others: npm run check-offline.
 *   Repo helper only: not part of any Apps Script project; never clasp-pushed.
 * Canvas endpoints called: none. Canvas write operations: none.
 * Required User/Script Properties: none.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..', '..');
const HERE = path.join(ROOT, 'quiz-check-workbook');
const JUPITER = path.join(ROOT, 'course-manager-jupiter');
const read = (dir, file) => fs.readFileSync(path.join(dir, file), 'utf8');

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}` +
    (ok ? '' : `\n      expected ${JSON.stringify(expected)}\n      got      ${JSON.stringify(actual)}`));
}

/** A top-level function's text (from "function name(" to the closing brace at column 0). */
function functionText(source, name) {
  const at = source.search(new RegExp(`^function ${name}\\(`, 'm'));
  if (at < 0) return null;
  return source.slice(at, source.indexOf('\n}\n', at) + 2);
}
const topFunctions = source => [...source.matchAll(/^function (\w+)\(/gm)].map(m => m[1]);

// --- 1. Drift from Jupiter ---
check('QtiReader.js is identical to Jupiter\'s', read(HERE, 'QtiReader.js') === read(JUPITER, 'QtiReader.js'), true);
const zipReader = html => (html.match(/<script id="zip-slice-reader">([\s\S]*?)<\/script>/) || [])[1];
check('panel\'s zip reader is identical to Jupiter\'s',
  zipReader(read(HERE, 'QuizCheckUpload.html')) === zipReader(read(JUPITER, 'QuizCheckUpload.html')), true);
const jupiterSource = ['QuizReport.js', 'QuizCheck.js', 'QuizExportReport.js'].map(f => read(JUPITER, f)).join('\n');
const sharedReport = topFunctions(read(HERE, 'QuizReport.js'));
const quizCheck = read(HERE, 'QuizCheck.js');
const sharedCheck = topFunctions(quizCheck.slice(quizCheck.indexOf('// ---- Below: kept identical')));
const differs = sharedReport.map(name => [name, read(HERE, 'QuizReport.js')])
  .concat(sharedCheck.map(name => [name, quizCheck]))
  .filter(([name]) => name !== 'quizExportFiles_')
  .filter(([name, source]) => functionText(source, name) !== functionText(jupiterSource, name))
  .map(([name]) => name);
check(`shared functions match Jupiter's (${sharedReport.length + sharedCheck.length - 1} compared)`, differs, []);
check('quizExportFiles_ differs only in its too-large message',
  functionText(quizCheck, 'quizExportFiles_').replace(/throw sheetProblem_\('That export (has more|is too large)[\s\S]*?\);/, 'MSG') ===
  functionText(jupiterSource, 'quizExportFiles_').replace(/throw sheetProblem_\('That export (has more|is too large)[\s\S]*?\);/, 'MSG'), true);

// --- 2. No Canvas, narrow scopes ---
const projectFiles = fs.readdirSync(HERE).filter(f => /\.(js|html)$/.test(f));
check('no UrlFetchApp or PropertiesService in the project',
  projectFiles.filter(f => /UrlFetchApp|PropertiesService/.test(read(HERE, f))), []);
check('only the two narrow scopes', JSON.parse(read(HERE, 'appsscript.json')).oauthScopes, [
  'https://www.googleapis.com/auth/spreadsheets.currentonly',
  'https://www.googleapis.com/auth/script.container.ui']);
check('menu items call functions that exist', [...read(HERE, 'Menu.js').matchAll(/addItem\('[^']*', '(\w+)'\)/g)]
  .map(m => m[1]).filter(name => !projectFiles.some(f => functionText(read(HERE, f), name))), []);

// --- 3. It works, on a pretend workbook ---
function makeWorkbook() {
  const tabs = [];
  const makeTab = name => {
    const tab = { name, cells: {}, colors: {}, frozen: [0, 0], active: false, hidden: false, activeRow: 1 };
    const range = (row, col, rows = 1, cols = 1) => {
      const each = fn => { for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) fn(`${row + i},${col + j}`); };
      const r = {
        setValues: values => { values.forEach((line, i) => line.forEach((v, j) => { tab.cells[`${row + i},${col + j}`] = v; })); return r; },
        setValue: v => { tab.cells[`${row},${col}`] = v; return r; },
        setBackground: color => { each(key => { tab.colors[key] = color; }); return r; },
        setBackgrounds: colors => { colors.forEach((line, i) => line.forEach((v, j) => { tab.colors[`${row + i},${col + j}`] = v; })); return r; },
        clear: () => { each(key => { delete tab.cells[key]; delete tab.colors[key]; }); return r; },
        getDisplayValue: () => String(tab.cells[`${row},${col}`] ?? ''),
        getValues: () => Array.from({ length: rows }, (_, i) => Array.from({ length: cols },
          (_, j) => tab.cells[`${row + i},${col + j}`] ?? '')),
        getRow: () => row,
      };
      ['setNumberFormat', 'setFontWeight', 'setWrap', 'setVerticalAlignment', 'setHorizontalAlignment', 'clearNote',
        'setRichTextValues'].forEach(fn => { r[fn] = () => r; });
      return r;
    };
    tab.sheet = {
      getName: () => tab.name,
      getRange: (a, ...rest) => (a === 'A1' ? range(1, 1) : range(a, ...rest)),
      clear: () => { tab.cells = {}; tab.colors = {}; },
      setFrozenRows: n => { tab.frozen[0] = n; },
      setFrozenColumns: n => { tab.frozen[1] = n; },
      getMaxRows: () => 1000,
      getMaxColumns: () => 26,
      insertRowsAfter: () => {},
      insertColumnsAfter: () => {},
      setColumnWidth: () => {},
      hideColumns: () => {},
      activate: () => { tabs.forEach(t => { t.active = t === tab; }); },
      hideSheet: () => { tab.hidden = true; },
      isSheetHidden: () => tab.hidden,
      getActiveRange: () => range(tab.activeRow, 1),
    };
    tabs.push(tab);
    return tab;
  };
  return { tabs, makeTab, ss: {
    getSheetByName: name => (tabs.find(t => t.name === name) || {}).sheet || null,
    insertSheet: name => { const sheet = makeTab(name).sheet; sheet.activate(); return sheet; },
    getSheets: () => tabs.map(t => t.sheet),
    deleteSheet: sheet => { tabs.splice(tabs.findIndex(t => t.sheet === sheet), 1); },
    getActiveSheet: () => (tabs.find(t => t.active) || tabs[0]).sheet,
  } };
}
let workbook = makeWorkbook();
const ui = { alerts: [], answer: 'YES', Button: { YES: 'YES', NO: 'NO' }, ButtonSet: { OK: 'OK', YES_NO: 'YES_NO' } };
ui.alert = (title, message, buttons) => { ui.alerts.push(message); return buttons === 'YES_NO' ? ui.answer : 'OK'; };
const lastAlert = () => ui.alerts[ui.alerts.length - 1];
const context = {
  SpreadsheetApp: { getActiveSpreadsheet: () => workbook.ss, getUi: () => ui },
  console: { log: () => {}, error: () => {} },
  Utilities: {
    base64Decode: text => Buffer.from(text, 'base64'),
    newBlob: bytes => ({ bytes }),
    ungzip: blob => ({ getDataAsString: () => zlib.gunzipSync(blob.bytes).toString('utf8') }),
  },
};
vm.createContext(context);
// Small pieces here (50 characters), so the saved upload is split over several rows.
const piecesSource = projectFiles.filter(f => f.endsWith('.js')).map(f => read(HERE, f)).join('\n')
  .replace(/const QUIZ_CHECK_PIECE_CHARS = \d+;/, 'const QUIZ_CHECK_PIECE_CHARS = 50;');
check('piece size found in the source', /QUIZ_CHECK_PIECE_CHARS = 50;/.test(piecesSource), true);
vm.runInContext(piecesSource, context);
const c = context;

// A made-up course: Quiz A (fine picture + a bank whose picture is in another course),
// Quiz B (points 4 vs 9, unpublished), Quiz C (a 700 KB picture: orange only).
const item = (id, stem, points) => `<item ident="${id}" title="Question"><itemmetadata><qtimetadata>
<qtimetadatafield><fieldlabel>question_type</fieldlabel><fieldentry>multiple_choice_question</fieldentry></qtimetadatafield>
<qtimetadatafield><fieldlabel>points_possible</fieldlabel><fieldentry>${points}</fieldentry></qtimetadatafield>
</qtimetadata></itemmetadata><presentation><material><mattext texttype="text/html">${stem.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')}</mattext></material>
<response_lid ident="r"><render_choice><response_label ident="${id}0"><material><mattext>A</mattext></material></response_label>
<response_label ident="${id}1"><material><mattext>B</mattext></material></response_label></render_choice></response_lid></presentation>
<resprocessing><respcondition><conditionvar><varequal respident="r">${id}0</varequal></conditionvar><setvar varname="SCORE">100</setvar></respcondition></resprocessing></item>`;
const quiz = (id, title, body) => `<questestinterop><assessment ident="${id}" title="${title}"><section ident="root_section">${body}</section></assessment></questestinterop>`;
const texts = {
  'ga/assessment_meta.xml': '<quiz identifier="ga"><title>Quiz A</title><points_possible>5.0</points_possible><workflow_state>published</workflow_state></quiz>',
  'gb/assessment_meta.xml': '<quiz><title>Quiz B</title><points_possible>9.0</points_possible><workflow_state>unpublished</workflow_state></quiz>',
  'gc/assessment_meta.xml': '<quiz><title>Quiz C</title><points_possible>1.0</points_possible><workflow_state>published</workflow_state></quiz>',
  'non_cc_assessments/ga.xml.qti': quiz('ga', 'A', `${item('a1', '<p>Fine <img src="$IMS-CC-FILEBASE$/Pics/ok.png"></p>', 2)}
<section ident="s" title="From bank"><selection_ordering><selection><sourcebank_ref>gbank</sourcebank_ref><selection_number>1</selection_number>
<selection_extension><points_per_item>3.0</points_per_item></selection_extension></selection></selection_ordering></section>`),
  'non_cc_assessments/gb.xml.qti': quiz('gb', 'B', item('b1', '<p>Fine</p>', 4)),
  'non_cc_assessments/gc.xml.qti': quiz('gc', 'C', item('c1', '<p>Big <img src="$IMS-CC-FILEBASE$/Pics/big.png"></p>', 1)),
  'non_cc_assessments/gbank.xml.qti': `<questestinterop><objectbank ident="gbank"><qtimetadata><qtimetadatafield><fieldlabel>bank_title</fieldlabel>
<fieldentry>Bank</fieldentry></qtimetadatafield></qtimetadata>${item('k1', '<p>Last year <img src="/courses/4230/files/5/preview"></p>', '')}</objectbank></questestinterop>`,
  'course_settings/context.xml': '<context_info><course_id>4791</course_id></context_info>',
  'course_settings/files_meta.xml': '<fileMeta><folders/><files/></fileMeta>',
  'imsmanifest.xml': '<manifest><resource identifier="f1" href="web_resources/Pics/ok.png"/><resource identifier="f2" href="web_resources/Pics/big.png"/></manifest>',
};
const sizes = Object.fromEntries(Object.keys(texts).map(k => [k, texts[k].length]));
sizes['web_resources/Pics/ok.png'] = 3000;
sizes['web_resources/Pics/big.png'] = 700000;
const gzip = zlib.gzipSync(JSON.stringify({ texts, sizes })).toString('base64');

const result = c.receiveCourseExport({ fileName: 'made-up.imscc', gzip });
check('check: ok, course export, red first then orange', [result.ok, result.courseExport, result.quizzes.map(q => [q.title, q.level])],
  [true, true, [['Quiz A', 'problem'], ['Quiz B', 'problem'], ['Quiz C', 'suggestion']]]);
check('check: kinds', result.quizzes.map(q => q.kinds),
  [[['picture from another course', 1]], [['points add up to 4, not 9', 0]], [['picture worth shrinking', 1]]]);
check('check: message has no Canvas link note, mentions the menu item', result.message, 'Checked 3 quiz(zes) from "made-up.imscc". ' +
  'See the "Quiz Check" tab: 2 need fixing (red), 1 have suggestions (orange), 0 look fine.\n\nTo see a quiz\'s details ' +
  'later (with this panel closed), click its row on the "Quiz Check" tab and choose Quiz Check › Detail for selected quiz.');
const tab = workbook.tabs.find(t => t.name === 'Quiz Check');
check('tab: rows, colors, frozen', [tab.cells['5,1'], tab.cells['6,2'], tab.cells['7,8'], tab.colors['5,1'], tab.colors['7,1'], tab.frozen],
  ['Quiz A', 'No', 'picture worth shrinking (1)', '#f4cccc', '#fce5cd', [4, 1]]);

const detail = c.receiveQuizCheckDetail({ fileName: 'made-up.imscc', gzip, quizId: 'gc' });
const detailTab = workbook.tabs.find(t => t.name === 'Quiz Check detail');
check('detail: ok, tab written and shown', [detail.ok, Boolean(detailTab), detailTab && detailTab.active, detailTab && detailTab.cells['1,1']],
  [true, true, true, 'Quiz Check detail:']);
check('detail: message', detail.message.startsWith('"Quiz C": 0 group(s) and 1 question(s)') &&
  detail.message.includes('1 row(s) have suggestions only (orange).'), true);
check('detail: unknown quiz → clear message', c.receiveQuizCheckDetail({ fileName: 'x', gzip, quizId: 'nope' }).message,
  'That quiz isn\'t in this export. Run the check again and pick it from the new list.');
check('bad upload → clear message, nothing written', [c.receiveCourseExport({ fileName: 'x', gzip: 'not gzip' }).message],
  ['The file couldn\'t be read. Try choosing it again.']);
workbook = makeWorkbook();
workbook.makeTab('Quiz Check').cells['1,1'] = 'My notes';
check('someone else\'s "Quiz Check" tab is left alone', c.receiveCourseExport({ fileName: 'x', gzip }).message.startsWith(
  'There\'s already a "Quiz Check" tab'), true);

// --- 4. Detail for selected quiz and Clear check results (menu) ---
const askToClick = () => lastAlert().startsWith('On the "Quiz Check" tab, click');
workbook = makeWorkbook();
workbook.makeTab('Start here').active = true;
c.showQuizCheckDetailForSelection();
check('menu detail before any check → asks to go to the tab', askToClick(), true);
c.receiveCourseExport({ fileName: 'made-up.imscc', gzip });
const dataTab = workbook.tabs.find(t => t.name === 'Quiz Check data');
const pieceCount = Math.ceil(gzip.length / 50);
const pieces = Array.from({ length: pieceCount }, (_, i) => dataTab.cells[`${4 + i},3`]);
check('saved: hidden, labeled, quiz IDs in tab order, Quiz Check tab shown',
  [dataTab.hidden, dataTab.cells['1,1'], dataTab.cells['1,2'], dataTab.cells['2,2'], dataTab.cells['2,3'],
    [4, 5, 6].map(r => [dataTab.cells[`${r},1`], dataTab.cells[`${r},2`]]), workbook.tabs.find(t => t.active).name],
  [true, 'Quiz Check data:', 'made-up.imscc', pieceCount, 3,
    [['ga', 'Quiz A'], ['gb', 'Quiz B'], ['gc', 'Quiz C']], 'Quiz Check']);
check(`saved: upload in ${pieceCount} pieces, each with "p" in front, rejoins exactly`,
  [pieceCount > 3, pieces.every(p => p[0] === 'p'), pieces.map(p => p.slice(1)).join('') === gzip], [true, true, true]);
const overviewTab = workbook.tabs.find(t => t.name === 'Quiz Check');
overviewTab.activeRow = 7; // Quiz C
c.showQuizCheckDetailForSelection();
const menuDetail = workbook.tabs.find(t => t.name === 'Quiz Check detail');
check('menu detail: Quiz C written from the saved upload and shown',
  [lastAlert().startsWith('"Quiz C": 0 group(s) and 1 question(s)'), Boolean(menuDetail && menuDetail.active),
    menuDetail && menuDetail.cells['1,2']], [true, true, 'made-up.imscc']);
c.showQuizCheckDetailForSelection();
check('menu detail from another tab → asks to go to the Quiz Check tab', askToClick(), true);
overviewTab.sheet.activate();
overviewTab.activeRow = 4; // the header row
c.showQuizCheckDetailForSelection();
check('menu detail on the header row → asks to click a quiz', askToClick(), true);
overviewTab.activeRow = 8; // below the last quiz
c.showQuizCheckDetailForSelection();
check('menu detail below the quizzes → asks to click a quiz', askToClick(), true);
overviewTab.cells['5,1'] = 'Quiz C'; // as if the tab was sorted
overviewTab.activeRow = 5;
c.showQuizCheckDetailForSelection();
check('menu detail after the tab changed → asks to check again', lastAlert().startsWith('The "Quiz Check" tab has changed'), true);

ui.answer = 'NO';
c.clearQuizCheckResults();
check('clear: "No" leaves every tab', workbook.tabs.map(t => t.name).sort(),
  ['Quiz Check', 'Quiz Check data', 'Quiz Check detail', 'Start here']);
ui.answer = 'YES';
c.clearQuizCheckResults();
check('clear: "Yes" deletes our three tabs, keeps the rest', [workbook.tabs.map(t => t.name), lastAlert()],
  [['Start here'], 'Check results cleared.']);
c.showQuizCheckDetailForSelection();
check('menu detail after clearing → asks to go to the tab', askToClick(), true);
workbook = makeWorkbook();
workbook.makeTab('Quiz Check').cells['1,1'] = 'Quiz Check:';
c.clearQuizCheckResults();
check('clear: the workbook\'s only tab is emptied, not deleted',
  [workbook.tabs.map(t => [t.name, Object.keys(t.cells).length]), lastAlert()], [[['Quiz Check', 0]], 'Check results cleared.']);
workbook = makeWorkbook();
workbook.makeTab('Start here');
workbook.makeTab('Quiz Check detail').cells['1,1'] = 'My notes';
c.clearQuizCheckResults();
check('clear: someone else\'s tab is left alone',
  [workbook.tabs.map(t => [t.name, Object.keys(t.cells).length]), lastAlert()],
  [[['Start here', 0], ['Quiz Check detail', 1]],
    'There were no check results to clear.\n\nLeft alone (used for something else): "Quiz Check detail".']);

process.exitCode = failures ? 1 : 0;
