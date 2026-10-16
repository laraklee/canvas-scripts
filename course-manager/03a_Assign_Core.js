/**
 * 03a_Assign_Core.gs
 * This file contains Sections 1/2 of functions for creating, fetching, and updating single assignments,
 * quizzes, and discussions, along with batch creation and override management.
 * * NOTE: All blocking ui.alert() calls have been replaced with non-blocking ss.toast().
 * CRITICAL DEPENDENCIES: 00_Config.gs (getConfig), 01_Utilities.gs (convertToUTC, parseTimeValue),
 * 09_MiscTools.gs (clearEditArea, clearCreationIDs).
 */

// --- SECTION 1: SINGLE ASSIGNMENT/CONTENT CREATION ---

/**
 * Master function to create the assignment and immediately apply all overrides. 43
 * A wrapper function that runs the two-step creation process: postOneAssignment (create shell) 
 * followed immediately by createOverrides1 (apply dates to sections) 43.
 */
function makeAssignmentAll() { 
  postOneAssignment(); // 1. Create assignment shell 
  createOverrides1(); // 2. Apply date overrides 
}

/**
 * Creates a single Canvas Assignment. Reads data from Row 3 of the active sheet. 
 * Includes logic to generate an HTML description with embed links (from F4, H4). 45
 */
/**
 * Main function to post a single assignment from the sheet to Canvas.
 */
function postOneAssignment() { 
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  
  try { 
    var userProperties = PropertiesService.getUserProperties(); 
    var canvasApiToken = userProperties.getProperty('CANVAS_API_KEY'); 
    var config = getConfig(); 
    var baseUrl = config.BASE_URL; 
    var courseId = config.COURSE_ID;
    
    // 1. READ DATA FROM SHEET
    var assignmentName = sheet.getRange("B3").getValue();
    var pointsPossible = sheet.getRange("C3").getValue();
    
    // READ SUBMISSION TYPE(S) FROM C4
    // Logic: Splits "online_upload, online_text_entry" into ['online_upload', 'online_text_entry']
    var subTypeValue = sheet.getRange("C4").getValue();
    var submissionTypesArray = subTypeValue ? 
        subTypeValue.toString().split(',').map(function(s) { return s.trim(); }) : 
        ['online_upload']; // Default fallback
    
    var dueAt = sheet.getRange("K3").getValue(); 
    var unlockAt = sheet.getRange("L3").getValue(); 
    var lockAt = sheet.getRange("M3").getValue(); 
    var urls = [sheet.getRange("F4").getValue()]; 

    // 2. CONFIGURATION ERRORS
    if (!canvasApiToken || !baseUrl || !courseId) {
      ss.toast("API Key, Base URL, or Course ID is missing. Check *Config* sheet.", "🚨 Configuration Error", 8);
      return;
    }
    if (!assignmentName) {
      ss.toast("Assignment Name (B3) is required.", "🛑 Input Error", 5);
      return;
    }

    // 3. GENERATE DESCRIPTION (H4 Label, H5 Directions, H6 Color)
    var description = generateDescription(urls);

    // 4. BUILD THE API PAYLOAD
    var payload = {
      assignment: {
        name: assignmentName,
        points_possible: pointsPossible || 0,
        description: description,
        submission_types: submissionTypesArray, 
        published: false,
        due_at: dueAt,
        unlock_at: unlockAt,
        lock_at: lockAt
      }
    };

    // 5. CONDITIONAL LOGIC FOR FILE UPLOADS
    // If 'online_upload' is anywhere in our list, we set the allowed extensions
    if (submissionTypesArray.indexOf('online_upload') !== -1) {
      payload.assignment.allowed_extensions = ['pdf', 'doc', 'docx'];
    }
    
    // 6. EXECUTE THE CALL
    var url = baseUrl + "/api/v1/courses/" + courseId + "/assignments";
    var options = {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + canvasApiToken },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    var resp = UrlFetchApp.fetch(url, options);
    var responseCode = resp.getResponseCode();
    
    if (responseCode >= 200 && responseCode < 300) {
      var newAssignment = JSON.parse(resp.getContentText());
      var assignmentId = newAssignment.id;
      sheet.getRange("A3").setValue(assignmentId);
      
      var linkUrl = baseUrl + "/courses/" + courseId + "/assignments/" + assignmentId;
      var richTextValue = SpreadsheetApp.newRichTextValue()
        .setText("Canvas →").setLinkUrl(linkUrl).build();
      sheet.getRange("A4").setRichTextValue(richTextValue);

      ss.toast("Assignment Created!", "✅ Success", 5);
      return assignmentId;
    } else {
      var errorDetails = resp.getContentText().slice(0, 300);
      ss.toast("Failed (Code " + responseCode + "): " + errorDetails, "🛑 API Error", 10);
      return null;
    }

  } catch (e) {
    ss.toast("System Error: " + e.message, "🔥 Error", 10);
    return null;
  }
}

