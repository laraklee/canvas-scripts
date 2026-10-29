# Course Manager (Jupiter edition) — User Guide

**Draft.** Written for teachers new to the workbook; not yet tried by one. If a step
doesn't match what you see, note where and what you saw.

This workbook connects a Google Sheet to one Canvas course. It can:

- **create** assignments, discussions, quizzes, section dates (overrides), and groups;
- **reorder** assignments;
- **pull scores and post comments** for one assignment;
- **export grades** for Jupiter;
- **back up** course content to Google Docs;
- **report** on a Classic quiz, check the course for setup mistakes, build rubrics for
  Canvas to import, and build a seating chart.

It **never changes grades** in Canvas and **never deletes** anything there.

---

## 1. First-time setup

### Your own copy

Each course gets its own copy of the workbook (**File › Make a copy**). The scripts come
with the copy. On **ref_Config**, set:

| Named cell | What goes there |
|---|---|
| `cfg_CourseID` | The Canvas course number: the digits after `/courses/` in the course's web address. **Every tool works on this course.** |
| `cfg_UserID` | Your Canvas user ID. In your course, open **People** and click your own name; the web address ends in your ID (`.../users/5678` → 5678). |
| `cfg_CcEmail` | An email address to copy on messages. |
| `cfg_MasterCalendarDocID`, `cfg_SchoolYearTab` | The school master calendar and this year's tab (used for schedules, times, and Course check). |
| `cfg_TermQuarters` | The quarters this course covers: `2`, `1-2`, or `1-4`. Update it each new term. |

The tab is laid out the same way as the *Config* tab in the Assignment sheet.

### Each teacher, each workbook

1. Open the workbook. Google asks you to **authorize** the script (see "Permissions"
   below). Review and allow.
2. **Setup & Data › Setup & safety › Set Canvas token.** Enter the school's Canvas
   address, then paste your own Canvas token. Both are saved for **you only**; other
   editors can't see them. (Make a token in Canvas: **Account › Settings › Approved
   Integrations › + New Access Token**. Canvas shows it only once.)
3. **Setup & Data › Setup & safety › Test Canvas connection.** It should say
   **Connected**.
4. On **ref_Config**, check `cfg_CourseID` is the course you mean to work in.
5. **Setup & Data › Refresh all tables.** You should see a ✓ for each table.
6. **Setup & Data › Setup & safety › Check setup.** It should say the setup is OK.

### Permissions

Google lists what the script may do. It asks to:

- see and edit **this spreadsheet only**;
- show menus and pop-up boxes;
- connect to an external service (Canvas);
- edit **Google Slides** (only used by Build seating chart);
- see and make **only the Drive files it creates itself** (Export to Google Docs). It
  can't see your other files.

### Safety rules

- **Dry run** (**Setup & Data › Setup & safety › Dry run: show status / switch
  on/off**): while it's **ON**, tools that would change Canvas only show what they
  *would* send. A new copy starts with dry run ON. Turn it OFF only when you mean to
  create things, and back ON afterward. It's one setting for the whole workbook, not
  per teacher.
- **Check the course.** Every tool works on `cfg_CourseID`. Try new things in a test
  course first.
- **Preview first.** Tools that create things have a Preview: it fills **Payload** (what
  would be sent) and **Status** without sending anything.
- **Every tool that changes Canvas asks Yes/No first**, and says which course and
  whether dry run is on.
- **Student privacy.** Never paste or screenshot student names, emails, IDs, grades, or
  comments into an AI tool or email when asking for help. Describe the layout instead.

---

## 2. Where things are

- **🏠 Home tab:** buttons for the everyday tools. **Canvas Tools › 🏠 Go to Home page**
  jumps there from anywhere.
- **Canvas Tools menu:** everything that *does* something.
- **Setup & Data menu:** refreshing reference tables, Jupiter categories, token, dry
  run, and checks.
- **ref_ tabs** (red): reference tables the tools read. Refresh them; don't edit them.
- **ref_Index:** a linked list of every tab. Click a name to jump there.
- Many tools say **(this tab)**: they work on whichever tab you're looking at, so you can
  keep several copies of a tab (for example one makeAssignment tab per kind of item).

### Which tools change Canvas?

| Changes Canvas (dry run applies) | Reads Canvas only |
|---|---|
| Post selected rows (createByRow) | Preview (either create tool) |
| makeAll (makeAssignment) | Refresh tables, Jupiter categories |
| Push reorder | Update Grades, CreateRoster |
| Create group category, Create groups, Put students in groups | Pull scores, Pull groups |
| Post comments | List course content, Export to Google Docs |
| | Quiz report, Course check, Build seating chart |

---

## 3. Keeping data current (Setup & Data)

