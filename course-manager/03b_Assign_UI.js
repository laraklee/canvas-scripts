/**
 * 03b_AssignUI.gs
 * This file contains Sections 3/4 of functions for creating, fetching, and updating single assignments,
 * quizzes, and discussions, along with batch creation and override management.
 * * NOTE: All blocking ui.alert() calls have been replaced with non-blocking ss.toast().
 * CRITICAL DEPENDENCIES: 00_Config.gs (getConfig), 01_Utilities.gs (convertToUTC, parseTimeValue),
 * 09_MiscTools.gs (clearEditArea, clearCreationIDs).
 */

// --- SECTION 3: QUIZ QUESTION HELPERS (CONSOLIDATED) ---

/**
 * Fetches the internal Canvas Quiz ID associated with the Assignment ID stored in A3. 184
 * Writes the Quiz ID to cell O3 for use by question posting functions.
 */
function getCanvasQuizId() { 
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var ui = SpreadsheetApp.getUi();
  var assignmentId = sheet.getRange('A3').getValue();
  var config = getConfig(); 
  var courseId = config.COURSE_ID;
  var userProperties = PropertiesService.getUserProperties(); 
  var canvasApiToken = userProperties.getProperty('CANVAS_API_KEY');

  if (!assignmentId || !canvasApiToken || !courseId) {
    ss.toast("Missing Assignment ID (A3) or API Key/Course ID.", "🚨 Error", 8);
    return;
  }

  var url = config.BASE_URL + "/api/v1/courses/" + courseId + "/assignments/" + assignmentId;

  try {
    var response = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: { 'Authorization': 'Bearer ' + canvasApiToken },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() === 200) {
      var assignment = JSON.parse(response.getContentText());
      var quizId = assignment.quiz_id;

      if (quizId) {
        sheet.getRange('O3').setValue(quizId);
        ss.toast("Quiz ID " + quizId + " fetched and written to O3.", "✅ Success", 5);
      } else {
        ss.toast("Assignment ID " + assignmentId + " is not linked to a quiz.", "⚠️ Warning", 5);
      }
    } else {
      ss.toast("Failed to fetch assignment (Code " + response.getResponseCode() + ")", "🛑 API Error", 8);
    }
  } catch (e) {
    ss.toast("System Error fetching Quiz ID: " + e.message, "🔥 System Error", 10);
  }
}

/**
 * Reads questions from the sheet (A15:J) and posts them to the Classic Quiz ID found in O3. 193
 */
