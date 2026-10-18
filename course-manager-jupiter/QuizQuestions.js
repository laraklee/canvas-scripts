/**
 * QuizQuestions.js
 * Purpose: Classic quiz questions for the makeAssignment tabs (CQ copies only). Ported
 *   from the legacy buildQuestionPayload and addQuestionsToClassicQuiz. The Questions
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
 *   The quiz ID is read from the Canvas URL cell (the quiz's link ends in it).
 *   No student data is read or written. Logs counts only.
 * Canvas endpoints called: none directly.
 * Canvas write operations (sent by MakeAssignment.js via canvasWrite_, so DRY_RUN applies):
 *   POST /api/v1/courses/:course/quizzes/:quiz/questions (one per question row)
 * Required User/Script Properties: none here.
 */

const QUESTION_TYPES = Object.freeze(['multiple_choice_question', 'multiple_answers_question',
  'true_false_question', 'essay_question']);
const QUESTION_OPTION_LABELS = Object.freeze(['Opt 1', 'Opt 2', 'Opt 3', 'Opt 4', 'Opt 5']);

/**
 * Plans one question row. cell(label) gives the cell's value, text(label) its displayed
 * text. Returns null when the Question cell is blank (the row is skipped silently, even
 * if a default Question Type or Points is filled in; Lara's choice), { payload } when
 * ready, or { message } when not.
 */
function planQuestion_(rowNumber, cell, text) {
  const type = text('Question Type');
  const question = text('Question');
  if (!question) return null;
  const plan = { rowNumber };
  if (text('QuestionID')) return Object.assign(plan, { message: 'Skipped: already has a QuestionID' });
  try {
    return Object.assign(plan, { payload: questionPayload_(type, cell('Points'), question,
      text('Answer'), QUESTION_OPTION_LABELS.map(label => text(label))) });
  } catch (error) {
    if (!error.isSheetProblem) throw error;
    return Object.assign(plan, { message: 'Not ready: ' + error.message });
  }
}

/** The request body for one question (legacy buildQuestionPayload, with checks). */
function questionPayload_(type, pointsValue, question, answer, options) {
  if (!type) throw sheetProblem_('no Question Type');
  if (!QUESTION_TYPES.includes(type)) throw sheetProblem_(`Question Type "${type}" is not one of the four`);
  if (isBlank_(pointsValue)) throw sheetProblem_('no Points');
  const points = Number(pointsValue);
  if (isNaN(points) || points < 0) throw sheetProblem_('Points must be a number, 0 or more');

  const payload = { question: { question_text: escapeHtml_(question), question_type: type,
    points_possible: points } };
  if (type === 'essay_question') return payload;

  if (type === 'true_false_question') {
    const correct = answer.toLowerCase();
    if (correct !== 'true' && correct !== 'false') throw sheetProblem_('Answer must be True or False');
    payload.question.answers = [
      { answer_text: 'True', answer_weight: correct === 'true' ? 100 : 0 },
      { answer_text: 'False', answer_weight: correct === 'false' ? 100 : 0 },
    ];
    return payload;
  }

  // Multiple choice / multiple answers: Answer holds option numbers (1 = Opt 1).
  const numbers = answer.split(',').map(part => part.trim()).filter(Boolean);
  if (!numbers.length) throw sheetProblem_('no Answer (the correct option number)');
  if (numbers.some(n => !/^[1-5]$/.test(n))) {
    throw sheetProblem_('Answer must be option numbers 1 to 5, e.g. 2 or 1,3');
  }
  const correct = numbers.map(Number);
  if (type === 'multiple_choice_question' && correct.length > 1) {
    throw sheetProblem_('multiple choice has one correct option; use multiple_answers_question');
  }
  const blankCorrect = correct.filter(n => !options.slice(n - 1, n)[0]);
  if (blankCorrect.length) throw sheetProblem_(`Opt ${blankCorrect.join(', Opt ')} is blank`);
  payload.question.answers = options
    .map((option, i) => ({ option, number: i + 1 }))
    .filter(entry => entry.option)
    .map(entry => ({ answer_text: entry.option,
      answer_weight: correct.includes(entry.number) ? 100 : 0 }));
  if (payload.question.answers.length < 2) throw sheetProblem_('needs at least 2 options');
  return payload;
}

/** Where a question is sent. */
function questionsPath_(courseId, quizId) {
  return `/courses/${courseId}/quizzes/${quizId}/questions`;
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
