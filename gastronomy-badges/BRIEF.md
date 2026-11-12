# gastronomy-badges — Project Brief

Script ID: `1qkZ-MH1xo1r83K9EZiaOq1rgo4cvp7WW7_wkViFbqdZ3h2bsFSmoqn7v`
(the `MH1…` string without the `1qkZ-` prefix is a different ID and won't clone).

> **Setup panel built 11/12 (Mac), not pushed yet.** **Canvas Tools › Setup…**
> (`SetupPanel.js`, `SetupPanelPage.html`, `Credentials.js`) replaces "1. Set API Key and
> Base URL", modelled on course-manager-jupiter's. Lara had re-saved her new token
> (11/12) under the old name; it moves over by itself. Next: Lara reviews, commit,
> `clasp push`, test in the sheet (see "Setup panel" below).

Pulls Gastronomy grades and "Etoilles" (star badge) points from Canvas into a roster
sheet. A script bound to a Google Sheet; menu **Canvas Tools**. Read-only: no Canvas
write calls, so no DRY_RUN setting is needed yet.

Brought into this repo 10/29 with `clasp clone`; the first commit (`86811ca`) is the
code exactly as it was in Google. It was written before CLAUDE.md, so it doesn't follow
all of the code standards yet (see Clean-up list).

**User guide (in the sheet since 11/8):** `UserGuide.html`, written for other teachers,
opened by **Canvas Tools › User guide** (`showUserGuide`) in the side panel on the right
(since 11/8, commit `396699a`; its "Open in a large window" link calls
`showUserGuideLarge`). It covers setup, the roster tab layout, Update Etoilles (including how to read
the pop-up), the data refresh, and messages. That file is the only master copy (Lara's
decision 11/8: keep docs self-contained, like calendar-filter). Update it in the same
commit as any change a teacher would see (CLAUDE.md rule). If the Clean-up list changes
the token menu (item 1), the guide's setup section changes too.
**Version label (11/10):** the guide shows "Version yyyy-mm-dd" under its title and section
"6. What's new and getting updates" (make a fresh copy, bring the roster tab over with
Copy to). Bump the version and add a What's new line in the same commit as any change a
teacher would see. There is no scrubbed template for this sheet yet, so a copy comes from
a working sheet.
History: first drafted 10/31 as `USER-GUIDE.md` (removed 11/8; still in Git history);
reviewed by Lara 11/1. The old Google Doc copy "Gastronomy Badges — User Guide", ID
`1cfWBB9xwD20B9ZMLBizmh295gKyKpm8dlNptelTZTRE`, in Drive folder TeacherTools
(`1TDwmuQh4buJ6VTMIpEFKqwE8rl5JU2zm`), gets a one-line note at push time pointing to
the menu item; it is no longer updated.

## Menu

- **Update Etoilles** (`syncRosterGradesAndEtoilles`): run from a roster sheet.
  1. For each column C–F, reads the Canvas assignment ID in Row 2 and fills each
     student's score (or Canvas grade text) from Row 3 down. Student Canvas user IDs are
     in column B. Cells show `Not found`, `API Err: <code>`, or `Failed` on problems.
  2. Totals each student's points for the assignments in the Canvas group
     **Etoilles in Canvas** that fall in the quarter typed in **G2** (`2` or `Q2`),
     into column G (blank when the total is 0). G2 is matched to the Canvas grading
     period whose title contains that number; Canvas decides which assignments are in
     it from their due dates. If nothing matches, the message lists Canvas's period
     titles. Fixed 10/29: it used to total the whole year. It adds every score in the
     group, including assignments marked "do not count towards the final grade".
  3. Shows a pop-up (click OK) with the quarter's dates and each assignment counted:
     title, due date, points possible, and a note if some students or sections have a
     different due date. No student data. Added 10/29 to find the column G issue; Lara
     kept it as a useful check.
  4. Writes the time it finished into B1.
- **Setup…** (`showSetupPanel`): the Setup side panel (below). Replaced **1. Set API Key
  and Base URL** (`setUserProperties`, removed 11/12).
- **Run FULL Data Refresh** (`runFullDataRefresh`; was "2. Run FULL Data Refresh (Master
  Setup)" until 11/12): writes this sheet's ID into
  `*Config*`!B6, then rebuilds the `*peopleList*` and `*assignmentGroups*` tabs.
  Update Etoilles no longer needs it: it asks Canvas for the Etoilles assignments
  directly.
- **User guide** (`showUserGuide`): opens `UserGuide.html` in a window over the sheet.

## Sheet tabs

- `*Config*`: B2 the school's Canvas address (since 11/12 only fills in a teacher's
  `CANVAS_BASE_URL` the first time; never hardcoded, public repo), B4 Course ID (the
  Setup panel can change it), B6 this sheet's ID (auto). B3, B5, D3, D5, B12 are read by
  `getConfig()` but not used by this project.
