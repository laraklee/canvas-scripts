# Gastronomy Badges — User Guide

For teachers using the Gastronomy badges sheet (or a copy of it). It pulls scores and
**Etoilles** (star badge) points from Canvas into a roster tab, so you can see each
student's badges for the quarter without opening the Gradebook.

Everything here is on the **Canvas Tools** menu at the top of the sheet, next to Help.
If you don't see the menu, reload the page and wait a few seconds.

> **Does this change Canvas?** No. Every tool in this sheet only **reads** Canvas.
> Nothing you run here changes grades, assignments, or anything students see.

---

## 1. First-time setup

Do this once per sheet, per teacher.

### Your Canvas token

The sheet talks to Canvas using your own **access token**, a long password-like code
that Canvas makes for you. It is saved to **your Google account only**: other people
who can edit the sheet cannot see it, and it is never written on the sheet.

1. In Canvas, go to **Account › Settings**, scroll to **Approved Integrations**, and
   click **+ New Access Token**. Give it a purpose (for example "Gastronomy badges")
   and copy the token. Canvas only shows it once.
2. In the sheet: **Canvas Tools › 1. Set API Key and Base URL**.
3. The box shows the Canvas web address from *Config* B2 and whether a key is already
   saved. Paste the token and click **OK**. (Click **Cancel** to keep the saved one.)
4. A message in the bottom-right corner says **API Key Saved (Success)**.

Despite its name, this menu item only saves the token. The Canvas web address comes
from *Config* B2 (below).

If you ever think your token was exposed, delete it in Canvas (Account › Settings ›
Approved Integrations) and make a new one.

### Google's permission screen

The first time you use any Canvas Tools item, Google asks you to authorize the script.
It asks to:

- see and edit **this spreadsheet only** (not your other files);
- show menus and pop-up boxes in the sheet;
- connect to an external service (Canvas).

### The *Config* tab

| Cell | What goes there |
|---|---|
| **B2** | Your school's Canvas web address: the start of the address bar when you're logged in to Canvas (for example `https://yourschool.instructure.com`). |
| **B4** | Your Canvas **course ID**: the number after `/courses/` in the course's web address. Numbers only. |
| **B6** | Filled in for you by **2. Run FULL Data Refresh**. Don't type here. |

The other cells on *Config* (B3, B5, D3, D5) aren't used by this sheet, but the tab is
laid out the same way in all our Canvas workbooks, so fill them in if you have them.

### Your Canvas course

**Update Etoilles** looks for these in Canvas:

- An assignment group named exactly **Etoilles in Canvas**. Every assignment in it
  counts toward column G.
- **Grading periods** (quarters) whose names contain the quarter number, for example
  "Q1", "Quarter 2", or "2nd Quarter". Canvas puts each assignment in a quarter by its
  due date.

---

## 2. The roster tab

Use any tab name you like, except `*assignmentGroups*`, `*peopleList*`, and `*Config*`.
Run **Update Etoilles** while that tab is open.

| Cell or column | What it holds |
|---|---|
| **B1** | Filled in for you: the date and time Update Etoilles last finished. |
| **Row 2, C–F** | Up to four Canvas **assignment IDs**, one per column: the number after `/assignments/` in the assignment's web address. |
| **G2** | The **quarter** to total, for example `2` or `Q2`. |
| **Column B** (row 3 down) | Each student's Canvas **user ID**. |
| **C–F** (row 3 down) | Filled in for you: each student's score on the assignment in row 2. |
| **G** (row 3 down) | Filled in for you: each student's Etoilles points for the quarter in G2. |

Students go one per row, starting at row 3. Column A and columns after G are yours (for
example, student names).

**Where to find the IDs:** run **2. Run FULL Data Refresh** (section 4). The
`*peopleList*` tab then lists everyone in the course with their **User ID** (column D),
and the `*assignmentGroups*` tab lists every assignment with its **Assignment ID**
(column A) and group.

> **Leave blank rows blank.** A row with no user ID in column B is skipped and its
> cells are cleared. Don't sort or move students on the roster tab between runs unless
> you move their whole row, including column B.

---

## 3. Update Etoilles

**Canvas Tools › Update Etoilles**

Run it from your roster tab. It reads Canvas and fills in the tab in three steps.
Progress messages show in the bottom-right corner as it goes.

