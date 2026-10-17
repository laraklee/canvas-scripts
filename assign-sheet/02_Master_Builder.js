/* 02_Master_Builder.gs */

/**
 * MASTER CONTROLLER
 * Runs the full chain: Refresh -> Schedule -> Master -> Consolidate -> Refresh Formulas
 */
function runFullScheduleUpdate() {
  const ss = SpreadsheetApp.getActive();

  // 1. Refresh Imports (Assuming refreshSimpleSchedule is defined elsewhere)
  ss.toast('Step 1/5: Refreshing connection...', 'Update', -1);
  refreshSimpleSchedule();
  
  // 2. Build Schedule Lookup
  ss.toast('Step 2/5: Building Schedule Lookup...', 'Update', -1);
  buildScheduleLookup();
  
  // 3. Build Assignment Master
  ss.toast('Step 3/5: Building Assignment Master...', 'Update', -1);
  buildAssignmentMaster();
  
  // 4. Consolidate Final Data (This step deletes/recreates AssignmentLookupFinal)
  ss.toast('Step 4/5: Consolidating Final Data...', 'Update', -1);
  consolidateAssignmentData();
  
  // 5. Fix Broken References
  // This step re-validates the formulas in Q1, Q2, Q3, Q4 that point to the new AssignmentLookupFinal.
  ss.toast('Step 5/5: Fixing broken references...', 'Update', -1);
  refreshAllQuarterSheets();
  
  // FINAL SUCCESS MESSAGE
  // Use toast instead of alert so the script exits immediately and stops the spinner.
  ss.toast('Full Schedule Update Complete!', 'SUCCESS', 5);
  console.log("runFullScheduleUpdate: Finished.");
}

/**
 * STEP 1: Build *scheduleLookup*
 * Maps columns directly from *simpleSchedule* (Vertical Layout) to *scheduleLookup*.
 * UPDATED: Now fetches Drills from Col G and puts them in Col K.
 */
function buildScheduleLookup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var scheduleLookup = ss.getSheetByName('*scheduleLookup*') || ss.insertSheet('*scheduleLookup*');
  var sourceSheet = ss.getSheetByName('*simpleSchedule*');

  if (!sourceSheet) {
    console.error("Source *simpleSchedule* missing.");
    return;
  }

  scheduleLookup.clearContents();
  
  // 1. Set Headers (Cols A-K)
  // We added 'Drills' at index 11 (Column K)
  scheduleLookup.getRange(1, 1, 1, 11).setValues([
    ['Quarter', 'Date', 'Week', 'Schedule', 'Periods', 'Times', '1,2', '3,4', '5,6', '7,8', 'Drills']
  ]);

  // 2. Read Source Data (A:I)
  var lastRow = sourceSheet.getLastRow();
  if (lastRow < 2) return; 
  
  var sourceData = sourceSheet.getRange(2, 1, lastRow - 1, 9).getValues(); 
  var mainData = [];  // For Cols A-F
  var drillData = []; // For Col K

  // 3. Map Columns
  for (var i = 0; i < sourceData.length; i++) {
    var row = sourceData[i];
    
    var quarter = row[0];   // Source A
    var week = row[1];      // Source B
    var date = row[2];      // Source C
    var schedule = row[4];  // Source E
    var periods = row[5];   // Source F
    var drill = row[6];     // Source G (The new Drill Column)
    var timesJSON = row[8]; // Source I

    if (date && schedule && String(date) !== "") {
       // Push A-F
       mainData.push([quarter, date, week, schedule, periods, timesJSON]);
       // Push K (Drill)
       drillData.push([drill]);
    }
  }

  // 4. Write to Destination
  if (mainData.length > 0) {
    // Write A-F (Main Data)
    scheduleLookup.getRange(2, 1, mainData.length, 6).setValues(mainData);
    
    // Write K (Drills) - We skip G-J because they hold formulas
    scheduleLookup.getRange(2, 11, drillData.length, 1).setValues(drillData);
    
    // Inject Formulas (G-J)
    var formulaRange = scheduleLookup.getRange("G2:J2");
    formulaRange.setFormulas([
      ['=getScheduleCount(E2:E, D2:D, A2:A, G$1)', 
       '=getScheduleCount(E2:E, D2:D, A2:A, H$1)', 
       '=getScheduleCount(E2:E, D2:D, A2:A, I$1)', 
       '=getScheduleCount(E2:E, D2:D, A2:A, J$1)']
    ]);
  }

  convertWeekNumbersToPlainText(scheduleLookup);
  SpreadsheetApp.flush();
  console.log("buildScheduleLookup: Complete (with Drills).");
}

/**
 * STEP 2: Build AssignmentMaster
 * Creates the single, stable source for final assignment views.
 * UPDATED: Reads Drills directly from Col K.
 */
// --- File: 02_Master_Builder.gs ---

