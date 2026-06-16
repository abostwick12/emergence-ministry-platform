# Feature Requirements

## Product Vision

Lead Emergence should feel like a ministry operations command center, not a generic spreadsheet or technical admin tool. The current product is a Next.js web application backed by Supabase Auth and Postgres, with deterministic Stub Mode adapters for integrations that are not live yet.

The platform should help a small ministry team plan events, generate repeatable work, prepare communication drafts, track budget visibility, and preserve accountability through activity logs.

## Active Application Architecture

Active application architecture:
This repository is the current Lead Emergence Automated Platform web application. The active stack is Next.js App Router, React, TypeScript, Tailwind CSS, Supabase Auth, Supabase Postgres, Vercel, and Playwright.

Legacy prototype note:
Google Sheets, Google Apps Script, Apps Script HTML/CSS/JS, clasp, Power Apps, Power Automate, SharePoint, and Dataverse materials describe obsolete prototypes or earlier planning artifacts. They are not authoritative for current implementation decisions unless explicitly marked as historical context.

## Core Modules

- Dashboard
- Events
- Tasks and workflow status
- Master Event Card
- Event workspace
- Communication previews
- Budget visibility
- People and volunteer operations
- Worship planning
- Integration activity
- System settings
- Activity logs

## First Workflows

- Create event
- Generate baseline checklist tasks
- Assign task owners
- Update task status and due dates
- Review missing event information
- Preview parent email, leader announcement, and short text communication drafts
- Track volunteer and budget readiness
- Run Stub Mode integration actions for future Planning Center, Google Drive, Google Calendar, ProPresenter, and AI flows
- Retain activity history for planning decisions

## Safety

- Communication outputs are drafts/previews only until explicitly approved.
- Do not automatically send email, text, GroupMe, or other ministry communications.
- Do not expose student-sensitive notes unnecessarily.
- Do not store secrets in code or committed files.
- Log important planning, assignment, and status changes.
- Keep future live provider calls behind adapter interfaces.