/**
 * Helper to generate the HTML description.
 * Pulls Link Text from H4, Extra Directions from H5, and Color from H6.
 */
function generateDescription(urls) { 
  var sheet = SpreadsheetApp.getActiveSpreadsheet(); 
  var linkText = sheet.getRange("H4").getValue(); 
  var directions = sheet.getRange("H5").getValue(); // Cell H5
  var color = "#5d783e"; 
  
  var description = "";
  var btnLabel = String(linkText || "Open Resource");

  // 1. ADD THE DIRECTIONS FIRST (Now outside the loop)
  // This ensures H5 appears even if F4 (URLs) is empty.
  if (directions) {
    description += '<div style="margin-bottom: 20px; font-weight: bold; color: #333; font-size: 1.1em;">' + 
                   directions.toString().replace(/\n/g, '<br>') + 
                   '</div>\n';
  }

  // 2. PROCESS URLS (Link/Button + Preview)
  // If F4 is empty, this loop simply won't run, leaving just the directions above.
  for (var i = 0; i < urls.length; i++) { 
    var url = urls[i]; 
    if (!url) continue;

    // ADD THE LINK OR BUTTON
    if (url.includes("drive.google.com") || url.includes("docs.google.com")) {
      description += '<p><a class="inline_disabled" href="' + url + '" target="_blank" rel="noopener">' + btnLabel + '</a></p>\n';
    } else {
      description += '<p><a class="btn" href="' + url + '" target="_blank" rel="noopener" ' +
                     'style="background-color: ' + color + '; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">' + 
                     '🚀 ' + btnLabel + '</a></p>\n';
    }

    // ADD THE PREVIEW (Only for Drive)
    if (url.includes("drive.google.com") || url.includes("docs.google.com")) {
      var src = url.replace('/edit', '/preview').replace('/view', '/preview');
      description += '<p><iframe style="width: 100%; height: 750px; border: 1px solid #ccc;" src="' + src + '" allowfullscreen></iframe></p>\n'; 
    }
  } 

  // 3. FINAL FALLBACK
  // If both were empty, provide a tiny bit of default text so the assignment isn't a blank box.
  if (!description) {
    description = "<p>Please see the assignment title for details or check with your instructor.</p>";
  }

  return description; 
}

/**
 * Creates Assignment Overrides based on data in rows 7-11 of the active sheet. 47
 * It reads pre-built JSON payloads from Column O (Rows 7-11) 48.
 */