function buildAssignmentMaster() {
  console.log("Starting buildAssignmentMaster...");
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var destSheet = ss.getSheetByName('AssignmentMaster') || ss.insertSheet('AssignmentMaster');
  var lookupSheet = ss.getSheetByName('*scheduleLookup*');

  if (!lookupSheet) {
    console.error("Lookup sheet missing.");
    return;
  }

  // Read A:K (K is the Drill/Holiday Name column)
  var fullSourceData = lookupSheet.getRange('A1:K' + lookupSheet.getLastRow()).getValues();
  var dataBlock = fullSourceData.slice(1);

  // Counters
  let holidayCounter = 0;
  let exemptionCounter = 0;

  // Constants
  const DATE_COL = 1;
  const SCHEDULE_NAME_COL = 3;
  const PERIODS_STRING_COL = 4;
  const DRILL_COL = 10; // Column K (Index 10) holds the Drill/Holiday Name
  const COUNT_COL_INDEXES = { '1,2': 6, '3,4': 7, '5,6': 8, '7,8': 9 };

  var masterData = [];
  var periodPairs = ['1,2', '3,4', '5,6', '7,8'];
  var timeZone = ss.getSpreadsheetTimeZone();

  // Headers
  var masterHeaders = ['Quarter', 'Date', 'Day', 'ScheduleName', 'PeriodsString'];
  periodPairs.forEach(pair => masterHeaders.push(`Key_${pair}`, `Text_${pair}`));
  masterData.push(masterHeaders);

  // Loop
  dataBlock.forEach((rowData, rowIndex) => {
    var date = rowData[DATE_COL];
    if (!(date instanceof Date)) return;

    var quarter = String(rowData[0]);
    var scheduleNameRaw = String(rowData[SCHEDULE_NAME_COL]).trim();
    var periodsStringRaw = String(rowData[PERIODS_STRING_COL]).trim();

    // UPDATED: Read descriptive text (if any) directly from Drill column (K)
    var drillName = String(rowData[DRILL_COL] || "").trim();

    var dateStr = Utilities.formatDate(date, timeZone, "M/dd");
    var dayStr = Utilities.formatDate(date, timeZone, "EEE");

    var masterRow = [quarter, dateStr, dayStr, scheduleNameRaw, periodsStringRaw];

    // Global Counts (Determines H or Ex for all periods on this date)
    let rowUniqueCode = '';
    for (const key in COUNT_COL_INDEXES) {
      const code = String(rowData[COUNT_COL_INDEXES[key]]).trim();
      if (code === "H") {
        holidayCounter++;
        rowUniqueCode = 'H' + holidayCounter;
        break;
      } else if (code === "Ex") {
        exemptionCounter++;
        rowUniqueCode = 'Ex' + exemptionCounter;
        break;
      }
    }

    // Build Pairs
    periodPairs.forEach(pair => {
      const countIndex = COUNT_COL_INDEXES[pair];
      var dayCountCode = String(rowData[countIndex]).trim();
      var finalPeriodsString = periodsStringRaw;

      var finalUniqueDayCode = '';
      if (rowUniqueCode !== '') finalUniqueDayCode = rowUniqueCode;
      else if (dayCountCode !== '' && dayCountCode !== '0') finalUniqueDayCode = dayCountCode;

      var finalUniqueKey = (finalUniqueDayCode !== '') ? (quarter + '#' + finalUniqueDayCode) : '';

      var textBlock = "";
      if (finalUniqueKey !== '') {
        // --- REFACTORED LOGIC START ---
        // If it's a Holiday or Exemption, the descriptive text comes from the drillName (Col K)
        if (dayCountCode === "H" || dayCountCode === "Ex") {
          finalPeriodsString = drillName || scheduleNameRaw; // Use drillName, or fallback to schedule name
        }
        // If it's a regular schedule, finalPeriodsString is already set (periodsStringRaw)
        
        var line1 = dateStr + " ~ " + dayStr;
        
        // If drillName exists, use it as the third line, otherwise use the schedule/periods
        var line2 = (dayCountCode === "H" || dayCountCode === "Ex") ? finalPeriodsString : (scheduleNameRaw + ": " + finalPeriodsString);
        
        // Append Drill/Notes (if it's not the main name, or if it's not a holiday/exemption)
        // This logic keeps simple drill notes separate from the main schedule name
        var line3 = (drillName !== "" && dayCountCode !== "H" && dayCountCode !== "Ex") ? "\n" + drillName : "";

        // Final text block combines lines 1, 2, and the optional notes line 3
        textBlock = line1 + "\n" + line2 + line3;
        // --- REFACTORED LOGIC END ---
      }

      masterRow.push(finalUniqueKey, textBlock);
    });

    masterData.push(masterRow);
  });

  destSheet.clearContents();
  if (masterData.length > 0) {
    destSheet.getRange(1, 1, masterData.length, masterData[0].length).setValues(masterData);
  }
  console.log("buildAssignmentMaster: Complete.");
}

