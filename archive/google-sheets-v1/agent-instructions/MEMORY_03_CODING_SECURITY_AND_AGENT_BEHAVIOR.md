# MEMORY 03 — Coding, Security, and Agent Behavior

## Purpose
This memory file gives Codex the engineering, security, and behavior rules for the EMERGEnce Ministry Platform. It should guide every code change, patch, test, and architecture decision.

## Core Technical Direction
The platform is built in:

```text
Google Sheets + Google Apps Script + Google Drive + Google Calendar + Gemini API
```

Planning Center Check-Ins sync is included for the Student List in version 1, with a placeholder Check-Ins source/filter until Andrew identifies the correct source.

The project is maintenance-first. Avoid over-engineering. Prefer simple, readable, modular Apps Script that Andrew can patch later.

## Apps Script File Structure
Use separate Apps Script files by feature module:

```text
Constants.gs
Config.gs
Security.gs
UI.gs
Setup.gs
Events.gs
Tasks.gs
Kanban.gs
Budget.gs
Documents.gs
Communication.gs
Calendar.gs
Leaders.gs
Students.gs
Worship.gs
Emma.gs
Receipts.gs
PlanningCenter.gs
Siri.gs
Archives.gs
ActivityLog.gs
```

Each file should own one feature area. Do not create one giant Code.gs file.

## File Responsibilities
`Constants.gs` stores shared tab names, column labels, internal keys, standard statuses, default dropdown options, error codes, ID prefixes, and other stable references.

`Config.gs` handles System Settings, Apps Script Properties access, environment, folder IDs, calendar ID, Gemini configuration status, Planning Center configuration status, and missing setup checks.

`Security.gs` handles user detection, safe access helpers, and plain-language permission/config validation. It should never reveal secrets.

`UI.gs` creates menus, buttons, dialogs, sidebars, and top control interactions.

`Setup.gs` creates/updates the sheet structure, tabs, headers, colors, named ranges, dropdown source sections, frozen rows/columns, and hidden ID columns.

`Events.gs` handles event creation, editing, completion, archive, restore, filters, event folder links, and event data.

`Tasks.gs` handles subtasks, sorting, Add Subtask, status changes, Critical checkbox, priority, and task archive behavior.

`Kanban.gs` generates the Kanban Board, event cards, This Week column, completion ticker, and event health circle logic.

`Budget.gs` handles Add Expense, budget rows, review statuses, event Spent calculations, and budget field validation.

`Receipts.gs` handles receipt upload, multi-receipt review, receipt Drive storage, Gemini receipt extraction, and Budget row creation.

`Documents.gs` handles document uploads, event folder saving, template copies, prior event document copying, and Documents tab records.

`Communication.gs` handles event communication draft docs, Communication tab rows, section names, statuses, and Missing Details sections.

`Calendar.gs` handles main event calendar creation/update, birthday all-day yearly events, and optional subtask calendar reminders only when specifically asked.

`Leaders.gs` handles Leader List, active leaders, birthdays, anniversaries, daily brief preferences, and leader dropdowns.

`Students.gs` handles Student List and basic attendance fields.

`PlanningCenter.gs` handles Planning Center Check-Ins sync and related configuration placeholders.

`Worship.gs` handles the Worship tab and Core 10 Song Library structure.

`Emma.gs` handles EMMA sidebar, Gemini prompt routing, tab-aware quick actions, anti-hallucination rules, daily brief, and user-facing assistant flows.

`Siri.gs` handles Apps Script web app endpoints for Apple Shortcuts, especially Siri Upload Receipt.

`Archives.gs` handles Event Archive and Task Archive movement/restoration.

`ActivityLog.gs` handles major action logging and error logging.

## Repo / Codex Workflow
Preferred workflow:

```text
Codex edits GitHub repo → Andrew reviews PR → merge → clasp push → test in Google Sheet
```

If not using clasp, Andrew may manually paste files into the Apps Script editor. Codex should produce code one module/file at a time with clear paste instructions and test steps.

