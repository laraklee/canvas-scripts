/**
 * QuizCsv.js
 * Purpose: anonymizes a quiz "Student Analysis" report (a .csv downloaded from Canvas,
 *   New Quiz or Classic Quiz) for AI review. Called by Anonymize.js for any .csv in the assignment's
 *   folder. Keeps only the essay answers each student actually got (questions drawn at
 *   random from banks leave the rest "Not Attempted"), turns their HTML into plain text,
 *   and writes one file, "<short name> answers.csv", to the anonymized folder: columns
 *   Code, Question, Answer, one row per answer, sorted by question so the AI sees every
 *   answer to a question together. Formula and other auto-graded questions, and any
 *   points already given, are left out. Each student with an essay answer gets one row
 *   in the Key tab, with the same code a file download would give them.
 *   Answers are student text: untrusted data, written as text only, never as formulas.
 *   Match (MatchResults.js) reads the answers file back to spot answers the AI skipped.
 * Canvas endpoints called: none (works on a report already downloaded to Drive).
 * Canvas write operations: none.
 * Required User/Script Properties: none here (Anonymize.js passes in the passphrase).
 */

// After Name, ID, and the student columns, each question has these five columns; the
// third holds the answer, under a header that is the question's text.
const QUIZ_ITEM_HEADERS = ['ItemID', 'ItemType', null, 'EarnedPoints', 'Status'];
const QUIZ_ANSWER_HEADERS = ['Code', 'Question', 'Answer'];
const NOT_A_QUIZ_REPORT = 'Not a quiz Student Analysis report (no name, ID, and question columns)';
const QUIZ_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'', nbsp: ' ' };
// UTF-8 read as Windows text (for example after a round trip through Excel): "â€”" → "—".
const QUIZ_MOJIBAKE = [['â€”', '—'], ['â€“', '–'], ['â€™', '’'], ['â€˜', '‘'], ['â€œ', '“'],
  ['â€\u009d', '”'], ['â€¦', '…'], ['Â ', ' ']];

function isQuizReport_(fileName) {
  return /\.csv$/i.test(fileName);
}

function quizAnswersName_(shortName) {
  return shortName + ' answers.csv';
}

/** 6 from "Q6", "q 6", or "Q6. The chemical soda lime…"; 0 if there's no number. */
function questionNumber_(text) {
  const match = /^\s*Q\s*(\d+)/i.exec(String(text));
  return match ? Number(match[1]) : 0;
}

/**
 * For Match: the answers file this assignment's Anonymize run wrote, as
 * { byCode: Map code → Set of question numbers, questions: Map number → question text },
 * or null if the file can't be found or read (Match then checks whole students only).
 */
function readQuizAnswers_(folderId, shortName) {
  try {
    const anonFolders = DriveApp.getFolderById(folderId).getFoldersByName(ANON_FOLDER_NAME);
    if (!anonFolders.hasNext()) return null;
    const files = anonFolders.next().getFilesByName(quizAnswersName_(shortName));
    if (!files.hasNext()) return null;
    return expectedAnswers_(files.next().getBlob().getDataAsString('UTF-8'));
  } catch {
    return null;
  }
}

/** Answers file text (Code, Question, Answer) → { byCode, questions } (see readQuizAnswers_). */
function expectedAnswers_(csvText) {
  const byCode = new Map();
  const questions = new Map();
  for (const [code, question] of parseCsv_(csvText).slice(1)) {
    const number = questionNumber_(question);
    if (!code || !number) continue;
    if (!byCode.has(code)) byCode.set(code, new Set());
    byCode.get(code).add(number);
    questions.set(number, String(question).replace(/^\s*Q\s*\d+\.?\s*/i, ''));
  }
  return { byCode, questions };
}

/**
 * "Q6 · An enzyme called aldolase catalyzes…": the number plus the start of the question,
 * so it can be found in SpeedGrader, where each student sees the questions in their own
 * order. The Q number is the report's column, not the student's question number.
 */
function questionLabel_(number, questions) {
  const text = String((questions && questions.get(number)) || '').replace(/\s+/g, ' ').trim();
  if (!text) return 'Q' + number;
  const cut = text.length <= 60 ? text : text.slice(0, 60).replace(/\s+\S*$/, '') + '…';
  return 'Q' + number + ' · ' + cut;
}

/**
 * Anonymizes one Student Analysis report. job holds assignmentId, shortName, passphrase,
 * state (from readKeyState_), keySheet, outFolder, and flagged (problems are added to it).
 * Returns { added, skipped, answers, noEssay, outName, essayNumbers } (essayNumbers:
 * the questions read as essays in a Classic report; empty for a New Quiz).
 */
