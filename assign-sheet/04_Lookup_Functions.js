/* 04_Lookup_Functions.gs */

/**
 * Custom function: Generates cumulative count for schedule lookup.
 * Resets on Quarter change. Prioritizes Universal Codes (H, Ex).
 * @customfunction
 */
function getScheduleCount(periodStrings, universalCodesRange, quarterRange, targetPeriodsCommaSeparated) {
  if (!periodStrings || !universalCodesRange || !quarterRange || !targetPeriodsCommaSeparated) return [['']];
  
  var regexStr = String(targetPeriodsCommaSeparated).split(',').map(function(p) { return p.trim(); }).join('|');
  var regex = new RegExp(regexStr, 'i');
  
  // Base prefixes for matching short or numeric codes (e.g., EX, EX1, GRAD)
  var universalPrefixes = ['H', 'EX', 'GRAD'];
  
  var result = [];
  var currentCount = 0;
  var currentQuarter = 0;
  var len = Math.min(periodStrings.length, universalCodesRange.length, quarterRange.length);
  
  for (var i = 0; i < len; i++) {
    var pString = String(periodStrings[i][0]);
    var uCode = String(universalCodesRange[i][0]).trim();
    var quarter = Number(quarterRange[i][0]);
    
    if (quarter !== currentQuarter) {
      currentCount = 0;
      currentQuarter = quarter;
    }
    
    if (pString === "" && uCode === "") break;
    
    // Check if the code starts with any of our targeted universal designations
    var isUniversal = false;
    var matchedPrefix = '';
    
    for (var j = 0; j < universalPrefixes.length; j++) {
      if (uCode.toUpperCase().indexOf(universalPrefixes[j]) === 0) {
        isUniversal = true;
        matchedPrefix = universalPrefixes[j];
        break;
      }
    }
    
    if (isUniversal) {
      // Standardize the output identifier token back to the master index trackers
      // This maps EX1, EX2, etc., down to 'Ex' so lookup Holiday/Exemption helpers match cleanly
      var standardizedCode = (matchedPrefix === 'EX') ? 'Ex' : 
                             (matchedPrefix === 'GRAD') ? 'Grad' : uCode;
      result.push([standardizedCode]);
    } 
    else if (pString !== "" && pString.match(regex)) {
      currentCount++;
      result.push([currentCount]);
    } 
    else {
      result.push(['']);
    }
  }
  return result;
}

/**
 * Custom function: Retrieves Day Code/Count sequence for a Quarter.
 * @customfunction
 */
function getDayCodesByQuarter(quarter, periodPairLabel) {
  if (!quarter || !periodPairLabel) return [['ERROR']];
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('*scheduleLookup*');
  if (!sheet) return [['SHEET_MISSING']];

  var searchQuarter = String(quarter).replace(/\s/g, '').trim();
  
  // Find Header Column
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var colIndex = -1;
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i]).trim() === periodPairLabel) {
      colIndex = i;
      break;
    }
  }
  if (colIndex === -1) return [['HEADER_NOT_FOUND']];

  // Filter Data
  var data = sheet.getRange(1, 1, sheet.getLastRow(), colIndex + 1).getValues();
  var results = [];
  
  for (var i = 1; i < data.length; i++) {
    var rowQ = String(data[i][0]).replace(/\s/g, '').trim();
    var code = String(data[i][colIndex]).replace(/\s/g, '').trim();
    
    if (rowQ === searchQuarter && code !== "" && code !== "0") {
      results.push([code]);
    }
  }
  return results;
}

/**
 * Custom function: Retrieves content for a specific day from the *Data* sheets.
 * @customfunction
 */
function getAssignmentContent(quarter, dayCode, periodPairLabel, contentColLetter) {
  if (!quarter || !dayCode || !periodPairLabel || !contentColLetter) return "";
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = '*Data' + periodPairLabel + '*';
  var sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) return "Data Sheet Missing";

  var colIndex = contentColLetter.toUpperCase().charCodeAt(0) - 65;
  var data = sheet.getDataRange().getValues();
  
  var qSearch = String(quarter).replace(/\s/g, '').trim();
  var cSearch = String(dayCode).replace(/\s/g, '').trim();

  for (var i = 1; i < data.length; i++) {
    var rowQ = String(data[i][0]).trim();
    var rowC = String(data[i][1]).trim();
    
    if (rowQ === qSearch && rowC === cSearch) {
      return String(data[i][colIndex]);
    }
  }
  return "";
}

// --- UTILITY LOOKUPS ---

function getPeriodTimes(schedule, period) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("*schedule*");
  if (!sheet) return null;
  
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === schedule && (data[i][1] == period)) {
      return {start: data[i][2], end: data[i][3]};
    }
  }
  return null;
}