1. **Scores in C–F.** For each column, it reads the assignment ID in row 2 and fills in
   each student's score. If Canvas has a grade but no number score, the grade is shown
   instead. A student with no score gets a blank cell.
2. **Etoilles total in G.** It adds up each student's points on every assignment in
   the **Etoilles in Canvas** group that falls in the quarter in G2. A total of 0 is
   left blank.
3. **A pop-up** lists what column G counted: the quarter's start and end dates, then
   each assignment with its due date and points possible. If some students or
   sections have a different due date, it says so. Click **OK** to close it.

Then it writes the time into **B1** and says **Grades C:F and Etoilles totals in G are
synchronized.**

### Reading the pop-up

The pop-up is your check that column G counted the right badges. If G looks too high
or too low:

- **An assignment you didn't expect is listed.** Every assignment in the Etoilles in
  Canvas group counts, **including ones marked "Do not count this assignment towards
  the final grade"**. Canvas's own grade summary leaves those out, so column G will be
  higher. Move the assignment out of the group in Canvas if you don't want it counted.
- **An assignment is missing.** Check its due date in Canvas. Canvas decides the
  quarter from the due date, and an assignment with no due date usually lands in the
  last grading period of the course.
- **G adds points, not badges.** An Etoilles assignment worth 2 points adds 2.

### What you'll see in the cells

| In C–F | Meaning |
|---|---|
| A number or grade | The student's score in Canvas. |
| *(blank)* | No score yet, or no user ID in column B. |
| **Not found** | Canvas has no such student in that assignment. Check the user ID in column B and the assignment ID in row 2. |
| **API Err:** and a number | Canvas refused the request. See section 5. |
| **Failed** | The sheet couldn't reach Canvas for that student. Try again. |

---

## 4. 2. Run FULL Data Refresh

**Canvas Tools › 2. Run FULL Data Refresh (Master Setup)**

Rebuilds two reference tabs from Canvas. You don't need it to run Update Etoilles. Use
it when you need to look up IDs for the roster tab (for example, a new student or a new
assignment).

- **`*peopleList*`**: everyone in the course, with Section ID, User ID, name, role, and
  email. Sorted by last name, with a filter on the header row.
- **`*assignmentGroups*`**: every assignment, with its ID, name, group, due date, and a
  link to it in Canvas. Sorted by assignment name.

Both tabs are erased and rebuilt each time, so don't type in them. It also writes this
sheet's ID into *Config* B6. **Does not change Canvas.**

`*peopleList*` has students' names and emails. Keep it inside this sheet: don't copy it
into other files or share the sheet more widely than you need to.

---

## 5. When something goes wrong

| Message | What to do |
|---|---|
| *Base URL, API key, or Course ID is missing* | Check *Config* B2 and B4, then run **1. Set API Key and Base URL**. |
| *Select a roster sheet before running the sync* | You were on `*assignmentGroups*`. Click your roster tab and run it again. |
| *Assignment ID is missing from Row 2 of the active column* | One of C2–F2 is empty. Put an assignment ID in it. |
| *Type the quarter number (for example 2) in G2* | G2 is empty or has no number. |
| *No Canvas grading period matches quarter …* | The message lists Canvas's quarter names. Make sure one of them contains the number in G2. |
| *More than one Canvas grading period matches quarter …* | Two quarter names contain that number. Rename one in Canvas, or ask whoever manages your Canvas grading periods. |
| *This Canvas course has no grading periods* | Your course doesn't use quarters in Canvas. Column G can't be split by quarter. |
| *No Canvas assignment group named "Etoilles in Canvas"* | Create the group in Canvas (spelled exactly like that), or check the spelling of yours. |
| **API Err: 401** in the cells | Your token expired or was mistyped. Make a new one in Canvas and run **1. Set API Key and Base URL**. |
| **API Err: 403** in the cells | Your Canvas account can't see grades in that course. Check *Config* B4 is your course. |
| *Completed with Errors … could not be read* | Some Etoilles assignments couldn't be read, so G may be too low. Wait a minute and run it again. |
| No **Canvas Tools** menu | Reload the page; wait a few seconds. |

If something keeps going wrong, note what you clicked and what the message said, and
tell whoever shared the sheet with you.

---

<!-- Kept in Git as gastronomy-badges/USER-GUIDE.md; the shared Google Doc is a copy
made when changes are pushed. Update this file in the same commit as any change a
teacher would see (menu labels, columns, colors, messages). -->