function anonymizeQuizCsv_(source, job) {
  const { assignmentId, shortName, passphrase, state, keySheet, outFolder, flagged } = job;
  const result = { added: 0, skipped: 0, answers: 0, noEssay: 0, outName: '', essayNumbers: [] };
  const report = parseQuizReport_(source.getBlob().getDataAsString('UTF-8'));
  if (report.error) {
    flagged.push([assignmentId, source.label, report.error + '; not used']);
    return result;
  }
  report.problems.forEach((problem) => flagged.push([assignmentId, source.label, problem]));
  result.essayNumbers = report.essayNumbers;

  result.outName = quizAnswersName_(shortName);
  const answerRows = [];
  for (const student of report.students) {
    if (student.answers.length === 0) {
      result.noEssay++;
      continue;
    }
    const code = makeCode_(student.userId, assignmentId, passphrase);
    const owner = state.codeOwner.get(code);
    if (owner && owner !== student.userId) {
      flagged.push([assignmentId, source.label, 'Row ' + student.row + ': code ' + code +
        ' is already used by another student (rare collision); left out']);
      continue;
    }
    student.answers.forEach((answer) => answerRows.push({ code, ...answer }));

    // The answers file is rebuilt on every run; the Key only gains students it lacks.
    const doneKey = student.userId + '|' + source.name;
    if (state.done.has(doneKey)) {
      result.skipped++;
      continue;
    }
    keySheet.appendRow([asText_(student.name), asText_(student.userId), asText_(assignmentId),
      code, asText_(source.name), false, result.outName]);
    state.done.add(doneKey);
    state.codeOwner.set(code, student.userId);
    state.codeCount.set(code, (state.codeCount.get(code) || 0) + 1);
    result.added++;
  }

  answerRows.sort((a, b) => a.number - b.number || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
  const csv = toCsv_([QUIZ_ANSWER_HEADERS,
    ...answerRows.map((a) => [a.code, 'Q' + a.number + '. ' + a.question, a.text])]);
  const existing = outFolder.getFilesByName(result.outName);
  if (existing.hasNext()) existing.next().setContent(csv);
  else outFolder.createFile(result.outName, csv, MimeType.CSV);
  result.answers = answerRows.length;
  return result;
}

/**
 * Reads a Student Analysis report, New Quiz or Classic Quiz. Returns { students,
 * problems, classic, essayNumbers }, or { error } if it doesn't look like one. Each
 * student: { row, userId, name, attempt, answers }, where answers are
 * { number, question, text } for essay questions the student answered. Questions are
 * numbered in the report's column order. A student listed twice keeps the higher attempt.
 */
function parseQuizReport_(text) {
  const rows = parseCsv_(text.replace(/^\uFEFF/, ''));
  const header = (rows[0] || []).map((cell) => cell.trim());
  const dataRows = rows.slice(1);
  const layout = header.includes('ItemID') ? newQuizLayout_(header) : classicQuizLayout_(header, dataRows);
  if (layout.error) return layout;

  const byUser = new Map();
  const problems = [];
  dataRows.forEach((cells, i) => {
    const row = i + 2;
    if (cells.every((cell) => cell.trim() === '')) return;
    const userId = String(cells[layout.idCol] || '').trim();
    if (!/^\d+$/.test(userId)) {
      problems.push('Row ' + row + ': no Canvas ID; left out');
      return;
    }
    const attempt = Number(cells[layout.attemptCol]) || 0;
    const earlier = byUser.get(userId);
    if (earlier) {
      problems.push('Rows ' + earlier.row + ' and ' + row + ' are the same student; ' +
        'used the higher attempt');
      if (earlier.attempt > attempt) return;
    }
    const answers = layout.items
      .filter((item) => layout.isEssayAnswer(item, cells))
      .map((item) => ({ number: item.number, question: item.question,
        text: quizText_(cells[item.answerCol] || '') }))
      .filter((answer) => answer.text !== '');
    byUser.set(userId, { row, userId, name: String(cells[layout.nameCol] || '').trim(), attempt, answers });
  });
  return { students: [...byUser.values()], problems, classic: layout.classic,
    essayNumbers: layout.classic ? layout.items.filter((item) => item.essay).map((item) => item.number) : [] };
}

/**
 * New Quiz report: Name, ID, Attempt, and five columns per question (QUIZ_ITEM_HEADERS).
 * The ItemType and Status columns say which answers are essays the student got.
 */
function newQuizLayout_(header) {
  const nameCol = header.indexOf('Name');
  const idCol = header.indexOf('ID');
  const items = [];
  for (let i = 0; i < header.length; i++) {
    if (header[i] !== 'ItemID') continue;
    const fits = QUIZ_ITEM_HEADERS.every((name, offset) => name === null || header[i + offset] === name);
    if (!fits) return { error: 'The question columns are not in the expected order (ItemID, ItemType, question, EarnedPoints, Status)' };
    items.push({ number: items.length + 1, typeCol: i + 1, answerCol: i + 2, statusCol: i + 4,
      question: quizText_(header[i + 2]) });
  }
  if (nameCol === -1 || idCol === -1) return { error: NOT_A_QUIZ_REPORT };
  return {
    classic: false, nameCol, idCol, attemptCol: header.indexOf('Attempt'), items,
    isEssayAnswer: (item, cells) => /^essay$/i.test(String(cells[item.typeCol] || '').trim()) &&
      !/^not attempted$/i.test(String(cells[item.statusCol] || '').trim()),
  };
}

/**
 * Classic Quiz report: lowercase name, id, attempt, then two columns per question: the
 * answer under "<question id>: <question text>", and the score under its points
 * possible (for example "2.0"); n correct, n incorrect, and score at the end.
 * There is no question-type column. Essay answers are typed in Canvas's editor and come
 * as HTML (<p>…</p>); multiple-choice and fill-in answers are plain text. So a question
 * counts as an essay if any student's answer to it has HTML tags. Questions a student
 * didn't get or skipped are blank.
 */
function classicQuizLayout_(header, dataRows) {
  const nameCol = header.indexOf('name');
  const idCol = header.indexOf('id');
  const items = [];
  for (let i = 0; i < header.length; i++) {
    const match = /^\d+:\s*([\s\S]*)$/.exec(header[i]);
    if (!match) continue;
    if (!/^\d[\d.]*$/.test(header[i + 1] || '')) {
      return { error: 'Classic Quiz report: question ' + (items.length + 1) +
        ' is not followed by its points column' };
    }
    const answerCol = i;
    const essay = dataRows.some((cells) => /<\/?[a-z][^>]*>/i.test(String(cells[answerCol] || '')));
    items.push({ number: items.length + 1, answerCol, essay, question: quizText_(match[1]) });
  }
  if (nameCol === -1 || idCol === -1 || items.length === 0) return { error: NOT_A_QUIZ_REPORT };
  if (!items.some((item) => item.essay)) {
    return { error: 'Classic Quiz report: no essay answers found (essays are recognized by ' +
      'their formatting, and no answer had any)' };
  }
  return {
    classic: true, nameCol, idCol, attemptCol: header.indexOf('attempt'), items,
    isEssayAnswer: (item) => item.essay,
  };
}

/**
 * Splits CSV text into rows of cells. Quoted cells may hold commas, "" for a quote, and
 * line breaks (essay answers often do). Tab-separated text (copied from a sheet) works too.
 */
function parseCsv_(text) {
  const delimiter = text.split('\n', 1)[0].includes('\t') ? '\t' : ',';
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch !== '"') cell += ch;
      else if (text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = false;
    } else if (ch === '"' && cell === '') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** Canvas answer HTML → plain text: paragraphs and list items on their own lines. */
function quizText_(html) {
  let text = String(html);
  if (/â€|Â/.test(text)) {
    QUIZ_MOJIBAKE.forEach(([bad, good]) => { text = text.split(bad).join(good); });
  }
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/(p|div|li|ol|ul|h\d)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body) => {
      if (body[0] !== '#') return QUIZ_ENTITIES[body.toLowerCase()] ?? match;
      const code = body[1].toLowerCase() === 'x' ? parseInt(body.slice(2), 16) : Number(body.slice(1));
      return code === 160 ? ' ' : String.fromCodePoint(code);
    })
    .replace(/ /g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/**
 * Rows → CSV text, every cell quoted. A cell starting with = + - or @ gets a leading
 * apostrophe so a spreadsheet opening the file never runs student text as a formula.
 */
function toCsv_(rows) {
  return rows.map((cells) => cells.map((value) => {
    const text = String(value);
    const safe = /^[=+\-@]/.test(text) ? '\'' + text : text;
    return '"' + safe.replace(/"/g, '""') + '"';
  }).join(',')).join('\n');
}
