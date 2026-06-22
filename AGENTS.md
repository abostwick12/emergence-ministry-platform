# Lead Emergence Automated Platform — Shared Agent Instructions

This file is the repository-wide source of truth for both Codex and Claude Code.

All coding agents must read and follow this file before editing the project. Tool-specific files may add workflow guidance, but they must not contradict these rules.

## Product Identity

The active product is **Lead Emergence Automated Platform**.

Do not reintroduce retired product names or branding such as:

- EMERGEnce Ministry Platform
- Emerge Ministry Hub
- Emerge Ministry Operations Hub
- Community Life Church branding in the app shell

The visible dashboard brand is:

- **Lead Emergence**
- **AUTOMATED PLATFORM**

## Product Purpose

Lead Emergence is a ministry-operations web application that connects:

- event planning
- task and workflow automation
- communication preparation and review
- budget visibility
- volunteer and people operations
- future Planning Center, Google Workspace, and AI integrations

The platform is intended for a small ministry team and must remain understandable to non-technical users.

## Active Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS and shared global design tokens
- Supabase Auth and Postgres
- Vercel deployment from `main`
- Playwright end-to-end tests
- GitHub Actions
- Stub adapters for external integrations that are not live yet

## Active Source Folders

Active application code lives primarily in:

- `app/`
- `components/`
- `lib/`
- `supabase/`
- `tests/`
- `docs/`

Do not treat `/archive/google-sheets-v1/` as active application code.

Do not follow old Google Sheets, Apps Script, clasp, or spreadsheet-specific instructions unless they are explicitly referenced for historical context.

## Current Operational Scope

The current working vertical slice is:

**Create event → generate baseline tasks → assign and update tasks → manage the event workspace → preview communications → view budget and integration activity → retain an activity log.**

Current functionality includes:

- authenticated Admin/Leader workflow
- Supabase-backed event data when live variables are present
- deterministic mock/stub mode for local development and tests
- Master Event Card create/edit modal
- event fields including dates, location, ministry area, target group, vision, notes, and communication ownership
- baseline task generation
- task assignment and status changes
- dashboard metrics, calendar, ministry pulse, and upcoming events
- communication previews only
- activity logging

## Integrations

External providers must be accessed through adapter interfaces.

Current adapter set includes:

- `PlanningCenterAdapter`
- `GoogleCalendarAdapter`
- `GoogleDriveAdapter`
- `ProPresenterAdapter`
- `AiAssistantAdapter`

Unless a task explicitly introduces and approves a live provider connection, these adapters remain in Stub Mode.

Supabase is not a stub. Supabase Auth and database mode are live production capabilities when configured.

Do not call external provider APIs directly from UI components.

## Not Yet Live

Do not assume the following are implemented unless the repository proves otherwise:

- live Planning Center OAuth or sync
- live Google Calendar sync
- live Google Drive folder creation
- live ProPresenter integration
- live AI generation
- real email, text, or GroupMe sending
- student portal
- parent portal
- QR check-in
- attendance system
- payment reminders
- advanced analytics

Never present preview or stub output as if it were sent or synchronized live.

## Repository Orientation Rule

Before editing, always inspect the repository state.

At minimum, run:

```bash
git status
git branch --show-current
git log --oneline -8
```

When continuing existing work, also inspect:

- open and recently merged PRs
- unpushed commits
- branch divergence from `main`
- files already changed by prior agents

Do not recreate work that is already committed or merged.

Do not assume the branch named in an old prompt is still current.

## Branch and PR Workflow

For code changes:

1. Start from the latest `main` unless explicitly told otherwise.
2. Create a focused feature branch.
3. Keep unrelated changes out of the branch.
4. Run all required checks.
5. Open a PR into `main`.
6. Review the Vercel preview for visual work.
7. Do not merge without explicit user approval.
8. Do not force-push or rewrite shared history.
9. After merge, pull the updated `main` locally.

Do not merge an older branch if it would remove or revert newer approved work.

## Production Safety

Production safety takes priority over speed.

Never:

- commit `.env` files
- commit API keys, OAuth secrets, service-role keys, database passwords, or AI provider secrets
- expose server/admin secrets to client-side code
- create a second Vercel project during a normal feature release
- change production domains, environment variables, or Vercel scopes without explicit approval
- run destructive tests against live ministry data
- create test records in production without explicit approval
- apply destructive database migrations without a rollback plan and explicit approval

For Supabase migrations:

- prefer additive, idempotent migrations
- use `ADD COLUMN IF NOT EXISTS` where appropriate
- preserve RLS and existing data
- verify the target environment before applying
- report exactly what changed