function addQuestionsToClassicQuiz() { 
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var ui = SpreadsheetApp.getUi();
  var quizID = sheet.getRange("O3").getValue();
  var config = getConfig(); 
  var courseID = config.COURSE_ID;
  var apiKey = PropertiesService.getUserProperties().getProperty('CANVAS_API_KEY');
  var baseUrl = config.BASE_URL;
  
  Logger.log("--- Starting addQuestionsToClassicQuiz ---");
  Logger.log("Quiz ID from O3: " + quizID);

  if (!quizID || !apiKey || !courseID) {
    ss.toast("Missing Quiz ID (O3) or API Key/Course ID.", "🚨 Error", 8);
    Logger.log("Configuration Error: Missing Quiz ID, API Key, or Course ID.");
    return;
  }

  var instructions = sheet.getRange("E13").getValue();
  var startRow = 15;
  // Fetching range is A15:J up to the last row with content
  var questionData = sheet.getRange("A" + startRow + ":J" + sheet.getLastRow()).getValues();
  var successCount = 0;
  
  Logger.log("Number of rows retrieved from sheet (A15:J): " + questionData.length);

  // 1. Update Instructions first (Assuming updateQuizInstructions exists and works)
  if (instructions) {
    updateQuizInstructions(baseUrl, apiKey, courseID, quizID, instructions);
  }

  // 2. Post Questions
  ss.toast("Starting batch post for " + questionData.length + " rows...", "Progress", 5);

  for (var i = 0; i < questionData.length; i++) {
    var row = questionData[i];
    var currentRowNumber = startRow + i; // Real sheet row number
    
    // --- CORRECTED INDEXING BASED ON YOUR LAYOUT (A=0, B=1, C=2, D=3, E=4, F=5, etc.) ---
    var type = String(row[0]).trim();        // Col A: Type (Index 0)
    var points = Number(row[2]);             // Col C: Points (Index 2)
    var questionText = String(row[3]).trim();  // Col D: Question Text (Index 3)
    var answer = String(row[4]).trim();      // Col E: Correct Answer Text (Index 4)
    // Options start at Col F (Index 5) and go to Col J (Index 9). 
    var options = row.slice(5, 10);          // Cols F-J: Options (Index 5 to 9)
    // ---------------------------------------------
    
    Logger.log("Row " + currentRowNumber + " - Raw Data: Type=" + type + ", Points=" + points + 
               ", Text=" + questionText.slice(0, 30) + "...", 
               ", Answer=" + answer + ", Options=" + options.join('|').slice(0, 30) + "...");

    if (!type || !questionText || points === 0) {
      Logger.log("Row " + currentRowNumber + " skipped: Type, Text, or Points is invalid.");
      continue;
    }

    // Assuming buildQuestionPayload(type, points, questionText, answer, options) is defined elsewhere
    var payload = buildQuestionPayload(type, points, questionText, answer, options);
    
    if (!payload) {
      Logger.log("Row " + currentRowNumber + " skipped: buildQuestionPayload returned null or undefined.");
      continue;
    }

    // LOG: Log the payload object before stringification
    Logger.log("Row " + currentRowNumber + " - Payload Object: " + JSON.stringify(payload).slice(0, 500));
    
    // *** API URL FIX: Including /courses/courseID/ to prevent 404 error ***
    var url = baseUrl + "/api/v1/courses/" + courseID + "/quizzes/" + quizID + "/questions";
    
    var optionsFetch = {
      method: 'post',
      headers: { 'Authorization': 'Bearer ' + apiKey },
      muteHttpExceptions: true,
      contentType: 'application/json',
      payload: JSON.stringify(payload)
    };
    
    // LOG: Log the final JSON being sent and the CORRECTED URL
    Logger.log("Row " + currentRowNumber + " - Final JSON Sent: " + optionsFetch.payload.slice(0, 500) + "...");
    Logger.log("Row " + currentRowNumber + " - Corrected API URL: " + url);

    try {
      var response = UrlFetchApp.fetch(url, optionsFetch);
      var responseCode = response.getResponseCode();
      var responseText = response.getContentText();
      
      if (responseCode >= 200 && responseCode < 300) {
        successCount++;
        Logger.log("Row " + currentRowNumber + " - Success. Code: " + responseCode + ", Response: " + responseText.slice(0, 100) + "...");
      } else {
        // Log the full error response body for API troubleshooting
        Logger.log("Question Post Error (Row " + currentRowNumber + ", Code " + responseCode + "): " + responseText);
      }
    } catch (e) {
      Logger.log("Question Post System Error (Row " + currentRowNumber + "): " + e.message + ". Stack: " + e.stack);
    }
  }

  ss.toast("Batch complete: " + successCount + " questions posted.", "✅ Questions Posted", 5);
  Logger.log("--- Exiting addQuestionsToClassicQuiz. Successes: " + successCount + " ---");
}

/**
 * Helper: Updates the description/instructions of the Classic Quiz via PUT request. 200
 */
function updateQuizInstructions(baseUrl, canvasApiToken, courseID, quizID, instructions) { 
  var url = baseUrl + "/api/v1/courses/" + courseID + "/quizzes/" + quizID; 
  var payload = { "quiz": { "description": instructions } };

  var optionsFetch = { 
    "method": "put", 
    "headers": { "Authorization": "Bearer " + canvasApiToken }, 
    "muteHttpExceptions": true, 
    "contentType": "application/json", 
    "payload": JSON.stringify(payload) 
  };

  var response = UrlFetchApp.fetch(url, optionsFetch); 
  if (response.getResponseCode() !== 200) { 
    Logger.log("Failed to update quiz instructions: " + response.getContentText()); 
  }
}

/**
 * Helper: Builds the complex JSON payload required by the Canvas API for a quiz question. 203
 * Corrected to use index-based correctness for multiple choice/answer questions.
 */
