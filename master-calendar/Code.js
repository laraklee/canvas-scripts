/**
 * Code.js — GET_SCHEDULE_JSON custom function (column I of each year tab).
 * Canvas endpoints called: none. Write operations: none (returns values to the sheet).
 * Required User/Script Properties: none.
 */

/**
 * Looks up start/end times for a list of periods based on a schedule name.
 * * Usage in Sheet: 
 * =GET_SCHEDULE_JSON(E2:E, F2:F, '*Schedule*'!A:D)
 *
 * @param {Array} scheduleNamesColumn The column in Active Sheet with Schedule Names (e.g. "Regular")
 * @param {Array} periodStringsColumn The column in Active Sheet with Period Lists (e.g. "1, 2, 3")
 * @param {Array} masterDataRange The full data range from *Schedule* sheet (Cols A:D)
 * @customfunction
 */
function GET_SCHEDULE_JSON(scheduleNamesColumn, periodStringsColumn, masterDataRange) {
  // 1. Safety Check: Ensure inputs are valid Ranges (Arrays)
  if (!Array.isArray(scheduleNamesColumn) || !Array.isArray(periodStringsColumn) || !Array.isArray(masterDataRange)) {
    return "Error: Inputs must be valid ranges (e.g. A2:A).";
  }

  // 2. Build the Lookup Map (The "Database")
  // We combine ScheduleName + PeriodName to create a unique key for instant lookup.
  // Example Key: "Regular_1" -> Value: {start: 815, end: 925}
  var scheduleMap = {};
  
  for (var i = 0; i < masterDataRange.length; i++) {
    var row = masterDataRange[i];
    // Map Columns from *Schedule* sheet: 
    // A=Schedule Name, B=Period Name, C=Start, D=End
    var sName = row[0];
    var pName = row[1];
    var start = row[2];
    var end = row[3];

    if (sName && (pName !== "")) { // Ensure we have a schedule and a period identifier
      var key = String(sName) + "_" + String(pName);
      scheduleMap[key] = { start: start, end: end };
    }
  }

  // 3. Process the User's Request (The Active Sheet Rows)
  // We map over the requested rows to build the output column
  return scheduleNamesColumn.map(function(row, index) {
    var targetSchedule = row[0];
    
    // Safety: Check if periodStringsColumn has a value for this row
    // We convert to String to handle cases where the cell might just be the number 1
    var targetPeriodsString = (periodStringsColumn[index] && periodStringsColumn[index][0] !== "") 
                              ? String(periodStringsColumn[index][0]) 
                              : "";

    // Skip blank rows to keep the sheet clean
    if (!targetSchedule || targetPeriodsString === "") {
      return [null];
    }

    // Split the "1, 2, M/L" string into an array: ["1", "2", "M/L"]
    // .split(',') breaks it by comma
    // .map(trim) removes accidental spaces like " 2"
    var periodList = targetPeriodsString.split(',').map(function(s) { return s.trim(); });

    var resultJSON = [];

    // 4. Look up each period in the list
    for (var p = 0; p < periodList.length; p++) {
      var periodName = periodList[p];
      
      // Construct the key exactly how we built it in Step 2
      var lookupKey = String(targetSchedule) + "_" + String(periodName);
      var timeData = scheduleMap[lookupKey];

      // If we find a match in the database, add it to our list
      if (timeData) {
        resultJSON.push({
          "period": periodName, 
          "start": timeData.start,
          "end": timeData.end
        });
      }
    }

    // 5. Return the JSON string for this row
    // We wrap it in brackets [ ... ] because .map expects a 2D array output
    return [JSON.stringify(resultJSON)];
  });
}