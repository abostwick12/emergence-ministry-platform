# Command Center Integrations Readiness

This document plans how external integrations get added to Andrew's Personal
Command Center after SAGE Phase 1B (chat, task-aware context, no tool calls).
It is a readiness plan, not an activation. No integration in this document is
wired to a live external call as of this document's authorship. See
[`command-center-readiness.md`](./command-center-readiness.md) for the Phase
1A/1B baseline this plan builds on.

## Scope Boundary

The Command Center is Andrew-only (`lib/command-center/access.ts`,
`COMMAND_CENTER_EMAIL`). Every integration below is scoped to Andrew's
personal domains (military transition, SOTF Fellowship, job search, life) and
must never read or write EMERGE ministry data, Camp EMMA data, Camp medical
records, or Student Portal / Scripture engagement data. The Student Portal /
YouVersion / Scripture build is a separate, concurrent workstream; this plan
does not touch it and does not share credentials, webhooks, or Slack channels
with it.

## Integration Priority Order

Integrations are added one at a time, in this order, each behind its own PR
and its own env vars:

1. **Google Calendar** — read-only
2. **Gmail** — draft-only / read-only triage
3. **Google Drive** — read-only search
4. **Slack** — webhook push (notifications and daily briefings)
5. **Firecrawl** — briefing feed (curated resource crawling)
6. **Monday.com** — personal task tracker sync
7. **LinkedIn** — drafting support only, never posts or sends

Order reflects value to Andrew's near-term military transition and job
search work first, then lower-stakes convenience integrations last. An
integration does not start until the previous one is either shipped or
explicitly deprioritized by Andrew.

## Required Env Vars

All integration credentials are server-only. None are ever prefixed with
`NEXT_PUBLIC_`, logged, echoed in chat, or written to docs, commits, or PR
descriptions.

| Integration | Env vars | Notes |
| --- | --- | --- |
| Google Calendar | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | Shared Google OAuth app also used by Gmail and Drive |
| Gmail | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | Same OAuth app as Calendar/Drive; scopes differ |
| Google Drive | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | Same OAuth app as Calendar/Gmail |
| Slack | `COMMAND_CENTER_SLACK_WEBHOOK_URL` | Deliberately distinct from the existing `SLACK_WEBHOOK_URL` used by `lib/scripture/slack.ts` for the hackathon demo channel. Reusing that webhook would leak Andrew's personal notifications into a shared demo channel. |
| Firecrawl | `FIRECRAWL_API_KEY` | |
| Monday.com | `MONDAY_API_TOKEN` | Personal API token, no OAuth flow |
| LinkedIn | none yet | Phase 1 scaffolding assumes no LinkedIn API integration. SAGE drafts text only; Andrew copies and posts it himself. An env var gets added only if/when a real LinkedIn API integration is scoped. |

`.env.example` documents each of these as commented-out placeholders under
`Personal Command Center / SAGE (Andrew only, SERVER-ONLY)`.

## Security Rules

- All integration credentials are server-only environment variables. Never
  expose them to the client, never prefix with `NEXT_PUBLIC_`.
- No integration secret value is ever printed, logged, committed, or pasted
  into chat, PR descriptions, or screenshots. Only booleans (configured /
  not configured) are ever surfaced to the UI or API responses.
- Every integration route and call site must go through
  `requireCommandCenterAccess()` (`lib/command-center/access.ts`). No
  integration is reachable by any user other than Andrew.
- Integration data (calendar events, email content, Drive documents, Slack
  message history) is never persisted into ministry, Camp, or Student Portal
  tables, and ministry/Camp/Student data is never sent to an integration.
- OAuth tokens (Google) are stored server-side only, associated with the
  single Andrew-only account, never exposed to the client bundle.
- Each new integration ships with its own scoped tests and its own
  "not configured" graceful-degradation path, matching the pattern already
  used by SAGE's provider config in `lib/command-center/sage.ts`.

## Approval Rules

- Andrew must explicitly approve turning on each integration (setting its
  env vars in the target environment) before that integration goes live
  anywhere, including Preview.
- No integration is added to `main` and wired to a live call without a
  dedicated PR that Andrew reviews and approves for that integration alone.
  Integrations are not bundled together.
- No migration for integration-related schema changes is applied without
  Andrew confirming the target Supabase project first, per
  [`AGENTS.md`](../../AGENTS.md) and the Supabase rules in `CLAUDE.md`.
- No autonomous action (sending an email, posting to Slack, creating a
  calendar event, posting to LinkedIn, writing to Monday.com) ships until
  Andrew explicitly requests that specific action be enabled, integration by
  integration.

## Read/Write Capability by Integration

| Integration | Read | Write | Write behavior |
| --- | --- | --- | --- |
| Google Calendar | Yes (schedule) | No | Read-only in this plan; event creation is a future, separately approved capability |
| Gmail | Yes (recent mail for triage) | Draft-only | SAGE may prepare a draft reply; SAGE never sends |
| Google Drive | Yes (document search) | No | Read-only |
| Slack | No | Yes (webhook push) | Outbound notifications/briefings only; no inbound read |
| Firecrawl | Yes (crawled resource pages) | No | Feeds the daily briefing cache; no writes |
| Monday.com | Yes (board/task read) | Yes (task sync) | Sync only after Andrew approves the specific sync direction |
| LinkedIn | No | Draft-only | SAGE drafts post/outreach copy; Andrew posts manually, always |

## What SAGE May Do Now vs. Later

**Now (Phase 1B, current):**

