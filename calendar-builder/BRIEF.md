# calendar-builder — Brief

Faculty Calendar Builder: a web app (HTML page, no spreadsheet) where a teacher picks
their class periods from the bell schedule and the school events they want from the
faculty calendar, then adds them to their own Google Calendar. A pilot for teachers who
find the spreadsheet version (`calendar-filter/`) intimidating.

Started 2026-11-10 by blending two projects:
- A colleague's "Faculty Custom Calendar Builder" web app (permission given to tinker):
  the page, the period checkboxes, and the "Rename to" boxes. It reads the bell schedule
  and makes a one-time .ics download. Details of the original in the private notes repo.
- This repo's `calendar-filter/`: reading the faculty calendar, picking event titles, and
  syncing into a separate Google Calendar with tagged events (`Feed.js`, `Sync.js`).

Does not call Canvas. No student data: both calendars are school schedules.

## Decisions (2026-11-10)

- **Two source calendars, two target calendars.** The bell schedule feeds "My Classes";
  the faculty calendar feeds "School Events". Each target calendar has its own sync tag,
  so either can be hidden or deleted without touching the other.
- **Manual sync only.** A "Sync now" button; no nightly trigger. Schedules don't change
  often enough to need one.
- **Signed in as the teacher.** The web app executes as the user accessing it, access
  `DOMAIN`. Each teacher grants calendar access once. Their picks and period names are
  saved in their own User Properties.
- **No feedback button for the pilot.** The original emailed reports; running as the
  teacher, that would need send-mail permission from everyone. Teachers tell Lara directly.
- **Keep the .ics download** as a smaller second option, for Apple or Outlook users.
- **No school details in code.** The two source calendar IDs are read from Script
  Properties (`BELL_SCHEDULE_ID`, `FACULTY_CALENDAR_ID`); they are not secrets, but
  they contain the school's domain and this repo is public.

## Plan

1. This BRIEF. (done)
2. Bring in the colleague's code as `Code.js` and `Page.html`, minus the feedback
   feature, his email, and the hardcoded calendar link. (done 11/10; otherwise it works
   as his did, parser bugs included, so it can be tested against the original)
3. `clasp create` a new standalone web app (ask Lara first). `clasp create` may write its
   own `appsscript.json`: keep ours (scopes and `webapp` settings). Then set the Script
   Property `BELL_SCHEDULE_ID` in the editor (Project Settings > Script Properties); the
   ID is in the private notes repo.
4. Add a "School events" section built from the faculty calendar's titles.
5. "Add to my Google Calendar" using `calendar-filter`'s sync logic. `Events.js` there
   reads Sheet tabs, so the choosing step is rewritten to work from saved settings.
   Keep/hide words and per-event overrides are left out of the pilot.
6. Keep the .ics download as a fallback.

## Open questions

- Bell schedule: read with CalendarApp (needs the teacher subscribed; the app could
  subscribe them) or download its ICS like the original? The faculty calendar's ICS link
  gave HTTP 429 errors from Apps Script, so CalendarApp is the safer default.
- Who maintains it after the pilot, and which teachers try it first.
- The page allows embedding on any site (`XFrameOptionsMode.ALLOWALL`), kept from the
  original, probably for Google Sites. Keep it only if the pilot is embedded somewhere.

## Known issues in the original to fix along the way

- An event marked `VALUE=DATE-TIME` would be treated as all-day.
- Commas or semicolons in a new name aren't escaped in the .ics.
- The date filter compares UTC dates, so a late event on the last day can drop out.
- Repeating events are filtered only by their first date.
