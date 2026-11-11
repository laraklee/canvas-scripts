/**
 * Periods.js
 * The bell schedule's kinds of events ("Period 1", "Lunch", ...) that a teacher can keep and
 * rename. Kept as plain data so the page (the .ics download) and the server (the calendar
 * sync) use exactly the same rules. Same rules as the colleague's original page.
 *
 * A category matches a title if the title is one of `titles` exactly, or (for `contains`)
 * if the lowercase title includes that word and is not one of `except`.
 * The first matching category wins, so order matters.
 *
 * Endpoints: none. Write calls: none. Properties: none.
 */

const PERIOD_CATEGORIES = [
  { id: 'p1', label: 'Period 1', titles: ['Period 1'] },
  { id: 'p2', label: 'Period 2', titles: ['Period 2'] },
  { id: 'p3', label: 'Period 3', titles: ['Period 3'] },
  { id: 'p4', label: 'Period 4', titles: ['Period 4'] },
  { id: 'p5', label: 'Period 5', titles: ['Period 5'] },
  { id: 'p6', label: 'Period 6', titles: ['Period 6'] },
  { id: 'p7', label: 'Period 7', titles: ['Period 7'] },
  { id: 'p8', label: 'Period 8', titles: ['Period 8'] },
  {
    id: 'homeroom_group',
    label: 'Homeroom / Homeroom Chapel',
    subtext: "Combines 'Homeroom' and 'Homeroom/Chapel' for advisors",
    titles: ['Homeroom', 'Homeroom/Chapel'],
  },
  {
    id: 'school_chapel',
    label: 'School Chapel Events',
    subtext: 'Chapel/Assembly, Christmas & Easter Chapels, etc.',
    contains: 'chapel',
    except: ['Homeroom/Chapel'],
  },
  { id: 'assembly', label: 'Assembly', subtext: 'Standalone assemblies', titles: ['Assembly'] },
  { id: 'break', label: 'Break', titles: ['Break'] },
  { id: 'meeting_lunch', label: 'Meeting/Lunch', titles: ['Meeting/Lunch'] },
  { id: 'meeting', label: 'Meeting', titles: ['Meeting'] },
  { id: 'lunch', label: 'Lunch', titles: ['Lunch'] },
];

/** Returns the first category matching a bell schedule title, or null. */
function periodCategoryFor_(title) {
  return PERIOD_CATEGORIES.find(function (cat) {
    if (cat.titles) return cat.titles.indexOf(title) !== -1;
    return cat.except.indexOf(title) === -1 && title.toLowerCase().indexOf(cat.contains) !== -1;
  }) || null;
}
