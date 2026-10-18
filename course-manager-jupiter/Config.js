/**
 * Config.js
 * Purpose: sheet names and read access to the cfg_ named ranges on ref_Config.
 * Canvas endpoints called: none.
 * Canvas write operations: none.
 * Required User/Script Properties: none yet.
 */

/** Every reference sheet name from BRIEF.md. Refer to sheets only through this. */
const SHEETS = Object.freeze({
  CONFIG: 'ref_Config',
  SIMPLE_SCHEDULE: 'ref_simpleSchedule',
  SECTION_LOOKUP: 'ref_SectionLookup',
  PEOPLE_LIST: 'ref_peopleList',
  ASSIGNMENT_GROUPS: 'ref_assignmentGroups',
  GRADING_PERIODS: 'ref_gradingPeriods',
  GRADING_SCALE: 'ref_gradingScale',
  INDEX: 'ref_Index',
  COURSE_IDS: 'ref_CourseIDs',
});

/** User-facing tool sheets built by this project. Names are exact; never rename them. */
const TOOL_SHEETS = Object.freeze({
  ASSIGNMENT_ORDER: 'Assignment Order',
  CREATE_GROUPS: 'createGroups',
  CREATE_BY_ROW: 'createByRow',
});

/** Sheets built so far. Add each one here as it is created. */
const SHEETS_BUILT = Object.freeze([
  SHEETS.CONFIG,
  SHEETS.COURSE_IDS,
  SHEETS.PEOPLE_LIST,
  SHEETS.SIMPLE_SCHEDULE,
  SHEETS.GRADING_SCALE,
  SHEETS.ASSIGNMENT_GROUPS,
  SHEETS.SECTION_LOOKUP,
  SHEETS.INDEX,
]);

/** Reference (system) sheets are the ones named with this prefix. */
const SYSTEM_SHEET_PREFIX = 'ref_';

/** True for reference sheets (ref_…). Replaces the legacy "name starts with *" check. */
function isSystemSheet_(name) {
  return String(name).startsWith(SYSTEM_SHEET_PREFIX);
}

const CFG_PREFIX = 'cfg_';

/** The twelve Config named ranges, exactly as in the Named ranges panel. */
const CFG_NAMES = Object.freeze([
  'cfg_UserID',
  'cfg_CourseID',
  'cfg_CcEmail',
  'cfg_ThisSheetID',
  'cfg_MasterCalendarDocID',
  'cfg_SchoolYearTab',
  'cfg_TimeSchoolStart',
  'cfg_TimeSchoolEnd',
  'cfg_TimeAfterSchool',
  'cfg_TimeNight',
  'cfg_JupiterCategories',
  'cfg_CourseName',
]);

/**
 * Returns the value of a single-cell Config named range.
 * getCfg_('CourseID') reads the range named cfg_CourseID.
 * Throws a clear error (name only, never the value) if it is missing or empty.
 */
function getCfg_(name) {
  const fullName = CFG_PREFIX + name;
  const range = SpreadsheetApp.getActiveSpreadsheet().getRangeByName(fullName);
  if (!range) {
    throw new Error(`Named range "${fullName}" is missing. Add it in Data > Named ranges.`);
  }
  const value = range.getValue();
  if (value === '' || value === null) {
    throw new Error(`Named range "${fullName}" is empty. Fill it in on ${SHEETS.CONFIG}.`);
  }
  return value;
}
