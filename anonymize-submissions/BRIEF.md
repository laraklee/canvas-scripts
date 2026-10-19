# anonymize-submissions — Project Brief

Pseudonymizes a Canvas "Download Submissions" set so student work can be shared or
reviewed without names. A script bound to a Google Sheet; menu **Anonymize**.

## What it does

1. Asks for a Drive folder (link or ID) and the Canvas assignment ID (once per run).
2. Reads every file directly in that folder. Zips are unzipped in memory with
   `Utilities.unzip`; loose files are used as they are. Both can be in the folder.
3. Parses each filename as `name[_LATE]_userID_submissionID_originalFilename`.
   Anything that doesn't match goes to the **Flagged** tab and is not copied. Nothing
   is guessed.
4. Code = `S-` + the first 6 hex characters (uppercase) of
   HMAC-SHA256(`userID:assignmentID`, passphrase), for example `S-9C1E4B`.
5. Saves a renamed copy into an `anonymized` subfolder, keeping the original extension.
   If a student has several files: `S-9C1E4B.pdf`, `S-9C1E4B-2.docx`, … (in filename order).
6. Adds one row per file to the **Key** tab: Name, Canvas user ID, Assignment ID, Code,
   Original filename, Late, Anonymized filename.

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
- **Strip nothing else for now.** File contents and document metadata (for example a
  PDF's author field, or a name typed on the first page) are not changed.

## Privacy notes

- The Key tab is the re-identification key. Keep this spreadsheet private.
- The `anonymized` folder sits inside the original folder. Share the `anonymized`
  folder itself, never its parent.
- Logs hold counts and the assignment ID only.

## Not yet verified

- Not yet run in Google. The filename pattern follows Canvas's usual bulk-download
  format; check the Flagged tab on the first real download.
- The second number in Canvas filenames is treated as the submission ID but isn't
  stored or used. Only the user ID goes into the code.