Do not assume Codex can directly edit a live Google Sheet or Apps Script project unless the user has explicitly connected the environment.

## Secrets and Credentials
Never store secrets in the Google Sheet, code, comments, prompts, docs, screenshots, or repo.

Store secrets only in Apps Script Properties:

- Gemini API key
- Planning Center credentials/API secrets
- Future Outlook/Microsoft credentials
- Any future webhook or external API secrets

System Settings may show only safe status values:

- Configured
- Missing
- Disabled
- Needs attention

EMMA must never display or reveal API keys, tokens, credentials, or secrets.

## System Settings
System Settings should include one active environment and one active set of folder/calendar IDs.

Environment dropdown:

- Test
- Production

Test mode is fully functional. It is labeled for safety, not restricted.

System Settings should include:

- Environment
- Platform Folder ID
- Event Folders ID
- Templates Folder ID
- Receipts Folder ID
- System Files Folder ID
- Emerge Calendar ID
- Gemini Configured? status
- Planning Center Attendance Sync Enabled?
- Planning Center Check-Ins Service/Event Filter placeholder
- Last Attendance Sync Date
- Feature flags where needed

The active environment should be visible somewhere on the platform or EMMA sidebar:

```text
Environment: Test
Environment: Production
```

Do not include a visible Run System Check button in version 1. EMMA should check setup only when missing configuration affects the action the user is trying to take.

## Drive Remapping / Migration
The platform must be easy to test in Andrew’s personal Google Drive and later move to church Google Drive.

Use one active set of folder IDs, not separate Test and Production ID fields.

EMMA should be able to help remap Drive folders when asked.

The developer guide should include a Test → Production migration checklist:

1. Confirm test version works in personal Google Drive.
2. Copy the Google Sheet into the church environment.
3. Confirm Apps Script files copied correctly.
4. Change Environment from Test to Production.
5. Remap active Drive folder IDs.
6. Update shared Emerge Calendar ID.
7. Confirm Gemini API is configured in Apps Script Properties.
8. Confirm no secrets are stored in the sheet.
9. Test one event, one folder, one calendar event, one receipt upload, and one communication draft.
10. Review Activity Log.

## IDs and Relationships
Every major record type should have a hidden unique ID column.

ID format:

```text
EVT-8F3A92C1
TSK-4B7D19E2
DOC-91AC3F0B
EXP-2D88A714
COM-73F2B9D4
LDR-A61E4C9A
STU-0C42A891
WOR-7A10F4BD
```

IDs are generated once and never changed, even if visible names or dates change.

Use IDs when available. Do not block every update if an ID is missing in version 1, but EMMA must ask before updating when there are duplicate or unclear matches.

Hidden ID columns should be physically hidden from normal users.

## Column and Dropdown Rules
Use `Constants.gs` as the single source of truth for column names, internal keys, tab names, status lists, error codes, and default dropdown lists.

Use named ranges or table-style source sections for dropdown values so EMMA can update dropdown options without breaking validation.

Any dropdown list should be editable manually or by EMMA.

Dropdown option deletion does not require confirmation. Deleted options disappear from active dropdown lists, though old records may still show old values.

When renaming a dropdown option, EMMA should ask whether to rename future options only or update existing records too.

Field/column changes:

- EMMA may add, rename, hide, and adjust fields when asked.
- EMMA must ask before deleting a field/column because deletion can break formulas, automations, archives, named ranges, Kanban, and budget totals.
- Activity Log is enough; no hidden system backup is required in version 1.

## Activity Log
Activity Log is a darker admin tab and tracks major changes only, not every small edit.

Log major actions such as:

- Event created/updated/archived/restored
- Task created/updated/deleted/restored/completed
- Draft created or status changed
- Document created/uploaded/linked
- Receipt uploaded
- Expense added or review status changed
- Budget status changed
- Calendar event created/updated/removed
- Leader added/updated
- Student sync run
- Field/column changed
- Dropdown source changed when it affects workflow
- Errors

Use `onEdit(e)` triggers for key columns only, such as:

- Event Status
- Event Owner
- Event Start Date / End Date
- Event Location
- Task Status
- Task Owner
- Task Due Date
- Critical checkbox
- Budget Review Status
- Communication Status
- Document Status

Archive tabs should mostly ignore normal edits, except restore/delete/archive status changes.

Do not add Created By, Created Date, Last Updated By, or Last Updated Date fields to every major tab in version 1. Use Activity Log instead.

## Error Handling
User-facing errors must be plain language.

Technical details should be logged in Activity Log, not shown to normal users. Never log secrets, raw tokens, private student data, medical details, long stack traces, or confidential notes.

Activity Log error records should include:

- Action Type: Error
- User-facing message
- Technical error code
- Related Event/Task if applicable
- Timestamp
- User
- Source/workflow

Use standard error codes in `Constants.gs`, such as:

```text
DRIVE_FOLDER_MISSING
CALENDAR_ID_MISSING
GEMINI_NOT_CONFIGURED
PLANNING_CENTER_NOT_CONFIGURED
DUPLICATE_EVENT_MATCH
EVENT_NOT_FOUND
TASK_NOT_FOUND
RECEIPT_UPLOAD_FAILED
DOCUMENT_CREATION_FAILED
COMMUNICATION_DRAFT_FAILED
LOCK_TIMEOUT
```

If a lock fails, show:

```text
Someone else is updating the platform right now. Try again in a few seconds.
```

Log it as `LOCK_TIMEOUT`.

## Concurrency and Locks
Use Apps Script lock protection for major operations:

- Creating events
- Adding subtasks
- Archiving/restoring events
- Archiving/restoring tasks
- Uploading receipts
- Adding budget rows
- Generating communication records
- Updating dropdown source lists
- Creating Drive folders/documents
- Calendar sync/update actions
- Planning Center sync

Do not force actions through when a lock cannot be obtained.

## EMMA Behavior Rules
EMMA is the platform assistant:

```text
EMMA — Your Emerge Ministry Momentum Assistant
```

Tone:

- Warm/fun youth ministry tone
- Emoji-free
- Clear and practical
- Not corporate
- Not forced teen slang
- Address users by first name when known

EMMA should open as a sidebar with 3–5 context-aware quick action buttons plus a chat box. Every tab should have access to Ask EMMA, including settings tabs.

Forms and daily brief use pop-ups. EMMA sidebar is for assistance and quick actions.

## Anti-Hallucination Rule
EMMA must never invent missing information.

Never fabricate:

- Dates
- Times
- Locations
- Costs
- Attendance numbers
- Planning Center links
- Leader names
- Student details
- Policies
- Scripture quotes
- Medical information
- Registration deadlines

If something is missing, EMMA should state that it is missing, ask the user, leave the field blank, or use a visible placeholder.

Communication placeholders should use:

```text
[NEEDS CONFIRMATION: return time]
[NEEDS CONFIRMATION: cost]
[NEEDS CONFIRMATION: registration deadline]
```

Communication draft Google Docs should include a Missing Details section at the top only when placeholders exist. Do not include an Assumptions Made section.

## Sensitive Data Rules
Do not expose sensitive information in generated drafts, daily briefs, notifications, documents, logs, or public-facing text.

Sensitive categories include:

- Medical details
- Prescription/medication details
- Private pastoral care notes
- Family situations
- Student behavior concerns
- Mental health concerns
- Financial hardship/scholarship details
- Parent contact details beyond what is necessary
- Anything shared in confidence

Version 1 should avoid storing student-specific medical, counseling, behavior, or pastoral-care details.

Medical release and prescription addendum files can be linked as required documents, but EMMA should not summarize their contents in parent-facing drafts. Use simple wording such as:

```text
Please complete the attached medical release and prescription addendum, if applicable, and bring them to the parent meeting or drop-off.
```

## Gemini Prompt Rules
All Gemini prompts used by EMMA should include:

- Never invent missing details.
- Use placeholders for unknowns.
- Avoid exposing sensitive information.
- Match the intended sender and platform voice.
- Keep parent communication clear and trustworthy.
- Keep leader communication warm, direct, and actionable.
- Do not send anything automatically.
- Produce drafts for review.