- `*assignmentGroups*`: every assignment with its group name (rebuilt by the refresh).
- `*peopleList*`: course roster (rebuilt by the refresh). Contains student names and
  emails, so it stays inside the sheet. Never export it into this folder.
- Roster sheet(s): layout above. Any tab name works; run from the active tab.

## Canvas endpoints (all GET)

- `/api/v1/users/self` (Setup panel: Test connection)
- `/api/v1/courses/:id` (refresh; Setup panel: course name)
- `/api/v1/courses/:id/enrollments`
- `/api/v1/courses/:id/assignment_groups?include[]=assignments&include[]=all_dates`
  (refresh) and `…?include[]=assignments&grading_period_id=:id` (Etoilles)
- `/api/v1/courses/:id/grading_periods`
- `/api/v1/courses/:id/assignments/:id/submissions` and `…/submissions/:user_id`

## Properties

- User Properties: `CANVAS_TOKEN`, `CANVAS_BASE_URL`, `CANVAS_TOKEN_SAVED` (when the
  token was saved, shown in the panel). Until 11/12 the token was `CANVAS_API_KEY`;
  `moveOldSetup_` (Credentials.js) moves it to `CANVAS_TOKEN` and deletes the old one the
  first time any tool or the panel runs for a teacher, and saves *Config* B2 as
  `CANVAS_BASE_URL` if none is saved (Lara's choice 11/12: nobody re-enters anything).
- No Script Properties (no DRY_RUN: no Canvas writes).

## Permissions (appsscript.json)

`spreadsheets.currentonly`, `script.container.ui`, `script.external_request`. Added
10/29; Lara re-authorized and **Update Etoilles** worked live the same day.

## Decisions

- **Logs hold only course/assignment IDs, HTTP codes, and counts** (fixed 10/29). Grade
  sync used to log each failing student's Canvas user ID, row, request URL, and Canvas's
  reply. The cell on the sheet still shows which student had a problem.
- **The spelling "Etoilles" is kept** because it matches the Canvas group name and
  existing sheet text. Changing it would mean renaming the Canvas group too.

## Solved (10/29): column G totals were too high

With G2 = `2`, column G came out 1–2 higher than Lara's numbers from Canvas's
Q2-filtered grade summary (her temporary column H), never lower. The pop-up (`7c95d55`)
showed the right Q2 badge assignments, all due in Q2 with no other due dates, plus
**"2A Culinary Transformations Instructions" (2 pts)**, which is in the Etoilles in
Canvas group. Lara thinks it is marked "do not count towards the final grade", so
Canvas's summary leaves it out while column G adds it. **Lara's decision: no code
change**; she knows why and can move 2A out of the group if she wants G to match.
If that comes up again, the fix would be to skip assignments with
`omit_from_final_grade` (already in the assignment data; no new calls).

## Setup panel (11/12)

**Canvas Tools › Setup…** opens a side panel (Lara chose 11/12: same as Jupiter's, minus
dry run and the setup check):
1. **Canvas connection:** address saved?, token saved (date saved, last 4), **Test
   connection** (GET /users/self).
2. **Set or change your token:** address box (filled from *Config* B2 if none saved) and
   password box, cleared on Save; blank keeps what's saved
   (`saveCanvasCredentialsFromPanel`); auto-tests after Save.
3. **Which course:** *Config* B4 in a box; Canvas's name and code fetched whenever the
   number changes (GET /courses/:id); **Save course** takes digits or a pasted
   `/courses/N` address, writes B4 as a number, refuses a formula cell; **Open Config**
   link (unhides, selects B4). Sheet write only, no Canvas write.

`canvasGetJson_` (SetupPanel.js) is the project's first shared request helper (auth
header, `muteHttpExceptions`, response-code check, error types); only the panel uses it
so far. The tools' "missing" messages now say to open Setup…. Offline check:
`scripts/checks/badges-setup-panel.check.js`. Guide: section 1, Config table, section 5
rows, section 6 steps and What's new; version **2026-11-12**.

## Clean-up list (not done; each one small, one at a time)

1. ~~Rename the token to `CANVAS_TOKEN`, base URL from User Properties~~ Done 11/12
   (Setup panel).
2. ~~First 4 characters of the token shown~~ Done 11/12: the prompt is gone; the panel
   shows the last 4 and the date saved, like Jupiter.
3. One shared Canvas request helper with `Link`-header pagination and
   `X-Rate-Limit-Remaining` back-off. Today the enrollments call and the Etoilles
   submissions call each read only the first page (100), which is fine for one class.
   Start from `canvasGetJson_` in SetupPanel.js (add `Link` pagination and rate-limit
   back-off there).
4. Header comment on each file; `const`/`let` instead of `var`.
5. Grade sync makes one Canvas call per student per column (about 4 × class size). Fine
   for one class under the 6-minute limit; switch to one submissions call per column if
   it ever gets slow.