function buildQuestionPayload(type, points, questionText, answer, options) { 
  var payload = { 
    question: { 
      question_text: questionText, 
      question_type: type, 
      points_possible: points, 
      answers: [] 
    } 
  };

  switch (type) {
    case "multiple_choice_question":
    case "multiple_answers_question": 
      
      // 1. Process the correct answer indices from Col E (the 'answer' variable)
      // Example: "1,2,3" -> ["1", "2", "3"] -> [1, 2, 3]
      // We also handle cases where 'answer' might be a single number (e.g., '2')
      var correctIndices = String(answer).split(',')
                                        .map(s => parseInt(s.trim()))
                                        .filter(n => !isNaN(n) && n > 0);
      
      // 2. Iterate only over the actual choices (Cols F-J, stored in 'options')
      options.forEach(function(opt, index) {
        var choiceText = String(opt).trim();
        
        // The index is 0-based (F=0, G=1, H=2, ...). 
        // Your sheet uses 1-based numbering (1, 2, 3, ...), so we check against index + 1.
        var choiceNumber = index + 1;
        
        // Check if the current option's number is in the list of correct indices
        var isCorrect = correctIndices.indexOf(choiceNumber) !== -1;

        if (choiceText) { // Only push non-empty choices
          payload.question.answers.push({
            answer_text: choiceText,
            // If it's correct, weight is 100. Otherwise, 0.
            answer_weight: isCorrect ? 100 : 0
          });
        }
      });
      break;
      
    case "true_false_question":
      // True/False logic remains the same
      payload.question.answers.push({
        answer_text: "True", answer_weight: (answer.toLowerCase() === 'true') ? 100 : 0
      });
      payload.question.answers.push({
        answer_text: "False", answer_weight: (answer.toLowerCase() === 'false') ? 100 : 0
      });
      break;
      
    case "essay_question":
      // Essay questions require no answers array
      delete payload.question.answers;
      break;
      
    default:
      Logger.log("buildQuestionPayload: Unknown question type encountered: " + type);
      break;
  }
  return payload;
}


// --- SECTION 4: BATCH CONTENT POSTING (CONSOLIDATED) ---

/**
 * Master function to execute batch creation for multiple rows/content types. 207
 * It iterates through selected rows, checks the type (A, D, NQ, CQ in Col B), and calls 
 * the corresponding single-post function 208.
 */
function postRows() { 
  var ss = SpreadsheetApp.getActiveSpreadsheet(); 
  var ui = SpreadsheetApp.getUi(); 
  var sheet = ss.getActiveSheet(); 
  var selectedRange = sheet.getActiveRange(); 
  var startRow = selectedRange.getRow(); 
  var numRows = selectedRange.getNumRows(); 
  
  // Reading 18 columns total (A to R) - sufficient for live push 
  var batchData = sheet.getRange(startRow, 1, numRows, 18).getValues();
  
  var config = getConfig(); 
  var canvasApiToken = PropertiesService.getUserProperties().getProperty('CANVAS_API_KEY'); 
  var baseUrl = config.BASE_URL; 
  var courseId = config.COURSE_ID;

  if (!canvasApiToken || !courseId) {
    ss.toast("API Key or Course ID is missing. Cannot run batch post.", "🚨 Configuration Error", 8);
    return;
  }

  var successCount = 0;
  var args = { canvasApiToken: canvasApiToken, baseUrl: baseUrl, courseId: courseId, sheet: sheet, startRow: startRow };

  ss.toast("Starting batch post for " + numRows + " rows...", "Progress", 5);

  for (var i = 0; i < numRows; i++) {
    var row = batchData[i];
    var currentRow = startRow + i;
    var contentType = String(row[1]).trim().toUpperCase(); // Col B (Index 1)

    // Write Status column (Col S, Index 18)
    var statusCell = sheet.getRange(currentRow, 19); 
    statusCell.clearContent();
    
    args.currentRow = currentRow;

    try {
      if (contentType === 'A') { // Assignment
        postSingleAssignment(row, args);
        successCount++;
      } else if (contentType === 'D') { // Discussion
        postSingleDiscussion(row, args);
        successCount++;
      } else if (contentType === 'NQ') { // New Quiz
        postSingleNewQuiz(row, args);
        successCount++;
      } else if (contentType === 'CQ') { // Classic Quiz
        postSingleClassicQuiz(row, args);
        successCount++;
      } else {
        statusCell.setValue("Skipped: Unknown Type");
      }
    } catch (e) {
      statusCell.setValue("CRITICAL ERROR: " + e.message.slice(0, 50));
      Logger.log("Batch Post Error Row " + currentRow + ": " + e.message);
    }
  }
  
  ss.toast("Batch Complete! " + successCount + " items posted.", "✅ Batch Success", 5);
}

