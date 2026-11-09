/**
 * QuizReport.js
 * Purpose: a read-only report of one Classic quiz's structure, so groups ("pick 3 of 7")
 *   and their questions can be seen in one place. runQuizReport (menu: Canvas Tools ›
 *   Quiz report (this tab)).
 *   Tab layout (Lara, 2026-10-26): A1 "Quiz link:", B1 = a Classic quiz link pasted from
 *   Canvas (…/courses/:course/quizzes/:quiz; typed, or a blue link). Works on the tab
 *   being viewed when its A1 says "Quiz link:" (so Lara can keep several report tabs);
 *   otherwise opens (or makes) a tab named "Quiz report". Everything from row 3 down is
 *   replaced on each run: a short summary (title, points in Canvas vs. points found
 *   here), then one row per group followed by its questions, in quiz order.
 *   Known gap: Canvas has no documented way to list a quiz's groups, so groups are found
 *   through their questions. A group that pulls from a question bank has no questions
 *   in the quiz, so it can't be found; the points check shows the missing points.
 *   Pictures (added 2026-11-08): each picture in a question or its choices is listed in
 *   the Pictures column (name, size, published / link only / unpublished). Problems that
 *   can keep students from seeing it go in the Check column: unpublished file or folder,
 *   availability dates, another course's or someone's personal files, an old question-bank
 *   file, an outside site, a file that can't be opened, and size (1 MB+ "shrink it",
 *   500 KB+ "worth shrinking"). Each file and folder is looked up once per run.
 *   Check also flags blank answer choices. Any row with something in Check is shaded
 *   light red (QUIZ_REPORT_CHECK_COLOR) so problems stand out (Lara, 2026-11-08).
 *   Quiz questions only: never student answers, submissions, or quiz statistics.
 * Canvas endpoints called (GET via canvasGet_; the course comes from the link):
 *   /api/v1/courses/:course/quizzes/:quiz
 *   /api/v1/courses/:course/quizzes/:quiz/questions
 *   /api/v1/courses/:course/quizzes/:quiz/groups/:group (one per group found)
 *   /api/v1/files/:id (one per picture file: size, published, hidden, dates, folder)
 *   /api/v1/folders/:id (each picture's folder and the folders above it: owner, published)
 * Canvas write operations: none (read-only, so DRY_RUN doesn't apply).
 * Required: User Properties CANVAS_BASE_URL and CANVAS_TOKEN.
 */

const QUIZ_REPORT_TAB = 'Quiz report';
const QUIZ_REPORT_LABEL = 'Quiz link:';
const QUIZ_REPORT_FIRST_ROW = 3;
const QUIZ_REPORT_MAX_TEXT = 5000; // a Sheets cell holds 50,000 characters at most
const QUIZ_REPORT_GROUP_COLOR = '#eeeeee';
const QUIZ_REPORT_CHECK_COLOR = '#f4cccc'; // light red: a row with something in Check
const QUIZ_REPORT_HEADERS = Object.freeze(['Kind', 'Group', 'Pick', 'Of', 'Points each',
  'Source', '#', 'Question Type', 'Points', 'Question Name', 'Question', 'Choices',
  'Correct', 'Pictures', 'Check', 'Group ID', 'Question ID']);
const QUIZ_REPORT_TEXT_COLUMNS = Object.freeze(['Group', 'Question Name', 'Question',
  'Choices', 'Correct', 'Pictures', 'Check']);
const QUIZ_PICTURE_BIG =1000 * 1000;  // "shrink it" (Unit 2's failing pictures were near 1 MB)
const QUIZ_PICTURE_LARGE = 500 * 1000; // "worth shrinking"
const QUIZ_FOLDER_MAX_DEPTH = 20;
// Question types whose correct choice(s) are worth showing (weight above 0 = correct).
const QUIZ_CHOICE_TYPES = Object.freeze(['multiple_choice_question', 'true_false_question',
  'multiple_answers_question']);
const QUIZ_TYPE_NAMES = Object.freeze({
  multiple_choice_question: 'Multiple choice',
  true_false_question: 'True/false',
  multiple_answers_question: 'Multiple answers',
  short_answer_question: 'Fill in the blank',
  fill_in_multiple_blanks_question: 'Fill in multiple blanks',
  multiple_dropdowns_question: 'Multiple dropdowns',
  matching_question: 'Matching',
  numerical_question: 'Numerical',
  calculated_question: 'Formula',
  essay_question: 'Essay',
  file_upload_question: 'File upload',
  text_only_question: 'Text (no question)',
});

