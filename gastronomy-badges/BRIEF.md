# gastronomy-badges — Project Brief

Script ID: `1qkZ-MH1xo1r83K9EZiaOq1rgo4cvp7WW7_wkViFbqdZ3h2bsFSmoqn7v`
(the `MH1…` string without the `1qkZ-` prefix is a different ID and won't clone).

Pulls Gastronomy grades and "Etoilles" (star badge) points from Canvas into a roster
sheet. A script bound to a Google Sheet; menu **Canvas Tools**. Read-only: no Canvas
write calls, so no DRY_RUN setting is needed yet.

Brought into this repo 10/29 with `clasp clone`; the first commit (`86811ca`) is the
code exactly as it was in Google. It was written before CLAUDE.md, so it doesn't follow
all of the code standards yet (see Clean-up list).

## Menu

- **Update Etoilles** (`syncRosterGradesAndEtoilles`): run from a roster sheet.
  1. For each column C–F, reads the Canvas assignment ID in Row 2 and fills each
     student's score (or Canvas grade text) from Row 3 down. Student Canvas user IDs are
     in column B. Cells show `Not found`, `API Err: <code>`, or `Failed` on problems.
  2. Totals each student's points for every assignment in the Canvas group
     **Etoilles in Canvas** into column G (blank when the total is 0). The list of
     assignments comes from the `*assignmentGroups*` tab.
  3. Writes the time it finished into B1.
- **1. Set API Key and Base URL** (`setUserProperties`): prompts for the Canvas token.
- **2. Run FULL Data Refresh** (`runFullDataRefresh`): writes this sheet's ID into
  `*Config*`!B6, then rebuilds the `*peopleList*` and `*assignmentGroups*` tabs.
  Run it when assignments are added to the "Etoilles in Canvas" group.

## Sheet tabs

- `*Config*`: B2 Canvas base URL, B4 Course ID, B6 this sheet's ID (auto). B3, B5,
  D3, D5, B12 are read by `getConfig()` but not used by this project.
- `*assignmentGroups*`: every assignment with its group name (rebuilt by the refresh).
- `*peopleList*`: course roster (rebuilt by the refresh). Contains student names and
  emails, so it stays inside the sheet. Never export it into this folder.
- Roster sheet(s): layout above. Any tab name works; run from the active tab.

## Canvas endpoints (all GET)

- `/api/v1/courses/:id`
- `/api/v1/courses/:id/enrollments`
- `/api/v1/courses/:id/assignment_groups?include[]=assignments&include[]=all_dates`
- `/api/v1/courses/:id/assignments/:id/submissions` and `…/submissions/:user_id`

## Properties

- User Properties: `CANVAS_API_KEY` (the Canvas token).
- No Script Properties.

## Permissions (appsscript.json)

`spreadsheets.currentonly`, `script.container.ui`, `script.external_request`. Added
10/29; Lara re-authorized and **Update Etoilles** worked live the same day.

## Decisions

- **Logs hold only course/assignment IDs, HTTP codes, and counts** (fixed 10/29). Grade
  sync used to log each failing student's Canvas user ID, row, request URL, and Canvas's
  reply. The cell on the sheet still shows which student had a problem.
- **The spelling "Etoilles" is kept** because it matches the Canvas group name and
  existing sheet text. Changing it would mean renaming the Canvas group too.

## Clean-up list (not done; each one small, one at a time)

1. Rename the token property to `CANVAS_TOKEN` and read the base URL from User
   Properties (`CANVAS_BASE_URL`) instead of `*Config*`!B2 (CLAUDE.md rule 1 and Canvas
   API standard). Teachers would have to re-enter their token once, so it also needs a
   menu label check.
2. `setUserProperties` shows the first 4 characters of the token in its prompt and
   toast. Show only "set" / "not set".
3. One shared Canvas request helper with `Link`-header pagination and
   `X-Rate-Limit-Remaining` back-off. Today the enrollments call and the Etoilles
   submissions call each read only the first page (100), which is fine for one class.
4. Header comment on each file; `const`/`let` instead of `var`.
5. Grade sync makes one Canvas call per student per column (about 4 × class size). Fine
   for one class under the 6-minute limit; switch to one submissions call per column if
   it ever gets slow.
