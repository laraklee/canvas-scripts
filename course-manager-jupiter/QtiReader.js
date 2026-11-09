/**
 * QtiReader.js
 * Purpose: reads a Canvas quiz QTI export (Classic or New Quizzes; Canvas exports both in
 *   the same QTI 1.2 layout) into a report: the quiz's settings, its groups in order (a
 *   group that pulls from a bank lists the bank's questions when the bank is in the
 *   export), loose questions (every student gets them), each question's choices, correct
 *   choices, pictures with sizes, and problems: pictures that are big, missing from the
 *   export, from an old question-bank file, from an outside site, or in personal files;
 *   blank choices; no correct answer; a group that picks more than it has; a bank that
 *   isn't in the export; points that don't add up.
 *   Pure functions only, so the same file runs in Apps Script (the planned "Quiz report
 *   from export file" upload, 2026-11-08) and in Node (the /quiz-check skill and the
 *   offline check). It reuses QuizReport.js's picture helpers (quizPictureTags_,
 *   quizPictureSource_, quizPictureSize_, quizPictureSizeProblems_, quizHtmlText_).
 *   Quiz content only: an export holds no student data. The quiz's access code is never
 *   read into the report (only whether one is set).
 * Canvas endpoints called: none (reads the export it is given).
 * Canvas write operations: none.
 * Required User/Script Properties: none.
 */

// Question types whose choices are marked right or wrong (same list as Quiz report).
const QTI_CHOICE_TYPES = Object.freeze(['multiple_choice_question', 'true_false_question',
  'multiple_answers_question']);

/**
 * Reads an export. files: { texts: { path: text } for its .xml and .qti files, sizes:
 * { path: bytes } for every file }, paths with "/" and relative to the export's top
 * folder. Returns { quizzes: [quiz], unusedMedia: [path] } where quiz is { title, points,
 * pointsFound, pointsOk, lockdown, timeLimit, accessCode (true/false), entries, flags,
 * counts }. entries, in quiz order: { kind: 'group', group } or { kind: 'question',
 * question }. group: { title, pick, pointsEach, bankRef, bankTitle, bankFound, size,
 * questions, problems }. question: { number, title, type, points, text, choices,
 * correct (choice numbers), pictures: [{ label, key, problems }], problems }.
 */
function qtiReadExport_(files) {
  const texts = files.texts || {};
  const sizes = files.sizes || {};
  const banks = qtiBanks_(texts);
  const used = new Set();
  const quizzes = Object.keys(texts).filter(path => {
    const match = path.match(/^([^/]+)\/([^/]+)\.xml$/);
    return match && match[1] === match[2] && texts[`${match[1]}/assessment_meta.xml`] !== undefined;
  }).sort().map(path => qtiReadQuiz_(texts[path],
    texts[path.replace(/[^/]+\.xml$/, 'assessment_meta.xml')], banks, sizes, used));
  const unusedMedia = Object.keys(sizes).filter(path =>
    !/\.(xml|qti)$/i.test(path) && !used.has(path)).sort();
  return { quizzes, unusedMedia };
}

/** Every bank in the export: Map bank ident → { title, items (raw item text) }. */
function qtiBanks_(texts) {
  const banks = new Map();
  Object.keys(texts).forEach(path => {
    const text = texts[path];
    const bank = text.match(/<objectbank\b[^>]*\bident="([^"]+)"/);
    if (!bank) return;
    banks.set(bank[1], {
      title: qtiUnescape_(qtiFields_(text.split(/<item\b/)[0]).bank_title || ''),
      items: (text.match(/<item\b[\s\S]*?<\/item>/g) || []),
    });
  });
  return banks;
}

