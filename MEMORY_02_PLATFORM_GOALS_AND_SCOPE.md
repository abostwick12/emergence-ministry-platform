# MEMORY 02 — EMERGEnce Platform Goals and Version 1 Scope

## Purpose
This memory file tells Codex what the EMERGEnce Ministry Platform is supposed to do, what version 1 includes, what is intentionally deferred, and how features should relate to each other.

## Platform Identity
Platform name:

```text
EMERGEnce Ministry Platform
```

AI assistant name:

```text
EMMA — Your Emerge Ministry Momentum Assistant
```

The platform is Google-first and maintenance-first. It should be built in Google Sheets with Google Apps Script as the automation engine. It should connect to Google Drive, Google Calendar, Gemini API, and eventually Planning Center.

The project originally explored Microsoft / Power Apps ideas, but the final direction for this build is:

```text
Google Sheets + Google Apps Script + Google Drive + Google Calendar + Gemini API + Planning Center tracking/sync where scoped
```

The top priority is ease of maintenance. The team should be able to see and edit data directly in the sheet without needing a specialized app developer.

## Version 1 Priority
Version 1 is centered on:

1. Event planning
2. Task tracking
3. Basic documents
4. Budget and receipts
5. Communication draft tracking
6. Leader list and birthdays
7. Worship planning
8. Student List with Planning Center Check-Ins sync shell
9. Kanban visual board
10. EMMA sidebar / guided assistant

Version 1 should not overbuild. It should launch with reliable core functions rather than many half-built features.

## Version 1 Tabs
Bright working tabs:

- Events
- Kanban Board
- Documents
- Budget
- Leader List
- Student List
- Worship

Darker admin / planning tabs:

- Communication
- Voice Profiles
- Prompt Templates
- System Settings
- Encouragement Bank
- Event Archive
- Task Archive
- Activity Log

## Events Tab
The Events tab is the main working page and the default opening tab.

It shows active and upcoming events only, sorted by date. Completed, deleted, or archived events move off the main tab.

Events tab should include all main event fields as columns, with the ability to filter and hide/show columns. There should be a visible Show All Columns button, Clear Filters button, Expand All, Collapse All, Add New Event, and Add Subtask controls.

Required fields to create an event:

- Event Title
- Start Date

Optional event fields include:

- End Date
- Start Time
- End Time
- Ministry Event Type
- Owner
- Location
- Volunteers Needed
- Budgeted
- Registration Needed?
- Vision / Purpose
- Notes
- Status
- Drive Folder Link

Events tab displays Start Date and Start Time. End Date and End Time are visible/editable in the event edit pop-up. Multi-day events should show full duration on Google Calendar and full date range on Kanban cards.

Each event row should have expandable/collapsible subtasks underneath it. Default state is collapsed when the platform opens. A newly created event opens during the current session only.

## Shared Status List
Use one shared status list for events and subtasks:

- Not Started
- Working on It
- Waiting
- Stuck
- Complete

Default status for new events and subtasks is Not Started.

Subtask marked Complete:

- Text turns light gray.
- Moves to the bottom of the event checklist.
- Is recorded in Task Archive.
- Can remain visible unless Hide Completed Tasks is enabled.

Event marked Complete:

- Must be manually marked by the event owner.
- Immediately moves to Event Archive.
- Related subtasks move to Task Archive.
- Calendar event stays unless removed when specifically asked.

## Subtasks
Subtasks are action items, not long descriptions. Version 1 subtask fields:

- Task Name
- Due Date
- Owner
- Status
- Priority
- Critical checkbox
- File / Document Link
- Related Draft / Communication Link
- Planning Center Registration Link when applicable

No subtask notes or description fields in version 1.

Subtask sorting:

1. Critical subtasks first
2. Then due date
3. Then priority
4. Then task name
5. No-date active subtasks below dated active subtasks
6. Completed subtasks at the bottom, light gray, sorted by completion date newest first

Subtasks without due dates stay quiet and do not appear in daily briefs.

Critical is a simple checkbox plus visible label/icon such as 'Critical'. EMMA may mark or suggest Critical based on baseline templates or keywords like tickets, transportation, lodging, forms, medical, registration, payment deadline, parent meeting, and final parent communication.

Priority options:

- Low
- Normal
- High

Default priority is Normal. EMMA should suggest High priority for Critical tasks, but not force it silently.

## Add New Event Form
The Add New Event button opens a simple pop-up form. It requires Event Title and Start Date only.

The form includes optional fields and these checkboxes:

- Load baseline checklist after creating event
- Create Google Drive folder for this event
- Have EMMA prepare communication drafts
- Add event to Emerge Google Calendar
- Registration needed?

The submit button is:

```text
Create Event
```

The form should include an EMMA icon/button at the bottom for help.

## Google Drive
Drive structure should be created/remapped through System Settings and EMMA when asked.

Recommended structure:

```text
EMERGEnce Ministry Platform
├── Event Folders
├── Templates
├── Receipts
└── System Files
```

Each event gets one folder if approved by the user. No automatic subfolders per event.

Folder naming rules:

- Major annual events: `Camp Oakwood 2026`, `Rock the Universe 2026`
- Regular dated events: `YYYY-MM-DD Event Name`
- Recurring events: one folder per occurrence, date first

Main event row shows the event Drive folder link. Subtask rows show the specific applicable document link.

EMMA should be able to copy documents from prior event folders, always creating a new copy and leaving the old document untouched.

## Documents
Documents tab is a bright working tab. It should show only documents uploaded, created, copied, or linked through the platform. It should not automatically scan all of Drive by default.

Document fields:

