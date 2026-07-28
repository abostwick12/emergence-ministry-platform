# Lead Emergence Automated Platform

Lead Emergence is a ministry-operations web application for event planning, task automation, communication preparation, budget visibility, and future ministry integrations.

The platform is designed to reduce administrative load for a small ministry team while maintaining clear accountability, repeatable workflows, and a usable experience for non-technical staff.

**Production:** [leademergence.com](https://leademergence.com)  
**Current functionality map:** [docs/current-functionality.md](docs/current-functionality.md)  
**Competition ecosystem proof:** [docs/Competition_Ecosystem_Proof.md](docs/Competition_Ecosystem_Proof.md)  
**Competition judge walkthrough:** [docs/Competition_Judge_Walkthrough.md](docs/Competition_Judge_Walkthrough.md)  
**Platform architecture baseline:** [docs/architecture/platform-unification-baseline.md](docs/architecture/platform-unification-baseline.md)  
**AI skill system baseline:** [docs/architecture/ai-skill-system.md](docs/architecture/ai-skill-system.md)

## Current Product Scope

The current release is a production-oriented Next.js App Router application with a working Admin/Leader event-management workflow.

The primary vertical slice is:

**Create event → generate baseline tasks → assign and update tasks → manage the event workspace → review communication previews → view budget and integration activity → retain an activity log.**

This is not the final platform. It is the operational foundation for later Planning Center, Google Workspace, communications, volunteer, student, and AI automation features.

## Competition Ecosystem Proof

For the Scripture in New Frontiers submission, Lead Emergence should be evaluated as a ministry operating system that connects operations, Scripture, ministry memory, AI-assisted drafting, and human approval.

Judge-visible route:

```text
/login -> Continue as guest -> /dashboard -> /ministry -> /student/scripture/resources?reference=John%203%3A16 -> /student/scripture/questions -> /discipleship -> /hackathon
```

Current proof:

- `/dashboard` shows the operational rhythm: events, tasks, communications, budget/activity visibility, and the competition review path.
- `/ministry` shows Ministry Alignment, Meridian-style organizational memory, inspectable evidence, and EMMA conversation boundaries.
- `/student/scripture/resources` shows the YouVersion reader/reference handoff without storing licensed Bible text.
- `/student/scripture/questions` shows the Journey Journal formation path.
- `/discipleship` shows leader review, Gloo diagnostics, safety labels, and human approval before sharing.
- `/hackathon` gives judges a public ecosystem overview without login.

Boundaries:

- Guest mode uses seeded demo data and safe stock AI responses.
- AI drafts are candidate outputs, not pastoral authority.
- Communication outputs remain previews unless a future approved workflow sends them.
- Gloo AI Studio and YouVersion are visible through server-side seams and documented routes, with no secrets exposed to the browser.

## Current Functionality

### Dashboard

- Fixed Lead Emergence navigation and dashboard header
- Upcoming events, tasks due soon, stuck tasks, completion, and communication-review metrics
- Ministry Calendar
- Ministry Pulse
- Next on the Calendar
- Admin and Leader role switching for MVP workflows
- Responsive desktop and mobile layouts

### Events

- Admin/Leader users can create events
- Event records support core details, dates, location, ministry area, target group, vision, notes, and communication ownership
- Event type selection can generate baseline tasks with relative due dates
- Events can be opened and edited through the Master Event Card modal
- Production event data can use Supabase when configured
- Local development and Playwright can use deterministic mock data

### Tasks

- Tasks can be assigned, edited, and moved through workflow statuses
- Task views reflect current local/mock state
- Generated baseline tasks provide a repeatable starting point for event planning
- Activity changes are recorded for operational visibility

### Event Workspace

Event details can display:

- event information
- timeline tasks
- communication previews
- budget shell
- integration activity
- missing information
- activity log

### Communications

- Communication outputs are previews only
- No communication is automatically sent
- Email, text, and GroupMe delivery remain future integration work
- Communication previews and review states are visible in the interface

### Integrations

Current external integrations use deterministic **Stub Mode** adapters.

Stub actions:

- create visible activity or sync records
- preserve the intended workflow shape
- do not call external provider APIs

Student and Parent roles currently exist in the authorization model as inactive placeholders only.

## Current Integration Strategy

All integrations must be implemented behind adapter interfaces. Application features should call adapter contracts rather than provider APIs directly.

Current adapters:

- `PlanningCenterAdapter` — Stub Mode
- `GoogleCalendarAdapter` — Stub Mode
- `GoogleDriveAdapter` — Stub Mode
- `ProPresenterAdapter` — Stub Mode
- `AiAssistantAdapter` — Stub Mode

This allows live integrations to be added later without rewriting the event-planning workflow.

## Not Yet Implemented

The current release does not yet include:

- live Planning Center OAuth or synchronization
- live Google Calendar synchronization
- live Google Drive folder creation
- live ProPresenter playlist creation
- live AI/OpenAI/Gemini generation
- real email, text, or GroupMe sending
- parent portal
- student portal
- QR check-in
- attendance system
- full workflow-template builder
- payment reminders
- advanced analytics

## Technology Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS and shared global design tokens
- Supabase Auth and Postgres
- Vercel
- Playwright end-to-end testing
- GitHub Actions

Active application architecture:
This repository is the current Lead Emergence Automated Platform web application. The active stack is Next.js App Router, React, TypeScript, Tailwind CSS, Supabase Auth, Supabase Postgres, Vercel, and Playwright.

Legacy prototype note:
Google Sheets, Google Apps Script, Apps Script HTML/CSS/JS, clasp, Power Apps, Power Automate, SharePoint, and Dataverse materials describe obsolete prototypes or earlier planning artifacts. They are not authoritative for current implementation decisions unless explicitly marked as historical context.

## Local Development

### Requirements

- Node.js
- npm
- Git

### Commands

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

## Authentication and Database

The application supports invite-only Supabase email/password authentication. There is no public sign-up page. Users are created manually in the Supabase dashboard.

Required variables for real Supabase mode:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Never place service-role keys, database passwords, provider OAuth secrets, AI provider keys, or other server/admin secrets in client-side code or committed files.

### Development Auth (server-only)

On non-production environments (local dev and approved Vercel Preview deployments), reviewers can sign in without Supabase credentials using dev auth over Stub Mode mock data. It is controlled by **server-only** variables. Never prefix these with `NEXT_PUBLIC_`, which would inline their values into the browser bundle:

```bash
ENABLE_DEV_AUTH=true            # enables dev/mock login; ignored in production
DEV_AUTH_ROLE=Administrator     # Administrator | Leader | Student | Parent
```

Dev auth is **never** active when `VERCEL_ENV=production`; production always uses real Supabase Auth, regardless of these flags. When dev auth is active, the app shell shows a `DEV AUTH` badge. A server component passes only a non-sensitive boolean to the client; the controlling variable is never exposed.

The deprecated public variants `NEXT_PUBLIC_ENABLE_DEV_AUTH` and `NEXT_PUBLIC_DEV_AUTH_ROLE` are still honored on the server temporarily for preview compatibility, with a development-time deprecation warning. They should be removed after Preview is verified with the server-only variables.

### Playwright Auth

`E2E_MOCK_AUTH=true` is the deterministic Playwright/local test harness. It makes `/api/auth/login` accept the test login form and set a mock session cookie backed by Stub Mode data.

```bash
E2E_MOCK_AUTH=true
```

Use `E2E_MOCK_AUTH` only for local automated tests and CI. It must never be enabled in Production. The unauthenticated redirect test runs before login and does not need a session cookie; subsequent tests log in through the same `/login` form using the deterministic mock path.

`E2E_MOCK_AUTH` and `ENABLE_DEV_AUTH` use the same server-side mock-auth implementation, but they serve different purposes:

- `E2E_MOCK_AUTH`: Playwright/local test harness for deterministic automated tests.
- `ENABLE_DEV_AUTH` / `DEV_AUTH_ROLE`: server-only runtime development authentication harness for local development and approved Vercel Preview deployments.

### Database Setup

`supabase/schema.sql` is the current schema snapshot/reference for creating a new Supabase project. It is executable bootstrap SQL and includes the active core tables, triggers, RLS policies, and optional MVP seed data.

Run the schema snapshot in the Supabase SQL Editor after creating at least one Auth user:

```text
supabase/schema.sql
```

The schema creates the core tables:

- `profiles`
- `events`
- `tasks`
- `activity_logs`

It enables Row Level Security and authenticated staff-wide CRUD policies. Fine-grained role permissions are intentionally deferred; `profiles.role` is retained for later expansion.

For an existing Supabase project, apply additive migrations in order from:

```text
supabase/migrations/
```

Current migrations are historical/update files that preserve already-applied changes. Do not edit old migration files to make future schema changes. Add a new idempotent migration instead, prefer `ADD COLUMN IF NOT EXISTS` where appropriate, preserve RLS and existing data, and verify the target environment before applying.

Archived SQL under `supabase/archive/legacy/` is historical prototype context only and is not part of the active schema path.

### First User

In Supabase:

1. Open **Authentication → Users**.
2. Create a user with an email and password.
3. Run `supabase/schema.sql` for a new project.
4. For an existing project, apply any needed migrations from `supabase/migrations/` in filename order.
5. Confirm a matching `profiles` row exists.

## Local Login Testing

With real Supabase variables configured, start the app and sign in at `/login` with a manually created Supabase user.

For Playwright/local test runs, set the mock-auth variable:

```bash
E2E_MOCK_AUTH=true
```

The test suite submits these deterministic form values, but the important control is `E2E_MOCK_AUTH=true`:

```text
staff@example.com
password
```

For Playwright against an isolated Supabase test project instead of mock auth, leave `E2E_MOCK_AUTH` unset and set:

```bash
E2E_TEST_EMAIL=
E2E_TEST_PASSWORD=
```

Do not point destructive or write-enabled automated tests at live ministry data.

## Continuous Integration

GitHub Actions runs the MVP verification workflow on pull requests and pushes to `main` or `master`:

```bash
npm install
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

## Development Rules

- Do not commit API keys, OAuth secrets, service-role keys, or `.env` files.
- Keep UI components separate from service and repository layers.
- Use adapter interfaces for external providers.
- Every visible control must work, open an intentional placeholder, or be clearly disabled and labeled for future work.
- Do not add fake buttons.
- Preserve Stub Mode for local development and deterministic testing.
- Run typecheck, lint, build, and the full end-to-end suite before marking a pull request ready.
- Do not merge or deploy around failed checks.
- Do not automatically send ministry communications.

## MVP Acceptance Criteria

The current MVP is considered operational when:

1. The app runs locally without live provider credentials.
2. The dashboard opens directly into the ministry workspace.
3. Admin/Leader users can create and edit an event.
4. Event type selection generates baseline timeline tasks.
5. Tasks can be assigned, edited, and moved through statuses.
6. Event details show tasks, communication previews, budget, missing information, integration activity, and activity history.
7. Task views reflect current local/mock state.
8. Communication outputs are clearly marked as previews and are not sent.
9. Stub integration actions create visible activity records.
10. Student and Parent roles remain inactive placeholders.
11. TypeScript, lint, production build, and end-to-end checks pass.
12. The interface remains usable on desktop and mobile widths.

## Production and Deployment

The production project is deployed through Vercel from the repository's `main` branch.

Normal release workflow:

1. Create a focused feature branch.
2. Run all required checks.
3. Open a pull request into `main`.
4. Review the Vercel preview deployment.
5. Merge only after approval.
6. Confirm the resulting production deployment is **Ready** and tied to the expected `main` commit.

Do not create a second Vercel project or change production domains, environment variables, or team scopes as part of a normal feature deployment.

## Project Direction

Future phases will connect event planning, student relationship tracking, volunteer management, leadership communication, and invisible background automation. Planning Center will remain the intended source of truth for student and attendance data, while live Google and AI integrations will be added behind the existing adapter architecture.
