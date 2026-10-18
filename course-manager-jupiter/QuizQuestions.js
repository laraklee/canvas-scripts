/**
 * QuizQuestions.js
 * Purpose: quiz questions for the makeAssignment tabs: Classic quizzes (CQ; ported from
 *   the legacy buildQuestionPayload and addQuestionsToClassicQuiz) and New Quizzes (NQ;
 *   new, through the New Quiz Items API). The Questions
 *   table (first label "Question Type", rows below it to the end of the tab) is optional;
 *   MakeAssignment.js finds it, plans each row here, and sends the requests from makeAll.
 *   Four question types only (Lara, 2026-10-18; others need fiddling in Canvas anyway):
 *   - multiple_choice_question: Answer is the correct option's number, e.g. 2.
 *   - multiple_answers_question: Answer lists the correct option numbers, e.g. 1,3.
 *   - true_false_question: Answer is True or False.
 *   - essay_question: no Answer or options.
 *   Options are the Opt 1 to Opt 5 columns; blank options are left out. "Notes
 *   (Ignored)" is not read. No question_name is sent (Canvas uses its default). The
 *   question text is sent as plain text (< > & are escaped so they show as typed).
 *   A row with a blank Question is skipped silently (Lara: a default Question Type in
 *   column A alone doesn't make a question).
 *   Legacy also replaced the quiz instructions with a second request; now the
 *   Instructions: text goes in the request that creates the quiz (MakeAssignment.js).
 *   CQ: the quiz ID is read from the Canvas URL cell (the quiz's link ends in it).
 *   NQ: the same four types become choice, multi-answer (partial credit), true-false,
 *   and essay items; each choice gets a UUID; Points must be above 0; the quiz ID is
 *   its canvasID.
 *   No student data is read or written. Logs counts only.
 * Canvas endpoints called: none directly.
 * Canvas write operations (sent by MakeAssignment.js via canvasWrite_, so DRY_RUN applies):
 *   POST /api/v1/courses/:course/quizzes/:quiz/questions (CQ; one per question row)
 *   POST /api/quiz/v1/courses/:course/quizzes/:assignment_id/items (NQ; one per row)
 * Required User/Script Properties: none here.
 */

const QUESTION_TYPES = Object.freeze(['multiple_choice_question', 'multiple_answers_question',
  'true_false_question', 'essay_question']);
const QUESTION_OPTION_LABELS = Object.freeze(['Opt 1', 'Opt 2', 'Opt 3', 'Opt 4', 'Opt 5']);

/**
 * Plans one question row for a quiz of quizType ('CQ' or 'NQ'; any other type gets the
 * Classic payload, and MakeAssignment.js marks the row "only for CQ or NQ"). cell(label)
 * gives the cell's value, text(label) its displayed text. Returns null when the Question
 * cell is blank (the row is skipped silently, even if a default Question Type or Points
 * is filled in; Lara's choice), { payload } when ready, or { message } when not.
 */
function planQuestion_(rowNumber, cell, text, quizType) {
  const question = text('Question');
  if (!question) return null;
  const plan = { rowNumber };
  if (text('QuestionID')) return Object.assign(plan, { message: 'Skipped: already has a QuestionID' });
  try {
    const spec = parseQuestion_(text('Question Type'), cell('Points'), question, text('Answer'),
      QUESTION_OPTION_LABELS.map(label => text(label)));
    return Object.assign(plan, { payload: quizType === 'NQ' ?
      newQuizItemPayload_(spec, () => Utilities.getUuid()) : questionPayload_(spec) });
  } catch (error) {
    if (!error.isSheetProblem) throw error;
    return Object.assign(plan, { message: 'Not ready: ' + error.message });
  }
}

/**
 * Checks one row and returns { type, points, html, trueIsCorrect?, options, correct }:
 * options are the non-blank options [{ number, text }] (number 1 = Opt 1), correct the
 * correct option numbers.
 */