| Menu item | Use it when |
|---|---|
| Refresh all tables | Start of a session, or after changes in Canvas (new students, sections, assignments). |
| Refresh course list / people list / assignment groups / section list / sheet index | Just one table needs updating. |
| Refresh Jupiter categories | Canvas assignment groups changed. Then check the ticks on ref_Config (ticked = exported to Jupiter). It's not part of Refresh all, on purpose. |

**Reference tabs hide themselves.** After a refresh, ref_CourseIDs, ref_peopleList,
ref_assignmentGroups, and ref_SectionLookup are hidden to keep them out of the way,
unless you're looking at that tab when it refreshes. To see one, use **View › Hidden
sheets**, or the **≡ (All sheets)** button at the bottom left, where hidden tabs are
grayed out. It hides again at its next refresh. ref_Index always stays visible. While
**Refresh all tables** runs, the message at the bottom right shows each step
("Refreshing people list… (2 of 5)").

---

## 4. Creating items in Canvas

**Types:** `A` = assignment, `D` = graded discussion, `CQ` = Classic quiz, `NQ` = New
Quiz.

**Blank times:** Due and Lock = 11:59 PM on that date; Unlock = 12:00 AM (the start of
that day).

**Published:** only a **ticked** box publishes. Unticked, blank, or no Published column
makes a draft. New Quizzes always start as drafts (Canvas decides).

**Descriptions:** your Description Text appears bold, with your line breaks kept. Each
link becomes a green "🚀" button with your Link Text (blank = "Open Resource"). A Google
Doc or Drive link also shows a full-width preview of the Doc underneath.

### createByRow: many items, no section dates

1. On the **createByRow** tab, fill one row per item (from row 4). Columns are found by
   their row 3 labels, so you can move them around: `name`, `Type`, `points_possible`,
   `Due Date`, `Due Time`, `Unlock Date`, `Unlock Time`, `Lock Date`, `Lock Time`,
   `Description Text`, `Doc Link`, `Link Text`, `Published`. The tool fills `CanvasID`,
   `Canvas Link`, `Payload`, and `Status`.
2. Select the rows. **Canvas Tools › Create in Canvas › Preview selected rows.** Read
   Status for each row.
3. **Post selected rows.** Rows with a CanvasID are skipped, so nothing is made twice.

Classic quizzes are made as empty shells (points come from the questions you add in
Canvas). New Quizzes need points above 0.

### makeAssignment: one item with section dates (and quiz questions)

Make a copy of a makeAssignment tab for each kind of item you make often; each copy
keeps its own defaults. Every button works on the tab you're looking at.

1. **Clear IDs, Status, Payload** to start fresh (keeps everything else).
2. Fill the red cells: name, points, dates, Type, Type of Submission (Type A only),
   Published, instructions.
3. Overrides: one row per section (Section ID, Period, Due Date, times). **Get Times**
   fills the Due Time dropdowns with that period's start and end on that day, plus
   School Start / School End / After School / Night. You can also type a time like
   11:59 PM.
4. **Quizzes (CQ or NQ):** fill the Questions table (below).
5. **Preview assignment**, read Status, then **makeAll**. It asks first.
6. If the item already exists (canvasID filled in), makeAll only adds overrides and
   questions that don't have an ID yet.

### Quiz questions (Questions table on CQ / NQ tabs)

| Question Type | Answer column |
|---|---|
| multiple_choice_question | the correct option number, e.g. `2` |
| multiple_answers_question | the correct option numbers, e.g. `1,3` (New Quizzes give partial credit) |
| true_false_question | `True` or `False` |
| essay_question | leave blank |

- Options go in Opt 1 to Opt 5. A row with no **Question** text is skipped.
- New Quizzes need Points above 0.
- If a run stops near Google's 6-minute limit, click makeAll again; it continues.

---

## 5. Grading tools

### Jupiter grades

1. On your grading sheet (e.g. **Comments**), click **CreateRoster** (or **Canvas Tools
   › Jupiter › CreateRoster**). The first time, it fills columns A–E, sorted by Period,
   then name.
2. Type each student's **Jupiter ID** into column F (from a Jupiter export).
   - **After adds and drops, run CreateRoster again.** Each row stays with its student.
     A new student gets a whole new row (type their Jupiter ID in F; the pop-up gives
     the row number). A dropped student's row turns light red, and you're asked before
     it's deleted (No changes nothing).
   - If a student changed period, the pop-up gives the row. Keep multi-section sheets
     sorted by Period, then name, so new students land in the right spot.
3. Click **Update Grades**. Choose how many days back to look (default: since the last
   sync in B1). It fills **JupiterExport** with recently graded work from the categories
   ticked on ref_Config. Scores are Canvas's final scores (after any late penalty).
