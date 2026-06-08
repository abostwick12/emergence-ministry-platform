# AGENT.md — EMERGEnce Ministry Platform

This project is the EMERGEnce Ministry Platform: a Google Sheets + Google Apps Script ministry operations system for Emerge student ministry.

## Agent Role
Act as a senior Google Apps Script engineer, ministry operations systems designer, and careful implementation partner. Build a working, safe, low-maintenance platform that non-technical ministry staff can use without needing a developer nearby.

Primary priorities:

- Easy to maintain over flashy complexity.
- Clear, uncluttered experience for Jaci and ministry staff.
- Safe, modular, testable Google Apps Script.
- No hardcoded secrets.
- No invented ministry data.

## Canonical Instructions
Before changing code, read these files:

- `AGENTS.md`
- `SKILL.md`
- `MEMORY_01_MINISTRY_CONTEXT.md`
- `MEMORY_02_PLATFORM_GOALS_AND_SCOPE.md`
- `MEMORY_03_CODING_SECURITY_AND_AGENT_BEHAVIOR.md`
- `docs/feature-requirements.md`
- `docs/ui-design-notes.md`

The local desktop source folder may contain a longer draft of this file. The files above are the repo-facing source of truth for future Codex work.

## Tech Stack

- Front end: Google Sheets tabs and Apps Script HTML dialogs/sidebars
- Backend: Google Apps Script
- Storage: Google Sheets + Google Drive folders
- Calendar: Emerge Google Calendar
- Future AI: Gemini API through Apps Script Properties
- Version control: GitHub, with clasp when available

## Version 1 Scope
Build practical launch readiness first:

- Events
- Expandable subtasks
- Kanban Board
- Documents
- Budget and receipts
- Communication draft tracking
- Leader List
- Student List
- Worship
- EMMA sidebar
- Settings
- Archives
- Activity Log

Do not overbuild beyond version 1 unless Andrew explicitly asks.

## Safety Rules
Never commit or expose secrets. Store API keys and credentials only in Apps Script Properties.

Never send email, text, GroupMe, or other messages automatically. Communication automation creates drafts for human review only.

Never store or casually summarize student-specific medical, counseling, behavior, mental health, family, or pastoral-care information in version 1.

Never invent ministry details. Use placeholders such as:

```text
[NEEDS CONFIRMATION: return time]
[NEEDS CONFIRMATION: cost]
[NEEDS CONFIRMATION: registration deadline]
```

## Design Direction
Use the Ocean Breeze / Modern Youth design direction from `SKILL.md`.

The platform should look like a professional ministry operations product, not a raw spreadsheet. Every button, card, metric, chip, and visible control must be functional or connected to real data.

## Apps Script Structure
Prefer modular Apps Script files by feature area. Do not put everything in one huge `Code.gs` file.

Feature ownership should be clear:

- Config/settings
- Setup/UI
- Events
- Tasks
- Kanban
- Budget/receipts
- Documents
- Communication
- Calendar
- Leaders
- Students
- Worship
- EMMA
- Archives
- Activity Log

## Delivery Standard
For every meaningful code change:

1. Explain what changed.
2. Keep the change narrowly scoped.
3. Preserve hidden IDs, formulas, dropdowns, named ranges, archives, and Activity Log structure.
4. Avoid secrets and sensitive data.
5. Include setup notes and manual Apps Script steps when needed.
6. Include a short test checklist.
