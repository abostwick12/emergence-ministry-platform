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

1. **Google Calendar** — read-only initially, later expanded to Andrew-triggered create/edit (see "Increment 9" below)
2. **Gmail** — draft-only / read-only triage
3. **Google Drive** — read-only search initially, later expanded to content read + organize (see "Increment 10" below)
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
| Google Calendar | Yes (schedule) | Yes (create/edit events) | Andrew-triggered only, from the integrations page; no delete, and no tool-calling path lets SAGE chat create or edit an event itself |
| Gmail | Yes (recent mail for triage) | Draft-only | SAGE may prepare a draft reply; SAGE never sends |
| Google Drive | Yes (document search + content) | Yes (organize) | Andrew-triggered only; organize (move files, create folders) never touches file content, and there is no content-edit or delete function anywhere |
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

Calendar events are fed into SAGE's chat context — see "Increment 8: Wiring
Calendar and Gmail into SAGE chat" below for how, and for the updated
guardrail language that replaced "SAGE cannot access a calendar." The scope
above was later widened from `calendar.readonly` to `calendar.events` — see
"Increment 9: Google Calendar create/edit events" below.

## Increment 2: Gmail (read, organize, and draft-only — never sends)

A follow-up PR adds the second live integration, reusing the same
`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` values as
Google Calendar (one shared consent screen) but a fully separate OAuth grant
and a fully separate stored token, under `service = 'gmail'`. Connecting
Gmail does not connect Calendar, and disconnecting one never touches the
other's row in `personal_integrations`. A second PR expands this to
"everything an assistant could do without sending": organizing mail into
labels/folders and staging drafts for messages SAGE judges important.

- `lib/command-center/integrations/gmail.ts` — same raw-`fetch`,
  graceful-degradation pattern as Calendar (`GmailConfigError` instead of a
  network call when config is missing). Requests three scopes together:
  `gmail.readonly` (read), `gmail.compose` (draft creation), and
  `gmail.labels` (organize). Gmail has no scope that grants draft creation
  without also technically permitting `drafts.send` — **"SAGE never sends
  email" is enforced at the application layer, not the OAuth layer.** There
  is no `sendMessage`/`drafts.send` call anywhere in the codebase, at any
  capability level (read, organize, or draft).
- **Read:** `listRecentGmailMessages` reads only `Subject`/`From`/`Date`
  headers, Gmail's own short snippet, and `labelIds` (`format=metadata`) for
  the triage list. `getGmailMessageBody` is a separate, explicit full-body
  read (`format=full`, extracting the `text/plain` part or a stripped
  `text/html` fallback) used only when a message actually needs to be read
  closely or drafted against — the triage list itself never pulls full body
  content.
- **Organize:** uses `gmail.labels` rather than the broader `gmail.modify`,
  which would additionally allow permanently trashing threads this
  integration has no need for. `listGmailLabels`/`createGmailLabel` manage
  labels ("folders"); `findOrCreateGmailLabel` is idempotent by name so
  "move to a folder that doesn't exist yet" and "create a folder" are the
  same operation from Andrew's point of view. `moveGmailMessageToLabel`
  adds the target label and removes `INBOX` — Gmail has no real folders, so
  this is the same effect as dragging a message onto a label in Gmail's own
  UI. `modifyGmailMessageLabels` is the one underlying label-mutation
  primitive; it never deletes a message and never touches send.
- **Draft + stage for review:** `createGmailDraft` is unchanged (draft-only,
  no send). Every draft SAGE creates — whether from the manual drafts route
  or from triage below — is now also labeled under the fixed
  `GMAIL_DRAFT_REVIEW_LABEL_NAME` ("SAGE/Draft Review") via
  `stageGmailDraftForReview`, so Andrew can find every SAGE-authored draft
  in one place in Gmail, distinct from drafts he started himself.
- **Triage and draft important messages:** `triageAndDraftImportantMessages`
  reuses SAGE's own AI provider (`lib/command-center/sage.ts`, the same one
  LinkedIn drafting uses) to read each of the most recent inbox messages in
  full, judge whether it's important enough for Andrew to personally reply
  to, and — only for messages judged important — draft a reply, create it
  as a Gmail draft, and stage it for review. **This is Andrew-triggered
  only; there is no scheduled or automatic caller anywhere in the
  codebase.** It never sends.
