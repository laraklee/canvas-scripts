# Quiz Check workbook — BRIEF

A standalone Google Sheet that runs **Quiz Check** for teachers who don't use a Course
Manager workbook (Lara, 2026-11-24). Same check as `course-manager-jupiter/` (Course
Manager Tools › Check & back up course › Check a quiz before giving it), minus the Canvas
links on quiz names.

## Status

- **2026-11-24: built, not yet in Google.** Offline check
  `scripts/checks/quiz-check-workbook.check.js` passes (16).
- **2026-11-24 (PC): Google Sheet "Quiz Check" made, `.clasp.json` added, code pushed.**
  First test on a Biology sandbox export worked (overview tab: 2 quizzes, both red).
- **2026-11-24: BUILT, committed, not yet pushed to Google (Lara said go):** "Quiz Check ›
  Detail for selected quiz" and "Clear check results…". Hidden tab **Quiz Check data**
  (A1 label `Quiz Check data:`; row 2 piece and quiz counts; from row 4: quiz ID, quiz
  name, upload piece with a "p" in front so a piece starting with "=" isn't a formula).
  The menu item refuses if the selected row's name no longer matches the saved list
  (tab sorted or edited). Clear deletes only tabs whose A1 is our label; the workbook's
  last tab is emptied instead. After push: test both on the Biology export, then
  Clear before sharing (setup step 5).
  Original proposal: "Quiz Check › Detail
  for selected quiz". Problem (Lara): the detail needs the upload, which lives only in
  the panel, so closing the panel means re-running the check to see another quiz.
  Plan: at check time, also save the gzipped upload (base64, chunked under 50k chars per
  cell) plus the quiz IDs in overview-row order on a hidden tab; the menu item reads the
  selected row on the Quiz Check tab and writes that quiz's detail. Panel buttons stay.
  Add **Clear check results** too, so the original is cleared before sharing (else copies
  carry Lara's quiz text). Menu, not a checkbox column: an onEdit simple trigger has a
  30-second limit and two-boxes-ticked questions. Only entry points change, so the
  Jupiter drift check still passes; same feature for Jupiter later if Lara wants it.
  Same commit: guide's "Detailed report" section, offline checks for the new parts.

## How it works

- The teacher downloads a **course export** (.imscc: Settings › Export Course Content ›
  Course) and picks it in the side panel (**Quiz Check › Check quizzes…**). The panel
  reads it on their computer and sends only quiz, bank, and settings text plus file
  sizes (gzipped, ~1 MB for a 47-quiz course). Pictures never leave the computer.
- Writes the **Quiz Check** tab (one row per quiz: red / orange / plain) and, per click,
  the **Quiz Check detail** tab. Same layout, colors, and wording as Jupiter.
- **No Canvas calls at all**: no token, no Setup panel, no User or Script Properties.
  The course export carries everything the check needs, including published state of
  quizzes, files, and folders (found 11/9; that's why the live API report was retired).
- Scopes: `spreadsheets.currentonly` and `script.container.ui` only.
- Guide: in-sheet `UserGuide.html` (**Quiz Check › ❓ User guide**, side panel with an
  "Open in a large window" link). It is the only master copy; same-commit rule applies.

## Paired with course-manager-jupiter (keep in step)

The check's code is a **copy** of Jupiter's, not a shared library (simpler for teachers:
no library versions to pin). The offline check fails if they drift:

| This project | Jupiter | Rule |
|---|---|---|
| `QtiReader.js` | `QtiReader.js` | identical file |
| `QuizCheckUpload.html` `<script id="zip-slice-reader">` | same | identical block; the rest of the panel differs (no `url` sent) |
| `QuizReport.js` | `QuizReport.js` | trimmed: only picture helpers, cell text, `writeQuizReport_`; each function identical |
| `QuizCheck.js` below "kept identical" | `QuizCheck.js`, `QuizExportReport.js` | each function identical, except `quizExportFiles_`'s too-large message |
| `QuizCheck.js` entry points | `receiveCourseExport`, `receiveQuizCheckDetail` | differ on purpose: no Canvas links; plus the saved upload, Detail for selected quiz, and Clear (this workbook only so far) |

**When a quiz-check fix lands in Jupiter, copy it here in the same commit** (and the other
way round), then `npm run check-offline`.

## Setting it up (Lara)

1. In Google Drive, make a new Google Sheet named **Quiz Check** (in a folder you're
   happy to share a view link to). Rename its first tab **Start here** and put in A1:
   *Use the Quiz Check menu at the top (it appears a few seconds after opening). Start
   with ❓ User guide.*
2. **Extensions › Apps Script**, then **Project Settings** (gear) and copy the **Script ID**.
   Give it to Claude, who writes `quiz-check-workbook/.clasp.json` (the ID isn't secret).
3. Claude commits, then asks before `clasp push` from this folder.
4. Reload the sheet, run **Quiz Check › Check quizzes…** once, allow the two permissions,
   and test on a Biology course export (expect the same red/orange counts as Jupiter's
   Quiz Check on the same file).
5. Share: set the sheet to **anyone at school with the link can view**, and tell teachers
   to use **File › Make a copy** (the script comes with the copy). Or share the link as
   `.../copy` instead of `.../edit` so the link itself offers the copy.
6. Updates: teachers re-copy from the original (no self-updating code). Push changes to
   the original only.

## Decisions

- 2026-11-24 (Lara): standalone, export-only, no Canvas API ("Not needing the API code
  really does simplify things").
