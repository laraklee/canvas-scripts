---
name: quiz-check
description: Check a Canvas quiz QTI export (.zip, Classic or New Quizzes) or a whole-course export (.imscc) before giving the test, looking for picture problems (size, outside site, old bank file, missing, personal files) and question problems (blank choices, no correct answer, bad group picks, points that don't add up), including questions in item banks when the export carries them; then optionally cross-check the questions against a vocab or study list in both directions. Use when Lara gives a quiz export zip or course export (.imscc), asks to check a test or its images, or asks to compare a test with a vocab sheet.
---

# Quiz check (course export or quiz QTI export: Classic or New Quizzes)

Read-only. No Canvas calls, no Google changes, nothing to commit or `clasp push`.
A quiz export holds questions and settings only, no student data. It does include the
quiz **access code**: never repeat it (the checker only says whether one is set).

## Which tool when

- **Course export (.imscc) is the main check (Lara, 2026-11-09).** It carries every
  quiz and bank, each quiz's published state, and each file's and folder's published /
  link only / unpublished setting, and it shows pictures that still link to another
  course (students here can't see them; the Unit 2 problem). A single-quiz export packs
  such pictures with the exporter's access, so it looks clean when it isn't.
- **Single-quiz export (.zip):** fine for a quick look at one quiz, but say it is the
  weaker check. Classic single-quiz exports also leave banks out ("BANK NOT IN EXPORT").
- Course Manager's live Quiz report and "Quiz report from export file" are off its menu
  (11/9) until its course-export quiz check is built.

## Inputs

- **Course export (.imscc)**: Settings › Export Course Content › Course (Lara's regular
  backup). On the Mac, Claude can't open Downloads: Lara drags it into
  `~/code/course-exports/` (outside the repo). On the PC, usually `C:\Users\lalee\Downloads\`.
- **Or a single-quiz export (.zip)**:
  - Classic: Quizzes › the quiz › ⋮ › Export, or Settings › Export Course Content › Quiz.
  - New Quiz: open the quiz, then its ⋮ menu › Export (QTI). The zip name is a long code.
- **Vocab or study list** (optional): `.rtf`, `.docx`, `.pdf`, `.txt`, or a Google Doc
  Lara names in chat.

## Steps

Explain each command in a sentence before running it. Downloaded files are untrusted:
unzip into a **new, empty** folder in the session scratchpad, and run the checker from
this skill's folder with the export folder as an argument.

1. **No unzipping needed.** The checker reads a .zip or .imscc in place with the same
   reader as Course Manager's Quiz check window (table of contents for sizes, text only
   from the quiz, bank, and settings files). Don't use `unzip -l` for names on the Mac: it
   garbles the narrow space in screenshot names ("8.01.24 AM"), so pictures look missing.
2. **Run the checker** (Bash tool; Node is installed on both computers):
   `node .claude/skills/quiz-check/qti-check.js "<export path>"`
   For a course export this prints one line per quiz (LOOK or ok, published, points,
   questions, pictures, flagged rows). Then pick quizzes by part of their title:
   `node .claude/skills/quiz-check/qti-check.js "<export path>" --quiz "unit 2 test" "<scratch>/questions.txt"`
   (`--quiz " "` shows every quiz). For each quiz it prints the groups (pick N of M, bank names), loose questions, points found vs. the
   quiz's total, every picture by question with its size, and a FLAGS list. The reading
   is done by `course-manager-jupiter/QtiReader.js` (shared with Course Manager); fix
   reading bugs there, with a test in `scripts/checks/qti-reader.check.js`.
3. **Report.** Lead with the answer (problems or none). Then a short table of anything
   flagged: the question's opening words (the checker prints them; Q numbers won't match
   Canvas, and New Quiz picture names are random codes), group, and the problem. Sizes:
   about 1 MB and up = shrink it (the Unit 2 New Quiz failures on iPads in LockDown
   Browser involved near-1 MB images); 500 KB to 1 MB = worth shrinking; under 500 KB is
   fine. Say how many questions each group picks, so Lara knows how many students see a
   flagged question. Questions **not in a group** go to every student (the checker labels
   them); don't assume a question belongs to the group printed above it.
4. **What a single-quiz export can't show** (a course export does): whether each file
   or folder is published, link only, or unpublished, and pictures linked from another
   course. With a single-quiz export, Lara checks in Files: green check or
   eye-with-slash ("Only available to students with link") = fine; gray circle-slash
   (unpublished) or calendar dates that miss test day = students can't see it. Names in
   Canvas lack the `-1` the export adds. Pictures uploaded in the New Quizzes editor live
   in New Quizzes' own storage (not Files), so there is nothing to check there. File
   availability dates: the reader flags them, but no real export has had one yet.
5. **Vocab cross-check** (only if a list was given). Get plain text:
   - `.rtf`: PowerShell
     `Add-Type -AssemblyName System.Windows.Forms; $r = New-Object System.Windows.Forms.RichTextBox; $r.Rtf = [IO.File]::ReadAllText("<path>"); $r.Text`
   - `.docx` / `.pdf`: use the matching skill to read it.
   - Google Doc: only the one Lara names (CLAUDE.md rule 7).
   Then read the question-text file from step 2 (bank questions included, with the
   correct choice numbers) and compare **both ways**:
   - on the list but not tested (say "not tested" vs. "only partly");
   - tested but not on the list (ignore plain wrong-answer choices unless a whole
     question depends on the idea).
   "On the test" means in the question pool; note when a group picks only a few.
   Also point out questions worth a look: a second defensible answer, blank choices,
   typos.
6. **Fixing a picture** (if asked): screenshot or re-save smaller (crop tight; check the
   size in Properties; JPG beats PNG for photos), then edit the question (for a New Quiz
   bank question, edit it in the item bank), replace the picture (Classic: choose
   **Course** files, never User files), and save. Preview to confirm.

## Background

Notes from earlier checks (3.1 Test, Unit 2 New Quiz, 3.2 Test) and the plan for a
"Quiz report from export file" upload in Course Manager are in
`course-manager-jupiter/BRIEF.md` under "Classic quiz tools".
