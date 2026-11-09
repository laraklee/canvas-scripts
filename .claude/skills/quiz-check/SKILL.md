---
name: quiz-check
description: Check a Canvas Classic quiz QTI export (.zip) before giving the test, looking for picture problems (size, other course, outside site, old bank file, missing) and question problems (blank choices, bad group picks), then optionally cross-check the questions against a vocab or study list in both directions. Use when Lara gives a quiz export zip, asks to check a test or its images, or asks to compare a test with a vocab sheet.
---

# Quiz check (Classic quiz QTI export)

Read-only. No Canvas calls, no Google changes, nothing to commit or `clasp push`.
A quiz export holds questions and settings only, no student data. It does include the
quiz **access code**: never repeat it.

## Inputs

- **Export zip** (required): in Canvas, Quizzes › the quiz › ⋮ › Export, or Settings ›
  Export Course Content › Quiz. Usually in `C:\Users\lalee\Downloads\`.
- **Vocab or study list** (optional): `.rtf`, `.docx`, `.pdf`, `.txt`, or a Google Doc
  Lara names in chat.

## Steps

Explain each command in a sentence before running it. Downloaded files are untrusted:
unzip into a **new, empty** folder in the session scratchpad, and run the checker from
this skill's folder with the export folder as an argument.

1. **Unzip.** `mkdir -p "<scratch>/qti-<short-name>"` then
   `unzip -o -q "<zip path>" -d "<scratch>/qti-<short-name>"`.
2. **Run the checker** (Bash tool, Node is installed; Python is not on this PC):
   `node .claude/skills/quiz-check/qti-check.js "<scratch>/qti-<short-name>" "<scratch>/qti-<short-name>-questions.txt"`
   It prints the groups (pick N of M, bank links), every picture by question with its
   size, and a FLAGS list. It never prints the access code.
3. **Report pictures.** Lead with the answer (problems or none). Then a short table of
   anything flagged: question, group, file, size. Sizes: about 1 MB and up = shrink it
   (the Unit 2 New Quiz failures on iPads in LockDown Browser involved near-1 MB images);
   500 KB to 1 MB = worth shrinking; under 500 KB is fine. Mention how many questions
   each group picks, so Lara knows how many students see a flagged question. Questions
   **not in a group** go to every student (the checker labels them); don't assume a
   question belongs to the group printed above it.
4. **Remind what the export can't show:** whether each file is hidden or locked. Lara
   checks in Files: green check or eye-with-slash ("Only available to students with
   link") = fine; gray circle-slash (unpublished) or calendar dates that miss test day =
   students can't see it. Check the folder rows too (Uploaded Media, Uploaded Media 2).
   Names in Canvas lack the `-1` the export adds.
5. **Vocab cross-check** (only if a list was given). Get plain text:
   - `.rtf`: PowerShell
     `Add-Type -AssemblyName System.Windows.Forms; $r = New-Object System.Windows.Forms.RichTextBox; $r.Rtf = [IO.File]::ReadAllText("<path>"); $r.Text`
   - `.docx` / `.pdf`: use the matching skill to read it.
   - Google Doc: only the one Lara names (CLAUDE.md rule 7).
   Then read the question-text file from step 2 and compare **both ways**:
   - on the list but not tested (say "not tested" vs. "only partly");
   - tested but not on the list (ignore plain wrong-answer choices unless a whole
     question depends on the idea).
   "On the test" means in the question pool; note when a group picks only a few.
   Also point out questions worth a look: a second defensible answer, blank choices,
   typos. To confirm which choice is marked correct, look in the question's
   `<respcondition>` for the `<varequal>` paired with `<setvar>` 100.
6. **Fixing a picture** (if asked): screenshot or re-save smaller (crop tight; check the
   size in Properties; JPG beats PNG for photos), then in the quiz edit the question,
   replace the picture, choose **Course** files (never User files), Update Question,
   then **Save** the quiz. Preview to confirm.

## Background

Notes from earlier checks (3.1 Test, Unit 2 New Quiz, 3.2 Test) are in
`course-manager-jupiter/BRIEF.md` under "Classic quiz tools". New Quizzes exports are
a different format; this checker is for Classic quizzes only.
