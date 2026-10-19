# anonymize-submissions — Project Brief

Pseudonymizes a Canvas "Download Submissions" set so student work can be shared or
reviewed without names. A script bound to a Google Sheet; menu **Anonymize**.
One Sheet per course: copy a clean template (Instructions tab only) for each course,
then set the passphrase once in each copy (User Properties belong to one script copy).

## Index tab (Index.js)

B1 holds the link to the course's AI grading folder. Each assignment's Canvas download
goes in its own subfolder. **Refresh folder list** adds a row per new subfolder:
Folder (linked name), Short name (defaults to the folder name), Assignment ID (Lara
types it), Anonymized and Matched (status + time, written by the script), Folder ID.
Lara clicks a row, then **Anonymize selected row** or **Match AI results for selected
row**: no prompts. The same three functions can be assigned to drawn buttons:
`refreshFolderList`, `anonymizeSelectedRow`, `matchSelectedRow`. Checks: row is on the
Index, assignment ID is digits and on one row only, short name not used by another ID.

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
5. Grades are entered in Canvas by hand. Numeric scores stay numbers so they copy cleanly.

## Decisions

- **Passphrase lives in User Properties (`ANON_PASSPHRASE`), not Script Properties.**
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