- Advise from Command Center task data only (`lib/command-center/repository.ts`
  read paths already wired into `buildSageInstructions`).
- Hold a conversational chat session persisted to `ai_conversations`.
- Nothing else. No tool calls, no function calling, no integration reads or
  writes, no autonomous actions, no memory automation.

**Later (as each integration above ships, one at a time):**

- Read Andrew's calendar to give schedule-aware answers.
- Read/triage recent email and prepare (never send) draft replies.
- Search Drive documents Andrew references in conversation.
- Push a Slack notification or daily briefing Andrew has explicitly enabled.
- Pull a curated briefing feed via Firecrawl.
- Sync personal tasks with Monday.com in a direction Andrew approves.
- Draft LinkedIn post/outreach copy for Andrew to review and post himself.

Every "later" capability requires its own PR, its own explicit Andrew
approval, and its own documented read/write boundary before it ships — it
does not become available just because the env var is set.

## What Requires Andrew Confirmation

- Enabling any integration's env vars in a live environment (local, Preview,
  or Production).
- Any first-time OAuth consent grant (Google).
- Any change from read-only to write-capable behavior for an integration.
- Any change to the Slack channel or webhook target.
- Any schema migration related to integration state (e.g. token storage).
- Any expansion of what SAGE may read or draft from an integration.

## What Must Never Be Automatic

- Sending an email on Andrew's behalf.
- Posting to Slack without Andrew having explicitly enabled that specific
  notification type.
- Creating, editing, or deleting a calendar event without Andrew's direct
  request in that session.
- Posting to LinkedIn under any circumstance — LinkedIn is drafting-only,
  permanently, in this plan.
- Writing to Monday.com without Andrew approving the sync direction first.
- Saving SAGE memory automatically from integration data.
- Any cross-boundary action that would let Command Center data reach EMERGE
  ministry, Camp EMMA, Camp medical, or Student Portal systems, or vice
  versa.

## Current Scaffolding (this PR)

This PR adds structure only, no live behavior:

- `lib/command-center/integrations-meta.ts` — static catalog of the seven
  integrations above (label, description, phase, priority, capabilities,
  required env var names, confirmation/autonomy flags). Reads only whether
  required env vars are present; never reads or exposes their values.
- `app/api/command-center/integrations/status/route.ts` — merges the stored
  `personal_integrations` status with the catalog metadata and a computed
  `configured` boolean, still Andrew-only via `requireCommandCenterAccess()`.
- `app/(app)/command-center/integrations/page.tsx` — renders cards for all
  seven integrations with a `Not configured` / `Configured — connecting
  later` / `Connected` status label and explicit "not active yet" messaging.
- `.env.example` — documents `GOOGLE_REDIRECT_URI` and
  `COMMAND_CENTER_SLACK_WEBHOOK_URL` alongside the existing
  `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`FIRECRAWL_API_KEY`/
  `MONDAY_API_TOKEN` placeholders, all commented out.

No OAuth flow, webhook call, crawl, or third-party SDK call is implemented in
this PR. No migration is applied. No deployment is performed.

## Increment 1: Google Calendar (read-only)

A follow-up PR implements the first live integration end to end, following
the priority order and the graceful-degradation pattern above:

- `lib/command-center/integrations/google-calendar.ts` — raw `fetch` calls
  against Google's OAuth and Calendar REST APIs (no `googleapis` SDK
  dependency added). `readGoogleCalendarConfig()` mirrors
  `lib/command-center/sage.ts`'s provider-config shape; every exported
  function throws `GoogleCalendarConfigError` instead of attempting a network
  call when `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, or
  `GOOGLE_REDIRECT_URI` is missing. Scope is `calendar.readonly` only.
- `app/api/command-center/integrations/google-calendar/connect/route.ts` —
  Andrew-only redirect into Google's consent screen with a random CSRF state
  stored in a short-lived, `httpOnly` cookie scoped to this integration's own
  API path.
- `app/api/command-center/integrations/google-calendar/callback/route.ts` —
  validates the state cookie, exchanges the code for tokens, and persists
  `{ accessToken, refreshToken, expiresAt, scope }` into
  `personal_integrations.config` for `service = 'google_calendar'` (no schema
  change needed; `config jsonb` already exists from migration 023/024).
  Redirects back to `/command-center/integrations` with a status flag only —
  never with a token in the URL.
- `app/api/command-center/integrations/google-calendar/disconnect/route.ts` —
  Andrew-only POST that clears stored tokens and resets status to
  `disconnected`.
- `app/api/command-center/integrations/google-calendar/events/route.ts` —
  Andrew-only read of the next 10 upcoming events (id, summary, start, end
  only). Refreshes an expired access token using the stored refresh token
  before reading, and re-persists the refreshed token; never returns a token
  to the client.
- `components/command-center/google-calendar-connection.tsx` — client
  component rendering `Connect Google Calendar` / `Disconnect` /
  `Not active yet` depending on `configured` + stored status, wired into the
  Google Calendar card on `/command-center/integrations` only. Every other
  card is untouched and still shows `Not active yet`.

Stored tokens are never included in any API response body (the status route
and repository callers only ever surface `status`, not `config`), never
logged, and only ever leave the server to call Google's own APIs.

This increment does not yet feed calendar data into SAGE's chat context —
`lib/command-center/sage.ts`'s system prompt still tells SAGE it cannot
access a calendar. Wiring calendar events into SAGE's context is a distinct,
separately reviewed change to that guardrail language and its tests, once
Andrew confirms the read surface above behaves as expected with real
credentials.