- `lib/command-center/integrations/gmail-token.ts` — shared token
  resolution (load stored tokens, refresh if expired, persist the refresh)
  used by every Gmail route below, replacing what had been duplicated
  per-route boilerplate.
- `app/api/command-center/integrations/gmail/connect|callback|disconnect/route.ts`
  — same Andrew-only, CSRF-state-cookie OAuth flow as Calendar, on its own
  cookie name and its own API path scope.
- `app/api/command-center/integrations/gmail/messages/route.ts` — Andrew-only
  read of the 10 most recent inbox messages (metadata + snippet + labelIds
  only).
- `app/api/command-center/integrations/gmail/messages/[id]/route.ts` —
  Andrew-only full read of one message.
- `app/api/command-center/integrations/gmail/messages/[id]/move/route.ts` —
  Andrew-only `POST { labelName }` that moves one message to a label/folder
  (creating it first if needed).
- `app/api/command-center/integrations/gmail/labels/route.ts` — Andrew-only
  `GET` (list labels) and `POST { name }` (create a label).
- `app/api/command-center/integrations/gmail/drafts/route.ts` — Andrew-only
  `POST` that creates exactly one Gmail draft from `{ to, subject, body,
  inReplyTo?, threadId? }`, stages it for review, and returns only the
  created draft's id. Andrew reviews and sends it himself from Gmail; this
  route cannot send.
- `app/api/command-center/integrations/gmail/triage/route.ts` — Andrew-only
  `POST` that runs `triageAndDraftImportantMessages` over the 5 most recent
  inbox messages and returns which were judged important and which got a
  staged draft.
- `components/command-center/gmail-connection.tsx` — `Connect Gmail` /
  `Disconnect` / `Not active yet` plus, once connected, a
  `Triage inbox & draft replies` button showing per-message results.

Stored Gmail tokens are never included in any API response, never logged.
Recent Gmail triage context (subject/from/snippet only — never full body)
is fed into SAGE's chat context; see "Increment 8" below. The triage-and-
draft flow and the organize/label actions are not driven from chat itself
(no tool calling exists), only referenced as context.

## Increment 3: Google Drive (read-only search)

A follow-up PR adds the third live integration. Same shared
`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` consent
screen as Calendar and Gmail, its own fully separate OAuth grant and stored
token under `service = 'google_drive'`.

- `lib/command-center/integrations/google-drive.ts` — same raw-`fetch`,
  graceful-degradation pattern (`GoogleDriveConfigError`). Originally
  requested only `drive.metadata.readonly` (metadata, never content); see
  "Increment 10" below for the later scope change to support reading
  content and organizing files.
- `searchGoogleDriveFiles` matches by filename (`name contains '...'`),
  excludes trashed files, and requests only
  `id,name,mimeType,webViewLink,modifiedTime` — never file content.
- `app/api/command-center/integrations/google-drive/connect|callback|disconnect/route.ts`
  — same Andrew-only, CSRF-state-cookie OAuth flow as Calendar and Gmail, on
  its own cookie name and its own API path scope.
- `app/api/command-center/integrations/google-drive/search/route.ts` —
  Andrew-only `GET ?q=` search returning up to 10 matching files (id, name,
  mimeType, webViewLink, modifiedTime only).
- `components/command-center/google-drive-connection.tsx` — same
  `Connect Google Drive` / `Disconnect` / `Not active yet` pattern, wired
  into the Google Drive card only.

Like Calendar and Gmail, stored Drive tokens are never included in any API
response, never logged, and Drive search results are not fed into SAGE's
chat context — that remains a distinct, separately reviewed change, unlike
Calendar and Gmail (see "Increment 8").

## Increment 4: Slack (manual test push only)

A follow-up PR adds Slack. Unlike Calendar/Gmail/Drive, Slack incoming
webhooks have no OAuth consent flow — there is nothing to "connect" beyond
`COMMAND_CENTER_SLACK_WEBHOOK_URL` being present in the server environment.

- `lib/command-center/integrations/slack.ts` — same graceful-degradation
  pattern (`SlackConfigError`). `sendSlackMessage()` is the only send path
  in the entire codebase for this webhook — there is intentionally no
  scheduled job, cron, or other automatic caller anywhere. Wiring an actual
  automatic daily-briefing push (or any other automatic notification) is a
  distinct, separately approved change, per the "must never be automatic"
  rule above.
