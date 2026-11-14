# master-calendar — Brief

The script bound to Lara's **MasterCalendar.LKL** sheet: one tab per school year (e.g.
`2026.2027`), one row per school day. The assign-sheet workbooks and
course-manager-jupiter read their dates, schedules and class times from it (*Config* in
those workbooks holds this sheet's ID and the school year).

- Sheet: `1q8aa5wm2MNVLvS7ltLLEA5TFPzChwb7cQYRL200SDfU`
- Script ID: `1Bv5GNaHEde-zfTGT5DfZuR_ve4Un0qH2dySmHAVXCbF-GB_lhpYOsu54` (bound to the sheet)
- Brought into the repo 2026-11-13 with `clasp clone`.
- Does not call Canvas. No student data: the school calendar is a schedule.
- Calendar IDs, feed links and the old download link: details in the private notes repo
  (`notes/master-calendar.md`). They contain the school's domain.

## The year tab (e.g. `2026.2027`)

| Col | What | Filled by |
|---|---|---|
| A Q, B Wk | quarter, week | typed |
| C Date | | typed |
| D Day | Mo, Tu… | formula |
| E Schedule | Lara's code: A–D, E/F with a number (E1, F3…), `r` = reversed order (3,4,1,2 or 7,8,5,6), H = holiday, plus one-offs (CH, PSAT, EX1, SpFair, ESpA, PD, GRAD) | typed, read from the school's PDF calendar |
| F Periods | e.g. `1,2,M/L,3,4` (A = advisory/assembly, M/L = meeting/lunch) | formula |
| G *Data Drills* | Lara's notes (No Chapel, MQ1, Open House…) | typed |
| H *AP Schedule* | AP exams | typed |
| I *JSON* | `[{"period":"1","start":815,"end":925},…]` | `=GET_SCHEDULE_JSON(E, F, '*schedule*'!A:D)` |

Reference tabs: `*schedule*` (schedule code + period → start/end), `*Data Sched-Per*`,
`*Data Drills*`, `*Config*` (same layout as the other projects), `*Calendar_Import*`
(output of `RefreshSchedule.js`), plus draft tabs.

## Code (as cloned)

- `Code.js`: `GET_SCHEDULE_JSON` custom function for column I. Looks each period up in
  `*schedule*`, so a day with special times (Christmas, Easter, Fair Day) gets the plain
  letter's times instead.
- `RefreshSchedule.js`: `syncFutureDraftSchedule()` reads a faculty calendar .ics that was
  downloaded by hand and uploaded to Drive, and lists day titles in `*Calendar_Import*`.
  **Changed in the repo, not yet in Google:** the Drive file name it looks for is now
  `faculty_master.ics` (the school's name was removed for the public repo). Expected to be
  replaced (see the plan below).
- `appsscript.json`: no `oauthScopes` list yet. `DriveApp.getFilesByName` makes Google ask
  for all of Drive. The replacement should not need Drive at all.

## Findings (2026-11-13)

The PDF is read by eye, and the school publishes the same schedule as a public Google
calendar, **"Bell Schedule with Periods"**: one all-day event per day with the schedule
title (e.g. `E3 Schedule (3,4,1,2) (Grs. 11&12 Chapel)`), plus a timed event for each
period. It keeps the whole year and earlier years (Oct 2024 to 6/3/27 on 11/13). A
second "Bell Schedule" calendar has titles only and keeps only about a month back.

Compared with the `2026.2027` tab, the codes match on almost every day. Four days are
wrong in the sheet (wrong periods or times in F and I):

| Date | Sheet | Calendar |
|---|---|---|
| 12/15/26 | Fr (7 at 8:15) | Special Christmas Schedule (7,8,5,6), 7 at 9:40 |
| 2/26/27 | Er (1 at 12:35) | E3 (3,4,1,2), 1 at 10:45 |
| 4/2/27 | E (1 at 8:15) | Special Easter Schedule (1,2,3,4), 1 at 9:40 |
| 4/28/27 | E (1 at 8:15) | E1 (1,2,3,4), 1 at 8:40 |

**The calendar has gaps too:** 9/16/26 (C day) has no Period 5 event. Any import must
flag days whose period count doesn't fit the letter (6 for A–D, 4 for E/F) instead of
trusting the calendar blindly.

The sheet's codes can be built from the titles: letter and number from the title, `r` when
the order is (3,4,1,2) or (7,8,5,6); holidays, breaks and "NO US CLASSES" → H; titles
ending in `(LS)` are Lower School and skipped. One-offs (Fair Day, PSAT, Chapel schedule,
exams) need a short lookup table.

2027-28 is not in the calendar yet (on 11/13). If the PDF comes out first, start from the
PDF and check against the calendar once it's loaded.

## Test tab (built and pushed 11/13, commit `361a828`; not run in Google yet)

Lara's choices 11/13: try it in a **Test** tab, as if the year hadn't started, so the real
`2026.2027` tab (read by many projects) is never touched. Suggest *Data Drills* notes
from the calendars as defaults for Lara to check.

Menu **Master Calendar › Build Test tab from calendars…** (`BuildTest.js`; parser
`Ics.js`, copied from calendar-builder). Asks for the school year, then writes only the
Test tab:
- **From "Bell Schedule with Periods":** C Date, D Day (same formula as the year tabs),
  E Schedule (code built from the title), F Periods (from the timed events: Meeting/Lunch
  → M/L, Meeting then Lunch → M/L, Assembly or Chapel/Assembly → A, Chapel 1/2 → Ch-A/Ch-B,
  Homeroom and Break left out), I JSON (periods with their real times). Days with no timed
  events (holidays, PSAT, exams) take F from `*Data Sched-Per*`.
- **A Q, B Wk:** a new quarter after a gap of more than 7 days (the long breaks); weeks
  counted Monday to Friday.
- **Rows:** weekdays from the first school day to the last exam day. Breaks left out; a
  holiday next to a break counts as the break (as in the year tabs).
- **G *Data Drills*, grey italic = suggestions:** First Day of School, No Chapel,
  holidays, special schedules (from the day titles), plus Faculty Calendar events matching
  `DRILL_PATTERNS_` (Open House, MQ from "End of … Mid-Quarter", exams, Senior Camp, SAC
  Review, Christmas/Easter Chapel, awards, Honors Day…). Expect some noise (e.g. other
  open houses). The Faculty Calendar keeps only about a month back.
- **H** left blank (AP exams aren't in any feed).
- **J Review (yellow rows):** wrong number of periods for the letter (6 for A–D, 4 for
  E/F, 8 for CH), a guessed code (special schedules), a code not in `*Data Sched-Per*`,
  or periods that differ from it.
- **K:** differences from the year tab of the same name, if it exists (read only).
- Exam days: the Bell Schedule may only say "NO US CLASSES" (12/17–18/26); a Faculty
  Calendar exam note makes them EX1, EX2….
- Calendar links are read from Script Properties `BELL_PERIODS_ICS_URL` and
  `FACULTY_ICS_URL` (links in the private notes repo).

**Setup side panel** (Lara, 11/13: setup as a side panel, like the other projects;
replaces the first version's two prompts). **Master Calendar › Setup…**
(`SetupPanel.js`, `SetupPanelPage.html`):
1. *Calendar links:* ✓/⚠ saved or not for each link, and **Test links** (downloads both;
   shows the number of events and the first and last dates, or the error).
2. *Set or change the links:* a box per link, filled in with the saved one; **Save**
   checks each looks like an https …ics link (saves nothing if one doesn't), then runs
   Test links. A blank box keeps the saved link.

Offline run on 11/13 (downloaded feeds, 2026.2027): 184 days, 8/10 to 6/3. Matched the
real tab apart from the expected days: the four above, 9/16 flagged, 12/4 (calendar: plain
E; the PDF had Christmas Chapel there before it moved to 12/15), 12/15 coded `FSpAr` (new
code, flagged), 2/12 (`?`, "NO US & LS CLASSES"; Lara had PD), 4/16 Fair Day periods listed
instead of "All", 6/5 Graduation (not in the calendar).

**Permissions** (`appsscript.json`, now listed): this spreadsheet, pop-ups, fetching web
addresses. No Drive, so `RefreshSchedule.js` (which reads a Drive file) no longer runs;
the Test tab replaces it. `GET_SCHEDULE_JSON` is unchanged.

Next: push the Setup panel (ask first), save the two links in Setup, run Build Test tab
for 2026.2027, Lara compares. Later:
decide how a real year tab gets made (copy Test, or a "Build year" item), and fix the
real tab's wrong days once Lara confirms.
