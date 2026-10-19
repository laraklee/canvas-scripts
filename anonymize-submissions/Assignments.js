/**
 * Assignments.js
 * Purpose: one set of tabs per assignment. Each Canvas assignment ID gets a short name
 *   that Lara types once (for example "Lab 3 Density"), and its tabs are named from it:
 *   "Lab 3 Density Key", "... Flagged", "... AI", "... Review". The ID-to-name list is
 *   saved in this spreadsheet's Document Properties (not secret; holds no student data).
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

/** Every saved assignment as {id, name}, sorted by name. */
function listAssignments_() {
  const props = PropertiesService.getDocumentProperties().getProperties();
  return Object.entries(props)
    .filter(([key]) => key.startsWith(PROP_ASSIGNMENT_PREFIX))
    .map(([key, name]) => ({ id: key.slice(PROP_ASSIGNMENT_PREFIX.length), name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Trims, drops characters that cause trouble in tab names, and shortens. */
function cleanShortName_(text) {
  return String(text).replace(/[[\]*?/\\:'"]/g, '').replace(/\s+/g, ' ').trim()
    .slice(0, MAX_SHORT_NAME_LENGTH).trim();
}

/**
 * Asks for this assignment's short name, offering the saved one. If Lara types a new
 * name, renames the assignment's existing tabs to match. Returns the name, or null if
 * cancelled or invalid (after telling her why).
 */
function promptAssignmentName_(ui, title, assignmentId) {
  const saved = getAssignmentName_(assignmentId);
  const text = promptText_(ui, title,
    'Short name for this assignment, used to name its tabs (for example "Lab 3 Density").' +
    (saved ? '\n\nCurrently: ' + saved + '\nLeave blank to keep it.' : ''));
  if (text === null) return null;
  const shortName = cleanShortName_(text) || saved;
  if (!shortName) {
    ui.alert('A short name is needed to name this assignment\'s tabs.');
    return null;
  }
  const inUse = listAssignments_().find((a) => a.name === shortName && a.id !== assignmentId);
  if (inUse) {
    ui.alert('"' + shortName + '" is already used for assignment ' + inUse.id +
      '. Pick a different short name.');
    return null;
  }
  if (saved && saved !== shortName) renameAssignmentTabs_(saved, shortName);
  PropertiesService.getDocumentProperties()
    .setProperty(PROP_ASSIGNMENT_PREFIX + assignmentId, shortName);
  return shortName;
}

function renameAssignmentTabs_(oldName, newName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  for (const kind of TAB_KINDS) {
    const sheet = ss.getSheetByName(tabName_(oldName, kind));
    if (sheet) sheet.setName(tabName_(newName, kind));
  }
}

/**
 * Asks which saved assignment to work on, listing them by ID and name.
 * Returns {id, name}, or null if cancelled or unknown (after telling her why).
 */
function promptSavedAssignment_(ui, title) {
  const assignments = listAssignments_();
  if (assignments.length === 0) {
    ui.alert('No assignments yet. Run "Anonymize submissions…" first.');
    return null;
  }
  const text = promptText_(ui, title,
    'Enter the Canvas assignment ID.\n\n' +
    assignments.map((a) => a.id + '  ' + a.name).join('\n'));
  if (text === null) return null;
  const found = assignments.find((a) => a.id === text.trim());
  if (!found) ui.alert('Assignment ' + text.trim() + ' has not been anonymized in this spreadsheet.');
  return found || null;
}