## Required Verification

Before marking code complete, run:

```bash
npm install
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

If dependencies are already installed and unchanged, `npm install` may be skipped, but the reason should be stated.

Do not claim work is ready when required checks have not run.

If a check fails:

- stop
- report the exact failure
- fix the root cause
- rerun the affected checks

Do not weaken tests merely to make them pass. Update tests only when intended behavior changes, and preserve equivalent coverage.

## Visual Acceptance Rule

For UI and dashboard work, tests passing is necessary but not sufficient.

A visual task is not complete until:

- a fresh screenshot is captured at the requested viewport
- the screenshot is compared against the approved mockup or stated acceptance criteria
- visible regressions are addressed
- responsive behavior is checked

Do not describe a visual requirement as complete when the screenshot still shows the old structure.

For branded artwork, gradients, watercolor, glass, spacing, or layout behavior, the screenshot is the acceptance test.

## Current Dashboard Guardrails

Preserve the current approved structure unless a task explicitly changes it:

- fixed left sidebar
- fixed dashboard header
- independently scrollable main content
- Lead Emergence wordmark
- rounded sidebar navigation buttons
- Admin/Leader pills
- Alex Walker profile area
- dashboard metrics
- Ministry Calendar
- Ministry Pulse
- Next on the Calendar
- Add Event behavior
- Master Event Card behavior

Do not reintroduce:

- old MVP top boxes
- visible Stub Mode notice bar
- old marketing description card
- Active MVP Roles section
- Future Roles card
- Files navigation item unless intentionally restored
- Community Life Church branding in the app shell
- bottom quote
- right-side photo strip
- large white logout button

## UX Rules

- Every visible control must work, open an intentional placeholder, or be clearly disabled and labeled.
- Do not add fake buttons.
- Keep interfaces understandable without a manual.
- Prefer shared reusable components and design tokens over one-off CSS.
- Maintain keyboard focus states and readable contrast.
- Respect `prefers-reduced-motion` for animation.
- Avoid excessive blur, transparency, or animation that harms readability or performance.

## Data and Communication Rules

- Planning Center is the intended source of truth for future student and attendance data.
- Do not create a parallel manually maintained student database without explicit approval.
- Communication outputs are drafts/previews unless explicitly approved otherwise.
- Never automatically send email, text, GroupMe, or other ministry communications.
- Preserve activity logs and auditability for assignments, status changes, and planning decisions.

## Coordination Between Codex and Claude Code

Both tools may work on this repository. To prevent drift:

- treat Git history and the current working tree as authoritative
- inspect prior commits before editing
- never assume the other tool's changes are absent
- avoid duplicating components under new names without checking existing implementations
- report changed files and commit hashes clearly
- keep each branch focused
- do not silently overwrite work from another agent
- stop and ask when two implementations conflict

`AGENTS.md` is the shared instruction source for both tools.

Tool-specific guidance may exist in files such as `CLAUDE.md`, but shared product, safety, architecture, and release rules belong here.

## Completion Report

When finishing a task, report:

- branch name
- changed files
- commit hash
- test results
- build result
- PR status
- deployment status, if verified
- any remaining risks or manual checks

Do not claim a deployment is verified unless the actual deployed commit and environment were confirmed.

## Camp Oakwood Build (Current Priority)

Camp Oakwood functionality is the current top priority. It takes precedence over other Camp polish work in this iteration.

### Operating Principles

- The Camp app must function as a real operations control center, not a read-only dashboard.
- Every visible operational item must be actionable, clearly labeled read-only, or removed.
- Use the main-app interaction pattern: click/tap → modal or detail sheet → edit → save → clear success/error feedback.
- Desktop uses focused modals or popovers; mobile uses full-screen sheets or bottom sheets.
- Do not claim functionality works until a real create/edit/save/read cycle has been tested.

### Current Functional Focus

- roster import
- schedule
- transportation
- teams
- roster
- forms/documents
- Camp Updates
- Camp Settings

### Guardrails for This Iteration

- Do not let permission work block normal Camp functionality in this iteration.
- Keep existing medical safety boundaries intact, but role and visibility configuration belongs in Camp Settings rather than driving this build.
- Preserve audit and correction history for destructive or sensitive actions.
- Work from current `main`. Do not revive older Camp branches or modify recovery stash or backup branches.
- Preserve the deep-blue Camp shell, the readable dock, and the current Camp route structure.
- Do not apply Supabase migrations, seed users, import real Camp data, commit, push, deploy, or alter unrelated features unless explicitly approved.