# Getting started again (paste onto the Home tab)

For coming back to the code after a long break. Using the workbook day to day needs none
of this; see `USER-GUIDE.md` in the project folder.

## Mac

1. Open the **Claude** app › **Code** tab. Open the folder **code › canvas-scripts**
   (`/Users/lalee/code/canvas-scripts`).
2. First message to Claude: *"Read CLAUDE.md and course-manager-jupiter/BRIEF.md, then
   git pull."* (Claude asks before every command; say yes to the pull.)
3. Tell Claude what you want or what broke: which button or menu item, and the exact
   message. **No student names, IDs, grades, or screenshots of student rows.**
4. Claude's steps, one at a time, each with your OK: edit › checks + scan › show the diff
   › commit + git push › **clasp push** (asks separately) › you test in the Sheet.
5. Test safely: dry run ON first. For real writes, set `cfg_CourseID` to the test course
   (Sequence 9), then set it back and turn dry run ON again.
6. Before you stop: ask Claude to **git push**, so the PC gets the changes. Ask it to
   update BRIEF.md with where you left off.
7. If clasp says you're not logged in: run `clasp login` (it opens a browser to sign in).
   Never share or open the file `.clasprc.json`.

## PC

1. Open the **Claude** app › **Code** tab. Open your **canvas-scripts** folder on the PC.
2. First message to Claude: *"Read CLAUDE.md and course-manager-jupiter/BRIEF.md, then
   git pull."* **Always pull first on the PC**: the Mac may have newer work.
3. Tell Claude what you want or what broke: which button or menu item, and the exact
   message. **No student names, IDs, grades, or screenshots of student rows.**
4. Claude's steps, one at a time, each with your OK: edit › checks + scan › show the diff
   › commit + git push › **clasp push** (asks separately) › you test in the Sheet.
   **Never clasp push before pulling**: an older copy would overwrite Google.
5. Test safely: dry run ON first. For real writes, set `cfg_CourseID` to the test course
   (Sequence 9), then set it back and turn dry run ON again.
6. Before you stop: ask Claude to **git push**, so the Mac gets the changes. Ask it to
   update BRIEF.md with where you left off.
7. If clasp says you're not logged in: run `clasp login` (it opens a browser to sign in).
   Never share or open the file `.clasprc.json`.

## Good to remember

- Code lives in Git (GitHub: `laraklee/canvas-scripts`); the workbook's script is a copy
  that `clasp push` updates. The brief (`course-manager-jupiter/BRIEF.md`) records every
  decision; Claude reads it first.
- Only the **Biology** workbook gets `clasp push` today. The template archive is frozen.
- What's still only in the old code: `course-manager-jupiter/docs/still-in-legacy.md`.
