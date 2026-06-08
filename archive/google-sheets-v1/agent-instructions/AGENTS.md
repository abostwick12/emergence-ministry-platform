# EMERGEnce Ministry Platform - Codex Instructions

You are helping build the EMERGEnce Ministry Platform, a Google Sheets + Google Apps Script ministry operations system.

## Primary Goal

Create a user-friendly, uncluttered, professional, and engaging ministry planning platform for Emerge student ministry.

The main users are ministry staff and leaders who need to manage events, task lists, communication drafts, leader information, documents, budget tracking, and Kanban-style planning.

## Tech Stack

- Front end: Google Sheets tabs and Apps Script UI elements
- Backend: Google Apps Script
- Storage: Google Sheets + Google Drive folders
- Calendar: Emerge Google Calendar
- Future AI: Gemini API or similar
- Code management: GitHub, synced manually or through clasp

## Core Rules

- Never delete existing working functions unless explicitly instructed.
- Do not use API keys directly in code.
- Use Script Properties or environment-style configuration for secrets.
- Keep the system easy to maintain.
- Prefer clear Apps Script functions over overly clever code.
- Add comments where future ministry staff will need to understand the code.
- Prioritize stability, readability, and safety over complexity.
- Never send emails, texts, GroupMe messages, or notifications automatically unless explicitly approved.
- All communication automation should create drafts for review only.

## Required Tabs

- Events
- Budget
- Kanban
- Leader List
- Documents
- Settings
- Archive

## Event Requirements

Each event should support:

- Event title
- Ministry Event Type
- Start date
- End date
- Start time
- Location
- Owner
- Priority
- Vision field
- Volunteer requirement
- Status
- Budget estimate
- Actual cost
- Google Drive folder link
- Planning Center registration link
- Communication draft status
- Expandable/collapsible subtasks

## Subtask Requirements

Subtasks should be visually smaller than main event rows.

Each subtask should support:

- Parent event
- Task title
- Due date
- Owner
- Status
- Priority
- Critical flag
- Attachment link
- Notes

Critical tasks include tickets, transportation, lodging, waivers, parent emails, packing lists, slides, registration, and volunteer needs.

## Status Terms

Use these statuses:

- Not Started
- In Progress
- Working on It
- Stuck
- Completed

Completed tasks should eventually move to Archive.

## Kanban Requirements

The Kanban tab should show items due in the next 7 days.

Cards should show:

- Event title
- Owner
- Date
- Status
- Percent complete
- Circle progress indicator
- Time remaining indicator

Cards should be clear, uncluttered, and visually engaging.

## Calendar Requirements

Events should span their full duration on the calendar, not only the start date.

## Communication Rules

When an event is created, the system may prompt the user to create communication drafts.

Draft channels:

- Email
- GroupMe
- Text

Tone:

- Warm
- Fun
- Clear
- Youth-ministry appropriate
- No emojis unless explicitly requested
- First-name style when appropriate

All messages must be saved as drafts for review, not sent.

## Design Direction

Use a clean, modern, ministry-friendly interface.

Working tabs should feel bright and active.

Settings/Admin areas should feel slightly darker and more controlled.

Avoid clutter.
Use collapsible sections where possible.
Make ownership, due dates, and status easy to see quickly.

## Development Process

When making changes:

1. Explain what you are changing.
2. Make the smallest safe change that moves the project forward.
3. Preserve existing structure unless there is a clear reason to refactor.
4. Include any needed setup instructions.
5. Mention any manual Apps Script steps required.