function createOverrides1() { 
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var userProperties = PropertiesService.getUserProperties(); 
  var canvasApiToken = userProperties.getProperty('CANVAS_API_KEY'); 
  var config = getConfig(); 
  var baseUrl = config.BASE_URL; 
  var courseId = config.COURSE_ID;
  var assignmentId = sheet.getRange("A3").getValue();

  if (!canvasApiToken || !assignmentId || !courseId) {
    ss.toast("API Key, Assignment ID (A3), or Course ID is missing. Cannot create overrides.", "🛑 Error", 8);
    return;
  }

  var payloadData = sheet.getRange("O7:O11").getValues();
  var errorCount = 0;
  var successCount = 0;
  var overrideUrl = baseUrl + "/api/v1/courses/" + courseId + "/assignments/" + assignmentId + "/overrides";

  for (var i = 0; i < payloadData.length; i++) {
    var payloadJson = payloadData[i][0];
    if (payloadJson) {
      try {
        var payload = JSON.parse(payloadJson);
        // Canvas API requires the override payload to be wrapped in {assignment_override: {...}}
        var options = {
          method: 'post',
          contentType: 'application/json',
          headers: { Authorization: 'Bearer ' + canvasApiToken },
          payload: JSON.stringify({ assignment_override: payload }),
          muteHttpExceptions: true
        };
        var resp = UrlFetchApp.fetch(overrideUrl, options);
        if (resp.getResponseCode() >= 200 && resp.getResponseCode() < 300) {
          var newOverride = JSON.parse(resp.getContentText());
          sheet.getRange(7 + i, 1).setValue(newOverride.id);
          successCount++;
        } else {
          Logger.log("Override POST failed (Row " + (7 + i) + "): " + resp.getContentText().slice(0, 150));
          errorCount++;
        }
      } catch (e) {
        Logger.log("JSON/System Error (Row " + (7 + i) + "): " + e.message);
        errorCount++;
      }
    }
  }

  var message = successCount + " overrides created.";
  if (errorCount > 0) {
    message += " " + errorCount + " errors occurred (see log).";
  }
  ss.toast(message, "Overrides Complete", 5);
}

// --- SECTION 2: SINGLE QUIZ/DISCUSSION CREATION (CONSOLIDATED) ---

/**
 * Creates a single New Quiz shell. Reads basic info and dates from the assignment template (Row 3). 
 * Writes the Quiz/Assignment ID back to A3. 189
 */
function postOneNewQuiz() { 
  var ss = SpreadsheetApp.getActiveSpreadsheet(); 
  var sheet = ss.getActiveSheet(); 
  Logger.log("--- Starting postOneNewQuiz ---"); 

  try { 
    var userProperties = PropertiesService.getUserProperties(); 
    var canvasApiToken = userProperties.getProperty('CANVAS_API_KEY'); 
    var config = getConfig(); 
    var baseUrl = config.BASE_URL; 
    var courseId = config.COURSE_ID;

    // Read required data (Date fields are pulled as raw values)
    var quizName = sheet.getRange("B3").getValue();
    var pointsPossible = sheet.getRange("C3").getValue();
    var rawDueAt = sheet.getRange("K3").getValue(); 
    var rawUnlockAt = sheet.getRange("L3").getValue(); 
    var rawLockAt = sheet.getRange("M3").getValue(); 

    // --- Date Formatting FIX (Preserved for robustness) ---
    var dueAt = rawDueAt ? convertToUTC(rawDueAt) : null;
    var unlockAt = rawUnlockAt ? convertToUTC(rawUnlockAt) : null;
    var lockAt = rawLockAt ? convertToUTC(rawLockAt) : null;
    
    // LOG: Check final formatted dates
    Logger.log("Quiz Name: " + quizName);
    Logger.log("Formatted Due At (K3): " + dueAt);
    Logger.log("Formatted Unlock At (L3): " + unlockAt);

    if (!canvasApiToken || !baseUrl || !courseId || !quizName) {
      ss.toast("Missing config (Key/URL/Course ID) or Quiz Name (B3).", "🚨 Configuration Error", 8);
      Logger.log("Configuration Error: Missing Key/URL/Course ID/Quiz Name.");
      return null;
    }
    
    var payload = {
      quiz: {
        title: quizName,
        points_possible: pointsPossible || 0,
        quiz_type: 'assignment',
        due_at: dueAt,
        unlock_at: unlockAt,
        lock_at: lockAt
      }
    };
    
    var jsonPayload = JSON.stringify(payload);
    var url = baseUrl + "/api/quiz/v1/courses/" + courseId + "/quizzes";
    
    var options = {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + canvasApiToken },
      payload: jsonPayload,
      muteHttpExceptions: true
    };
    
    Logger.log("Final API URL: " + url);
    Logger.log("Final JSON Payload: " + jsonPayload.slice(0, 500));

    var resp = UrlFetchApp.fetch(url, options);
    var responseCode = resp.getResponseCode();
    var responseText = resp.getContentText();
    
    if (responseCode >= 200 && responseCode < 300) {
      
      Logger.log("API Success. Response Code: " + responseCode);
      
      var newQuiz = JSON.parse(responseText);
      
      // *** FIX HERE: Use the primary 'id' field for the Assignment ID ***
      var assignmentId = newQuiz.id; 
      
      Logger.log("Assignment ID received: " + assignmentId); 
      
      if (assignmentId) {
        sheet.getRange("A3").setValue(assignmentId);
      }
      
      // The link URL uses the same ID
// NEW: Standard Assignment viewing path (best for New Quizzes)
var linkUrl = baseUrl + "/courses/" + courseId + "/assignments/" + newQuiz.id;      var richTextValue = SpreadsheetApp.newRichTextValue()
        .setText("Canvas →").setLinkUrl(linkUrl).build();
      sheet.getRange("A4").setRichTextValue(richTextValue);

      ss.toast("New Quiz '" + quizName + "' created with Assignment ID: " + assignmentId, "✅ Success", 5);
      return assignmentId;
    } else {
      Logger.log("API Error. Response Code: " + responseCode);
      Logger.log("Error Response Body: " + responseText);
      
      var errorDetails = responseText.slice(0, 300);
      ss.toast("New Quiz creation failed (Code " + responseCode + "): " + errorDetails, "🛑 API Error", 10);
      return null;
    }
  } catch (e) {
    ss.toast("New Quiz creation failed: " + e.message, "🔥 System Error", 10);
    Logger.log("postOneNewQuiz failed: " + e.message + " Stack: " + e.stack);
    return null;
  }
  Logger.log("--- Exiting postOneNewQuiz ---");
}

