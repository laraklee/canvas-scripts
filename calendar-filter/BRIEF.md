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
- If clasp says "Skipping push", the remote `appsscript.json` differs (its manifest
  question was answered no). Compare scopes; if the change is intended, add `--force`.
  First push to the template (2026-11-10) needed it for formatting only.

## Web app version: moved to `calendar-builder/` (11/10)

A colleague's Apps Script web app lets teachers pick their class periods from the bell
schedule, rename them, and download a one-time .ics file (it does not write to Google
Calendar). The pilot that blends it with this project's faculty-calendar picking and sync
lives in `calendar-builder/`; see its BRIEF. Changes to `Feed.js` or `Sync.js` here may
need copying there.

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