/** Menu: Canvas Tools › Quiz report (this tab). */
function runQuizReport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const title = 'Quiz report';
  try {
    const sheet = quizReportSheet_(ss);
    const linkCell = sheet.getRange('B1');
    const link = cellLinks_(linkCell.getRichTextValues(), linkCell.getFormulas(),
      linkCell.getDisplayValues())[0][0];
    if (!String(link).trim()) {
      ui.alert(title, `Paste a Classic quiz link from Canvas into B1 of the "${sheet.getName()}" ` +
        'tab, then run Quiz report again.', ui.ButtonSet.OK);
      return;
    }
    const parsed = parseQuizLink_(link);
    if (!parsed) {
      throw sheetProblem_('B1 needs a Classic quiz link, like …/courses/123/quizzes/456 ' +
        '(open the quiz in Canvas and copy the address). New Quizzes aren\'t supported.');
    }
    const root = `/courses/${parsed.courseId}/quizzes/${parsed.quizId}`;
    ss.toast('Reading the quiz…', title, -1);
    const quiz = canvasGet_(root);
    const questions = canvasGet_(`${root}/questions`);
    const groups = new Map();
    quizGroupIds_(questions).forEach(id => {
      try {
        groups.set(id, canvasGet_(`${root}/groups/${id}`));
      } catch (error) {
        if (CANVAS_STOP_ALL_TYPES.includes(error.canvasType)) throw error;
        groups.set(id, { failed: error.canvasType || 'UNEXPECTED' });
      }
    });
    ss.toast('Checking pictures…', title, -1);
    const checkPictures = makeQuizPictureChecker_({ courseId: parsed.courseId,
      baseUrl: getCanvasCredentials_().baseUrl, load: quizPictureLoader_() });
    const report = buildQuizReport_(quiz, questions, groups, checkPictures);
    writeQuizReport_(sheet, report, new Date());
    ss.toast('', title, 1);
    const n = report.counts;
    const pics = checkPictures.stats;
    console.log(`Quiz report: quiz ${parsed.quizId}, ${n.groups} group(s), ${n.questions} ` +
      `question(s), ${n.checks} check(s), points ${report.pointsOk ? 'match' : 'differ'}, ` +
      `${pics.uses} picture(s), ${pics.flagged.size} flagged.`);
    ui.alert(title, `${n.groups} group(s) and ${n.questions} question(s) listed.\n\n` +
      `Points: ${report.pointsMessage}\n\nPictures: ${report.picturesMessage}` +
      (n.checks ? `\n\n${n.checks} row(s) have something in the Check column.` : ''),
    ui.ButtonSet.OK);
  } catch (error) {
    ss.toast('', title, 1);
    reportRefreshFailure_(title, 'The report was not changed.', error);
  }
}

/**
 * The tab to report on: the one being viewed if its A1 says "Quiz link:", otherwise the
 * "Quiz report" tab (made, with its A1 label, if there isn't one), which is then opened.
 */
function quizReportSheet_(ss) {
  const active = ss.getActiveSheet();
  if (exportLabelText_(active.getRange('A1').getDisplayValue()) ===
      exportLabelText_(QUIZ_REPORT_LABEL)) {
    return active;
  }
  const sheet = ss.getSheetByName(QUIZ_REPORT_TAB) || ss.insertSheet(QUIZ_REPORT_TAB);
  if (!String(sheet.getRange('A1').getDisplayValue()).trim()) {
    sheet.getRange('A1').setValue(QUIZ_REPORT_LABEL).setFontWeight('bold');
  }
  sheet.activate();
  return sheet;
}

/** { courseId, quizId } from a Classic quiz link (…/courses/1/quizzes/2…), or null. */
function parseQuizLink_(link) {
  const match = String(link).match(/\/courses\/(\d+)\/quizzes\/(\d+)/);
  return match ? { courseId: match[1], quizId: match[2] } : null;
}

/** Each group ID used by the questions, once, in the order first seen. */
function quizGroupIds_(questions) {
  return Array.from(new Set(questions.map(q => q.quiz_group_id).filter(Boolean)));
}