/**
 * Creates a single Canvas Assignment from a row's data. 209
 */
function postSingleAssignment(data, args) { 
  var assignmentName = String(data[0]).trim(); // Col A (Index 0)
  if (!assignmentName) return; 
  var pointsPossible = Number(data[2]); // Col C (Index 2)
  var dueAt = data[15]; // Col P (Index 15)
  var unlockAt = data[16]; // Col Q (Index 16)
  var lockAt = data[17]; // Col R (Index 17)
  
  var description = generateDescription2(data); 

  var payload = {
    assignment: {
      name: assignmentName,
      points_possible: pointsPossible || 0,
      description: description,
      submission_types: ['online_upload'],
      published: true,
      due_at: dueAt,
      unlock_at: unlockAt,
      lock_at: lockAt
    }
  };
  
  var url = args.baseUrl + "/api/v1/courses/" + args.courseId + "/assignments";
  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + args.canvasApiToken },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var resp = UrlFetchApp.fetch(url, options);
  var statusCell = args.sheet.getRange(args.currentRow, 19); // Col S (Index 19)
  
  if (resp.getResponseCode() >= 200 && resp.getResponseCode() < 300) {
    var newAssignment = JSON.parse(resp.getContentText());
    args.sheet.getRange(args.currentRow, 12).setValue(newAssignment.id); // Col L: ID
    args.sheet.getRange(args.currentRow, 13).setValue(newAssignment.html_url); // Col M: Link
    statusCell.setValue('Posted (A)');
  } else {
    statusCell.setValue('API Error: ' + resp.getResponseCode());
  }
}

function postSingleDiscussion(data, args) { 
  var discussionTitle = String(data[0]).trim(); 
  if (!discussionTitle) return; 
  var pointsPossible = Number(data[2]); 
  
  var dueAt = data[15]; 
  var unlockAt = data[16]; 
  var lockAt = data[17]; 
  
  var message = generateDescription2(data);
  
  var payload = {
    title: discussionTitle,
    message: message,
    is_posted: true,
    // discussion_type: 'graded', // <--- REMOVED (This caused the 400 Error)
    assignment: {
      grading_type: 'points',
      points_possible: pointsPossible || 0,
      published: true,
      due_at: dueAt,
      unlock_at: unlockAt,
      lock_at: lockAt
    }
  };
  
  // LOG THE PAYLOAD: This helps debug future 400 errors
  Logger.log("Row " + args.currentRow + " Payload: " + JSON.stringify(payload));

  var url = args.baseUrl + "/api/v1/courses/" + args.courseId + "/discussion_topics";
  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + args.canvasApiToken },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var resp = UrlFetchApp.fetch(url, options);
  var statusCell = args.sheet.getRange(args.currentRow, 19);
  
  if (resp.getResponseCode() >= 200 && resp.getResponseCode() < 300) {
    var newTopic = JSON.parse(resp.getContentText());
    args.sheet.getRange(args.currentRow, 12).setValue(newTopic.assignment_id); 
    args.sheet.getRange(args.currentRow, 13).setValue(newTopic.html_url); 
    statusCell.setValue('Posted (D)');
  } else {
    // Report the full error message to the cell
    var errorBody = resp.getContentText();
    statusCell.setValue('Error ' + resp.getResponseCode() + ': ' + errorBody.substring(0, 150));
    Logger.log("Discussion Fail: " + errorBody);
  }
}

/**
 * Creates a single New Quiz from a row's data. 213
 */