- `app/api/command-center/integrations/slack/test/route.ts` — Andrew-only
  `POST` that sends exactly one fixed, safe test message
  ("SAGE Command Center test notification...") so Andrew can confirm the
  webhook works, then marks the integration `connected` on success or
  `error` on failure.
- `app/api/command-center/integrations/slack/disable/route.ts` — Andrew-only
  `POST` that resets the stored status back to `disconnected`. This is an
  in-app pause only; the webhook URL itself stays set in the environment
  until Andrew removes it there.
- `components/command-center/slack-connection.tsx` — shows
  `Send test notification` (configured, not yet tested) / `Pause`
  (connected) / `Not active yet` (not configured), instead of the
  Connect/Disconnect OAuth pattern used by the Google integrations.

Like the others, this increment does not yet wire Slack into any automatic
briefing or notification flow — only a manual, Andrew-initiated test send
exists today.

## Increment 5: Firecrawl (manual on-demand scrape only)

A follow-up PR adds Firecrawl. Like Slack, Firecrawl has no OAuth consent
flow — just `FIRECRAWL_API_KEY` being present in the server environment.

- `lib/command-center/integrations/firecrawl.ts` — same
  graceful-degradation pattern (`FirecrawlConfigError`). `scrapeUrl()` calls
  Firecrawl's single-page `/v1/scrape` endpoint only — no crawl or site-map
  call — and truncates returned markdown to 4,000 characters as a payload
  safety limit. There is no scheduled crawl, curated URL allowlist, or other
  automatic caller anywhere; wiring an automatic daily-briefing crawl is a
  distinct, separately approved change.
- `app/api/command-center/integrations/firecrawl/scrape/route.ts` —
  Andrew-only `POST { url }` that scrapes exactly the one URL provided,
  validates it is `http`/`https`, and marks the integration
  `connected`/`error` based on the result.
- `app/api/command-center/integrations/firecrawl/disable/route.ts` —
  Andrew-only `POST` that resets the stored status to `disconnected` (an
  in-app pause; the API key itself stays set in the environment).
- `components/command-center/firecrawl-connection.tsx` — shows
  `Send test scrape` (configured, not yet tested; scrapes a fixed,
  neutral test URL) / `Pause` (connected) / `Not active yet` (not
  configured).

Like Slack, this increment does not yet wire Firecrawl into any automatic
briefing feed — only a manual, Andrew-initiated (or future, explicitly
requested) single-page scrape exists today.

## Increment 6: Monday.com (read-only board listing)

A follow-up PR adds Monday.com. Like Slack and Firecrawl, Monday's personal
API token needs no OAuth flow — just `MONDAY_API_TOKEN` in the server
environment.

- `lib/command-center/integrations/monday.ts` — same
  graceful-degradation pattern (`MondayConfigError`). `listMondayBoards()`
  is a read-only GraphQL query (`{ boards { id name } }`) — **there is no
  mutation query anywhere in this module.** Task sync (reading or writing
  `personal_tasks` to/from a Monday board) is a distinct, separately
  approved change; per the approval rules above, writing to Monday.com
  without Andrew approving the specific sync direction first must never be
  automatic.
- `app/api/command-center/integrations/monday/boards/route.ts` — Andrew-only
  `GET` that lists Andrew's boards (id, name only) to confirm the token
  works, marking the integration `connected`/`error`.
- `app/api/command-center/integrations/monday/disable/route.ts` —
  Andrew-only `POST` that resets the stored status to `disconnected` (an
  in-app pause; the API token stays set in the environment).
- `components/command-center/monday-connection.tsx` — shows
  `List boards` (configured, not yet tested) / `Pause` (connected) /
  `Not active yet` (not configured).

This increment is intentionally read-only end to end: no task, board item,
or column value is ever created, updated, or deleted by any code in this
PR.

## Increment 7: LinkedIn (drafting only, no API)

A follow-up PR adds the seventh and final integration from the priority
order. LinkedIn has no API integration at all — SAGE drafts post/outreach
text locally using the same OpenAI/Azure OpenAI provider already
configured for SAGE chat (`lib/command-center/sage.ts`). There is no
LinkedIn credential, no OAuth flow, and no post/send function anywhere in
the codebase.

