# EMERGEnce Ministry Platform — UI Build Skill

## Purpose
Use this skill when designing or revising the EMERGEnce Ministry Platform UI in Google Sheets or Apps Script HTML. The UI must be guided by the reference images `Events UI design.png` and `Kanban board design.png` supplied by Andrew.

## Core Principle
The platform must not feel like a raw spreadsheet. It should feel like a clean ministry operations product: uncluttered, visual, functional, and professional enough to sell or hand to a real staff team.

Do not create fake UI. Every visible button, card, chip, metric, menu item, or status indicator must either:

- Show real platform data.
- Trigger a real Apps Script function.
- Navigate to a real tab, row, dialog, sidebar, or linked file.
- Label or organize real data.

Leave planned controls out until their function exists.

## Visual Direction
Style name: Ocean Breeze / Modern Youth.

The interface should feel clean, fresh, calm, colorful but not chaotic, youth-ministry appropriate, and easy for a non-technical coordinator to use.

Use a light base:

- Page background: `#F7FAFC` or `#F8FBFD`
- Card/table background: `#FFFFFF`
- Soft section background: `#F1F7FA`
- Border: `#DDE7EC`
- Primary text: `#102033`
- Secondary text: `#526170`

Header branding should say:

```text
EMERGEnce Ministry Platform
```

No tagline in the main header.

## Tabs
Bright working tabs:

- Events
- Kanban Board
- Documents
- Budget
- Leader List
- Student List
- Worship

Darker admin/planning tabs:

- Communication
- Voice Profiles
- Prompt Templates
- System Settings
- Encouragement Bank
- Event Archive
- Task Archive
- Activity Log

In Google Sheets, the bottom sheet tabs already provide navigation. Do not recreate a large fake left sidebar unless building a real Apps Script HTML dashboard.

## Header Bar Standard
Each main tab should start with a compact header area containing:

- Large bold tab title.
- Short subtitle.
- A small set of real action buttons.
- Accent color matching the tab.

All header buttons must trigger named Apps Script functions. Do not include decorative or inactive buttons.

## Button Rules
Buttons should be clear, action-oriented, and mapped to real functions.

Examples:

- Add New Event
- Add Subtask
- Clear Filters
- Show All Columns
- Expand All
- Collapse All
- Ask EMMA
- Add Expense
- Upload Receipt

Avoid buttons like `View Calendar`, `Refresh`, or `Reports` unless those workflows are actually implemented.

## Events Tab
Purpose:

- View active/upcoming events.
- Create and edit events.
- Expand/collapse event subtasks.
- Track owners, dates, location, status, budget, registration, and documents.
- Ask EMMA for help.

Required header controls:

- Add New Event
- Add Subtask
- Clear Filters
- Show All Columns
- Expand All
- Collapse All
- Ask EMMA

Events default collapsed when the platform opens. Newly created events can open automatically for the current session only. Expanded events show subtasks directly beneath the event row.

Events tab should visually emphasize Start Date while still storing End Date for edit dialogs, calendar duration, and Kanban card date ranges.

Use these shared statuses for events and subtasks:

- Not Started
- Working on It
- Waiting
- Stuck
- Complete

## Subtasks
Subtasks should look visually smaller than main event rows and sit directly beneath their parent event when expanded.

Subtask fields:

- Task Name
- Due Date
- Owner
- Status
- Priority
- Critical?
- File / Document Link
- Related Draft / Communication Link
- Planning Center Registration Link when applicable

Completed subtasks move to the bottom, turn light gray, remain visible unless Hide Completed Tasks is on, and are copied/recorded in Task Archive.

## Kanban Board
Kanban shows main events only, not subtasks.

Columns:

- This Week
- Not Started
- Working on It
- Waiting
- Stuck
- Complete

`This Week` shows events happening in the next 7 days. Those events do not also appear in their regular status column.

Cards must show:

- Event title
- Owner
- Date or date range
- Status accent bar
- Color-only event health circle

The health circle uses color only:

- Green: healthy
- Yellow: caution
- Red: at risk

No percentage text, labels, hover explanation, or fake charting inside the circle.

Kanban includes a real completion ticker and summary metrics calculated from platform data.

Version 1 is a Google Sheets Kanban-style board, not true drag-and-drop.

## Budget Tab
Budget tracks real expenses. It should have Add Expense and Upload Receipt only when those functions exist.

Amount allows cents and negative values for refunds, credits, and corrections. Only Approved expenses count toward event Spent totals.

## Documents Tab
Documents tab shows only documents uploaded, created, copied, or linked through the platform. It must not pretend to scan all of Drive unless that feature is implemented.

## Communication Tab
Communication is an admin/planning tab. Drafts are records for review only. The platform must never send emails, texts, GroupMe messages, or notifications automatically.

One event may have one communication draft Google Doc in the event Drive folder. Each platform/section gets its own Communication row.

Use placeholders for missing details:

```text
[NEEDS CONFIRMATION: return time]
[NEEDS CONFIRMATION: cost]
[NEEDS CONFIRMATION: registration deadline]
```

Include a Missing Details section only when placeholders exist. Do not include an Assumptions Made section.

## EMMA
Every main tab should include an Ask EMMA control. EMMA opens as a sidebar with 3-5 context-aware quick actions plus a chat box.

EMMA tone: warm, clear, youth-ministry appropriate, emoji-free, not corporate, and not forced teen slang.

EMMA must never invent ministry facts, student details, policies, dates, times, costs, locations, or registration links.

## Admin Tabs
Admin tabs should be slightly darker and more controlled than working tabs. They should stay editable but less visually loud.

System Settings should show safe setup status only, never secrets.

Activity Log tracks major actions and plain-language errors. Do not log secrets, raw tokens, sensitive student data, medical details, or long stack traces.

## Build Check
Before calling a UI update ready, verify:

1. It is uncluttered.
2. It matches the Ocean Breeze / Modern Youth direction.
3. Every visible control is functional.
4. Metrics are calculated from real data.
5. Tabs and colors match the approved tab families.
6. EMMA is present where expected.
7. Communication remains draft-only.
8. No secrets or sensitive student data are exposed.
