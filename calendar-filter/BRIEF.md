# calendar-filter — Brief

School Calendar Filter: copies picked events from the school's Faculty Calendar into a
Google Calendar of the teacher's own. Bound to the Sheet "Google Calendar Utility 8.2025".

- Script ID: `1N-ZSDpFF56Y9J7_91a3kDTT9hgRyVaeb41cUeDkW9fssD-QXbIdQMfKX`
- Sheet: `1Rmojvg6OGadgMr7jisXUsf7rwwYBo1raVfCJ1Wi4Ieo`

## Other sheets using this code

- **Template copy** (added 2026-11-10): script ID
  `1GM9Db5mdfB1TSdKVCzYb6u6giQfXpd_IF7KqGSAMVnD1aB8a7qzrAhIe`, settings file
  `.clasp-template.json`. Claude never opens the template's sheet; Lara looks after its
  tabs and settings. clasp updates code only: tab or label changes go on by hand.
- Push order: Lara's sheet first (plain `clasp push`), then the template, from this folder:
  `clasp push -P "$PWD/.clasp-template.json"`. Ask Lara before each push.

## Pilot idea: web app with a colleague (11/9, not started)

A colleague built an Apps Script web app (HTML page, no spreadsheet) where teachers pick
their class periods, rename them, and push them to their Google Calendar. Idea: merge this
project's "pick events from the faculty calendar" into his UI as a pilot for teachers who
find spreadsheets intimidating. **Waiting on:** whether he'll share his code.

When it arrives: make a new project folder with its own BRIEF.md, read both, and draft a
merge plan before building. Suggestions so far:
- His UI as the shell; this project's Feed / Events / Sync logic behind it.
- Two separate calendars ("My Classes", "School Events"), each with its own sync tag, so
  either can be hidden or deleted and the syncs never touch each other's events.
- Each teacher's picks saved in their own User Properties instead of Sheet tabs.
- Web app runs as the user accessing it; access `DOMAIN`.
- One click to subscribe the teacher to the faculty calendar (removes a setup step).

Open questions for the two of them: whose code is the base, where it lives and who
maintains it, and trying it with a few teachers first.

## Decisions

- **Sync into a separate calendar, not the personal one.** The default "Copy TO" is a new
  calendar ("Faculty Calendar (filtered)"). It starts empty, so nothing needs matching, it
  can be shown or hidden in one click, and deleting it undoes everything. Syncing into a
  personal calendar works (untagged events with the same title and start are "matched"),
  but old hand-made copies with a different time or title end up duplicated.
- The school calendar is read directly with CalendarApp (the teacher must subscribe to it).
  Fetching its public ICS link from Apps Script got HTTP 429 errors.
- The school calendar only keeps about one month of past events, so set up early in the year.

## Saved one-off tools

- **Cleanup of synced events in the main calendar** (November 2026). Used once, after
  moving from the personal calendar to a separate one. It deleted every event carrying the
  sync's tag from the default calendar, with a preview function first. Removed from the
  live script so copies of the Sheet don't carry it. To bring it back:

  ```bash
  git show 8e4b90b:calendar-filter/Cleanup.js > calendar-filter/Cleanup.js
  ```