- `lib/command-center/integrations/linkedin.ts` — `draftLinkedInContent()`
  calls SAGE's existing `streamSageResponse()` with LinkedIn-specific
  instructions for either a `post` or an `outreach` message. Both
  instruction sets explicitly tell the model never to claim the content has
  been posted or sent. **There is no send/post function anywhere in this
  module.**
- `lib/command-center/integrations-meta.ts` — `isIntegrationConfigured()`
  special-cases `linkedin` to check `readSageProviderConfig().configured`
  instead of a `requiredEnv` list, since there is no dedicated LinkedIn
  credential — the drafting capability is configured exactly when SAGE
  chat is.
- `app/api/command-center/integrations/linkedin/draft/route.ts` —
  Andrew-only `POST { kind, topic }` that returns generated draft text only.
  Returns SAGE's existing "not configured" message (503) when no AI
  provider is set up, matching the graceful-degradation behavior SAGE chat
  already has.
- `app/api/command-center/integrations/linkedin/disable/route.ts` —
  Andrew-only `POST` that resets the stored status to `disconnected` (there
  is no credential to revoke; this is purely an in-app pause).
- `components/command-center/linkedin-connection.tsx` — a small inline form
  (draft type, topic, "Draft with SAGE" button, read-only result textarea)
  instead of the single-button pattern used by the other integrations,
  since this one needs input from Andrew to draft anything useful.

Every draft is returned as plain text for Andrew to copy and post or send
himself. No code path in this repository calls a LinkedIn API, and none is
planned without a fresh, separately reviewed decision to add one.

## Increment 8: Wiring Calendar and Gmail into SAGE chat

Every increment above intentionally stopped short of feeding its data into
SAGE's actual chat conversation — each said so explicitly. This increment
closes that gap for Calendar and Gmail (Drive and the rest remain deferred,
still chat-invisible, exactly as documented in their own increments above).

- `lib/command-center/sage-live-context.ts` — new module that assembles
  read-only live integration context for one chat turn: up to 5 upcoming
  Google Calendar events, and up to 5 recent Gmail messages (subject, from,
  snippet only — never full body, matching the same minimal-exposure
  default `listRecentGmailMessages` already uses for triage). Each
  integration's fetch is isolated: a Calendar failure (expired token,
  network error, not connected) never blocks Gmail's context or the
  overall chat turn, and vice versa. If neither integration is connected,
  or both fail, `buildLiveIntegrationContext` returns `undefined` and SAGE
  falls back to task-only context exactly as it did before this existed.
- `lib/command-center/integrations/google-calendar-token.ts` — extracted
  the token load/refresh/persist sequence out of the events route (mirrors
  `gmail-token.ts`) so both the events route and the new live-context
  module share one implementation instead of duplicating it.
- `app/api/command-center/chat/route.ts` — now fetches
  `buildLiveIntegrationContext(session)` alongside open tasks and recent
  conversation turns, and passes it into `buildSageInstructions`.
- `lib/command-center/sage.ts` — `buildSageInstructions` takes an optional
  second argument for this pre-fetched context. The system prompt and the
  `command_center.task_aware_chat` skill prompt both changed:
  - Old: "You cannot send messages, update calendars, access Gmail, access
    Drive, ... or take autonomous actions."
  - New: SAGE may reference read-only Calendar/Gmail context **when it is
    provided that turn**, but still cannot create/update/delete a calendar
    event, cannot send email or create a Gmail draft **from chat**, and
    still cannot access Drive, Slack, Firecrawl, or Monday.com from chat.
    Organizing mail (labels/folders) and the triage-and-draft flow remain
    actions Andrew triggers from the integrations page directly — chat can
    talk about that data, not act on it, since there is still no tool
    calling in this phase.

This is a narrow, additive change to what SAGE can read, not what it can
do: no new write capability was added anywhere, and the "no tool calls, no
function actions" rule from Phase 1B is unchanged. Google Drive, Slack,
Firecrawl, Monday.com, and LinkedIn context remain chat-invisible until
each gets the same treatment in its own separately reviewed change.

## Increment 9: Google Calendar create/edit events

Andrew explicitly approved this: Google Calendar moves from read-only to
read + create/edit, Andrew-triggered only, from the Calendar card on
`/command-center/integrations`. There is still no delete-event capability,
and still no tool-calling path that lets SAGE chat create or edit an event
itself — chat can reference calendar context (Increment 8) but cannot act
on it.