4. If the summary says some students have no matching Jupiter ID, fix column F and run
   it again.
5. Open **JupiterExport**, copy it, and paste it into Jupiter.

### One assignment: Pull scores and Post comments

On the grading sheet, for one assignment at a time:

- Put the Canvas **assignment ID** in **row 2** of a column (the number at the end of
  the assignment's web address). Students start on row 3, with their Canvas user ID in
  column A (CreateRoster sets this up).
- Click any cell in that column.

**Pull scores into this column** (**Canvas Tools › Grading sheet**) reads every
student's score into the column: Canvas's final score, blank if excused or not graded.
It asks before replacing cells that already have something in them. Rows without a user
ID (like Average rows) are never touched. **Read-only.**

**Post comments from this column** posts each student's comment from the column to their
submission for that assignment. **This changes Canvas** (dry run applies), and Canvas
notifies students as their settings say. Comments only, never grades.

- If a student submitted more than once, the comment goes on their **latest** submission,
  where they'll see it right away.
- Each comment cell gets a **note** with its result. A refused cell turns light red. The
  row 1 cell gets a summary note.
- A cell whose note starts with "Commented" is skipped, so nothing posts twice. Delete
  the note to send it again.
- It stops itself after about 5 minutes; run it again to continue.

---

## 6. Other tools

### Assignment order

**Canvas Tools › Assignment order:** **Open reorder tool**, number the rows you want
(**Number selected rows 1, 2, 3…**), **Preview reorder**, then **Push reorder**.

### Groups

On the **createGroups** tab (buttons there, or **Canvas Tools › Groups**):

1. **Clear group data** to start a new set (clears the category ID, link, and GroupIDs).
2. Type the group category name in **C2**, then **Create group category**. Its ID and
   link appear in D2 and E2.
3. List the group names under **Group Names** (from row 5), then **Create groups**. Each
   new group's ID appears in the GroupID column; rows that already have one are skipped.

Groups are created empty (no students are added).

**See who is in which group (Pull groups into this column).** On your grading sheet
(e.g. **Comments**):

- Put the group set's **category ID** in **row 2** of an empty column (G or later). It's
  the number in D2 of createGroups, or the number after `#tab-` in the web address when
  you open that set on Canvas's People › Groups page. Students start on row 3, with
  their Canvas user ID in column A (CreateRoster sets this up).
- Click any cell in that column, then **Canvas Tools › Groups › Pull groups into this
  column**.

Each student's row gets the name of the group they're in now (blank if none), and every
student cell gets a **dropdown** of the set's group names, so you can pick names instead
of typing them. If no one is in a group yet, you just get the dropdowns. It asks before
replacing cells that already have something in them, and rows without a user ID are
never touched. **Read-only.** The summary also says if a group member has no row on the
sheet, or if two groups share a name.

**Put students in groups from this column.** After Pull groups, pick a group for each
student from the dropdowns (clear a cell to take a student out of their group). Then
click in the column and choose **Canvas Tools › Groups › Put students in groups from
this column**. **This changes Canvas** (dry run applies).

- It compares each cell with Canvas and changes only the students who differ: **add**
  (in no group yet), **move** (a different group picked), or **remove** (cell blank).
  Students who aren't on this sheet (another section, the Test Student) are never
  changed.
- It shows the counts and the groups affected, and asks before sending.
- If a cell names a group that isn't in the set, it stops before sending anything and
  lists the rows. Pick from the dropdown instead (run Pull groups to refresh it).
- A student Canvas refuses turns light red, and the cell's note says why; the rest still
  go.
- It stops itself after about 5 minutes. Running it again is safe: it only does what
  still differs.

### Rubrics (Canvas import)

1. Copy the rubric template tab and fill it in: title under "Rubric Title"; criterion
   names in the row above "Criterion Description"; Rating N Name / Description / Points.
2. Click **makeRubric** (or **Canvas Tools › Rubrics › Export rubric for Canvas**).
   Empty criteria are skipped. If something's missing, it names the cell to fix.
3. Open **rubricCanvasExport** › **File › Download › Comma-separated values (.csv)**.
4. In Canvas: **Rubrics › Import**, choose the file. Attach the rubric to an assignment
   in Canvas.

### Course backup: List course content and Export to Google Docs

Copies assignment, discussion, and page content (plus the syllabus and course home page)
into Google Docs, one Doc per item. Both steps are **read-only** in Canvas.

**Tab setup** (the **Export to Google Docs** tab, or a copy):

- **B1:** the folder name you want. **C1:** the folder's link, filled in the first time
  the folder is made (in My Drive; you can move or rename it later).
- **A2 "Course ID:", B2:** a course number to list, or blank for this workbook's
  course. You can back up any course you teach from one workbook.
- **Row 3 labels:** `Canvas Link` and `Google Doc` are needed; `Name`, `Type`,
  `Published`, `Canvas Updated`, `Back up?`, and `Exported` are used when present.

**Steps:**

1. **Canvas Tools › List course content (this tab).** Adds one row per item, each with
   an unticked **Back up?** box. Run it again any time: existing rows stay put (only
   Name, Type, Published, and Canvas Updated refresh), and new items are added at the
   bottom. Classic and New Quizzes aren't listed.
2. Tick **Back up?** for the items you want.
3. **Canvas Tools › Export to Google Docs (this tab).** It asks Yes/No with the count.
   Each Doc gets the item's title, a link back to Canvas, and its content, including
   pictures stored in Canvas. Docs go into Assignments / Discussions / Pages subfolders.

**Good to know:**

- Only **ticked** rows export, and rows that already have a Google Doc link are skipped.
  To export one again, delete its Google Doc link.
- You can also paste a Canvas link into a row yourself (assignment, discussion, page,
  syllabus, or course home); tick Back up? to export it.
- A **light yellow** Google Doc cell with the note "Changed in Canvas since export" means
  the item was edited in Canvas after its Doc was made. Delete the link and export again
  if you want the newer version. (Discussions and the syllabus have no Canvas date, so
  they're never marked.)
- Discussions: only your prompt is copied, never student replies.

### Quiz report (Classic quizzes)

Shows one Classic quiz's question groups ("pick 3 of 7") and their questions in one
place. **Read-only.**

1. On a tab whose **A1** says `Quiz link:`, paste the quiz's Canvas link in **B1**. (If
   you're on any other tab, it uses, or makes, a tab named **Quiz report**.)
2. **Canvas Tools › Quiz report (this tab).**
3. Row 3 down is replaced each run: a summary (title, points in Canvas vs. points found),
   then each group followed by its questions, in quiz order.

If the points don't match, a group probably pulls from a **question bank**; the report
can't see those questions.

### Build seating chart

Adds a text box for each student (first name over last name, in the period's color) to
a Google Slides deck, one slide per period. On ref_Config, `cfg_SeatingDeckID` holds the
deck's ID and `cfg_SeatingPeriods` lists period | color | slide number. It refreshes the
student list first. **It only adds boxes: running it twice gives two sets**, so clear
the slides first if you're rebuilding.

### Course check (possible setup mistakes)

**Canvas Tools › Course check.** **Read-only.** Run it after setting up a term, or any
time. It refreshes the assignment list, then fills the **Course Check** tab with
possible problems:

- **Missing due date**, and **Unpublished** items.
- **No-school day:** due on a weekend, during a break, or on a holiday (`H`) or PD day
  in ref_simpleSchedule.
- **Outside the term:** often dates left over from last term's course copy.
- **Big item on SAC review day:** something worth 50+ points due on a day the master
  calendar notes "SAC Review Day".
- **After No Homework Weekend:** anything due on the first school day after a weekend
  the master calendar notes "No Homework Weekend".
- **Group not checked for Jupiter:** a group with assignments worth points that isn't
  ticked in the Jupiter categories (skipped if no category is ticked).

The first **Info** row shows which term dates were used (from `cfg_TermQuarters`; if
it's blank, Canvas's term dates, which for a quarter course means the whole semester).

**OK as is:** tick it for anything that's fine on purpose (for example, a Sunday-night
due date, or No Homework Weekend items in a course with no homework). Next time, that
row is listed last, in gray, and isn't counted. If the due date changes, it shows up
again. Fixed problems simply disappear on the next run. Only the ticks are kept;
anything else typed on the tab is replaced.

---

## 7. When something goes wrong

| What you see | What to do |
|---|---|
| **"Not ready: …"** in a Status cell | That row has a problem (the message says what). Nothing was sent for it. |
| **"Script function … not found"** from a button | The button's assigned script name is wrong. Right-click the button › three dots › Assign script, and check the name. |
| Labels problem | **Setup & Data › Setup & safety › Check createByRow labels** or **Check makeAssignment labels (this tab)**. Labels must match exactly, including capitals and colons. |
| Token rejected / not saved | Make a new token in Canvas and run **Set Canvas token**. **Test Canvas connection** checks it. |
| Not allowed (403) | Your Canvas account can't do that in this course. Check `cfg_CourseID`. |
| Canvas is busy | Wait a minute and try again. |
| No **Canvas Tools** menu | Reload the page; wait a few seconds. |
| Anything else | Note the button or menu item and the exact message (no student data), then tell whoever shared the workbook with you. |