Gemini API keys must live in Apps Script Properties only.

## Calendar Rules
The shared Emerge Google Calendar is for:

- Main events
- Event date changes
- Leader birthdays
- Major ministry calendar items

Subtasks do not go to the calendar by default. EMMA may add a subtask reminder only when specifically asked.

Main event calendar creation happens when the user selects the checkbox or asks EMMA. Calendar entries should include title/date/time/location/basic notes only. Do not include sheet row links in the calendar description.

When event title/date/time/location changes, EMMA should ask whether to update the matching calendar event.

Completed events stay on the calendar unless specifically asked to remove them.

If deleting or archiving an event, EMMA should ask before removing the calendar event.

Leader birthdays:

- Active leaders only
- All-day events
- Repeat yearly
- Title format: `[Leader Name] Birthday`
- Anniversaries do not auto-add to calendar

## Daily Brief
Daily brief appears as a pop-up the first time a user opens the platform each day, unless turned off.

It is filtered to the user's assigned tasks/events based on preferences in Leader List.

Default window: Today only.

Users can tell EMMA to change brief settings. No separate settings button needed.

Daily brief includes quick action buttons and optional Play Brief text-to-speech. It should not auto-play.

For Jaci, include a rotating Scripture encouragement and varied Andrew-style encouragement line from the Encouragement Bank. Do not repeat the same love line every day.

## Developer Guide
Create a separate Google Doc developer guide stored in System Files. It is written for Andrew as the code maintainer.

Include:

- Apps Script file structure
- File responsibilities
- Version 1 Scope Lock
- Deferred features
- Do Not Edit Casually list
- Manual Recovery Checklist
- Patch Process
- Drive Remapping / Environment Migration
- Test → Production Checklist
- Testing checklist

Do Not Edit Casually list should include:

- Hidden ID columns
- Named ranges
- Dropdown source lists
- Event/task relationship fields
- Archive logic
- Kanban scripts/formulas
- Budget rollup formulas
- Calendar ID settings
- Drive folder IDs
- Gemini settings
- Receipt upload workflow
- Communication document linking
- Activity Log structure

## Code Quality Rules
Before providing or accepting code, check for:

- Accuracy
- Efficiency
- Functionality
- Safety
- Maintainability
- Google Apps Script best practices
- Security around API keys and student/ministry data
- Alignment with version 1 scope
- Risk to formulas, IDs, dropdowns, archives, or linked tabs

Do not claim code is production-ready unless it has been tested in the actual Google Apps Script environment. If testing cannot be run directly, provide a clear manual test checklist.

Major functions should have comments explaining what they do, which tabs they touch, required inputs, and side effects. File-level headers are not required because the Developer Guide covers file purposes.

## Version 1 Testing Checklist
Before a patch is considered safe, verify:

1. It runs without syntax errors.
2. It touches only intended tabs/columns.
3. It preserves hidden IDs.
4. It avoids hardcoded secrets.
5. It logs major actions when required.
6. It avoids deleting records that should be archived.
7. It handles missing settings gracefully.
8. It fails safely if Drive, Calendar, Gemini, or Planning Center is not configured.
9. It avoids exposing sensitive data.
10. It preserves existing formulas and named ranges.
11. It asks the user when duplicate/similar matches are found.
12. It keeps version 1 maintainable instead of overbuilt.

## Agent Instruction for Codex
When working on this project, Codex should:

1. Identify which `.gs` or `.html` file owns the requested change.
2. Check for conflicts with this memory file, SKILL.md, AGENT.md, and the developer guide.
3. Avoid expanding beyond version 1 unless explicitly asked.
4. Preserve hidden IDs, named ranges, dropdowns, formulas, archives, and Activity Log structure.
5. Never add secrets to code.
6. Never invent ministry data.
7. Ask for missing required configuration instead of guessing.
8. Provide concise implementation notes and a test checklist with every meaningful code change.