- `lib/command-center/integrations/google-calendar.ts` — the OAuth scope
  widens from `calendar.readonly` to `calendar.events`, which grants
  read/write on events only, not the broader `calendar` scope (which would
  also allow managing the calendar list and calendar settings this
  integration has no need for). `createGoogleCalendarEvent` and
  `updateGoogleCalendarEvent` are the only two new write calls; there is no
  delete function anywhere in this module.
- `updateGoogleCalendarEvent` is a partial update — only the fields
  actually provided in a patch are sent to Google, so editing just a title
  doesn't clobber an event's existing time or description.
- `app/api/command-center/integrations/google-calendar/events/route.ts` —
  gains a `POST` alongside the existing `GET`, creating exactly one event
  from `{ summary, start, end, description?, isAllDay?, timeZone? }`.
- `app/api/command-center/integrations/google-calendar/events/[id]/route.ts`
  — new `PATCH` route for partial updates to one existing event, same
  Andrew-only gate and token-refresh handling as every other Calendar/Gmail
  route.
- `components/command-center/google-calendar-connection.tsx` — once
  connected, lists upcoming events with an `Edit` button per event and a
  `New event` button, both opening the same inline form (title, all-day
  toggle, start/end, description). The browser's own IANA time zone
  (`Intl.DateTimeFormat().resolvedOptions().timeZone`) is sent alongside a
  timezone-less `datetime-local` value, matching how Google's API expects
  a `dateTime` + separate `timeZone` field to be paired.

Every create/edit action requires Andrew to fill out and submit the form
himself in that session — nothing here is scheduled, and nothing here is
reachable from SAGE chat.

## Increment 10: Google Drive read content + organize (move/create folders)

Following the same "everything an assistant could do" direction applied to
Gmail (Increment 2) and Calendar (Increment 9), Drive expands from
metadata-only search to reading file content and organizing files into
folders. There is still no content-write, no rename, and no delete
function anywhere in this module.

- `lib/command-center/integrations/google-drive.ts` — the OAuth scope
  widens from `drive.metadata.readonly` to two scopes together:
  `drive.readonly` (read metadata + content) and `drive.metadata`
  (read/write metadata only — no content). This pair is deliberately
  narrower than the single broader `drive` scope, which would also allow
  directly overwriting a file's content; organizing (moving files,
  creating folders) only ever touches a file's name and parents, never its
  bytes, so `drive.metadata` is sufficient.
- `getGoogleDriveFileContent` reads Google Docs/Sheets/Slides via Google's
  own export endpoint (as plain text/CSV) and plain-text-ish files
  (`text/plain`, `text/markdown`, `text/csv`, `application/json`) via
  direct download. Any other type (PDF, images, Office formats, folders,
  etc.) throws a descriptive error instead of attempting binary parsing —
  this integration only ever reads what converts cleanly to text, matching
  the same text-first approach used for Gmail message bodies. Content is
  truncated to 4,000 characters, the same safety limit Firecrawl uses.
- `listGoogleDriveFolders`/`createGoogleDriveFolder`/`findOrCreateGoogleDriveFolder`
  manage folders (folders are just files with the Drive folder mimeType);
  `moveGoogleDriveFile` replaces a file's current parent(s) with the
  target folder's id — Drive's actual mechanism for "moving" a file,
  since a file can technically have multiple parents.
- `app/api/command-center/integrations/google-drive/files/[id]/route.ts` —
  Andrew-only read of one file's content (looks up its mimeType first,
  then reads accordingly; returns 415 for an unsupported type).
- `app/api/command-center/integrations/google-drive/folders/route.ts` —
  Andrew-only `GET` (list folders) and `POST { name }` (create a folder).
- `app/api/command-center/integrations/google-drive/files/[id]/move/route.ts`
  — Andrew-only `POST { folderName }` that moves one file to a folder
  (creating it first if needed).
- `components/command-center/google-drive-connection.tsx` — search results
  now show `Read` (fetches and displays content inline) and `Move to…`
  (names a folder, creating it if it doesn't exist) per file.

Like Gmail's organize capability, this is read/organize only — reading a
file's content or moving it between folders never changes what's inside
the file, and every action is Andrew-triggered from the integrations page,
never scheduled and never reachable from SAGE chat.
