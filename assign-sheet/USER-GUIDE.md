# Assignment Sheet — User Guide

For teachers using a course Assignment sheet (Biology, Gastronomy, AI9, or a copy).
Everything here is on the **Canvas Tools** menu at the top of the sheet, next to Help.
If you don't see the menu, reload the page and wait a few seconds.

The sheet does two jobs:

- **Keeps your quarter schedules** (Q1–Q4 tabs) in step with the school's master
  calendar. The Q tabs come with the workbook; the script refreshes the data they read.
- **Sends things to Canvas:** calendar events, announcements, and assignment dates.

> **Which tools change Canvas?** Only two: *Post selected calendarEvents rows to
> Canvas* and *Send changed dates to Canvas*. Everything else only reads Canvas
> or works inside the sheet. The tools that change Canvas always show you what they
> will do and ask **Yes/No** before sending.

---

## 1. First-time setup

Do this once per sheet, per teacher.

### Your Canvas token

The sheet talks to Canvas using your own **access token**, a long password-like code
that Canvas makes for you. It is saved to **your Google account only**: other people
who can edit the sheet cannot see it, and it is never shown on the sheet.

1. In Canvas, go to **Account › Settings**, scroll to **Approved Integrations**, and
   click **+ New Access Token**. Give it a purpose (for example "Assignment sheet") and
   copy the token. Canvas only shows it once.
2. In the sheet: **Canvas Tools › ⚙️ Setup › Set Canvas token**.
3. Box 1 of 2 asks for your Canvas web address: the start of the address bar when you
   are logged in to Canvas (for example `https://yourschool.instructure.com`).
4. Box 2 of 2: paste the token.
5. Check it: **Canvas Tools › ⚙️ Setup › Test Canvas connection** should say
   **Connected**.

To change either one later, run **Set Canvas token** again; leave a box blank to keep
what's saved. If you ever think your token was exposed, delete it in Canvas
(Account › Settings › Approved Integrations) and make a new one.

### Google's permission screen

The first time you use any Canvas Tools item, Google asks you to authorize the script.
It asks to:

- see and edit **this spreadsheet only** (not your other files);
- show menus and pop-up boxes in the sheet;
- connect to an external service (Canvas).

### The *Config* tab

| Cell | What goes there |
|---|---|
| **B2** | Your school's Canvas web address (the same one you give **Set Canvas token**). |
| **B3** | Your Canvas user ID. To find it: in your course, open **People** and click your own name. Your profile's web address ends in your ID, for example `.../courses/1234/users/5678` → **5678**. |
| **B4** | Your Canvas **course ID**: the number after `/courses/` in the course's web address. Numbers only. |
| **B5** | An email address to copy on messages. |
| **D3** | The master calendar's spreadsheet ID (used by the schedule tools). |
| **D5** | The master calendar tab for this school year. |
| **E2:F5** | Checkboxes for the period pairs you teach (1,2 · 3,4 · 5,6 · 7,8). |

Please fill in B2, B3, and B5 even though this sheet's menu tools don't use them yet.
The *Config* tab is laid out the same way in all our Canvas workbooks, and other tools
(such as Course Manager) do use them.

### Dry run

**Dry run** is a practice mode. When it's **ON**, the Canvas tools do everything except
actually send: they check your rows and write "Dry run OK" where a link or status would
go. Nothing changes in Canvas.

- **Canvas Tools › ⚙️ Setup › Dry run: show status** tells you which mode you're in.
- **Dry run: switch on/off** flips it (it asks first).
- Dry run is a setting **for the whole sheet**, not per teacher. If you share a sheet,
  check the status before you post.
- Every "Post" or "Send" confirmation box also says whether dry run is on.

A good habit when trying something new: turn dry run ON, run the tool, check the
results, then turn it OFF and run it for real.

---

## 2. Schedule tools

### 🔄 Update schedule from Master

Pulls the latest school days, schedules, holidays, and drills from the master
calendar so your Q1–Q4 tabs show them. Run it when the master calendar changes. It does
not create or redesign the Q tabs; it refreshes the data their formulas read.

- Steps 1–5 show in the bottom-right corner as it runs; wait for **Full Schedule
  Update Complete!**
- It rebuilds the helper tabs `*scheduleLookup*`, `AssignmentMaster`, and
  `AssignmentLookupFinal`, then nudges the formulas on each Q tab (cells A4 and B2) so
  they recalculate. Don't type in the helper tabs; your typing will be replaced.
- Only the period pairs checked in *Config* E2:F5 are included.
- **Does not touch Canvas.**

**Afterward:** on each Q tab, check columns **A–E** to make sure every period pair you
want is filled in. You may need to unhide those columns first (right-click the column
letters › Unhide columns).

### Your Q1–Q4 tabs

| Columns | Use |
|---|---|
| **A–E** | Filled in from the master calendar. Look, don't type. |
| **F–G** | Yours: lesson content, anything you like, including links. |
| **H** | Yours. For example, check off a row once its content is set up in Canvas. |
| **I** | Notes. |
| **J and beyond** | You can add your own columns here if you need them. |

> **Never add or delete rows on a Q tab.** Each row is tied to a calendar date, so an
> extra row shifts every date below it. Don't insert columns between A and I either.

### 🔗 Reset Master connection

Use this if the `*simpleSchedule*` tab shows `#REF!` or is empty, or after changing
*Config* D3 or D5. It re-links `*simpleSchedule*` to the master calendar.

- Afterward, look at `*simpleSchedule*` cell **A1**. If it shows `#REF!`, click the cell
  and choose **Allow access**.
- Then run **🔄 Update schedule from Master**.
- **Does not touch Canvas.**

### ☑️ Toggle checkboxes

