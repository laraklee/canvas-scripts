# readonly-import-test — Brief

**Scratch test, not for teachers.** Delete this folder (and the two test sheets) once the
real tool is built.

- Old copy (`Read-only test – old`): script ID
  `1IZz-MoJEpd70ed54f1WXIM8evxKaG95pfqB1XhzVHSxpJyi6DZZiED3V`, sheet
  `1VAEwsLOY8ulgcozRUni7JamS67no_HqyQBouwrXcCkU`. The new copy (File › Make a copy) gets
  its own script ID; it does not need clasp unless the code changes after the copy.

## Why

Colleagues get updates by re-copying the template (decided 11/10). The next step is a
"Bring over tabs from my old copy" tool in the new copy (idea from 11/13). Lara would
rather it only **read** the old copy (11/13), so this test answers:

1. Can a script read another workbook with only the read-only permission
   (`spreadsheets.readonly`, through the Sheets API advanced service) and rebuild its tabs
   with only "this spreadsheet" permission (`spreadsheets.currentonly`)? How close is the
   rebuild?
2. Does the usual `SpreadsheetApp.openById` work with read-only, or does it need full
   edit access? (Expected: it needs full access. If it works, the real tool gets simpler.)
3. Does the Sheets advanced service work with the default Google Cloud project, or does
   it ask for a standard one?

## Setup (Lara)

1. In **My Drive** (not the shared folder), make a blank Google Sheet named
   `Read-only test – old`. Use no real student data anywhere in this test.
2. **Extensions › Apps Script › Project Settings (gear)**: copy the **Script ID** and give
   it to Claude. Claude writes `.clasp.json` and asks before `clasp push`.
3. Reload the sheet. Menu **Read-only test › 1. Build sample tabs**, and authorize. Google
   will ask for: see all your spreadsheets (read-only), this spreadsheet, and pop-ups.
4. **File › Make a copy**, named `Read-only test – new` (the copy brings the script).
5. In the new copy: **2. Remove sample tabs**, then **3. Bring tabs over**, and paste the
   link to the old copy. Then **4. Check** with the same link.
6. Compare the tabs side by side and tell Claude what differs.

If step 3 says the Sheets API is not enabled: in the new copy's Apps Script editor, open
**Services (+)**, add **Google Sheets API**, and try again.

## What to look at (step 6)

Formulas that point at other tabs, the named range, and the clone's `'Scores'!D3`
formula; dates and percents; `007`, `1/2`, `=not a formula`, `TRUE`, `12:30` staying as
text; the partial link in I2 and the red text in I4; dropdowns in B and L; checkboxes in
H; merged "Totals"; borders; hidden column E; frozen row 1; notes on A2 and D4;
conditional colors in A, F and G; tab colors; Settings without gridlines. Expected to be
missing: the chart (the report should count 2, one on each Scores tab).

## Results (2026-11-13)

- **Read-only rebuild works.** Sheets API `spreadsheets.get` with `spreadsheets.readonly`
  ran on the default Google Cloud project (no standard project, no Services toggle
  needed). Lara compared the tabs: "It looks fine." Charts did not come over, as expected.
- First run failed on Claude's bug (extra `)` in the field list, fixed in `c86d066`).
  Fixing it meant deleting the new copy and making it again: the copy keeps the code it
  was made with.
- Step 4 (`SpreadsheetApp.openById` with read-only): (answer pending)

## Lessons for the real tool

- **Matching tab names are normal, not an error.** The blank sheet's `Sheet1` was in both
  copies and stopped the import. The template and an old copy share tabs (Config, Q tabs),
  so the real tool needs a choice per matching tab: keep the template's tab and bring the
  teacher's data into it, bring it over as `Name (old)`, or skip.
- **Charts and pivot tables** (Lara, 11/13): warn the teacher which tabs had them, and
  include a short refresher on bringing them over by hand (rare, but it will happen).
  For example: copy the chart in the old copy and paste it in the new one, then fix its
  data range; or recreate the pivot table (Insert › Pivot table) with the same rows,
  columns and values. Also list protected ranges, filter views and alternating colors.
