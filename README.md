# Emerge Ministry Platform

The Emerge Ministry Platform is a ministry-operations web app for event planning, task automation, communication preparation, budget tracking, and future ministry integrations.

## MVP 1 Scope

MVP 1 is a production-oriented **Next.js App Router** scaffold with a thin clickable **Admin/Leader event automation workflow**.

This build is not the full final platform. It is the first vertical slice that proves the core workflow:

**Create event -> generate baseline tasks -> assign/update tasks -> view event workspace -> preview communications -> view budget shell -> view integration activity -> record activity log.**

## MVP 1 Behavior

* Admins can create events.
* Event type selection generates default baseline tasks with relative due dates.
* Tasks can be assigned, edited, and moved through statuses.
* Event detail pages show:

  * event information
  * timeline tasks
  * communication previews
  * budget shell
  * integration activity
  * missing information
  * activity log
* Integrations use deterministic **Stub Mode** adapters.
* Stub integration actions create visible sync/activity log entries but do not call external APIs.
* Student and Parent roles exist in the authorization model only.
* Student and Parent routes are inactive placeholders in MVP 1.
* Local/mock MVP testing does not require live external integration credentials; real Supabase Auth/database mode requires the public Supabase URL and anon key.

## MVP 1 Does Not Include

MVP 1 does not implement:

* live Planning Center OAuth
* live Google Calendar sync
* live Google Drive folder creation
* live ProPresenter playlist creation
* live AI/OpenAI/Gemini calls
* real email, text, or GroupMe sending
* parent portal
* student portal
* QR check-in
* attendance system
* full workflow template builder
* payment reminders
* advanced analytics

## Integration Strategy

All integrations must be implemented behind adapter interfaces.

MVP 1 adapters:

* `PlanningCenterAdapter` - Stub Mode
* `GoogleCalendarAdapter` - Stub Mode
* `GoogleDriveAdapter` - Stub Mode
* `ProPresenterAdapter` - Stub Mode
* `AiAssistantAdapter` - Stub Mode

The application should call adapter interfaces, not provider APIs directly. Live integrations will be added in later builds without rewriting the core workflow.

## Local Commands

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

## Phase 1 Auth And Database

Iteration 2 Phase 1 protects the app with invite-only Supabase email/password Auth and prepares the core database tables for real ministry data. There is no public sign-up page. Create users manually in the Supabase dashboard.

Required Vercel/local variables for real Supabase mode:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Do not add service-role keys, database passwords, provider OAuth secrets, OpenAI keys, or other server/admin secrets to client-side code or committed files.

### Database Setup

Run the SQL script in Supabase SQL Editor:

```text
supabase/schema.sql
```

The script creates:

* `profiles`
* `events`
* `tasks`
* `activity_logs`

It enables RLS on all four tables and adds authenticated staff-wide CRUD policies. Fine-grained role permissions are intentionally deferred; `profiles.role` is present for later expansion.

The script also includes an optional seed block for MVP test data: Camp/Summer Camp, Midweek, High School Event, Fundraiser, and Volunteer Training. Create the first Auth user before running the seed block so the rows can reference `auth.users`.

### First User

In Supabase:

1. Open Authentication -> Users.
2. Create a user with email and password.
3. Run `supabase/schema.sql`.
4. Confirm a matching `profiles` row exists. The seed block creates/updates a profile for the first Auth user as `admin`.

### Local Login Testing

With real Supabase variables set, start the app and sign in at `/login` using the manually created Supabase Auth user.

Without Supabase variables, local Playwright/dev mode uses mock auth for testing only:

```bash
npm run dev
```

Mock test login defaults:

```text
staff@example.com
password
```

For Playwright against a real Supabase project, set:

```bash
E2E_TEST_EMAIL=
E2E_TEST_PASSWORD=
```

Known limitation: communication previews and integration activity remain Stub Mode outputs. Live external integrations are still intentionally disabled.

## CI

GitHub Actions runs the minimum MVP 1 verification on pushes to `main`/`master` and on pull requests:

```bash
npm install
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

## Development Rules

* No live credentials are required for MVP 1.
* Do not commit API keys, OAuth secrets, service-role keys, or `.env` files.
* Use seeded mock data locally.
* Keep UI components separate from services/repositories.
* Every visible control must either work, open a real placeholder panel, or be clearly disabled/labeled for a future build.
* Do not add fake buttons.
* Run typecheck, lint, and build before marking work complete.

## MVP 1 Acceptance Criteria

MVP 1 is complete when:

1. The app runs locally without live credentials.
2. The dashboard opens directly into the work platform.
3. Admin/Leader users can create a new event.
4. Event type selection generates baseline timeline tasks.
5. Tasks can be assigned, edited, and moved through statuses.
6. Event detail page shows timeline tasks, communication previews, budget shell, missing information, integration activity, and activity log.
7. Kanban/task dashboard reflects current local/mock task state.
8. Communication previews are clearly marked as previews and are not sent.
9. Integration actions are stubbed and create log entries.
10. Student and Parent roles exist only as inactive placeholders.
11. TypeScript, lint, and build checks pass.
12. The interface is usable on desktop and mobile widths.

## Verification Status

This build has not been fully verified in the Codex environment because Node/npm/git were unavailable or blocked. Do not treat the project as build-passing until `npm install`, `npm run typecheck`, `npm run lint`, `npm run build`, and a local dev-server check have completed successfully in an environment with Node/npm available.
