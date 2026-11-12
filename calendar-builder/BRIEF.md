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

- Script ID: `1NRaFfistbupSsmqwS1hucP0YNaUhMa6g6UVrgbKuhSgWA8ePDRuyKN9J` (standalone,
  "Faculty Calendar Builder (pilot)", in Lara's account; created 2026-11-10)
- **Another editor may change the script in Google** (the original author, once shared).
  So before every `clasp push`: commit, run `clasp pull`, then `git diff`. No differences =
  push as usual. Differences = edits made in Google: show Lara, then commit them as the other
  editor's change (or restore with `git checkout` if she says so) before pushing. Never push
  over a diff without showing her.
- Push from this folder with plain `clasp push` (ask Lara first). If clasp says "Skipping
  push", the manifest in Google differs; if the change is intended, add `--force` (the
  first push, 11/10, needed it to replace Google's default manifest).

## Decisions (2026-11-10)

- **Two source calendars, two target calendars by default.** The bell schedule feeds "My
  Classes"; the faculty calendar feeds "School Events". Each group has its own sync tag,
  so either can be hidden or deleted without touching the other.
  **Changed 11/11:** the teacher may pick any calendar they own for each group (one
  calendar for both, or their main calendar), but only by actively choosing it in the
  page's "Where Your Events Go" menus; the two new calendars stay the default. The page
  explains how it works. Changing the choice later moves the events on the next sync
  (the old calendar is left empty; the app never deletes calendars). Because the main
  calendar can't simply be deleted, step 5c adds "Remove everything this app added".
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
3. `clasp create` a new standalone web app. (done 11/10; clasp replaced
   `appsscript.json` with Google's default, so ours was restored from Git.) Script
   Property `BELL_SCHEDULE_ID` set (the ID is in the private notes repo), pushed, and
   tested from a test deployment 11/10: date range, period picks, renames, and all-day
   events all came through correctly in the .ics.
   **Tip:** copy and paste Script Property names into the editor. A typed
   `BELL_SCHEDULE_ID` didn't match (probably a hidden character) until it was pasted.
4. Add a "School events" section built from the faculty calendar's titles. (done 11/11:
   pushed with `--force` for the new scope, `FACULTY_CALENDAR_ID` set, and tested from the
   test deployment; the full title list loaded, most frequent first.) `SchoolEvents.js` reads the faculty calendar with
   CalendarApp (read-only scope `calendar.readonly`; step 5 will need full `calendar`),
   so each teacher must have it in their Google Calendar list; the page says so if not.
   Titles are grouped like `calendar-filter` (without "CHANGED: ..." notes), with a count,
   the next date, and a search box. Picks are saved from step 5a on. Needs Script
   Property `FACULTY_CALENDAR_ID` (same calendar ID `calendar-filter` uses; paste the name).
5. "Add to my Google Calendar" using `calendar-filter`'s sync logic. `Events.js` there
   reads Sheet tabs, so the choosing step is rewritten to work from saved settings.
   Keep/hide words, per-event overrides, and "adopting" look-alike events are left out
   of the pilot. Split into three parts, each pushed and tested on its own:
   - **5a. Saved choices** (done 11/11, including the follow-ups below; all pushed).
     `Settings.js` saves
     the teacher's choices as JSON in User Property `BUILDER_CHOICES` (auto-saved about a
     second after each change) and fills them back in when the page opens. Period rules
     moved from the page to `Periods.js` as plain data, so the .ics and the sync use the
     same rules. New card 5, "Where Your Events Go", with a menu per group (new calendars,
     main calendar, or any calendar the teacher owns; listing them is read-only). Typing a
     period's new name checks its Keep box. No new permissions, no calendar writes.
     **Follow-up (11/11):** school events load by
     themselves when the page opens (and again when the dates change), so saved picks
     show without a click. Card 5 is now "Get Your Calendar" with two options: **A. Add to
     my Google Calendar** (holds the calendar menus; button greyed out until 5b/5c) and
     **B. Just download an .ics file** (one-time snapshot, no menus; fetches the bell
     schedule itself if it isn't loaded). Some teachers will only want the .ics.
     Tested 11/11: the list and the .ics (116 events, Aug to May) worked.
     **Then (pushed 11/11):** the bell schedule also loads by itself when
     the page opens (cheap now that the copy is shared). Card 1 is a status line with a
     "Try again" button only on failure; "use your own .ics file instead" stays as the
     override, and a file picked while the automatic load runs is not overwritten.
   - **Events already in a calendar (decided 11/11):** events the app added carry its tag
     and are kept, replaced if changed, or removed if no longer picked. An untagged event
     with the same title and start time (added by hand, or imported from an earlier .ics)
     is **left alone and no copy is added**; the preview counts these ("already in your
     calendar"). No adopting: the app never takes over a teacher's own event. Trade-off:
     if such an event later changes at school, the new version is added beside the old
     one; the preview should say so.
   - **5b. Preview only.** An "Add to my Google Calendar" button shows per calendar what
     would be added, updated, removed, or moved. Still read-only. The server reads the
     bell schedule from its public ICS link (as the page does) with `calendar-filter`'s
     parser, so teachers needn't subscribe to it.
     **Done 11/11** (pushed; Lara's preview looked right). `Ics.js` = `calendar-filter`'s parser
     (copied). `Sync.js` builds the plan: the page's choices are saved first; classes come
     from the shared bell schedule copy (date filter in Hawaii dates, so the 9/30 problem
     doesn't happen here), school events from the faculty calendar (skipped if none are
     picked). Tags: `builderClassUid`, `builderEventUid`, `builderHash`. It reads the target
     calendars plus the ones in User Property `BUILDER_LAST_CALENDARS` (written by 5c), so
     "move" only appears after a real sync. The page's preview box lists add / move /
     update / remove / already there / up to date per group, with up to 5 examples each;
     any change to the choices hides an old preview. Confirm stays greyed out.
   - **5c. Write.** Confirm after the preview; full `calendar` scope. Creates the new
     calendars only if missing; creates tagged events; deletes or re-creates only events
     with this app's tag, in the chosen calendars, inside the date range. Continues in
     rounds past the 6-minute limit. Adds "Remove everything this app added".
     **Done 11/11: pushed and tested** (Lara's first real Confirm worked). Write calls approved by Lara 11/11, all in
     `Sync.js` under "Calendar writes": `createAppCalendar_` (new calendar, Hawaii time),
     `createAppEvent_` (tags it and **turns reminders off**, decided 11/11 so a main
     calendar's default pop-up doesn't fire for every class), `deleteAppEvent_` (refuses
     any event without the app's tag). `confirmSync` re-plans every round (never trusts the
     earlier preview), runs about 4½ minutes, and the page keeps calling it with progress;
     Google "slow down" errors wait 30 s, and 6 in a row with no progress stop with a
     come-back-later message (likely the daily limit). A user lock stops two runs at once.
     `BUILDER_LAST_CALENDARS` is now a list per group, saved before writing and **never
     shortened**, so events outside today's date range in an old calendar can't be lost.
     A calendar the app created is found through that list first (Google can be slow to
     list a new calendar by name, which could otherwise create a second "My Classes").
     "Remove everything" checks those calendars plus the current choices, 2 years back to
     3 ahead, shows counts per calendar, then removes in rounds. Scope is now full
     `calendar` (teachers approve again; push needs `--force`).
     **Progress (11/11, after testing):** with 4½-minute rounds the page looked stuck, so
     rounds are now about 1 minute (`ROUND_LIMIT_MS`), and Confirm and "Remove everything"
     show a spinner, a running clock, "64 of 312 changes done (added 60, updated 4)" and a
     progress bar. The total starts from the preview and is corrected each round (done so
     far + what's left). A Google "slow down" pause shows a 30-second countdown.
6. Keep the .ics download as a fallback. **Done 11/11: pushed and tested** (Lara's real
   schedule: 462 events, 311 classes and 151 school events, no line over 75 bytes).
   The file is now built on the server (`IcsExport.js`, `buildIcsFile`, read-only) from the
   same lists the sync uses (`classItems_`, `schoolEventItems_`), so the download and "Add to
   my Google Calendar" always agree, and the checked school events are in the file too.
   Dates are filtered in Hawaii time (fixes the 9/30 bug); titles, places, and notes are
   escaped (commas, semicolons, backslashes, line breaks) and long lines folded; each event
   has a stable UID (`class-` or `event-` + source ID + `@calendar-builder`). The page shows
   what's in the file ("312 classes and bell schedule events and 24 school events").
   **Decided 11/11:** a teacher's own .ics file (card 1) is used for the download only;
   "Add to my Google Calendar" always uses the official bell schedule, and the page says so
   (mixing a personal file into the sync could swap every class for a different copy).

## Beta

- **Beta 1 (deployed 11/11):** version 1, `clasp deploy -d "Beta 1"`, for two colleagues.
  The `/exec` link and deployment ID are in the private notes repo. Testers get
  `BETA-NOTE.md` (a draft message; paste the link in). The link stays on version 1: to send
  a fix, `clasp push`, then `clasp deploy -i <deployment ID> -d "Beta 2"` (ask Lara first),
  so the link doesn't change. The test deployment (`@HEAD`) is still Lara's for trying changes.
- The beta should answer the faculty calendar question below: does card 4 load for others?

## Open questions

- Bell schedule: read with CalendarApp (needs the teacher subscribed; the app could
  subscribe them) or download its ICS like the original? The faculty calendar's ICS link
  gave HTTP 429 errors from Apps Script, so CalendarApp is the safer default.
  **Leaning ICS (11/11):** the ICS link spares teachers a subscription, but it hit a 429
  during 5a testing (11/11). Google's limit isn't per teacher, and many teachers will use
  this at once (first week of August). Fix (11/11, `Code.js`): one downloaded copy is
  shared through the Script Cache (fresh 1 hour, kept 6 hours as a fallback when Google
  says no), a script-wide lock so only one teacher downloads at a time, and 4 tries with
  waits of 2, 4, and 8 seconds. Page load only tries once and never waits. So a schedule
  change can take up to an hour to show. If 429s still happen, switch the bell schedule to
  CalendarApp (5c could add the calendar to each teacher's list).
- **Faculty calendar ID for other teachers (decide before the pilot opens).** The ID in
  `FACULTY_CALENDAR_ID` ends in `@import.calendar.google.com`, so it may be one person's
  "From URL" copy that other teachers can't open. Options: use the school's original
  Google calendar ID if there is one, share the imported copy with the domain, or read
  the ICS link (which hit 429 errors). Test by having one colleague open the page.
- Who maintains it after the pilot, and which teachers try it first.
- The page allows embedding on any site (`XFrameOptionsMode.ALLOWALL`), kept from the
  original, probably for Google Sites. Keep it only if the pilot is embedded somewhere.

## Known issues in the original to fix along the way

- An event marked `VALUE=DATE-TIME` would be treated as all-day. Fixed in step 6 (the
  server's parser reads the date value itself, not the marker).
- Commas or semicolons in a new name aren't escaped in the .ics. Fixed in step 6.
- The date filter compares UTC dates, so a late event on the last day can drop out, and
  an afternoon event the day before the start date slips in (seen 11/11: a 2:05 pm class
  on 9/30 came through with an Oct 1 start). Fixed in step 6 (Hawaii dates).
- Typing a "Rename to" name doesn't check that period's Keep box, so the period is
  silently left out (happened in testing 11/11). Fixed in 5a: typing a name checks the box.
- Repeating events are filtered only by their first date.