/**
 * Master function to create a New Quiz and immediately apply existing overrides. 186
 */
function createQuizWithOverrides() { 
  postOneNewQuiz(); // 1. Create the quiz shell (writes ID to A3) 
  createOverrides1(); // 2. Apply date overrides 
}

/**
 * Creates a single Graded Discussion assignment shell. 198
 */
function postOneNewDiscussion() { 
  var ss = SpreadsheetApp.getActiveSpreadsheet(); 
  var sheet = ss.getActiveSheet(); 
  try { 
    var userProperties = PropertiesService.getUserProperties(); 
    var canvasApiToken = userProperties.getProperty('CANVAS_API_KEY'); 
    var config = getConfig(); 
    var baseUrl = config.BASE_URL; 
    var courseId = config.CourseID;

    var discussionTitle = sheet.getRange("B3").getValue();
    var pointsPossible = sheet.getRange("C3").getValue();
    var dueAt = sheet.getRange("K3").getValue(); 
    var unlockAt = sheet.getRange("L3").getValue(); 
    var lockAt = sheet.getRange("M3").getValue(); 

    if (!canvasApiToken || !baseUrl || !courseId || !discussionTitle) {
      ss.toast("Missing config (Key/URL/Course ID) or Discussion Title (B3).", "🚨 Configuration Error", 8);
      return null;
    }
    
    var payload = {
      title: discussionTitle,
      assignment_due_at: dueAt,
      assignment_unlock_at: unlockAt,
      assignment_lock_at: lockAt,
      is_posted: true,
      //discussion_type: 'graded',
      only_graders_can_rate: false,
      assignment: {
        grading_type: 'points',
        points_possible: pointsPossible || 0,
        submission_types: ['discussion_topic'],
        published: true
      }
    };
    
    var url = baseUrl + "/api/v1/courses/" + courseId + "/discussion_topics";
    var options = {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + canvasApiToken },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    var resp = UrlFetchApp.fetch(url, options);
    var responseCode = resp.getResponseCode();
    
    if (responseCode >= 200 && responseCode < 300) {
      var newTopic = JSON.parse(resp.getContentText());
      // Discussion ID is the Assignment ID for overrides
      var assignmentId = newTopic.assignment_id; 
      sheet.getRange("A3").setValue(assignmentId);
      
      var linkUrl = baseUrl + "/courses/" + courseId + "/discussion_topics/" + newTopic.id;
      var richTextValue = SpreadsheetApp.newRichTextValue()
        .setText("Canvas →").setLinkUrl(linkUrl).build();
      sheet.getRange("A4").setRichTextValue(richTextValue);

      ss.toast("Graded Discussion '" + discussionTitle + "' created with Assignment ID: " + assignmentId, "✅ Success", 5);
      return assignmentId;
    } else {
      var errorDetails = resp.getContentText().slice(0, 300);
      ss.toast("Discussion creation failed (Code " + responseCode + "): " + errorDetails, "🛑 API Error", 10);
      return null;
    }
  } catch (e) {
    ss.toast("Discussion creation failed: " + e.message, "🔥 System Error", 10);
    Logger.log("postOneNewDiscussion failed: " + e.message);
    return null;
  }
}