- Document Name
- Related Event
- Related Task
- Document Type
- File Link
- Owner
- Status
- Last Updated

Document status:

- Draft
- Needs Review
- Final
- Archived

Default status is Draft. Final documents remain editable for version 1.

Templates live as Google Docs inside the Templates Drive folder. Version 1 templates include:

- Parent email
- Camp covenant
- Medical release
- Packing list
- Permission slip
- Leader guide
- Event schedule
- Budget request
- Announcement script

## Communication
Communication tab is a darker admin/planning tab but should be easy to edit before sending.

Communication drafts live in the platform in version 1, not Outlook and not Gmail.

Each event may have one communication draft Google Doc saved in that event’s Drive folder. The doc contains sections for relevant platforms. Each platform section gets its own row in the Communication tab.

Communication tab fields:

- Related Event
- Related Task
- Platform
- Intended Sender
- Intended Audience
- Purpose
- Key Details
- Send Timing
- Section Name
- Draft Doc Link
- Status
- Reviewed By
- Reviewed Date
- Sent Manually Date
- Notes

Communication status:

- Needs Review
- Approved
- Revised
- Sent Manually
- Rejected
- Archived

Default status for EMMA-created drafts is Needs Review.

When Registration Needed is checked, EMMA should always include Planning Center registration copy. Parent email, blast text, GroupMe, spoken announcement, and social captions should only be included when they clearly fit the event context or are asked for.

## Budget
Budget tab is a bright working tab. It tracks actual expenses only.

Events tab shows:

- Budgeted
- Spent

Budgeted is whole dollars only. Spent is calculated from Budget rows tied to the event and marked Approved.

Budget tab fields:

- Expense Date
- Store / Vendor
- Description
- Amount
- Category
- Expense Type
- Related Event
- Related Task
- General Ministry Expense?
- Paid By
- Payment Method
- Receipt Link
- Review Status
- Added By

Amount allows cents and negative amounts. Currency formatting should be used.

Budget categories:

- Events
- Missions
- Programs
- Snacks
- Other

Expense Type default:

- Purchase

Expense Type options:

- Purchase
- Refund
- Credit
- Correction

Review Status:

- Needs Review
- Approved
- Rejected
- Reimbursed
- Archived

Only Approved expenses count toward Spent.

Budget has Add Expense and Upload Receipt buttons. Upload Receipt supports multiple receipts and shows a review table before saving. Receipt category defaults to Other and review status defaults to Needs Review. Receipts go into the general Receipts Drive folder.

Siri version 1 first command is Upload Receipt through Apple Shortcuts. It should allow taking a new photo or choosing from the photo library, with no spoken notes.

## Kanban Board
Kanban Board is a bright working tab. It shows main events only, not subtasks.

Columns:

- This Week
- Not Started
- Working on It
- Waiting
- Stuck
- Complete

This Week shows events happening in the next 7 days and those events do not also appear in their regular status column.

Each event card shows:

- Event name
- Owner
- Date or date range
- Top status bar based on event status
- Color-only circle graph for event health

The circle graph is based on all subtasks and considers completion, critical tasks, stuck tasks, overdue tasks, and time remaining. It shows color only: green, yellow, or red. No percentage, label, hover explanation, or text needed.

Version 1 uses a Google Sheets Kanban-style board, not true drag-and-drop. Clicking a card should open a main event edit pop-up with an Open Event on Events Tab button.

Kanban includes a completion ticker at the top. It defaults to This Week and can switch to This Month. It counts both events and subtasks marked Complete, based on completion date, grouped by assigned owner only. Unassigned completed items are not displayed.

## Leader List
Leader List is a bright working tab. It includes adult leaders only for version 1.

Fields include:

- Leader Name
- Active?
- Staff / Volunteer
- Ministry Role
- Email
- Phone
- Birthday
- Anniversary
- Spouse Name
- Primary Ministry Area
- GroupMe Member?
- Daily brief settings

Leader Name is one field. No Preferred Name field in version 1.

Birthdays only auto-add to the shared Emerge Google Calendar as yearly all-day events. Title format:

```text
[Leader Name] Birthday
```

Birthday and anniversary drafts only generate for active leaders. Birthday drafts generate every year one week before the birthday and appear in Communication with Needs Review. Birthday draft package includes a warm email and condensed text/GroupMe message. Anniversaries do not auto-add to calendar.

## Student List
Student List is a bright working tab.

Version 1 includes Planning Center Check-Ins sync using a placeholder source/filter until the exact Emerge Check-Ins source is confirmed.

Fields:

- Student Name
- Grade
- Planning Center ID
- Active?
- Last Attendance Date
- Attendance Count

Grade values are simple numbers: 6, 7, 8, 9, 10, 11, 12.

Student List is editable. Sync should update attendance fields and preserve simple manual edits like grade unless a full refresh is intentionally requested.

Do not include parent contact info, medical data, counseling notes, behavior notes, or follow-up automation in version 1.

## Worship Tab
Worship is a bright working tab.

It should be easy to see two months of worship planning, including service dates, set lists, keys, who is singing, who is playing instruments, rehearsal info, and notes.

Include a Core 10 Song Library on the same Worship tab. Andrew will provide the actual song list later.

No sync, no auto-population, no missing-assignment highlights, and no status field for version 1.

## Deferred Until Later
Do not build these into version 1 unless explicitly asked later:

- Outlook draft integration
- Gmail draft integration
- True drag-and-drop Kanban web view
- Advanced permissions
- Full student follow-up automation
- Volunteer assignment/gap tracking
- Separate dashboard/reporting tab
- Full mobile app experience
- Complex Planning Center write automation