/** One quiz: walks its sections (groups) and items in order. */
function qtiReadQuiz_(xml, meta, banks, sizes, used) {
  const settings = new Map();
  [...String(meta || '').matchAll(/<([a-z_]+)>([^<]*)<\/\1>/g)].forEach(m => {
    if (!settings.has(m[1])) settings.set(m[1], m[2]);
  });
  const tag = name => settings.get(name) || '';
  const quiz = {
    title: qtiUnescape_(tag('title')),
    points: Number(tag('points_possible')) || 0,
    lockdown: tag('require_lockdown_browser') === 'true',
    timeLimit: tag('time_limit'),
    accessCode: Boolean(tag('access_code')),
    entries: [],
    flags: [],
    counts: { questions: 0, pictures: 0, pictureFiles: 0, flagged: 0 },
  };
  const pictureFiles = new Set();
  let number = 0;
  const readItem = itemText => {
    number++;
    const question = qtiReadItem_(itemText, number, sizes, used);
    question.pictures.forEach(p => pictureFiles.add(p.key));
    quiz.counts.pictures += question.pictures.length;
    return question;
  };

  // Groups end at </section>; items outside every group are loose.
  const open = [];
  let current = null;
  const re = /<section\b([^>]*)>([\s\S]*?)(?=<item\b|<section\b|<\/section>)|(<item\b[\s\S]*?<\/item>)|(<\/section>)/g;
  let m;
  while ((m = re.exec(xml))) {
    if (m[4] !== undefined) {
      open.pop();
      current = open.length ? open[open.length - 1] : null;
    } else if (m[1] !== undefined) {
      const title = (m[1].match(/\btitle="([^"]*)"/) || [])[1];
      if (title === undefined) {
        open.push(null);
        current = null;
        continue;
      }
      const head = m[2];
      current = {
        title: qtiUnescape_(title),
        pick: Number((head.match(/<selection_number>(\d+)/) || [])[1]) || 0,
        pointsEach: Number((head.match(/<points_per_item>([^<]+)/) || [])[1]) || 0,
        bankRef: (head.match(/<sourcebank_ref>([^<]*)/) || [])[1] || '',
        bankTitle: '',
        bankFound: false,
        questions: [],
        problems: [],
      };
      open.push(current);
      quiz.entries.push({ kind: 'group', group: current });
      if (current.bankRef && banks.has(current.bankRef)) {
        const bank = banks.get(current.bankRef);
        current.bankFound = true;
        current.bankTitle = bank.title;
        bank.items.forEach(itemText => current.questions.push(readItem(itemText)));
      }
    } else {
      const question = readItem(m[3]);
      if (current) current.questions.push(question);
      else quiz.entries.push({ kind: 'question', question });
    }
  }

  let found = 0;
  quiz.entries.forEach(entry => {
    if (entry.kind === 'question') {
      found += entry.question.points;
      return;
    }
    const group = entry.group;
    group.size = group.questions.length;
    found += group.pick * group.pointsEach;
    group.questions.forEach(q => { q.points = group.pointsEach; });
    if (group.bankRef && !group.bankFound) {
      group.problems.push('Pulls from a question bank that isn\'t in this export, so its questions and pictures weren\'t checked');
    } else if (group.pick === 0) {
      group.problems.push('Picks 0: students get no question from this group');
    } else if (group.pick > group.size) {
      group.problems.push(`Picks ${group.pick} but has only ${group.size} question(s)`);
    }
  });
  quiz.pointsFound = Math.round(found * 100) / 100;
  quiz.pointsOk = Math.abs(quiz.pointsFound - quiz.points) < 0.01;
  if (!quiz.pointsOk) {
    quiz.flags.push(`Questions add up to ${quiz.pointsFound} points but the quiz says ${quiz.points}`);
  }
  const all = qtiQuestions_(quiz);
  quiz.counts.questions = all.length;
  quiz.counts.pictureFiles = pictureFiles.size;
  const flaggedFiles = new Set();
  all.forEach(q => q.pictures.forEach(p => { if (p.problems.length) flaggedFiles.add(p.key); }));
  quiz.counts.flagged = flaggedFiles.size;
  return quiz;
}

/** Every question in a quiz, in order (loose ones and those in groups). */
function qtiQuestions_(quiz) {
  return quiz.entries.flatMap(e => (e.kind === 'question' ? [e.question] : e.group.questions));
}