/**
 * Builds the report from Canvas's replies. groups: Map group ID → the group, or
 * { failed: errorType } when it couldn't be read. checkPictures (optional, from
 * makeQuizPictureChecker_) fills the Pictures column and adds picture problems to Check.
 * Returns { summary: [[label, value]], rows (QUIZ_REPORT_HEADERS order), groupRows
 * (0-based indexes into rows), counts, pointsOk, pointsMessage, picturesOk,
 * picturesMessage }.
 */
function buildQuizReport_(quiz, questions, groups, checkPictures) {
  const inGroup = new Map();
  const tops = [];
  questions.forEach(q => {
    if (!q.quiz_group_id) {
      tops.push({ position: q.position, question: q });
      return;
    }
    if (!inGroup.has(q.quiz_group_id)) inGroup.set(q.quiz_group_id, []);
    inGroup.get(q.quiz_group_id).push(q);
  });
  inGroup.forEach((list, id) => {
    const group = groups.get(id) || {};
    tops.push({ position: group.failed ? quizMinPosition_(list) : group.position,
      groupId: id });
  });
  // Quiz order; at the same position a group comes first.
  const order = item => (Number.isFinite(item.position) ? item.position : Infinity);
  tops.sort((a, b) => order(a) - order(b) || (a.groupId ? -1 : 0) - (b.groupId ? -1 : 0));

  const rows = [];
  const groupRows = [];
  const counts = { groups: 0, questions: 0, checks: 0 };
  let found = 0;
  let number = 0;
  const questionRow = (q, groupName, groupId, points) => {
    number++;
    counts.questions++;
    const answers = quizAnswerCells_(q);
    const text = quizHtmlText_(q.question_text);
    const pictures = checkPictures ? checkPictures(q) : { cell: '', problems: [] };
    const check = [!text ? 'No question text' :
      (QUIZ_CHOICE_TYPES.includes(q.question_type) && !answers.correct ?
        'No correct answer marked' : ''), quizBlankChoices_(q)]
      .concat(pictures.problems).filter(Boolean).join('\n');
    if (check) counts.checks++;
    rows.push(['Question', groupName, '', '', '', '', number,
      QUIZ_TYPE_NAMES[q.question_type] || q.question_type || '', points,
      q.question_name || '', quizCellText_(text), quizCellText_(answers.choices),
      answers.correct, quizCellText_(pictures.cell), check, groupId || '', q.id]);
  };
  tops.forEach(item => {
    if (item.question) {
      const points = Number(item.question.points_possible) || 0;
      found += points;
      questionRow(item.question, '', '', points);
      return;
    }
    const list = inGroup.get(item.groupId).slice()
      .sort((a, b) => (a.position || 0) - (b.position || 0));
    const group = groups.get(item.groupId) || { failed: 'UNEXPECTED' };
    counts.groups++;
    groupRows.push(rows.length);
    if (group.failed) {
      counts.checks++;
      rows.push(['Group', '(couldn\'t read)', '', list.length, '', '', '', '', '', '', '', '',
        '', '', `Couldn't read this group (${group.failed})`, item.groupId, '']);
      list.forEach(q => questionRow(q, '', item.groupId, ''));
      return;
    }
    const pick = Number(group.pick_count) || 0;
    const each = Number(group.question_points) || 0;
    found += pick * each;
    const bank = group.assessment_question_bank_id;
    const check = pick === 0 ? 'Picks 0: students get no question from this group' :
      (!bank && pick > list.length ? `Picks ${pick} but has only ${list.length} question(s)` : '');
    if (check) counts.checks++;
    rows.push(['Group', group.name || '', pick, list.length, each,
      bank ? `Bank ${bank}` : 'In quiz', '', '', pick * each, '', '', '', '', '', check,
      item.groupId, '']);
    list.forEach(q => questionRow(q, group.name || '', item.groupId, each));
  });

  const canvasPoints = Number(quiz.points_possible) || 0;
  const diff = Math.round((canvasPoints - found) * 100) / 100;
  const pointsOk = Math.abs(diff) < 0.01;
  const pointsMessage = pointsOk ? 'OK: every point is accounted for.' :
    (diff > 0 ? `${diff} point(s) not found here. Usually a group that pulls from a ` +
      'question bank: Canvas doesn\'t list those, so they don\'t appear below.' :
      `${-diff} more point(s) here than Canvas shows. Canvas may update its total after ` +
      'the quiz is saved again (Edit › Save).');
  const stats = checkPictures && checkPictures.stats;
  const picturesOk = !stats || !stats.flagged.size;
  const picturesMessage = !stats ? 'Not checked' :
    (!stats.uses ? 'None in these questions.' :
      `${stats.uses} in the questions (${stats.files.size} file(s)). ` +
      (stats.flagged.size ? `${stats.flagged.size} to look at: see the Check column.` :
        'No problems found.'));
  const summary = [
    ['Quiz', quiz.title || ''],
    ['Published', quiz.published ? 'Yes' : 'No'],
    ['Points in Canvas', canvasPoints],
    ['Points found here', found],
    ['Points check', pointsMessage],
    ['Pictures', picturesMessage],
  ];
  return { summary, rows, groupRows, counts, pointsOk, pointsMessage, picturesOk,
    picturesMessage };
}