function parseQuestion_(type, pointsValue, question, answer, optionTexts) {
  if (!type) throw sheetProblem_('no Question Type');
  if (!QUESTION_TYPES.includes(type)) throw sheetProblem_(`Question Type "${type}" is not one of the four`);
  if (isBlank_(pointsValue)) throw sheetProblem_('no Points');
  const points = Number(pointsValue);
  if (isNaN(points) || points < 0) throw sheetProblem_('Points must be a number, 0 or more');
  const spec = { type, points, html: escapeHtml_(question), options: [], correct: [] };
  if (type === 'essay_question') return spec;

  if (type === 'true_false_question') {
    const correct = answer.toLowerCase();
    if (correct !== 'true' && correct !== 'false') throw sheetProblem_('Answer must be True or False');
    spec.trueIsCorrect = correct === 'true';
    return spec;
  }

  // Multiple choice / multiple answers: Answer holds option numbers (1 = Opt 1).
  const numbers = answer.split(',').map(part => part.trim()).filter(Boolean);
  if (!numbers.length) throw sheetProblem_('no Answer (the correct option number)');
  if (numbers.some(n => !/^[1-5]$/.test(n))) {
    throw sheetProblem_('Answer must be option numbers 1 to 5, e.g. 2 or 1,3');
  }
  spec.correct = numbers.map(Number);
  if (type === 'multiple_choice_question' && spec.correct.length > 1) {
    throw sheetProblem_('multiple choice has one correct option; use multiple_answers_question');
  }
  const blankCorrect = spec.correct.filter(n => !optionTexts.slice(n - 1, n)[0]);
  if (blankCorrect.length) throw sheetProblem_(`Opt ${blankCorrect.join(', Opt ')} is blank`);
  spec.options = optionTexts.map((optionText, i) => ({ number: i + 1, text: optionText }))
    .filter(option => option.text);
  if (spec.options.length < 2) throw sheetProblem_('needs at least 2 options');
  return spec;
}

/** The Classic quiz request body for one question (legacy buildQuestionPayload). */
function questionPayload_(spec) {
  const payload = { question: { question_text: spec.html, question_type: spec.type,
    points_possible: spec.points } };
  if (spec.type === 'true_false_question') {
    payload.question.answers = [
      { answer_text: 'True', answer_weight: spec.trueIsCorrect ? 100 : 0 },
      { answer_text: 'False', answer_weight: spec.trueIsCorrect ? 0 : 100 },
    ];
  } else if (spec.type !== 'essay_question') {
    payload.question.answers = spec.options.map(option => ({ answer_text: option.text,
      answer_weight: spec.correct.includes(option.number) ? 100 : 0 }));
  }
  return payload;
}

/**
 * The New Quiz request body for one question (New Quiz Items API; no legacy version).
 * Each choice needs its own ID; makeId gives one (Utilities.getUuid in Apps Script).
 * Multiple answers give partial credit (Lara's choice). Essays use Canvas's defaults (no
 * word limit, no grading notes). New Quizzes need points above 0.
 */
function newQuizItemPayload_(spec, makeId) {
  if (spec.points <= 0) throw sheetProblem_('New Quiz questions need Points above 0');
  const entry = { item_body: `<p>${spec.html}</p>` };
  if (spec.type === 'essay_question') {
    Object.assign(entry, {
      interaction_type_slug: 'essay',
      interaction_data: { rce: true, essay: null, word_count: false, file_upload: false,
        spell_check: false, word_limit_enabled: false, word_limit_max: '1000',
        word_limit_min: '0' },
      scoring_data: { value: '' },
      scoring_algorithm: 'None',
    });
  } else if (spec.type === 'true_false_question') {
    Object.assign(entry, {
      interaction_type_slug: 'true-false',
      interaction_data: { true_choice: 'True', false_choice: 'False' },
      scoring_data: { value: spec.trueIsCorrect },
      scoring_algorithm: 'Equivalence',
    });
  } else {
    const choices = spec.options.map((option, i) => ({ id: makeId(), position: i + 1,
      item_body: `<p>${escapeHtml_(option.text)}</p>`, number: option.number }));
    const correctIds = choices.filter(choice => spec.correct.includes(choice.number))
      .map(choice => choice.id);
    const multiple = spec.type === 'multiple_answers_question';
    Object.assign(entry, {
      interaction_type_slug: multiple ? 'multi-answer' : 'choice',
      interaction_data: { choices: choices.map(({ id, position, item_body }) =>
        ({ id, position, item_body })) },
      scoring_data: { value: multiple ? correctIds : correctIds[0] },
      scoring_algorithm: multiple ? 'PartialScore' : 'Equivalence',
    });
  }
  return { item: { entry_type: 'Item', points_possible: spec.points, entry } };
}

/** Where a Classic quiz question is sent. */
function questionsPath_(courseId, quizId) {
  return `/courses/${courseId}/quizzes/${quizId}/questions`;
}

/** Where a New Quiz question is sent (New Quizzes API; the quiz ID is its canvasID). */
function newQuizItemsPath_(courseId, assignmentId) {
  return `/api/quiz/v1/courses/${courseId}/quizzes/${assignmentId}/items`;
}

/** The quiz ID in a Classic quiz link (…/quizzes/98765), or '' if none. */
function quizIdFromLink_(link) {
  const match = String(link || '').match(/\/quizzes\/(\d+)/);
  return match ? match[1] : '';
}

/** Shows < > & as typed (Canvas reads question text as HTML). */
function escapeHtml_(textValue) {
  return String(textValue).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
