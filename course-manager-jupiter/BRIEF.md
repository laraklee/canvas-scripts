# course-manager-jupiter — Project Brief

> **Where we left off (current state, 2026-11-12, Mac)**
>
> - **UI simplification plan (11/12, Lara).** Many teachers are intimidated by
>   spreadsheets. Decided: (1) **dry run is called "preview mode"** everywhere a teacher
>   sees it (`DRY_RUN`, `isDryRun_` and the safe default unchanged); the create/reorder
>   tools' **Preview** items became **Check** so "preview" has one meaning. (2) **One
>   menu, "Course Manager Tools"**, grouped by teacher task, plain labels (function names
>   unchanged so Home buttons work). (3) Later: a **Course Manager Tools side panel**
>   (task cards: what to fill in, Open the tab, the tool buttons; preview-mode banner;
>   links to Setup/Refresh/Guide with Back links). **Not** opened automatically (no
>   trigger: Lara wants it simpler) and **not tab-aware** (dropped: tabs get cloned and
>   renamed routinely). (4) Then a simpler Home tab (Lara, in the Sheet); maybe "My
>   tools" later. Open from 11/12: drop the menu items Setup… covers? Same "preview mode"
>   wording in the other three Setup panels later?
>   **Phase 1 (ed6e57e) live in all four workbooks 11/12:** Biology 1:54 PM (Lara: Setup
>   panel "looks fine" after a reload; the first try was the old panel), then AI9,
>   Gastronomy, template 2:15 PM (Lara: "push to the other 3"; no manifest change).
>   **Phase 2a (95f2863) live in all four workbooks 11/12:** Biology 2:33 PM (Lara: "looks
>   good"; not every Home button tried), then AI9, Gastronomy, template 2:37 PM.
>   **Phase 2b step 1 (create tools; 9f7c31f) live in all four 11/12:** Biology 2:39 PM
>   (Lara: "Works"), then AI9, Gastronomy, template 2:41 PM.
>   **Phase 2b step 2 (grading; 9f6a348) live in all four 11/12:** Biology 2:45 PM (Lara:
>   "Works"), then AI9, Gastronomy, template 2:47 PM. Next 2b steps: groups, reorder,
>   check & back up, classroom.
>   **Phase 2b step 3 (groups; e74e09e) live in all four 11/12:** Biology 2:50 PM (Lara:
>   "Works"), then AI9, Gastronomy, template 2:53 PM. Next 2b steps: reorder, check &
>   back up, classroom. Step 3 details: titles Make a group set,
>   Make the groups, Clear group info, Get groups into this column, Put students in groups
>   from this column, List groups and members on this tab; next-step pointers use the same
>   names. Sheet wording ("group category" in C2 etc.) unchanged. Guide 2026-11-12e. titles Build class list
>   (`ROSTER_TITLE`), Get latest grades for Jupiter (`GRADES_TITLE`), Get scores into this
>   column, Send comments from this column; messages name the buttons in parentheses
>   ("Build class list (CreateRoster)"). Refresh Jupiter categories title unchanged (panel/
>   ref_Config button name). Guide 2026-11-12d.
>   Step 1 details: pop-up titles =
>   menu labels: Send selected rows to Canvas, Check this tab, Send this tab to Canvas
>   (`MAKE_ALL_TITLE`), Set up due-time choices, Start over; label-check pointers say
>   Course Manager Tools › Advanced ›. Status words kept ("Posted", "Not posted"; button
>   names makeAll etc. stay in the guide). Guide 2026-11-12c. Next 2b steps: grading
>   (Jupiter, scores/comments), groups, reorder, check & back up, classroom.
>   Phase 2a details: one menu `MENU_NAME` = "Course
>   Manager Tools" (Menus.js; labels and groups as agreed 11/12). Dropped (Lara: "drop
>   them"): Set Canvas token, Test Canvas connection, Preview mode show/switch, Check
>   setup (functions kept). Advanced: Refresh all tables + two label checks. Messages'
>   "Setup & Data ›" paths now "Course Manager Tools ›". Guide 2026-11-12b. **Phase 2b
>   next:** pop-up titles/messages still use old tool names (~146 lines), one tool at a
>   time; also old menu paths in code comments. Preview-mode wording in the other three
>   projects' Setup panels: later, separate step.
>   Phase 1 details: wording in PostRows, MakeAssignment,
>   Groups, AssignmentColumn, ReorderTool, CanvasApi (log prefix now "PREVIEW MODE:"),
>   Setup panel part 4, menu labels (Check …, Preview mode: …); new on-open message
>   (`showPreviewModeToast_`, bottom right; no trigger needed). Guide version 2026-11-12.
>   Old "Dry run"/"Preview" Status cells in sheets are harmless (nothing reads them).
>   Lara may want to retype drawn buttons that say "Preview".
> - **Refresh tables panel built 11/11 (PC), not yet pushed.** Lara: a friendlier way to
>   refresh. **Setup & Data › Refresh tables…** opens a side panel (`RefreshPanel.js`,
>   `RefreshPanelPage.html`): a checkbox per table, **All** (the five Refresh-all tables;
>   never Jupiter categories, which sits apart at the bottom), and **Update**, which runs
>   one server call per table and shows ✓/✗ with counts next to each. Read-only. The
>   table list (`refreshTableList_`) is now shared with Refresh all tables; Jupiter's
>   refresh was split into `writeJupiterCategories_` (returns counts) so the panel can
>   run it. Old menu items stay. Guide: section 3, setup step, What's new; version
>   2026-11-11. Offline check: menus 13 pass. (Considered first and dropped 11/11: a
>   Groups panel. Lara builds group names with formulas on the createGroups tab, which a
>   panel would bypass.) **Pushed to Biology 11/11 (5d19500); Lara: "basically worked".**
>   **Round 2 (11/11, Lara):** (1) **Course check** is its own row and **in All** (Lara
>   chose); the assignment groups step no longer runs it. Refresh all tables runs it last
>   on the same download (`shared.canvasGroups`, fetched once); on its own in the panel it
>   downloads the assignments itself (so ticking both fetches twice; fine). Menu Refresh
>   assignment groups still updates Course Check as before. (2) Each **name is a link**
>   (`showRefreshTableTab`): unhides and opens the tab; Jupiter selects
>   cfg_JupiterCategories on ref_Config; missing tab → message in the panel.
>   **Pushed to Biology 11/11 8:15 PM (4e60c07); Lara: "basically like that".** Kept
>   Jupiter categories out of All (Lara agreed 11/11: a refresh brings new Canvas groups
>   in unticked, so a silent refresh could stop grades going to Jupiter).
>   **Round 3 (11/11, Lara):** the six one-table refresh items left the Setup & Data menu
>   (panel covers them); menu is now Refresh tables…, Refresh all tables, Setup &
>   safety. Functions kept (Home "Refresh sheet index" and ref_Config "Refresh Jupiter
>   categories" buttons). Messages that said "Run Refresh people list" etc. now point to
>   the panel. **Live in all four workbooks 11/11 (37499d0):** Biology 8:22 PM, then AI9,
>   Gastronomy, template 8:24 PM (Lara: "push to the other 3"; no manifest change). A
>   read-only `clasp clone` of each matched Git exactly (29 files).
> - **Setup panel built 11/11 (PC); live everywhere 11/11 (see end of this item).** **Setup & Data ›
>   Setup…** (`SetupPanel.js`, `SetupPanelPage.html`): (1) address saved?, token saved?
>   (never the token), Test connection; (2) address + token boxes (password field,
>   cleared on Save; blank keeps what's saved) → `saveCanvasCredentialsFromPanel` in
>   Credentials.js, then auto-tests; (3) cfg_CourseID (+ cfg_CourseName) and **Check
>   course** (new read-only GET /courses/:id; shows Canvas's name and code); (4) dry run
>   ON/OFF with an in-panel "are you sure" before OFF; (5) setup check on open
>   (`findSetupProblems_`). Decided (Claude proposed, Lara OK'd): token typed in the
>   panel; Setup & safety submenu kept for now (label checks stay menu-only). Messages
>   that said "Set Canvas token" now point to Setup…. Guide: first-time setup, safety
>   rules, troubleshooting, update steps, What's new; version **2026-11-11b**.
>   **Pushed to Biology 11/11 8:39 PM (351458c); Lara: "Almost."** Round 2 (Lara): part 3
>   gets an **Open ref_Config** link (`openSetupConfig`: unhides, selects cfg_CourseID)
>   and **Change course** box + **Save course** (`saveSetupCourseId`: digits or a pasted
>   `/courses/N` address; writes cfg_CourseID B4 as a number; refuses a formula cell;
>   message gives the old number; asks first in the panel when dry run is OFF; then
>   auto-runs Check course). cfg_CourseName (C4 formula over ref_CourseIDs) follows by
>   itself; a `#N/A` name is hidden. Sheet write only, no Canvas write.
>   **Pushed to Biology 11/11 8:47 PM (7bfbc63).** Round 3 (Lara): default Canvas
>   address. Not hardcoded (code standards, check-standards.js, public repo): Lara chose
>   **ref_Config B2**, the legacy base-URL cell (still there, unused). Read only
>   (`readDefaultBaseUrl_`, normalized; bad or blank → ignored); fills the address box
>   when nothing is saved (part 1 says so); tools still use the teacher's saved
>   `CANVAS_BASE_URL`. Address box now shows the saved address (not blank) and keeps it
>   after Save. Guide: B2 row in the ref_Config table. **Check B2 holds the address in
>   each workbook and the template.** Pushed to Biology 8:57 PM (ee18668).
>   Round 4 (Lara: part 3 "kind of clunky"): one **Canvas course number** box filled in
>   from B4 with a line telling the teacher to change it if needed, then **Save course**
>   and the Open ref_Config link. The Check course button and the separate "works in"
>   line are gone: Canvas's name for the course is fetched by itself when the panel
>   opens (once credentials are saved) and after each save, and shown under the box.
>   Committed d00d151. Round 5 (Lara, before pushing): part 1 shows **"Token: saved
>   11/11/2026 · ends in …x7Qa"** so a teacher can tell which Canvas token is saved. Last
>   4, not first (the part before `~` is the school's Canvas, the same for everyone); only
>   for tokens of 20+ characters; each teacher sees only their own (User Properties).
>   New User Property `CANVAS_TOKEN_SAVED` (ISO time, written by both save paths via
>   `saveToken_`); tokens saved before 11/11 show the hint with no date until re-saved.
>   "Never shown" comments now say "except its last 4 characters, to its owner".
>   **Live in all four workbooks 11/11 (692eba5):** Biology 9:07 PM (Lara: "Works"),
>   then AI9, Gastronomy, template 9:10 PM (no manifest change). A read-only `clasp
>   clone` of each matched Git exactly (31 files). **Still to do:** Lara checks
>   ref_Config B2 holds the school's Canvas address in the template (and the others);
>   decide whether to trim the Setup & safety submenu now that the panel covers it.
>   **Next:** commit, push Biology, Lara tests, then the others; then decide whether to
>   trim Setup & safety.
> - **Step 4 done 11/9 (PC): Quiz Check live in all four workbooks.** Lara tested 3b in
>   Biology ("looks fine so far"); guide's "Being built" removed; pushed AI9, Gastronomy,
>   then template (no manifest change). Live Quiz report and export-file report stay off
>   the menu (Lara asked; Quiz Check covers everything they did; deleting them is an
>   option for later). File availability dates are read but untested on real data.
> - **Quiz links pushed to Biology and tested 11/9 (PC; Lara: "They're good").**
> - **Step 3b built 11/9 (PC), not yet pushed.** Decided (Lara): Quiz Check opens in the
>   **side panel** (showSidebar), not a modal, so the sheet stays usable; detailed reports
>   go on **one shared "Quiz Check detail" tab** (A1 "Quiz Check detail:", B1 file name),
>   replaced each click. After the check the panel lists the quizzes (tab order and
>   colors, short kinds under each name); a click resends the same gzip with the quiz id
>   to `receiveQuizCheckDetail`, which writes the Quiz report layout (`writeQuizReport_`,
>   now returns its header row) and turns suggestion-only rows orange
>   (`quizCheckOrangeRows_`); the quiz name (B3) links to Canvas when the check linked it
>   (https only). Window message no longer says detailed reports are being built. Guide
>   updated (side panel; "Detailed report for one quiz"; still "Being built"). Offline
>   check 49 pass. **Next:** push Biology, Lara tests on the 11/9 export (try Lab 2.1 for
>   orange + red rows, Raw Score Unit 2 for many reds, a fine one, both Unit 1 Test copies),
>   then step 4 (drop "Being built", push AI9, Gastronomy, template).
> - **Quiz links built 11/9 evening (PC), after 3a; not yet pushed.** Lara: quiz names in
>   column A should link to Canvas for fixing, using the assignment list, refreshed
>   automatically at the start. How: when the export's course (context.xml) matches
>   cfg_CourseID, `writeAssignmentGroupsSheet_` refreshes ref_assignmentGroups (read-only;
>   Course check not run), then each listed assignment's export identifier is worked out
>   and matched: **"g" + MD5("assignment_" + global id)**, global id = the root account
>   number's digits above the last 13 (15750 here) + the assignment number padded to 13
>   digits. A Classic quiz's meta names its assignment (`<assignment identifier>`); a New
>   Quiz's own identifier is its assignment's. (Classic quiz ids work the same way with
>   "quizzes:quiz_", not used.) **Checked on Lara's 11/9 Biology export: 45 of 47 link**;
>   the 2 not linked are ungraded practice quizzes (Unit 3.2, Unit 4: not assignments).
>   Refresh fails → the list as it was is used and the window says so; other course or
>   no cfg_CourseID → no links, window says why; single-quiz exports never link.
>   Rich-text links in column A (https only). `readAssignmentGroups_` now also returns
>   `url` (Canvas URL column, optional). Offline check 39 pass, using two real pairs.
>   Note (11/9): while checking this, a scratch script printed one New Quiz's settings
>   including its access code in the chat ("Raw Score Unit 2 Test 25.26", closed since
>   10/7); Lara told at commit time and decides whether to change that code. Scratch
>   scripts now print titles and counts only. **Left:** `git push` so the Mac has this.
> - **Step 3a built 11/9 (PC), pushed to Biology 11/9 5:44 PM (9c28ea5); Lara: "looks good
>   as far as it goes."** The check writes a
>   **"Quiz Check" tab** (A1 "Quiz Check:", B1 file name, Checked, a count line; header row
>   4; columns Quiz, Published, Points, Points found, Questions, Pictures, Rows to look at,
>   What to look at). One row per quiz, all of them; red (problem) first, then orange
>   (only "worth shrinking"), then fine, A–Z with numbers in order. "What to look at" uses
>   short names (QUIZ_CHECK_KINDS, e.g. "picture from another course (3)"; a points
>   mismatch reads "points add up to 9, not 5"). The tab is rewritten each run; a "Quiz
>   Check" tab whose A1 says something else is left alone (teacher asked to rename it).
>   Menu item and window title are now **"Quiz Check"**; guide note updated (still
>   "Being built"). Offline check: 30 pass. **Next: Lara tests 3a in Biology, then 3b**
>   (window keeps the packed text and a quiz list; a click resends it with the quiz id
>   and writes that quiz's detailed report; orange rows there too).
> - **Both quiz reports are off the menu (commit b4a5916, live in all four workbooks,
>   11/9).** Lara: teachers shouldn't have to guess what a report misses. Quiz report
>   (live) can't see banks or New Quizzes; a single-quiz export hid Unit 2's other-course
>   pictures. Code stays (one menu line brings either back; neither runs from the
>   editor). Guide: their sections removed, short "Quiz checks" note (`#quizcheck`) says
>   a course-export check is coming. **No quiz check on the menu until that's built.**
> - **11/9 export (`~/code/course-exports/`, outside the repo; Mac Downloads is blocked to
>   Claude, so Lara drags exports there):** Unit 2 still has 23 course-4230 pictures (16
>   files, 12 of 21 banks). Course exports **do** carry published state: quizzes
>   (`assessment_meta.xml` `workflow_state`) and files/folders (`course_settings/
>   files_meta.xml`: `hidden` = link only, `locked` = unpublished; files keyed by
>   identifier → `imsmanifest.xml` href). File availability dates: none in the course,
>   so unconfirmed. Prototype: existing `qtiReadExport_` reads all 47 quizzes / all banks
>   once `non_cc_assessments/<id>.xml.qti` is passed as `<id>/<id>.xml`; 17 quizzes have
>   flags (9 "worth shrinking", 5 picture not in export, 4 outside site, 3 shrink it,
>   3 other-course: 3483 ×2 and 4230, 1 blank choice, 1 pick > size; points differ on
>   Bonus AI Feedback 9 vs 5 and Grade Check 11/09 1 vs 0). Needed text ≈ 6.7 MB.
> - **Step 1 done (069d95f), step 2 built 11/9 (window + receiveCourseExport, summary in the
>   window only; menu item "Quiz check (course export)", guide note "Being built").** Window
>   reads the .imscc by File.slice (59 ms, ~110 MB memory in Node on the 573 MB export),
>   sends gzip+base64: **0.79 M chars** for 6.7 M chars of text. **Correction to the counts
>   below: 15 quizzes to look at, not 17.** The trial (and step 1's /quiz-check) listed files
>   with Mac `unzip`, which garbles the narrow no-break space in screenshot names
>   ("8.01.24 AM"), so 79 pictures looked missing. Corrected kinds (quizzes): 10 worth
>   shrinking, 4 shrink it, 3 outside site, 1 not in export (Unit 2, FRQ 1 Plant), other
>   course: Unit 2 (4230) and both Unit 1 Test copies (3483), 1 blank choice, 1 pick > size,
>   2 points mismatches. /quiz-check now uses the window's reader (one reader for both).
>   **Tested in Biology 11/9 (Mac, Chrome):** works end to end, "47 quiz(zes)… 15 have
>   something to look at, 32 look fine" (matches the Mac). Not yet tried: Safari/iPad.
>   Step 2 is in Biology only; AI9, Gastronomy, template wait for step 4.
> - **NEXT: build "Quiz check from course export", plan agreed 11/9.** Step 1 reader:
>   course-export layout, quiz published state, unpublished file/folder flag, plainer
>   other-course message ("students in this course can't see it"), offline check,
>   /quiz-check reads .imscc. Step 2 window: accept .imscc, File.slice (TOC + quiz/bank
>   files only, not the whole 573 MB in memory); test google.script.run with ~6.7 MB,
>   send in pieces if it fails. Step 3: overview tab (one row per quiz, red if anything)
>   + window stays open with a quiz list for the detailed report. Step 4: menu item +
>   guide section, Biology first. **Decided 11/9 (Lara):** rows are red for problems,
>   **orange for suggestions** (so far only "worth shrinking", 500 KB–1 MB; "shrink it"
>   1 MB+ stays red), plain if fine; the overview lists **all** quizzes with a Published
>   column; menu name **"Quiz Check"** (rename the menu item in step 3 or 4, and the
>   window title and guide to match).
>
> **Earlier (2026-11-08 night, PC)**
>
> - **NEXT SESSION: plan "Quiz check from course export" (Lara, 11/8 night).** Decision:
>   the **course export** (.imscc, Settings › Export Course Content › Course; Lara's
>   regular backup) becomes the main pre-test check, because it is the stricter test.
>   Findings that night (read in the scratchpad, quiz/bank files only, no other names):
>   - Lara's 11/8 backup (573 MB, 47 quizzes, **95 banks**; quiz+bank text 6.4 MB): every
>     Classic banked quiz resolved, e.g. **3.9-3.10D Data Scramble 25/25, pick 5 of 11 and
>     5 of 14**; 3.2 Test 0 pictures flagged (after Lara's shrinks).
>   - **Unit 2 New Quiz: the real cause of the "epic fail".** In the course export 21 of
>     its pictures link to **course 4230 = last year's Biology** (Lara confirmed) and aren't
>     packed. Students in this year's course can't open them; Lara can, which is why the
>     quiz's own export (made with her access) packed them and looked clean, and why
>     "basically nothing worked" that day. **This corrects the 11/1 note below** ("mainly
>     a loading problem … busy Wi-Fi"): it was cross-course pictures. Single-quiz exports
>     hide this; course exports show it.
>   - Course exports keep each quiz's full QTI in `non_cc_assessments/<id>.xml.qti` (next
>     to the banks), with `<id>/assessment_meta.xml`; QtiReader needs that mapping (tested
>     in the scratchpad). Also seen: "Bonus: AI Feedback and Q1 Reflection" 9 vs 5 points,
>     one "Grade Check: 11/09 - 11/13" 1 vs 0; "Unit 1 Test 26.27" exists twice.
>   **Plan sketch to refine:** window reads only the zip's table of contents and the
>   quiz/bank files (File.slice; ~6 MB, so tablets too), accepts .imscc; an **overview
>   tab** (one row per quiz: points, banks found, pictures, rows to look at, red if
>   anything); choose a quiz for the detailed report (current layout). Keep "Quiz report
>   from export file" for a quick single-quiz check, with a guide note that the course
>   export is stricter; keep Quiz report (live) for published/hidden status. Guide also:
>   tablets work in desktop-site mode (Lara does this), portrait is tight; widen "Chrome or
>   Edge" to Safari 16.4+/Firefox. /quiz-check could read .imscc directly too. Tabled by
>   Lara: tidier data-table display; New Quiz "⋮ › Export" wording is fine. **After that:**
>   Assignment Dates overrides in assign-sheet.
> - **Upload button tested by Lara in Biology (ae0c6e1, 11/8 ~6 PM) on the Unit 2 export:
>   worked** (50/50, 21 banks listed, 10 red rows, shading fine). One bug from that run:
>   New Quizzes writes hex character codes (`&#x2014;`, `&#x2019;`) that showed as codes;
>   `quizHtmlText_` and `qtiUnescape_` now decode hex as well as decimal (`quizCodePoint_`),
>   which also fixes Quiz report on live quizzes (commit 3c3cde2). **Live in all four
>   workbooks (11/8, 9:20–9:22 PM, Lara: "Push all four"):** Biology, AI9, Gastronomy,
>   template; a read-only `clasp clone` of each matched 3c3cde2 (25 files, no manifest
>   change). Optional, not done: data-table questions show one cell per line (tall rows).
>   Still to confirm with Lara: the New Quiz "⋮ › Export" wording in the guide. Classic
>   banks: Lara still deciding. **Left:** `git push`.
> - **"Quiz report from export file" (step 2) built 11/8 evening: commit ae0c6e1.** Menu: Canvas Tools › Quiz report from export file (`showQuizExportUpload`,
>   new `QuizExportReport.js` + `QuizExportUpload.html`). The window reads the zip **in
>   the browser** with the built-in `DecompressionStream` (no outside library): sizes from
>   the zip's table of contents, only .xml/.qti unpacked; sends `{ fileName, texts, sizes }`
>   to `receiveQuizExport`, which runs `qtiReadExport_` → `qtiQuizReport_` →
>   `writeQuizReport_` (same layout as Quiz report; summary row 2 is "Settings" instead of
>   "Published"). Tab "Quiz export report" (or the active tab if A1 says "Quiz export:"),
>   B1 = file name. **Canvas's export zips are ZIP64** (sizes 0xffffffff, real ones in the
>   extra field): the reader handles it; the first try on real zips caught this. Checked
>   on Lara's three real zips: identical to a normal unzip; 3.2 Test 51/51 with 3 pictures
>   flagged, Data Scramble 25/25 with 2 missing banks, Unit 2 50/50 with 10 red rows;
>   uploads carry only 200–270 KB of text. Limits: 20 M characters / 20,000 files, then a
>   "too large (whole-course export?)" message. Offline check
>   `scripts/checks/quiz-export.check.js` (builds its own zip, ZIP64 entries included).
>   Guide: new "Quiz report from export file" section, contents link, read-only tools
>   table, a pointer from Quiz report; section links in the text now work (the click
>   handler covers every `a[data-target]`, not just the contents list). No new
>   permissions (`script.container.ui` already listed). **Next:** commit, push Biology,
>   Lara tests with the Unit 2 export, then AI9, Gastronomy, template, `git push`. Unsure
>   until tested: the New Quiz "⋮ › Export" wording, and google.script.run's size limit.
> - **Export reader for New Quizzes (and banked quizzes), step 1 of 2: commit 7d95c33.**
>   Lara's decision: Quiz report (API) stays the tool for Classic quizzes
>   without banks; banks and New Quizzes go through a **QTI export**, because the export
>   carries item-bank questions (the API shows neither Classic bank nor New Quiz item-bank
>   contents). New `QtiReader.js` (pure functions, runs in Apps Script and Node; reuses
>   QuizReport.js's picture helpers): `qtiReadExport_({ texts, sizes })` → quizzes with
>   groups in order (bank questions listed under their group when the bank's
>   `non_cc_assessments/*.xml.qti` is present), loose questions, points check, pictures
>   with sizes ($IMS-CC-FILEBASE$ → `web_resources/` in Classic, top-level `Uploaded
>   Media/` in New Quiz exports), problems (big/missing/outside/old bank/personal
>   pictures, blank choice, no correct answer, picks > size, bank not in export). Never
>   reads the access code's value. `/quiz-check`'s script is now a thin wrapper around it.
>   Tested: offline `scripts/checks/qti-reader.check.js` (made-up export, 19 pass) and
>   three real exports in the scratchpad: 3.2 Test (51/51, 19 pictures, same flags as
>   before), "3.9-3.10D Data Scramble Quiz" (Classic, 2 bank groups + 2 loose, 25/25;
>   single-quiz export leaves banks out → flagged), and "Raw Score Unit 2 Test 25.26"
>   (New Quiz: 21 item banks, 69 bank questions included, 50/50; flags match the 11/1
>   hand check: 2 old `/assessment_questions/` files in FRQ 1 Plant, 4 outside sites,
>   plus a 1.0 MB picture in Light Reactions and four 500–775 KB). **Classic banks:** Lara
>   is deciding how to handle them ("a pain"); a full course export includes banks but
>   every file too. **Step 2 (next):** "Quiz report from export file" in Course Manager,
>   an **upload button** (Lara OK'd): dialog unzips in the browser, sends only the
>   .xml/.qti text and file sizes to the script, results in the Quiz report layout (red
>   rows, frozen columns), guide updated. No new Google permissions expected; check
>   google.script.run size limits on a big export. Correction: the 3.2 Test's Q7 has no
>   "t he" typo (an artifact of my first rough pass).
> - **Quiz report picture check (step 2): commit e001cca, pushed to Biology 2026-11-08
>   and tested by Lara on the 3.2 Test: works.** Q3's new 101 KB screenshot clean; 2
>   flagged "worth shrinking" (Q49 584 KB, FRQ 1 photo 727 KB), both seen by every
>   student; all pictures Published or Link only; points 51 = 51. The 35-vs-51 worry was a
>   bug in `/quiz-check` (questions after a group's end were counted into that group; 9
>   questions are loose, 16 pts), now fixed. Same run showed an **older Quiz report bug**:
>   Sheets turned Correct "1, 2, 3" into a date ("1, 2, 2003"); fixed by setting the text
>   columns (`QUIZ_REPORT_TEXT_COLUMNS`) to plain text before writing (2156bc9; Lara's
>   rerun showed "1, 2, 3" and all pictures clean after her shrinks). **Then (Lara's ask):**
>   rows with anything in Check are shaded light red (plain shading, not conditional
>   formatting, since the table is rewritten each run), and Check flags **blank answer
>   choices** (Canvas fills them with "No answer text provided."). 3.2 Test: the
>   anaerobic-respiration question (Lactic Acid group) has a blank 4th choice; the HDL
>   diagram question moved to the end after Lara's picture swap. Committed da83a0a, pushed
>   Biology, Lara: "Looks right." **Then (Lara's choice of two):** freeze the header row
>   and the columns through Question; small columns slimmed and Question Name hidden so
>   the frozen part is ~935 px (`QUIZ_REPORT_WIDTHS`, `quizReportLayout_`); guide says how
>   to unfreeze on a small screen. Committed 7e86e8b; Lara: "That's fine." **Live in all
>   four workbooks (11/8, 2:46 PM):** Biology, then AI9, Gastronomy, and the template
>   (normal push; its one-time `--force` was earlier); a read-only `clasp clone` of each
>   matched 7e86e8b exactly (22 files). No manifest change. **Left:** `git push`. Original notes: New **Pictures** column (before Check): per picture, name · size · Published
>   / Link only / Unpublished, plus "(old tag: course …)" when `data-api-endpoint` names
>   another course. Check column gains picture problems: 1 MB+ "shrink it", 500 KB+ "worth
>   shrinking", file or any parent folder unpublished, availability dates (file or folder),
>   another course's / personal / group files, can't be opened, old `/assessment_questions/`
>   file, outside site. Answer-choice pictures are checked too; math (`/equation_images/`)
>   skipped. Summary gains a **Pictures** row (yellow when anything is flagged). New GETs:
>   `/files/:id` and `/folders/:id` (each once per run via `quizPictureLoader_`). Canvas
>   answers 401 for files the teacher can't open, which `fetchCanvas_` calls TOKEN_REJECTED;
>   the loader treats that as NOT_ALLOWED for one picture (the quiz was just read with the
>   same token). In-sheet guide's Quiz report section rewritten. Offline check extended
>   (42 pass). **Plan (Lara OK'd):** commit → push **Biology only** → test on the **3.2
>   Test** (expected: 19 pictures / 14 files from the export; Q3 now small after Lara's
>   shrink; the 727 KB FRQ 1 photo and Q49's 584 KB screenshot "worth shrinking"; nothing
>   unpublished) → push AI9 and Gastronomy. The test also settles **3.2 Test points:** the
>   QTI export's groups sum to 35, but the quiz's saved total said 51 (stale until re-saved?).
>   Canvas file fields used (`size`, `locked`, `hidden`, `unlock_at`, `lock_at`,
>   `folder_id`; folder `context_type`/`context_id`/`parent_folder_id`/`locked`) are from
>   Canvas's docs, not yet seen live: check the first run. Related: the read-only
>   `/quiz-check` skill (`.claude/skills/quiz-check/`, commit 833f01c) does the same for a
>   QTI export, and still covers bank questions and the vocab cross-check.
> - **All three workbooks unified 2026-10-29 (Lara: "push both").** Before: Biology had
>   everything (7ebff5d); AI9 lacked the comment latest-attempt fix; Gastronomy lacked
>   Quiz report, both groups tools, and that fix. Pushed AI9 and Gastronomy from the Mac,
>   then a read-only `clasp clone` of each showed **Biology, AI9, and Gastronomy all match
>   commit 7ebff5d's code** exactly. No manifest change (no new permissions). Gastronomy
>   now has the groups write tool for the first time; check its `DRY_RUN` before a real
>   run. Lara to reload each workbook so the menus update. Notes below that say a tool is
>   in "Biology only" or "AI9 only" are from before this push.
> - **Overall:** the move off the legacy code is **finished**: every tool Lara used in
>   legacy is ported and tested (legacy review finished 2026-10-20, see
>   `docs/still-in-legacy.md`), and the legacy workbooks are retired. Changes
>   go to one workbook first (usually Biology), then the others after Lara's OK.
>   To check what's live, `clasp clone` each script ID into a scratch folder (read-only)
>   and diff it against Git.
> - **Now working on: Classic quiz tools (started 2026-10-26 evening, PC).** Lara's two
>   long-running Canvas problems: (1) editing a Classic quiz's question groups ("pick 3 of
>   7"), some in the quiz and some pulling from question banks, without losing the
>   structure; (2) pictures teachers can see but students can't (stored in the course the
>   quiz was copied from, or hidden/locked; sometimes only one or two students miss one).
>   **API, not QTI export (decided 2026-10-26):** a QTI export of the 3.1 Test (course
>   4791) showed the full group structure and packed its 6 images, but nothing about
>   whether a file is hidden or locked, and editing has to go through the API anyway.
>   QTI stays a possible way to read **bank questions**, which Canvas's API doesn't list
>   (the 3.1 Test has no banks; Lara is exporting one that does). One image there carried
>   a leftover `data-api-endpoint` tag for course 184 while its `src` was this course's
>   copy; step 2 should flag such mismatches. Plan: (1) read-only structure report;
>   (2) picture check (who owns each file, hidden/locked, other course, personal files,
>   outside site); (3) later, editing groups from the sheet (writes: spell out first,
>   `canvasWrite_`, dry run). A whole-course picture scan can come later (Lara).
>   Another way to do (3): rebuild a QTI from the sheet (idea, 11/5; see "Later / maybe").
>   **Step 1 built and tested 2026-10-26 (commit c45a0b6; pushed to Biology only):** new
>   `QuizReport.js`, `runQuizReport` (menu: Canvas Tools › Quiz report (this tab)). A1
>   "Quiz link:", **B1 = the whole Classic quiz link** (not the bare ID); works on any tab
>   whose A1 says that, else opens/makes "Quiz report". Rows 3+ replaced each run: summary
>   (title, published, points in Canvas vs. found, points check), then group rows (gray:
>   name, pick, of, points each, In quiz / Bank) with their questions (type, points, text
>   with `[picture]`, choices, correct numbers) in quiz order, and a **Check** column
>   (picks more than it has, picks 0, no correct answer, no text, group unreadable).
>   Groups are found through their questions (no list-groups endpoint), so bank groups
>   are invisible; the points check reports the missing points. **Lara's test on the 3.1
>   Test: 19 groups, 65 questions, 50 of 50 points, nothing flagged, 8 `[picture]`
>   questions (same as the export).** Fix after the test (commit ce93f31, pushed to Biology,
>   Lara: "looks fine"): matching questions showed only the left side; now "left →
>   right". Read-only; no new permissions. Offline check `scripts/checks/quiz-report.check.js`.
>   **Next session (Lara): test a banked Classic quiz with the current code (no new code
>   needed first):** paste its link in B1, run, read the points check (bank groups
>   expected to be invisible, so missing points; a "Bank …" Source row would be news);
>   if possible also drop its QTI export in `Quiz-samples/` to see whether QTI carries the
>   bank questions. Then step 2. The **overrides / update dates question** is still open,
>   set aside by Lara (not pressing).
>   **New Quiz version: tabled (Lara, 2026-10-26).** Her worst image problems are in a
>   New Quiz. Plan, not built: Quiz report also accepts a New Quiz link
>   (`…/courses/:course/assignments/:id`), checks it's a New Quiz, and reads items with
>   `GET /api/quiz/v1/courses/:course/quizzes/:id/items` (questions, stimuli, item-bank
>   groups; bank contents likely not readable, same gap as Classic). Same layout. Plus a
>   **Pictures** column for both quiz types: each picture's short address ("course 184
>   file 195459", "New Quizzes storage", or the outside site), flagging pictures from a
>   course other than the quiz's own (first half of step 2, before the hidden/locked
>   lookup). Caveat: pictures uploaded in the New Quiz editor live in New Quizzes' own
>   storage, which Canvas's file API can't check. Canvas's docs are thin on how bank
>   groups and stimuli come back from the read endpoint, so the first run may need
>   adjusting. Read-only; no new permissions.
>   **Picture findings (11/1, from QTI exports, checked in a scratch folder):**
>   - **3.1 Test (Classic, LockDown Browser, given 11/2):** all 6 images are this
>     course's Files and were packed into the export; Lara checked their folders in
>     Files ("only available with link" = fine). Group 14's 3 questions keep a leftover
>     `data-api-endpoint` to course 184 (src is this course's copy; probably harmless).
>   - **Unit 2 Test 25.26 (New Quiz, 20 item banks, LockDown Browser on school iPads):
>     the "epic fail".** Most images broke for at least one student (broken-image icon),
>     so mainly a **loading** problem, not permissions (those break for everyone).
>     Likely LockDown Browser's iPad app + New Quizzes image storage on busy Wi-Fi;
>     not provable from the export. Suggested Lara report it to IT/Respondus. Separately,
>     bank "Unit 2 Test FRQ 1 Plant (1)" has 2 images pointing at an old Classic bank
>     file (`/assessment_questions/…/download?verifier=…`), which Canvas couldn't even
>     export: broken for students. 4 images hotlink outside sites (learn-biology.com,
>     OpenStax S3). Fix: re-upload images inside the New Quizzes editor.
>   - **Lara's take:** for image-heavy tests on iPads with LockDown Browser, Classic is
>     safer until that's fixed. New Quizzes was tried only for shared banks. No
>     Instructure retirement date for Classic yet (checked 11/1). Lara may not teach
>     Biology next year; this matters mainly if helping another teacher.
>   - **For the picture check (step 2 / New Quiz version):** flag `/assessment_questions/`
>     links, other-course numbers, personal files, and outside sites; image size is a
>     useful extra (Unit 2 had several near 1 MB).
>   **Housekeeping:** `Quiz-samples/` (QTI exports, no student data) is untracked on the
>   PC; next time add it to `.gitignore` or move the exports out of the project.
> - **Groups: putting students in groups (started 2026-10-28, Mac).** Lara wants a faster
>   way than drag-and-drop; AI9 (quarter course, groups change often) goes **first**,
>   then Biology/Gastronomy after her OK. **Step 1 done (commit 45fa121, pushed to AI9
>   2026-10-28; Lara: "It worked GREAT!"):** **Pull groups into this column**
>   (`pullGroupsForActiveColumn`, Groups.js; Canvas Tools › Groups; read-only):
>   grading-sheet column, row 2 = group category ID; writes each student's current group
>   (blank if none) and adds a dropdown of the set's group names; checks the set belongs
>   to `cfg_CourseID`. Offline check `scripts/checks/groups.check.js`.
>   **Biology note (2026-10-29):** steps 1 and 2 reached Biology early, in the push for
>   the comment latest-attempt fix (7ebff5d); Lara chose to leave them there (dry run ON).
>   **Step 2 built 2026-10-29, not yet tested (a write, Lara OK'd the plan):** **Put
>   students in groups from this column** (`putStudentsInGroupsFromActiveColumn`).
>   Changes only students whose cell differs from Canvas: add, move, or remove (blank
>   cell); students not on the sheet are never touched (AI9 sheets are multi-section).
>   Per student via `canvasWrite_` (dry run): `DELETE /groups/:old/users/:user`, then
>   `POST /groups/:new/memberships` {user_id}. Replaced the earlier plan (one
>   `PUT /groups/:id` with `members[]` per group), which would have dropped members not on
>   the sheet and can't reliably empty a group. Stops before sending on unknown names or
>   duplicate group names; no auto-create. Refused rows light red + note; 5-minute stop;
>   document lock. **Test plan:** dry run in AI9, then a real run moving 2-3 students.
>   CSV download: skipped (no student file).
>   **List groups and members (2026-11-02; read-only; tested in AI9, Lara: "Beautiful!";
>   commit 6b940d3 pushed to AI9, Biology, and Gastronomy the same day, so all three
>   match):**
>   `listGroupsAndMembers` (Groups.js; Canvas Tools › Groups; this tab). B1 course ID
>   (blank = cfg_CourseID), B2 group set ID, set name written to C2 (no label; row 3
>   blank, Lara 2026-11-02 after the first AI9 test; was B3/C2); from row 5 each group
>   (light blue header, members by last name), then "Not in any group" (light red, from
>   `group_categories/:id/users?unassigned=true`). B2 blank lists the course's group sets
>   and IDs. Refuses ref_ tabs and tabs whose row 4 isn't blank or its own headers.
>   Lara asked for it after a group set was set up wrong. Goes to **AI9 first**. (It was
>   first built by mistake in legacy `course-manager/` and pushed there, commits a1731ef
>   and 8ac4478; harmless, read-only.) Pushed to AI9 2026-11-02 (7fc4c4c). Google Doc
>   guide synced the same day: its Groups section had been missing Pull groups and Put
>   students in groups too, so the whole section now matches the user guide.
>   **Considered and rejected (Lara, 2026-11-02): moving students from the List groups
>   tab** (a "Move to" dropdown per student plus a "Send moves" item reusing Put
>   students in groups' writes). Reason: it would mostly redo what Canvas's own People ›
>   Groups page already does. Don't re-propose unless Lara brings it up. Still open
>   separately: testing Put students in groups (dry run in AI9, then 2–3 real moves).
> - **User guide (in the workbook since 2026-11-08):** `UserGuide.html` (this folder),
>   written for **other teachers who weren't here**: setup, permissions, safety, then one
>   section per tool. Opened by **Canvas Tools › ❓ User guide** (`showUserGuide` in
>   Menus.js) in the side panel (since 11/8, commit `396699a`; "Open in a large window" link calls
>   `showUserGuideLarge`); a Home-tab button can call
>   `showUserGuide` too. That file is the only master copy (Lara's decision 11/8: keep docs
>   self-contained, like calendar-filter). **Stays a draft until a new teacher tests it**
>   (Lara, 11/8: start from the draft, collect new users' questions; she'll help the first
>   few users herself, since some setup was done by hand and may be missing). Rule (in
>   CLAUDE.md): update it in the same commit as any change a teacher would see.
>   **Live in all four workbooks (11/8):** Biology (tested by Lara), then AI9, Gastronomy,
>   and the template (commit `e0b1d78`).
>   History: first drafted 2026-10-27 as `USER-GUIDE.md` (from the old quick-start
>   `docs/user-manual.md`; removed 11/8, still in Git history). The old **Google Doc
>   copy** "Course Manager (Jupiter edition) — User Guide", ID
>   `1kljRuoqQT1q4YVXbRJBsnfyXtSdxZ-oCqzByUl8AhwQ`, in Drive folder TeacherTools
>   (`1TDwmuQh4buJ6VTMIpEFKqwE8rl5JU2zm`), got a bold one-line "moved into the workbook"
>   note at the top on 11/8; it is no longer updated. **Google connectors
>   (Lara, 2026-10-29):** Drive, Docs and Sheets are connected; Lara set **all their tools,
>   read-only and write, to Needs approval** in Settings › Connectors, so the app asks her
>   before every Drive/Docs/Sheets call. CLAUDE.md hard rule 7 also limits them to files
>   named in a BRIEF or in chat (this Doc is one).
> - **Template copy (made by Lara 2026-11-08):** script ID
>   `1h8UfPPxPzwOKmOfQE-K7_p7ESkaHO3B_DrBhwMZOiNeujzDw0UJZexBX`, settings file
>   `.clasp-template.json`. Claude never opens the template's sheet. The plan it followed:
>   Lara makes a copy of a live
>   workbook, scrubs the copy (never the live one), and keeps it in her **Shared** folder
>   in Drive for other teachers. Its script ID gets its own clasp file (like the AI9 and
>   Gastronomy ones) and it is pushed **last** (Biology → AI9, Gastronomy → template); ask
>   before the first push. clasp updates code only: new tabs, labels, or buttons go onto
>   the template by hand. How teachers' own copies get updates (decided 11/10, same as
>   assign-sheet): the guide shows "Version yyyy-mm-dd" under its title and section "8. What's
>   new and getting updates"; a teacher re-copies the template and brings their
>   work over. **Bump the version and add a What's new line in the same commit as any
>   change a teacher would see.**
>   **Scrub list (expanded 11/8; checklist given to Lara in chat):** student data
>   (ref_peopleList; every grading sheet, e.g. Comments: columns A–F, scores, comments,
>   Pull groups columns, and the cell notes Post comments leaves; JupiterExport; any
>   List groups and members tab; createGroups names if they hold student names);
>   hand-typed Home links that point at Biology's full web address; hidden tabs and columns;
>   ref_Config `cfg_CourseID`, `cfg_UserID`, `cfg_CcEmail`, `cfg_SeatingDeckID` (the deck
>   has student names); course leftovers (CanvasID / Canvas Link / Payload / Status on
>   createByRow and makeAssignment tabs, Course Check, Quiz report tabs, Export to Google
>   Docs rows and C1, ref_CourseIDs). Token and version history don't copy. Set dry run
>   ON in the template. Lara does the final Ctrl+F check for student names and Jupiter
>   IDs herself: **don't read the template through the Drive connector** (FERPA). Share
>   view-only, with a `/copy` link.
> - **Newest tools (details under Recent history):** Pull scores and Post comments
>   (2026-10-23); green-button descriptions and "only a ticked Published box publishes"
>   (tested 2026-10-25); Export to Google Docs (tested in Gastronomy 2026-10-25).
> - **Not yet seen live:** Export to Google Docs and List course content in Biology and
>   AI9 (pushed 2026-10-26; Export's first run in each asks Lara to approve the Drive
>   permission if she hasn't yet); Post comments skipping a cell already
>   noted "Commented" on a rerun, and the light red on a refused comment.
> - **Step 3 test passed 2026-10-26 in Gastronomy (no code change).** The 2026-10-25
>   "failed" test was not a bug: the only item Lara edited was the Syllabus, which is
>   never marked (no Canvas date). Retest from a clean start (old folder and Docs trashed,
>   C1 and the rows cleared, then List → Export → edit in Canvas → List): an exported
>   assignment edited in Canvas turned yellow; an exported, unedited one didn't; an
>   edited but never-exported home page wasn't marked (rows without a Doc are skipped,
>   as designed).
> - **Backup tool step 3 built 2026-10-25 evening (commit 51ee6df), live and tested in Gastronomy only (see above):** List
>   course content marks a row's **Google Doc cell light yellow (`#fff2cc`) with the note
>   "Changed in Canvas since export"** when its Canvas Updated date is after its Exported
>   date (`planChangeFlags_`, `applyChangeFlags_`, `sheetDate_` in CourseContentList.js);
>   a later run removes only this tool's yellow and note once it no longer applies (the
>   row was re-exported). Needs the Exported column. Never marks discussions or the
>   syllabus (no Canvas date). Assignments also get marked after settings changes (due
>   date, points). Pop-up counts marked rows and says how to redo one (delete the Doc
>   link, tick Back up?, Export). Read-only; no new permissions.
> - **Fix 2026-10-25 evening (first step 2 test):** Lara's label read "Back Up?", so Export
>   didn't find the column and started on all 98 rows (she cancelled; some Docs were made).
>   Now **labels ignore capitals and extra spaces** (`exportLabelText_`, all labels), and
>   **Export asks Yes/No with the count before making any Doc** (`exportConfirmText_`;
>   says plainly when there's no Back up? column and every row will go).
>   **Then (Lara): "truly default to not making the doc":** Export now does **only ticked
>   rows, always**; a tab with no Back up? column exports nothing and says to add one
>   (the old paste-a-link-and-export-all behavior is gone).
> - **Backup tool step 2 built 2026-10-25 evening, live in Gastronomy only (with the fixes below, commit 7e8ec96); tested by Lara: "Looks solid":** Export puts
>   assignment, discussion, and page Docs in **Assignments / Discussions / Pages**
>   subfolders inside the C1 folder (`subfolderFinder_`, `exportSubfolder_` in
>   ExportToDocs.js); syllabus and home page Docs stay at the top. Subfolders are found
>   by name with `Drive.Files.list` (drive.file sees only script-made folders) or made
>   the first time a type needs one; a subfolder renamed in Drive isn't found, so a new
>   one is made. Docs made before step 2 stay where they are. "Only ticked rows" was
>   already built in step 1. Discussion/syllabus dates: left blank (Lara, 2026-10-25).
> - **Backup tool step 1 built 2026-10-25 evening (commit 7b7524a), live and tested in Gastronomy
>   only, not yet tested; Biology and AI9 don't have it (they match 2e156ab):** new
>   `CourseContentList.js`, `listCourseContent` (menu: Canvas Tools › List course content
>   (this tab), just above Export). Course from **B2** (A2 labeled "Course ID:" if empty;
>   blank B2 → `cfg_CourseID`). Rows matched by link (home link `/courses/:id` matches the
>   front page's page link; page names ignore capitals) keep their place, link, Doc,
>   Exported, and Back up? cells; Name/Type/Published/Canvas Updated refreshed (other
>   rows' formulas kept). New items go below the last row with a link, Back up? unticked.
>   Rows for this course no longer in Canvas are counted, left alone. Optional new row 3
>   labels: **Type, Published, Canvas Updated, Back up?** (Lara will ask for a reminder).
>   **Export now does only ticked rows when a Back up? column exists** (built in step 1 so
>   a long list can't export everything by accident). **Tested 2026-10-25 in Gastronomy
>   (Lara: "seemed to work").** Canvas Updated = Canvas's `updated_at` (pages: last save;
>   assignments: any settings change incl. due date/points/publish, not submissions).
>   **Blank for every discussion and the syllabus** (confirmed: Canvas's discussion list
>   sends no `updated_at`; the syllabus has no date), so step 3's changed-since-export
>   flag can't cover those rows; `last_reply_at` is student activity, not a substitute. Offline check
>   `scripts/checks/content-list.check.js`. Read-only; no new permissions.
> - **Next up: the course backup tool. Started 2026-10-25 evening; decisions made, step 1
>   built (above).** It extends the Export to Google Docs tab (same `ExportToDocs.js` tab, same
>   B1 folder name / C1 folder link / row 3 labels). Lara's decisions (2026-10-25):
>   - **Course ID on the tab** (proposed: A2 label, **B2** value), filled from
>     `cfg_CourseID` when blank, so any course she teaches (old terms too) can be backed
>     up from one workbook.
>   - **Re-backups: skip rows with a Doc (as now) and flag changed ones:** the List step
>     compares Canvas's last-updated date with the row's Exported date and marks rows
>     edited since (proposed: light yellow + note on the Google Doc cell), so she clears
>     and redoes only those.
>   - **Folders: subfolders by type** inside the course folder (Assignments, Discussions,
>     Pages; syllabus and home page at the top), made by the script (`drive.file`).
>   - **Quizzes: not in v1** (Classic quiz instructions + questions could be step 2; New
>     Quizzes later).
>   Proposed shape: menu **"List course content"** fills one row per assignment,
>   discussion, and page plus the course home page and syllabus (Type, Name, Published,
>   Canvas Updated, Canvas Link, **Back up?** checkbox); rerunning adds new items and keeps
>   ticks and Doc links (matched by link). Export then does only ticked rows when a Back
>   up? column exists (otherwise every row, as now). Graded discussions are listed once (as
>   discussions; skip assignments whose `submission_types` include `discussion_topic`),
>   and quiz assignments (`online_quiz`) are left out in v1. Read-only in Canvas; no new
>   permissions. Build order: (1) List course content + Course ID cell; (2) Export ticked
>   rows into type subfolders; (3) changed-since-export flag.
>   Original idea, kept for the record: pull a list of the course's
>   assignments, discussions, and pages into the tab, with a checkbox per row for which
>   ones to archive, then export the ticked ones. Questions to talk through first: one tab
>   per course or term; how re-backups work (skip, or new dated Docs); folder layout;
>   Classic/New Quizzes; time limits for a big course (6 minutes per run). Read-only in
>   Canvas either way.
>   **Goal (Lara, 2026-10-25): an archive of everything for a possible retirement, ending
>   up in her personal OneDrive.** She asked about making Word files instead. Suggested:
>   keep Google Docs; Drive's **Download** on a whole folder turns every Google Doc into
>   a .docx inside the zip, so no Word code is needed (a .docx copy in the folder is
>   possible later if wanted). **Images:** Google fetches each image without a
>   Canvas login, so images uploaded **into Canvas Files** usually go missing (unless the
>   link carries a `verifier=` code); images from public sites come through. Possible fix
>   for the backup tool: the script downloads Canvas images with Lara's token and puts
>   them into the Doc itself. **Built 2026-10-25 (Lara: fix it unless it's slow; about a
>   second per picture):** `embedCanvasImages_` turns each `<img>` on this Canvas with a
>   `/files/:id` address into a `data:` picture: `GET /files/:id` (type, size, temporary
>   `url`), then the picture is downloaded from that `url` **without** the token; not a
>   picture, over 5 MB, or failed → left as is (missing), Doc still made; each file looked
>   up once per run. The finish pop-up counts pictures put in / missed. **Tested 2026-10-25
>   on the Gastronomy home page: works** (Drive accepts `data:` pictures). Also mentioned: Canvas's own course export (.imscc, the
>   complete course, for re-import into another Canvas); check the school's policy on
>   taking course materials to a personal account; the backup must never include student
>   work, replies, or grades (FERPA; the tool already reads prompts only).
> - **Later / maybe:** email tools (wait and see); assignment dropdowns for the grading
>   sheet tools (skipped: the list got too long); tidy unused `ref_Config` cells (see
>   "`ref_Config` finished" in the running log).
>   **Idea (Lara, 2026-11-05 morning, not started): edit quiz questions in the sheet,
>   then rebuild a Classic QTI to import into Canvas.** Classic quiz with question groups
>   is fine; no New Quizzes item banks. Background: Quiz report reads the quiz through
>   the **API**, not QTI. The QTI exports were only read by hand in a scratch folder
>   (picture findings, 11/1). Those exports did show the full group structure, so QTI
>   could work as the way back in. Open questions: does the script make a QTI .zip that
>   Lara imports by hand (no Canvas write by the script), or does it upload it
>   (`content_migrations`, a write: spell out first, `canvasWrite_`, dry run)? Where does
>   the .zip go (Drive, which may need a new permission)? Do pictures and bank questions
>   survive the round trip? Compare with step 3 above (editing groups through the API).
>   **Why it matters (Lara, 11/5):** this could fix the clunky way teacher teams edit
>   questions together today, especially since Canvas's own quiz print-to-PDF is a mess.
>   Teachers would edit questions in a sheet, then a QTI file is made that's easy to
>   share with everyone, and each teacher imports it into their own course.
> - **Pushing (from `course-manager-jupiter/`; always commit first, ask Lara first):**
>   Biology = plain `clasp push` (`.clasp.json`). AI9 / Gastronomy: on the PC (Git Bash
>   or PowerShell) `clasp push -P 'C:\Users\lalee\Code\canvas-scripts\course-manager-jupiter\.clasp-ai9.json'`
>   (backslash path; a forward-slash path gave "srcDir escapes project root"); on the Mac
>   `clasp -P "$PWD/.clasp-ai9.json" push`. Same for `.clasp-gastronomy.json`. A
>   manifest (`appsscript.json`) change needs `--force`. Switching machines: `git pull`
>   first, `git push` at the end.
>
> **Recent history (newest first; kept for the record)**
>
> - **2026-10-26 morning (Mac at school):** backup step 3 retest passed in Gastronomy;
>   then Biology (`clasp push`) and AI9 (`clasp -P "$PWD/.clasp-ai9.json" push`) pushed
>   with backup steps 1-3 (Lara: "clasp push the current code to Biology and AI9"). No
>   manifest change, so no new permissions. The "Gastronomy only" notes on steps 1-3
>   below are from before this push.
> - **2026-10-25 evening:** Biology and AI9 pushed (Lara: "push to everything"), so all
>   three workbooks match. Home page + Canvas pictures export tested by Lara ("basically
>   seems to work"). Wrinkle, accepted by Lara: the course home link exports the **front
>   page**, not the syllabus her course home shows; use the syllabus link
>   (`…/assignments/syllabus`) for that.
> - **Export to Google Docs (built and tested 2026-10-25; live in all three workbooks).**
>   Tested in Gastronomy (an assignment, the course home page, pictures stored in
>   Canvas). `--force` was needed for each manifest change. New
>   `ExportToDocs.js`, `exportCanvasToDocs` (menu: Canvas Tools › Export to Google Docs
>   (this tab)). Lara's first use: Gastronomy (content mostly in Canvas pages and
>   assignments), so it **goes to Gastronomy first** (her choice, 2026-10-25), then
>   Biology/AI9 after her OK. Lara's decisions: paste the **Canvas link** (type and course
>   come from it; assignment, discussion, page; quizzes not supported; **added 2026-10-25:
>   course home** `/courses/:id` or `/wiki` → `GET …/front_page` (404 note says the home
>   isn't a Page) **and syllabus** `/courses/:id/assignments/syllabus` → course with
>   `include[]=syllabus_body`, Doc titled "<course name> Syllabus"); **narrow Drive
>   scope `drive.file`** (new; security over convenience: the script can only see
>   folders/files it made, so it can't use an existing folder): **B1 = folder name**
>   (typed), **C1 = folder link** (written when the script makes the folder in My Drive;
>   Lara can move/rename it; moved from B2/B3 at Lara's request, 2026-10-25). Labels in
>   **row 3** on Lara's tab (any row 1–10 works), found by **Canvas Link** and **Google
>   Doc** (optional **Name**, **Exported**). **Rows with a Google Doc link are skipped**
>   (delete it to remake). Missing Canvas images were acceptable to Lara (since fixed:
>   pictures stored in Canvas are now embedded, see Next up). Discussions: prompt only, never replies. Doc = title heading,
>   "Open in Canvas" link, then the HTML converted by Drive. Refused rows: light red +
>   note on the link cell. Read-only in Canvas. **Drive via the Advanced Drive service
>   (v3)**: the first version called Drive's REST API through UrlFetchApp and got HTTP 403
>   `accessNotConfigured` in Gastronomy (the Drive API is off in the script's hidden
>   Google Cloud project); enabling the Advanced service turns it on. Scope is still only
>   `drive.file`; the scan's "Advanced Drive service" warning is expected (DriveApp can't
>   convert HTML to a Doc). If the 403 stays after the push: Extensions › Apps Script ›
>   Services › Drive API › Add, by hand. Offline check
>   `scripts/checks/export-to-docs.check.js`. First run in each workbook asks for the new
>   Drive permission. First test (one assignment): worked, and a linked picture came
>   through; how formatting and images hold up on other items is still to be seen. **Blue links** (pasted Canvas links showing the item's
>   name) were refused at first; fixed (3efc987): the address comes from the cell's link,
>   a link on part of its text, or a `=HYPERLINK` formula before the visible text.
> - **Green-button descriptions: tested 2026-10-25** (Lara made a new assignment by row in
>   Gastronomy; "the green box works fine"). Live in all three workbooks (AI9 pushed
>   2026-10-25 evening).
>   Older note: **Green-button descriptions and "blank Published = draft": pushed to Biology and
>   Gastronomy (commit 8f8f891), not yet tested** (see "Description style" in the
>   makeAssignment notes and "Published column, in practice"). **Lara (2026-10-23): she'll
>   test in the next day or so, likely starting in Gastronomy** (one draft createByRow
>   item with a Google Doc link) **and come back if there are issues.** Next session: ask
>   how it went; once OK, mark tested and push to AI9 (ask first). Until then AI9 still
>   has the old description style and blank = publish.
> - **Done 2026-10-23 and 2026-10-24 (the old "Next up" list):**
>   1. **Done 2026-10-23: bring back the one-assignment tools from legacy** (see
>      `docs/still-in-legacy.md`):
>      - **Pull grades:** read each student's score for one assignment into a column
>        whose **row 2 holds the assignment ID** (legacy
>        `syncGradesAndStatusForAssignmentActiveColumn`, read-only).
>      - **Post comments:** post each student's comment from the given column **and the
>        column next to it** to their submission for that assignment (legacy
>        `postBatchCommentsForAssignmentActiveColumn`). Check in legacy how the two
>        columns are used before building.
>      - The assignment dropdowns that pick the assignment, if still needed.
>      Posting comments **writes to Canvas** (comments only, no grades): call it out
>      first, route it through `canvasWrite_()` with `DRY_RUN`, and keep student data
>      (names, scores, comment text) out of logs. Test on Sequence 9 / a copy first.
>      Then push to Biology, test, then AI9 and Gastronomy.
>      **Plan and Lara's decisions (2026-10-23):** legacy checked: the column next to the
>      comment column is a **Status** column the tool writes ("Commented" / "API Error"),
>      not a second comment. Both tools go in new `AssignmentColumn.js`, menu Canvas Tools ›
>      Grading sheet. **Dropdowns skipped** (Lara: the list got too long to be useful; maybe
>      later). **Attachments:** Drive links typed into the comment text only (no code, no
>      Drive permission); real file uploads (3-step Canvas upload + a Drive scope) not
>      planned. Lara: the legacy comment tool **worked earlier this school year**, so the
>      grade-write block doesn't seem to stop comments. Comment plan (not built yet):
>      `PUT /courses/:course/assignments/:id/submissions/:user` with only
>      `comment[text_comment]` (never a grade field), through `canvasWrite_`, confirm pop-up
>      (course, assignment name, count, dry-run state), **skip rows whose Status already says
>      "Commented"** (no double posts; clear Status to resend), 5-minute stop. First real test
>      on the course's Test Student (Canvas notifies students of comments).
>      **Pull scores built and tested (2026-10-23, commit f31f516; pushed to Biology; Lara:
>      works, including students who haven't submitted yet).** Row 1 selector stand-in (Lara,
>      instead of dropdowns): `=IF(J$2="", "", IFERROR(XLOOKUP(VALUE(J$2),
>      ref_assignmentGroups!$A:$A, ref_assignmentGroups!$B:$B), "ID not found"))` shows the
>      assignment's name above its ID (refresh assignment groups for new items). `pullScoresForActiveColumn`. Click
>      a cell in the column (G or later; A–F refused), row 2 = assignment ID. One request for
>      the class (`GET …/assignments/:id/submissions`; legacy sent one per student) plus one
>      for the assignment's name. Same score as Update Grades (`scoreForJupiter_`). Writes
>      only rows with a numeric User ID in A (legacy also blanked other rows, e.g. Average);
>      students Canvas doesn't list are left blank and counted. Asks Yes/No if any student
>      cell is already filled. Read-only; no new permissions. Offline check:
>      `scripts/checks/assignment-column.check.js`.
>      **Post comments (2026-10-23):** `postCommentsForActiveColumn` (menu: Grading sheet ›
>      Post comments from this column). Canvas docs checked: "Grade or comment on a
>      submission" needs manage-grades permission only when submission/rubric fields are
>      sent, and comment-only requests work under the grade block. **First version (Status
>      column, commit c3ba58a) worked live in Biology** (Lara skipped the test-course step and
>      posted real comments: "we're in business").
>      **Redesign, Lara's choice: no Status column; cell notes (commit a5ee5d1; pushed to
>      Biology; tested 2026-10-23: dry run fine, Lara called it tested since the Canvas call
>      is unchanged; she'll report any problem. Not yet seen live: skip-on-rerun reading a
>      "Commented" note, and the red for a refusal).**
>      Each comment cell gets a note right after it's sent: "Commented M/d h:mm a", "Dry run
>      (not sent)" (posts again later), or "Not sent: not found (404)" / "not allowed (403)"
>      / "Canvas error (HTTP n)" (posts again on rerun). Refused cells get a light red
>      background (`#f4cccc`); a later success removes only that exact red. The row 1 cell
>      gets a summary note ("M/d h:mm a: 15 posted, 0 refused, 3 already commented"),
>      replaced each run; notes leave Lara's row 1 name formula alone. Cells whose note
>      starts with "Commented" (any case) are skipped (no double posts; delete the note to
>      resend). Notes, not Sheets comments: scripts can't create cell comments without the
>      Drive API, and comments email collaborators. Note triangles can't be colored.
>      **Latest attempt (2026-10-29, Lara's report):** comments landed on attempt 1 for
>      students who resubmitted (Canvas's default with no `comment[attempt]`), out of sight.
>      Now one `GET …/submissions` for the class and each comment sends
>      `comment[attempt]` = that student's latest attempt (omitted if not submitted). Lara:
>      latest is the default; a choose-the-attempt option only if she asks. Pushed to Biology;
>      **Lara tested live 2026-10-29: "The comments worked fine this time."**
>      Lara's decisions: no "clear notes" menu item (she starts a new column instead); no
>      compatibility with the old Status column (she won't reuse it). Unchanged: posts rows
>      with a numeric User ID and a comment (display text, trimmed); stop-all errors stop
>      the run; 5-minute stop; document lock; confirm pop-up (assignment name, course,
>      counts, dry-run state, students notified).
>   2. **Done 2026-10-24: AI grading follow-up.** Lara tried the BioGrading Gem
>      (`gems/BioGrading.md`) in Gemini, and also MagicSchool, on the 3.2D Digestive
>      Enzymes lab (two students per printed paper: Data Collector graded on the data
>      boxes, Analyzer on the analysis questions). Weak spot: reading Benedict's colors in
>      uneven student photos; written answers graded fine. Things improved once she made a
>      key by hand of what each photo showed. One student at a time, with the AI comment in
>      its own paragraph, worked well (she posts her comment, then the AI's, in Canvas).
>      **Lara's decision: no Gem changes.** The instructions stay general purpose; she'll
>      explain assignment-specific issues to the AI before uploading work. Worksheet ideas
>      for her (not code): add a color/description to the carbohydrate table like the
>      protein table has, a Benedict's color strip in photos, an expected-results key by
>      Runner #.
> - **Done 2026-10-23 (Mac session):** Pull scores and Post comments (cell notes) built,
>   tested, and live in **all three workbooks** (Biology, AI9, Gastronomy); Google matches
>   commit a5ee5d1's code in each (AI9 and Gastronomy checked by a read-only `clasp clone`
>   after the push). Details under "Next up" item 1 below.
> - **AI9/Gastronomy script IDs fixed (2026-10-23, commit 5a91eb3).** The first push was
>   refused ("Invalid script key"): the two files held the **workbooks'** IDs (44
>   characters), not the **Apps Script project** IDs (57; Extensions › Apps Script ›
>   Project Settings › Script ID). They had never been pushed, so the copies held the code
>   they were copied with, which matched Git except for the two new tools; their manifests
>   differed only in formatting (same 4 scopes), so the first push used `--force`. Mac push
>   from `course-manager-jupiter/`: `clasp -P "$PWD/.clasp-ai9.json" push` (`-P` before
>   `push`; same for `-gastronomy`).
> - **Live in the Biology workbook and tested:** every tool Lara uses from legacy (legacy
>   review finished 2026-10-20; see `docs/still-in-legacy.md`); CreateRoster keeps rows
>   lined up by User ID; Course check (seven checks, "OK as is" ticks, burgundy Info
>   rows) runs from Canvas Tools and after assignment-group refreshes; Canvas-built ref
>   tabs hide themselves after refresh; Pull scores and Post comments (2026-10-23).
>   Last session was on the Mac: on the PC, `git pull` first.
> - **First real Jupiter update (Bio) done 2026-10-22:** worked fine, no fix needed. The
>   blank Comment cell test in Jupiter is **shelved**: comments will be written in the
>   Sheet and posted to Canvas instead (see "Jupiter comments" under Open questions).
> - **AI9 and Gastronomy workbooks made (2026-10-22):** Lara copied the Biology workbook
>   once per course, set `cfg_CourseID` and `cfg_TermQuarters` (AI9 `2`, Gastronomy `1-2`),
>   refreshed the tables, and re-sorted AI9's multi-section grading sheets herself.
>   Settings files: `.clasp-ai9.json`, `.clasp-gastronomy.json` (same code as Biology).
>   Push from `course-manager-jupiter/` after Biology is tested:
>   `clasp push -P 'C:\Users\lalee\Code\canvas-scripts\course-manager-jupiter\.clasp-ai9.json'`
>   (same for `-gastronomy`; full backslash path on Windows, as in assign-sheet).
>   **Template (made by Lara 2026-11-08):** `.clasp-template.json`, pushed **last**
>   (Biology → AI9, Gastronomy → template). It was copied from Biology after commit
>   `0096237`, so it started with the in-workbook guide. Google reformatted its
>   `appsscript.json` on copy (same scopes and Drive service), so its first push needs
>   `--force`.
>   **Live (Lara, 2026-10-22):** both connected (Canvas token set, authorized), functions
>   run in each, and the legacy workbooks retired. Not yet pushed from clasp (they hold
>   the code they were copied with, which matches Git).
> - Everything below is the running log, oldest first; the decision notes for each piece
>   are there.
>
> **Running log (from 2026-10-16)**
>
> - **Built and tested in the Sheet:** `ref_Config` with its twelve `cfg_` named ranges;
>   `ref_CourseIDs` ("Refresh course list"); `ref_peopleList` ("Refresh people list");
>   token setup ("Set Canvas token", User Properties); the read-only Canvas request
>   helper `canvasGet_()` ("Test Canvas connection"); the startup check ("Check setup").
> - **Done 2026-10-17:** `ref_simpleSchedule` and `ref_gradingScale` added to
>   `SHEETS_BUILT`, so the startup check covers them (tested: "Setup OK").
> - **Reorder plan, step 1 of 4 done (read-only report, 2026-10-17):** legacy
>   `createAssignmentGroupsList` (06_DataSetup.js) and
>   `updateAssignmentPositionsFromSelectedRows` (09_MiscTools.js) reviewed. Verified
>   call per the Canvas docs: `PUT /api/v1/courses/:course_id/assignments/:id` with
>   `assignment[position]`, one call per assignment. Canvas has no documented
>   reorder-within-group endpoint. Don't send `assignment_group_id` (the legacy code did,
>   which can move an assignment to another group) or `notify_of_update`.
> - **Reorder plan, step 2 of 4 done (2026-10-17, tested: refresh count right, "Setup OK"):**
>   `ref_assignmentGroups` ("Refresh assignment groups", stamp
>   `AssignmentGroups_LastRefreshed` in J1), legacy's 7 columns, sorted by group order
>   then position; `readAssignmentGroups_()` reads it back by header name; added to
>   `SHEETS_BUILT`.
> - **Legacy reorder workflow (keep it in step 4):** Lara sorted the rows however she
>   liked, numbered the Position cells with `fillSelectedRangeSequentially`, selected
>   the rows, and pushed. She never changed groups from the sheet.
> - **Reorder plan, step 3 of 4 done (2026-10-17, tested: status, switch off/on, DRY RUN
>   log line under Executions; left ON):**
>   `canvasWrite_(method, path, payload)` in `CanvasApi.js`; sends only when Script
>   Property `DRY_RUN` is exactly "false" (unset = dry run ON). Dry-run log shows the
>   method, the path with numbers as `:id`, and field names only. Menu items "Dry run:
>   show status", "Dry run: switch on/off" (asks first, extra warning when turning off),
>   and the temporary "Test dry-run write" (runs only while dry run is ON; remove in
>   step 4).
> - **Reorder plan, step 4a done (2026-10-17, tested: Preview works in Lara's course):** tool
>   sheet `Assignment Order` (`TOOL_SHEETS.ASSIGNMENT_ORDER`), `ReorderTool.js`. Columns:
>   Group, Assignment, Due Date, Current Position (grey, read-only), New Position
>   (yellow, typed), Assignment ID, Group ID (grey; Group ID is for Lara to see only,
>   e.g. two groups with the same name; code never reads it). Menu: "Open reorder tool"
>   (refreshes `ref_assignmentGroups` first; asks before clearing typed entries; rebuilds
>   earlier layouts in place), "Number selected rows 1, 2, 3…" (legacy
>   `fillSelectedRangeSequentially`; only in the column headed New Position; counts
>   1, 2, 3… separately per group, found by Assignment ID; skips hidden/filtered rows),
>   so Lara's habit works: sort the whole sheet by Due Date, select column E, number.
>   "Preview reorder"
>   (group names, move counts, and each changing group's new order, up to 10 lines;
>   sends nothing). `planReorder_()`: a typed New Position is the exact final slot;
>   blank rows fill the remaining slots in their current order; duplicates, non-whole
>   numbers, or numbers larger than the group skip that group; group always comes from
>   `ref_assignmentGroups` by ID. Reads the whole New Position column (not the
>   selection); groups with nothing typed are never touched. Minimal moves, except when
>   an edited group's Canvas numbering is messy (duplicates or gaps, e.g. two 1s, seen
>   in Lara's course): then every assignment in that group gets 1…N in the new order,
>   also when the whole group was numbered and the order stays the same (tidy up).
>   `writeAssignmentGroupsSheet_()` now holds the refresh work (no pop-up).
> - **First 4a test (Lara):** sheet built and Preview ran. Her question exposed a bug:
>   typed numbers were mixed in with the current positions instead of taking exact
>   slots. Fixed with the exact-slot rule above, plus Due Date column and new-order
>   Preview (Lara's requests). Then: her legacy habit (sort whole sheet by due date,
>   number every row) would have produced numbers larger than each group, so numbering
>   now counts per group, and Group ID was added for visibility. Retested: Preview OK.
> - **Reorder plan, step 4b done (2026-10-17, tested: a real Push in the test course
>   reordered assignments as Lara set them up):** "Push reorder" in
>   `ReorderTool.js`: refreshes, plans from fresh data, confirms (shows dry-run state),
>   sends per group through `canvasWrite_()` (`PUT assignments/:id`, only
>   `assignment[position]`, never `notify_of_update`). A refused move (403/404/400, e.g.
>   closed grading period) stops that group only; token/network/busy errors stop the
>   whole Push. Stops starting moves after 5 minutes. One Push at a time (document
>   lock). After a real push: refresh, report "matches your order in X of Y groups";
>   rebuild the tool sheet only if all match and nothing was skipped, otherwise keep
>   the numbers (Push again only sends what is still out of place). "Test dry-run write"
>   removed. Canvas docs: closed grading periods, moderated grading, and admin-frozen
>   attributes can block assignment edits.
> - **Test course:** Lara tests writes in last quarter's "Sequence 9, AI literacy" course
>   (has students, grades, and comments; still live in Canvas; course and grades backed
>   up; nothing bad if its order gets messed up). `cfg_CourseID` stays on Sequence 9 until
>   the whole port is finished (Lara, 2026-10-17); then point it at the real course.
>   Leave dry run ON between tests.
> - **Grades:** Lara can never push grades (admin turned it off). Never build or try
>   grade writes.
> - **Menus:** reorganization deferred to the end of the build. Until then, each new
>   tool's items go at the bottom of Course Manager after a separator line, like the
>   reorder tool. Lara will say when the menu gets out of hand.
> - **`ref_gradingPeriods` shelved (2026-10-17):** nothing in the legacy code builds it;
>   its only reader, `fillGradesForSelectedGradingPeriodInActiveColumn`, pulled past
>   quarters' scores from the Canvas gradebook, which the Jupiter build doesn't need. If
>   it's needed later, build it from `GET /courses/:course/grading_periods` (keep A = ID,
>   B = title; preserve hand-typed columns such as "Grades Published" by ID).
> - **`ref_SectionLookup` done (2026-10-17, tested: periods right, "Setup OK"):** "Refresh section list"
>   (`RefSheets.js`, stamp `SectionLookup_LastRefreshed` in G1). One read-only
>   `GET /courses/:course/sections` instead of legacy's one request per section; lists
>   every section (legacy listed only sections with people). Same 4 columns as legacy:
>   Section ID, Section Name, Period (from "(P#)" in the name; Lara confirmed her names
>   use it), Section ID Copy. Sorted by period, then name; no-period sections last.
>   Added to `SHEETS_BUILT`. Readers in legacy: a tool-tab formula (MATCH period in C,
>   return A), `getPeriodNameFromId` (A → C), roster and seating-chart tools.
> - **Home tab / `ref_Index` done (2026-10-17, tested: built on open, Home formula gives
>   one column of clickable tab links; Lara is assigning the button):** `SheetIndex.js`,
>   `refreshSheetIndex` (menu item at the bottom after a separator; Lara assigns it to a
>   Home button herself). Ported from legacy `refreshIndex` (no helpers) and
>   `writeCurrentSpreadsheetIdToConfig`: same layout as legacy `*Index*` (title A1,
>   headers row 3 Sheet Name / Link / GID, data from row 4; Lara's tabs first, then
>   `ref_` tabs via the new `isSystemSheet_()` in `Config.js`); writes the workbook ID
>   into `cfg_ThisSheetID`. Runs silently in `onOpen` before the setup check (like
>   legacy). Home tab is hand-built by Lara; she'll replace the legacy
>   `=IMPORTRANGE(INDIRECT("'*Config*'!B6"), "'*Index*'!A1:ZZZ")` with
>   `=ARRAYFORMULA(IF(ref_Index!C4:C="", "", HYPERLINK("#gid=" & ref_Index!C4:C, ref_Index!A4:A)))`.
>   Buttons: Insert › Drawing, ⋮ › Assign script, type a public function name (no
>   trailing `_`); drawings don't work in the Sheets phone app.
> - **Seating chart done (2026-10-17, tested: boxes look right for Lara's test period):**
>   `SeatingChart.js`,
>   `buildSeatingChart` (menu item at the bottom after a separator; Home button). Ported
>   from legacy `createStudentTextBoxes`: same box look (first name bold 21 pt over last
>   name 15 pt, Palatino, centered, period color, sorted by last name); rows wrap at the
>   deck's real width. Lara chose: add boxes like legacy (never remove; re-running
>   doubles them; the confirm pop-up says so). Refreshes `ref_peopleList` and
>   `ref_SectionLookup` first (design rule 2), via new silent `writePeopleListSheet_()`
>   and `writeSectionLookupSheet_()`. Settings: named ranges `cfg_SeatingDeckID` (legacy
>   B7) and `cfg_SeatingPeriods` (legacy A8:C11, period | color | slide), which Lara
>   creates; the tool explains if they're missing (not in `CFG_NAMES`). New scope
>   `presentations` (Lara approved). Student names go only into her own deck (Lara
>   approved); logs and pop-ups show periods and counts only.
> - **Jupiter categories done (2026-10-17, tested: list matches Canvas, checkmarks kept
>   across reruns):** new `Jupiter.js`,
>   `refreshJupiterCategories` (same name as legacy, so a copied Config button still
>   works; menu item at the bottom after a separator). Ported from legacy
>   `refreshJupiterCategories` + `getJupiterGroupMap_`: rebuilds `cfg_JupiterCategories`
>   (G | H | I = Canvas category | Export to Jupiter? checkbox | Canvas group ID) from one
>   read-only `GET /courses/:course/assignment_groups`; keeps checkmarks by group ID, or
>   by name for rows without an ID; new groups unchecked; refuses if column I holds
>   something else; changes nothing unless Canvas returns groups. New: the summary counts
>   checked categories that dropped off. No stamp cell (Config cells stay put for now).
>   Readers still to port: `getJupiterAllowedCategories_` in the two Jupiter export tools.
> - **`ref_Config` finished (2026-10-17):** Lara is hiding it. Still on it but unused:
>   legacy B2 (old base URL), Period Pairs F2:F5 (open question), Encyclopedia ID B12 and
>   the column E checkboxes (dropped); tidy these when Config is rearranged at the end.
> - **Groups done (2026-10-17, tested: dry run sent nothing; real run in Sequence 9 created
>   the category and groups; reruns refused duplicates; cleaned up; dry run back ON):**
>   new `Groups.js`; same function names
>   as legacy (`clearGroupData`, `createGroupCategory`, `createGroups`) so the three
>   buttons on Lara's copied `createGroups` tab (`TOOL_SHEETS.CREATE_GROUPS`) keep
>   working; also menu items after a separator. Tab layout kept: A2 `=cfg_CourseID`
>   (display only; code reads `cfg_CourseID`), C2 category name, D2 category ID, E2 link;
>   row 4 headers "GroupID" | "Group Names", data from row 5 (columns found by header).
>   Canvas writes through `canvasWrite_()` (dry run applies): `POST
>   /courses/:course/group_categories` {name} and `POST /group_categories/:id/groups`
>   {name}. Groups are created empty (no members, no student data). New vs legacy: dry
>   run; confirm pop-ups showing course and dry-run state; Create group category refuses
>   if D2 already has an ID; Create groups skips rows with a GroupID and writes each ID as
>   it goes; refused rows listed by row number; 5-minute stop. `CANVAS_STOP_ALL_TYPES`
>   moved from `ReorderTool.js` to `CanvasApi.js` so both tools share it.
> - **createByRow step 1 (Type A) done (2026-10-17, tested: labels check, Preview, dry run,
>   two real assignments in Sequence 9 with correct dates; Lara moved Status left, which
>   is fine since columns are found by label):** new
>   `PostRows.js`. Ported from legacy `postRows`, `postSingleAssignment`,
>   `generateDescription2`. Legacy facts: `convertToUTC` was a *custom function* used by
>   sheet formulas (column O normalized the Due Time; P–R built due/unlock/lock); legacy
>   `postRows` sent P–R as-is and used midnight for unlock/lock. Lara chose: compute
>   dates in code (`buildCanvasTime_`, Sheet time zone, sent with offset e.g.
>   `-10:00`), drop the O–R formula columns and the custom function, and show the exact
>   JSON in a new **Payload** column; new **Unlock Time** / **Lock Time** columns; a
>   blank time means 11:59 PM on that date (changed 2026-10-18: a blank **Unlock** Time
>   means 12:00 AM, the start of that day; Due and Lock stay 11:59 PM; Lara's choice,
>   shared by makeAssignment). Tab `createByRow` (`TOOL_SHEETS.CREATE_BY_ROW`):
>   labels in row 3 (`CREATE_BY_ROW_LABELS`, found by label; checked before every run and
>   by "Check createByRow labels"), rows from 4; selection-based like legacy. Functions:
>   `postRows` (button name kept), `previewRows` (fills Payload/Status, never sends),
>   `checkCreateByRowLabels`. Rows with a CanvasID are skipped. Type A payload = legacy
>   fields (name, points, description, `online_upload`, published, dates). D/NQ/CQ show
>   "not built yet". Classic quizzes will keep the quiz ID in the link column (Lara: needed
>   for adding questions later). Also in this commit: `canvasApiPath_()` in `CanvasApi.js`
>   (paths starting `/api/` used as-is, for New Quizzes; untested until the NQ step).
> - **createByRow step 2 (Type D + Published column) done (2026-10-17, tested: Preview
>   JSON right; a draft discussion posted in Sequence 9 with right points and dates; rerun
>   skipped; cleaned up; dry run back ON):** Type D = graded discussion, `POST /courses/:course/discussion_topics` with
>   `title`, `message` (same description builder), `published`, and an `assignment` part
>   (`grading_type: points`, points, due/unlock/lock). Legacy sent `is_posted` (not a
>   Canvas setting; ignored by Canvas) and logged the whole request; both dropped.
>   CanvasID = the discussion's `assignment_id` (like legacy; matches Type A). New
>   optional row 3 label **Published** (`CREATE_BY_ROW_OPTIONAL_LABELS`): blank/TRUE/ticked
>   = publish, FALSE/unticked = draft; works for every type; Status/Preview say "(A,
>   draft)". Reason: Sequence 9 still has students, and Canvas's docs don't say whether
>   creating published items notifies them, so test rows can be drafts.
> - **createByRow step 3 (Type CQ) done (2026-10-17, tested in Sequence 9: worked as
>   planned; Lara added a `previewRows` button):** graded Classic
>   quiz shell, `POST /courses/:course/quizzes` with `quiz`: title, `quiz_type:
>   "assignment"`, published, due/unlock/lock. Fixed two legacy problems found in Canvas's
>   docs: legacy sent `quiz_type: "graded_assignment"` (not an allowed value) and
>   `points_possible` (not a create parameter; a Classic quiz's points come from its
>   questions). No description (like legacy; the question tool sets instructions). Canvas
>   Link = the quiz ID (Lara's choice, for the question sheet); CanvasID = the quiz's
>   `assignment_id` (docs don't promise it's returned; Status warns if not). Each request
>   now has `readLink` as well as `readId`.
> - **createByRow step 4 (Type NQ) done (2026-10-17, tested in Sequence 9: right points,
>   dates, instructions; CanvasID and built link work; Canvas creates New Quizzes
>   UNPUBLISHED by default):** New Quiz,
>   `POST /api/quiz/v1/courses/:course/quizzes` (first real use of `canvasApiPath_`) with
>   `quiz`: title, `points_possible` (must be above 0; else "Not ready"), `grading_type:
>   points`, `instructions` (description builder; Lara's choice), due/unlock/lock.
>   Per the New Quizzes docs: no `quiz_type` (legacy sent one), no `published` setting
>   (Lara chose to leave Canvas's default; rows with Published FALSE say "(NQ, Published
>   ignored)"), and the response has `id` (= the assignment ID) but no `assignment_id` or
>   `html_url`, so legacy likely left CanvasID/link blank. Now CanvasID = `id`; Canvas
>   Link = `<base>/courses/:course/assignments/:id`.
> - **Published column, in practice:** a CQ test row published because the tab had no
>   Published column (blank = publish, by design, to match legacy for A/D). Lara chose to
>   add a Published column filled with checkboxes: new checkboxes start unticked = draft,
>   ticked = publish, so each row is chosen explicitly. A cell with no checkbox still
>   means publish; offered to make blank = draft too (one-line change) if she wants.
>   **Changed 2026-10-23 (Lara): only a ticked box (or TRUE) publishes**; unticked, FALSE,
>   blank, or no Published column = draft, in createByRow **and** makeAssignment
>   (`parsePublished_`, shared). Status labels (`publishLabel_`, shared): "A, draft" etc.;
>   NQ always "NQ, draft" (Canvas starts New Quizzes unpublished), or "NQ, draft
>   (Published ignored)" when ticked. Lara is moving createByRow's Published column out of
>   N to where she can see it (fine: columns are found by row 3 label). Built, not yet
>   tested in the Sheet.
>   Lara has added the Published checkbox column to `createByRow`.
> - **makeAssignment redesign: decisions so far (2026-10-17, nothing built yet).** Legacy
>   (03a/03b/03c) had one tab per type with fixed cells (row 3 main item, F4/H4/H5
>   description bits, rows 7–11 overrides, K–O `convertToUTC`/JSON formulas, F1 edit
>   "anchor", CQ questions from row 15). Lara uses these tabs only to **create items that
>   need overrides** (createByRow covers the rest), so:
>   - **Creation only.** Don't port load/edit/update (`fetchAssignment`,
>     `updateAssignmentInCanvas`, F1 anchor, `populateEditSheetWithAssignmentData`). Could
>     come back later as a separate tool if wanted.
>   - **Any number of copies, never a tab name (Lara, 2026-10-18).** Lara keeps several
>     copies with different names and per-copy defaults (e.g. an AI reading quiz copy with
>     `online_text_entry`; a prelab copy whose Lock Time is a formula, Due + 5 minutes).
>     Every button/menu item works on **the tab being viewed**, recognized by its tables'
>     labels; stop with a clear message if the Item table isn't there. A Questions table
>     turns on the CQ features (no separate CQ tab name). Read each copy's defaults from
>     its cells; never overwrite them (Clear's exact keep-list is decided in that step).
>     Replaces the earlier "two tabs" idea.
>   - **Buttons keep their legacy names:** `makeAssignmentAll` (create item + overrides),
>     `clearCreationIDs` (clear for the next assignment), `createDropdowns1` (time
>     dropdowns); plus a new `previewAssignment` (fill Payloads, send nothing).
>   - **`createDropdowns1` (2026-10-18):** dropdowns only on the Overrides table's **Due
>     Time** cells. Choices: Period Start/End for that row's period on that date (from
>     `ref_simpleSchedule`: date in column C, column I is JSON like
>     `[{"period":"1","start":815,"end":925}, …]`; match the date in the Sheet's time zone)
>     plus School Start / School End / After School / Night from the `cfg_Time…` ranges.
>     Write every choice as "Label (0815)" (the 09 `formatTime` that pads to 4 digits, not
>     the 01 "8:15 AM" one), which `parseSheetTime_` reads. **Typed times are allowed**
>     (warning only), so formulas like the prelab Lock Time still work. An override row's
>     Period cell always holds one period (no "1,2").
>   - **Label-based mini-tables, not named ranges** (named ranges are workbook-wide, so two
>     tabs would need ~50 prefixed names). Each table is found by its first label, so tables
>     can sit anywhere and repeat labels like "Due Date". Proposed: **Item** (Type, name,
>     points_possible, Submission Types, Due/Unlock/Lock Date+Time, Published, CanvasID,
>     Canvas Link, Payload, Status); **Description** (Description Text, Doc Link, Link Text;
>     replaces F4/H4/H5); **Overrides** (Period, Due/Unlock/Lock Date+Time, Override ID,
>     Payload, Status; Period → section in code from `ref_SectionLookup`, refreshed first);
>     **Questions** (CQ only, later). Extra display columns (e.g. Schedule) are fine.
>   - **Lara's layout (final, 2026-10-18; supersedes the "Proposed" tables above).** Labels
>     are matched by name, so positions below are only where Lara put them:
>     - **Item**, two label rows read as one table (Lara keeps it narrow on purpose).
>       Row 3: `canvasID`, `name`, `points_possible`, `Due Date`, `Schedule` (display),
>       `Due Time`, `Unlock At`, `Unlock Time`, `Lock At`, `Lock Time`; values in row 4.
>       Row 6: `Canvas URL`, `Type of Submission`, `Type`, `Published` (checkbox),
>       `Google Link Text:`, `Document URL:`, `Instructions:`, `Status`, `Payload`; values
>       in row 7. (Description table = Google Link Text / Document URL / Instructions.)
>     - **Overrides**, labels in row 11: `OverrideID`, `Section ID`, `Period`, `Due Date`,
>       `Schedule` (display), `Due Time`, `Unlock At`, `Unlock Time`, `Lock At`, `Lock Time`,
>       `Status`, `Payload`; 6 rows (12–17). Rows with no Section ID and no Due Date are
>       skipped.
>     - **Code reads `Section ID`, not Period** (changed from "Period → section in code").
>       Lara's sheet fills it with a lookup from Period (`ref_SectionLookup`) so she can see
>       it, and she types over it for a small special section (one or a few students).
>       Period is still used for the Due Time dropdown choices.
>     - **Get Times dropdowns: Overrides Due Time only.** The Item's Due Time (row 4) gets
>       none (Lara, 2026-10-18).
>     - Buttons on the tab: Clear IDs (`clearCreationIDs`), Preview (`previewAssignment`),
>       Get Times (`createDropdowns1`), makeAll (`makeAssignmentAll`); to test live later.
>     - Duplicate labels in a table stop the run with a clear message.
>   - **Step 1 (label check) done (2026-10-18, tested on Lara's makeAssignment tab: all
>     three tables found, override rows 12–17, Schedule shown as not used):** new `MakeAssignment.js` with `checkMakeAssignmentLabels` (menu:
>     "Check makeAssignment labels (this tab)"). Reads the label grid of the tab being
>     viewed; each table's labels are every non-blank cell right of its first label (blank
>     cells skipped, because a merged "Instructions:" reads blank past its first cell).
>     Override rows run from below the OverrideID labels to the tab's last used row.
>     Labels match exactly, including capitals and colons. Offline check:
>     `scripts/checks/make-assignment.check.js`.
>   - **Step 2a (Preview) done (2026-10-18, tested on Lara's tab: item A draft with
>     `online_text_entry, online_upload`; two overrides with Night (2200) = 22:00):** `previewAssignment` (button + menu "Preview assignment (this tab)") fills
>     the item's and each override's Payload/Status; never sends. Item planned with
>     createByRow's builders; **Type of Submission** (multi-choice, comma-separated) sets
>     `submission_types` for Type A only (blank → `online_upload`; unknown values → Not
>     ready); `assignmentPayload_` now takes `fields.submissionTypes` (createByRow
>     unchanged). An item with a canvasID isn't created again: only overrides without an
>     OverrideID are planned (lets Lara add an override later). Override row: needs a
>     numeric Section ID and a Due Date; a section used twice is Not ready (Canvas allows
>     one override per section); payload `assignment_override` with `course_section_id`
>     and due/unlock/lock (blank dates left out).
>   - **Step 2b (makeAll) done for all four types (2026-10-18, Lara approved the writes; real build
>     of a Type A item + overrides in Sequence 9 worked; then D, CQ (Classic quiz, quiz ID
>     in Canvas URL), and NQ (New Quiz) with overrides also worked. One earlier CQ test
>     seemed to make a New Quiz although Preview's Payload was the Classic request
>     (`quiz_type: "assignment"`, sent to the Classic endpoint); Lara couldn't reproduce
>     it, cause unknown. If it happens again, check Status/canvasID/Canvas URL first (a
>     leftover canvasID means only overrides were sent), then try createByRow CQ in the
>     same course; if Canvas itself converts Classic to New Quizzes, ask school IT):** `makeAssignmentAll` (makeAll button + menu). Asks
>     first (course, counts, dry-run state). Sends through `canvasWrite_`: (1) the item,
>     same request as createByRow, unless canvasID is filled; writes canvasID, Canvas URL,
>     Status; (2) each ready override, `POST /courses/:course/assignments/:id/overrides`;
>     writes OverrideID, Status. Item not created → no overrides sent. One override
>     refused → others still go. Token/network-type errors stop everything. Create only;
>     never updates or deletes. Logic in `runMakeAssignment_` (tested with a fake Canvas).
>   - **Get Times (`createDropdowns1`) done (2026-10-18, built before makeAll's real
>     test at Lara's request; tested on Lara's tab):** on every
>     override row, Due Time gets a dropdown: "Period Start (0815)" / "Period End (0925)"
>     (legacy wording) when the row's Period and Due Date are found in
>     `ref_simpleSchedule`, then School Start / School End / After School / Night from
>     `cfg_Time…` (padded to 4 digits). `setAllowInvalid(true)`: typed times get a warning
>     only. Rule only; cell values are never changed. Toast lists rows whose Period/date
>     wasn't in the schedule. Item Due Time untouched (an old rule there stays until Lara
>     removes it in Data › Data validation).
>   - **Step 3 (CQ questions) done (2026-10-18, Lara approved the question POSTs; real
>     test: a Classic quiz with its questions created in Sequence 9, "work fine"):** new `QuizQuestions.js`. Optional
>     **Questions** table (first label `Question Type`; also `Notes (Ignored)` (not read),
>     `Points`, `Question`, `Answer`, `Opt 1`–`Opt 5`, `Status`, `Payload`, `QuestionID`),
>     rows from below the labels to the end of the tab. Lara's decisions: four types only
>     (`multiple_choice_question`, `multiple_answers_question`, `true_false_question`,
>     `essay_question`; full names in a dropdown); Answer = option number(s) (`2`,
>     `1,3`) or True/False; a row with a blank **Question** is skipped silently (a default
>     type in column A alone is not a question); no `question_name` sent ("Notes" column
>     stays the user's). makeAll sends questions after the overrides, Type CQ only, to
>     `POST /courses/:course/quizzes/:quiz/questions`; Preview and Clear IDs cover them.
>     Stops cleanly near the 6-minute limit (rerun continues; sent rows have IDs).
>     **Instructions:** the CQ create request now includes `description` (legacy sent a
>     second PUT; dropped). **CQ Canvas URL / Canvas Link is now the quiz's real link**
>     in both tools (Lara, 2026-10-18; was the bare quiz ID); the quiz ID is read from the
>     link (`quizIdFromLink_`), so the tab needs no Quiz ID cell. Overrides now end above
>     the next table's labels or a row whose OverrideID cell holds words (the "Questions"
>     title in A20), so Clear IDs never erases the title.
>   - **NQ questions done (2026-10-18, Lara approved the item POSTs; real test: two
>     multiple-choice questions added to an existing New Quiz in Sequence 9, "works", so
>     `item_body` is accepted for choices; first try ran on the old code before the push
>     landed):** same Questions table and four type names; on a
>     Type NQ tab makeAll sends each row to the New Quiz Items API (below) after the
>     overrides. Lara's choices: multiple answers = partial credit (`PartialScore`); 0
>     Points = Not ready (NQ requires above 0). Essays use the documented default
>     settings, no grading notes. QuestionID = the item's top-level `id`. The quiz ID is
>     the NQ's canvasID. Later test (same day): all four question types work on NQ
>     (Lara checked in Canvas). Quiz-total behavior not specifically recorded.
>   - **New Quiz Items API (checked 2026-10-18):**
>     Canvas's New Quiz Items API: `POST /api/quiz/v1/courses/:course/quizzes/:assignment_id/items`
>     (the NQ's canvasID). Each item: `entry_type: "Item"`, `points_possible` (must be
>     above 0), and an `entry` with `item_body` (HTML), `interaction_type_slug`
>     (`choice`, `multi-answer`, `true-false`, `essay`), `interaction_data` (choices as
>     `{id: UUID, position, item_body}`; T/F labels; essay settings), `scoring_data`
>     (correct choice UUID(s), true/false, or essay grading notes), `scoring_algorithm`
>     (`Equivalence`; `AllOrNothing`/`PartialScore` for multi-answer; `None` for essay).
>     Choices need UUIDs (`Utilities.getUuid()`). The docs show both `itemBody` and
>     `item_body` for choices: test which Canvas accepts. Legacy had no NQ questions.
>   - **Clear IDs (`clearCreationIDs`) done (2026-10-18, tested on Lara's tab):** Lara's keep-list decision: clear the item's canvasID, Canvas
>     URL, Status, Payload and every override row's OverrideID, Status, Payload (legacy
>     cleared only the IDs); keep everything else (name, dates, the copy's defaults and
>     formulas). Asks Yes/No only if an ID is filled in. Sheet only; Canvas unchanged.
>   - **Dates in code** (same as createByRow), with Payload/Status per item and override.
>     Reuse createByRow's request builders for the four types.
>   - **No course ID on the tab** (code uses `cfg_CourseID`); optional `=cfg_CourseName`
>     display so Lara can see which course she's creating in.
>   - Duplicate protection like createByRow: a CanvasID means "already created"; Clear
>     starts fresh.
>   - **Build order:** (1) layout + label check; (2) create item + overrides for A, D, NQ,
>     CQ with Preview and dry run; (3) CQ questions + instructions; (4) Clear/reset.
>   - **Description style: decided 2026-10-23 (Lara): the green-button style for both
>     tools** (built in `buildDescription_`, PostRows.js; not yet tested in Canvas). From
>     legacy `generateDescription`: directions bold, dark gray, 1.1em, line breaks kept;
>     a green (`#5d783e`) "🚀 label" button for **every** link (Lara: Google Docs too;
>     legacy gave Docs a plain link); Google Doc/Drive links also get the full-width
>     preview below (`/edit` or `/view` → `/preview`). Blank link text → "Open
>     Resource". Nothing at all when directions and link are both blank (legacy's "see the
>     assignment title" fallback dropped). Applies to A, D, NQ instructions, and CQ
>     descriptions in createByRow and makeAssignment.
>   - Legacy quirks to avoid: types read dates differently (NQ always midnight); descriptions
>     differ by type (D had none); legacy CQ wrote the quiz ID into O3, over the update
>     formula; no dry run; errors often only logged.
> - **Jupiter export (2026-10-18, tested in the Biology course: CreateRoster "works fine";
>   Update Grades filled JupiterExport and "looks fine"; the paste into Jupiter is a
>   plain text copy/paste, so Lara expects it to work and will report back once the new
>   quarter has work to grade).**
>   Lara's workflow: on her grading sheet (tab "Comments": A1 "Last Jupiter Sync:", B1
>   the stamp; row 2 labels; students from row 3; hidden C, D, F–I; Average/% rows below,
>   kept by hand) she clicks **CreateRoster** (`createActiveSheetRoster`) once per class,
>   types Jupiter IDs into **F** from a Jupiter export, then uses **Update Grades**
>   (`buildJupiterExportFromRecentCanvasGrades`) to fill **JupiterExport** (Jupiter's
>   template: instructions rows 1–3, `Class:` row 6, `Assignment:`, `Date:`, `Possible:`,
>   `Score:`/`Comment:` row 10, students "Name (JupiterID)" from row 11), then **copies
>   and pastes** it into Jupiter by hand (Jupiter takes a text paste, not a file upload). Both tabs were copied into the new workbook.
>   Decisions (first version; since 2026-10-21 later runs keep whole rows lined up, see
>   "CreateRoster keeps rows lined up" below): CreateRoster writes **only A–E** (User ID, Name, Period, Section Name,
>   Email) from ref_peopleList + ref_SectionLookup; never touches F, other columns,
>   formatting, or Average rows (asks if the roster would cover one; clears A–E only on
>   old student rows past the new roster); ends with a **reminder to check the Jupiter IDs
>   in F**, which don't move with the roster (legacy cleared A–J, values and formatting).
>   Update Grades sends Canvas's **final score** (after any late penalty; legacy sent
>   `entered_score`, the score before it; Lara doesn't use Canvas late penalties now);
>   excused/ungraded stay blank; only student rows with a numeric "(ID)" count; the alert
>   counts JupiterExport students with no match in F. Reads Canvas only (no writes, so dry
>   run doesn't apply); no new permissions. Offline check: `scripts/checks/jupiter-export.check.js`.
> - **Rubric export (2026-10-18, tested: exported from Lara's template tab and imported
>   into Canvas, "worked great"; she put a button on the template tab).**
>   New `Rubrics.js`: `exportRubricToCanvasFormat` (legacy name; menu "Export rubric for
>   Canvas (this tab)"). Lara's decisions: **CSV import, not a direct Canvas write**
>   (no write code; she reviews, then Canvas › Rubrics › Import; a direct "create and
>   attach to assignment" could come later with its own plan); **copy-a-template-tab**
>   workflow, so legacy `setupRubricUI` is not ported (it never ran: its Yes check
>   compared against ButtonSet); an **empty criterion is skipped silently**. Reads labels
>   in column A of the tab being viewed: "Rubric Title" (title in the cell below),
>   "Criterion Description" (names in the row above), "Rating N Name/Description/
>   Points". All criteria columns and rating groups, with rating descriptions (legacy
>   read fixed cells that don't match the template). Problems (rating with no points,
>   points with no name, ratings with no criterion name) stop it with cell names; the
>   export tab is then unchanged. Writes `rubricCanvasExport` (Rubric Name, Criteria
>   Name, Criteria Description, Criteria Enable Range = FALSE, then Rating Name/
>   Description/Points per rating). Lara is reviving rubrics to use Canvas's built-in
>   grading. Offline check: `scripts/checks/rubric.check.js`.
> - **Menus rebuilt (2026-10-18, pushed to Google; Lara: "the menus look fine").** Lara's decisions:
>   **two menus** (like legacy's "Canvas Tools" / "Setup & Admin"): **Canvas Tools**
>   (🏠 Go to Home page; Create in Canvas; Assignment order; Groups; Rubrics; Jupiter;
>   Build seating chart) and **Setup & Data** (Refresh all tables; each refresh; Refresh
>   Jupiter categories, kept separate and manual; Setup & safety: token, connection, dry
>   run, Check setup, the two label checks). The Home page buttons stay the everyday way
>   in. New `Menus.js` builds both (onOpen calls `buildMenus_()`); the twelve per-file
>   `add…MenuItems_` helpers were removed. **Refresh all tables** = course list, people
>   list, assignment groups, section list, sheet index (not Jupiter categories); one
>   failing doesn't stop the rest; one summary. `refreshCourseList`'s work moved into
>   `writeCourseListSheet_` (same behavior) so it can be shared. **Go to Home page**
>   finds the tab whose name is "Home" ignoring emoji ("🏠 Home"). Function names
>   unchanged, so buttons keep working. Offline check `scripts/checks/menus.check.js`
>   also confirms every menu item names a real function.
> - **Field test (from 2026-10-18):** Lara considers the port ready for a full field
>   test in real use (`cfg_CourseID` on Biology; dry run ON except when deliberately
>   creating items). She will report anything that fails; start any fix by asking what
>   she clicked and the exact message (no student data). Everything on this Mac, GitHub,
>   and Google matched at the end of 2026-10-18.
> - **Template archive (2026-10-18).** Lara is copying this workbook (File › Make a
>   copy) as a template archive and keeps using the **original** for Biology. Facts:
>   the copy gets its **own** bound script; **clasp stays linked to the original**
>   (`.clasp.json`), so the archive freezes at that day's code. No **libraries** (shut
>   off by school admin), so every workbook carries its own copy of the code. The copy
>   has no Canvas token (User Properties are per user per script) and dry run counts as
>   ON when unset. In the **archive only**, clear student data (ref_peopleList; Comments
>   student rows A–F and score/comment columns; JupiterExport student rows; any group or
>   seating lists) and blank `cfg_CourseID` (or set it to Sequence 9). Don't share the
>   copy with the same people. Hand-typed Home links may hold the original workbook's
>   full address; the ref_Index links are relative (`#gid=`), so they're fine.
> - **Other courses (proposed 2026-10-18, not decided):** Biology runs on the new code
>   first; Sequence 9 (new quarter) and Gastronomy stay on the old code for now and move
>   over in the next several weeks. Proposal: **one workbook per course**, each a copy of
>   the current workbook (student data cleared, `cfg_CourseID` set, tables refreshed,
>   course tabs such as makeAssignment copies and rubric templates brought over), and
>   **one code folder in Git pushed to every workbook's script** (one clasp target per
>   workbook; the exact clasp setup to be checked when built). Changes go to Biology
>   first, then to the others after Lara's OK. Each workbook needs Set Canvas token once
>   and its own authorization. Retire each old legacy workbook (keep as archive) once its
>   course is live on the new one, so two workbooks never write to the same course.
> - **CreateRoster keeps rows lined up: done (2026-10-21, commit 193413a; pushed to
>   Google and tested by Lara on a copy of the Biology Comments tab, "worked perfectly
>   on all counts"):** no-change rerun; pretend dropped row highlighted, No changed
>   nothing, Yes deleted it; a deleted student came back in sorted place with F blank;
>   new row's formatting matched. For multi-section sheets made by the old code (sorted
>   by name only), Lara chose to **re-sort once by Period, then name** rather than have
>   the tool recognize name-only order; until then, new students go after the last
>   student in their period. Planning notes below kept for the record.
> - **Planned (2026-10-20): CreateRoster keeps rows lined up.** Problem:
>   CreateRoster rewrites A–E sorted by name and leaves F onward (Jupiter IDs, test
>   scores) in place, so after an add or drop the other columns no longer match the names.
>   Since it now always refreshes first, a rerun picks up every enrollment change. Lara's
>   chosen approach: match students by Canvas User ID in A; existing students keep their
>   whole row (A–E refreshed in place); each new student gets a **whole inserted row** in
>   alphabetical position (all columns move together); first run on an empty sheet
>   unchanged; pop-up gives counts and row numbers only.
>   **Decided 2026-10-21 (building):** sort order is **Period, then name** (first run
>   too), which equals name order in a one-section course. **Dropped students' whole rows
>   are deleted** (Canvas keeps their records; the sheet's Jupiter ID, scores, and
>   comments for them go). Before deleting, the tool **highlights those rows and scrolls
>   to them**, then asks Yes/No giving row numbers only, so Lara sees the names in the
>   sheet, never in the message (her choice over names in the pop-up). No = nothing
>   changes and the highlight comes off. **Safety stop:** if more than half of the
>   sheet's students would be deleted, change nothing and say why (guards against a
>   short list from Canvas). New student: if the rows are in Period-then-name order,
>   insert in place; otherwise after the last student with the same period; otherwise
>   after the last student. A student who **changed period** is refreshed in place and
>   the final pop-up gives the row number with a suggestion to resort (the row is not
>   moved). The same User ID twice on the sheet stops the tool. Average formulas: not a
>   concern (Lara adds them by hand when wanted).
>   Build with offline checks (made-up students), then test on a **copy** of the Comments
>   tab. Low urgency in Biology this year.
> - **Next:** fixes from the field test; Lara reports on the first real Jupiter paste;
>   other tools from Lara's
>   Decision column in `docs/legacy-function-map.md`. Buttons on the Assignment Order
>   tab: not needed for now (Lara, 2026-10-21). (Done 2026-10-21: Lara added a Home
>   button assigned to `refreshAllTables`; no code change.)
> - **Legacy review finished (2026-10-20):** every legacy function now has a decision
>   (see `docs/still-in-legacy.md`). Left behind: API Batch runner, grade PDFs (Jupiter's
>   reports replace them), unused helpers. Later, if needed: email tools (wait and see),
>   comment posting + read scores into a column + assignment dropdowns (only if
>   commenting moves into Canvas).
> - **CreateRoster refreshes first (2026-10-20, pushed to Google and tested by Lara in
>   Biology: on the grading sheet and from the menu on a blank sheet, data right; a blank
>   sheet gets no formatting, as expected):** it now refreshes
>   ref_peopleList and ref_SectionLookup before building the roster (design rule 2), like
>   the seating chart, so adds and drops are included. Same read-only requests; no new
>   permissions. Found while checking which tables could go stale. Lara chose this over
>   an onOpen "last refreshed" reminder (onOpen can't contact Canvas; she doesn't want
>   installable or timed triggers that other users would have to set up). Every tool that
>   reads a Canvas-built table now refreshes it first, except sheet formulas (the
>   makeAssignment Section ID lookup and `cfg_CourseName`).
> - **Open questions:**
>   - **Course check: v1 built and tested (2026-10-21, commit 06253f9; pushed to Google;
>     Lara ran it on Biology: "everything seemed to work").** **"OK as is" built and
>     tested (2026-10-21, commit bbe47e5; pushed; Lara: "all the tests look fine"):** a
>     checkbox column. A tick is remembered across runs by a hidden key (check +
>     assignment ID + due date; Jupiter line: check + group ID), so a changed date or a
>     new problem shows again; ticked rows go to the bottom in gray and are counted
>     separately. No "fixed" status: a fixed problem drops off on the next run. New
>     terms' course copies get new assignment IDs, so old ticks drop off by themselves.
>     Only the ticks are kept; other typing on the tab is replaced each run. The Jupiter
>     line's key leaves out the assignment count on purpose (a tick means "this group
>     isn't for Jupiter"), so a ticked group stays ticked as the count changes.
>   - **Course check report (idea 2026-10-20; decided 2026-10-21):** a
>     read-only report of likely course-setup mistakes. **Lives in course-manager-jupiter**
>     (both Jupiter courses, Biology and Gastronomy, need the Jupiter check; this is
>     where Lara makes the Canvas items). **First version, five checks:** missing due
>     dates; unpublished items; due dates on no-school days; due dates outside the term
>     (catches dates left from last term's course copy); assignments in groups not
>     checked for Jupiter (skipped when a course has no Jupiter categories checked, e.g.
>     AI9). **Runs:** its own menu item/button, and a short summary after Refresh
>     assignment groups (alone or via Refresh all tables). Not onOpen (can't contact
>     Canvas without an installable trigger, design rule 4). Override-typo checks left
>     out (no overrides this year). Lara's term setup: copy last term's content into a
>     sandbox, which is copied into the school shell (students from the SIS); then fill
>     the assignment sheet and rosters, make Canvas items with Course Manager, and copy
>     links into the assignment sheet. Plan: test on Biology, then move AI9 and
>     Gastronomy to this code.
>     **Details decided 2026-10-21:** report everything; Lara ignores exceptions, so no
>     clever filtering. **Term** = the quarters in a new optional setting
>     `cfg_TermQuarters` (e.g. `2` for AI9, `1-2` Gastronomy S1, `1-4` Biology), dated from
>     `ref_simpleSchedule` column A (quarter number; column B is the week; a "5" row is next
>     year's first day); blank or missing → Canvas term dates (a quarter course shows the
>     semester's). **No-school day** = a date not in `ref_simpleSchedule` (weekends,
>     breaks) or with Schedule (column E) `H` or `PD`; checked only inside the schedule's
>     date range. Column I (periods JSON) is empty on many real school days (chapel, exams,
>     Class Day), so it is not used. **Weekends flagged.** **All unpublished items
>     flagged.** **Jupiter check:** one line per unchecked group with point-earning
>     assignments. **Tab:** `Course Check`.
>     **Second pass (ideas, not in v1):** something due right after a **No Homework
>     Weekend** (`ref_simpleSchedule` column G); no **tests or major papers due on SAC
>     review days** (if the schedule lists them; how to spot "test or major paper" TBD).
>     Lara's plan (2026-10-21): mark **SAC days** in column G of the schedule.
>     ref_simpleSchedule is an IMPORTRANGE of the master calendar, so the marks go in the
>     master calendar, not in the workbook tab. **Update (2026-10-21):** the one known SAC
>     day (Q2) is now in the master calendar. **Departmental Project days dropped**
>     (not official, and no class uses them: Biology and Gastronomy give finals in final
>     exam week). **Built and tested (2026-10-21, commit 155e8c5; pushed; Lara: both
>     tests worked and showed on Course Check; Course check opens its tab even if it was
>     hidden).** (1) **SAC review day:** a schedule day whose
>     column G contains "SAC Review Day" (any case); flag anything worth **50+ points**
>     due that day. (2) **After No Homework Weekend:** column G contains "No Homework
>     Weekend" on the last school days before the break; flag **anything** due on the
>     first school day after it (the next school day that isn't itself marked, H, PD,
>     or a weekend), whether or not that class meets that day. AI9 (pass/fail, no
>     homework) is a structural exception: Lara ticks its rows "OK as is"; no setting.
>   - **Naming (2026-10-21):** "Sequence 9: AI and Media Literacy" is called **AI9** from
>     now on (older notes say "Sequence 9"; same course).
>   - **Jupiter comments: shelved (Lara, 2026-10-21).** Lara will write comments in
>     the Sheet and post them to Canvas with the comment tool being brought back (see
>     "Next up"), which is cleaner. The blank-cell test below isn't needed for now.
>     Earlier note, kept for reference: Update Grades
>     clears JupiterExport, Comment columns included, so a rerun (e.g. for late work)
>     brings back every score but leaves earlier typed comments blank. Unknown: does a
>     blank Comment cell pasted into Jupiter erase a comment already there? Test with
>     one student who has a Jupiter comment and a blank cell. If blanks are ignored:
>     nothing to do. If they erase: either make Update Grades keep typed comments
>     (matched by assignment and Jupiter ID), or move commenting into Canvas (port the
>     comment tools; Update Grades also pulls comments). For now Lara keeps comments
>     out of Jupiter except tests, which are curved by hand and not sent by this tool.
>   - Assignment ID vs. the ID in the Canvas URL: **closed (2026-10-21).** The reorder
>     tool uses `assignment.id` and was tested with a real Push; nothing has gone wrong
>     since. Lara will report it if it comes up again.
>   - Time dropdowns: answered. The values read back are "Label (0815)" (the 09
>     `formatTime` copy ran); `parseSheetTime_` reads them. See `createDropdowns1` above.
>   - What are Period Pairs for? (Seating chart: yes, Lara uses it; ported.)
>   - Should reference sheets be hidden automatically when built? **Yes (Lara,
>     2026-10-21); built and tested (commit b95e121; pushed; Lara: "tests are clean").**
>     A ref_Index link to a hidden tab gets Google's own "hidden" message with an
>     Unhide option, which Lara is fine with, so no "(hidden)" label. The four Canvas-built tabs (ref_CourseIDs,
>     ref_peopleList, ref_assignmentGroups, ref_SectionLookup) are hidden after every
>     refresh unless it's the tab being viewed; creating one no longer moves you to it.
>     ref_Index stays visible (Home reads it); ref_Config, ref_simpleSchedule,
>     ref_gradingScale are not touched. No flashing into view (it would pull you off your
>     tab during CreateRoster etc.); instead Refresh all tables shows a step-by-step
>     message. Course Check updates with Refresh assignment groups, Refresh all tables,
>     and Course check, but not when the reorder tool refreshes (on purpose).
>   - Limit `script.external_request` with a `urlFetchWhitelist` for the school's
>     Canvas address? **No (Lara, 2026-10-21).**

Read this at the start of every session, together with the repo-level `CLAUDE.md`
(which always wins if the two disagree). Explain each
command in plain language before running it, and prefer small, reviewable steps.

## How Lara works

Lara set these on 2026-10-17. Follow them in every session, on any computer.

- **Explain, then ask, before every command**, even read-only ones (scan, diff, status).
  Batch related commands into one ask ("scan, offline check, and diff").
- **Plan before code.** For each new piece, show what the legacy code does, what will
  change, and (for Canvas writes) what Canvas's docs say. Wait for her OK.
- **One step at a time:** edit → (with OK) scan, offline checks, diff → her approval →
  commit + `git push` → **ask separately** before `clasp push` → she tests in the Sheet →
  record the result here ("Where we left off" and Status).
- **Show the whole diff**, including new files. Summarize in plain language: what changed,
  new Canvas writes, new Google permissions, scan results.
- **She tests everything herself** in the Sheet: dry run first, then real writes in the
  test course. Never assume a test passed; ask.
- **Test course:** "Sequence 9, AI literacy" (last quarter; backed up; students enrolled).
  Test items can be drafts (Published column) so students don't see them.
- **Live course (2026-10-18):** Lara switched `cfg_CourseID` to her **Biology** course for
  the Jupiter export (read-only tools; it has the live lessons). While it points there,
  keep **dry run ON**; switch back to Sequence 9 for any write test, then turn dry run
  back ON after each test.
- **No student data in chat.** Real names, emails, IDs, grades, and comments must not be
  pasted or screenshotted into Claude (CLAUDE.md rule 5). Describe layouts instead, or
  blur/crop student rows. Claude never repeats or records student data it sees.
- **She can never push grades** (admin setting). Don't build or attempt grade writes.
- **Offline checks** use made-up data only: `npm run check-offline`.
- **Questions:** the multiple-choice pop-up sometimes doesn't reach her; if an answer
  comes back empty, ask again in plain text.

## Switching computers (PC ↔ Mac)

1. **`git pull` first**, in the `canvas-scripts` folder, before anything else.
2. **Never `clasp push` before pulling.** An older copy would overwrite Google with old
   code. (If it happens, pull and push again.)
3. **Start the session by reading this file.** Claude Code sessions and Claude's private
   notes stay on the computer where they ran; this file travels through GitHub.
4. **Line endings:** Windows and Mac end lines differently. Since 2026-10-17 the repo's
   `.gitattributes` (`* text=auto eol=lf`) keeps LF on both computers, matching Git.
   Google's manifest was still CRLF then (pushed from the PC), so expect **one more**
   "Skipping push" about the manifest at the next `clasp push` from either computer:
   compare Google's copy first (read-only `clasp clone` into a temporary folder), then
   `clasp push --force` if the only difference is line endings. After that, a manifest
   prompt means a real manifest change (e.g. a new permission). (2026-10-18: the first
   Mac push went through with no manifest prompt, so Google's copy is LF now.)
5. Things that are the same on both computers: dry run and the Canvas token (stored in
   Google), and `cfg_CourseID` (in the Sheet).

## What this project is

A trimmed-down rebuild of the legacy `course-manager` Apps Script project, for use with
Jupiter Grades. Only the tools Lara actually uses are ported, one at a time.

- The legacy project stays intact, untouched: the `course-manager/` folder and the Git
  tag `legacy-gradebook`. Someone may still want it for the Canvas Gradebook. **Never edit
  anything under `course-manager/`.**
- The new code lives in `course-manager-jupiter/`, with its own new Google Sheet and its
  own Apps Script project (connected later with `clasp clone`, never guessed).
- Don't open the workbook or read any data from student-roster sheets. Work from the code.

## Rules specific to this project

1. **Names are exact.** Once a name appears in the table, it never changes: sheet names
   and named ranges are never renamed, shortened, or re-punctuated. Reference sheets only through one constant, e.g. `SHEETS.CONFIG`.
   (The legacy names used `*asterisks*`, which AI tools kept stripping as markdown. They
   are replaced by a `ref_` prefix.)
2. **System sheets are identified by the `ref_` prefix** through one helper
   (e.g. `isSystemSheet_()`), replacing the legacy "name starts with `*`" check.
3. **No fixed cell addresses in code.** Config values are read through named ranges
   (`cfg_...`). Formulas on sheets should use the names too.
4. **Startup check.** On open, verify that every sheet in `SHEETS` exists and every
   `cfg_` named range exists, and show a clear alert if not. Report counts, never data.
5. **Reference tabs get a red tab color** as the "be careful here" signal.
6. **Everything in `CLAUDE.md` applies**: dry-run writes, explicit `oauthScopes`,
   no student data in logs, header comment on every file, `clasp push` only after asking.

## Design rules for reference sheets

Decided with Lara on 2026-10-17. The aim: no tool depends on someone remembering to
refresh.

1. **Script-built snapshots.** Each `ref_` sheet is rebuilt by code (from Canvas, or from
   the workbook for `ref_Index`). Nobody types into them, except columns a builder is
   written to keep across refreshes (e.g. Jupiter category checkmarks).
2. **Refresh before use.** Every script tool that reads a Canvas-built `ref_` sheet
   refreshes it first. It may skip that when the sheet's `*_LastRefreshed` stamp is only a
   few minutes old, so back-to-back tools don't re-download the same list. (The reorder
   tool already refreshes on open and before Push.)
3. **Formulas that read `ref_` data** don't trigger refreshes. Put them on tool tabs whose
   tool refreshes what they need, or decide case by case when porting.
4. **Refresh on open only without Canvas.** The automatic `onOpen` can't contact Canvas
   (Google requires an installable trigger for that), so only `ref_Index` rebuilds on open.
   An installable trigger is Lara's call if one is ever needed.
5. **Manual "Refresh …" menu items stay** as a backup. They don't need Home buttons.
6. **Safe rebuilds.** Each builder checks the header row before overwriting, changes
   nothing unless Canvas answers, stamps a `*_LastRefreshed` named range, and logs counts
   only.

## Definition of done for a port

Agreed with Lara on 2026-10-17. A legacy function (or group of them) is done when:

1. **Planned first.** Before any code, Lara sees a plan: what the legacy code does (read
   it, don't guess), what changes and why, and, for any Canvas write, what Canvas's
   official docs say about that call. Her decisions are recorded in BRIEF.md.
2. **Built to the project rules.** Header comment; reads through `canvasGet_()`, writes
   through `canvasWrite_()` (so `DRY_RUN` applies) with a confirm pop-up; no student data in
   logs or messages; cells found by label or named range, not fixed addresses; menu items
   at the bottom after a separator; no new Google scope without Lara's OK.
3. **Checked.** The scan has no findings in `course-manager-jupiter`; logic that can be
   tested without Google gets an offline check with made-up data (never real data).
4. **Approved and shipped.** Lara approves the diff → commit + `git push` → Lara approves
   `clasp push` (manifest changes need `--force`; compare first if unsure).
5. **Tested by Lara.** Dry run first; real writes in the test course (Sequence 9 for now);
   clean up; dry run back ON. Then BRIEF.md ("Where we left off" and Status) says tested.
6. **Recorded in the map.** The matching row(s) in `docs/legacy-function-map.md` get a
   Decision: `ported → newName (File.js)`, `later`, or `leave behind: <one-line reason>`
   (a blank Decision means "not yet reviewed"). Then regenerate
   `docs/porting-summary.md` from the map (`npm run porting-summary`), never by hand.

## Sheet names: legacy → new

Reference sheets (hidden, mostly script-built):

| Legacy | New |
|---|---|
| `*Config*` | `ref_Config` |
| `*simpleSchedule*` | `ref_simpleSchedule` |
| `*SectionLookup*` | `ref_SectionLookup` |
| `*peopleList*` | `ref_peopleList` |
| `*assignmentGroups*` | `ref_assignmentGroups` |
| `*gradingPeriods*` | `ref_gradingPeriods` |
| `*gradingScale*` | `ref_gradingScale` |
| `*Index*` | `ref_Index` |
| `CourseIDs` | `ref_CourseIDs` |

`ref_CourseIDs` is built from Canvas by **Refresh course list** (A = course ID, B = course
name; your active teacher courses). The time of the last refresh is in the named range
`CourseIDs_LastRefreshed`. The `cfg_CourseName` formula (C4) must look up `ref_CourseIDs`.

User-facing tool sheets keep their names. Known so far: `JupiterExport`,
`rubricCanvasExport`, `API Batch` (a function checks the active sheet's name, so keep it
exactly). `Assignment Dates` is not in this workbook: it moved to assign-sheet
(2026-10-20; see `docs/still-in-legacy.md`).

## Config contents

**Keep every cell in its legacy position at first**, because sheet formulas point at
them. Add named ranges now; Lara will rearrange the layout only after everything is ported.

These twelve names match the Sheet's Named ranges panel exactly. All are on `ref_Config`.

| Name | Cell | Notes |
|---|---|---|
| `cfg_UserID` | B3 | Keep. Lara uses it in batch email and API-by-row |
| `cfg_CourseID` | B4 | Used by nearly every tool and by formulas on about 7 tool tabs |
| `cfg_CcEmail` | B5 | Keep. Same tools as `cfg_UserID` |
| `cfg_ThisSheetID` | B6 | Auto-written by the full data refresh; the Home index formula reads it |
| `cfg_MasterCalendarDocID` | D3 | Read by the `ref_simpleSchedule` formula (IMPORTRANGE) |
| `cfg_SchoolYearTab` | D5 | Same formula |
| `cfg_TimeSchoolStart` | B14 | Due-time dropdown choice, 24-hour value |
| `cfg_TimeSchoolEnd` | B15 | Due-time dropdown choice, 24-hour value |
| `cfg_TimeAfterSchool` | B16 | Due-time dropdown choice, 24-hour value |
| `cfg_TimeNight` | B17 | Due-time dropdown choice, 24-hour value |
| `cfg_JupiterCategories` | G:I | Whole columns, including the header row (G = Canvas category, H = export checkbox, I = Canvas group ID) |
| `cfg_CourseName` | C4 | Formula (lookup in `CourseIDs`), shown on tool tabs |

Other items:

- **Base URL** (legacy B2) moves to User Properties (`CANVAS_BASE_URL`), per `CLAUDE.md`.
- **Canvas token** moves to User Properties (`CANVAS_TOKEN`), per `CLAUDE.md`. The legacy
  code kept it in User Properties as `CANVAS_API_KEY`. Never in Config, never in Script
  Properties.
- **Jupiter categories** stay on `ref_Config` as `cfg_JupiterCategories` (G:I; H = Lara's
  checkboxes, I = group IDs; rebuilt from Canvas by `refreshJupiterCategories`, which
  preserves the checkmarks).
- **Seating chart** (legacy B7 and A8:C11): Lara uses it; ported. Same cells, named
  `cfg_SeatingDeckID` (B7) and `cfg_SeatingPeriods` (A8:C11).
- **Period Pairs** (legacy F2:F5). No reader found in code or formulas. Ask Lara.
- **Dropped:** Encyclopedia ID (B12) unless a Find for `Config` across the Sheet shows a
  formula using it; the column E checkboxes (nothing reads them).
- **Do not carry over** the legacy meanings of B6:B9 used by `createDropdowns()` (see below).

## Decisions on duplicated legacy functions

Legacy file load order is by file name, later copy wins (assumed from an empty
`filePushOrder`; Lara is verifying against the Apps Script editor sidebar).

- `getNextUrlLocal`: the copies are identical. Build one into the shared Canvas request
  helper's paging.
- `getPeriodNameFromId`: identical. Port the 01 copy into the shared helpers.
- `formatTime`, `getPeriodTimesForDate`: **decided 2026-10-18.** `formatTime`: port the
  09 behavior (pad to "0815"), because the values are read back as "Label (0815)" by the
  date code. `getPeriodTimesForDate`: port the 01 approach (match the date in the Sheet's
  time zone), without its missing `logToSystem()` call and without the "1,2" handling (a
  Period cell always holds one period). Port `createDropdowns1()` (01), not
  `createDropdowns()` (09).

## Build order

Do one step at a time. For each: say what you plan, make a small change, run the scan,
show a review summary, wait for approval, commit.

1. **Folder and tag** (if not already done): tag `legacy-gradebook`; this folder with a
   README. No code yet.
2. **Read-only function map** saved as `course-manager-jupiter/docs/legacy-function-map.md`:
   for every legacy function, the file, a one-line purpose, which menu item calls it (menu
   items only; Home buttons are not listed), which sheets it touches, which Canvas endpoints it calls, and whether it writes to Canvas.
   Lara marks each row *port*, *later*, or *leave behind*.
3. **Foundation**, with no features yet:
   - config accessors by named range, and the startup check;
   - a one-time menu item, **"Set my Canvas token"**, that prompts for the token and stores
     it in User Properties (`CANVAS_TOKEN`) without displaying or logging it;
   - one Canvas request helper: auth header from User Properties, `muteHttpExceptions`,
     response-code check, `per_page=100`, paging by the `Link` header, back-off on low
     `X-Rate-Limit-Remaining`;
   - `canvasWrite_()` honoring a `DRY_RUN` Script Property that defaults to `true`;
   - `appsscript.json` with explicit, narrowest-possible `oauthScopes`.
4. **Reference sheets**, one at a time, each tested on its own:
   `ref_gradingScale` (copy as is), `ref_gradingPeriods` (the old copy is stale: still
   2025-26 dates and no "Grades Published" values, so this is the first real refresh test),
   `ref_SectionLookup`, `ref_peopleList`, `ref_assignmentGroups`.
5. **Assignment reorder** as its own *visible* tool sheet. `ref_assignmentGroups` stays a
   read-only snapshot; the tool sheet shows current order, lets Lara set a new order,
   previews the changes (dry run, counts only), and then pushes through `canvasWrite_()`.
   Verify the Canvas reorder endpoint in the official API docs before writing it. Test in a
   sandbox course first. This changes ordering only, never grades.

## Status

Update this list as each piece lands. "Tested" means Lara confirmed it in the Sheet.

- **Step 1 (folder and tag):** done.
- **Step 2 (function map):** done; Lara is filling in the Decision column.
- **Step 3 (foundation):**
  - done: explicit `oauthScopes`; `SHEETS`, `SHEETS_BUILT`, `CFG_NAMES`, `getCfg_()`
    (`Config.js`); startup check and "Check setup" (`SetupCheck.js`, tested);
    "Set Canvas token" (`Credentials.js`); `canvasGet_()` and "Test Canvas connection"
    (`CanvasApi.js`).
  - `canvasWrite_()` with `DRY_RUN`, plus "Dry run: show status" and "Dry run: switch
    on/off" (`CanvasApi.js`): built and tested (dry-run path only). Nothing calls it
    for real yet; the send path is first tested with the reorder tool, in a sandbox
    course.
  - The startup check covers the sheets in `SHEETS_BUILT`, not every name in `SHEETS`,
    so unbuilt sheets don't raise alerts.
- **Step 4 (reference sheets)**, all in `RefSheets.js`:
  - `ref_CourseIDs` ("Refresh course list"; stamp `CourseIDs_LastRefreshed`): built.
  - `ref_peopleList` ("Refresh people list"; stamp `PeopleList_LastRefreshed`): built.
    Ported from legacy `createPeopleList`; same nine columns and name formulas; all
    enrollment types; `state[]=active&invited`; now follows every page (legacy read
    only the first 100).
  - `ref_simpleSchedule` (IMPORTRANGE formula) and `ref_gradingScale` (copied as is):
    in the Sheet and in `SHEETS_BUILT`; no script builds them.
  - `ref_assignmentGroups` ("Refresh assignment groups"; stamp
    `AssignmentGroups_LastRefreshed`): built and tested. Same seven columns as
    legacy `createAssignmentGroupsList`, sorted by group order then position (legacy
    sorted by name); blank section due dates are skipped when finding the latest.
  - `ref_SectionLookup` ("Refresh section list"; stamp `SectionLookup_LastRefreshed`):
    built and tested.
  - `ref_Index` ("Refresh sheet index", also on open; `SheetIndex.js`): built and tested.
  - Design rules for reference sheets: recorded (see that section).
  - Seating chart (`SeatingChart.js`, "Build seating chart"): built and tested.
  - Jupiter categories (`Jupiter.js`, "Refresh Jupiter categories"): built and tested.
  - CreateRoster (`Jupiter.js`): refreshes first, keeps rows lined up on reruns (match by
    User ID; insert/delete whole rows, delete after highlight + Yes): built and tested.
  - `ref_Config`: finished for now; hidden by Lara.
  - Groups (`Groups.js`, three `createGroups`-tab buttons): built and tested.
  - createByRow (`PostRows.js`): all four types (A, D, CQ, NQ) and the optional Published
    column built and tested.
  - Shelved: `ref_gradingPeriods` (not needed for Jupiter).
- **Step 5 (assignment reorder):** 4a (tool sheet, numbering, Preview) built and
  tested; 4b (Push) built and tested (real Push in the test course).

## Open questions to resolve before or during the steps above

- In the old `assignmentGroups` data, the "Assignment ID" column did not match the ID in
  the Canvas URL on the same row. Find out which one the reorder call needs before
  step 5, and why they differ.
- What consumes the time-dropdown values (see duplicates above)?
- What are Period Pairs for? (Seating chart: Lara uses it; ported.)
