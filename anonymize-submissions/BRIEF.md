# anonymize-submissions — Project Brief

Pseudonymizes a Canvas "Download Submissions" set so student work can be shared or
reviewed without names. A script bound to a Google Sheet; menu **Anonymize**.
One Sheet per course: copy a clean template for each course, then set the passphrase
once in each copy (User Properties belong to one script copy).

**User guide (in the workbook since 2026-11-08):** `UserGuide.html`, opened by
**Anonymize › ❓ User guide** (`showUserGuide` in Index.js). It replaces the hand-made
**Instructions** tab, which was out of date (no quiz reports, Sort Review, or Archive;
old prompt-based steps). Rewritten from this brief and the code, not from the old tab.
It includes generic AI instructions for colleagues (versions A and C of
`gems/grading/SKILL.md`, without Lara's course list), because the `@grading` skill can't
be shared yet; keep them in step with the skill. Marked "Work in progress" (Lara's AI
group knows). Same-commit rule as CLAUDE.md. **Never put a passphrase in the guide or
the sheet:** on 11/8 Lara's old Instructions tab turned out to show her passphrase in
plain text; Claude advised removing it and setting a new one in each workbook (Lara's to
do; never record the passphrase anywhere in this repo).
**Show my passphrase (11/8, Lara's request):** a menu item that shows the current user's
own saved passphrase (User Properties) after a "no one watching" warning, so a teacher
can copy it into Set passphrase in a new workbook instead of keeping a record. Never
logged; other users see only their own. This replaces the earlier "never shown" rule.

**Template (clean copy for new courses):** spreadsheet
`1blak2cQg4LiU4FETz2ITnsnLlg0zCSJc8tps9y4p9ww`, script
`13cU3kzCNWurdIeBdA2kJAaMKttnYmG9wJG4aT8XKyYIHmNcwrT1zQT2i`, push file
`.clasp-template.json`, pushed **last**. On 11/8 it held older code (from before quiz
reports, no `QuizCsv.js`); same layout-only manifest difference, so `--force` the first
time. Claude never opens the template's sheet.

**Scripts (each workbook copy has its own; push files added 11/8):**
- **AI9** AI grading workbook ("AI Grading 10.18.26", the original):
  `18bnY2Po0yf0T9SgMEEMTW0KYnkvUQpy0H4syDaVBrzZf1tekT2cXbPiH`. This is the one
  `.clasp.json` here points at, so a plain `clasp push` from this folder goes to **AI9
  only**. 11/1: matched commit `985e56b` (checked read-only); pushed `ee722cf`.
- **Biology** AI grading workbook: `1BcbprgAzhTFBvU8vNtZJgvvmXU5_gHZOJYfpmG-2cNxVoGWFVxnxvSsc`.
  Lara's main one. Push with
  `clasp push -P 'C:\Users\lalee\Code\canvas-scripts\anonymize-submissions\.clasp-biology.json'`
  (replaces the old clone-into-scratch routine). Its `appsscript.json` differed only in
  layout (same three scopes, checked 11/8), so the first push uses `--force`.
  11/1: it matched commit `985e56b`; pushed `d0e4fbc` (quiz CSV),
  then `8e404ef` (Match for quiz answers) and `ee722cf` (last-name order).
- **Gastronomy** AI grading workbook: `18X8wcEFb0o4wMvivgWG_Gd6fLYPV4Y3hb-EtmDAaw4kSIpvPkiq7kWQK`.
  Push file `.clasp-gastronomy.json` (same layout-only manifest difference, `--force`
  the first time). 11/1: matched commit `985e56b` (checked read-only); pushed `ee722cf`.
- **11/1: all three run the latest commit** (quiz CSV, Match for quiz answers, last-name order,
  question text in Review, bold question text, shading, sort by question/student).
- **11/4: Biology only** got `45eb8d8` (Classic Quiz reports, Quiz/Assignment ID header);
  before the push it matched the 11/1 code, and a fresh clone after matches `45eb8d8`.
  AI9 and Gastronomy are still on the 11/1 code until Lara tests it on a real Classic quiz.
- **11/8: Lara chose to push the latest code (Classic Quiz reading included) to all three
  and the template with the user guide**, before her Classic test: her AI group knows
  it's a work in progress. Like the other projects: three courses plus a template.
  **Done 11/8:** all four run commit `28c02a7` (Biology tested by Lara: guide, Show my
  passphrase; then AI9, Gastronomy, template pushed).
- **Where we left off (11/8, end of day): Biology is one step ahead.** It runs `601d03b`
  (the guide opens in a **side panel** docked on the right, with an "Open in a large
  window" link; narrow-screen layout). Lara tried it: "looks good overall." **Next:** push
  `601d03b` to AI9, Gastronomy, and the template (ask first). Lara replaced the old
  Instructions tab with a short **Start Here** tab (what it does, privacy, "open the
  guide") in all four workbooks; the old passphrase is gone from them.
- All three courses should run the same code (Lara, 11/1). Same order as the other
  projects: test on Biology first, then push to the others after Lara's OK.

## Index tab (Index.js)

B1 holds the link to the course's AI grading folder. Each assignment's Canvas download
goes in its own subfolder. **Refresh folder list** adds a row per new subfolder:
Folder (linked name), Short name (defaults to the folder name), Quiz/Assignment ID
(Lara types it; any Canvas number unique to that quiz or assignment works, because it
is only used to make the codes and is never sent to Canvas; header renamed 11/4), Anonymized and Matched (status + time, written by the script), Folder ID.
Lara clicks a row, then **Anonymize selected row** or **Match AI results for selected
row**: no prompts. The same three functions can be assigned to drawn buttons:
`refreshFolderList`, `anonymizeSelectedRow`, `matchSelectedRow`. Checks: row is on the
Index, assignment ID is digits and on one row only, short name not used by another ID.

**Archive selected row…** (after grades are in Canvas): deletes that assignment's Key,
AI, and Flagged tabs, keeps Review (names, codes, scores, comments) and hides it
(View › Hidden sheets), and sets the Anonymized cell to "Archived: …". Refuses if
there is no Review tab. Asks first, saying how many Review rows aren't checked.
Anonymize and Match refuse an archived row, because with no Key a re-run would copy
every file again. To start over: delete the `anonymized` folder and clear that cell.

## What it does

1. Takes the folder, assignment ID, and short name from the selected Index row.
2. Reads every file directly in that folder. Zips are unzipped in memory with
   `Utilities.unzip`; loose files are used as they are. Both can be in the folder.
3. Parses each filename as `name[_LATE]_userID_submissionID_originalFilename`.
   Anything that doesn't match goes to the assignment's **`<name> Flagged`** tab and is not copied. Nothing
   is guessed.
4. Code = `S-` + the first 6 hex characters (uppercase) of
   HMAC-SHA256(`userID:assignmentID`, passphrase), for example `S-9C1E4B`.
5. Saves a renamed copy into an `anonymized` subfolder, keeping the original extension.
   If a student has several files: `S-9C1E4B.pdf`, `S-9C1E4B-2.docx`, … (in filename order).
6. Adds one row per file to the **`<name> Key`** tab: Name, Canvas user ID, Assignment ID, Code,
   Original filename, Late, Anonymized filename.

## New Quiz essay answers (QuizCsv.js, started 11/1)

For a New Quiz, Lara downloads the **Student Analysis** report (.csv) into the
assignment's folder instead of a submissions zip. The Index row's assignment ID is the
New Quiz's assignment ID (the number after `/assignments/`). Anonymize then:

- reads the report (columns `Name`, `ID` = Canvas user ID, student/section columns,
  `Attempt`, then five per question: `ItemID`, `ItemType`, the answer under a header that
  is the question text, `EarnedPoints`, `Status`; totals at the end);
- keeps only **essay** answers the student actually got (questions come at random from
  several banks, so most are "Not Attempted"); the formula question is graded by Canvas
  and left out, and so are any points already entered;
- turns the answer HTML into plain text and repairs Windows-garbled characters (`â€”`);
- writes **`<short name> answers.csv`** to the `anonymized` folder: Code, Question
  (`Q6. <text>`), Answer, one row per answer, **sorted by question** so the AI sees
  every answer to a question together; it is rebuilt on every run;
- adds one Key row per student with an essay answer (original filename = the report's
  name), using the same code as a file download. A student listed twice keeps the higher
  attempt; rows with no ID are flagged.

**Decided with Lara (11/1):** the AI does **not** score. Lara reads and scores every
answer herself, question by question in SpeedGrader. The AI sorts each answer into a
group (Strong / OK / Weak or similar) with a short "Why" pointing out what's excellent
or missing, so Lara can check her own consistency.

**Tested 11/1 on Biology (3.6D Quiz):** 15 students, 105 essay answers, nothing flagged;
Lara checked the file (columns, order, clean text, no names).

**Step 2 (11/1): Match for quiz answers.** If the pasted AI table has a **Group** column,
Match reads **Code, Question, Group, Why, Notes** (one row per answer) and Review becomes
Name, Code, Question (`Q6 · <first ~60 characters of the question>`), Group, Why, Notes,
Problem, Reviewed: one row per answer,
sorted by student (last name, like SpeedGrader; Canvas gives "First Last", so the last
word counts as the last name) then question number. Match reads the answers file back to flag every
answer the AI skipped ("Missing from AI results"), answers listed twice, and answers to
a question that student didn't get. Same column count as the score Review, with Reviewed
last, so Archive works unchanged. Anonymize gives a quiz's empty AI tab the quiz headers.
AI instructions: section C of the Gemini skill `gems/grading/SKILL.md` (all three
courses; created in Gemini 11/1 as `@grading`) and of the older Gem copy
`gems/BioGrading.md` (Gems end no sooner than June 1, 2027 on school accounts). Changes
to the table formats must go in both, and in the Gemini copy of the skill.
**Skill status (11/4):** Lara used `@grading` on a real quiz answers file and it worked. **To do:** once Google lets
skills be shared (not available as of 11/1, "coming weeks"), point the user guide's
section 5 at the skill. (The old Instructions tab pointed to the Gem; the guide replaces
it, 11/8.)
**Q numbers are the report's column order, not each student's order** (New Quizzes
shuffle questions and draw from banks; the report doesn't record who saw what when).
So Review shows the start of each question's text, for matching in SpeedGrader (11/1,
Lara: without it, matching was more trouble than it was worth). The question text is
bold, and every other student's block is shaded gray (Lara's conditional format rule).
**Two-pass grading (11/1):** menu **Sort Review by question** (Q number, then last name;
bands mark each question) for scoring one question at a time in SpeedGrader's
by-question view, then **Sort Review by student** (Match's order; bands mark each
student) to scan each student's whole quiz. Problem rows stay on top; Reviewed
checkmarks move with their rows. Strong/OK/Weak ordering within a question was
considered and skipped: it wouldn't match SpeedGrader's student order.

## Classic Quiz reports (QuizCsv.js, added 11/4)

A Classic Quiz's **Student Analysis** report works the same way: put the .csv in the
quiz's folder, and type the number from the quiz's address (`/quizzes/<id>`) on the
Index row. Layout (from Lara's real header row, 11/4): lowercase `name`, `id` (Canvas
user ID), `sis_id`, `section`, `section_id`, `section_sis_id`, `submitted`, `attempt`,
then two columns per question (answer under `<question id>: <question text>`, score
under its points possible, like `2.0`), then `n correct`, `n incorrect`, `score`.
- There is no question-type column. **A question counts as an essay if any student's
  answer to it has HTML tags** (essays are typed in Canvas's editor; multiple-choice
  and fill-in answers are plain text). The Done message lists the questions read as
  essays so Lara can check them. If no answer has HTML, the report is flagged ("no
  essay answers found"), not guessed. **Not yet verified on a real Classic report.**
- Blank answers (question not drawn, or skipped) are left out. The answers file,
  `@grading`, Match, and Review are the same as for New Quizzes.
- Offline check: `scripts/checks/anonymize-quiz-csv.check.js` (made-up data).

## One set of tabs per assignment (Assignments.js)

The Index row's short name prefixes four tabs:
`<name> Key`, `<name> Flagged`, `<name> AI` (paste the AI table here), `<name> Review`.
Changing a short name on the Index renames that assignment's tabs on the next run.
Two assignments can't share a name. The last name used per ID is kept in Document
Properties (`ASSIGNMENT_NAME_<id>`) so renames can be detected.
The short name is typed, not fetched from Canvas, so this project needs no Canvas
token or external-request permission. Old tabs are kept: Drive is where Lara keeps
student academic records anyway. Deleting them is optional.

## Matching AI results back to students (MatchResults.js)

The AI step happens outside this script: Lara uploads the anonymized files to an
approved AI tool by hand. The script never calls an AI service.

1. Ask the AI for one table row per file with columns **Code, Score, Feedback,
   Confidence, Notes**, copying the code from the filename.
2. Paste the table into the assignment's **`<name> AI`** tab (header row included). A normal pasted
   table and a Markdown table that lands as `| a | b |` lines in column A both work.
   Columns are found by header name, in any order.
3. Click the assignment's Index row, **Match AI results for selected row**. Rebuilds
   **`<name> Review`**: Name, Code, Score, Feedback, Confidence, Notes, Problem, Reviewed (checkbox).
   Problem rows sort to the top: not a valid code, code not in the Key for this
   assignment, code listed twice, or a student missing from the AI results. A code with
   a `-2` suffix or an extension (`S-9C1E4B-2.pdf`) matches the same student.
4. Asks before rebuilding if any Reviewed boxes are checked.
   Codes are cleaned before matching: spaces and invisible characters removed, any
   dash read as "-", letters O read as 0 and I/L as 1 (codes only use 0-9 and A-F).
   Fixed 10/19: a code that is all digits (S-014852) used to be rejected as invalid.
   The AI tab is created (with headers) when the assignment is anonymized; a repeated
   header row is skipped and resets the column order, so pasting over or under it
   works. Flagged is only created when something is flagged.
5. Grades are entered in Canvas by hand. Numeric scores stay numbers so they copy cleanly.

## Decisions

- **Passphrase lives in User Properties (`ANON_PASSPHRASE`), not Script Properties** (and
  never on a tab; Show my passphrase reads it back for its own user only).
  CLAUDE.md rule 1: anyone who can edit the script can read Script Properties, and with
  the passphrase and a class list they could re-identify every code. Consequence: codes
  depend on whose account runs it. The same teacher with the same passphrase always
  gets the same codes.
- **`:` between user ID and assignment ID** in the HMAC input, so `12` + `345` and
  `123` + `45` don't produce the same code.
- **Extra Key column "Anonymized filename"**, needed once a student has more than one file.
- **Drive scope is the full `drive` scope (scan WARN, accepted).** `drive.file` only
  covers files this script created or opened through a picker, so it can't read a
  folder pasted in by ID or create the subfolder inside it. `drive.readonly` can't
  create files.
- **Filenames are untrusted student text.** They are written to the sheet as plain text
  (leading `'`) so a name like `=IMPORTXML(...)` never becomes a formula.
- **Re-runs are safe.** A file already in the Key tab (same assignment, user ID, original
  filename) is skipped. A run stops itself at 5 minutes; run it again to continue.
  The Flagged tab is replaced on every run.
- **Typed answers become PDFs.** Text-entry submissions arrive as
  `name[_LATE]_userID_text.html` (one number, no submission ID). They're converted to
  PDF with Google's own `getAs('application/pdf')`, because many AI tools refuse `.html`.
  The Key's original filename is `text.html`. Not yet checked: whether Canvas puts the
  student's name inside that HTML.
- **Files with no extension get one from their first bytes.** Seen 10/19: an upload
  named just `file` that was a PNG screenshot. Recognized: PDF, JPEG, PNG, GIF, HEIC,
  and Office files (by the zip's `word/`, `ppt/`, `xl/` folders). Anything else is
  flagged, not guessed.
- **Strip nothing else for now.** File contents and document metadata (for example a
  PDF's author field, or a name typed on the first page) are not changed.

## Privacy notes

- The Key tab is the re-identification key. Keep this spreadsheet private.
- The `anonymized` folder sits inside the original folder. Share the `anonymized`
  folder itself, never its parent.
- Logs hold counts and the assignment ID only.

## Not yet verified

- Tested in Google with made-up files (10/18) before the Index tab existed. The Index
  version is tested offline only. The filename pattern follows Canvas's usual
  bulk-download format; check the Flagged tab on the first real download.
- The second number in Canvas filenames is treated as the submission ID but isn't
  stored or used. Only the user ID goes into the code.
