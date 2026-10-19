/**
 * Assignments.js
 * Purpose: one set of tabs per assignment. Each Canvas assignment ID has a short name
 *   (from its Index row, for example "Lab 3 Density"), and its tabs are named from it:
 *   "Lab 3 Density Key", "... Flagged", "... AI", "... Review". The last name used for
 *   each ID is saved in this spreadsheet's Document Properties, so that changing a short
 *   name on the Index renames that assignment's existing tabs. Holds no student data.
 * Canvas endpoints called: none.
 * Canvas write operations: none.
 * Required User/Script Properties: writes Document Properties ASSIGNMENT_NAME_<id>.
 */

const PROP_ASSIGNMENT_PREFIX = 'ASSIGNMENT_NAME_';
const TAB_KINDS = ['Key', 'Flagged', 'AI', 'Review'];
const MAX_SHORT_NAME_LENGTH = 40;

/** "Lab 3 Density" + "Review" → "Lab 3 Density Review" */
function tabName_(shortName, kind) {
  return shortName + ' ' + kind;
}

function getAssignmentName_(assignmentId) {
  return PropertiesService.getDocumentProperties()
    .getProperty(PROP_ASSIGNMENT_PREFIX + assignmentId);
}

/** Every saved assignment as {id, name}. */
function listAssignments_() {
  const props = PropertiesService.getDocumentProperties().getProperties();
  return Object.entries(props)
    .filter(([key]) => key.startsWith(PROP_ASSIGNMENT_PREFIX))
    .map(([key, name]) => ({ id: key.slice(PROP_ASSIGNMENT_PREFIX.length), name }));
}

/** Trims, drops characters that cause trouble in tab names, and shortens. */
function cleanShortName_(text) {
  return String(text).replace(/[[\]*?/\\:'"]/g, '').replace(/\s+/g, ' ').trim()
    .slice(0, MAX_SHORT_NAME_LENGTH).trim();
}

/**
 * Makes this short name the assignment's name: refuses one already used by another
 * assignment, renames the assignment's existing tabs if its name changed, and saves it.
 * Returns true if it's ready to use, false (after telling Lara why) if not.
 */
function applyAssignmentName_(ui, assignmentId, shortName) {
  const inUse = listAssignments_().find((a) => a.name === shortName && a.id !== assignmentId);
  if (inUse) {
    ui.alert('"' + shortName + '" is already the short name for assignment ' + inUse.id +
      '. Give this row a different short name.');
    return false;
  }
  const saved = getAssignmentName_(assignmentId);
  if (saved && saved !== shortName) renameAssignmentTabs_(saved, shortName);
  PropertiesService.getDocumentProperties()
    .setProperty(PROP_ASSIGNMENT_PREFIX + assignmentId, shortName);
  return true;
}

function renameAssignmentTabs_(oldName, newName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  for (const kind of TAB_KINDS) {
    const sheet = ss.getSheetByName(tabName_(oldName, kind));
    if (sheet && !ss.getSheetByName(tabName_(newName, kind))) {
      sheet.setName(tabName_(newName, kind));
    }
  }
}