/**
 * Master function to create a Graded Discussion and immediately apply existing overrides. 195
 */
function createDiscussionWithOverrides() { 
  postOneNewDiscussion(); // 1. Create the discussion shell (writes Assignment ID to A3) 
  createOverrides1(); // 2. Apply date overrides 
}

/**
 * Master function to create a Classic Quiz shell and immediately apply overrides. 191
 */
function postOneClassicQuizWithOverrides() { 
  var ss = SpreadsheetApp.getActiveSpreadsheet(); 
  var sheet = ss.getActiveSheet(); 
  Logger.log("--- Starting postOneClassicQuizWithOverrides ---"); 
  
  try { 
    var userProperties = PropertiesService.getUserProperties(); 
    var canvasApiToken = userProperties.getProperty('CANVAS_API_KEY'); 
    var config = getConfig(); 
    var baseUrl = config.BASE_URL; 
    var courseId = config.COURSE_ID;

    var quizName = sheet.getRange("B3").getValue();
    var dueAt = sheet.getRange("K3").getValue(); 
    var unlockAt = sheet.getRange("L3").getValue(); 
    var lockAt = sheet.getRange("M3").getValue(); 

    // --- NEW DESCRIPTION LOGIC ---
    var url1 = sheet.getRange("F4").getValue();
    var url2 = sheet.getRange("H4").getValue();
    var urls = [];
    if (url1) urls.push(url1);
    if (url2) urls.push(url2);
    
    // Generates the HTML for the description field
    var quizDescription = generateDescription(urls); 
    // ------------------------------

    if (!canvasApiToken || !baseUrl || !courseId || !quizName) {
      ss.toast("Missing config (Key/URL/Course ID) or Quiz Name (B3).", "🚨 Configuration Error", 8);
      return null;
    }
    
    var payload = {
      quiz: {
        title: quizName,
        description: quizDescription, // ADDED: Now includes your links
        quiz_type: 'assignment',
        due_at: dueAt, 
        unlock_at: unlockAt, 
        lock_at: lockAt,
        published: true // NOTE: Students will see this immediately
      }
    };
    
    var url = baseUrl + "/api/v1/courses/" + courseId + "/quizzes";
    var options = {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + canvasApiToken },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    var resp = UrlFetchApp.fetch(url, options);
    var responseCode = resp.getResponseCode();
    
    if (responseCode >= 200 && responseCode < 300) {
      var responseText = resp.getContentText();
      var newQuiz = JSON.parse(responseText);
      
      var assignmentId = newQuiz.assignment_id; 
      var quizId = newQuiz.id;

      // CRITICAL: Writing to A3 before calling overrides
      sheet.getRange("A3").setValue(assignmentId);
      sheet.getRange("O3").setValue(quizId); 

      var linkUrl = baseUrl + "/courses/" + courseId + "/quizzes/" + quizId;
      var richTextValue = SpreadsheetApp.newRichTextValue()
        .setText("Canvas →").setLinkUrl(linkUrl).build();
      sheet.getRange("A4").setRichTextValue(richTextValue);

      ss.toast("Quiz created. Applying overrides...", "✅ Success", 5);
      
      // Since createOverrides1() likely reads cell A3, it will now work again
      createOverrides1(); 
      
      return quizId;
    } else {
      var errorDetails = resp.getContentText();
      ss.toast("Error " + responseCode, "🛑 API Error", 10);
      return null;
    }
  } catch (e) {
    ss.toast("System Error: " + e.message, "🔥 Error", 10);
    return null;
  }
}