Select a block of checkboxes (on any tab) and run this: if they're all checked, it
unchecks them; otherwise it checks them all. Handy for the calendarEvents and
Assignment Dates tabs.

---

## 3. 📅 Calendar events and announcements

**Canvas Tools › 📅 Calendar & announcements › Post selected calendarEvents rows to
Canvas** (also the drawn **Post selected rows to Canvas** button on the tab).

Posts rows of the **calendarEvents** tab to your course as all-day calendar events,
announcements, or both. **This changes Canvas** (dry run applies).

### The tab

Rows 1–3 are headers; your rows start on row 4.

| Column | What it does |
|---|---|
| **A Calendar** ☐ | Check to make a calendar event. |
| **B Announcement** ☐ | Check to make an announcement. |
| **C Title** | Required. Rows with no title are ignored. |
| **D Body** | The text of the event or announcement. |
| **E Calendar Date** | Required if Calendar is checked. |
| **F Delayed Post** | Optional: when the announcement should appear. Blank = right away. |
| **G Replies?** ☐ | Check to let students reply to the announcement. |
| **H** | Filled in by the tool: **View Event** link (or status). |
| **I** | Filled in by the tool: **View Announcement** link (or status). |

### Steps

1. Fill in the rows and check Calendar and/or Announcement.
2. **Select the rows** you want to post (click and drag down the row numbers, or any
   cells in those rows).
3. Run the menu item or click the button.
4. Read the confirmation (course number, how many events and announcements, dry run
   on or off) and click **Yes**.

### What you'll see

- **View Event / View Announcement** in H or I: posted; click to open it in Canvas.
- **Dry run OK**: checked but not sent (dry run was on).
- **Failed: …**: that item didn't post; the pop-up says why.

### Good to know

- **No duplicates:** if H or I already has a link (or "View …" text), that part is
  skipped. To post it again, clear that cell first.
- If a row has Calendar checked but no date, nothing is sent until you fix it.
- It only runs on the calendarEvents tab.
- Editing a row after posting does **not** update Canvas. Edit the event or
  announcement in Canvas directly.

---

## 4. 📝 Assignment dates

Change open, due, and lock dates for many assignments at once, in a sheet instead of
one at a time in Canvas. Uses the **Assignment Dates** tab.

### Load assignment dates from Canvas

**Canvas Tools › 📝 Assignment dates › Load assignment dates from Canvas**

Fills the Assignment Dates tab with every assignment in the course (*Config* B4).
**Read-only:** it does not change Canvas. Running it again replaces everything from
row 2 down with fresh data from Canvas, so any unsent edits are lost.

| Column | Meaning |
|---|---|
| **A Update?** ☐ | Check the rows you want to send. |
| **B–E** (gray) | ID, name (click to open in Canvas), submission type, points. Reference only: never sent. |
| **F–G Open** (green) | When students can start ("available from"). |
| **H Schedule Info** (purple) | The school schedule for the due date (from the master calendar). "No Match" means the due date isn't a school day in the calendar. |
| **I–J Due** (blue) | Due date and time. |
| **K–L Lock** (red) | When it closes ("until"). |
| **M Sync Status** | What happened to this row. |

### Editing dates

- **Date cells:** double-click for a calendar, or type like `8/12/26`. The cell rejects
  anything that isn't a date.
- **Time cells:** type it, like `4:00 pm` or `11:59 pm`. (Google Sheets has no time
  picker.)
- Every date needs a time, so nothing lands at midnight by accident.
- To **remove** a date, clear both the date and the time.

### Send changed dates to Canvas

**Canvas Tools › 📝 Assignment dates › Send changed dates to Canvas**

**This changes Canvas** (dry run applies). Students see the new dates.

1. Check **Update?** on the rows you changed.
2. Run the menu item. It checks Canvas first and only sends the dates that are
   actually different.
3. Read the confirmation (how many assignments and dates will change, dry run on or
   off) and click **Yes**.

Only the open, due, and lock dates are sent. Changing a name or points on this tab
does nothing; change those in Canvas.

### Sync Status (column M)

| Status | Meaning |
|---|---|
| **Loaded (date time)** | Just loaded from Canvas. |
| **Updated (date time)** | Sent. The Update? box unchecks itself. |
| **Dry run OK (n date(s))** | Checked but not sent (dry run was on). |
| **No changes** | The row was checked but its dates already match Canvas. |
| **Has section dates: edit in Canvas** | This assignment has different dates for different sections. The sheet can't edit those; use Canvas. |
| **Not found in Canvas: fetch again** | The assignment was deleted or the course changed. Load again. |
| **Failed: …** | Not sent; the reason follows. |

If a date or time is typed wrong, nothing is sent and a pop-up lists the rows to fix.

---

## 5. When something goes wrong

| Message | What to do |
|---|---|
| *Your Canvas address or token is not saved yet* | Run **⚙️ Setup › Set Canvas token**. |
| *Canvas did not accept your token (401)* | Your token expired or was mistyped. Make a new one in Canvas and run **Set Canvas token**. |
| *Could not reach Canvas* | Check the Canvas address in **Set Canvas token**. |
| *Canvas says your account is not allowed to do this (403)* | Your Canvas account can't make this change in this course. Check *Config* B4 is your course. |
| *The Course ID in \*Config\* B4 is missing or not a number* | Put just the course number in B4. |
| *Canvas is busy* | Wait a minute and try again. |
| *Unexpected error* | Note what you clicked and what the message said, then try once more. If it happens again, tell whoever shared the sheet with you. |
| No **Canvas Tools** menu | Reload the page; wait a few seconds. |

---

<!-- Kept in Git as assign-sheet/USER-GUIDE.md; the shared Google Doc is a copy made
when changes are pushed. Update this file in the same commit as any change a teacher
would see (menu labels, columns, colors, messages). -->
