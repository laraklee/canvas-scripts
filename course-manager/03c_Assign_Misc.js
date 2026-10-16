/**
 * 03c_Assign_Misc.gs
 * ARCHITECTURE:
 * - Session Anchor (F1): Static ID used for all updates.
 * - Hands-Off K-O: The script is now physically blocked from clearing or writing to K, L, M, N, or O.
 * - UI Only: Fetch and Reset only touch Columns A, B, C, D, F, G, H, I, J.
 * - Update Logic: Strictly reads the result of your formulas in Column O.
 * 
 * V2026.04: Hands-Off K-O Version. Script handles A-J; Formulas handle K-O. Do not use setValue() on K-O.
 */

// --- SECTION 1: MASTER CONTROLLERS ---

function fetchAssignment() { 
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var assignmentId = sheet.getRange("A3").getValue(); 

  if (!assignmentId) { 
    ss.toast('Select an assignment in B3 first.', '🛑 No ID'); 
    return; 
  } 

  var assignmentData = fetchAssignmentFromCanvas(assignmentId); 
  if (!assignmentData) { 
    ss.toast('Assignment ID not found in Canvas.', '🛑 Fetch Error');
    return; 
  } 

  // 1. Stamp the Anchor (Static ID)
  sheet.getRange("F1").setValue(assignmentId);

  // 2. Populate UI inputs ONLY (B, C, D, F, G, H, I, J)
  populateEditSheetWithAssignmentData(sheet, assignmentData); 

  // 3. Update Canvas Link
  var config = getConfig(); 
  var linkUrl = config.BASE_URL + "/courses/" + config.COURSE_ID + "/assignments/" + assignmentId;
  sheet.getRange("A4").setRichTextValue(SpreadsheetApp.newRichTextValue().setText("Canvas →").setLinkUrl(linkUrl).build());

  ss.toast('Assignment loaded. Your K-O formulas are safe.', '✅ Success');
}

/**
 * Mapped to "Update" Button.
 * Strictly READS from your Column O formulas.
 */
function updateAssignmentInCanvas() { 
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var anchoredId = sheet.getRange("F1").getValue();
  
  if (!anchoredId) {
    ss.toast('No ID in F1. Fetch first.', '🛑 Error');
    return;
  }

  // Ensure formulas have finished calculating
  SpreadsheetApp.flush(); 

  // 1. Update Main Assignment (Row 3) using O3
  var mainPayload = sheet.getRange("O3").getValue();
  if (mainPayload && mainPayload !== "") {
    updateCanvasEntity(anchoredId, mainPayload, true); 
  }

  // 2. Update/Create Overrides (Rows 7-11) using O7:O11
  updateOverridesFromColO(sheet, anchoredId);
  
  ss.toast("Update synced to Canvas.", '✅ Done');
}

// --- SECTION 2: UI RESET & SELF-HEALING ---

function resetAssignmentEditor() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  
  // Wipe Session & UI Inputs (A-J ONLY)
  sheet.getRange("F1").clearContent();      
  sheet.getRange("A4").clearContent();      
  sheet.getRange("B3:C3").clearContent();   
  sheet.getRange("D3").clearContent();      
  sheet.getRange("F3:J3").clearContent();   

  sheet.getRange("A7:A11").clearContent();  
  sheet.getRange("C7:D11").clearContent();  
  sheet.getRange("F7:J11").clearContent();  
  
  // Restore A, B, and E lookup formulas
  injectInfrastructureFormulas(sheet);
  ss.toast("UI Cleared. Formulas in K-O preserved.", "🧹 Done");
}

function injectInfrastructureFormulas(sheet) {
  // A3: Search | E3: Schedule Label
  sheet.getRange("A3").setFormula('=IFERROR(INDEX(\'*assignmentGroups*\'!A:A, MATCH(B3, \'*assignmentGroups*\'!B:B, 0)), "")');
  sheet.getRange("E3").setFormula('=IF(D3<>"", VLOOKUP(D3, \'*simpleSchedule*\'!C:F, 3, FALSE) & " : " & VLOOKUP(D3, \'*simpleSchedule*\'!C:F, 4, FALSE), "")');

  for (var r = 7; r <= 11; r++) {
    // B: Section ID | E: Schedule Label
    sheet.getRange("B" + r).setFormula('=IFERROR(INDEX(\'*SectionLookup*\'!A:A, MATCH(C' + r + ', \'*SectionLookup*\'!C:C, 0)), "")');
    sheet.getRange("E" + r).setFormula('=IF(D' + r + '<>"", VLOOKUP(D' + r + ', \'*simpleSchedule*\'!C:F, 3, FALSE) & " : " & VLOOKUP(D' + r + ', \'*simpleSchedule*\'!C:F, 4, FALSE), "")');
  }
}

// --- SECTION 3: API DISPATCHERS ---

function updateCanvasEntity(id, jsonPayload, isMainAssignment) {
  var token = PropertiesService.getUserProperties().getProperty('CANVAS_API_KEY');
  var config = getConfig();
  var wrapper = isMainAssignment ? "assignment" : "assignment_override";
  var payload = {};
  
  try {
    payload[wrapper] = JSON.parse(jsonPayload);
  } catch(e) {
    Logger.log("JSON Parse Error: " + e);
    return;
  }

  UrlFetchApp.fetch(config.BASE_URL + "/api/v1/courses/" + config.COURSE_ID + "/assignments/" + id, {
    method: 'put', contentType: 'application/json', headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify(payload), muteHttpExceptions: true
  });
}