function postSingleNewQuiz(data, args) { 
  var quizTitle = String(data[0]).trim(); // Col A
  if (!quizTitle) return; 
  var pointsPossible = Number(data[2]); // Col C
  var dueAt = data[15]; 
  var unlockAt = data[16]; 
  var lockAt = data[17]; 
  
  var payload = {
    quiz: {
      title: quizTitle,
      points_possible: pointsPossible || 0,
      quiz_type: 'assignment',
      due_at: dueAt,
      unlock_at: unlockAt,
      lock_at: lockAt
    }
  };
  
  var url = args.baseUrl + "/api/quiz/v1/courses/" + args.courseId + "/quizzes";
  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + args.canvasApiToken },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var resp = UrlFetchApp.fetch(url, options);
  var statusCell = args.sheet.getRange(args.currentRow, 19);
  
  if (resp.getResponseCode() >= 200 && resp.getResponseCode() < 300) {
    var newQuiz = JSON.parse(resp.getContentText());
    args.sheet.getRange(args.currentRow, 12).setValue(newQuiz.assignment_id); // Col L: Assignment ID
    args.sheet.getRange(args.currentRow, 13).setValue(newQuiz.html_url); // Col M: Link
    statusCell.setValue('Posted (NQ)');
  } else {
    statusCell.setValue('API Error: ' + resp.getResponseCode());
  }
}

/**
 * Creates a single Classic Quiz shell from a row's data. 215
 */
function postSingleClassicQuiz(data, args) { 
  var quizTitle = String(data[0]).trim(); // Col A
  if (!quizTitle) return; 
  var pointsPossible = Number(data[2]); // Col C
  var dueAt = data[15]; 
  var unlockAt = data[16]; 
  var lockAt = data[17]; 
  
  var payload = {
    quiz: {
      title: quizTitle,
      quiz_type: 'graded_assignment',
      points_possible: pointsPossible || 0,
      due_at: dueAt,
      unlock_at: unlockAt,
      lock_at: lockAt,
      published: true
    }
  };
  
  var url = args.baseUrl + "/api/v1/courses/" + args.courseId + "/quizzes";
  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + args.canvasApiToken },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var resp = UrlFetchApp.fetch(url, options);
  var statusCell = args.sheet.getRange(args.currentRow, 19);

  if (resp.getResponseCode() >= 200 && resp.getResponseCode() < 300) {
    var newQuiz = JSON.parse(resp.getContentText());
    args.sheet.getRange(args.currentRow, 12).setValue(newQuiz.assignment_id); // Col L: Assignment ID
    args.sheet.getRange(args.currentRow, 13).setValue(newQuiz.id); // Col M: Quiz ID
    statusCell.setValue('Posted (CQ)');
  } else {
    statusCell.setValue('API Error: ' + resp.getResponseCode());
  }
}

/**
 * Helper: Generates HTML description using content from the row array (A=0). 217
 */
function generateDescription2(row) { 
  var descriptionText = row[8]; // Col I (Index 8)
  var url = row[9]; // Col J (Index 9)
  var linkText = row[10]; // Col K (Index 10)
  var description = "";
  
  // 1. Add the description text 
  if (descriptionText) { 
    description += '<p>' + descriptionText + '</p>\n'; 
  } 
  description += '<p><br></p>\n'; // Add line break
  
  // 2. Add the link and iframe (if URL exists) 
  if (url) { 
    var formattedLinkText = String(linkText).split('\n').map(function(line) { 
      return line.trim(); 
    }).filter(function(line) { 
      return line !== ''; 
    }).join('<br>'); 
    
    // Clickable link 
    description += '<p><a class="inline_disabled" href="' + url + '" target="_blank" rel="noopener">' + formattedLinkText + '</a></p>\n';
    
    // Embedded iFrame (replaces /edit with /preview) 
    var iframeSrc = url.replace('/edit', '/preview');
    description += '<p><iframe style="width: 750px; height: 750px;" title="Google Document" src="' + iframeSrc + '" allowfullscreen="allowfullscreen" allow="geolocation *; microphone *; camera *; midi *; encrypted-media *; autoplay *; clipboard-write *; display-capture *"></iframe></p>\n'; 
  } 
  return description; 
}

