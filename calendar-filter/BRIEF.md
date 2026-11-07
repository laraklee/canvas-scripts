# calendar-filter — Brief

School Calendar Filter: copies picked events from the school's Faculty Calendar into a
Google Calendar of the teacher's own. Bound to the Sheet "Google Calendar Utility 8.2025".

- Script ID: `1N-ZSDpFF56Y9J7_91a3kDTT9hgRyVaeb41cUeDkW9fssD-QXbIdQMfKX`
- Sheet: `1Rmojvg6OGadgMr7jisXUsf7rwwYBo1raVfCJ1Wi4Ieo`

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