/**
 * Returns check(question) → { cell, problems }: one Pictures-cell line per picture in the
 * question text or its choices, and the picture problems for the Check column (each
 * once). ctx: { courseId (the quiz's course), baseUrl, load(kind, id) } where load reads
 * 'files' or 'folders' by ID and returns the object or { failed: errorType }.
 * check.stats = { uses, files: Set of picture keys, flagged: Set of keys with a problem }.
 */
function makeQuizPictureChecker_(ctx) {
  const stats = { uses: 0, files: new Set(), flagged: new Set() };
  const check = question => {
    const answers = Array.isArray(question.answers) ? question.answers : [];
    const html = [question.question_text].concat(answers.map(a => a.html)).join('\n');
    const lines = [];
    const problems = [];
    quizPictureTags_(html).forEach(tag => {
      const info = quizPictureInfo_(tag, ctx);
      if (!info) return;
      stats.uses++;
      stats.files.add(info.key);
      if (info.problems.length) stats.flagged.add(info.key);
      lines.push(info.label);
      info.problems.forEach(p => { if (!problems.includes(p)) problems.push(p); });
    });
    return { cell: lines.join('\n'), problems };
  };
  check.stats = stats;
  return check;
}

/** Each <img> in some HTML as { src, endpoint } (endpoint = its data-api-endpoint, if any). */
function quizPictureTags_(html) {
  return (String(html || '').match(/<img\b[^>]*>/gi) || []).map(tag => ({
    src: (tag.match(/\ssrc\s*=\s*(["'])([^"']*)\1/i) || [])[2] || '',
    endpoint: (tag.match(/\sdata-api-endpoint\s*=\s*(["'])([^"']*)\1/i) || [])[2] || '',
  }));
}

/**
 * Where a picture address points: { kind: 'file', fileId, courseId, userFiles } for a
 * Canvas file; 'bank' (old question-bank file); 'outside' with site; 'embedded' with
 * bytes (a data: picture); 'equation' (Canvas's math images, not checked); or 'other'.
 */
function quizPictureSource_(src, baseUrl) {
  const address = String(src || '').replace(/&amp;/g, '&').trim();
  if (/^data:/i.test(address)) {
    return { kind: 'embedded', bytes: Math.round((address.length - address.indexOf(',') - 1) * 3 / 4) };
  }
  const base = String(baseUrl || '').toLowerCase();
  const host = ((address.match(/^(?:https?:)?\/\/([^/?#]+)/i) || [])[1] || '').toLowerCase();
  let path = '';
  if (address.startsWith('/') && !address.startsWith('//')) {
    path = address;
  } else if (base && address.toLowerCase().startsWith(base + '/')) {
    path = address.slice(base.length);
  } else if (host.endsWith('.instructure.com')) {
    path = address.replace(/^(?:https?:)?\/\/[^/?#]+/i, '');
  } else {
    return host ? { kind: 'outside', site: host } : { kind: 'other' };
  }
  if (/^\/equation_images\//i.test(path)) return { kind: 'equation' };
  if (/^\/assessment_questions\//i.test(path)) return { kind: 'bank' };
  const fileId = (path.match(/\/files\/(\d+)(?:[/?#]|$)/) || [])[1];
  if (!fileId) return { kind: 'other' };
  return { kind: 'file', fileId, courseId: (path.match(/^\/courses\/(\d+)\//) || [])[1] || '',
    userFiles: /^\/users\/\d+\//.test(path) };
}

/**
 * One picture's Pictures-cell line and its problems: { key, label, problems }, or null
 * for a math (equation) image. Canvas files are looked up with ctx.load (file, then its
 * folder and the folders above it). Problem wording is what teachers see in Check.
 */
function quizPictureInfo_(tag, ctx) {
  const source = quizPictureSource_(tag.src, ctx.baseUrl);
  const courseId = String(ctx.courseId);
  if (source.kind === 'equation') return null;
  if (source.kind === 'bank') {
    return { key: `bank ${tag.src}`, label: 'old question-bank file', problems: [
      'A picture is an old question-bank file (often broken for students): upload it again into the question'] };
  }
  if (source.kind === 'outside') {
    return { key: `site ${tag.src}`, label: `outside site: ${source.site}`, problems: [
      `A picture comes from an outside site (${source.site}): it can change or disappear; save it and upload it to Canvas`] };
  }
  if (source.kind === 'embedded') {
    const size = quizPictureSize_(source.bytes);
    return { key: `embedded ${tag.src.slice(0, 200)}`, label: `picture inside the question · ${size}`,
      problems: quizPictureSizeProblems_('A picture inside the question', source.bytes) };
  }
  if (source.kind !== 'file') {
    return { key: `other ${tag.src}`, label: 'Canvas picture (not in Files)', problems: [] };
  }

  const id = source.fileId;
  const file = ctx.load('files', id);
  if (file.failed) {
    let problem;
    if (source.userFiles) {
      problem = 'A picture is in someone\'s personal files (students can\'t see it)';
    } else if (source.courseId && source.courseId !== courseId) {
      problem = `A picture is in course ${source.courseId}'s files and can't be opened (students here probably can't see it)`;
    } else if (file.failed === 'NOT_FOUND') {
      problem = 'A picture\'s file can\'t be found (deleted?)';
    } else {
      problem = `A picture's file can't be opened (${file.failed})`;
    }
    return { key: `file ${id}`, label: `file ${id} · can't open`, problems: [problem] };
  }

  const name = String(file.display_name || file.filename || `file ${id}`);
  const what = `Picture "${name}"`;
  const problems = quizPictureSizeProblems_(what, file.size);
  if (file.locked) problems.push(`${what} is unpublished`);
  const fileDates = quizDateRange_(file.unlock_at, file.lock_at);
  if (fileDates) problems.push(`${what} has availability dates (${fileDates}): make sure test day is inside them`);

  const chain = quizFolderChain_(file.folder_id, ctx.load);
  const home = chain[0] && !chain[0].failed ? chain[0] : null;
  if (home) {
    const owner = String(home.context_type || '');
    const ownerId = String(home.context_id || '');
    if (owner === 'User') problems.push(`${what} is in someone's personal files (students can't see it)`);
    else if (owner === 'Group') problems.push(`${what} is in a group's files (students outside the group can't see it)`);
    else if (owner === 'Course' && ownerId && ownerId !== courseId) problems.push(`${what} is in course ${ownerId}'s files`);
  }
  chain.forEach(folder => {
    if (folder.failed) return;
    const folderName = String(folder.name || 'a folder');
    if (folder.locked) problems.push(`${what}: its folder "${folderName}" is unpublished`);
    const dates = quizDateRange_(folder.unlock_at, folder.lock_at);
    if (dates) problems.push(`${what}: its folder "${folderName}" has availability dates (${dates}): make sure test day is inside them`);
  });

  const status = file.locked ? 'Unpublished' : (file.hidden ? 'Link only' : 'Published');
  const tagCourse = (String(tag.endpoint).match(/\/courses\/(\d+)\//) || [])[1];
  const note = tagCourse && tagCourse !== courseId ? ` (old tag: course ${tagCourse})` : '';
  return { key: `file ${id}`, label: `${name} · ${quizPictureSize_(file.size)} · ${status}${note}`,
    problems };
}

/** A folder and the folders above it, nearest first; stops at a folder that can't be read. */
function quizFolderChain_(folderId, load) {
  const chain = [];
  let id = folderId;
  for (let depth = 0; id && depth < QUIZ_FOLDER_MAX_DEPTH; depth++) {
    const folder = load('folders', id);
    chain.push(folder);
    if (folder.failed) break;
    id = folder.parent_folder_id;
  }
  return chain;
}

/** Size problems for a picture: 1 MB and up "shrink it", 500 KB and up "worth shrinking". */
function quizPictureSizeProblems_(what, bytes) {
  const n = Number(bytes);
  if (n >= QUIZ_PICTURE_BIG) return [`${what} is ${quizPictureSize_(n)}: shrink it`];
  if (n >= QUIZ_PICTURE_LARGE) return [`${what} is ${quizPictureSize_(n)}: worth shrinking`];
  return [];
}

/** "4.1 MB", "254 KB", or "size unknown". */
function quizPictureSize_(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || bytes === null || bytes === undefined || bytes === '') return 'size unknown';
  return n >= QUIZ_PICTURE_BIG ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`;
}

/** "from 11/20", "until 11/22", "11/20 to 11/22", or '' when neither date is set. */
function quizDateRange_(from, until) {
  const short = value => {
    const date = new Date(value);
    return isNaN(date.getTime()) ? String(value) : `${date.getMonth() + 1}/${date.getDate()}`;
  };
  if (from && until) return `${short(from)} to ${short(until)}`;
  if (from) return `from ${short(from)}`;
  if (until) return `until ${short(until)}`;
  return '';
}

/**
 * load(kind, id) for the picture check: GETs /files/:id or /folders/:id once per run.
 * A file or folder that can't be read becomes { failed: type } so one picture can't stop
 * the report. Canvas answers 401 both for a bad token and for a file the teacher may not
 * open (another course, someone's files); the quiz was just read with this token, so a
 * 401 here means "not allowed". Setup, network, busy, and unreadable-reply errors still
 * stop the run.
 */
function quizPictureLoader_() {
  const cache = new Map();
  return (kind, id) => {
    const key = `${kind}/${id}`;
    if (!cache.has(key)) {
      let value;
      if (!/^(files|folders)$/.test(kind) || !/^\d+$/.test(String(id))) {
        value = { failed: 'BAD_ID' };
      } else {
        try {
          value = canvasGet_(`/${kind}/${id}`);
        } catch (error) {
          value = { failed: quizPictureFailure_(error) };
        }
      }
      cache.set(key, value);
    }
    return cache.get(key);
  };
}

/** The failure type to record for one picture lookup, or rethrows errors that stop the run. */
function quizPictureFailure_(error) {
  const type = error.canvasType;
  if (type === 'TOKEN_REJECTED' || type === 'NOT_ALLOWED') return 'NOT_ALLOWED';
  if (!type || CANVAS_STOP_ALL_TYPES.includes(type)) throw error;
  return type;
}

/** The smallest question position in a list (for a group whose own position is unknown). */
function quizMinPosition_(list) {
  const positions = list.map(q => q.position).filter(Number.isFinite);
  return positions.length ? Math.min(...positions) : Infinity;
}

/**
 * "Blank answer choice (#4)" (or "choices (#2, #4)") for a multiple choice, true/false,
 * or multiple answers question with an empty choice; '' otherwise. Canvas fills an empty
 * choice with "No answer text provided.", so that counts as blank too.
 */
function quizBlankChoices_(question) {
  if (!QUIZ_CHOICE_TYPES.includes(question.question_type)) return '';
  const answers = Array.isArray(question.answers) ? question.answers : [];
  const blank = answers.map((a, i) => {
    const text = quizAnswerText_(a).trim();
    return !text || /^No answer text provided\.?$/i.test(text) ? `#${i + 1}` : '';
  }).filter(Boolean);
  if (!blank.length) return '';
  return `Blank answer choice${blank.length > 1 ? 's' : ''} (${blank.join(', ')})`;
}

/**
 * A question's answers as two cells: choices ("1) text" per line) and correct (the
 * numbers of the correct choices, only for multiple choice, true/false, and multiple
 * answers).
 */
function quizAnswerCells_(question) {
  const answers = Array.isArray(question.answers) ? question.answers : [];
  const choices = answers.map((a, i) => `${i + 1}) ${quizAnswerText_(a)}`).join('\n');
  const correct = QUIZ_CHOICE_TYPES.includes(question.question_type) ?
    answers.map((a, i) => (Number(a.weight) > 0 ? i + 1 : 0)).filter(Boolean).join(', ') : '';
  return { choices, correct };
}

/**
 * One answer's text: a matching pair as "left → right" (Canvas also puts the left side in
 * text, so pairs come first), else plain text, else its HTML as text, else numeric parts.
 */
function quizAnswerText_(answer) {
  if (answer.left || answer.right) return `${answer.left || ''} → ${answer.right || ''}`;
  if (answer.text) return String(answer.text);
  const html = quizHtmlText_(answer.html);
  if (html) return html;
  if (answer.exact !== undefined && answer.exact !== null) {
    return `${answer.exact}` + (Number(answer.margin) ? ` ± ${answer.margin}` : '');
  }
  if (answer.start !== undefined && answer.start !== null) return `${answer.start} to ${answer.end}`;
  return '';
}

/**
 * Question HTML as readable plain text: line breaks kept, pictures shown as [picture],
 * other tags removed, common &-codes turned back into characters.
 */
function quizHtmlText_(html) {
  const named = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'' };
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<img\b[^>]*>/gi, ' [picture] ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(nbsp|amp|lt|gt|quot|apos);/g, (all, name) => named[name])
    .replace(/&#(\d+);/g, (all, code) => String.fromCharCode(Number(code)))
    .split('\n').map(line => line.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n');
}

/**
 * Text as it should land in a cell: cut to QUIZ_REPORT_MAX_TEXT characters, and a
 * leading = or + gets an apostrophe so Sheets shows it instead of reading a formula.
 */
function quizCellText_(text) {
  const value = String(text || '');
  const cut = value.length > QUIZ_REPORT_MAX_TEXT ?
    value.slice(0, QUIZ_REPORT_MAX_TEXT) + ' …(cut)' : value;
  return /^[=+]/.test(cut) ? `'${cut}` : cut;
}

/** Replaces everything from row 3 down with the report. Rows 1–2 are left alone. */
function writeQuizReport_(sheet, report, now) {
  const first = QUIZ_REPORT_FIRST_ROW;
  const width = QUIZ_REPORT_HEADERS.length;
  if (sheet.getMaxColumns() < width) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), width - sheet.getMaxColumns());
  }
  if (sheet.getMaxRows() >= first) {
    sheet.getRange(first, 1, sheet.getMaxRows() - first + 1, sheet.getMaxColumns())
      .clear().clearNote();
  }
  const summary = report.summary.concat([['Report made', now]]);
  sheet.getRange(first, 1, summary.length, 2).setValues(summary);
  sheet.getRange(first, 1, summary.length, 1).setFontWeight('bold');
  sheet.getRange(first + summary.length - 1, 2).setNumberFormat('M/d/yyyy h:mm am/pm');
  if (!report.pointsOk) sheet.getRange(first + 4, 2).setBackground('#fff2cc');
  if (!report.picturesOk) sheet.getRange(first + 5, 2).setBackground('#fff2cc');

  const headerRow = first + summary.length + 1;
  sheet.getRange(headerRow, 1, 1, width).setValues([QUIZ_REPORT_HEADERS.slice()])
    .setFontWeight('bold');
  if (!report.rows.length) return;
  // Text columns stay plain text, so Sheets can't turn "1, 2, 3" (Correct) or a name like
  // "11/20" into a date. Must be set before the values go in.
  QUIZ_REPORT_TEXT_COLUMNS.forEach(label => sheet.getRange(headerRow + 1,
    QUIZ_REPORT_HEADERS.indexOf(label) + 1, report.rows.length, 1).setNumberFormat('@'));
  const table = sheet.getRange(headerRow + 1, 1, report.rows.length, width);
  table.setValues(report.rows).setVerticalAlignment('top');
  report.groupRows.forEach(i => sheet.getRange(headerRow + 1 + i, 1, 1, width)
    .setBackground(QUIZ_REPORT_GROUP_COLOR).setFontWeight('bold'));
  // Rows needing attention (anything in Check) are light red, group rows included. The
  // table is rewritten each run, so plain shading is used, not conditional formatting.
  const checkIndex = QUIZ_REPORT_HEADERS.indexOf('Check');
  report.rows.forEach((row, i) => {
    if (String(row[checkIndex]).trim()) {
      sheet.getRange(headerRow + 1 + i, 1, 1, width).setBackground(QUIZ_REPORT_CHECK_COLOR);
    }
  });
  const widths = { Question: 400, Choices: 250, Pictures: 300, Check: 300 };
  Object.keys(widths).forEach(label => {
    const col = QUIZ_REPORT_HEADERS.indexOf(label) + 1;
    sheet.getRange(headerRow + 1, col, report.rows.length, 1).setWrap(true);
    sheet.setColumnWidth(col, widths[label]);
  });
}
