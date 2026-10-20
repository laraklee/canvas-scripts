# assign-sheet — Project Brief

The Biology course Assignment sheet (script ID `145GSzd8oPIJ…`). Menu **Canvas Tools**.
Builds the Q1–Q4 schedule sheets from the master calendar, and posts rows of the
**calendarEvents** sheet to Canvas as calendar events and/or announcements.

> **Where we left off (2026-10-19)**
>
> - **Step 1 done, pushed, tested:** `05_CanvasApi.js` (`canvasGet_`, `canvasWrite_`,
>   DRY_RUN, retries/back-off) and `06_Credentials.js` (**Set Canvas token**: User
>   Properties `CANVAS_BASE_URL` and `CANVAS_TOKEN`), adapted from course-manager-jupiter.
>   Menu items Set Canvas token, Test Canvas connection, Dry run: show status / switch
>   on/off all work. The old "Set API Key" item (showed part of the token) is gone.
> - **Step 2 done, pushed, tested:** `processUnifiedSheetForCanvasWithLinks`
>   (name kept; the drawn **Post selected rows to Canvas** button calls it) now sends
>   through `canvasWrite_`. See "Post selected rows" below. Tested in sandbox course 4573
>   (dry run, real post, already-posted skip, missing date, wrong sheet: all pass);
>   Biology `*Config*` B4 set back to the real course afterward.
> - **Pushed to Gastronomy and AI9** too (see "Other sheets using this code"); token set
>   and a dry run checked in each.
> - **Dry run is OFF on all three sheets**, by Lara's choice, for everyday posting.
> - **Next (step 3a):** add a "Post selected rows to Canvas" menu item (`00_Config.js`).
> - **Then (step 3b):** as a separate careful change, an explicit narrow `oauthScopes`
>   list in `appsscript.json` (it needs full `spreadsheets` if the master sheet is
>   opened by ID; check first). Each sheet re-authorizes once afterward.

## Other sheets using this code

Gastronomy and AI9 Assignment sheets run the same code (checked identical to commit
`8d4fe03` on 2026-10-19). Settings files: `.clasp-gastronomy.json`, `.clasp-ai9.json`.
Push from `assign-sheet/` after pushing Biology:
`clasp push -P 'C:\Users\lalee\Code\canvas-scripts\assign-sheet\.clasp-gastronomy.json'`
(same for `-ai9`). On Windows, clasp 3.4.1 needs the full backslash path (relative paths
and `/` fail its security check). On the Mac, use the full path. After the first push to
each sheet: reload, **Set Canvas token**, check dry run is ON, one dry run.

## Post selected rows (03_Content_Sync.js)

calendarEvents sheet: header row 2, data from row 3. Columns: A Calendar ☐, B
Announcement ☐, C Title, D Body, E Calendar Date, F Delayed Post, G Replies? ☐,
H event link, I announcement link.

- Runs only if C2 = "Title" and D2 = "Body". Course ID from `*Config*` B4 (must be digits).
  Canvas address comes from Set Canvas token, not `*Config*` B2.
- Canvas writes (both via `canvasWrite_`, so DRY_RUN applies):
  `POST /api/v1/calendar_events` (all-day) and
  `POST /api/v1/courses/:course/discussion_topics` with `is_announcement`.
- Skips a part whose H/I cell already has a link or "View …" text (no duplicates; clear
  the cell to post again). Leaves unchecked status cells alone. Refuses if Calendar is
  checked with no date. Asks before sending; dry run writes "Dry run OK".
- Replies? sends `lock_comment: true` when unchecked. (The old code sent
  `allow_student_to_reply`, which Canvas ignores.)
- The rest of the project's older code still uses `var`; it works, so update it only
  when a file is being changed anyway.
