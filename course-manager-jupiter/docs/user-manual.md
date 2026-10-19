# Course Manager (Jupiter edition): User Manual

**Status:** quick-start draft, 2026-10-18. To be filled out after the Biology field test,
before Sequence 9 and Gastronomy move to this workbook.

This workbook connects a Google Sheet to one Canvas course. It creates assignments,
quizzes, discussions, overrides, and groups in Canvas; reorders assignments; exports
grades for Jupiter; and builds rubrics for Canvas to import. It never changes grades.

---

## 1. Before you start

### One-time setup (each person, each workbook)
1. Open the workbook. Google may ask you to **authorize** the script. Review and allow.
2. **Setup & Data › Setup & safety › Set Canvas token.** Paste your own Canvas token and
   the school's Canvas address. They're stored for **you only**; other editors can't
   see them. (Make a token in Canvas: Account › Settings › New Access Token.)
3. **Setup & Data › Setup & safety › Test Canvas connection.** It should say "Connected".
4. On **ref_Config**, check `cfg_CourseID` is the course you mean to work in.
5. **Setup & Data › Refresh all tables.** You should see a ✓ for each table.
6. **Setup & Data › Setup & safety › Check setup.** It should say "Setup OK".

### Safety rules
- **Dry run** (Setup & Data › Setup & safety › Dry run): while it's **ON**, tools that
  would change Canvas only show what they *would* send. It starts ON. Turn it OFF only
  when you mean to create things, and back ON afterward.
- **Check the course.** Every tool works on the course in `cfg_CourseID`. Test new
  things in a test course first.
- **Preview first.** Tools that create things have a Preview: it fills **Payload** (what
  would be sent) and **Status** without sending anything.
- **Nothing is ever deleted** in Canvas by these tools; they only create (and reorder).
- **Student privacy.** Never paste or screenshot student names, emails, IDs, grades, or
  comments into an AI tool or email when asking for help. Describe the layout instead.

---

## 2. Where things are

- **🏠 Home tab:** buttons for the everyday tools. **Canvas Tools › 🏠 Go to Home page**
  jumps there from anywhere.
- **Canvas Tools menu:** everything that *does* something (create, reorder, groups,
  rubrics, Jupiter, seating chart).
- **Setup & Data menu:** refreshing reference tables, Jupiter categories, token, dry run,
  and checks.
- **ref_ tabs** (red): reference tables the tools read. Refresh them; don't edit them.

---

## 3. Keeping data current (Setup & Data)

| Menu item | Use it when |
|---|---|
| Refresh all tables | Start of a session, or after changes in Canvas (new students, sections, assignments) |
| Refresh course list / people list / assignment groups / section list / sheet index | Just one table needs updating |
| Refresh Jupiter categories | Canvas assignment groups changed. Then check the ticks on ref_Config (ticked = exported to Jupiter). Run it on purpose; it's not part of Refresh all. |

---

## 4. Creating items in Canvas

### createByRow: many items, no overrides
1. On the **createByRow** tab, fill one row per item: Type (A = assignment,
   D = discussion, CQ = Classic quiz, NQ = New Quiz), name, points, dates/times,
   description, Published (ticked = publish; unticked = draft).
2. Select the rows. **Canvas Tools › Create in Canvas › Preview selected rows.** Read
   Status for each row.
3. **Post selected rows.** Rows with a CanvasID are skipped, so nothing is made twice.

### makeAssignment: one item with section overrides (and quiz questions)
Make a copy of a makeAssignment tab for each kind of item you make often; each copy
keeps its own defaults. Every button works on the tab you're looking at.
1. **Clear IDs** to start fresh (clears IDs, Canvas URL, Status, Payload; keeps
   everything else).
2. Fill the red cells: name, points, dates, Type, Type of Submission (Type A only),
   Published, instructions.
3. Overrides: one row per section (Section ID, Period, Due Date, times). **Get Times**
   fills the Due Time dropdowns with that period's start/end on that day, plus School
   Start / School End / After School / Night. You can also type a time like 11:59 PM.
4. **Quizzes (CQ or NQ):** fill the Questions table (see below).
5. **Preview**, read Status, then **makeAll**. It asks first, showing the course and
   whether dry run is on.
6. If the item already exists (canvasID filled in), makeAll only adds overrides and
   questions that don't have an ID yet.

**Blank times:** Due and Lock = 11:59 PM; Unlock = 12:00 AM (start of that day).

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

## 5. Other tools

### Assignment order
**Canvas Tools › Assignment order:** open the reorder tool, number the rows you want
(Number selected rows 1, 2, 3…), **Preview reorder**, then **Push reorder**.

### Groups
On the **createGroups** tab (buttons there, or **Canvas Tools › Groups**):
1. **Clear group data** to start a new set (clears the category ID, link, and GroupIDs).
2. Type the group category name in **C2**, then **Create group category**. Its ID and
   link appear in D2 and E2.
3. List the group names under **Group Names** (from row 5), then **Create groups**. Each
   new group's ID appears in the GroupID column; rows that already have one are skipped.
Groups are created empty (no students are added).

### Rubrics (Canvas import)
1. Copy the rubric template tab and fill it in: title under "Rubric Title"; criterion
   names in the row above "Criterion Description"; Rating N Name / Description / Points.
2. Click **makeRubric** (or **Canvas Tools › Rubrics › Export rubric for Canvas**).
   Empty criteria are skipped. If something's missing, it names the cell to fix.
3. Open **rubricCanvasExport** › File › Download › Comma-separated values (.csv).
4. In Canvas: **Rubrics › Import**, choose the file. Attach the rubric to an assignment
   in Canvas.

### Jupiter grades
1. On your grading sheet (e.g. **Comments**), click **CreateRoster** once per class.
   It fills columns A–E only.
2. Type each student's **Jupiter ID** into column F (from a Jupiter export). The IDs
   don't move if the roster changes; re-check them whenever students are added/dropped.
3. Click **Update Grades**. Choose how many days back to look (default: since the last
   sync in B1). It fills **JupiterExport** with recently graded work from the categories
   ticked on ref_Config. Scores are Canvas's final scores (after any late penalty).
4. If the summary says some students have no matching Jupiter ID, fix column F and run
   it again.
5. Open **JupiterExport**, copy it, and paste it into Jupiter.

### Seating chart
**Canvas Tools › Build seating chart.**

---

## 6. When something goes wrong

- **"Not ready: …"** in a Status cell: that row has a problem to fix (the message says
  what). Nothing was sent for that row.
- **"Script function … not found"** from a button: the button's assigned script name is
  wrong, or the code isn't installed yet.
- **Check labels** (Setup & Data › Setup & safety): checks the createByRow or
  makeAssignment tab's labels. Labels must match exactly, including capitals and colons.
- **A Canvas error** (refused, token rejected, not reachable): the Status or pop-up says
  which. Test Canvas connection checks the token.
- When asking for help, say which button or menu item you used and the exact message.
  Don't include student data.