/**
 * HELPER: Converts superscript week numbers (¹²³) to plain text (123).
 */
function convertWeekNumbersToPlainText(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return; 

  var weekColumn = sheet.getRange("C2:C" + lastRow);
  var weekValues = weekColumn.getValues();

  var superscriptMap = {
    '¹': '1', '²': '2', '³': '3',  '⁴' : '4',  '⁵' : '5',
    '⁶' : '6',  '⁷' : '7',  '⁸' : '8',  '⁹' : '9',  '⁰' : '0'
  };

  for (var i = 0; i < weekValues.length; i++) {
    if (weekValues[i][0]) {
      weekValues[i][0] = weekValues[i][0].toString().split('').map(c => superscriptMap[c] || c).join('');
    }
  }
  weekColumn.setValues(weekValues);
}

/**
 * STEP 3: Consolidate Assignment Data
 * Creates the simplified lookup sheet 'AssignmentLookupFinal' optimized for VLOOKUPs.
 */
function consolidateAssignmentData() {
  console.log("Starting consolidateAssignmentData...");
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sourceSheet = ss.getSheetByName('AssignmentMaster');
  var destSheet = ss.getSheetByName('AssignmentLookupFinal') || ss.insertSheet('AssignmentLookupFinal');
  
  if (!sourceSheet) {
    console.error("AssignmentMaster sheet not found.");
    return;
  }

  // 1. Get Configuration
  // We use the helper from 00_Config to see which pairs are checked
  var desiredPeriodPairs = getConfiguredPeriodPairs(); 
  if (desiredPeriodPairs.length === 0) desiredPeriodPairs = ['1,2', '3,4', '5,6', '7,8'];

  var data = sourceSheet.getDataRange().getValues();
  var headers = data[0];
  var consolidatedData = [];

  // Helper to find column index by name
  var getHeaderIndex = function(name) { return headers.indexOf(name); };

  // 2. Setup Primary Anchor (The first selected pair, usually "1,2")
  const PRIMARY_PAIR = desiredPeriodPairs[0];
  const ANCHOR_KEY_COL = getHeaderIndex(`Key_${PRIMARY_PAIR}`);
  const ANCHOR_TEXT_COL = getHeaderIndex(`Text_${PRIMARY_PAIR}`);

  if (ANCHOR_KEY_COL === -1) {
    console.error(`Primary headers for ${PRIMARY_PAIR} not found.`);
    return;
  }

  // 3. Build Base Data (Key + Anchor Text)
  // Skip header row (start at 1)
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var text_anchor = String(row[ANCHOR_TEXT_COL]).trim();
    
    // Only include rows where this teacher actually has a class
    if (text_anchor !== "") {
      var key = String(row[ANCHOR_KEY_COL]).trim();
      consolidatedData.push([key, text_anchor]);
    }
  }

  destSheet.clearContents();
  
  // 4. Write Headers
  var finalHeaders = ['UniqueKey_DayCode', 'Period ' + PRIMARY_PAIR];
  // Add headers for any other selected pairs
  for (var i = 1; i < desiredPeriodPairs.length; i++) {
    finalHeaders.push('Period ' + desiredPeriodPairs[i]);
  }
  destSheet.getRange(1, 1, 1, finalHeaders.length).setValues([finalHeaders]);

  // 5. Write Anchor Data
  if (consolidatedData.length > 0) {
    destSheet.getRange(2, 1, consolidatedData.length, 2).setValues(consolidatedData);
  }

  // 6. Inject VLOOKUPs for Secondary Pairs
  // Based on AssignmentMaster structure: 
  // 1,2 is Cols F:G | 3,4 is H:I | 5,6 is J:K | 7,8 is L:M
  var formulaInjectionArray = [];
  const VLOOKUP_RANGES = [
    { pair: '3,4', range: '$H:$I' },
    { pair: '5,6', range: '$J:$K' },
    { pair: '7,8', range: '$L:$M' }
  ];

  // Loop through remaining pairs
  for (var i = 1; i < desiredPeriodPairs.length; i++) {
    var pair = desiredPeriodPairs[i];
    var target = VLOOKUP_RANGES.find(r => r.pair === pair);
    
    if (target) {
      // VLOOKUP(Key in Col A, Target Range, 2, FALSE)
      var formula = `=ARRAYFORMULA(IF(A2:A="", "", IFERROR(VLOOKUP(A2:A, AssignmentMaster!${target.range}, 2, FALSE), "")))`;
      formulaInjectionArray.push(formula);
    }
  }

  if (formulaInjectionArray.length > 0 && consolidatedData.length > 0) {
    destSheet.getRange(2, 3, 1, formulaInjectionArray.length).setFormulas([formulaInjectionArray]);
  }
  
  console.log("consolidateAssignmentData: Complete.");
}