function updateOverridesFromColO(sheet, anchoredId) { 
  var token = PropertiesService.getUserProperties().getProperty('CANVAS_API_KEY');
  var config = getConfig(); 
  var data = sheet.getRange(7, 1, 5, 15).getValues(); 

  for (var idx = 0; idx < data.length; idx++) { 
    var row = data[idx];
    if (!row[1] || !row[14]) continue; 
    
    var overrideId = row[0]; 
    var isUpdate = overrideId && String(overrideId).trim() !== "" && String(overrideId).trim() !== "0";
    var url = config.BASE_URL + "/api/v1/courses/" + config.COURSE_ID + "/assignments/" + anchoredId + "/overrides" + (isUpdate ? "/" + overrideId : "");
    
    var payload = {};
    try {
      payload["assignment_override"] = JSON.parse(row[14]);
    } catch(e) { continue; }

    var resp = UrlFetchApp.fetch(url, { 
      method: isUpdate ? 'put' : 'post', contentType: 'application/json', headers: { Authorization: 'Bearer ' + token }, 
      payload: JSON.stringify(payload), muteHttpExceptions: true 
    });

    if (resp.getResponseCode() >= 200 && resp.getResponseCode() < 300) {
      var result = JSON.parse(resp.getContentText());
      sheet.getRange(7 + idx, 1).setValue(result.id); 
    }
  } 
}

// --- SECTION 4: FETCH HELPERS ---

function populateEditSheetWithAssignmentData(sheet, assignment) { 
  sheet.getRange("B3").setValue(assignment.name);
  sheet.getRange("C3").setValue(assignment.points_possible);
  
  var tz = Session.getScriptTimeZone();
  function setDateTimeSplit(row, due_at, unlock_at, lock_at) { 
    function split(dateStr, dateCol, timeCol) { 
      if (dateStr && String(dateStr).trim() !== "") { 
        var d = new Date(dateStr);
        sheet.getRange(dateCol + row).setValue(Utilities.formatDate(d, tz, "MM/dd/yyyy"));
        var timeCell = sheet.getRange(timeCol + row);
        timeCell.setDataValidation(null); 
        timeCell.setValue(Utilities.formatDate(d, tz, "hh:mm a")); 
      }
    } 
    split(due_at, "D", "F"); 
    split(unlock_at, "G", "H"); 
    split(lock_at, "I", "J"); 
  }

  setDateTimeSplit(3, assignment.due_at, assignment.unlock_at, assignment.lock_at);
  
  // Wipe ONLY Columns A-J for Overrides
  sheet.getRange("A7:A11").clearContent();
  sheet.getRange("C7:D11").clearContent(); 
  sheet.getRange("F7:J11").clearContent(); 
  
  var overrides = fetchAssignmentOverrides(assignment.id);
  if (overrides) { 
    var sectionOverrides = overrides.filter(function(o) { return o.course_section_id; });
    sectionOverrides.forEach(function(o, idx) { 
      if (idx > 4) return; 
      var row = 7 + idx; 
      sheet.getRange("A" + row).setValue(o.id); 
      var periodName = getPeriodNameFromId(o.course_section_id); 
      sheet.getRange("C" + row).setValue(periodName || ("ID: " + o.course_section_id)); 
      setDateTimeSplit(row, o.due_at, o.unlock_at, o.lock_at); 
    }); 
  }
  
  // Restore lookup formulas for A, B, E only
  injectInfrastructureFormulas(sheet);
}

function getPeriodNameFromId(sectionId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var lookupSheet = ss.getSheetByName('*SectionLookup*');
  if (!lookupSheet) return "";
  var data = lookupSheet.getDataRange().getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]) === String(sectionId)) return data[i][2]; 
  }
  return "";
}

function fetchAssignmentFromCanvas(assignmentId) { 
  var token = PropertiesService.getUserProperties().getProperty('CANVAS_API_KEY'); 
  var config = getConfig(); 
  var resp = UrlFetchApp.fetch(config.BASE_URL + "/api/v1/courses/" + config.COURSE_ID + "/assignments/" + assignmentId, {
    method: 'get', headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true
  });
  return resp.getResponseCode() === 200 ? JSON.parse(resp.getContentText()) : null;
}

function fetchAssignmentOverrides(assignmentId) { 
  var token = PropertiesService.getUserProperties().getProperty('CANVAS_API_KEY');
  var config = getConfig(); 
  var resp = UrlFetchApp.fetch(config.BASE_URL + "/api/v1/courses/" + config.COURSE_ID + "/assignments/" + assignmentId + "/overrides", { 
    method: 'get', headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true 
  });
  return resp.getResponseCode() === 200 ? JSON.parse(resp.getContentText()) : null;
}

/**
 * Clears only the core Assignment ID (A3) and the Override ID columns (A7-A11)
 * to prepare the template for a fresh assignment creation run.
 */
function clearCreationIDs() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var ui = SpreadsheetApp.getUi();

  // Clear specific cells: A3 (Assignment ID) and A7-A11 (Override IDs)
  var cellsToClear = ["A3","A4","A7", "A8", "A9", "A10", "A11"];

  cellsToClear.forEach(function(cellAddress) {
    sheet.getRange(cellAddress).clearContent();
  });

  SpreadsheetApp.flush();
  ui.alert('Success', 'Assignment and Override IDs cleared.', ui.ButtonSet.OK);
}