/** One <item>: its type, points, text, choices, correct choices, pictures, and problems. */
function qtiReadItem_(itemText, number, sizes, used) {
  const fields = qtiFields_(itemText.split('</itemmetadata>')[0]);
  const type = fields.question_type || '';
  const presentation = (itemText.match(/<presentation>([\s\S]*?)<\/presentation>/) || [])[1] || '';
  const stem = presentation.split(/<response_/)[0];
  const html = qtiMatTexts_(stem).join('\n');
  const labels = [...presentation.matchAll(/<response_label\b[^>]*\bident="([^"]*)"[^>]*>([\s\S]*?)<\/response_label>/g)]
    .map(match => ({ ident: match[1], html: qtiMatTexts_(match[2]).join(' ') }));
  let choices = labels.map(label => quizHtmlText_(label.html));
  if (type === 'matching_question') {
    choices = [...presentation.matchAll(/<response_lid\b[^>]*>\s*<material>([\s\S]*?)<\/material>/g)]
      .map(match => quizHtmlText_(qtiMatTexts_(match[1]).join(' ')));
  }
  const correctIdents = qtiCorrectIdents_(itemText);
  const correct = QTI_CHOICE_TYPES.includes(type) ?
    labels.map((label, i) => (correctIdents.has(label.ident) ? i + 1 : 0)).filter(Boolean) : [];

  const problems = [];
  const text = quizHtmlText_(html);
  if (!text) problems.push('No question text');
  if (QTI_CHOICE_TYPES.includes(type)) {
    if (!correct.length) problems.push('No correct answer marked');
    const blank = choices.map((c, i) => (!c.trim() || /^No answer text provided\.?$/i.test(c.trim()) ? `#${i + 1}` : ''))
      .filter(Boolean);
    if (blank.length) problems.push(`Blank answer choice${blank.length > 1 ? 's' : ''} (${blank.join(', ')})`);
  }
  const allHtml = [html].concat(labels.map(l => l.html)).join('\n');
  const pictures = quizPictureTags_(allHtml).map(t => qtiPicture_(t.src, sizes, used)).filter(Boolean);
  pictures.forEach(p => p.problems.forEach(problem => {
    if (!problems.includes(problem)) problems.push(problem);
  }));
  return {
    number,
    title: qtiUnescape_((itemText.match(/<item\b[^>]*\btitle="([^"]*)"/) || [])[1] || ''),
    type,
    points: Number(fields.points_possible) || 0,
    text,
    choices,
    correct,
    pictures,
    problems,
  };
}

/** The choice idents a full-credit (100) response condition marks correct. */
function qtiCorrectIdents_(itemText) {
  const idents = new Set();
  (itemText.match(/<respcondition\b[\s\S]*?<\/respcondition>/g) || []).forEach(block => {
    if (!/<setvar\b[^>]*>\s*100(?:\.0+)?\s*<\/setvar>/.test(block)) return;
    const kept = block.replace(/<not>[\s\S]*?<\/not>/g, '');
    [...kept.matchAll(/<varequal\b[^>]*>([^<]*)<\/varequal>/g)].forEach(m => idents.add(m[1].trim()));
  });
  return idents;
}

/**
 * One picture: { label, key, problems }, or null for a math (equation) image. A packed
 * picture ($IMS-CC-FILEBASE$/…) is looked up in sizes (under web_resources/ in Classic
 * exports, at the top in New Quizzes ones) and marked used.
 */
function qtiPicture_(rawSrc, sizes, used) {
  const src = qtiUnescape_(rawSrc).trim();
  if (src.startsWith('$IMS-CC-FILEBASE$/')) {
    let rel = src.slice('$IMS-CC-FILEBASE$/'.length).split('?')[0];
    try { rel = decodeURIComponent(rel); } catch { /* keep as written */ }
    const path = [`web_resources/${rel}`, rel].find(p => sizes[p] !== undefined);
    const name = rel.split('/').pop();
    if (!path) {
      return { label: `${name} · not in export`, key: `missing ${rel}`, problems: [
        `Picture "${name}" is named in the question but isn't in the export (Canvas couldn't copy it, so students may not see it either)`] };
    }
    used.add(path);
    return { label: `${name} · ${quizPictureSize_(sizes[path])}`, key: path,
      problems: quizPictureSizeProblems_(`Picture "${name}"`, sizes[path]) };
  }
  const source = quizPictureSource_(src, '');
  if (source.kind === 'equation') return null;
  if (source.kind === 'bank') {
    return { label: 'old question-bank file', key: `bank ${src}`, problems: [
      'A picture is an old question-bank file (often broken for students): upload it again into the question'] };
  }
  if (source.kind === 'outside') {
    return { label: `outside site: ${source.site}`, key: `site ${src}`, problems: [
      `A picture comes from an outside site (${source.site}): it can change or disappear; save it and upload it to Canvas`] };
  }
  if (source.kind === 'embedded') {
    return { label: `picture inside the question · ${quizPictureSize_(source.bytes)}`, key: `embedded ${src.slice(0, 200)}`,
      problems: quizPictureSizeProblems_('A picture inside the question', source.bytes) };
  }
  if (source.kind === 'file' && source.userFiles) {
    return { label: 'personal file', key: `file ${source.fileId}`, problems: [
      'A picture is in someone\'s personal files (students can\'t see it)'] };
  }
  if (source.kind === 'file') {
    const where = source.courseId ? `course ${source.courseId}'s files` : 'Canvas files';
    return { label: `${where} · not in export`, key: `file ${source.fileId}`, problems: [
      `A picture links to ${where} and wasn't packed into the export: check it in Canvas`] };
  }
  return { label: 'Canvas picture (not a file)', key: `other ${src}`, problems: [] };
}

/** The HTML of each <mattext> in some QTI text (CDATA or &-escaped). */
function qtiMatTexts_(text) {
  return [...String(text).matchAll(/<mattext\b[^>]*>([\s\S]*?)<\/mattext>/g)].map(m => {
    const inner = m[1].trim();
    return inner.startsWith('<![CDATA[') && inner.endsWith(']]>') ?
      inner.slice('<![CDATA['.length, -']]>'.length) : qtiUnescape_(m[1]);
  });
}

/** Metadata fields (fieldlabel → fieldentry), first one wins; an empty entry is ''. */
function qtiFields_(text) {
  const fields = Object.create(null); // no inherited keys, whatever the export's labels are
  [...String(text).matchAll(/<fieldlabel>([^<]*)<\/fieldlabel>\s*(?:<fieldentry>([^<]*)<\/fieldentry>|<fieldentry\s*\/>)/g)]
    .forEach(m => { if (!(m[1] in fields)) fields[m[1]] = m[2] || ''; });
  return fields;
}

/** XML &-codes back to characters (&amp; last, so "&amp;lt;" becomes "&lt;"). */
function qtiUnescape_(text) {
  return String(text || '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, '\'')
    .replace(/&#(\d+);/g, (all, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&');
}
